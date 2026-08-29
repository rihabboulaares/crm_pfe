from datetime import timedelta

from django.utils import timezone

from Notifications.models import HistoryLog
from sales.models import ProspectActivity


INTERACTION_CHANNELS = ("EMAIL", "PHONE", "LINKEDIN", "FACEBOOK", "INSTAGRAM", "OTHER")
INTERACTION_ACTION_TYPES = ("EMAIL_SENT", "PHONE_CALL", "SOCIAL_MESSAGE_SENT", "FOLLOW_UP", "OTHER")
INTERACTION_OUTCOMES = (
    "SENT",
    "NO_RESPONSE",
    "INTERESTED",
    "NOT_INTERESTED",
    "CALL_LATER",
    "OBJECTION",
    "REQUEST_INFORMATION",
    "MEETING_REQUEST",
    "WRONG_CONTACT",
    "UNSUBSCRIBE",
    "OTHER",
)


CHANNEL_TO_ACTIVITY_CHANNEL = {
    "EMAIL": "email",
    "PHONE": "phone",
    "LINKEDIN": "linkedin",
    "FACEBOOK": "facebook",
    "INSTAGRAM": "instagram",
    "OTHER": "other",
}

ACTION_TO_ACTIVITY_TYPE = {
    "EMAIL_SENT": "email_sent",
    "PHONE_CALL": "call_done",
    "SOCIAL_MESSAGE_SENT": "message_sent",
    "FOLLOW_UP": "follow_up",
    "OTHER": "other",
}


def normalize_interaction_value(value):
    return str(value or "").strip().upper()


def serialize_interaction(activity):
    metadata = activity.metadata or {}
    return {
        "id": activity.id,
        "prospect_id": activity.prospect_id,
        "user_id": activity.created_by_id,
        "channel": metadata.get("channel"),
        "action_type": metadata.get("action_type"),
        "outcome": metadata.get("outcome"),
        "prospect_response": metadata.get("prospect_response") or "",
        "commercial_notes": metadata.get("commercial_notes") or "",
        "generated_content_reference": metadata.get("generated_content_reference") or "",
        "strategy_reference": metadata.get("strategy_reference") or "",
        "status": metadata.get("status") or "recorded",
        "performed_at": metadata.get("performed_at") or activity.created_at.isoformat(),
        "created_at": activity.created_at.isoformat(),
    }


def list_interactions(prospect):
    return [
        serialize_interaction(activity)
        for activity in prospect.prospect_activities.filter(
            source="manual",
            metadata__kind="engagement_interaction",
        ).order_by("created_at")
    ]


def record_interaction(prospect, user, validated_data):
    channel = validated_data["channel"]
    action_type = validated_data["action_type"]
    outcome = validated_data["outcome"]
    prospect_response = validated_data.get("prospect_response") or ""
    commercial_notes = validated_data.get("commercial_notes") or ""
    generated_content_reference = validated_data.get("generated_content_reference") or ""
    strategy_reference = validated_data.get("strategy_reference") or ""
    idempotency_key = validated_data.get("idempotency_key") or ""
    performed_at = validated_data.get("performed_at") or timezone.now()

    if idempotency_key:
        existing = ProspectActivity.objects.filter(
            prospect=prospect,
            source="manual",
            metadata__kind="engagement_interaction",
            metadata__idempotency_key=idempotency_key,
        ).first()
        if existing:
            return existing, False

    duplicate_window_start = timezone.now() - timedelta(seconds=10)
    existing = ProspectActivity.objects.filter(
        prospect=prospect,
        created_by=user,
        source="manual",
        activity_type=ACTION_TO_ACTIVITY_TYPE[action_type],
        channel=CHANNEL_TO_ACTIVITY_CHANNEL[channel],
        created_at__gte=duplicate_window_start,
        metadata__kind="engagement_interaction",
        metadata__channel=channel,
        metadata__action_type=action_type,
        metadata__outcome=outcome,
        metadata__prospect_response=prospect_response,
        metadata__commercial_notes=commercial_notes,
    ).first()
    if existing:
        return existing, False

    title = f"{action_type.replace('_', ' ').title()} - {outcome.replace('_', ' ').title()}"
    description_parts = [f"Outcome: {outcome}"]
    if prospect_response:
        description_parts.append(f"Prospect response: {prospect_response}")
    if commercial_notes:
        description_parts.append(f"Commercial notes: {commercial_notes}")

    activity = ProspectActivity.objects.create(
        prospect=prospect,
        activity_type=ACTION_TO_ACTIVITY_TYPE[action_type],
        channel=CHANNEL_TO_ACTIVITY_CHANNEL[channel],
        title=title,
        description="\n".join(description_parts),
        source="manual",
        created_by=user,
        metadata={
            "kind": "engagement_interaction",
            "channel": channel,
            "action_type": action_type,
            "outcome": outcome,
            "prospect_response": prospect_response,
            "commercial_notes": commercial_notes,
            "generated_content_reference": generated_content_reference,
            "strategy_reference": strategy_reference,
            "status": "recorded",
            "performed_at": performed_at.isoformat(),
            "idempotency_key": idempotency_key,
        },
        created_at=performed_at,
    )

    log = HistoryLog.objects.create(
        actor=user,
        actor_type="user",
        actor_name=getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "") or getattr(user, "email", ""),
        performed_by=user,
        action="comment",
        entity_type="prospect",
        entity_id=prospect.id,
        entity_name=str(prospect),
        description=f"Interaction commerciale enregistree: {channel} / {action_type} / {outcome}",
        new_value={
            "activity_id": activity.id,
            "channel": channel,
            "action_type": action_type,
            "outcome": outcome,
            "prospect_response": prospect_response,
            "commercial_notes": commercial_notes,
        },
        company=getattr(prospect, "company", None),
    )
    if user:
        log.affected_users.add(user)
    if getattr(prospect, "assigned_to_id", None):
        log.affected_users.add(prospect.assigned_to)

    return activity, True
