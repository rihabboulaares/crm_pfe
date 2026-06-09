from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from agentEngagement.models import EngagementLog
from Notifications.models import HistoryLog
from sales.models import Contact, Opportunity, Prospect, Task, TaskActivity
from users.models import User


DONE_STATUSES = ["done", "completed"]
OPEN_TASK_STATUSES = ["todo", "pending", "ready", "in_progress"]
REPLY_STATUSES = ["replied", "reply_detected", "follow_up_required", "opportunity_ready"]
SENT_ACTIONS = ["message_sent"]
GENERATED_ACTIONS = ["message_generated", "message_updated"]


def pct(part, total):
    if not total:
        return 0
    return round((part / total) * 100, 1)


def user_display(user):
    if not user:
        return ""
    first_name = (getattr(user, "first_name", "") or "").strip()
    last_name = (getattr(user, "last_name", "") or "").strip()
    full_name = f"{first_name} {last_name}".strip()
    return full_name or getattr(user, "username", "") or getattr(user, "email", "") or str(user)


def team_user_ids(user):
    if getattr(user, "role", "") == "ADMIN":
        return list(User.objects.filter(company=user.company, is_active=True).values_list("id", flat=True))

    if getattr(user, "role", "") == "MANAGER":
        ids = {user.id}
        for team in user.teams.all():
            ids.update(team.members.filter(is_active=True).values_list("id", flat=True))
        return list(ids)

    return [user.id]


def scoped_querysets(user):
    company = user.company
    if getattr(user, "role", "") == "ADMIN":
        prospects = Prospect.objects.filter(company=company)
        opportunities = Opportunity.objects.filter(company=company)
        tasks = Task.objects.filter(company=company)
        contacts = Contact.objects.filter(company=company)
        users = User.objects.filter(company=company, is_active=True)
    elif getattr(user, "role", "") == "MANAGER":
        ids = team_user_ids(user)
        prospects = Prospect.objects.filter(company=company, assigned_to_id__in=ids)
        opportunities = Opportunity.objects.filter(company=company, assigned_to_id__in=ids)
        tasks = Task.objects.filter(company=company, assigned_to_id__in=ids)
        contacts = Contact.objects.filter(company=company, assigned_to_id__in=ids)
        users = User.objects.filter(company=company, id__in=ids, is_active=True)
    else:
        prospects = Prospect.objects.filter(company=company, assigned_to=user)
        opportunities = Opportunity.objects.filter(company=company, assigned_to=user)
        tasks = Task.objects.filter(company=company, assigned_to=user)
        contacts = Contact.objects.filter(company=company, assigned_to=user)
        users = User.objects.filter(id=user.id)

    return {
        "company": company,
        "prospects": prospects,
        "opportunities": opportunities,
        "tasks": tasks,
        "contacts": contacts,
        "users": users,
    }


def prospect_payload(p):
    return {
        "id": p.id,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "email": p.email,
        "phone": p.phone,
        "status": p.status,
        "evaluation": p.evaluation,
        "source": p.source or p.origin,
        "origin": p.origin,
        "city": p.city,
        "country": p.country,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "engagement_status": p.engagement_status,
        "conversation_status": p.conversation_status,
        "assigned_to": p.assigned_to_id,
        "created_at": p.created_at,
    }


def task_payload(t):
    return {
        "id": t.id,
        "title": t.title,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date,
        "assigned_to": t.assigned_to_id,
        "assigned_to_detail": {"username": user_display(t.assigned_to)} if t.assigned_to else None,
        "created_at": t.created_at,
    }


def opportunity_payload(o):
    return {
        "id": o.id,
        "name": o.name,
        "amount": str(o.amount or 0),
        "stage": o.stage,
        "expected_close_date": o.expected_close_date,
        "assigned_to": o.assigned_to_id,
        "created_at": o.created_at,
    }


def contact_payload(c):
    return {
        "id": c.id,
        "first_name": c.first_name,
        "last_name": c.last_name,
        "email": c.email,
        "phone": c.phone,
        "assigned_to": c.assigned_to_id,
        "created_at": c.created_at,
    }


def user_payload(u):
    return {"id": u.id, "username": user_display(u), "email": u.email, "role": u.role}


def series_by_day(queryset, date_field="created_at", days=30):
    start = timezone.now() - timedelta(days=days)
    rows = (
        queryset.filter(**{f"{date_field}__gte": start})
        .annotate(day=TruncDate(date_field))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    return [{"date": row["day"].isoformat(), "count": row["count"]} for row in rows]


def grouped_counts(queryset, field):
    return [
        {field: row[field] or "unknown", "count": row["count"]}
        for row in queryset.values(field).annotate(count=Count("id")).order_by("-count")
    ]


def base_metrics(scope):
    prospects = scope["prospects"]
    opportunities = scope["opportunities"]
    tasks = scope["tasks"]
    contacts = scope["contacts"]
    now = timezone.now()

    prospects_count = prospects.count()
    opportunities_count = opportunities.count()
    messages_sent = prospects.filter(
        Q(engagement_status__in=["message_sent", "waiting_reply"])
        | Q(last_message_sent_at__isnull=False)
    ).count()
    responses_detected = prospects.filter(
        Q(engagement_status__in=REPLY_STATUSES) | Q(last_reply_at__isnull=False)
    ).count()
    messages_generated = prospects.exclude(generated_message__isnull=True).exclude(generated_message="").count()

    return {
        "prospects_total": prospects_count,
        "contacts_total": contacts.count(),
        "opportunities_total": opportunities_count,
        "tasks_total": tasks.count(),
        "tasks_overdue": tasks.filter(due_date__lt=now).exclude(status__in=DONE_STATUSES).count(),
        "tasks_today": tasks.filter(due_date__date=now.date()).exclude(status__in=DONE_STATUSES).count(),
        "opportunities_won": opportunities.filter(stage="won").count(),
        "opportunities_open": opportunities.exclude(stage__in=["won", "lost"]).count(),
        "pipeline_amount": opportunities.aggregate(total=Sum("amount")).get("total") or 0,
        "conversion_rate": pct(opportunities_count, prospects_count),
        "messages_generated": messages_generated,
        "messages_sent": messages_sent,
        "responses_detected": responses_detected,
        "reply_rate": pct(responses_detected, messages_sent),
        "ai_validation_rate": pct(messages_sent, messages_generated),
        "hot_prospects": prospects.filter(Q(evaluation="hot") | Q(engagement_status__in=REPLY_STATUSES)).count(),
    }


def agent_metrics(scope):
    prospects = scope["prospects"]
    company = scope.get("company")
    company_filter = {"company": company} if company else {}
    engagement_logs = EngagementLog.objects.filter(**company_filter) if company else EngagementLog.objects.none()
    ai_logs = HistoryLog.objects.filter(company=company, actor_type__in=["prospection_agent", "engagement_agent"]) if company else HistoryLog.objects.none()

    prospection_imported = prospects.filter(Q(source="agent_prospection") | Q(origin="agent_prospection")).count()
    prospects_found = prospects.filter(source__in=["agent_prospection", "google_maps", "linkedin", "facebook", "instagram", "web"]).count()
    messages_generated = engagement_logs.filter(action__in=GENERATED_ACTIONS).count()
    messages_sent = engagement_logs.filter(action__in=SENT_ACTIONS).count()
    responses = engagement_logs.filter(action="replied").count() or prospects.filter(
        Q(engagement_status__in=REPLY_STATUSES) | Q(last_reply_at__isnull=False)
    ).count()

    return {
        "prospection_agent": {
            "searches": ai_logs.filter(actor_type="prospection_agent").count(),
            "prospects_found": prospects_found,
            "prospects_imported": prospection_imported,
            "qualification_rate": pct(prospects.filter(evaluation__in=["hot", "warm"]).count(), prospects.count()),
            "sources": grouped_counts(prospects, "source"),
            "cities": grouped_counts(prospects, "city")[:10],
            "countries": grouped_counts(prospects, "country")[:10],
        },
        "engagement_agent": {
            "messages_generated": messages_generated,
            "messages_sent": messages_sent,
            "responses_detected": responses,
            "reply_rate": pct(responses, messages_sent),
            "opportunities_created": scope["opportunities"].filter(prospect__in=prospects).count(),
            "errors_by_platform": list(
                engagement_logs.exclude(error__isnull=True)
                .exclude(error="")
                .values("channel")
                .annotate(count=Count("id"))
                .order_by("-count")
            ),
            "actions_by_day": series_by_day(engagement_logs, "created_at", 30),
            "responses_by_channel": list(
                engagement_logs.filter(action="replied")
                .values("channel")
                .annotate(count=Count("id"))
                .order_by("-count")
            ),
        },
    }


def top_commercials(scope):
    rows = []
    users = scope["users"].filter(role="COMMERCIAL")
    for user in users:
        prospects = scope["prospects"].filter(assigned_to=user)
        opportunities = scope["opportunities"].filter(assigned_to=user)
        tasks = scope["tasks"].filter(assigned_to=user)
        prospects_count = prospects.count()
        opportunities_count = opportunities.count()
        rows.append(
            {
                "id": user.id,
                "commercial": user_display(user),
                "prospects_created": prospects_count,
                "opportunities_created": opportunities_count,
                "tasks_completed": tasks.filter(status__in=DONE_STATUSES).count(),
                "messages_sent": prospects.filter(last_message_sent_at__isnull=False).count(),
                "conversion_rate": pct(opportunities_count, prospects_count),
                "pipeline_amount": opportunities.aggregate(total=Sum("amount")).get("total") or 0,
            }
        )
    return sorted(rows, key=lambda row: (row["opportunities_created"], row["tasks_completed"]), reverse=True)[:10]


def map_markers(scope):
    qs = scope["prospects"].exclude(latitude__isnull=True).exclude(longitude__isnull=True).select_related(
        "assigned_to", "prospect_company"
    )
    markers = []
    for p in qs[:500]:
        markers.append(
            {
                "id": p.id,
                "type": "prospect",
                "name": f"{p.first_name} {p.last_name}".strip(),
                "company": p.prospect_company.name if p.prospect_company else "",
                "city": p.city,
                "country": p.country,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "status": p.engagement_status or p.status,
                "source": p.source or p.origin,
                "assigned_to": user_display(p.assigned_to),
            }
        )
    return markers


def recommendations(scope):
    now = timezone.now()
    items = []

    stale = scope["prospects"].filter(
        engagement_status="waiting_reply",
        last_message_sent_at__lt=now - timedelta(days=3),
    )[:5]
    for prospect in stale:
        items.append(
            {
                "type": "follow_up",
                "priority": "high",
                "title": f"Relancer {prospect.first_name} {prospect.last_name}",
                "description": "Message envoyé il y a plus de 3 jours sans réponse détectée.",
                "action_url": f"/prospects/{prospect.id}",
            }
        )

    replied = scope["prospects"].filter(engagement_status__in=REPLY_STATUSES).exclude(opportunities__isnull=False)[:5]
    for prospect in replied:
        items.append(
            {
                "type": "create_opportunity",
                "priority": "high",
                "title": f"Créer une opportunité pour {prospect.first_name} {prospect.last_name}",
                "description": "Une réponse a été détectée mais aucune opportunité n'est liée.",
                "action_url": f"/prospects/{prospect.id}",
            }
        )

    overdue = scope["tasks"].filter(due_date__lt=now).exclude(status__in=DONE_STATUSES).select_related("assigned_to")[:5]
    for task in overdue:
        items.append(
            {
                "type": "overdue_task",
                "priority": "medium",
                "title": f"Tâche en retard : {task.title}",
                "description": f"Assignée à {user_display(task.assigned_to)}.",
                "action_url": f"/tasks/{task.id}",
            }
        )

    hot = scope["prospects"].filter(evaluation="hot", assigned_to__isnull=True)[:5]
    for prospect in hot:
        items.append(
            {
                "type": "assign_hot_prospect",
                "priority": "medium",
                "title": f"Assigner le prospect chaud {prospect.first_name} {prospect.last_name}",
                "description": "Prospect chaud non assigné.",
                "action_url": f"/prospects/{prospect.id}",
            }
        )

    return items[:12]


def dashboard_payload(user):
    scope = scoped_querysets(user)
    metrics = base_metrics(scope)
    agents = agent_metrics(scope)
    return {
        "role": user.role,
        "kpis": metrics,
        "agents": agents,
        "activity": {
            "prospects_by_day": series_by_day(scope["prospects"]),
            "opportunities_by_day": series_by_day(scope["opportunities"]),
            "tasks_by_day": series_by_day(scope["tasks"]),
        },
        "pipeline": grouped_counts(scope["opportunities"], "stage"),
        "prospects_by_status": grouped_counts(scope["prospects"], "status"),
        "prospects_by_source": grouped_counts(scope["prospects"], "source"),
        "top_commercials": top_commercials(scope),
        "markers": map_markers(scope),
        "recommendations": recommendations(scope),
        "prospects": [prospect_payload(p) for p in scope["prospects"].select_related("assigned_to")[:200]],
        "tasks": [task_payload(t) for t in scope["tasks"].select_related("assigned_to")[:200]],
        "opportunities": [opportunity_payload(o) for o in scope["opportunities"].select_related("assigned_to")[:200]],
        "contacts": [contact_payload(c) for c in scope["contacts"][:200]],
        "users": [user_payload(u) for u in scope["users"][:100]],
        "members": [user_payload(u) for u in scope["users"][:100]],
    }


class RoleDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    required_role = None

    def get(self, request):
        if self.required_role and request.user.role != self.required_role:
            return Response({"detail": "Forbidden"}, status=403)
        return Response(dashboard_payload(request.user))


class AdminDashboardView(RoleDashboardView):
    required_role = "ADMIN"


class ManagerDashboardView(RoleDashboardView):
    required_role = "MANAGER"


class CommercialDashboardView(RoleDashboardView):
    required_role = "COMMERCIAL"


class AgentsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(agent_metrics(scoped_querysets(request.user)))


class MapsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"markers": map_markers(scoped_querysets(request.user))})


class RecommendationsDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"recommendations": recommendations(scoped_querysets(request.user))})
