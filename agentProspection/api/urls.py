from django.urls import path

from .views import (
    ProspectAgentView,
    ProspectDiscoveryReportView,
    ProspectingRequiredSessionsView,
    ProspectSourcesView,
)


urlpatterns = [
    # =========================================================
    # DISCOVERY AGENT
    # =========================================================
    # Lance une nouvelle recherche de prospects.
    #
    # POST /api/agent/prospect/
    #
    path(
        "prospect/",
        ProspectAgentView.as_view(),
        name="prospect-discovery",
    ),

    # =========================================================
    # DISCOVERY REPORT
    # =========================================================
    # Télécharge le rapport PDF d'un run Discovery.
    #
    # GET /api/agent/prospect/<run_id>/report/
    #
    path(
        "prospect/<int:run_id>/report/",
        ProspectDiscoveryReportView.as_view(),
        name="prospect-discovery-report",
    ),

    # =========================================================
    # REQUIRED SOCIAL SESSIONS
    # =========================================================
    # Conservé pour compatibilité frontend.
    # Les recherches sociales utilisent maintenant Serper.
    #
    # GET /api/agent/prospect/required-sessions/
    #
    path(
        "prospect/required-sessions/",
        ProspectingRequiredSessionsView.as_view(),
        name="prospect-required-sessions",
    ),

    # =========================================================
    # PROSPECT SOURCES
    # =========================================================
    # Retourne les sources ayant permis de découvrir le prospect.
    #
    # GET /api/agent/prospects/<prospect_id>/sources/
    #
    path(
        "prospects/<int:prospect_id>/sources/",
        ProspectSourcesView.as_view(),
        name="prospect-sources",
    ),
]
