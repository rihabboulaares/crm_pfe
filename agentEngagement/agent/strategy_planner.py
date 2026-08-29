import json
import logging
from typing import Literal

from pydantic import BaseModel, Field

from agentEngagement.gemini_client import extract_json, generate_with_retry, get_gemini_model

logger = logging.getLogger("agentEngagement.strategy_planner")


ENGAGEMENT_STAGES = (
    "FIRST_CONTACT",
    "CONTACTED",
    "FOLLOW_UP",
    "QUALIFICATION",
    "DISCOVERY",
    "OBJECTION",
    "INTERESTED",
    "NURTURING",
    "MEETING",
    "REACTIVATION",
    "CLOSING",
    "NOT_INTERESTED",
    "UNKNOWN",
)

PROSPECT_TEMPERATURES = ("COLD", "WARM", "HOT", "UNKNOWN")

OBJECTIVES = (
    "START_CONVERSATION",
    "QUALIFY_NEED",
    "DISCOVER_PAIN_POINTS",
    "FOLLOW_UP",
    "HANDLE_OBJECTION",
    "PROVIDE_INFORMATION",
    "PROPOSE_MEETING",
    "REACTIVATE",
    "NURTURE",
    "CLOSE_CONVERSATION",
    "WAIT",
)

STRATEGIES = (
    "DIRECT_OUTREACH",
    "VALUE_FIRST",
    "DISCOVERY",
    "FOLLOW_UP",
    "OBJECTION_HANDLING",
    "NURTURING",
    "MEETING_CONVERSION",
    "REACTIVATION",
    "CLOSING",
    "WAIT",
    "STOP_ENGAGEMENT",
)

PLANNER_CHANNELS = ("email", "phone", "linkedin", "facebook", "instagram")


class EngagementPlanningUnavailable(Exception):
    """Raised when Gemini cannot provide a safe structured engagement plan."""


class EngagementStrategyPlan(BaseModel):
    situation_summary: str
    engagement_stage: Literal[
        "FIRST_CONTACT",
        "CONTACTED",
        "FOLLOW_UP",
        "QUALIFICATION",
        "DISCOVERY",
        "OBJECTION",
        "INTERESTED",
        "NURTURING",
        "MEETING",
        "REACTIVATION",
        "CLOSING",
        "NOT_INTERESTED",
        "UNKNOWN",
    ]
    prospect_temperature: Literal["COLD", "WARM", "HOT", "UNKNOWN"]
    objective: Literal[
        "START_CONVERSATION",
        "QUALIFY_NEED",
        "DISCOVER_PAIN_POINTS",
        "FOLLOW_UP",
        "HANDLE_OBJECTION",
        "PROVIDE_INFORMATION",
        "PROPOSE_MEETING",
        "REACTIVATE",
        "NURTURE",
        "CLOSE_CONVERSATION",
        "WAIT",
    ]
    strategy: Literal[
        "DIRECT_OUTREACH",
        "VALUE_FIRST",
        "DISCOVERY",
        "FOLLOW_UP",
        "OBJECTION_HANDLING",
        "NURTURING",
        "MEETING_CONVERSION",
        "REACTIVATION",
        "CLOSING",
        "WAIT",
        "STOP_ENGAGEMENT",
    ]
    primary_channel: Literal["email", "phone", "linkedin", "facebook", "instagram"] | None = None
    secondary_channels: list[Literal["email", "phone", "linkedin", "facebook", "instagram"]] = Field(
        default_factory=list
    )
    confidence: float = Field(ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    should_wait: bool
    suggested_wait_days: int | None = Field(default=None, ge=0)


ENGAGEMENT_STRATEGY_SYSTEM_PROMPT = """
You are an AI Sales Engagement Strategist integrated into a CRM.

Your role is to analyze verified CRM information about one prospect and determine
the most appropriate engagement strategy at this moment.

You reason from:
- prospect information
- company information
- existing CRM interactions
- activities and tasks
- engagement_memory when present
- available contact channels

You do not execute actions.
You do not send messages.
You do not generate the final email, social message or call script at this stage.
Your task is only to produce an engagement plan.

IMPORTANT RULES:
1. Only use information explicitly available in the CRM context.
2. Never invent technologies used, needs, budgets, projects, social posts, company news,
   previous conversations or pain points.
3. Only select channels marked as available.
4. A channel being available does not mean it should be used.
5. Select the commercially most appropriate channel based on context.
6. If information is insufficient, express uncertainty.
7. You may choose WAIT if immediate engagement is not appropriate.
8. You may choose no primary channel when waiting or stopping.
9. Return only the structured JSON schema requested.
10. Do not expose hidden reasoning or chain of thought. Provide only short business
    reasons supporting the recommendation.
11. If engagement_memory is present, use it as a synthetic commercial memory:
    confirmed_facts have more weight than inferred_signals.
    Inferred signals may guide judgment but must not be treated as certain facts.
12. Consider previous engagement attempts, last_strategy, last_objective and
    last_interaction_outcome. Do not repeat the same approach automatically when
    the previous interaction produced new information requiring adaptation.
13. preferred_channel in memory is a commercial preference, not a forced channel.
    Available channels remain the technical source of truth.
14. The CRM user may work in any industry. The target contact may have any
    professional role such as HR manager, marketing manager, sales director,
    buyer, executive, IT manager, communications manager or business owner.
15. Never assume the target prospect is looking for CRM software, sales
    software, prospecting software or marketing software unless verified CRM
    context explicitly supports that assumption.
16. Keep structured enum fields exactly in the allowed English enum values, but
    write user-facing textual fields such as situation_summary, reasons and
    missing_information in professional, natural French.
""".strip()


SCHEMA_HINT = """
{
  "situation_summary": "short CRM-based summary",
  "engagement_stage": "FIRST_CONTACT | CONTACTED | FOLLOW_UP | QUALIFICATION | DISCOVERY | OBJECTION | INTERESTED | NURTURING | MEETING | REACTIVATION | CLOSING | NOT_INTERESTED | UNKNOWN",
  "prospect_temperature": "COLD | WARM | HOT | UNKNOWN",
  "objective": "START_CONVERSATION | QUALIFY_NEED | DISCOVER_PAIN_POINTS | FOLLOW_UP | HANDLE_OBJECTION | PROVIDE_INFORMATION | PROPOSE_MEETING | REACTIVATE | NURTURE | CLOSE_CONVERSATION | WAIT",
  "strategy": "DIRECT_OUTREACH | VALUE_FIRST | DISCOVERY | FOLLOW_UP | OBJECTION_HANDLING | NURTURING | MEETING_CONVERSION | REACTIVATION | CLOSING | WAIT | STOP_ENGAGEMENT",
  "primary_channel": "email | phone | linkedin | facebook | instagram | null",
  "secondary_channels": ["email"],
  "confidence": 0.0,
  "reasons": ["short business reason"],
  "missing_information": ["missing business fact"],
  "should_wait": false,
  "suggested_wait_days": null
}
""".strip()


def _model_validate(model_class, data):
    if hasattr(model_class, "model_validate"):
        return model_class.model_validate(data)
    return model_class(**data)


def _model_dump(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _json(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, default=str)


def _available_channel_names(available_channels: dict) -> set[str]:
    return {
        channel
        for channel, metadata in (available_channels or {}).items()
        if channel in PLANNER_CHANNELS and (metadata or {}).get("available") is True
    }


def _channel_validation_errors(plan: EngagementStrategyPlan, available_channels: dict) -> list[str]:
    available = _available_channel_names(available_channels)
    errors = []

    if plan.primary_channel and plan.primary_channel not in available:
        errors.append(f"primary_channel '{plan.primary_channel}' is not available")

    for channel in plan.secondary_channels:
        if channel not in available:
            errors.append(f"secondary channel '{channel}' is not available")

    if not available:
        if plan.primary_channel is not None:
            errors.append("primary_channel must be null when no channel is available")
        if plan.secondary_channels:
            errors.append("secondary_channels must be empty when no channel is available")

    return errors


class EngagementStrategyPlanner:
    """
    Ask Gemini for a strategic engagement plan from an already-built CRM context.

    This class does not fetch Django models, write to the database, generate message
    content or execute engagement actions.
    """

    def __init__(self, model=None):
        self.model = model

    def plan(self, context: dict, available_channels: dict) -> EngagementStrategyPlan:
        model = self.model or get_gemini_model(max_output_tokens=2048, temperature=0.1, top_p=0.7)
        prompt = self._build_prompt(context, available_channels)

        try:
            data = self._call_gemini(model, prompt)
            return self._validate_or_raise(data, available_channels)
        except Exception as first_error:
            logger.warning("[strategy-planner] initial plan invalid: %s", first_error)

            try:
                correction_prompt = self._build_correction_prompt(
                    context=context,
                    available_channels=available_channels,
                    invalid_payload=locals().get("data", None),
                    error=first_error,
                )
                corrected_data = self._call_gemini(model, correction_prompt)
                return self._validate_or_raise(corrected_data, available_channels)
            except Exception as correction_error:
                logger.warning("[strategy-planner] planning unavailable: %s", correction_error)
                raise EngagementPlanningUnavailable("engagement_strategy_planning_unavailable") from correction_error

    def _call_gemini(self, model, prompt: str) -> dict:
        response = generate_with_retry(model, prompt, max_retries=2, wait_seconds=30, log_prefix="strategy-planner")
        if not response or not getattr(response, "text", None):
            raise ValueError("empty_gemini_response")
        return extract_json(response.text)

    def _validate_or_raise(self, data: dict, available_channels: dict) -> EngagementStrategyPlan:
        plan = _model_validate(EngagementStrategyPlan, data)
        channel_errors = _channel_validation_errors(plan, available_channels)
        if channel_errors:
            raise ValueError("; ".join(channel_errors))
        return plan

    def _build_prompt(self, context: dict, available_channels: dict) -> str:
        return f"""
{ENGAGEMENT_STRATEGY_SYSTEM_PROMPT}

CRM CONTEXT:
{_json(context or {})}

AVAILABLE CHANNELS:
{_json(available_channels or {})}

Allowed engagement_stage values:
{", ".join(ENGAGEMENT_STAGES)}

Allowed prospect_temperature values:
{", ".join(PROSPECT_TEMPERATURES)}

Allowed objective values:
{", ".join(OBJECTIVES)}

Allowed strategy values:
{", ".join(STRATEGIES)}

Expected JSON schema:
{SCHEMA_HINT}
""".strip()

    def _build_correction_prompt(self, context: dict, available_channels: dict, invalid_payload, error: Exception) -> str:
        return f"""
{ENGAGEMENT_STRATEGY_SYSTEM_PROMPT}

The previous response was invalid.
Return one corrected JSON object only. Do not add markdown or explanations.

Validation error:
{str(error)}

Invalid payload:
{_json(invalid_payload)}

CRM CONTEXT:
{_json(context or {})}

AVAILABLE CHANNELS:
{_json(available_channels or {})}

Expected JSON schema:
{SCHEMA_HINT}
""".strip()
