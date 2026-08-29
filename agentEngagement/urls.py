from django.urls import path

from .views import (
    CreateFollowUpTaskView,
    EngagementCampaignsView,
    EmailConnectView,
    EmailConnectionTestView,
    EmailConnectionsView,
    EmailDisconnectView,
    EmailOAuthCallbackView,
    EngagementDashboardView,
    EngagementProspectsView,
    EngagementInteractionOptionsView,
    ProspectInteractionAnalysisView,
    ProspectInteractionContinueView,
    ProspectInteractionReplanView,
    ProspectInitialEngagementPlanView,
    ProspectInteractionsView,
    ProspectLogsView,
)

urlpatterns = [
    path("dashboard/", EngagementDashboardView.as_view(), name="engagement-dashboard"),
    path("prospects/", EngagementProspectsView.as_view(), name="engagement-prospects"),
    path("connections/email/", EmailConnectionsView.as_view(), name="engagement-email-connections"),
    path("connections/email/disconnect/", EmailDisconnectView.as_view(), name="engagement-email-disconnect"),
    path("connections/email/test/", EmailConnectionTestView.as_view(), name="engagement-email-test"),
    path("connections/google/connect/", EmailConnectView.as_view(), {"provider": "google"}, name="engagement-google-connect"),
    path("connections/google/callback/", EmailOAuthCallbackView.as_view(), {"provider": "google"}, name="engagement-google-callback"),
    path("connections/<str:provider>/connect/", EmailConnectView.as_view(), name="engagement-email-connect"),
    path("connections/<str:provider>/callback/", EmailOAuthCallbackView.as_view(), name="engagement-email-callback"),
    path(
        "prospects/<int:prospect_id>/initial-plan/",
        ProspectInitialEngagementPlanView.as_view(),
        name="engagement-initial-plan",
    ),
    path(
        "prospects/<int:prospect_id>/logs/",
        ProspectLogsView.as_view(),
        name="engagement-logs",
    ),
    path(
        "interactions/options/",
        EngagementInteractionOptionsView.as_view(),
        name="engagement-interaction-options",
    ),
    path(
        "prospects/<int:prospect_id>/interactions/",
        ProspectInteractionsView.as_view(),
        name="engagement-interactions",
    ),
    path(
        "prospects/<int:prospect_id>/interactions/<int:interaction_id>/analyze/",
        ProspectInteractionAnalysisView.as_view(),
        name="engagement-interaction-analyze",
    ),
    path(
        "prospects/<int:prospect_id>/interactions/<int:interaction_id>/replan/",
        ProspectInteractionReplanView.as_view(),
        name="engagement-interaction-replan",
    ),
    path(
        "prospects/<int:prospect_id>/interactions/<int:interaction_id>/continue/",
        ProspectInteractionContinueView.as_view(),
        name="engagement-interaction-continue",
    ),
    path(
        "prospects/<int:prospect_id>/create-follow-up-task/",
        CreateFollowUpTaskView.as_view(),
        name="engagement-follow-up-task",
    ),
    path("campaigns/", EngagementCampaignsView.as_view(), name="engagement-campaigns"),
]
