from django.urls import path
from agentProspection.api.views import (
    ProspectAgentView,
    ProspectDiscoveryReportView,
    ProspectingRequiredSessionsView,
)

urlpatterns = [
    path("prospect/", ProspectAgentView.as_view(), name="agent-prospect"),
    path("prospect/<int:run_id>/report/", ProspectDiscoveryReportView.as_view(), name="agent-prospect-report"),
    path(
        "prospecting/social-sessions/required/",
        ProspectingRequiredSessionsView.as_view(),
        name="prospecting-required-social-sessions",
    ),
]
