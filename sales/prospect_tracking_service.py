import logging

from django.utils import timezone

from Notifications.crm_event_service import (
    event_from_agent_run,
    event_from_prospect_activity,
    record_crm_event,
)
from .models import ProspectActivity, ProspectAgentRun, ProspectRecommendation
from .prospect_scoring_service import recalculate_after_activity

logger = logging.getLogger(__name__)


def record_prospect_activity(
    prospect,
    activity_type,
    title,
    description="",
    channel=None,
    source="system",
    created_by=None,
    agent_run=None,
    metadata=None,
    created_at=None,
    recalculate_score=True,
):
    activity = ProspectActivity.objects.create(
        prospect=prospect,
        activity_type=activity_type,
        channel=channel or None,
        title=title,
        description=description or "",
        source=source,
        created_by=created_by,
        agent_run=agent_run,
        metadata=metadata or {},
        created_at=created_at or timezone.now(),
    )
    if recalculate_score:
        recalculate_after_activity(activity)
    event_from_prospect_activity(activity)
    return activity


def record_agent_run(
    prospect,
    agent_type,
    status="completed",
    started_at=None,
    finished_at=None,
    input_summary="",
    output_summary="",
    error_message="",
    metadata=None,
    audit_run=None,
):
    run = ProspectAgentRun.objects.create(
        prospect=prospect,
        agent_type=agent_type,
        status=status,
        started_at=started_at or timezone.now(),
        finished_at=finished_at,
        input_summary=input_summary or "",
        output_summary=output_summary or "",
        error_message=error_message or "",
        metadata=metadata or {},
        audit_run=audit_run,
    )
    event_from_agent_run(run)
    return run


def ensure_default_recommendation(prospect):
    if ProspectRecommendation.objects.filter(prospect=prospect, status="pending").exists():
        return None
    score = getattr(getattr(prospect, "prospect_company", None), "score_ia", 0) or 0
    if prospect.last_reply_text:
        title = "Envoyer une présentation commerciale"
        reason = "Le prospect a répondu et une action de suivi est recommandée."
        priority = "high"
        recommendation_type = "send_presentation"
    elif score >= 70:
        title = "Lancer Engagement Agent"
        reason = "Score élevé et potentiel commercial détecté."
        priority = "high"
        recommendation_type = "follow_up"
    else:
        title = "Compléter les informations du prospect"
        reason = "Le dossier manque encore de signaux pour prioriser l'engagement."
        priority = "medium"
        recommendation_type = "qualify"
    recommendation = ProspectRecommendation.objects.create(
        prospect=prospect,
        recommendation_type=recommendation_type,
        title=title,
        reason=reason,
        priority=priority,
        generated_by="system",
    )
    record_crm_event(
        event_type="recommendation_created",
        category="prospect",
        title=recommendation.title,
        description=recommendation.reason or recommendation.description or "",
        severity="info" if recommendation.priority != "high" else "warning",
        source_type="system",
        source_name="recommendation",
        source_id=f"recommendation-{recommendation.id}",
        prospect=prospect,
        related_object_type="prospect_recommendation",
        related_object_id=recommendation.id,
        metadata={
            "recommendation_type": recommendation.recommendation_type,
            "priority": recommendation.priority,
            "status": recommendation.status,
        },
    )
    return recommendation


def safe_track_activity(*args, **kwargs):
    try:
        return record_prospect_activity(*args, **kwargs)
    except Exception:
        logger.exception("Non-blocking prospect activity tracking failed")
        return None
