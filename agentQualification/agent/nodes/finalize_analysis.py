from agentQualification.agent.nodes.analyze_interactions import analyze_interactions
from agentQualification.agent.nodes.analyze_profile import analyze_profile
from agentQualification.agent.nodes.qualification_reasoner import (
    QualificationAIUnavailable,
    qualification_reasoner,
)


def finalize_analysis_node(state):
    if state.get("prospect") and "profile_signals" not in state:
        state = analyze_profile(state)
    if "interaction_signals" not in state:
        state = analyze_interactions(state)

    try:
        return qualification_reasoner(state)
    except QualificationAIUnavailable:
        state["ai_result"] = None
        state["agent_incomplete"] = True
        return state


def incomplete_analysis_node(state):
    state.update(
        {
            "ai_result": None,
            "status": "ANALYSIS_INCOMPLETE",
            "opportunity_ready": False,
            "recommended_action": "RETRY_QUALIFICATION",
            "confidence": 0.0,
            "strengths": [],
            "risks": ["Analyse IA indisponible ou outil refuse"],
            "summary": "La qualification n'a pas pu etre terminee pour le moment.",
        }
    )
    return state


def route_after_finalize(state):
    return "incomplete" if state.get("agent_incomplete") else "score"
