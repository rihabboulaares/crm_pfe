from django.urls import path

from .views import (
    CreateFollowUpTaskView,
    EngagementCampaignsView,
    EngagementDashboardView,
    EngagementProspectsView,
    MarkRepliedView,
    AnalyzeSocialProfileView,
    FacebookOpenSessionView,
    PrepareEngagementView,
    ProspectLogsView,
    ProspectMessageView,
    SendPreparedEngagementView,
    SocialLoginView,
    SocialSessionCheckView,
)

urlpatterns = [
    path("dashboard/", EngagementDashboardView.as_view(), name="engagement-dashboard"),
    path("prospects/", EngagementProspectsView.as_view(), name="engagement-prospects"),
    path(
        "prospects/<int:prospect_id>/prepare/",
        PrepareEngagementView.as_view(),
        name="engagement-prepare",
    ),
    path(
        "prospects/<int:prospect_id>/message/",
        ProspectMessageView.as_view(),
        name="engagement-message",
    ),
    path(
        "prospects/<int:prospect_id>/send/",
        SendPreparedEngagementView.as_view(),
        name="engagement-send",
    ),
    path(
        "prospects/<int:prospect_id>/logs/",
        ProspectLogsView.as_view(),
        name="engagement-logs",
    ),
    path(
        "prospects/<int:prospect_id>/analyze-social/",
        AnalyzeSocialProfileView.as_view(),
        name="engagement-analyze-social",
    ),
    path(
        "prospects/<int:prospect_id>/mark-replied/",
        MarkRepliedView.as_view(),
        name="engagement-mark-replied",
    ),
    path(
        "prospects/<int:prospect_id>/create-follow-up-task/",
        CreateFollowUpTaskView.as_view(),
        name="engagement-follow-up-task",
    ),
    path("campaigns/", EngagementCampaignsView.as_view(), name="engagement-campaigns"),
    path("facebook/open-session/", FacebookOpenSessionView.as_view(), name="engagement-facebook-open-session"),
    path("social-login/", SocialLoginView.as_view(), name="engagement-social-login"),
    path("social-session/check/", SocialSessionCheckView.as_view(), name="engagement-social-session-check"),
]
