import logging

from .agentic_runtime import EngagementAgentRuntime

logger = logging.getLogger("agentEngagement.continuation")


class EngagementContinuationService:
    """
    Point d'entrée de continuation après interaction.

    existing_analysis permet de réutiliser une analyse déjà persistée
    sur ProspectActivity afin d'éviter un nouvel appel Gemini.
    """

    def __init__(self, agent_runtime=None, **dependencies):
        allowed_keys = {
            "model",
            "context_builder",
            "channel_resolver",
            "policy_engine",
            "content_generator",
            "memory_manager",
            "response_analyzer",
            "max_steps",
        }
        runtime_kwargs = {
            key: value
            for key, value in dependencies.items()
            if key in allowed_keys
        }

        self.agent_runtime = agent_runtime or EngagementAgentRuntime(**runtime_kwargs)

    def continue_after_interaction(
        self,
        *,
        prospect,
        interaction,
        user=None,
        existing_analysis=None,
        memory_already_updated=False,
    ):
        try:
            return self.agent_runtime.run(
                prospect=prospect,
                user=user,
                interaction=interaction,
                goal="CONTINUE_AFTER_INTERACTION",
                existing_analysis=existing_analysis,
                memory_already_updated=memory_already_updated,
            )
        except Exception:
            logger.exception(
                "[ENGAGEMENT][CONTINUE] Agent indisponible prospect=%s interaction=%s",
                getattr(prospect, "pk", None),
                (interaction or {}).get("id"),
            )
            raise