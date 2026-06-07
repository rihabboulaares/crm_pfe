from django.urls import path
from agentProspection.api.views import ProspectAgentView, ProspectingRequiredSessionsView

urlpatterns = [
    path("prospect/", ProspectAgentView.as_view(), name="agent-prospect"),
    path(
        "prospecting/social-sessions/required/",
        ProspectingRequiredSessionsView.as_view(),
        name="prospecting-required-social-sessions",
    ),
]
