from django.urls import path

from .views import (
    SocialSessionCheckView,
    SocialSessionDeleteView,
    SocialSessionListView,
    SocialSessionUploadView,
)

urlpatterns = [
    path("sessions/", SocialSessionListView.as_view(), name="social-session-list"),
    path("sessions/<str:platform>/upload/", SocialSessionUploadView.as_view(), name="social-session-upload"),
    path("sessions/<str:platform>/check/", SocialSessionCheckView.as_view(), name="social-session-check"),
    path("sessions/<str:platform>/", SocialSessionDeleteView.as_view(), name="social-session-delete"),
]
