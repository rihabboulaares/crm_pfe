from django.urls import path
from .views import PrepareEngagementView, SendPreparedEngagementView

urlpatterns = [
    path(
        "prospects/<int:prospect_id>/prepare/",
        PrepareEngagementView.as_view(),
        name="engagement-prepare",
    ),
    path(
        "prospects/<int:prospect_id>/send/",
        SendPreparedEngagementView.as_view(),
        name="engagement-send",
    ),
]