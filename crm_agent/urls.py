from django.urls import path
from .views import AgentChatView, AgentFileView, AgentResetView, AgentStatusView

urlpatterns = [
    path("chat/",   AgentChatView.as_view()),
    path("file/",   AgentFileView.as_view()),   # ← nouveau
    path("reset/",  AgentResetView.as_view()),
    path("status/", AgentStatusView.as_view()),
]