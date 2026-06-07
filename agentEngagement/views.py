from datetime import timedelta

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
from .runner import enrich_prospect_with_social_analysis, prepare_engagement
from .sender import EngagementSender
from .social.session_manager import ensure_platform_session, open_facebook_login_session


ENGAGEMENT_STATUSES = [
    "new",
    "preparing",
    "message_ready",
    "sending",
    "message_sent",
    "message_failed",
    "replied",
    "follow_up_required",
    "closed",
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
    }
    return legacy_map.get(status_value, status_value or "new")


def prospect_queryset(user):
    return Prospect.objects.select_related("prospect_company", "assigned_to").filter(
        company=user.company
    )


def get_prospect_or_404(user, prospect_id):
    return prospect_queryset(user).get(pk=prospect_id)


def serialize_prospect(prospect, request):
    data = ProspectSerializer(prospect, context={"request": request}).data
    data["engagement_status"] = normalize_status(prospect.engagement_status)
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


class EngagementDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = prospect_queryset(request.user)
        counts = {key: 0 for key in ENGAGEMENT_STATUSES}
        for row in qs.values("engagement_status").annotate(total=Count("id")):
            counts[normalize_status(row["engagement_status"])] = (
                counts.get(normalize_status(row["engagement_status"]), 0) + row["total"]
            )
        return Response(
            {
                "new": counts.get("new", 0),
                "to_prepare": counts.get("new", 0) + counts.get("preparing", 0),
                "message_ready": counts.get("message_ready", 0),
                "message_sent": counts.get("message_sent", 0),
                "replied": counts.get("replied", 0),
                "errors": counts.get("message_failed", 0),
                "follow_up_required": counts.get("follow_up_required", 0),
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
                "message_failed": ["message_failed", "failed"],
                "message_sent": ["message_sent", "contacted", "waiting_reply"],
                "preparing": ["preparing", "analyzing", "qualified"],
                "follow_up_required": ["follow_up_required", "task_created"],
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

        data = [serialize_prospect(prospect, request) for prospect in qs.order_by("-created_at")[:200]]
        return Response({"results": data, "count": qs.count()})


class PrepareEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

        prospect.engagement_status = "preparing"
        prospect.engagement_error = None
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["engagement_status", "engagement_error", "last_engagement_at"])

        result = prepare_engagement(prospect=prospect, user=request.user, scrape=bool(request.data.get("scrape", True)))
        prospect.refresh_from_db()

        if result.get("success") and normalize_status(prospect.engagement_status) == "message_ready":
            log = create_log(
                prospect,
                request.user,
                "message_generated",
                "message_ready",
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
                f"Message pret pour {prospect.first_name} {prospect.last_name}",
                "Un message IA est pret a etre relu.",
                "success",
                prospect,
            )
            return Response(
                {
                    "success": True,
                    "status": "message_ready",
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


class ProspectMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, prospect_id):
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

        message = (request.data.get("message") or "").strip()
        channel, channel_error = validate_channel_for_prospect(prospect, request.data.get("channel"))
        if not message:
            return Response({"success": False, "error": "Message vide interdit."}, status=400)
        if channel_error:
            return Response({"success": False, "error": channel_error}, status=400)

        prospect.generated_message = message
        prospect.last_engagement_channel = channel
        prospect.engagement_status = "message_ready"
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
        log = create_log(prospect, request.user, "message_updated", "message_ready", channel, message)
        mark_channel_task_ready(prospect, channel, message, user=request.user, engagement_log=log)
        return Response({"success": True, "status": "message_ready", "prospect": serialize_prospect(prospect, request)})


class SendPreparedEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

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
        prospect.engagement_status = "sending" if send else "message_ready"
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["generated_message", "last_engagement_channel", "engagement_status", "last_engagement_at"])

        result = EngagementSender().send_prepared(prospect, request.user, send=send)
        if result.get("success") and result.get("sent"):
            prospect.engagement_status = "message_sent"
            prospect.engagement_error = None
            prospect.last_engagement_at = timezone.now()
            prospect.save(update_fields=["engagement_status", "engagement_error", "last_engagement_at"])
            log = create_log(prospect, request.user, "message_sent", "message_sent", channel, message, sent_at=timezone.now())
            complete_channel_task_and_follow_up(prospect, channel, user=request.user, engagement_log=log)
            return Response({"success": True, "status": "message_sent", "sent": True, "prospect": serialize_prospect(prospect, request)})

        if result.get("test_mode"):
            log = create_log(prospect, request.user, "message_updated", "message_ready", channel, message)
            mark_channel_task_ready(prospect, channel, message, user=request.user, engagement_log=log)
            return Response({"success": True, "status": "message_ready", "sent": False, "test_mode": True, "prospect": serialize_prospect(prospect, request)})

        if result.get("status") in {"linkedin_login_required", "login_required", "checkpoint_required"}:
            prospect.engagement_status = "message_ready"
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
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

        logs = prospect.engagement_logs.filter(company=request.user.company).values(
            "id", "action", "channel", "message", "status", "error", "sent_at", "created_at"
        )
        return Response({"results": list(logs)})


class AnalyzeSocialProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

        channel = request.data.get("channel") or prospect.last_engagement_channel
        result = enrich_prospect_with_social_analysis(prospect, channel=channel, force=True)
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
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

        prospect.engagement_status = "replied"
        prospect.last_engagement_at = timezone.now()
        prospect.save(update_fields=["engagement_status", "last_engagement_at"])
        create_log(prospect, request.user, "replied", "replied", prospect.last_engagement_channel, prospect.generated_message)
        notify(request.user, f"Reponse recue de {prospect.first_name} {prospect.last_name}", "Le prospect a ete marque comme repondu.", "success", prospect)
        return Response({"success": True, "status": "replied", "prospect": serialize_prospect(prospect, request)})


class CreateFollowUpTaskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        try:
            prospect = get_prospect_or_404(request.user, prospect_id)
        except Prospect.DoesNotExist:
            return Response({"success": False, "error": "Prospect introuvable"}, status=404)

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

    def get(self, request):
        campaigns = EngagementCampaign.objects.filter(company=request.user.company).prefetch_related("prospects")
        return Response(
            {
                "results": [
                    {
                        "id": campaign.id,
                        "name": campaign.name,
                        "description": campaign.description,
                        "status": campaign.status,
                        "steps": campaign.steps,
                        "prospect_ids": list(campaign.prospects.values_list("id", flat=True)),
                        "prospects_count": campaign.prospects.count(),
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
        if platform == "facebook":
            return Response(open_facebook_login_session())

        result = ensure_platform_session(request.user.id, platform)
        if result.get("status") == "login_required":
            result["message"] = "Une fenetre vient de s'ouvrir. Connectez-vous puis cliquez sur Verifier la session."
        return Response(result)


class FacebookOpenSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(open_facebook_login_session())


class SocialSessionCheckView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        platform = (request.query_params.get("platform") or "").strip().lower()
        result = ensure_platform_session(request.user.id, platform)
        return Response(result)
