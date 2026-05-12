from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (
    AccountViewSet,
    ProspectCompanyViewSet,
    ProspectViewSet,
    OpportunityViewSet,
    ContactViewSet,
    TaskViewSet,
    TaskActivityViewSet,
    TaskCommentViewSet,
 
    MyKPIView,
    CommercialKPIView,
    TeamKPIDashboardView,
    MyPerformanceHistoryView,
    CommercialHistoryView,
    AlertsView,
    LeaderboardView,
    ManagerFeedbackViewSet,
    PerformanceGoalViewSet,
    CommercialBadgeViewSet,
)
from .views import (
   PipelineViewSet,
   PipelineStageViewSet,
    OpportunityPipelineViewSet,
    PipelineAlertViewSet,
    PipelineStageTaskViewSet, 
)
router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='accounts')
router.register(r'prospects', ProspectViewSet, basename='prospects')
router.register(r'prospect-companies', ProspectCompanyViewSet, basename='prospect-companies')
router.register(r'opportunities', OpportunityViewSet, basename='opportunities')
router.register(r'contacts', ContactViewSet, basename='contacts')
router.register(r"tasks", TaskViewSet, basename='tasks')
router.register(r"task-activities", TaskActivityViewSet, basename="task-activity")
router.register(r"task-comments", TaskCommentViewSet, basename="task-comment")
# Nouveaux — Performance
router.register(r"feedback",          ManagerFeedbackViewSet, basename="feedback")
router.register(r"goals",             PerformanceGoalViewSet, basename="goal")
router.register(r"badges",            CommercialBadgeViewSet, basename="badge")
 
router.register(r"pipelines",              PipelineViewSet,            basename="pipeline") 
router.register(r"pipeline-stages",        PipelineStageViewSet,       basename="pipeline-stage")
router.register(r"pipeline-stage-tasks",   PipelineStageTaskViewSet,   basename="pipeline-stage-task")  # NOUVEAU

router.register(r"opportunity-pipelines",  OpportunityPipelineViewSet, basename="opportunity-pipeline")
router.register(r"pipeline-alerts",        PipelineAlertViewSet,       basename="pipeline-alert")
# ─────────────────────────────────────────────
# URL PATTERNS
# ─────────────────────────────────────────────
urlpatterns = [
    # ── Router ──────────────────────────────
    path("", include(router.urls)),
 
    # ── KPI — Commercial connecté ────────────
    # GET /api/sales/kpi/me/
    # GET /api/sales/kpi/me/?year=2025&month=3
    path(
        "kpi/me/",
        MyKPIView.as_view(),
        name="kpi-me"
    ),
 
    # ── KPI — Un commercial spécifique (Manager/Admin) ──
    # GET /api/sales/kpi/1/
    path(
        "kpi/<int:user_id>/",
        CommercialKPIView.as_view(),
        name="kpi-commercial"
    ),
 
    # ── KPI — Dashboard équipe complète ─────
    # GET /api/sales/kpi/team/
    path(
        "kpi/team/",
        TeamKPIDashboardView.as_view(),
        name="kpi-team"
    ),
 
    # ── Leaderboard ─────────────────────────
    # GET /api/sales/kpi/leaderboard/
    # GET /api/sales/kpi/leaderboard/?year=2025&month=3
    path(
        "kpi/leaderboard/",
        LeaderboardView.as_view(),
        name="kpi-leaderboard"
    ),
 
    # ── Alertes ─────────────────────────────
    # GET /api/sales/kpi/alerts/
    path(
        "kpi/alerts/",
        AlertsView.as_view(),
        name="kpi-alerts"
    ),
 
    # ── Historique — Commercial connecté ────
    # GET /api/sales/kpi/history/
    # GET /api/sales/kpi/history/?months=6
    path(
        "kpi/history/",
        MyPerformanceHistoryView.as_view(),
        name="kpi-history-me"
    ),
 
    # ── Historique — Un commercial (Manager/Admin) ──
    # GET /api/sales/kpi/history/1/
    path(
        "kpi/history/<int:user_id>/",
        CommercialHistoryView.as_view(),
        name="kpi-history-commercial"
    ),
]