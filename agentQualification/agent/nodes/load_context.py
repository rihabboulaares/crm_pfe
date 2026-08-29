from agentQualification.agent.tools.activities_tool import list_prospect_activities
from agentQualification.agent.tools.company_tool import serialize_company
from agentQualification.agent.tools.engagement_history_tool import (
    extract_engagement_interactions,
    list_engagement_logs,
)
from agentQualification.agent.tools.prospect_tool import serialize_prospect_for_qualification
from agentQualification.agent.qualification_target import resolve_qualification_target
from agentQualification.agent.tools.qualification_history_tool import serialize_latest_qualification


def load_context(state, prospect, user=None, request=None):
    prospect_data = serialize_prospect_for_qualification(prospect, request=request)
    company_data = serialize_company(prospect.prospect_company)
    activities = list_prospect_activities(prospect, request=request)
    engagement_logs = list_engagement_logs(prospect)
    interactions = extract_engagement_interactions(activities, engagement_logs)
    qualification_target = resolve_qualification_target(prospect=prospect, user=user)

    state.update(
        {
            "prospect": prospect_data,
            "company": company_data,
            "qualification_target": qualification_target,
            "prospect360": {
                "activities_count": len(activities),
                "agent_runs_count": prospect.agent_runs.count(),
                "documents_count": prospect.documents.count(),
                "recommendations_count": prospect.recommendations.count(),
                "opportunities_count": prospect.opportunities.count(),
            },
            "activities": activities,
            "engagement_logs": engagement_logs,
            "interactions": interactions,
            "previous_qualification": serialize_latest_qualification(prospect),
            "errors": [],
        }
    )
    return state
