from django.urls import path

from .views import (
    CreateFollowUpTaskView,
    EngagementCampaignsView,
    EngagementDashboardView,
    EngagementProspectsView,
    MarkRepliedView,
    AnalyzeSocialProfileView,
    CheckProspectReplyView,
    LaunchEngagementAgentView,
    PrepareEngagementView,
    ProspectLogsView,
    ProspectMessageView,
    RejectPreparedEngagementView,
    SendPreparedEngagementView,
    SocialLoginView,
    SocialSessionCheckView,
    SocialSessionResetView,
)

urlpatterns = [
    path("dashboard/", EngagementDashboardView.as_view(), name="engagement-dashboard"),
    path("launch/", LaunchEngagementAgentView.as_view(), name="engagement-launch"),
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
        "prospects/<int:prospect_id>/reject/",
        RejectPreparedEngagementView.as_view(),
        name="engagement-reject",
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
        "prospects/<int:prospect_id>/check-reply/",
        CheckProspectReplyView.as_view(),
        name="engagement-check-reply",
    ),
    path(
        "prospects/<int:prospect_id>/create-follow-up-task/",
        CreateFollowUpTaskView.as_view(),
        name="engagement-follow-up-task",
    ),
    path("campaigns/", EngagementCampaignsView.as_view(), name="engagement-campaigns"),
    path("social-login/", SocialLoginView.as_view(), name="engagement-social-login"),
    path("social-session/check/", SocialSessionCheckView.as_view(), name="engagement-social-session-check"),
    path("social-session/reset/", SocialSessionResetView.as_view(), name="engagement-social-session-reset"),
]
