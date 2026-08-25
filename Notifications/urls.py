# notifications/urls.py

from django.urls import path
from .views import (
    CRMEventAttentionView,
    CRMEventDetailView,
    CRMEventExportView,
    CRMEventListView,
    CRMEventStatsView,
    CRMEventSummaryView,
    HistoryLogListView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationCountView,
    NotificationDeleteView,
)

urlpatterns = [
    # Historique
    path("history/",        HistoryLogListView.as_view(),    name="history-list"),
    path("activity/",       CRMEventListView.as_view(),      name="activity-list"),
    path("activity/stats/", CRMEventStatsView.as_view(),     name="activity-stats"),
    path("activity/summary/", CRMEventSummaryView.as_view(), name="activity-summary"),
    path("activity/attention/", CRMEventAttentionView.as_view(), name="activity-attention"),
    path("activity/export/", CRMEventExportView.as_view(),   name="activity-export"),
    path("activity/<int:pk>/", CRMEventDetailView.as_view(), name="activity-detail"),

    # Notifications
    path("",                NotificationListView.as_view(),  name="notif-list"),
    path("count/",          NotificationCountView.as_view(), name="notif-count"),
    path("mark-read/",      NotificationMarkReadView.as_view(), name="notif-mark-read"),
    path("<int:pk>/delete/",NotificationDeleteView.as_view(), name="notif-delete"),
]


