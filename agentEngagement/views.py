from datetime import timedelta
import logging
from math import ceil

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Notifications.models import Notification
from sales.models import Prospect
from sales.serializers import ProspectSerializer
from sales.engagement_tasks import (
    complete_channel_task_and_follow_up,
    mark_channel_task_ready,
    upsert_prospect_task,
)

from .models import EngagementCampaign, EngagementLog
from .permissions import (
    get_engagement_queryset_for_user,
    get_team_users_for_manager,
    is_company_engagement_admin,
    is_global_engagement_admin,
)
from .reply_checker import check_prospect_reply
from .runner import enrich_prospect_with_social_analysis, launch_engagement_agent, prepare_engagement
from .sender import EngagementSender
from .social.session_manager import (
    check_social_session,
    open_social_login_window,
    reset_social_session,
)

logger = logging.getLogger(__name__)


ENGAGEMENT_STATUSES = [
    "new",
    "preparing",
    "pending_validation",
    "message_ready",
    "sending",
    "message_sent",
    "reply_detected",
    "followup_generated",
    "opportunity_ready",
    "message_failed",
    "replied",
    "follow_up_required",
    "closed",
    "rejected",
]

CHANNELS = {"linkedin", "email", "facebook", "instagram"}


def normalize_status(status_value):
    legacy_map = {
        "analyzing": "preparing",
        "qualified": "preparing",
        "failed": "message_failed",
        "contacted": "message_sent",
        "waiting_reply": "message_sent",
        "task_created": "follow_up_required",
        "message_ready": "pending_validation",
    }
    return legacy_map.get(status_value, status_value or "new")


def prospect_queryset(user):
    return get_engagement_queryset_for_user(user)


def unauthorized_prospect_response(request, prospect_id):
    logger.warning(
        "Unauthorized engagement access user=%s prospect=%s",
        getattr(request.user, "id", None),
        prospect_id,
    )
    return Response({"detail": "Vous n'avez pas acces a ce prospect."}, status=403)


def get_allowed_prospect(user, prospect_id):
    return prospect_queryset(user).filter(pk=prospect_id).first()


def serialize_prospect(prospect, request):
    data = ProspectSerializer(prospect, context={"request": request}).data
    data["engagement_status"] = normalize_status(prospect.engagement_status)
    data["lead_origin"] = getattr(prospect, "lead_origin", "manual")
    data["engagement_message"] = prospect.generated_message or ""
    data["engagement_channel"] = prospect.last_engagement_channel
    data["company_name"] = prospect.prospect_company.name if prospect.prospect_company else ""
    data["social_profile_summary"] = prospect.social_profile_summary or ""
    data["social_profile_description"] = prospect.social_profile_description or ""
    data["social_profile_interests"] = prospect.social_profile_interests or []
    data["social_profile_activity_level"] = prospect.social_profile_activity_level or ""
    data["social_profile_tone"] = prospect.social_profile_tone or ""
    data["social_profile_relevance"] = prospect.social_profile_relevance or ""
    data["social_profile_hook"] = prospect.social_profile_hook or ""
    data["social_profile_topics"] = prospect.social_profile_topics or []
    data["social_profile_analysis"] = prospect.social_profile_analysis or {}
    data["social_profile_last_analyzed_at"] = prospect.social_profile_last_analyzed_at
    data["last_message_sent"] = prospect.last_message_sent or ""
    data["last_message_sent_at"] = prospect.last_message_sent_at
    data["last_reply_checked_at"] = prospect.last_reply_checked_at
    data["last_reply_text"] = prospect.last_reply_text or ""
    data["last_reply_at"] = prospect.last_reply_at
    data["reply_summary"] = prospect.reply_summary or ""
    data["reply_sentiment"] = prospect.reply_sentiment or ""
    data["next_recommended_action"] = prospect.next_recommended_action or ""
    data["generated_followup_message"] = prospect.generated_followup_message or ""
    data["conversation_status"] = prospect.conversation_status or "not_contacted"
    data["has_opportunity"] = prospect.opportunities.exists()
    return data


def create_log(prospect, user, action, status_value, channel=None, message=None, error=None, sent_at=None):
    return EngagementLog.objects.create(
        prospect=prospect,
        user=user,
        company=user.company,
        action=action,
        channel=channel,
        message=message,
        status=status_value,
        error=error,
        sent_at=sent_at,
    )


def notify(user, title, message, notif_type, prospect):
    Notification.objects.create(
        recipient=user,
        title=title,
        message=message,
        notif_type=notif_type,
        entity_type="prospect",
        entity_id=prospect.id,
        entity_name=f"{prospect.first_name} {prospect.last_name}".strip(),
    )


def validate_channel_for_prospect(prospect, channel):
    channel = (channel or "").strip().lower()
    if channel not in CHANNELS:
        return None, "Canal invalide."
    if channel == "linkedin" and not prospect.linkedin_url:
        return None, "LinkedIn URL manquante."
    if channel == "email" and not prospect.email:
        return None, "Email manquant."
    if channel == "facebook" and not prospect.facebook_url:
        return None, "Facebook URL manquante."
    if channel == "instagram" and not prospect.instagram_url:
        return None, "Instagram URL manquante."
    return channel, None


def request_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


class EngagementDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = prospect_queryset(request.user)
        counts = {key: 0 for key in ENGAGEMENT_STATUSES}
        for row in qs.values("engagement_status").annotate(total=Count("id")):
            counts[normalize_status(row["engagement_status"])] = (
                counts.get(normalize_status(row["engagement_status"]), 0) + row["total"]
            )
        manual_prospects = qs.filter(lead_origin="manual").count()
        agent_prospects = qs.exclude(lead_origin="manual").count()
        opportunities_ready = counts.get("opportunity_ready", 0)
        return Response(
            {
                "new": counts.get("new", 0),
                "to_prepare": counts.get("new", 0) + counts.get("preparing", 0),
                "pending_validation": counts.get("pending_validation", 0) + counts.get("message_ready", 0),
                "message_ready": counts.get("pending_validation", 0) + counts.get("message_ready", 0),
                "to_validate": counts.get("pending_validation", 0) + counts.get("message_ready", 0),
                "message_sent": counts.get("message_sent", 0),
                "replied": counts.get("replied", 0)
                + counts.get("reply_detected", 0)
                + counts.get("opportunity_ready", 0),
                "errors": counts.get("message_failed", 0),
                "follow_up_required": counts.get("follow_up_required", 0) + counts.get("followup_generated", 0),
                "manual_prospects": manual_prospects,
                "agent_prospects": agent_prospects,
                "opportunities_ready": opportunities_ready,
                "by_status": counts,
            }
        )


class EngagementProspectsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = prospect_queryset(request.user)
        status_filter = request.query_params.get("status")
        channel = request.query_params.get("channel")
        search = request.query_params.get("search")

        if status_filter and status_filter != "all":
            legacy_statuses = {
                "pending_validation": ["pending_validation", "message_ready"],
                "message_ready": ["pending_validation", "message_ready"],
                "message_failed": ["message_failed", "failed"],
                "message_sent": ["message_sent", "contacted", "waiting_reply"],
                "reply_detected": ["reply_detected"],
                "followup_generated": ["followup_generated"],
                "opportunity_ready": ["opportunity_ready"],
                "replied": ["replied", "reply_detected", "opportunity_ready"],
                "preparing": ["preparing", "analyzing", "qualified"],
                "follow_up_required": ["follow_up_required", "followup_generated", "task_created"],
            }.get(status_filter, [status_filter])
            qs = qs.filter(engagement_status__in=legacy_statuses)
        if channel and channel != "all":
            qs = qs.filter(last_engagement_channel=channel)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(title__icontains=search)
                | Q(prospect_company__name__icontains=search)
            )

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
        except (TypeError, ValueError):
            page = 1

        try:
            page_size = int(request.query_params.get("page_size", 10))
        except (TypeError, ValueError):
            page_size = 10
        page_size = min(max(page_size, 1), 100)

        total = qs.count()
        pages = max(ceil(total / page_size), 1)
        if page > pages:
            page = pages

        start = (page - 1) * page_size
        end = start + page_size
        data = [serialize_prospect(prospect, request) for prospect in qs.order_by("-created_at")[start:end]]
        return Response(
            {
                "results": data,
                "count": total,
                "total": total,
                "pages": pages,
                "page": page,
                "page_size": page_size,
            }
        )


class PrepareEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        prospect.engagement_status = "preparing"
        prospect.engagement_error = None
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["engagement_status", "engagement_error", "last_engagement_at"])

        result = prepare_engagement(prospect=prospect, user=request.user, scrape=request_bool(request.data.get("scrape"), True))
        prospect.refresh_from_db()

        if result.get("success") and normalize_status(prospect.engagement_status) == "pending_validation":
            log = create_log(
                prospect,
                request.user,
                "message_generated",
                "pending_validation",
                prospect.last_engagement_channel,
                prospect.generated_message,
            )
            mark_channel_task_ready(
                prospect,
                prospect.last_engagement_channel,
                prospect.generated_message,
                user=request.user,
                engagement_log=log,
            )
            notify(
                request.user,
                f"Message pret a valider pour {prospect.first_name} {prospect.last_name}",
                "Un message IA est pret a etre valide.",
                "success",
                prospect,
            )
            return Response(
                {
                    "success": True,
                    "status": "pending_validation",
                    "message": prospect.generated_message or "",
                    "channel": prospect.last_engagement_channel,
                    "prospect": serialize_prospect(prospect, request),
                }
            )

        if (
            result.get("platform") == "facebook"
            and result.get("status") in {"login_required", "checkpoint_required", "facebook_login_required"}
        ):
            message = result.get("message") or result.get("error") or "Connexion Facebook requise."
            prospect.engagement_status = "new"
            prospect.engagement_error = message
            prospect.last_engagement_channel = "facebook"
            prospect.save(
                update_fields=[
                    "engagement_status",
                    "engagement_error",
                    "last_engagement_channel",
                ]
            )
            return Response({**result, "prospect": serialize_prospect(prospect, request)})

        if not result.get("success"):
            prospect.engagement_status = "message_failed"
            prospect.engagement_error = result.get("error") or result.get("status")
            prospect.save(update_fields=["engagement_status", "engagement_error"])
            create_log(
                prospect,
                request.user,
                "send_error",
                "message_failed",
                prospect.last_engagement_channel,
                prospect.generated_message,
                prospect.engagement_error,
            )
            notify(request.user, f"Erreur engagement pour {prospect.first_name}", prospect.engagement_error or "", "error", prospect)

        return Response(result)


class LaunchEngagementAgentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        limit = int(request.data.get("limit") or getattr(settings, "ENGAGEMENT_AGENT_BATCH_LIMIT", 25))
        scrape = request_bool(request.data.get("scrape"), True)
        auto_send = request_bool(request.data.get("auto_send"), False)

        if auto_send:
            allow_auto_send = getattr(settings, "ENGAGEMENT_AGENT_AUTO_SEND_ENABLED", False)
            if not allow_auto_send:
                return Response(
                    {
                        "success": False,
                        "error": "L'envoi automatique est desactive. Activez ENGAGEMENT_AGENT_AUTO_SEND_ENABLED pour l'utiliser.",
                    },
                    status=400,
                )

        candidate_qs = prospect_queryset(request.user).filter(
            Q(engagement_status__isnull=True)
            | Q(engagement_status="")
            | Q(engagement_status="new")
            | Q(engagement_status="message_failed")
        )
        required = set()
        for prospect in candidate_qs[: min(limit, 500)]:
            if prospect.linkedin_url:
                required.add("linkedin")
            if prospect.facebook_url:
                required.add("facebook")
            if prospect.instagram_url:
                required.add("instagram")

        sessions = {}
        missing = []
        for platform in sorted(required):
            session_result = check_social_session(request.user.id, platform)
            sessions[platform] = session_result
            if not session_result.get("success"):
                missing.append(platform)

        if missing:
            return Response(
                {
                    "success": False,
                    "status": "social_login_required",
                    "missing": missing,
                    "sessions": sessions,
                    "message": "Connectez les reseaux sociaux requis avant de lancer l'agent.",
                },
                status=400,
            )

        first_prospect = prospect_queryset(request.user).first()
        if first_prospect:
            create_log(
                first_prospect,
                request.user,
                "agent_launched",
                "queued",
                message=f"limit={limit}; scrape={scrape}; auto_send={auto_send}",
            )

        try:
            from .tasks import launch_engagement_agent_task
        except Exception:
            launch_engagement_agent_task = None

        if launch_engagement_agent_task is not None:
            task = launch_engagement_agent_task.delay(
                request.user.company_id,
                request.user.id,
                limit,
                scrape,
                auto_send,
            )
            return Response({"success": True, "status": "queued", "task_id": task.id})

        result = launch_engagement_agent(
            company=request.user.company,
            user=request.user,
            limit=limit,
            scrape=scrape,
            auto_send=auto_send,
        )

        return Response(result)


class ProspectMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        message = (request.data.get("message") or "").strip()
        channel, channel_error = validate_channel_for_prospect(prospect, request.data.get("channel"))
        if not message:
            return Response({"success": False, "error": "Message vide interdit."}, status=400)
        if channel_error:
            return Response({"success": False, "error": channel_error}, status=400)
        if prospect.engagement_status not in {"pending_validation", "message_ready", "task_created", "sending"}:
            return Response(
                {
                    "success": False,
                    "status": "message_not_ready",
                    "engagement_status": normalize_status(prospect.engagement_status),
                },
                status=400,
            )

        prospect.generated_message = message
        prospect.last_engagement_channel = channel
        prospect.engagement_status = "pending_validation"
        prospect.engagement_error = None
        prospect.last_engagement_at = timezone.now()
        prospect.save(
            update_fields=[
                "generated_message",
                "last_engagement_channel",
                "engagement_status",
                "engagement_error",
                "last_engagement_at",
            ]
        )
        log = create_log(prospect, request.user, "message_updated", "pending_validation", channel, message)
        mark_channel_task_ready(prospect, channel, message, user=request.user, engagement_log=log)
        return Response({"success": True, "status": "pending_validation", "prospect": serialize_prospect(prospect, request)})


class RejectPreparedEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        reason = request.data.get("reason") or "Message refuse par le commercial."
        prospect.engagement_status = "rejected"
        prospect.engagement_error = reason
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["engagement_status", "engagement_error", "last_engagement_at"])

        create_log(
            prospect,
            request.user,
            "message_rejected",
            "rejected",
            prospect.last_engagement_channel,
            prospect.generated_message,
            error=reason,
        )

        return Response(
            {
                "success": True,
                "status": "rejected",
                "prospect": serialize_prospect(prospect, request),
            }
        )


class SendPreparedEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        message = (request.data.get("message") or prospect.generated_message or "").strip()
        channel, channel_error = validate_channel_for_prospect(
            prospect, request.data.get("channel") or prospect.last_engagement_channel
        )
        send = bool(request.data.get("send", True))

        if not message:
            return Response({"success": False, "error": "Message vide interdit."}, status=400)
        if channel_error:
            return Response({"success": False, "error": channel_error}, status=400)

        prospect.generated_message = message
        prospect.last_engagement_channel = channel
        prospect.engagement_status = "sending" if send else "pending_validation"
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["generated_message", "last_engagement_channel", "engagement_status", "last_engagement_at"])

        result = EngagementSender().send_prepared(prospect, request.user, send=send)
        if result.get("success") and result.get("sent"):
            prospect.engagement_status = "waiting_reply"
            prospect.engagement_error = None
            sent_at = timezone.now()
            prospect.last_engagement_at = sent_at
            prospect.last_message_sent = message
            prospect.last_message_sent_at = sent_at
            prospect.conversation_status = "waiting_reply"
            prospect.save(
                update_fields=[
                    "engagement_status",
                    "engagement_error",
                    "last_engagement_at",
                    "last_message_sent",
                    "last_message_sent_at",
                    "conversation_status",
                ]
            )
            log = create_log(prospect, request.user, "message_sent", "message_sent", channel, message, sent_at=sent_at)
            complete_channel_task_and_follow_up(prospect, channel, user=request.user, engagement_log=log)
            return Response({"success": True, "status": "waiting_reply", "sent": True, "prospect": serialize_prospect(prospect, request)})

        if result.get("test_mode"):
            prospect.engagement_status = "pending_validation"
            prospect.save(update_fields=["engagement_status"])
            log = create_log(prospect, request.user, "message_updated", "pending_validation", channel, message)
            mark_channel_task_ready(prospect, channel, message, user=request.user, engagement_log=log)
            return Response({"success": True, "status": "pending_validation", "sent": False, "test_mode": True, "prospect": serialize_prospect(prospect, request)})

        if result.get("status") in {"linkedin_login_required", "login_required", "checkpoint_required"}:
            prospect.engagement_status = "pending_validation"
            prospect.engagement_error = result.get("message")
            prospect.save(update_fields=["engagement_status", "engagement_error"])
            return Response({**result, "prospect": serialize_prospect(prospect, request)})

        error = result.get("error") or result.get("status") or "Erreur d'envoi."
        prospect.engagement_status = "message_failed"
        prospect.engagement_error = error
        prospect.save(update_fields=["engagement_status", "engagement_error"])
        create_log(prospect, request.user, "send_error", "message_failed", channel, message, error=error)
        notify(request.user, f"Erreur {channel} pour {prospect.first_name} {prospect.last_name}", error, "error", prospect)
        return Response({"success": False, "status": "message_failed", "error": error, "prospect": serialize_prospect(prospect, request)})


class ProspectLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        logs = prospect.engagement_logs.filter(company=request.user.company).values(
            "id", "action", "channel", "message", "status", "error", "sent_at", "created_at"
        )
        return Response({"results": list(logs)})


class AnalyzeSocialProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        channel = request.data.get("channel") or prospect.last_engagement_channel
        result = enrich_prospect_with_social_analysis(prospect, channel=channel, force=True, user=request.user)
        prospect.refresh_from_db()

        return Response(
            {
                "success": result.get("success", False),
                "prospect_id": prospect.pk,
                "analysis": prospect.social_profile_analysis or result.get("analysis") or {},
                "error": result.get("error") or result.get("reason"),
                "prospect": serialize_prospect(prospect, request),
            }
        )


class MarkRepliedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        prospect.engagement_status = "replied"
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["engagement_status", "last_engagement_at"])
        create_log(prospect, request.user, "replied", "replied", prospect.last_engagement_channel, prospect.generated_message)
        notify(request.user, f"Reponse recue de {prospect.first_name} {prospect.last_name}", "Le prospect a ete marque comme repondu.", "success", prospect)
        return Response({"success": True, "status": "replied", "prospect": serialize_prospect(prospect, request)})


class CheckProspectReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        result = check_prospect_reply(prospect, user=request.user)

        if result.get("requires_login"):
            prospect.last_reply_checked_at = timezone.now()
            prospect.engagement_error = result.get("message")
            prospect.save(update_fields=["last_reply_checked_at", "engagement_error"])
            return Response({**result, "prospect": serialize_prospect(prospect, request)})

        if not result.get("success"):
            prospect.last_reply_checked_at = timezone.now()
            prospect.engagement_error = result.get("message") or result.get("error")
            prospect.save(update_fields=["last_reply_checked_at", "engagement_error"])
            return Response({**result, "prospect": serialize_prospect(prospect, request)})

        now = timezone.now()
        prospect.last_reply_checked_at = now
        prospect.generated_followup_message = result.get("generated_reply") or ""
        prospect.next_recommended_action = result.get("recommended_action") or ""
        prospect.conversation_status = result.get("conversation_status") or (
            "reply_detected" if result.get("has_reply") else "followup_generated"
        )

        update_fields = [
            "last_reply_checked_at",
            "generated_followup_message",
            "next_recommended_action",
            "conversation_status",
        ]

        if result.get("has_reply"):
            prospect.last_reply_text = result.get("reply_text") or ""
            prospect.last_reply_at = now
            prospect.reply_summary = result.get("reply_summary") or ""
            prospect.reply_sentiment = result.get("sentiment") or ""
            prospect.engagement_status = (
                "opportunity_ready"
                if result.get("recommended_action") == "create_opportunity"
                else "replied"
            )
            prospect.engagement_error = None
            update_fields.extend(
                [
                    "last_reply_text",
                    "last_reply_at",
                    "reply_summary",
                    "reply_sentiment",
                    "engagement_status",
                    "engagement_error",
                ]
            )
            create_log(
                prospect,
                request.user,
                "replied",
                prospect.engagement_status,
                prospect.last_engagement_channel,
                result.get("reply_text"),
            )
        else:
            prospect.engagement_status = "follow_up_required"
            update_fields.append("engagement_status")
            create_log(
                prospect,
                request.user,
                "follow_up_created",
                "follow_up_required",
                prospect.last_engagement_channel,
                result.get("generated_reply"),
            )

        prospect.save(update_fields=update_fields)

        return Response(
            {
                **result,
                "status": prospect.engagement_status,
                "prospect_status": prospect.conversation_status,
                "prospect": serialize_prospect(prospect, request),
            }
        )


class CreateFollowUpTaskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        due_date = timezone.now() + timedelta(days=int(request.data.get("due_days", 3)))
        task = upsert_prospect_task(
            prospect,
            "follow_up",
            f"Relancer {prospect.first_name} {prospect.last_name}".strip(),
            request.data.get("description") or "Relance creee depuis l'agent d'engagement IA.",
            user=request.user,
            status="pending",
            priority=request.data.get("priority") or "medium",
            due_date=due_date,
        )
        prospect.engagement_status = "follow_up_required"
        prospect.save(update_fields=["engagement_status"])
        create_log(prospect, request.user, "follow_up_created", "follow_up_required", prospect.last_engagement_channel, prospect.generated_message)
        return Response({"success": True, "status": "follow_up_required", "task_id": task.id, "prospect": serialize_prospect(prospect, request)})


class EngagementCampaignsView(APIView):
    permission_classes = [IsAuthenticated]

    def get_campaign_queryset(self, user):
        campaigns = EngagementCampaign.objects.all()

        if is_global_engagement_admin(user):
            return campaigns

        if not getattr(user, "company_id", None):
            return campaigns.none()

        campaigns = campaigns.filter(company=user.company)
        if is_company_engagement_admin(user):
            return campaigns

        allowed_prospects = prospect_queryset(user)
        if getattr(user, "role", "") == "MANAGER":
            team_users = get_team_users_for_manager(user)
            return campaigns.filter(Q(created_by=user) | Q(created_by__in=team_users) | Q(prospects__in=allowed_prospects)).distinct()

        if getattr(user, "role", "") == "COMMERCIAL":
            return campaigns.filter(Q(created_by=user) | Q(prospects__in=allowed_prospects)).distinct()

        return campaigns.none()

    def get(self, request):
        campaigns = self.get_campaign_queryset(request.user).prefetch_related("prospects")
        allowed_prospects = prospect_queryset(request.user)
        return Response(
            {
                "results": [
                    {
                        "id": campaign.id,
                        "name": campaign.name,
                        "description": campaign.description,
                        "status": campaign.status,
                        "steps": campaign.steps,
                        "prospect_ids": list(campaign.prospects.filter(id__in=allowed_prospects).values_list("id", flat=True)),
                        "prospects_count": campaign.prospects.filter(id__in=allowed_prospects).count(),
                        "created_at": campaign.created_at,
                    }
                    for campaign in campaigns
                ]
            }
        )

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"success": False, "error": "Nom de campagne requis."}, status=400)
        prospect_ids = request.data.get("prospect_ids") or []
        prospects = prospect_queryset(request.user).filter(id__in=prospect_ids)
        campaign = EngagementCampaign.objects.create(
            name=name,
            description=request.data.get("description") or "",
            steps=request.data.get("steps") or [],
            created_by=request.user,
            company=request.user.company,
        )
        campaign.prospects.set(prospects)
        for prospect in prospects:
            create_log(prospect, request.user, "campaign_created", prospect.engagement_status, prospect.last_engagement_channel, prospect.generated_message)
        return Response({"success": True, "id": campaign.id, "prospects_count": campaign.prospects.count()}, status=status.HTTP_201_CREATED)


class SocialLoginView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        platform = (request.data.get("platform") or "").strip().lower()

        if platform not in {"linkedin", "facebook", "instagram"}:
            return Response(
                {
                    "success": False,
                    "status": "unsupported_platform",
                    "message": "Plateforme non supportee.",
                },
                status=400,
            )

        result = open_social_login_window(request.user.id, platform)
        return Response(result)


class SocialSessionCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        platform = (request.query_params.get("platform") or "").strip().lower()

        if platform not in {"linkedin", "facebook", "instagram"}:
            return Response(
                {
                    "success": False,
                    "status": "unsupported_platform",
                    "message": "Plateforme non supportee.",
                },
                status=400,
            )

        result = check_social_session(request.user.id, platform)
        return Response(result)


class SocialSessionResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        platform = (request.data.get("platform") or "").strip().lower()

        if platform not in {"linkedin", "facebook", "instagram"}:
            return Response(
                {
                    "success": False,
                    "status": "unsupported_platform",
                    "message": "Plateforme non supportee.",
                },
                status=400,
            )

        result = reset_social_session(request.user.id, platform)
        return Response(result)
