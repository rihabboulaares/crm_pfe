# superadmin/urls.py  (version complète — toutes les tables)
from django.urls import path
from .views import (
    SuperAdminStatsView,
    # Plans
    SuperAdminPlanListCreateView,
    SuperAdminPlanDetailView,
    # Entreprises CRM
    SuperAdminCompanyListView,
    SuperAdminCompanyDetailView,
    SuperAdminAssignPlanView,
    SuperAdminToggleCompanyView,
    # Utilisateurs
    SuperAdminUserListView,
    SuperAdminUserDetailView,
    SuperAdminToggleUserView,
    # Équipes & Invitations
    SuperAdminTeamListView,
    SuperAdminInvitationListView,
    # Sales
    SuperAdminProspectCompanyListView,
    SuperAdminProspectListView,
    SuperAdminContactListView,
    SuperAdminOpportunityListView,
    SuperAdminTaskListView,
    SuperAdminTaskActivityListView,
    SuperAdminTaskCommentListView,
    SuperAdminDashboardGrowthView,
    SuperAdminCRMFunnelView,
    SuperAdminGeoStatsView,
    SuperAdminUsersPerformanceView,
    SuperAdminCompanyStatsView,
    SuperAdminProspectStatsView,
    SuperAdminOpportunityStatsView,
    SuperAdminTaskStatsView,
    SuperAdminContactStatsView,
    SuperAdminTeamStatsView,
    SuperAdminInvitationStatsView,
    SuperAdminAgentExecutionView,
    SuperAdminAIAgentRunListView,
    SuperAdminAIAgentStatsView,
    SuperAdminAuditLogListView,
    SuperAdminSystemHealthView,
)
from .views import (
    AcquisitionSourceView,
    AppRatingView,
    UserFeedbackView,
    TrackActivityView,
    MarketingDashboardView,
    AdminFeedbackView,
)

urlpatterns = [

    # ── Stats ─────────────────────────────────────────────────
    path("stats/",                          SuperAdminStatsView.as_view(),              name="sa-stats"),
    path("dashboard-growth/",               SuperAdminDashboardGrowthView.as_view(),    name="sa-dashboard-growth"),
    path("crm-funnel/",                     SuperAdminCRMFunnelView.as_view(),          name="sa-crm-funnel"),
    path("geo-stats/",                      SuperAdminGeoStatsView.as_view(),           name="sa-geo-stats"),
    path("users-performance/",              SuperAdminUsersPerformanceView.as_view(),   name="sa-users-performance"),
    path("companies/stats/",                SuperAdminCompanyStatsView.as_view(),       name="sa-companies-stats"),
    path("prospects/stats/",                SuperAdminProspectStatsView.as_view(),      name="sa-prospects-stats"),
    path("opportunities/stats/",            SuperAdminOpportunityStatsView.as_view(),   name="sa-opportunities-stats"),
    path("tasks/stats/",                    SuperAdminTaskStatsView.as_view(),          name="sa-tasks-stats"),
    path("contacts/stats/",                 SuperAdminContactStatsView.as_view(),       name="sa-contacts-stats"),
    path("teams/stats/",                    SuperAdminTeamStatsView.as_view(),          name="sa-teams-stats"),
    path("invitations/stats/",              SuperAdminInvitationStatsView.as_view(),    name="sa-invitations-stats"),
    path("agents/",                         SuperAdminAgentExecutionView.as_view(),     name="sa-agents"),
    path("ai-agents/",                      SuperAdminAIAgentRunListView.as_view(),     name="sa-ai-agents"),
    path("ai-agents/stats/",                SuperAdminAIAgentStatsView.as_view(),       name="sa-ai-agent-stats"),
    path("logs/",                           SuperAdminAuditLogListView.as_view(),       name="sa-logs"),
    path("audit-logs/",                     SuperAdminAuditLogListView.as_view(),       name="sa-audit-logs"),
    path("system-health/",                  SuperAdminSystemHealthView.as_view(),       name="sa-system-health"),

    # ── Plans ─────────────────────────────────────────────────
    path("plans/",                          SuperAdminPlanListCreateView.as_view(),     name="sa-plans"),
    path("plans/<int:pk>/",                 SuperAdminPlanDetailView.as_view(),         name="sa-plan-detail"),

    # ── Entreprises CRM ───────────────────────────────────────
    path("companies/",                      SuperAdminCompanyListView.as_view(),        name="sa-companies"),
    path("companies/<int:pk>/",             SuperAdminCompanyDetailView.as_view(),      name="sa-company-detail"),
    path("companies/<int:pk>/assign-plan/", SuperAdminAssignPlanView.as_view(),         name="sa-assign-plan"),
    path("companies/<int:pk>/toggle-subscription/", SuperAdminToggleCompanyView.as_view(), name="sa-toggle-sub"),

    # ── Utilisateurs ──────────────────────────────────────────
    path("users/",                          SuperAdminUserListView.as_view(),           name="sa-users"),
    path("users/<int:pk>/",                 SuperAdminUserDetailView.as_view(),         name="sa-user-detail"),
    path("users/<int:pk>/toggle-active/",   SuperAdminToggleUserView.as_view(),         name="sa-toggle-user"),

    # ── Équipes ───────────────────────────────────────────────
    path("teams/",                          SuperAdminTeamListView.as_view(),           name="sa-teams"),

    # ── Invitations ───────────────────────────────────────────
    path("invitations/",                    SuperAdminInvitationListView.as_view(),     name="sa-invitations"),

    # ── Sales — Entreprises prospects ─────────────────────────
    path("prospect-companies/",             SuperAdminProspectCompanyListView.as_view(), name="sa-prospect-companies"),

    # ── Sales — Prospects ─────────────────────────────────────
    path("prospects/",                      SuperAdminProspectListView.as_view(),       name="sa-prospects"),

    # ── Sales — Contacts ──────────────────────────────────────
    path("contacts/",                       SuperAdminContactListView.as_view(),        name="sa-contacts"),

    # ── Sales — Opportunités ──────────────────────────────────
    path("opportunities/",                  SuperAdminOpportunityListView.as_view(),    name="sa-opportunities"),

    # ── Sales — Tâches ────────────────────────────────────────
    path("tasks/",                          SuperAdminTaskListView.as_view(),           name="sa-tasks"),

    # ── Sales — Activités ─────────────────────────────────────
    path("task-activities/",                SuperAdminTaskActivityListView.as_view(),   name="sa-task-activities"),

    # ── Sales — Commentaires ──────────────────────────────────
    path("task-comments/",                  SuperAdminTaskCommentListView.as_view(),    name="sa-task-comments"),

path("acquisition-source/",  AcquisitionSourceView.as_view(),  name="acquisition-source"),
    path("rating/",              AppRatingView.as_view(),           name="app-rating"),
    path("feedback/",            UserFeedbackView.as_view(),        name="user-feedback"),
    path("track-activity/",      TrackActivityView.as_view(),       name="track-activity"),
 
    # ── SuperAdmin seulement ──────────────────────────────────
    path("marketing-dashboard/", MarketingDashboardView.as_view(),  name="marketing-dashboard"),
    path("feedbacks/",           AdminFeedbackView.as_view(),       name="admin-feedbacks"),
    path("feedbacks/<int:pk>/",  AdminFeedbackView.as_view(),       name="admin-feedback-detail"),

]
