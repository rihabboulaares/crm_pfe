# notifications/urls.py

from django.urls import path
from .views import (
    HistoryLogListView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationCountView,
    NotificationDeleteView,
)

urlpatterns = [
    # Historique
    path("history/",        HistoryLogListView.as_view(),    name="history-list"),

    # Notifications
    path("",                NotificationListView.as_view(),  name="notif-list"),
    path("count/",          NotificationCountView.as_view(), name="notif-count"),
    path("mark-read/",      NotificationMarkReadView.as_view(), name="notif-mark-read"),
    path("<int:pk>/delete/",NotificationDeleteView.as_view(), name="notif-delete"),
]


