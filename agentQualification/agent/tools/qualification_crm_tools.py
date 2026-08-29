from dataclasses import dataclass
from typing import Any

from langchain_core.tools import tool

from agentQualification.agent.tools.activities_tool import list_prospect_activities
from agentQualification.agent.tools.company_tool import serialize_company
from agentQualification.agent.tools.engagement_history_tool import (
    extract_engagement_interactions,
    list_engagement_logs,
)
from agentQualification.agent.tools.prospect_tool import serialize_prospect_for_qualification
from agentQualification.agent.tools.qualification_history_tool import serialize_latest_qualification


@dataclass
class QualificationToolContext:
    prospect: Any
    user: Any = None
    request: Any = None


def build_qualification_tools(context: QualificationToolContext):
    prospect = context.prospect
    request = context.request

    @tool
    def get_prospect_profile() -> dict:
        """Récupère le profil CRM du prospect courant autorisé par le backend."""
        return serialize_prospect_for_qualification(prospect, request=request)

    @tool
    def get_company_context() -> dict | None:
        """Récupère le contexte de l'entreprise liée au prospect courant."""
        return serialize_company(prospect.prospect_company)

    @tool
    def get_prospect360() -> dict:
        """Récupère les compteurs CRM 360 du prospect courant."""
        return {
            "activities_count": prospect.prospect_activities.count(),
            "agent_runs_count": prospect.agent_runs.count(),
            "documents_count": prospect.documents.count(),
            "recommendations_count": prospect.recommendations.count(),
            "opportunities_count": prospect.opportunities.count(),
        }

    @tool
    def get_engagement_history() -> dict:
        """Récupère les logs d'engagement et interactions normalisées du prospect courant."""
        activities = list_prospect_activities(prospect, request=request)
        engagement_logs = list_engagement_logs(prospect)
        interactions = extract_engagement_interactions(activities, engagement_logs)
        return {
            "engagement_logs": engagement_logs,
            "interactions": interactions,
        }

    @tool
    def get_recent_activities() -> list[dict]:
        """Récupère les activités CRM récentes du prospect courant."""
        return list_prospect_activities(prospect, request=request)

    @tool
    def get_previous_qualification() -> dict | None:
        """Récupère la dernière qualification enregistrée pour le prospect courant."""
        return serialize_latest_qualification(prospect)

    return [
        get_prospect_profile,
        get_company_context,
        get_prospect360,
        get_engagement_history,
        get_recent_activities,
        get_previous_qualification,
    ]
