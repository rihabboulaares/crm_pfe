import logging
from datetime import timedelta

from django.utils import timezone
from pydantic import BaseModel, Field

from agentEngagement.email_sender import get_active_email_connection
from agentEngagement.interaction_recorder import ACTION_TO_ACTIVITY_TYPE, CHANNEL_TO_ACTIVITY_CHANNEL
from agentEngagement.permissions import get_engagement_queryset_for_user
from sales.models import ProspectActivity

from .strategy_planner import EngagementStrategyPlan, _model_validate

logger = logging.getLogger("agentEngagement.policy")


POLICY_ALLOWED = "ALLOWED"
POLICY_BLOCKED = "BLOCKED"
POLICY_REQUIRES_REVIEW = "REQUIRES_REVIEW"

CONTACT_CHANNELS = ("email", "phone", "linkedin", "facebook", "instagram")
TERMINAL_PROSPECT_STATUSES = {"lost", "won"}
TERMINAL_ENGAGEMENT_STATUSES = {"closed", "rejected"}
NO_CONTENT_STRATEGIES = {"WAIT", "STOP_ENGAGEMENT"}
RECENT_DUPLICATE_WINDOW_SECONDS = 10


class EngagementPolicyDecision(BaseModel):
    allowed: bool
    status: str
    violations: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    no_content_required: bool = False


class EngagementPolicyEngine:
    """
    Deterministic guardrail for non-negotiable CRM constraints.

    Gemini remains responsible for commercial reasoning. This engine only checks
    objective CRM rules such as prospect access, contactability, selected channel
    availability and duplicate recorded interactions.
    """

    def evaluate(
        self,
        *,
        prospect,
        user,
        context: dict,
        available_channels: dict,
        plan: EngagementStrategyPlan | dict,
        idempotency_key: str = "",
        action_type: str = "",
    ) -> EngagementPolicyDecision:
        plan = self._coerce_plan(plan)
        violations = []
        warnings = []

        if not self._user_has_access(prospect, user):
            violations.append("PROSPECT_ACCESS_DENIED")

        if self._is_do_not_contact(prospect):
            violations.append("DO_NOT_CONTACT")

        if self._has_confirmed_unsubscribe(prospect, context):
            violations.append("UNSUBSCRIBE")

        terminal_status = self._terminal_status_violation(prospect)
        if terminal_status:
            violations.append(terminal_status)

        channel_violation = self._channel_violation(plan, available_channels)
        if channel_violation:
            violations.append(channel_violation)

        duplicate_warning = self._duplicate_warning(
            prospect=prospect,
            user=user,
            plan=plan,
            idempotency_key=idempotency_key,
            action_type=action_type,
        )
        if duplicate_warning:
            warnings.append(duplicate_warning)

        if self._email_provider_warning(plan, user):
            warnings.append("EMAIL_PROVIDER_NOT_READY")

        no_content_required = bool(plan.should_wait or plan.strategy in NO_CONTENT_STRATEGIES)

        decision = self._decision(violations, warnings, no_content_required)
        self._log_decision(prospect, decision)
        return decision

    def _coerce_plan(self, plan: EngagementStrategyPlan | dict) -> EngagementStrategyPlan:
        if isinstance(plan, EngagementStrategyPlan):
            return plan
        return _model_validate(EngagementStrategyPlan, plan)

    def _decision(self, violations, warnings, no_content_required):
        if violations:
            return EngagementPolicyDecision(
                allowed=False,
                status=POLICY_BLOCKED,
                violations=violations,
                warnings=warnings,
                no_content_required=no_content_required,
            )

        if warnings:
            return EngagementPolicyDecision(
                allowed=True,
                status=POLICY_REQUIRES_REVIEW,
                violations=[],
                warnings=warnings,
                no_content_required=no_content_required,
            )

        return EngagementPolicyDecision(
            allowed=True,
            status=POLICY_ALLOWED,
            violations=[],
            warnings=[],
            no_content_required=no_content_required,
        )

    def _user_has_access(self, prospect, user) -> bool:
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return get_engagement_queryset_for_user(user).filter(pk=getattr(prospect, "pk", None)).exists()

    def _is_do_not_contact(self, prospect) -> bool:
        if not hasattr(prospect, "do_not_contact"):
            return False
        return bool(getattr(prospect, "do_not_contact"))

    def _has_confirmed_unsubscribe(self, prospect, context: dict) -> bool:
        memory = (context or {}).get("engagement_memory") or {}
        if (memory.get("last_interaction_outcome") or "").upper() == "UNSUBSCRIBE":
            return True

        return ProspectActivity.objects.filter(
            prospect=prospect,
            source="manual",
            metadata__kind="engagement_interaction",
            metadata__outcome="UNSUBSCRIBE",
        ).exists()

    def _terminal_status_violation(self, prospect) -> str:
        status = (getattr(prospect, "status", "") or "").lower()
        if status in TERMINAL_PROSPECT_STATUSES:
            return "PROSPECT_STATUS_TERMINAL"

        engagement_status = (getattr(prospect, "engagement_status", "") or "").lower()
        if engagement_status in TERMINAL_ENGAGEMENT_STATUSES:
            return "ENGAGEMENT_STATUS_TERMINAL"

        return ""

    def _channel_violation(self, plan: EngagementStrategyPlan, available_channels: dict) -> str:
        if plan.should_wait or plan.strategy in NO_CONTENT_STRATEGIES:
            return ""

        channel = plan.primary_channel
        if not channel:
            return "PRIMARY_CHANNEL_REQUIRED"

        if channel not in CONTACT_CHANNELS:
            return "PRIMARY_CHANNEL_UNSUPPORTED"

        if not ((available_channels or {}).get(channel) or {}).get("available"):
            return "PRIMARY_CHANNEL_UNAVAILABLE"

        return ""

    def _duplicate_warning(self, *, prospect, user, plan, idempotency_key: str, action_type: str) -> str:
        idempotency_key = (idempotency_key or "").strip()
        if idempotency_key:
            exists = ProspectActivity.objects.filter(
                prospect=prospect,
                source="manual",
                metadata__kind="engagement_interaction",
                metadata__idempotency_key=idempotency_key,
            ).exists()
            if exists:
                return "DUPLICATE_IDEMPOTENCY_KEY"

        action_type = (action_type or "").strip().upper()
        channel = (plan.primary_channel or "").upper()
        if not action_type or channel not in CHANNEL_TO_ACTIVITY_CHANNEL or action_type not in ACTION_TO_ACTIVITY_TYPE:
            return ""

        return self._recent_duplicate_warning(prospect, user, channel, action_type)

    def _recent_duplicate_warning(self, prospect, user, channel: str, action_type: str) -> str:
        window_start = timezone.now() - timedelta(seconds=RECENT_DUPLICATE_WINDOW_SECONDS)
        exists = ProspectActivity.objects.filter(
            prospect=prospect,
            created_by=user,
            source="manual",
            activity_type=ACTION_TO_ACTIVITY_TYPE[action_type],
            channel=CHANNEL_TO_ACTIVITY_CHANNEL[channel],
            created_at__gte=window_start,
            metadata__kind="engagement_interaction",
            metadata__channel=channel,
            metadata__action_type=action_type,
        ).exists()
        return "RECENT_DUPLICATE_ACTION" if exists else ""

    def _email_provider_warning(self, plan: EngagementStrategyPlan, user) -> bool:
        if plan.primary_channel != "email" or plan.should_wait or plan.strategy in NO_CONTENT_STRATEGIES:
            return False
        return get_active_email_connection(user) is None

    def _log_decision(self, prospect, decision: EngagementPolicyDecision):
        reason = ",".join(decision.violations or decision.warnings or [])
        logger.info(
            "[ENGAGEMENT][POLICY] prospect=%s status=%s reason=%s",
            getattr(prospect, "pk", None),
            decision.status,
            reason,
        )