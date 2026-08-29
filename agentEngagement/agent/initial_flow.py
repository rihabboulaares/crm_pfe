import logging

from .agentic_runtime import EngagementAgentRuntime

logger = logging.getLogger(
    "agentEngagement.initial_flow"
)


class EngagementInitialFlowService:
    """
    Entrée compatible avec l'ancien frontend.

    Le workflow interne est maintenant piloté
    dynamiquement par EngagementAgentRuntime.
    """

    def __init__(
        self,
        agent_runtime=None,
        **legacy_dependencies,
    ):

        runtime_kwargs = {
            key: value
            for key, value
            in legacy_dependencies.items()
            if key in {
                "model",
                "context_builder",
                "channel_resolver",
                "policy_engine",
                "content_generator",
                "memory_manager",
                "max_steps",
            }
        }

        self.agent_runtime = (
            agent_runtime
            or EngagementAgentRuntime(
                **runtime_kwargs
            )
        )

    def run(
        self,
        prospect,
        user=None,
    ) -> dict:

        return self.agent_runtime.run(
            prospect=prospect,
            user=user,
            goal="INITIAL_ENGAGEMENT",
        )