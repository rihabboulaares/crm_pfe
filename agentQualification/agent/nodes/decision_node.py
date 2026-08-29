from agentQualification.agent.qualification_weights import (
    DEEPEN_THRESHOLD,
    ENGAGE_THRESHOLD,
    READY_FOR_OPPORTUNITY_THRESHOLD,
)


BLOCKING_OBJECTION_KEYWORDS = [
    "ne plus contacter",
    "unsubscribe",
    "pas intéressé",
    "pas interesse",
    "wrong contact",
    "mauvais contact",
]


def _contains_blocking_objection(objections):
    text = " ".join(objections or []).lower()
    return any(keyword in text for keyword in BLOCKING_OBJECTION_KEYWORDS)


def decision_node(state):
    score = int(state.get("final_score") or 0)
    mode = state.get("qualification_mode") or "INITIAL"
    ai = state.get("ai_result") or {}
    buying_signals = state.get("buying_signals") or []
    detected_needs = state.get("detected_needs") or []
    objections = state.get("objections") or []
    profile = state.get("profile_signals") or {}

    has_positive_interest = ai.get("intent_level") in {"MEDIUM", "HIGH"} or ai.get("engagement_quality") in {
        "POSITIVE",
        "STRONG",
    }
    has_need = ai.get("need_level") in {"MEDIUM", "HIGH"} or bool(detected_needs)
    has_concrete_signal = bool(buying_signals) or ai.get("urgency_level") in {"MEDIUM", "HIGH"}
    data_sufficient = profile.get("reachability_score", 0) >= 30 and profile.get("contact_relevance_score", 0) >= 45
    blocked = _contains_blocking_objection(objections) or ai.get("engagement_quality") == "NEGATIVE"

    strengths = []
    risks = []
    if data_sufficient:
        strengths.append("Données de contact exploitables")
    else:
        risks.append("Données de contact insuffisantes")
    if has_need:
        strengths.append("Besoin détecté")
    if has_positive_interest:
        strengths.append("Intérêt positif détecté")
    if buying_signals:
        strengths.extend(buying_signals[:3])
    if objections:
        risks.extend(objections[:3])
    if mode == "INITIAL":
        risks.append("Aucun échange commercial confirmé")

    if blocked:
        status = "NOT_QUALIFIED"
        action = "DO_NOT_CONTACT"
        opportunity_ready = False
        summary = "Le prospect ne doit pas être priorisé actuellement à cause d'un signal négatif ou bloquant."
    elif (
        mode == "POST_ENGAGEMENT"
        and score >= READY_FOR_OPPORTUNITY_THRESHOLD
        and has_positive_interest
        and has_need
        and has_concrete_signal
        and data_sufficient
    ):
        status = "READY_FOR_OPPORTUNITY"
        action = "CREATE_OPPORTUNITY"
        opportunity_ready = True
        summary = "Le prospect présente suffisamment de signaux commerciaux pour proposer la création d'une opportunité."
    elif mode == "POST_ENGAGEMENT" and has_positive_interest and has_need and score >= 55:
        status = "DEEPEN"
        action = "DEEPEN_DISCOVERY"
        opportunity_ready = False
        summary = "Le prospect exprime un intérêt ou un besoin, mais il manque encore des signaux pour créer une opportunité."
    elif score >= DEEPEN_THRESHOLD:
        status = "DEEPEN" if mode == "POST_ENGAGEMENT" else "ENGAGE"
        action = "DEEPEN_DISCOVERY" if mode == "POST_ENGAGEMENT" else "ENGAGE_PROSPECT"
        opportunity_ready = False
        summary = (
            "Le prospect mérite une analyse commerciale plus approfondie."
            if mode == "POST_ENGAGEMENT"
            else "Le prospect correspond suffisamment au profil cible pour être engagé."
        )
    elif score >= ENGAGE_THRESHOLD and mode == "INITIAL":
        status = "ENGAGE"
        action = "ENGAGE_PROSPECT"
        opportunity_ready = False
        summary = "Le profil est exploitable pour une première prise de contact."
    else:
        status = "NOT_QUALIFIED"
        action = "DEEPEN_DISCOVERY"
        opportunity_ready = False
        summary = "Les informations disponibles ne suffisent pas encore pour qualifier ce prospect."

    state.update(
        {
            "status": status,
            "opportunity_ready": opportunity_ready,
            "recommended_action": action,
            "strengths": strengths,
            "risks": risks,
            "summary": state.get("summary") or summary,
        }
    )
    return state
