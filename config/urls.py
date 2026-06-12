"""
URL configuration for config project.
"""
from django.contrib import admin
from django.conf import settings
from django.urls import path, include
from django.views.static import serve
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from agentProspection.api.views import ProspectAgentView, ProspectingRequiredSessionsView
from sales.views import ProspectViewSet, TaskViewSet

task_list = TaskViewSet.as_view({"get": "list", "post": "create"})
task_detail = TaskViewSet.as_view({"get": "retrieve", "patch": "partial_update", "put": "update", "delete": "destroy"})
task_complete = TaskViewSet.as_view({"post": "complete"})
prospect_tasks = ProspectViewSet.as_view({"get": "tasks"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path(
        "tools/<path:path>",
        serve,
        {"document_root": settings.BASE_DIR.parent / "crm-frontend" / "public" / "tools"},
        name="frontend-tools",
    ),
    path("api/users/", include("users.urls")),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("api/sales/", include("sales.urls")),
    path("api/tasks/", task_list, name="tasks-list-alias"),
    path("api/tasks/<int:pk>/", task_detail, name="tasks-detail-alias"),
    path("api/tasks/<int:pk>/complete/", task_complete, name="tasks-complete-alias"),
    path("api/prospects/<int:pk>/tasks/", prospect_tasks, name="prospect-tasks-alias"),
    path("api/subscriptions/", include("subscriptions.urls")),
    path("api/superadmin/", include("superadmin.urls")),
    path("api/notifications/", include("Notifications.urls")),
    path("api/social/", include("social_sessions.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path("api/agent/prospect/", ProspectAgentView.as_view(), name="agent-prospect"),
    path(
        "api/prospecting/social-sessions/required/",
        ProspectingRequiredSessionsView.as_view(),
        name="prospecting-required-social-sessions",
    ),
    path("api/agent/", include("crm_agent.urls")),  # ← remplace l'ancienne ligne
    path("api/", include("calendar_module.urls")),
    path("api/agentProspection/", include("agentProspection.urls")),
    path("agentProspection/", include("agentProspection.urls")),
    path("api/agent/", include("agentProspection.api.urls")),
    path("api/engagement/", include("agentEngagement.urls")),
]
