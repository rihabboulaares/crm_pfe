import logging

from agentProspection.services.scoring_service import calculate_score
from Notifications.crm_event_service import event_from_score_history

from .models import ProspectScoreHistory

logger = logging.getLogger(__name__)


ACTIVITY_SCORE_DELTAS = {
    "reply_received": 12,
    "interested": 18,
    "info_requested": 10,
    "meeting_scheduled": 14,
    "meeting_done": 16,
    "message_sent": 4,
    "email_sent": 3,
    "follow_up": 2,
    "no_response": -6,
    "not_interested": -20,
}


def get_current_prospect_score(prospect):
    company = getattr(prospect, "prospect_company", None)
    if company and company.score_ia is not None:
        return int(company.score_ia or 0)
    result = calculate_score(prospect)
    return int(result.get("score") or 0)


def recalculate_prospect_score(prospect, reason="", activity=None, agent_run=None, delta=None):
    previous_score = get_current_prospect_score(prospect)
    base_result = calculate_score(prospect)
    base_score = int(base_result.get("score") or 0)
    new_score = max(0, min(100, base_score + int(delta or 0)))
    evaluation = base_result.get("evaluation") or prospect.evaluation
    if new_score >= 70:
        evaluation = "hot"
    elif new_score >= 35:
        evaluation = "warm"
    else:
        evaluation = "cold"

    prospect.evaluation = evaluation
    prospect.raison_score = reason or "; ".join(map(str, base_result.get("reasons") or []))
    prospect.save(update_fields=["evaluation", "raison_score", "updated_at"])

    if prospect.prospect_company:
        prospect.prospect_company.score_ia = new_score
        prospect.prospect_company.evaluation = evaluation
        prospect.prospect_company.save(update_fields=["score_ia", "evaluation"])

    if previous_score != new_score:
        history = ProspectScoreHistory.objects.create(
            prospect=prospect,
            previous_score=previous_score,
            new_score=new_score,
            reason=reason,
            activity=activity,
            agent_run=agent_run,
        )
        event_from_score_history(history)
        return history
    return None


def recalculate_after_activity(activity):
    delta = ACTIVITY_SCORE_DELTAS.get(activity.activity_type)
    if delta is None:
        return None
    try:
        return recalculate_prospect_score(
            activity.prospect,
            reason=activity.title or activity.get_activity_type_display(),
            activity=activity,
            agent_run=activity.agent_run,
            delta=delta,
        )
    except Exception:
        logger.exception("Unable to recalculate prospect score after activity=%s", activity.id)
        return None
