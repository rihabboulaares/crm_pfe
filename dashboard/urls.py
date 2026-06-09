from django.urls import path

from .views import (
    AdminDashboardView,
    AgentsDashboardView,
    CommercialDashboardView,
    ManagerDashboardView,
    MapsDashboardView,
    RecommendationsDashboardView,
)


urlpatterns = [
    path("admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
    path("manager/", ManagerDashboardView.as_view(), name="dashboard-manager"),
    path("commercial/", CommercialDashboardView.as_view(), name="dashboard-commercial"),
    path("agents/", AgentsDashboardView.as_view(), name="dashboard-agents"),
    path("maps/", MapsDashboardView.as_view(), name="dashboard-maps"),
    path("recommendations/", RecommendationsDashboardView.as_view(), name="dashboard-recommendations"),
]
