# agentProspection/urls.py
from django.urls import path
from .views import RechercherView, ImporterView

urlpatterns = [
    path("rechercher/", RechercherView.as_view()),
    path("importer/",   ImporterView.as_view()),
]