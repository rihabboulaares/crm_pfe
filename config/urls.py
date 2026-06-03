"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from agentProspection.api.views import ProspectAgentView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/users/", include("users.urls")),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("api/sales/", include("sales.urls")),
    path("api/subscriptions/", include("subscriptions.urls")),
    path("api/superadmin/", include("superadmin.urls")),
    path("api/notifications/", include("Notifications.urls")),
    path("api/agent/prospect/", ProspectAgentView.as_view(), name="agent-prospect"),
    path("api/agent/", include("crm_agent.urls")),  # ← remplace l'ancienne ligne
    path("api/", include("calendar_module.urls")),
    path("api/agentProspection/", include("agentProspection.urls")),
    path("agentProspection/", include("agentProspection.urls")),
    path("api/agent/", include("agentProspection.api.urls")),
    path("api/engagement/", include("agentEngagement.urls")),
]
