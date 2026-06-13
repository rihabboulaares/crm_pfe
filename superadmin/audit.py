import logging

from django.db.models import Count, Max, Min, Q, Sum
from django.utils import timezone

from .models import AIAgentRun, SuperAdminAuditLog

logger = logging.getLogger(__name__)


def create_audit_log(
    actor=None,
    company=None,
    action="update",
    module="superadmin",
    object_id=None,
    object_repr=None,
    description=None,
    metadata=None,
    ip_address=None,
):
    try:
        return SuperAdminAuditLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            company=company,
            action=action,
            module=module or "superadmin",
            object_id=str(object_id) if object_id is not None else None,
            object_repr=str(object_repr)[:255] if object_repr else None,
            description=description,
            ip_address=ip_address,
            metadata=metadata or {},
        )
    except Exception:
        logger.exception("[superadmin] Unable to create audit log")
        return None


def create_ai_agent_run(
    *,
    agent_type,
    company=None,
    launched_by=None,
    query=None,
    status="running",
    started_at=None,
    **metrics,
):
    try:
        data = {
            "agent_type": agent_type,
            "query": query,
            "status": status,
            "started_at": started_at or timezone.now(),
            **metrics,
        }
        if company is not None:
            data["company"] = company
        elif data.get("company_id") is None:
            data.pop("company_id", None)

        if launched_by is not None:
            data["launched_by"] = (
                launched_by if getattr(launched_by, "is_authenticated", False) else launched_by
            )
        elif data.get("launched_by_id") is None:
            data.pop("launched_by_id", None)

        return AIAgentRun.objects.create(**data)
    except Exception:
        logger.exception("[superadmin] Unable to create AI agent run")
        return None


def finish_ai_agent_run(run, *, status, error_message=None, finished_at=None, **metrics):
    if not run:
        return None

    finished = finished_at or timezone.now()
    update_fields = ["status", "finished_at"]
    run.status = status
    run.finished_at = finished

    for field, value in metrics.items():
        if hasattr(run, field) and value is not None:
            setattr(run, field, value)
            update_fields.append(field)

    if error_message:
        run.error_message = str(error_message)[:2000]
        update_fields.append("error_message")

    if run.started_at and not getattr(run, "duration_seconds", 0):
        run.duration_seconds = max((finished - run.started_at).total_seconds(), 0)
        update_fields.append("duration_seconds")

    try:
        run.save(update_fields=sorted(set(update_fields)))
    except Exception:
        logger.exception("[superadmin] Unable to finish AI agent run")
    return run


def backfill_agent_runs_from_existing_activity():
    """
    Create SuperAdmin agent rows from older CRM traces that existed before
    AIAgentRun logging was added. The metadata source keys keep it idempotent.
    """
    created = 0

    try:
        from agentEngagement.models import EngagementLog

        launch_logs = EngagementLog.objects.filter(action="agent_launched").select_related("company", "user")
        existing_launch_ids = set(
            AIAgentRun.objects.filter(metadata__source="engagement_log_launch").values_list(
                "metadata__source_id", flat=True
            )
        )
        for log in launch_logs[:500]:
            source_id = str(log.pk)
            if source_id in existing_launch_ids:
                continue
            finish = log.created_at
            related = EngagementLog.objects.filter(
                company=log.company,
                user=log.user,
                created_at__gte=log.created_at,
                created_at__lte=log.created_at + timezone.timedelta(hours=6),
            )
            messages_generated = related.filter(action__in=["message_generated", "message_updated"]).count()
            messages_sent = related.filter(action="message_sent").count()
            errors = related.filter(Q(action="send_error") | Q(error__isnull=False)).exclude(error="")
            last_activity = related.aggregate(v=Max("created_at"))["v"] or finish
            run = create_ai_agent_run(
                agent_type="engagement",
                company=log.company,
                launched_by=log.user,
                query=log.message or "Historique engagement existant",
                status="failed" if errors.exists() and not messages_generated else "partial" if errors.exists() else "success",
                started_at=log.created_at,
                prospects_found=related.values("prospect_id").distinct().count(),
                messages_generated=messages_generated,
                messages_sent=messages_sent,
                duration_seconds=max((last_activity - log.created_at).total_seconds(), 0),
                error_message=(errors.first().error[:500] if errors.first() and errors.first().error else None),
                metadata={"source": "engagement_log_launch", "source_id": source_id},
            )
            if run:
                run.finished_at = last_activity
                run.save(update_fields=["finished_at"])
                created += 1

        if not AIAgentRun.objects.filter(agent_type="engagement").exists():
            grouped = (
                EngagementLog.objects.filter(action__in=["message_generated", "message_sent", "send_error"])
                .values("company_id", "user_id", "created_at__date")
                .annotate(
                    first_at=Min("created_at"),
                    last_at=Max("created_at"),
                    prospects=Count("prospect_id", distinct=True),
                    generated=Count("id", filter=Q(action="message_generated")),
                    sent=Count("id", filter=Q(action="message_sent")),
                    errors=Count("id", filter=Q(action="send_error")),
                )
                .order_by("-first_at")[:100]
            )
            for row in grouped:
                source_id = f"{row['company_id']}:{row['user_id']}:{row['created_at__date']}"
                if AIAgentRun.objects.filter(metadata__source="engagement_log_daily", metadata__source_id=source_id).exists():
                    continue
                run = create_ai_agent_run(
                    agent_type="engagement",
                    company_id=row["company_id"],
                    launched_by_id=row["user_id"],
                    query="Historique engagement existant",
                    status="failed" if row["errors"] and not row["generated"] else "partial" if row["errors"] else "success",
                    started_at=row["first_at"],
                    prospects_found=row["prospects"],
                    messages_generated=row["generated"],
                    messages_sent=row["sent"],
                    duration_seconds=max((row["last_at"] - row["first_at"]).total_seconds(), 0),
                    metadata={"source": "engagement_log_daily", "source_id": source_id},
                )
                if run:
                    run.finished_at = row["last_at"]
                    run.save(update_fields=["finished_at"])
                    created += 1
    except Exception:
        logger.exception("[superadmin] Unable to backfill engagement AI runs")

    try:
        from sales.models import Prospect, ProspectCompany

        if not AIAgentRun.objects.filter(agent_type="prospection").exists():
            prospect_rows = (
                Prospect.objects.filter(Q(lead_origin__in=["prospection_agent", "google_maps", "linkedin", "facebook", "instagram", "website"]) | Q(source="agent_prospection") | Q(origin="agent_prospection"))
                .values("company_id", "created_at__date")
                .annotate(first_at=Min("created_at"), last_at=Max("created_at"), prospects=Count("id"))
                .order_by("-first_at")[:100]
            )
            company_rows = (
                ProspectCompany.objects.filter(Q(source="agent_prospection") | Q(source__in=["google_maps", "linkedin", "facebook", "instagram", "web"]))
                .values("company_id", "created_at__date")
                .annotate(companies=Count("id"))
            )
            companies_by_key = {
                (row["company_id"], row["created_at__date"]): row["companies"]
                for row in company_rows
            }
            for row in prospect_rows:
                source_id = f"{row['company_id']}:{row['created_at__date']}"
                if AIAgentRun.objects.filter(metadata__source="prospection_import_daily", metadata__source_id=source_id).exists():
                    continue
                companies_found = companies_by_key.get((row["company_id"], row["created_at__date"]), 0)
                run = create_ai_agent_run(
                    agent_type="prospection",
                    company_id=row["company_id"],
                    query="Historique prospection existant",
                    status="success",
                    started_at=row["first_at"],
                    prospects_found=row["prospects"] + companies_found,
                    prospects_imported=row["prospects"],
                    duration_seconds=max((row["last_at"] - row["first_at"]).total_seconds(), 0),
                    metadata={"source": "prospection_import_daily", "source_id": source_id},
                )
                if run:
                    run.finished_at = row["last_at"]
                    run.save(update_fields=["finished_at"])
                    created += 1
    except Exception:
        logger.exception("[superadmin] Unable to backfill prospection AI runs")

    return created


def backfill_audit_logs_from_existing_activity():
    created = 0

    try:
        from users.models import Company, User
        from subscriptions.models import CompanySubscription

        if not SuperAdminAuditLog.objects.filter(metadata__source="company_existing").exists():
            for company in Company.objects.select_related("owner").order_by("-created_at")[:500]:
                if create_audit_log(
                    actor=getattr(company, "owner", None),
                    company=company,
                    action="create",
                    module="companies",
                    object_id=company.pk,
                    object_repr=company.name,
                    description="Entreprise existante importee dans l'audit SuperAdmin",
                    metadata={"source": "company_existing", "source_id": str(company.pk)},
                ):
                    created += 1

        if not SuperAdminAuditLog.objects.filter(metadata__source="user_existing").exists():
            for user in User.objects.select_related("company").exclude(role="SUPERADMIN").order_by("-id")[:500]:
                if create_audit_log(
                    actor=None,
                    company=user.company,
                    action="create",
                    module="users",
                    object_id=user.pk,
                    object_repr=user.email,
                    description="Utilisateur existant importe dans l'audit SuperAdmin",
                    metadata={"source": "user_existing", "source_id": str(user.pk), "role": user.role},
                ):
                    created += 1

        if not SuperAdminAuditLog.objects.filter(metadata__source="subscription_existing").exists():
            for sub in CompanySubscription.objects.select_related("company", "plan").order_by("-start_date")[:500]:
                if create_audit_log(
                    actor=None,
                    company=sub.company,
                    action="subscription_change",
                    module="subscriptions",
                    object_id=sub.pk,
                    object_repr=getattr(sub.plan, "name", "Abonnement"),
                    description="Abonnement existant importe dans l'audit SuperAdmin",
                    metadata={"source": "subscription_existing", "source_id": str(sub.pk), "is_active": sub.is_active},
                ):
                    created += 1
    except Exception:
        logger.exception("[superadmin] Unable to backfill base audit logs")

    try:
        from agentEngagement.models import EngagementLog

        for log in EngagementLog.objects.filter(action__in=["agent_launched", "message_sent", "send_error"]).select_related("company", "user", "prospect").order_by("-created_at")[:500]:
            source_id = str(log.pk)
            if SuperAdminAuditLog.objects.filter(metadata__source="engagement_log", metadata__source_id=source_id).exists():
                continue
            action = "launch_agent" if log.action == "agent_launched" else "send_message" if log.action == "message_sent" else "system_error"
            if create_audit_log(
                actor=log.user,
                company=log.company,
                action=action,
                module="ai_agents",
                object_id=getattr(log.prospect, "pk", None),
                object_repr=str(log.prospect) if log.prospect_id else "Agent engagement",
                description=log.error or log.message or log.get_action_display(),
                metadata={"source": "engagement_log", "source_id": source_id, "channel": log.channel, "status": log.status},
            ):
                created += 1
    except Exception:
        logger.exception("[superadmin] Unable to backfill engagement audit logs")

    return created
