"""
URL configuration for config project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.static import serve
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from agentProspection.api.views import ProspectAgentView
from agentProspection.api.views import ProspectDiscoveryReportView
from agentProspection.api.views import ProspectScoreView
from agentProspection.api.views import ProspectSourcesView
from sales.views import ProspectViewSet, TaskViewSet


# ---------------------------------------------------------------------------
# Aliases des ViewSets
# ---------------------------------------------------------------------------

task_list = TaskViewSet.as_view(
    {
        "get": "list",
        "post": "create",
    }
)

task_detail = TaskViewSet.as_view(
    {
        "get": "retrieve",
        "patch": "partial_update",
        "put": "update",
        "delete": "destroy",
    }
)

task_complete = TaskViewSet.as_view(
    {
        "post": "complete",
    }
)

prospect_tasks = ProspectViewSet.as_view(
    {
        "get": "tasks",
    }
)


# ---------------------------------------------------------------------------
# Routes principales
# ---------------------------------------------------------------------------

urlpatterns = [
    # Administration Django
    path(
        "admin/",
        admin.site.urls,
    ),

    # Fichiers publics du frontend
    path(
        "tools/<path:path>",
        serve,
        {
            "document_root": (
                settings.BASE_DIR.parent
                / "crm-frontend"
                / "public"
                / "tools"
            ),
        },
        name="frontend-tools",
    ),

    # Authentification et utilisateurs
    path(
        "api/users/",
        include("users.urls"),
    ),

    path(
        "api/token/",
        TokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),

    path(
        "api/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),

    # Module commercial
    path(
        "api/sales/",
        include("sales.urls"),
    ),

    # Alias des tâches
    path(
        "api/tasks/",
        task_list,
        name="tasks-list-alias",
    ),

    path(
        "api/tasks/<int:pk>/",
        task_detail,
        name="tasks-detail-alias",
    ),

    path(
        "api/tasks/<int:pk>/complete/",
        task_complete,
        name="tasks-complete-alias",
    ),

    path(
        "api/prospects/<int:pk>/tasks/",
        prospect_tasks,
        name="prospect-tasks-alias",
    ),

    path(
        "api/prospects/<int:prospect_id>/sources/",
        ProspectSourcesView.as_view(),
        name="prospect-sources-alias",
    ),

    path(
        "api/prospects/<int:prospect_id>/score/",
        ProspectScoreView.as_view(),
        name="prospect-score-alias",
    ),

    # Abonnements
    path(
        "api/subscriptions/",
        include("subscriptions.urls"),
    ),

    # Superadministration
    path(
        "api/superadmin/",
        include("superadmin.urls"),
    ),

    # Notifications
    path(
        "api/notifications/",
        include("Notifications.urls"),
    ),

    # Sessions sociales conservées pour l'agent d'engagement.
    # Elles ne sont plus utilisées par l'agent de prospection.
    path(
        "api/social/",
        include("social_sessions.urls"),
    ),

    # Tableau de bord
    path(
        "api/dashboard/",
        include("dashboard.urls"),
    ),

    # Endpoint principal actuel de prospection
    path(
        "api/agent/prospect/",
        ProspectAgentView.as_view(),
        name="agent-prospect",
    ),
    path(
        "api/agent/prospect/<int:run_id>/report/",
        ProspectDiscoveryReportView.as_view(),
        name="agent-prospect-report",
    ),

    # Assistant CRM
    path(
        "api/agent/",
        include("crm_agent.urls"),
    ),

    # Calendrier
    path(
        "api/",
        include("calendar_module.urls"),
    ),

    # Routes générales de l'application agentProspection
    path(
        "api/agentProspection/",
        include("agentProspection.urls"),
    ),

    path(
        "agentProspection/",
        include("agentProspection.urls"),
    ),

    # Routes API complémentaires de l'agent de prospection
    path(
        "api/prospection/",
        include("agentProspection.api.urls"),
    ),

    # Agent d'engagement
    path(
        "api/engagement/",
        include("agentEngagement.urls"),
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
