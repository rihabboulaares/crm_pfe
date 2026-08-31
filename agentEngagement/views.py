from datetime import timedelta
import logging
from math import ceil

from django.conf import settings
from django.core import signing
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from sales.models import Prospect, ProspectActivity
from sales.serializers import ProspectSerializer
from sales.engagement_tasks import (
    upsert_prospect_task,
)
from users.models import User

from .agent.context_builder import ProspectEngagementContextBuilder
from .agent.continuation import EngagementContinuationService
from .agent.content_generator import EngagementContentGenerationUnavailable
from .agent.initial_flow import EngagementInitialFlowService
from .agent.memory_manager import EngagementMemoryManager, serialize_memory
from .agent.replanner import EngagementReplanningService
from .agent.response_analyzer import ProspectResponseAnalysisUnavailable, ProspectResponseAnalyzer
from .agent.strategy_planner import EngagementPlanningUnavailable
from .email_providers.router import get_email_provider, normalize_email_provider_name, provider_is_configured
from .email_sender import get_active_email_connection, get_sender_context
from .interaction_recorder import (
    INTERACTION_ACTION_TYPES,
    INTERACTION_CHANNELS,
    INTERACTION_OUTCOMES,
    list_interactions,
    record_interaction,
    serialize_interaction,
)
from .models import EngagementCampaign, EngagementLog, UserEmailConnection
from .permissions import (
    get_engagement_queryset_for_user,
    get_team_users_for_manager,
    is_company_engagement_admin,
    is_global_engagement_admin,
)
from .serializers import EngagementInteractionSerializer

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

EMAIL_PROVIDERS = {UserEmailConnection.PROVIDER_GMAIL}


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


def serialize_email_connection(connection):
    if not connection:
        return {
            "connected": False,
            "provider": "",
            "email": "",
            "display_name": "",
            "last_verified_at": None,
            "token_expires_at": None,
        }
    return {
        "connected": True,
        "provider": connection.provider,
        "email": connection.email,
        "display_name": connection.display_name or "",
        "last_verified_at": connection.last_verified_at,
        "token_expires_at": connection.token_expires_at,
    }


def engagement_actor_for_log(log):
    if log.action == "replied":
        return "prospect"
    if log.action in {"message_generated", "agent_launched", "follow_up_created"}:
        return "agent"
    return "commercial"


def serialize_log_conversation_item(log):
    text = log.message or log.error or log.error_message or ""
    return {
        "id": f"log-{log.id}",
        "source": "engagement_log",
        "source_id": log.id,
        "actor": engagement_actor_for_log(log),
        "action": log.action,
        "channel": log.channel or "",
        "status": log.status,
        "text": text,
        "message": log.message or "",
        "error": log.error or log.error_message or "",
        "sender_name": log.sender_name or "",
        "sender_email": log.sender_email or "",
        "provider": log.provider or "",
        "provider_message_id": log.provider_message_id or "",
        "created_at": log.sent_at or log.created_at,
        "sent_at": log.sent_at,
    }


def serialize_activity_conversation_item(activity):
    metadata = activity.metadata or {}
    action_type = metadata.get("action_type") or activity.activity_type
    outcome = metadata.get("outcome") or ""
    prospect_response = metadata.get("prospect_response") or ""
    generated_content = metadata.get("generated_content_reference") or ""
    commercial_notes = metadata.get("commercial_notes") or ""
    text = prospect_response or generated_content or activity.description or commercial_notes or ""
    actor = "prospect" if prospect_response or activity.activity_type == "reply_received" else "commercial"
    if activity.source == "agent":
        actor = "agent"
    return {
        "id": f"activity-{activity.id}",
        "source": "prospect_activity",
        "source_id": activity.id,
        "actor": actor,
        "action": action_type,
        "channel": metadata.get("channel") or activity.channel or "",
        "status": metadata.get("status") or outcome or activity.source,
        "outcome": outcome,
        "text": text,
        "message": generated_content,
        "prospect_response": prospect_response,
        "commercial_notes": commercial_notes,
        "title": activity.title,
        "created_by_name": getattr(activity.created_by, "get_full_name", lambda: "")()
        or getattr(activity.created_by, "username", "")
        or getattr(activity.created_by, "email", ""),
        "created_at": activity.created_at,
    }


def serialize_activity_conversation_items(activity):
    item = serialize_activity_conversation_item(activity)
    generated_content = item.get("message") or ""
    prospect_response = item.get("prospect_response") or ""
    commercial_notes = item.get("commercial_notes") or ""

    if not generated_content or not prospect_response:
        return [item]

    sent_item = {
        **item,
        "id": f"{item['id']}-sent",
        "actor": "commercial",
        "action": item.get("action") or "message_sent",
        "status": item.get("status") or "SENT",
        "text": generated_content,
        "message": generated_content,
        "prospect_response": "",
        "commercial_notes": "",
    }
    reply_item = {
        **item,
        "id": f"{item['id']}-reply",
        "actor": "prospect",
        "action": "reply_received",
        "text": prospect_response,
        "message": "",
        "prospect_response": prospect_response,
        "commercial_notes": "",
    }

    items = [sent_item, reply_item]
    if commercial_notes:
        items.append(
            {
                **item,
                "id": f"{item['id']}-note",
                "actor": "commercial",
                "action": "commercial_note",
                "text": commercial_notes,
                "message": "",
                "prospect_response": "",
            }
        )
    return items


def generated_content_text(content_payload):
    payload = content_payload or {}
    if not payload.get("content_required"):
        return ""
    email = payload.get("email") or {}
    if email.get("body"):
        subject = email.get("subject") or ""
        return f"Objet: {subject}\n\n{email.get('body')}" if subject else email.get("body")
    social = payload.get("social_message") or {}
    if social.get("message"):
        return social.get("message")
    call_script = payload.get("call_script") or {}
    if call_script:
        parts = [
            call_script.get("opening"),
            call_script.get("hook"),
            call_script.get("value_proposition"),
            call_script.get("call_to_action"),
            call_script.get("closing"),
        ]
        questions = call_script.get("discovery_questions") or []
        return "\n".join([item for item in parts + questions if item])
    return ""


def persist_generated_content(prospect, user, content_payload):
    message = generated_content_text(content_payload)
    if not message:
        return None

    channel = (content_payload or {}).get("channel") or prospect.last_engagement_channel or ""
    email = (content_payload or {}).get("email") or {}
    prospect.generated_message = message
    prospect.engagement_subject = email.get("subject") or prospect.engagement_subject
    prospect.last_engagement_channel = channel
    prospect.engagement_status = "message_ready"
    prospect.last_engagement_at = timezone.now()
    prospect.save(
        update_fields=[
            "generated_message",
            "engagement_subject",
            "last_engagement_channel",
            "engagement_status",
            "last_engagement_at",
        ]
    )

    duplicate = prospect.engagement_logs.filter(
        company=user.company,
        action="message_generated",
        channel=channel,
        message=message,
    ).first()
    if duplicate:
        return duplicate

    return create_log(
        prospect,
        user,
        "message_generated",
        "message_ready",
        channel,
        message,
    )


def build_prospect_conversation(prospect, logs):
    activities = prospect.prospect_activities.select_related("created_by").filter(
        Q(metadata__kind="engagement_interaction")
        | Q(activity_type__in=["message_sent", "email_sent", "reply_received"])
    )[:100]
    items = [serialize_log_conversation_item(log) for log in logs]
    for activity in activities:
        items.extend(serialize_activity_conversation_items(activity))

    if prospect.last_message_sent:
        items.append(
            {
                "id": "prospect-last-message",
                "source": "prospect_snapshot",
                "actor": "commercial",
                "action": "LAST_MESSAGE_SENT",
                "channel": prospect.last_engagement_channel or "",
                "status": prospect.conversation_status or "",
                "text": prospect.last_message_sent,
                "message": prospect.last_message_sent,
                "created_at": prospect.last_message_sent_at or prospect.updated_at,
            }
        )
    if prospect.last_reply_text:
        items.append(
            {
                "id": "prospect-last-reply",
                "source": "prospect_snapshot",
                "actor": "prospect",
                "action": "LAST_REPLY",
                "channel": prospect.last_engagement_channel or "",
                "status": prospect.reply_sentiment or prospect.conversation_status or "",
                "text": prospect.last_reply_text,
                "prospect_response": prospect.last_reply_text,
                "summary": prospect.reply_summary or "",
                "created_at": prospect.last_reply_at or prospect.last_reply_checked_at or prospect.updated_at,
            }
        )

    seen = set()
    unique_items = []
    for item in sorted(items, key=lambda value: value.get("created_at") or timezone.now()):
        signature = (
            item.get("actor"),
            item.get("action"),
            item.get("channel"),
            item.get("text"),
            item.get("created_at"),
        )
        if signature in seen:
            continue
        seen.add(signature)
        unique_items.append(item)
    return unique_items


def create_log(
    prospect,
    user,
    action,
    status_value,
    channel=None,
    message=None,
    error=None,
    sent_at=None,
    sender_snapshot=None,
):
    sender_snapshot = sender_snapshot or {}
    log = EngagementLog.objects.create(
        prospect=prospect,
        user=user,
        company=user.company,
        action=action,
        channel=channel,
        message=message,
        status=status_value,
        error=error,
        sender_name=sender_snapshot.get("sender_name") or "",
        sender_email=sender_snapshot.get("sender_email") or "",
        provider=sender_snapshot.get("provider") or "",
        provider_message_id=sender_snapshot.get("provider_message_id") or "",
        error_code=sender_snapshot.get("error_code") or "",
        error_message=sender_snapshot.get("error_message") or "",
        sent_at=sent_at,
    )
    try:
        from Notifications.crm_event_service import record_crm_event
        from sales.prospect_tracking_service import record_agent_run, safe_track_activity

        agent_run = None
        if action in {"agent_launched", "message_generated", "message_sent", "replied"}:
            agent_run = record_agent_run(
                prospect=prospect,
                agent_type="engagement",
                status="completed" if action != "send_error" else "failed",
                started_at=log.created_at,
                finished_at=log.created_at,
                input_summary=f"Action engagement: {action}",
                output_summary=(message or "")[:1000],
                error_message=error or "",
                metadata={"engagement_log_id": log.id, "channel": channel, "status": status_value},
            )
        event_map = {
            "agent_launched": ("agent_started", "agent", "info", "Engagement Agent lancé"),
            "message_generated": ("message_generated", "engagement", "info", "Message généré"),
            "message_sent": ("message_sent", "engagement", "success", "Message envoyé"),
            "replied": ("reply_received", "engagement", "success", "Réponse reçue"),
            "send_error": ("agent_failed", "agent", "critical", "Engagement Agent en erreur"),
        }
        if action in event_map:
            event_type, category, severity, title = event_map[action]
            record_crm_event(
                event_type=event_type,
                category=category,
                title=title,
                description=error or message or "",
                severity=severity,
                source_type="engagement_log",
                source_name="Engagement Agent",
                source_id=log.id,
                user=user,
                prospect=prospect,
                agent_run=agent_run,
                related_object_type="engagement_log",
                related_object_id=log.id,
                status=status_value,
                channel=channel or "",
                metadata={"action": action, "engagement_log_id": log.id, "channel": channel},
            )
        if action == "message_sent":
            safe_track_activity(
                prospect=prospect,
                activity_type="message_sent",
                title="Message envoyé",
                description=message or "",
                channel=channel,
                source="agent",
                created_by=user,
                agent_run=agent_run,
                metadata={"engagement_log_id": log.id},
                created_at=sent_at or log.created_at,
            )
        elif action == "replied":
            safe_track_activity(
                prospect=prospect,
                activity_type="reply_received",
                title="Réponse reçue",
                description=getattr(prospect, "last_reply_text", "") or message or "",
                channel=channel,
                source="manual",
                created_by=user,
                agent_run=agent_run,
                metadata={"engagement_log_id": log.id},
                created_at=log.created_at,
            )
    except Exception:
        logger.exception("Prospect 360 tracking failed for engagement log=%s", getattr(log, "id", None))
    return log


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
                "email_connection": serialize_email_connection(get_active_email_connection(request.user)),
            }
        )


class EmailConnectionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        connections = UserEmailConnection.objects.filter(user=request.user).order_by("-is_active", "-updated_at")
        return Response(
            {
                "active": serialize_email_connection(get_active_email_connection(request.user)),
                "results": [serialize_email_connection(connection) for connection in connections],
                "sender_context": get_sender_context(request.user),
            }
        )


class EmailConnectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, provider):
        provider = normalize_email_provider_name(provider)
        if provider not in EMAIL_PROVIDERS:
            return Response({"success": False, "code": "EMAIL_PROVIDER_UNSUPPORTED"}, status=400)
        if not provider_is_configured(provider):
            missing = []
            if provider == UserEmailConnection.PROVIDER_GMAIL:
                if not settings.GOOGLE_CLIENT_ID:
                    missing.append("GOOGLE_CLIENT_ID")
                if not settings.GOOGLE_CLIENT_SECRET:
                    missing.append("GOOGLE_CLIENT_SECRET")
                if not settings.GOOGLE_REDIRECT_URI:
                    missing.append("GOOGLE_REDIRECT_URI")
            return Response(
                {
                    "success": False,
                    "code": "EMAIL_OAUTH_CONFIG_MISSING",
                    "message": "Configuration OAuth manquante pour ce fournisseur.",
                    "missing": missing,
                },
                status=400,
            )
        state = signing.dumps({"user_id": request.user.id, "provider": provider}, salt="agent-engagement-email")
        authorization_url = get_email_provider(provider).build_authorization_url(state)
        return Response({"success": True, "provider": provider, "authorization_url": authorization_url})


class EmailOAuthCallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, provider):
        provider = normalize_email_provider_name(provider)
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state or provider not in EMAIL_PROVIDERS:
            return HttpResponse("Connexion email invalide.", status=400)

        try:
            payload = signing.loads(state, salt="agent-engagement-email", max_age=600)
        except signing.BadSignature:
            return HttpResponse("State OAuth invalide ou expire.", status=400)

        if payload.get("provider") != provider:
            return HttpResponse("Provider OAuth incoherent.", status=400)

        user = User.objects.filter(pk=payload.get("user_id")).first()
        if not user:
            return HttpResponse("Utilisateur introuvable.", status=404)

        try:
            email_provider = get_email_provider(provider)
            token_data = email_provider.exchange_code(code)
            profile = email_provider.get_profile(token_data.get("access_token"))
        except Exception as exc:
            logger.exception("[engagement] OAuth email callback failed")
            return HttpResponse(f"Connexion email impossible: {str(exc)[:200]}", status=400)

        expires_in = int(token_data.get("expires_in") or 3600)
        email = profile.get("email")
        if not email:
            return HttpResponse("Adresse email introuvable chez le fournisseur.", status=400)

        UserEmailConnection.objects.filter(user=user).update(is_active=False)
        connection, _ = UserEmailConnection.objects.update_or_create(
            user=user,
            provider=provider,
            email=email,
            defaults={
                "display_name": profile.get("display_name") or "",
                "access_token": token_data.get("access_token") or "",
                "refresh_token": token_data.get("refresh_token") or "",
                "token_expires_at": timezone.now() + timedelta(seconds=expires_in),
                "is_active": True,
                "last_verified_at": timezone.now(),
            },
        )
        connection.set_access_token(token_data.get("access_token"))
        if token_data.get("refresh_token"):
            connection.set_refresh_token(token_data.get("refresh_token"))
        connection.save(update_fields=["access_token", "refresh_token", "updated_at"])

        return HttpResponse(
            "<html><body><h3>Connexion email active.</h3><p>Vous pouvez fermer cette fenetre et revenir a l'agent d'engagement.</p></body></html>"
        )


class EmailDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        provider = (request.data.get("provider") or "").lower()
        qs = UserEmailConnection.objects.filter(user=request.user)
        if provider:
            qs = qs.filter(provider=provider)
        updated = qs.update(is_active=False)
        return Response({"success": True, "disconnected": updated})


class EmailConnectionTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        connection = get_active_email_connection(request.user)
        if not connection:
            return Response({"success": False, "code": "EMAIL_LOGIN_REQUIRED"}, status=400)
        try:
            provider = get_email_provider(connection.provider)
            if not provider.ensure_valid_token(connection):
                return Response({"success": False, "code": "EMAIL_REFRESH_FAILED"}, status=400)
            profile = provider.get_profile(connection.get_access_token())
        except Exception as exc:
            connection.is_active = False
            connection.save(update_fields=["is_active", "updated_at"])
            return Response({"success": False, "code": "EMAIL_CONNECTION_EXPIRED", "message": str(exc)[:300]}, status=400)
        connection.email = profile.get("email") or connection.email
        connection.display_name = profile.get("display_name") or connection.display_name
        connection.last_verified_at = timezone.now()
        connection.is_active = True
        connection.save(update_fields=["email", "display_name", "last_verified_at", "is_active", "updated_at"])
        return Response({"success": True, "connection": serialize_email_connection(connection)})


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


class ProspectInitialEngagementPlanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        try:
            result = EngagementInitialFlowService().run(prospect=prospect, user=request.user)
        except EngagementPlanningUnavailable as exc:
            return Response({"success": False, "error": str(exc)}, status=503)
        except EngagementContentGenerationUnavailable as exc:
            return Response({"success": False, "error": str(exc)}, status=503)

        plan = result["plan"]
        policy = result["policy"]
        content = result["content"]
        memory = getattr(prospect, "engagement_memory", None)
        plan_payload = plan.model_dump() if hasattr(plan, "model_dump") else plan.dict()
        policy_payload = policy.model_dump() if hasattr(policy, "model_dump") else policy.dict()
        content_payload = (
            content.model_dump() if content and hasattr(content, "model_dump") else content.dict() if content else None
        )
        generated_log = persist_generated_content(prospect, request.user, content_payload)

        return Response(
            {
                "success": policy.allowed,
                "prospect_id": prospect.id,
                "available_channels": result["available_channels"],
                "plan": plan_payload,
                "policy": policy_payload,
                "content": content_payload,
                "generated_log_id": getattr(generated_log, "id", None),
                "engagement_memory": serialize_memory(memory) if memory else None,
                "agent_trace": result.get("agent_trace", []),
            }
        )


class ProspectLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        logs = list(
            prospect.engagement_logs.filter(company=request.user.company)
            .select_related("user")
            .order_by("-created_at")[:100]
        )
        results = [
            {
                "id": log.id,
                "action": log.action,
                "channel": log.channel,
                "message": log.message,
                "status": log.status,
                "error": log.error,
                "sender_name": log.sender_name,
                "sender_email": log.sender_email,
                "provider": log.provider,
                "provider_message_id": log.provider_message_id,
                "error_code": log.error_code,
                "error_message": log.error_message,
                "sent_at": log.sent_at,
                "created_at": log.created_at,
            }
            for log in logs
        ]
        return Response(
            {
                "results": results,
                "conversation": build_prospect_conversation(prospect, logs),
                "prospect": serialize_prospect(prospect, request),
            }
        )


class EngagementInteractionOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "success": True,
                "channels": list(INTERACTION_CHANNELS),
                "action_types": list(INTERACTION_ACTION_TYPES),
                "outcomes": list(INTERACTION_OUTCOMES),
            }
        )


class ProspectInteractionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        return Response(
            {
                "success": True,
                "prospect_id": prospect.id,
                "interactions": list_interactions(prospect),
            }
        )

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        serializer = EngagementInteractionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activity, created = record_interaction(prospect, request.user, serializer.validated_data)

        return Response(
            {
                "success": True,
                "created": created,
                "interaction": serialize_interaction(activity),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ProspectInteractionAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id, interaction_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        activity = ProspectActivity.objects.filter(
            pk=interaction_id,
            prospect=prospect,
            metadata__kind="engagement_interaction",
        ).first()

        if not activity:
            return Response(
                {"success": False, "error": "Interaction introuvable."},
                status=404,
            )

        context = ProspectEngagementContextBuilder().build(prospect)
        interaction = serialize_interaction(activity)

        # Réutiliser l'analyse si elle a déjà été persistée.
        metadata = dict(activity.metadata or {})
        cached_analysis = metadata.get("engagement_analysis")

        if cached_analysis:
            analysis_payload = cached_analysis
            memory = getattr(prospect, "engagement_memory", None)

            logger.info(
                "[ENGAGEMENT][ANALYZE] cache hit prospect=%s interaction=%s",
                prospect.id,
                activity.id,
            )

            return Response(
                {
                    "success": True,
                    "cached": True,
                    "prospect_id": prospect.id,
                    "interaction_id": activity.id,
                    "analysis": analysis_payload,
                    "engagement_memory": serialize_memory(memory) if memory else None,
                }
            )

        try:
            analysis = ProspectResponseAnalyzer().analyze(
                context=context,
                interaction=interaction,
            )
        except ProspectResponseAnalysisUnavailable as exc:
            return Response(
                {
                    "success": False,
                    "error": str(exc),
                    "manual_review_required": True,
                },
                status=503,
            )

        if hasattr(analysis, "model_dump"):
            analysis_payload = analysis.model_dump()
        else:
            analysis_payload = analysis.dict()

        # Mettre à jour la mémoire AVANT de marquer le résultat comme persistant.
        memory = EngagementMemoryManager().update_from_analysis(
            prospect=prospect,
            interaction=interaction,
            analysis=analysis,
        )

        # Persister l'analyse directement dans l'interaction.
        # Cela évite de rappeler Gemini lors de /continue/.
        metadata["engagement_analysis"] = analysis_payload
        metadata["engagement_analysis_memory_updated"] = True
        activity.metadata = metadata
        activity.save(update_fields=["metadata"])

        return Response(
            {
                "success": True,
                "cached": False,
                "prospect_id": prospect.id,
                "interaction_id": activity.id,
                "analysis": analysis_payload,
                "engagement_memory": serialize_memory(memory),
            }
        )

class ProspectInteractionReplanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id, interaction_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        activity = ProspectActivity.objects.filter(
            pk=interaction_id,
            prospect=prospect,
            metadata__kind="engagement_interaction",
        ).first()

        if not activity:
            return Response(
                {"success": False, "error": "Interaction introuvable."},
                status=404,
            )

        interaction = serialize_interaction(activity)
        metadata = dict(activity.metadata or {})

        # Le replan passe maintenant par le même cerveau agentique que /continue/.
        # On réutilise l'analyse persistée afin d'éviter un nouvel appel Gemini.
        existing_analysis = metadata.get("engagement_analysis")
        memory_already_updated = bool(
            metadata.get("engagement_analysis_memory_updated")
        )

        try:
            result = EngagementReplanningService().replan(
                prospect=prospect,
                user=request.user,
                interaction=interaction,
                existing_analysis=existing_analysis,
                memory_already_updated=memory_already_updated,
            )
        except EngagementPlanningUnavailable as exc:
            return Response(
                {"success": False, "error": str(exc)},
                status=503,
            )

        # Si le runtime a dû analyser l'interaction lui-même,
        # on persiste cette analyse pour les futurs appels.
        analysis = result.get("analysis")

        if analysis is not None and not existing_analysis:
            if hasattr(analysis, "model_dump"):
                analysis_payload = analysis.model_dump()
            else:
                analysis_payload = analysis.dict()

            metadata["engagement_analysis"] = analysis_payload
            metadata["engagement_analysis_memory_updated"] = bool(
                result.get("engagement_memory")
            )
            activity.metadata = metadata
            activity.save(update_fields=["metadata"])
        elif existing_analysis:
            analysis_payload = existing_analysis
        else:
            analysis_payload = None

        plan = result.get("plan")
        policy = result.get("policy")

        if plan is None:
            plan_payload = None
        elif hasattr(plan, "model_dump"):
            plan_payload = plan.model_dump()
        else:
            plan_payload = plan.dict()

        if policy is None:
            policy_payload = None
        elif hasattr(policy, "model_dump"):
            policy_payload = policy.model_dump()
        else:
            policy_payload = policy.dict()

        manual_review_required = bool(
            result.get("manual_review_required")
        )

        return Response(
            {
                "success": True,
                "engagement_allowed": bool(
                    policy and policy.allowed
                ) if not manual_review_required else False,
                "manual_review_required": manual_review_required,
                "manual_review_reason": result.get(
                    "manual_review_reason"
                ),
                "prospect_id": prospect.id,
                "interaction_id": activity.id,
                "analysis": analysis_payload,
                "engagement_memory": result.get("engagement_memory"),
                "available_channels": result.get(
                    "available_channels",
                    {},
                ),
                "plan": plan_payload,
                "policy": policy_payload,
                # REPLAN est volontairement lecture/recommandation :
                # aucun contenu n'est généré ici.
                "content": None,
                "agent_trace": result.get("agent_trace", []),
            },
            status=200,
        )


class ProspectInteractionContinueView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id, interaction_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_prospect_response(request, prospect_id)

        activity = ProspectActivity.objects.filter(
            pk=interaction_id,
            prospect=prospect,
            metadata__kind="engagement_interaction",
        ).first()

        if not activity:
            return Response(
                {"success": False, "error": "Interaction introuvable."},
                status=404,
            )

        interaction = serialize_interaction(activity)
        metadata = dict(activity.metadata or {})

        # Analyse éventuellement déjà faite par /analyze/.
        existing_analysis = metadata.get("engagement_analysis")
        memory_already_updated = bool(
            metadata.get("engagement_analysis_memory_updated")
        )

        try:
            result = EngagementContinuationService().continue_after_interaction(
                prospect=prospect,
                interaction=interaction,
                user=request.user,
                existing_analysis=existing_analysis,
                memory_already_updated=memory_already_updated,
            )
        except EngagementPlanningUnavailable as exc:
            return Response(
                {
                    "success": False,
                    "error": str(exc),
                },
                status=503,
            )
        except EngagementContentGenerationUnavailable as exc:
            return Response(
                {
                    "success": False,
                    "error": str(exc),
                },
                status=503,
            )

        # Si l'analyse a été produite pendant /continue/, la persister pour les appels futurs.
        analysis = result.get("analysis")
        if analysis is not None and not existing_analysis:
            if hasattr(analysis, "model_dump"):
                analysis_payload = analysis.model_dump()
            else:
                analysis_payload = analysis.dict()

            metadata["engagement_analysis"] = analysis_payload
            metadata["engagement_analysis_memory_updated"] = True
            activity.metadata = metadata
            activity.save(update_fields=["metadata"])
        elif existing_analysis:
            analysis_payload = existing_analysis
        else:
            analysis_payload = None

        plan = result.get("plan")
        policy = result.get("policy")
        content = result.get("content")

        if plan is None:
            plan_payload = None
        elif hasattr(plan, "model_dump"):
            plan_payload = plan.model_dump()
        else:
            plan_payload = plan.dict()

        if policy is None:
            policy_payload = None
        elif hasattr(policy, "model_dump"):
            policy_payload = policy.model_dump()
        else:
            policy_payload = policy.dict()

        if content is None:
            content_payload = None
        elif hasattr(content, "model_dump"):
            content_payload = content.model_dump()
        else:
            content_payload = content.dict()

        manual_review_required = bool(
            result.get("manual_review_required")
        )

        # Une revue humaine n'est pas une erreur serveur.
        # Le workflow agentique s'est terminé proprement.
        if manual_review_required:
            return Response(
                {
                    "success": True,
                    "engagement_allowed": False,
                    "manual_review_required": True,
                    "manual_review_reason": result.get("manual_review_reason"),
                    "prospect_id": prospect.id,
                    "interaction_id": activity.id,
                    "analysis": analysis_payload,
                    "engagement_memory": result.get("engagement_memory"),
                    "available_channels": result.get("available_channels", {}),
                    "plan": plan_payload,
                    "policy": policy_payload,
                    "content": None,
                    "agent_trace": result.get("agent_trace", []),
                },
                status=200,
            )

        engagement_allowed = bool(policy and policy.allowed)
        generated_log = persist_generated_content(prospect, request.user, content_payload)

        return Response(
            {
                "success": True,
                "engagement_allowed": engagement_allowed,
                "manual_review_required": False,
                "prospect_id": prospect.id,
                "interaction_id": activity.id,
                "analysis": analysis_payload,
                "engagement_memory": result.get("engagement_memory"),
                "available_channels": result.get("available_channels", {}),
                "plan": plan_payload,
                "policy": policy_payload,
                "content": content_payload,
                "generated_log_id": getattr(generated_log, "id", None),
                "agent_trace": result.get("agent_trace", []),
            },
            status=200,
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
