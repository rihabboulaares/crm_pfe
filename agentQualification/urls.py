from django.urls import path

from .views import (
    ProspectQualificationHistoryView,
    ProspectQualificationLatestView,
    ProspectQualificationRunView,
    QualificationDetailView,
)

urlpatterns = [
    path("prospects/<int:prospect_id>/run/", ProspectQualificationRunView.as_view(), name="qualification-run"),
    path(
        "prospects/<int:prospect_id>/latest/",
        ProspectQualificationLatestView.as_view(),
        name="qualification-latest",
    ),
    path(
        "prospects/<int:prospect_id>/history/",
        ProspectQualificationHistoryView.as_view(),
        name="qualification-history",
    ),
    path("<int:qualification_id>/", QualificationDetailView.as_view(), name="qualification-detail"),
]

