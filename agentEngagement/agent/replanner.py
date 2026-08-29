import logging

from .agentic_runtime import EngagementAgentRuntime

logger = logging.getLogger("agentEngagement.replanner")


class EngagementReplanningService:
    """
    Replanification compatible avec l'ancien endpoint /replan/.

    IMPORTANT :
    cette classe ne possède plus de planificateur LLM indépendant.
    Toutes les décisions commerciales passent désormais par
    EngagementAgentRuntime, puis par EngagementPolicyEngine.

    Le mode REPLAN ne génère pas de nouveau contenu :
    il produit uniquement une stratégie contrôlée par la politique.
    """

    def __init__(self, runtime=None):
        self.runtime = runtime or EngagementAgentRuntime()

    def replan(
        self,
        *,
        prospect,
        user=None,
        interaction=None,
        existing_analysis=None,
        memory_already_updated=False,
    ) -> dict:
        result = self.runtime.run(
            prospect=prospect,
            user=user,
            interaction=interaction,
            goal="REPLAN",
            existing_analysis=existing_analysis,
            memory_already_updated=memory_already_updated,
            content_generation_allowed=False,
        )

        plan = result.get("plan")
        policy = result.get("policy")

        logger.info(
            "[ENGAGEMENT][REPLAN] prospect=%s strategy=%s objective=%s policy=%s",
            getattr(prospect, "pk", None),
            getattr(plan, "strategy", None),
            getattr(plan, "objective", None),
            getattr(policy, "status", None),
        )

        return result