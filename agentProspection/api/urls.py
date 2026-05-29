from django.urls import path
from .views import ProspectAgentView

urlpatterns = [
    path("prospect/", ProspectAgentView.as_view()),
]