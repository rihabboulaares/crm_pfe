import json
import logging

from langchain_core.messages import ToolMessage

from agentQualification.agent.nodes.analyze_interactions import analyze_interactions
from agentQualification.agent.nodes.analyze_profile import analyze_profile

logger = logging.getLogger("agentQualification.tools")


def serialize_observation(value):
    return json.dumps(value, ensure_ascii=False, default=str)[:6000]


def apply_observation_to_state(state, tool_name, result):
    observations = dict(state.get("observations") or {})
    observations[tool_name] = result
    state["observations"] = observations

    if tool_name == "get_prospect_profile":
        state["prospect"] = result or {}
    elif tool_name == "get_company_context":
        state["company"] = result or {}
    elif tool_name == "get_prospect360":
        state["prospect360"] = result or {}
    elif tool_name == "get_engagement_history":
        state["engagement_logs"] = (result or {}).get("engagement_logs") or []
        state["interactions"] = (result or {}).get("interactions") or []
        state = analyze_interactions(state)
    elif tool_name == "get_recent_activities":
        state["activities"] = result or []
    elif tool_name == "get_previous_qualification":
        state["previous_qualification"] = result
    elif tool_name == "get_qualification_target":
        state["qualification_target"] = result or {}

    if state.get("prospect") is not None and "profile_signals" not in state:
        state = analyze_profile(state)
    elif tool_name in {"get_prospect_profile", "get_company_context", "get_qualification_target"} and state.get("prospect"):
        state = analyze_profile(state)

    return state


def make_qualification_tools_node(tools):
    registry = {item.name: item for item in tools}

    def qualification_tools_node(state):
        messages = state.get("messages") or []
        last_message = messages[-1] if messages else None
        tool_calls = getattr(last_message, "tool_calls", None) or []

        output_messages = []
        next_state = dict(state)
        for call in tool_calls:
            tool_name = call.get("name")
            tool_call_id = call.get("id") or tool_name
            selected_tool = registry.get(tool_name)
            if selected_tool is None:
                next_state["errors"] = (next_state.get("errors") or []) + [f"invalid_tool:{tool_name}"]
                output_messages.append(
                    ToolMessage(
                        content=f"Tool refuse: {tool_name}",
                        tool_call_id=tool_call_id,
                    )
                )
                continue

            try:
                result = selected_tool.invoke(call.get("args") or {})
                next_state = apply_observation_to_state(next_state, tool_name, result)
                next_state["tool_call_count"] = (next_state.get("tool_call_count") or 0) + 1
                output_messages.append(
                    ToolMessage(
                        content=serialize_observation(result),
                        tool_call_id=tool_call_id,
                    )
                )
            except Exception as exc:
                logger.exception("Qualification tool failed tool=%s prospect=%s", tool_name, state.get("prospect_id"))
                next_state["errors"] = (next_state.get("errors") or []) + [f"{tool_name}:{exc}"]
                output_messages.append(
                    ToolMessage(
                        content=f"Erreur outil {tool_name}: {exc}",
                        tool_call_id=tool_call_id,
                    )
                )

        next_state["messages"] = output_messages
        return next_state

    return qualification_tools_node
