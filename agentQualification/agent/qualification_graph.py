from langgraph.graph import END, START, StateGraph

from agentQualification.agent.nodes.calculate_signals import calculate_signals
from agentQualification.agent.nodes.decision_node import decision_node
from agentQualification.agent.nodes.finalize_analysis import (
    finalize_analysis_node,
    incomplete_analysis_node,
    route_after_finalize,
)
from agentQualification.agent.nodes.persist_result import persist_result
from agentQualification.agent.nodes.qualification_agent import (
    initialize_node,
    make_qualification_agent_node,
    route_agent_action,
)
from agentQualification.agent.nodes.qualification_tools_node import make_qualification_tools_node
from agentQualification.agent.qualification_state import QualificationState
from agentQualification.agent.tools.qualification_crm_tools import (
    QualificationToolContext,
    build_qualification_tools,
)


class QualificationGraph:
    def run(self, state, prospect, user, request=None):
        graph = self._build_graph(prospect, user, request=request)
        return graph.invoke(state)

    def _build_graph(self, prospect, user, request=None):
        tools = build_qualification_tools(
            QualificationToolContext(
                prospect=prospect,
                user=user,
                request=request,
            )
        )

        def confidence_node(state):
            state["confidence"] = self._confidence(state)
            return state

        def persist_node(state):
            return persist_result(state, prospect, user)

        builder = StateGraph(QualificationState)
        builder.add_node("initialize", initialize_node)
        builder.add_node("agent", make_qualification_agent_node(tools))
        builder.add_node("tools", make_qualification_tools_node(tools))
        builder.add_node("finalize", finalize_analysis_node)
        builder.add_node("score", calculate_signals)
        builder.add_node("confidence", confidence_node)
        builder.add_node("decision", decision_node)
        builder.add_node("incomplete", incomplete_analysis_node)
        builder.add_node("persist", persist_node)

        builder.add_edge(START, "initialize")
        builder.add_edge("initialize", "agent")
        builder.add_conditional_edges(
            "agent",
            route_agent_action,
            {
                "tools": "tools",
                "finalize": "finalize",
                "incomplete": "incomplete",
            },
        )
        builder.add_edge("tools", "agent")
        builder.add_conditional_edges(
            "finalize",
            route_after_finalize,
            {
                "score": "score",
                "incomplete": "incomplete",
            },
        )
        builder.add_edge("score", "confidence")
        builder.add_edge("confidence", "decision")
        builder.add_edge("decision", "persist")
        builder.add_edge("incomplete", "persist")
        builder.add_edge("persist", END)
        return builder.compile()

    def _confidence(self, state):
        profile = state.get("profile_signals") or {}
        interactions = state.get("interaction_signals") or {}
        ai = state.get("ai_result") or {}
        known_ai = sum(
            1
            for key in [
                "need_level",
                "intent_level",
                "urgency_level",
                "budget_signal",
                "authority_level",
                "engagement_quality",
            ]
            if ai.get(key) and ai.get(key) not in {"UNKNOWN", "NONE"}
        )
        contact_factor = min(0.30, (profile.get("present_contact_channels", 0) or 0) * 0.08)
        interaction_factor = min(0.25, (interactions.get("significant_interactions", 0) or 0) * 0.08)
        ai_factor = min(0.35, known_ai * 0.06)
        return round(min(0.95, 0.10 + contact_factor + interaction_factor + ai_factor), 2)
