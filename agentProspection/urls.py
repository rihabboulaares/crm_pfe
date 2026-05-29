from django.urls import path
from agentProspection.api.views import ProspectAgentView

urlpatterns = [
    path("prospect/", ProspectAgentView.as_view(), name="agent-prospect"),
]