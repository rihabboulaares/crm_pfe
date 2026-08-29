from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class QualificationState(TypedDict, total=False):
    prospect_id: int
    user_id: int | None
    messages: Annotated[list[AnyMessage], add_messages]
    observations: dict[str, Any]
    agent_trace: list[dict[str, Any]]
    agent_next: str | None
    agent_incomplete: bool
    tool_call_count: int
    max_tool_calls: int
    prospect: dict[str, Any]
    company: dict[str, Any] | None
    qualification_target: dict[str, Any] | None
    prospect360: dict[str, Any]
    activities: list[dict[str, Any]]
    interactions: list[dict[str, Any]]
    engagement_logs: list[dict[str, Any]]
    previous_qualification: dict[str, Any] | None
    qualification_mode: str
    profile_signals: dict[str, Any]
    interaction_signals: dict[str, Any]
    ai_result: dict[str, Any] | None
    missing_information: list[str]
    deterministic_score: int | None
    final_score: int | None
    confidence: float | None
    status: str | None
    opportunity_ready: bool
    recommended_action: str | None
    strengths: list[str]
    risks: list[str]
    detected_needs: list[str]
    objections: list[str]
    buying_signals: list[str]
    summary: str | None
    signal_details: dict[str, Any]
    source_snapshot: dict[str, Any]
    qualification_id: int | None
    errors: list[str]
