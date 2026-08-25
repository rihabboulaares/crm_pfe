from django.urls import path
from agentProspection.api.views import (
    ProspectAgentView,
    ProspectDiscoveryReportView,
    ProspectingRequiredSessionsView,
    ProspectScoreView,
)

urlpatterns = [
    path("prospect/", ProspectAgentView.as_view(), name="agent-prospect"),
    path("prospect/<int:run_id>/report/", ProspectDiscoveryReportView.as_view(), name="agent-prospect-report"),
    path("prospects/<int:prospect_id>/score/", ProspectScoreView.as_view(), name="agent-prospect-score"),
    path(
        "prospecting/social-sessions/required/",
        ProspectingRequiredSessionsView.as_view(),
        name="prospecting-required-social-sessions",
    ),
]
