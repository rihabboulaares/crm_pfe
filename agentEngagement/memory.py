import logging
from django.utils import timezone

logger = logging.getLogger("agentEngagement.memory")


BLOCKING_STATUSES = {
    "message_ready",
    "pending_validation",
    "message_sent",
    "sending",
    "replied",
    "follow_up_required",
    "closed",
    "rejected",
    "not_qualified",
    "task_created",
    "contacted",
    "waiting_reply",
}


def is_already_processed(prospect) -> bool:
    return prospect.engagement_status in BLOCKING_STATUSES


def set_status(prospect, status: str, error: str = None, channel: str = None):
    fields = ["engagement_status"]

    prospect.engagement_status = status

    if hasattr(prospect, "engagement_error"):
        prospect.engagement_error = error
        fields.append("engagement_error")

    if channel is not None:
        prospect.last_engagement_channel = channel
        fields.append("last_engagement_channel")

    prospect.last_engagement_at = timezone.now()
    fields.append("last_engagement_at")

    prospect.save(update_fields=list(set(fields)))

    logger.info("[memory] Prospect #%s status=%s", prospect.pk, status)


def save_prepared_message(prospect, result):
    prospect.generated_message = result.message or result.call_script or ""
    prospect.last_engagement_channel = result.best_channel
    prospect.engagement_status = "pending_validation"
    prospect.last_engagement_at = timezone.now()

    fields = [
        "generated_message",
        "last_engagement_channel",
        "engagement_status",
        "last_engagement_at",
    ]

    if hasattr(prospect, "engagement_subject"):
        prospect.engagement_subject = result.subject or ""
        fields.append("engagement_subject")

    if hasattr(prospect, "engagement_error"):
        prospect.engagement_error = None
        fields.append("engagement_error")

    prospect.save(update_fields=fields)


def mark_contacted(prospect, channel: str):
    prospect.engagement_status = "message_sent"
    prospect.last_engagement_channel = channel
    prospect.last_engagement_at = timezone.now()

    fields = [
        "engagement_status",
        "last_engagement_channel",
        "last_engagement_at",
    ]

    if hasattr(prospect, "engagement_error"):
        prospect.engagement_error = None
        fields.append("engagement_error")

    prospect.save(update_fields=fields)
