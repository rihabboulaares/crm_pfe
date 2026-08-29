from .qualification_weights import INITIAL_WEIGHTS, POST_ENGAGEMENT_WEIGHTS
from agentQualification.schemas import QualificationScoreBreakdown


LEVEL_SCORE = {
    "UNKNOWN": 0,
    "LOW": 30,
    "MEDIUM": 65,
    "HIGH": 92,
}

AUTHORITY_SCORE = {
    "UNKNOWN": 0,
    "USER": 35,
    "INFLUENCER": 70,
    "DECISION_MAKER": 95,
}

ENGAGEMENT_SCORE = {
    "NONE": 0,
    "NEGATIVE": 15,
    "WEAK": 45,
    "POSITIVE": 75,
    "STRONG": 95,
}

BUDGET_SCORE = {
    "UNKNOWN": 0,
    "NEGATIVE": 15,
    "NEUTRAL": 45,
    "POSITIVE": 85,
}


def clamp_score(value):
    return max(0, min(100, int(round(value or 0))))


def score_from_ai(ai_result):
    ai = ai_result or {}
    buying_signals = ai.get("buying_signals") or []
    return {
        "need_score": LEVEL_SCORE.get(ai.get("need_level"), 0),
        "intent_score": LEVEL_SCORE.get(ai.get("intent_level"), 0),
        "authority_score": AUTHORITY_SCORE.get(ai.get("authority_level"), 0),
        "timing_score": max(
            LEVEL_SCORE.get(ai.get("urgency_level"), 0),
            BUDGET_SCORE.get(ai.get("budget_signal"), 0),
        ),
        "engagement_score": ENGAGEMENT_SCORE.get(ai.get("engagement_quality"), 0),
        "buying_signal_score": clamp_score(len(buying_signals) * 22),
    }


def calculate_final_score(mode, profile_signals, ai_result):
    ai_scores = score_from_ai(ai_result)
    breakdown = QualificationScoreBreakdown(
        profile_fit_score=profile_signals.get("profile_fit_score", 0),
        company_fit_score=profile_signals.get("company_fit_score", 0),
        contact_relevance_score=profile_signals.get("contact_relevance_score", 0),
        reachability_score=profile_signals.get("reachability_score", 0),
        **ai_scores,
    )
    weights = POST_ENGAGEMENT_WEIGHTS if mode == "POST_ENGAGEMENT" else INITIAL_WEIGHTS
    total = sum(getattr(breakdown, key) * weight for key, weight in weights.items())
    return clamp_score(total), breakdown.model_dump() if hasattr(breakdown, "model_dump") else breakdown.dict()

