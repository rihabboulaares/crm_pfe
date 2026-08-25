import logging

from django.utils import timezone

from .models import CRMEvent

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {
    "authorization",
    "access_token",
    "refresh_token",
    "token",
    "api_key",
    "apikey",
    "password",
    "secret",
    "cookie",
    "cookies",
    "session",
    "headers",
}

ACTIVITY_EVENT_MAP = {
    "call_done": ("call_completed", "commercial", "success"),
    "email_sent": ("message_sent", "engagement", "success"),
    "message_sent": ("message_sent", "engagement", "success"),
    "reply_received": ("reply_received", "engagement", "success"),
    "interested": ("prospect_interested", "prospect", "success"),
    "note": ("commercial_activity_created", "commercial", "info"),
    "meeting_scheduled": ("commercial_activity_created", "commercial", "success"),
    "meeting_done": ("commercial_activity_created", "commercial", "success"),
    "not_interested": ("commercial_activity_created", "commercial", "warning"),
    "no_response": ("commercial_activity_created", "commercial", "warning"),
}

AGENT_STATUS_EVENT_MAP = {
    "queued": ("agent_started", "agent", "info"),
    "running": ("agent_started", "agent", "info"),
    "completed": ("agent_completed", "agent", "success"),
    "failed": ("agent_failed", "agent", "critical"),
    "cancelled": ("agent_failed", "agent", "warning"),
}


def sanitize_metadata(value):
    if value is None:
        return {}
    if isinstance(value, dict):
        clean = {}
        for key, item in value.items():
            key_text = str(key).lower()
            if any(secret in key_text for secret in SENSITIVE_KEYS):
                clean[key] = "[filtered]"
            else:
                clean[key] = sanitize_metadata(item) if isinstance(item, (dict, list)) else item
        return clean
    if isinstance(value, list):
        return [sanitize_metadata(item) if isinstance(item, (dict, list)) else item for item in value[:50]]
    return value


def _resolve_company(company=None, prospect=None, user=None):
    if company:
        return company
    if prospect and getattr(prospect, "company", None):
        return prospect.company
    if user and getattr(user, "company", None):
        return user.company
    return None


def record_crm_event(
    *,
    event_type,
    category,
    title,
    description="",
    severity="info",
    source_type="system",
    source_name="",
    source_id=None,
    user=None,
    prospect=None,
    company=None,
    agent_run=None,
    related_object_type="",
    related_object_id=None,
    status="",
    channel="",
    metadata=None,
    created_at=None,
    fail_silently=True,
):
    try:
        valid_event_types = {choice[0] for choice in CRMEvent.EVENT_TYPE_CHOICES}
        valid_categories = {choice[0] for choice in CRMEvent.CATEGORY_CHOICES}
        valid_severities = {choice[0] for choice in CRMEvent.SEVERITY_CHOICES}

        if event_type not in valid_event_types:
            raise ValueError(f"Invalid CRM event_type: {event_type}")
        if category not in valid_categories:
            raise ValueError(f"Invalid CRM event category: {category}")
        if severity not in valid_severities:
            severity = "info"

        source_id_text = str(source_id or "")
        defaults = {
            "category": category,
            "title": title[:255],
            "description": description or "",
            "severity": severity,
            "source_name": source_name or source_type,
            "user": user,
            "prospect": prospect,
            "company": _resolve_company(company, prospect, user),
            "agent_run": agent_run,
            "related_object_type": related_object_type or "",
            "related_object_id": str(related_object_id or ""),
            "status": status or "",
            "channel": channel or "",
            "metadata": sanitize_metadata(metadata or {}),
        }

        if source_id_text:
            if created_at:
                defaults["created_at"] = created_at
            event, _ = CRMEvent.objects.get_or_create(
                event_type=event_type,
                source_type=source_type,
                source_id=source_id_text,
                defaults=defaults,
            )
            return event

        return CRMEvent.objects.create(
            event_type=event_type,
            source_type=source_type,
            source_id="",
            created_at=created_at or timezone.now(),
            **defaults,
        )
    except Exception:
        logger.exception("Unable to record CRM event %s from %s:%s", event_type, source_type, source_id)
        if fail_silently:
            return None
        raise


def event_from_prospect_activity(activity):
    event_type, category, severity = ACTIVITY_EVENT_MAP.get(
        activity.activity_type, ("commercial_activity_created", "commercial", "info")
    )
    return record_crm_event(
        event_type=event_type,
        category=category,
        title=activity.title or activity.get_activity_type_display(),
        description=activity.description or "",
        severity=severity,
        source_type="prospect_activity",
        source_name=activity.source or "manual",
        source_id=activity.id,
        user=activity.created_by,
        prospect=activity.prospect,
        agent_run=activity.agent_run,
        related_object_type="prospect_activity",
        related_object_id=activity.id,
        channel=activity.channel or "",
        metadata={
            "activity_type": activity.activity_type,
            "channel": activity.channel,
            "source": activity.source,
            "activity_id": activity.id,
            **sanitize_metadata(activity.metadata or {}),
        },
        created_at=activity.created_at,
    )


def event_from_score_history(score_history):
    variation = score_history.new_score - score_history.previous_score
    return record_crm_event(
        event_type="score_changed",
        category="scoring",
        title="Score recalculé",
        description=score_history.reason or "",
        severity="success" if variation > 0 else "warning" if variation < 0 else "info",
        source_type="score_history",
        source_name="scoring",
        source_id=score_history.id,
        user=getattr(getattr(score_history, "activity", None), "created_by", None),
        prospect=score_history.prospect,
        agent_run=score_history.agent_run,
        related_object_type="score_history",
        related_object_id=score_history.id,
        metadata={
            "previous_score": score_history.previous_score,
            "new_score": score_history.new_score,
            "variation": variation,
            "reason": score_history.reason,
            "activity_id": getattr(score_history.activity, "id", None),
            "agent_run_id": getattr(score_history.agent_run, "id", None),
        },
        created_at=score_history.created_at,
    )


def event_from_document(document):
    return record_crm_event(
        event_type="document_uploaded",
        category="document",
        title=f"Document ajouté : {document.name}",
        description=document.description or "",
        severity="info",
        source_type="prospect_document",
        source_name=document.source or "manual",
        source_id=document.id,
        user=document.uploaded_by,
        prospect=document.prospect,
        agent_run=document.agent_run,
        related_object_type="prospect_document",
        related_object_id=document.id,
        metadata={
            "document_id": document.id,
            "document_type": document.document_type,
            "name": document.name,
            "source": document.source,
        },
        created_at=document.created_at,
    )


def event_from_agent_run(agent_run):
    event_type, category, severity = AGENT_STATUS_EVENT_MAP.get(
        agent_run.status, ("agent_completed", "agent", "info")
    )
    return record_crm_event(
        event_type=event_type,
        category=category,
        title=f"{agent_run.get_agent_type_display()} - {agent_run.get_status_display()}",
        description=agent_run.output_summary or agent_run.error_message or "",
        severity=severity,
        source_type="prospect_agent_run",
        source_name=agent_run.agent_type,
        source_id=agent_run.id,
        prospect=agent_run.prospect,
        agent_run=agent_run,
        related_object_type="prospect_agent_run",
        related_object_id=agent_run.id,
        status=agent_run.status,
        metadata={
            "agent_type": agent_run.agent_type,
            "status": agent_run.status,
            "started_at": agent_run.started_at.isoformat() if agent_run.started_at else None,
            "finished_at": agent_run.finished_at.isoformat() if agent_run.finished_at else None,
        },
        created_at=agent_run.started_at,
    )
