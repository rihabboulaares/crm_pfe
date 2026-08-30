import logging
import os

from django.conf import settings
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from agentQualification.prompts.agent_controller_prompt import build_agent_controller_prompt

logger = logging.getLogger("agentQualification.agent")

MAX_TOOL_CALLS = 10

REQUIRED_OBSERVATIONS = [
    "get_prospect_profile",
    "get_qualification_target",
    "get_company_context",
    "get_prospect360",
    "get_engagement_history",
    "get_previous_qualification",
]


class QualificationAgentUnavailable(Exception):
    pass


def get_agent_llm(tools):
    api_key = (
        getattr(settings, "GOOGLE_API_KEY", None)
        or getattr(settings, "GEMINI_API_KEY", None)
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
    )
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.1,
    )
    return llm.bind_tools(tools)


def initialize_node(state):
    state.setdefault("messages", [])
    state.setdefault("observations", {})
    state.setdefault("agent_trace", [])
    state.setdefault("tool_call_count", 0)
    state.setdefault("max_tool_calls", MAX_TOOL_CALLS)
    state.setdefault("missing_information", [])
    state.setdefault("strengths", [])
    state.setdefault("risks", [])
    state.setdefault("errors", [])

    if not state.get("messages"):
        state["messages"] = [
            HumanMessage(
                content=(
                    "Qualifie le prospect courant. "
                    "Observe uniquement les donnees utiles puis finalise."
                )
            )
        ]

    return state


def _next_required_observation(state, allowed_tools):
    observations = state.get("observations") or {}
    for tool_name in REQUIRED_OBSERVATIONS:
        if tool_name in allowed_tools and tool_name not in observations:
            return tool_name
    return None


def _required_tool_message(tool_name):
    return AIMessage(
        content=f"OBSERVE_REQUIRED_CONTEXT: {tool_name}",
        tool_calls=[
            {
                "name": tool_name,
                "args": {},
                "id": f"qualification-required-{tool_name}",
            }
        ],
    )


def make_qualification_agent_node(tools):
    allowed_tools = {item.name for item in tools}

    def qualification_agent_node(state):
        if (state.get("tool_call_count") or 0) >= (state.get("max_tool_calls") or MAX_TOOL_CALLS):
            trace = (state.get("agent_trace") or []) + [
                {
                    "step": len(state.get("agent_trace") or []) + 1,
                    "action": "finalize",
                    "reason": "max_tool_calls_reached",
                }
            ]
            return {
                "agent_next": "finalize",
                "agent_trace": trace,
                "messages": [
                    AIMessage(content="FINALIZE_QUALIFICATION: limite d'outils atteinte.")
                ],
            }

        required_tool = _next_required_observation(state, allowed_tools)
        if required_tool:
            trace = (state.get("agent_trace") or []) + [
                {
                    "step": len(state.get("agent_trace") or []) + 1,
                    "action": required_tool,
                    "reason": "required_context",
                }
            ]
            return {
                "agent_next": "tools",
                "agent_trace": trace,
                "messages": [_required_tool_message(required_tool)],
            }

        prompt = build_agent_controller_prompt(state, sorted(allowed_tools))
        messages = [SystemMessage(content=prompt)] + (state.get("messages") or [])

        try:
            response = get_agent_llm(tools).invoke(messages)
        except Exception as exc:
            logger.exception("Qualification agent controller unavailable prospect=%s", state.get("prospect_id"))
            return {
                "agent_next": "incomplete",
                "errors": (state.get("errors") or []) + [str(exc)],
                "messages": [AIMessage(content="ANALYSIS_INCOMPLETE: agent controller unavailable.")],
            }

        tool_calls = getattr(response, "tool_calls", None) or []
        invalid_tools = [
            call.get("name")
            for call in tool_calls
            if call.get("name") not in allowed_tools
        ]
        if invalid_tools:
            trace = (state.get("agent_trace") or []) + [
                {
                    "step": len(state.get("agent_trace") or []) + 1,
                    "action": "invalid_tool_refused",
                    "tool": invalid_tools[0],
                }
            ]
            return {
                "agent_next": "incomplete",
                "agent_trace": trace,
                "errors": (state.get("errors") or []) + [f"invalid_tool:{invalid_tools[0]}"],
                "messages": [response],
            }

        if tool_calls:
            trace = list(state.get("agent_trace") or [])
            for call in tool_calls:
                trace.append(
                    {
                        "step": len(trace) + 1,
                        "action": call.get("name"),
                    }
                )
            return {
                "agent_next": "tools",
                "agent_trace": trace,
                "messages": [response],
            }

        trace = (state.get("agent_trace") or []) + [
            {
                "step": len(state.get("agent_trace") or []) + 1,
                "action": "finalize",
            }
        ]
        return {
            "agent_next": "finalize",
            "agent_trace": trace,
            "messages": [response],
        }

    return qualification_agent_node


def route_agent_action(state):
    return state.get("agent_next") or "finalize"
