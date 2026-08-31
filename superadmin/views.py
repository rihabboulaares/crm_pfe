# superadmin/views.py  (version complète — toutes les tables)
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status, filters
from rest_framework.pagination import PageNumberPagination
from django.db.models import Sum, Count, Q, Avg, Max
from django.utils import timezone
from datetime import timedelta
from time import perf_counter
import os

from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models.functions import TruncMonth, TruncDate
from django.core.cache import cache


from .models import (
    UserAcquisitionSource,
    AppRating,
    UserFeedback,
    UserActivity,
    SuperAdminAuditLog,
    AIAgentRun,
    SystemHealthLog,
)
from .serializers import (
    AcquisitionSourceSerializer, AppRatingSerializer,
    UserFeedbackSerializer, UserActivitySerializer,
)
from users.models import User, Company
from subscriptions.models import CompanySubscription

from users.models import User, Company, Team, Invitation
from subscriptions.models import SubscriptionPlan, CompanySubscription
from sales.models import (
    Prospect, ProspectCompany, Contact,
    Opportunity, Task, TaskActivity, TaskComment, Account,
)

from .permissions import IsSuperAdmin
from .audit import backfill_agent_runs_from_existing_activity, backfill_audit_logs_from_existing_activity, create_audit_log
from .serializers import (
    SuperAdminPlanSerializer,
    SuperAdminSubscriptionSerializer,
    SuperAdminCompanyListSerializer,
    SuperAdminCompanyDetailSerializer,
    SuperAdminUserSerializer,
    SuperAdminTeamSerializer,
    SuperAdminInvitationSerializer,
    SuperAdminProspectCompanySerializer,
    SuperAdminProspectSerializer,
    SuperAdminContactSerializer,
    SuperAdminOpportunitySerializer,
    SuperAdminTaskSerializer,
    SuperAdminTaskActivitySerializer,
    SuperAdminTaskCommentSerializer,
    SuperAdminStatsSerializer,
    AIAgentRunSerializer,
    SuperAdminAuditLogSerializer,
    SystemHealthLogSerializer,
)


# ── Pagination ────────────────────────────────────────────────
class SuperAdminPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 100


# =====================================================
# STATS GLOBALES
# GET /api/superadmin/stats/
# =====================================================
class SuperAdminStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today = timezone.now().date()
        first_day = today.replace(day=1)

        subs = CompanySubscription.objects.select_related("plan")

        total_revenue = (
            subs.filter(is_active=True, is_trial=False)
            .aggregate(total=Sum("plan__price"))["total"] or 0
        )

        companies_by_plan = {}
        for row in subs.filter(is_active=True).values("plan__name").annotate(count=Count("id")):
            companies_by_plan[row["plan__name"] or "sans plan"] = row["count"]
        ai_runs = AIAgentRun.objects.all()
        avg_rating = AppRating.objects.aggregate(v=Avg("rating"))["v"] or 0
        active_users_today = UserActivity.objects.filter(created_at__date=today).values("user").distinct().count()
        active_users_week = UserActivity.objects.filter(
            created_at__date__gte=today - timedelta(days=7)
        ).values("user").distinct().count()
        module_labels = dict(UserActivity.MODULE_CHOICES)
        recent_user_activities = [
            {
                "id": activity.id,
                "module": activity.module,
                "module_label": module_labels.get(activity.module, activity.module),
                "action": activity.action,
                "created_at": activity.created_at,
                "username": activity.user.username if activity.user else "",
                "email": activity.user.email if activity.user else "",
                "company_name": activity.user.company.name if activity.user and activity.user.company else "",
            }
            for activity in UserActivity.objects.select_related("user", "user__company").order_by("-created_at")[:8]
        ]
        recent_agent_runs = [
            {
                "id": run.id,
                "agent_type": run.agent_type,
                "status": run.status,
                "query": run.query or "",
                "company_name": run.company.name if run.company else "",
                "launched_by": run.launched_by.username if run.launched_by else "",
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "duration_seconds": run.duration_seconds,
                "error_message": run.error_message or "",
            }
            for run in ai_runs.select_related("company", "launched_by").order_by("-started_at")[:8]
        ]
        supervision_alerts = []
        if data_expired := subs.filter(is_active=False).count():
            supervision_alerts.append({
                "severity": "error",
                "title": "Abonnements expirés",
                "message": f"{data_expired} entreprise(s) nécessitent une action commerciale.",
            })
        if failed_runs := ai_runs.filter(status="failed").count():
            supervision_alerts.append({
                "severity": "warning",
                "title": "Runs IA échoués",
                "message": f"{failed_runs} exécution(s) d'agent sont en échec.",
            })
        if new_feedbacks := UserFeedback.objects.filter(status="new").count():
            supervision_alerts.append({
                "severity": "info",
                "title": "Feedbacks à traiter",
                "message": f"{new_feedbacks} retour(s) utilisateur attendent une revue.",
            })

        data = {
            "total_companies":          Company.objects.count(),
            "total_users":              User.objects.exclude(Q(is_superuser=True) | Q(role="SUPERADMIN")).count(),
            "active_subscriptions":     subs.filter(is_active=True, is_trial=False).count(),
            "trial_subscriptions":      subs.filter(is_active=True, is_trial=True).count(),
            "expired_subscriptions":    subs.filter(is_active=False).count(),
            "total_revenue_monthly":    float(total_revenue),
            "companies_by_plan":        companies_by_plan,
            "new_companies_this_month": Company.objects.filter(created_at__date__gte=first_day).count(),
            "total_prospects":          Prospect.objects.count(),
            "total_contacts":           Contact.objects.count(),
            "total_opportunities":      Opportunity.objects.count(),
            "total_tasks":              Task.objects.count(),
            "total_teams":              Team.objects.count(),
            "total_activities":         TaskActivity.objects.count() + UserActivity.objects.count(),
            "total_feedbacks":          UserFeedback.objects.count(),
            "avg_rating":               round(float(avg_rating), 2),
            "ai_total_runs":            ai_runs.count(),
            "ai_success_runs":          ai_runs.filter(status="success").count(),
            "ai_failed_runs":           ai_runs.filter(status="failed").count(),
            "ai_prospects_found":       ai_runs.aggregate(v=Sum("prospects_found"))["v"] or 0,
            "ai_prospects_imported":    ai_runs.aggregate(v=Sum("prospects_imported"))["v"] or 0,
            "ai_messages_generated":    ai_runs.aggregate(v=Sum("messages_generated"))["v"] or 0,
            "ai_messages_sent":         ai_runs.aggregate(v=Sum("messages_sent"))["v"] or 0,
            "ai_replies_detected":      ai_runs.aggregate(v=Sum("replies_detected"))["v"] or 0,
            "active_users_today":       active_users_today,
            "active_users_week":        active_users_week,
            "recent_user_activities":   recent_user_activities,
            "recent_agent_runs":        recent_agent_runs,
            "supervision_alerts":       supervision_alerts,
        }

        return Response(SuperAdminStatsSerializer(data).data)


# =====================================================
# PACKS D'ABONNEMENT
# =====================================================
class SuperAdminPlanListCreateView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by("price")
        return Response(SuperAdminPlanSerializer(plans, many=True).data)

    def post(self, request):
        serializer = SuperAdminPlanSerializer(data=request.data)
        if serializer.is_valid():
            plan = serializer.save()
            create_audit_log(request.user, None, "create", "plans", plan.id, plan.name, "Plan cree", serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=400)


class SuperAdminPlanDetailView(APIView):
    permission_classes = [IsSuperAdmin]

    def _get(self, pk):
        try:
            return SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return None

    def get(self, request, pk):
        plan = self._get(pk)
        if not plan:
            return Response({"error": "Plan introuvable"}, status=404)
        return Response(SuperAdminPlanSerializer(plan).data)

    def put(self, request, pk):
        plan = self._get(pk)
        if not plan:
            return Response({"error": "Plan introuvable"}, status=404)
        s = SuperAdminPlanSerializer(plan, data=request.data, partial=True)
        if s.is_valid():
            s.save()
            create_audit_log(request.user, None, "update", "plans", plan.id, plan.name, "Plan modifie", request.data)
            return Response(s.data)
        return Response(s.errors, status=400)

    def delete(self, request, pk):
        plan = self._get(pk)
        if not plan:
            return Response({"error": "Plan introuvable"}, status=404)
        active = CompanySubscription.objects.filter(plan=plan, is_active=True).count()
        if active > 0:
            return Response({"error": f"Plan utilisé par {active} entreprise(s) active(s)"}, status=400)
        create_audit_log(request.user, None, "delete", "plans", plan.id, plan.name, "Plan supprime")
        plan.delete()
        return Response({"message": "Plan supprimé"}, status=204)


# =====================================================
# ENTREPRISES
# =====================================================
class SuperAdminCompanyListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminCompanyListSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "owner__email", "owner__username", "country", "industry"]
    ordering_fields    = ["name", "created_at", "number_of_employees"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Company.objects.select_related("owner", "subscription", "subscription__plan").prefetch_related("users")
        plan = self.request.query_params.get("plan")
        if plan:
            qs = qs.filter(subscription__plan__name=plan)
        is_active = self.request.query_params.get("is_active")
        if is_active == "true":
            qs = qs.filter(subscription__is_active=True)
        elif is_active == "false":
            qs = qs.filter(Q(subscription__is_active=False) | Q(subscription__isnull=True))
        return qs


class SuperAdminCompanyDetailView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        try:
            company = Company.objects.select_related("owner", "subscription", "subscription__plan").get(pk=pk)
        except Company.DoesNotExist:
            return Response({"error": "Entreprise introuvable"}, status=404)

        users = User.objects.filter(company=company).exclude(Q(is_superuser=True) | Q(role="SUPERADMIN"))
        teams = Team.objects.filter(company=company)

        return Response({
            "company":  SuperAdminCompanyDetailSerializer(company).data,
            "users":    SuperAdminUserSerializer(users, many=True).data,
            "teams":    SuperAdminTeamSerializer(teams, many=True).data,
        })

    def patch(self, request, pk):
        try:
            company = Company.objects.get(pk=pk)
        except Company.DoesNotExist:
            return Response({"error": "Entreprise introuvable"}, status=404)
        changed = {}
        for field in ["name", "industry", "country", "city", "phone_number", "number_of_employees", "founded_year"]:
            if field in request.data:
                changed[field] = {"old": getattr(company, field, None), "new": request.data[field]}
                setattr(company, field, request.data[field])
        company.save()
        if changed:
            create_audit_log(request.user, company, "update", "companies", company.id, company.name, "Entreprise modifiee", changed)
        return Response(SuperAdminCompanyDetailSerializer(company).data)


class SuperAdminAssignPlanView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            company = Company.objects.get(pk=pk)
        except Company.DoesNotExist:
            return Response({"error": "Entreprise introuvable"}, status=404)

        plan_id      = request.data.get("plan_id")
        duration_days = int(request.data.get("duration_days", 30))

        if not plan_id:
            return Response({"error": "plan_id requis"}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(pk=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan introuvable"}, status=404)

        today = timezone.now().date()
        sub, _ = CompanySubscription.objects.update_or_create(
            company=company,
            defaults={
                "plan": plan,
                "start_date": today,
                "end_date": today + timedelta(days=duration_days),
                "is_active": True,
                "is_trial": False,
                "cancelled_at": None,
            },
        )
        create_audit_log(request.user, company, "subscription_change", "companies", company.id, company.name, f"Plan {plan.name} assigne", {"plan_id": plan.id, "duration_days": duration_days})
        return Response({
            "message": f"Plan '{plan.name}' assigné à '{company.name}'",
            "subscription": SuperAdminSubscriptionSerializer(sub).data,
        })


class SuperAdminToggleCompanyView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            company = Company.objects.get(pk=pk)
        except Company.DoesNotExist:
            return Response({"error": "Entreprise introuvable"}, status=404)
        sub = getattr(company, "subscription", None)
        if not sub:
            return Response({"error": "Aucun abonnement"}, status=404)
        sub.is_active = not sub.is_active
        sub.cancelled_at = None if sub.is_active else timezone.now().date()
        sub.save(update_fields=["is_active", "cancelled_at"])
        create_audit_log(request.user, company, "toggle_company", "companies", company.id, company.name, "Abonnement bascule", {"is_active": sub.is_active})
        return Response({"message": f"Abonnement {'activé' if sub.is_active else 'désactivé'}", "is_active": sub.is_active})


# =====================================================
# UTILISATEURS
# =====================================================
class SuperAdminUserListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminUserSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["email", "username", "company__name"]
    ordering_fields    = ["email", "username", "role", "is_active"]
    ordering           = ["email"]

    def get_queryset(self):
        qs = User.objects.select_related("company").exclude(Q(is_superuser=True) | Q(role="SUPERADMIN"))
        if role := self.request.query_params.get("role"):
            qs = qs.filter(role=role)
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        if is_active := self.request.query_params.get("is_active"):
            qs = qs.filter(is_active=(is_active == "true"))
        return qs


class SuperAdminUserDetailView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        try:
            user = User.objects.select_related("company").get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)
        return Response(SuperAdminUserSerializer(user).data)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)
        if user.is_superuser or user.role == "SUPERADMIN":
            return Response({"error": "Impossible de modifier un Super Admin."}, status=403)
        for field in ["is_active", "role"]:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        create_audit_log(request.user, user.company, "update", "users", user.id, user.email, "Utilisateur modifie", request.data)
        return Response(SuperAdminUserSerializer(user).data)


class SuperAdminToggleUserView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)
        if user.is_superuser or user.role == "SUPERADMIN":
            return Response({"error": "Impossible de désactiver un Super Admin."}, status=403)
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        create_audit_log(request.user, user.company, "toggle_user", "users", user.id, user.email, "Utilisateur bascule", {"is_active": user.is_active})
        return Response({"message": f"Compte {'activé' if user.is_active else 'désactivé'}", "is_active": user.is_active})


# =====================================================
# ÉQUIPES
# =====================================================
class SuperAdminTeamListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminTeamSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "company__name", "owner__email"]
    ordering           = ["company__name", "name"]

    def get_queryset(self):
        qs = Team.objects.select_related("company", "owner").prefetch_related("members")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        return qs


# =====================================================
# INVITATIONS
# =====================================================
class SuperAdminInvitationListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminInvitationSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["email", "team__company__name"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Invitation.objects.select_related("team", "team__company", "invited_by")
        if accepted := self.request.query_params.get("accepted"):
            qs = qs.filter(accepted=(accepted == "true"))
        return qs


# =====================================================
# ENTREPRISES PROSPECTS
# =====================================================
class SuperAdminProspectCompanyListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminProspectCompanySerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "industry", "company__name"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = ProspectCompany.objects.select_related("company").prefetch_related("prospects")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        return qs


# =====================================================
# PROSPECTS
# =====================================================
class SuperAdminProspectListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminProspectSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["first_name", "last_name", "email", "company__name"]
    ordering_fields    = ["created_at", "status", "evaluation"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Prospect.objects.select_related("company", "prospect_company", "assigned_to")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        if status_filter := self.request.query_params.get("status"):
            qs = qs.filter(status=status_filter)
        return qs


# =====================================================
# CONTACTS
# =====================================================
class SuperAdminContactListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminContactSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["first_name", "last_name", "email", "company__name"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Contact.objects.select_related("company", "account")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        return qs


# =====================================================
# OPPORTUNITÉS
# =====================================================
class SuperAdminOpportunityListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminOpportunitySerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["name", "company__name", "assigned_to__username"]
    ordering_fields    = ["amount", "created_at", "stage"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Opportunity.objects.select_related("company", "assigned_to", "prospect", "contact")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        if stage := self.request.query_params.get("stage"):
            qs = qs.filter(stage=stage)
        return qs


# =====================================================
# TÂCHES
# =====================================================
class SuperAdminTaskListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminTaskSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["title", "company__name", "assigned_to__username"]
    ordering_fields    = ["created_at", "status", "priority", "due_date"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = Task.objects.select_related("company", "assigned_to", "created_by")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company__id=company_id)
        if status_filter := self.request.query_params.get("status"):
            qs = qs.filter(status=status_filter)
        return qs


# =====================================================
# ACTIVITÉS DE TÂCHES
# =====================================================
class SuperAdminTaskActivityListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminTaskActivitySerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["task__title", "performed_by__username", "task__company__name"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = TaskActivity.objects.select_related("task", "task__company", "performed_by")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(task__company__id=company_id)
        if activity_type := self.request.query_params.get("activity_type"):
            qs = qs.filter(activity_type=activity_type)
        return qs


# =====================================================
# COMMENTAIRES DE TÂCHES
# =====================================================
class SuperAdminTaskCommentListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class   = SuperAdminTaskCommentSerializer
    pagination_class   = SuperAdminPagination
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["task__title", "author__username", "content"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        qs = TaskComment.objects.select_related("task", "task__company", "author")
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(task__company__id=company_id)
        return qs
    

# superadmin/views.py (partie marketing)

def is_superadmin(user):
    return user.is_staff or user.is_superuser or user.role == "SUPERADMIN"


# ══════════════════════════════════════════════════════════════
# SOURCE D'ACQUISITION
# ══════════════════════════════════════════════════════════════
class AcquisitionSourceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            source = request.user.acquisition_source
            return Response(AcquisitionSourceSerializer(source).data)
        except UserAcquisitionSource.DoesNotExist:
            return Response(None)

    def post(self, request):
        source_val = request.data.get("source")
        if not source_val:
            return Response({"error": "Source manquante"}, status=400)

        obj, created = UserAcquisitionSource.objects.update_or_create(
            user=request.user,
            defaults={"source": source_val},
        )
        return Response(AcquisitionSourceSerializer(obj).data,
                        status=201 if created else 200)


# ══════════════════════════════════════════════════════════════
# RATING
# ══════════════════════════════════════════════════════════════
class AppRatingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            rating = request.user.app_rating
            return Response(AppRatingSerializer(rating).data)
        except AppRating.DoesNotExist:
            return Response(None)

    def post(self, request):
        rating_val = request.data.get("rating")
        comment = request.data.get("comment", "")

        if not rating_val or int(rating_val) not in range(1, 6):
            return Response({"error": "Note invalide (1-5)"}, status=400)

        obj, created = AppRating.objects.update_or_create(
            user=request.user,
            defaults={"rating": int(rating_val), "comment": comment},
        )
        return Response(AppRatingSerializer(obj).data,
                        status=201 if created else 200)


# ══════════════════════════════════════════════════════════════
# FEEDBACK
# ══════════════════════════════════════════════════════════════
class UserFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        feedbacks = UserFeedback.objects.filter(user=request.user)
        return Response(UserFeedbackSerializer(feedbacks, many=True).data)

    def post(self, request):
        message = request.data.get("message", "").strip()
        category = request.data.get("category", "general")

        if not message:
            return Response({"error": "Message manquant"}, status=400)

        feedback = UserFeedback.objects.create(
            user=request.user,
            message=message,
            category=category,
        )
        return Response(UserFeedbackSerializer(feedback).data, status=201)


# ══════════════════════════════════════════════════════════════
# TRACKER D'ACTIVITÉ
# ══════════════════════════════════════════════════════════════
class TrackActivityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        module = str(request.data.get("module") or "").strip().lower()
        action = str(request.data.get("action") or "").strip()

        valid_modules = [m[0] for m in UserActivity.MODULE_CHOICES]
        if not module:
            return Response({"error": "Module manquant"}, status=400)
        if module not in valid_modules:
            action = action or f"visited_{module}"
            module = "other"

        UserActivity.objects.create(
            user=request.user,
            module=module,
            action=action[:100],
        )
        return Response({"message": "Activité enregistrée"})


# ══════════════════════════════════════════════════════════════
# DASHBOARD MARKETING — SuperAdmin seulement
# ══════════════════════════════════════════════════════════════
class MarketingDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_superadmin(request.user):
            return Response({"error": "Accès refusé"}, status=403)

        today = timezone.now().date()

        # ── 1. Stats rapides ──────────────────────────────────
        total_users     = User.objects.filter(is_staff=False).count()
        total_companies = Company.objects.count()

        # ✅ Utiliser UserAcquisitionSource.created_at pour le mois courant
        # (pas de date_joined sur le modèle User)
        new_this_month = UserAcquisitionSource.objects.filter(
            created_at__month=today.month,
            created_at__year=today.year,
        ).count()

        avg_rating_data = AppRating.objects.aggregate(avg=Avg("rating"))
        avg_rating = round(avg_rating_data["avg"], 1) if avg_rating_data["avg"] else 0
        total_ratings = AppRating.objects.count()

        # ── 2. Sources d'acquisition ─────────────────────────
        sources = (
            UserAcquisitionSource.objects
            .values("source")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        total_sources = sum(s["count"] for s in sources)
        acquisition_data = [
            {
                "source": s["source"],
                "label": dict(UserAcquisitionSource.SOURCE_CHOICES).get(s["source"], s["source"]),
                "count": s["count"],
                "percentage": round((s["count"] / total_sources * 100), 1) if total_sources else 0,
            }
            for s in sources
        ]

        # ── 3. Distribution des ratings ──────────────────────
        ratings_dist = (
            AppRating.objects
            .values("rating")
            .annotate(count=Count("id"))
            .order_by("-rating")
        )
        ratings_data = [
            {
                "stars": r["rating"],
                "count": r["count"],
                "percentage": round((r["count"] / total_ratings * 100), 1) if total_ratings else 0,
            }
            for r in ratings_dist
        ]

        # ── 4. Feedbacks récents ──────────────────────────────
        feedbacks = UserFeedback.objects.select_related(
            "user__company"
        ).order_by("-created_at")[:10]
        feedbacks_data = UserFeedbackSerializer(feedbacks, many=True).data

        feedback_stats = UserFeedback.objects.values("status").annotate(count=Count("id"))
        feedback_status = {f["status"]: f["count"] for f in feedback_stats}

        # ── 5. Croissance utilisateurs (via acquisitions) ────
        # ✅ Utilise UserAcquisitionSource.created_at
        growth_data = []
        for i in range(11, -1, -1):
            month_date = (today.replace(day=1) - timedelta(days=i * 30))
            count = UserAcquisitionSource.objects.filter(
                created_at__year=month_date.year,
                created_at__month=month_date.month,
            ).count()
            growth_data.append({
                "month": month_date.strftime("%b %Y"),
                "count": count,
            })

        # ── 6. Modules les plus utilisés ─────────────────────
        modules_usage = (
            UserActivity.objects
            .values("module")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        total_activities = sum(m["count"] for m in modules_usage)
        modules_data = [
            {
                "module": m["module"],
                "label": dict(UserActivity.MODULE_CHOICES).get(m["module"], m["module"]),
                "count": m["count"],
                "percentage": round((m["count"] / total_activities * 100), 1) if total_activities else 0,
            }
            for m in modules_usage
        ]

        # ── 7. Utilisateurs actifs ────────────────────────────
        active_today = UserActivity.objects.filter(
            created_at__date=today
        ).values("user").distinct().count()

        active_week = UserActivity.objects.filter(
            created_at__date__gte=today - timedelta(days=7)
        ).values("user").distinct().count()

        # ── 8. Analyse géographique ───────────────────────────
        # ✅ Utilise le champ "country" qui existe sur User
        geo_data = (
            User.objects.filter(
                is_staff=False,
                country__isnull=False
            )
            .exclude(country="")
            .values("country")
            .annotate(count=Count("id"))
            .order_by("-count")[:7]
        )
        total_geo = sum(g["count"] for g in geo_data)
        geography_data = [
            {
                "country": g["country"],
                "count": g["count"],
                "percentage": round((g["count"] / total_geo * 100), 1) if total_geo else 0,
            }
            for g in geo_data
        ]

        # ── 9. Top entreprises actives ────────────────────────
        top_companies = (
            UserActivity.objects
            .filter(created_at__date__gte=today - timedelta(days=30))
            .values("user__company__name")
            .annotate(actions=Count("id"))
            .exclude(user__company__name=None)
            .order_by("-actions")[:5]
        )
        top_companies_data = [
            {"company": t["user__company__name"], "actions": t["actions"]}
            for t in top_companies
        ]

        return Response({
            "quick_stats": {
                "total_users":     total_users,
                "total_companies": total_companies,
                "new_this_month":  new_this_month,
                "avg_rating":      avg_rating,
                "total_ratings":   total_ratings,
                "active_today":    active_today,
                "active_week":     active_week,
                "inactive_users":  max(total_users - active_week, 0),
            },
            "acquisition_sources":  acquisition_data,
            "ratings_distribution": ratings_data,
            "user_growth":          growth_data,
            "modules_usage":        modules_data,
            "geography":            geography_data,
            "top_companies":        top_companies_data,
            "recent_feedbacks":     feedbacks_data,
            "feedback_status":      feedback_status,
        })


# ══════════════════════════════════════════════════════════════
# GESTION FEEDBACKS — SuperAdmin
# ══════════════════════════════════════════════════════════════
class AdminFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_superadmin(request.user):
            return Response({"error": "Accès refusé"}, status=403)

        status_filter   = request.query_params.get("status")
        category_filter = request.query_params.get("category")

        qs = UserFeedback.objects.select_related(
            "user__company"
        ).order_by("-created_at")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if category_filter:
            qs = qs.filter(category=category_filter)

        return Response(UserFeedbackSerializer(qs, many=True).data)

    def patch(self, request, pk):
        if not is_superadmin(request.user):
            return Response({"error": "Accès refusé"}, status=403)

        try:
            feedback = UserFeedback.objects.get(pk=pk)
        except UserFeedback.DoesNotExist:
            return Response({"error": "Feedback introuvable"}, status=404)

        new_status     = request.data.get("status")
        admin_response = request.data.get("admin_response", "")

        if new_status:
            feedback.status = new_status
        if admin_response:
            feedback.admin_response = admin_response
        feedback.save()
        create_audit_log(request.user, getattr(feedback.user, "company", None), "update", "feedbacks", feedback.id, feedback.user.email, "Feedback modifie", request.data)

        return Response(UserFeedbackSerializer(feedback).data)


def _pct(part, total):
    return round((part / total) * 100, 2) if total else 0


def _sum(qs, field):
    return qs.aggregate(v=Sum(field))["v"] or 0


def _bool_param(value):
    return str(value).lower() in ("1", "true", "yes")


CITY_COORDS = {
    "tunis": (36.8065, 10.1815),
    "sfax": (34.7406, 10.7603),
    "sousse": (35.8256, 10.6369),
    "nabeul": (36.4513, 10.7357),
    "monastir": (35.7643, 10.8113),
    "ariana": (36.8665, 10.1647),
    "ben arous": (36.7531, 10.2189),
    "bizerte": (37.2744, 9.8739),
    "gabes": (33.8815, 10.0982),
    "kairouan": (35.6781, 10.0963),
}


class SuperAdminDashboardGrowthView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        today = timezone.now().date().replace(day=1)
        rows = []
        for i in range(11, -1, -1):
            month = (today - timedelta(days=i * 31)).replace(day=1)
            next_month = (month + timedelta(days=32)).replace(day=1)
            month_filter = {"created_at__date__gte": month, "created_at__date__lt": next_month}
            revenue = CompanySubscription.objects.filter(
                start_date__gte=month,
                start_date__lt=next_month,
                is_active=True,
                is_trial=False,
            ).aggregate(v=Sum("plan__price"))["v"] or 0
            rows.append({
                "month": month.strftime("%b %Y"),
                "companies": Company.objects.filter(**month_filter).count(),
                "users": UserAcquisitionSource.objects.filter(**month_filter).count(),
                "prospects": Prospect.objects.filter(**month_filter).count(),
                "opportunities": Opportunity.objects.filter(**month_filter).count(),
                "revenue": float(revenue),
            })
        return Response(rows)


class SuperAdminCRMFunnelView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        prospects = Prospect.objects.count()
        contacted = Prospect.objects.filter(status="contacted").count()
        qualified = Prospect.objects.filter(status="qualified").count()
        opportunities = Opportunity.objects.count()
        won = Opportunity.objects.filter(stage="won").count()
        return Response({
            "prospects": prospects,
            "contacted": contacted,
            "qualified": qualified,
            "opportunities": opportunities,
            "won": won,
            "conversion_prospect_to_opportunity": _pct(opportunities, prospects),
            "conversion_opportunity_to_won": _pct(won, opportunities),
        })


class SuperAdminGeoStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        rows = {}
        for company in Company.objects.all():
            country = company.country or "Unknown"
            city = company.city or "Unknown"
            key = (country, city)
            rows.setdefault(key, {"country": country, "city": city, "companies_count": 0, "users_count": 0, "prospects_count": 0, "opportunities_count": 0})
            rows[key]["companies_count"] += 1
        for row in User.objects.values("country", "city").annotate(count=Count("id")):
            key = (row["country"] or "Unknown", row["city"] or "Unknown")
            rows.setdefault(key, {"country": key[0], "city": key[1], "companies_count": 0, "users_count": 0, "prospects_count": 0, "opportunities_count": 0})
            rows[key]["users_count"] += row["count"]
        for model, field in [(Prospect, "prospects_count"), (Opportunity, "opportunities_count")]:
            for row in model.objects.values("company__country", "company__city").annotate(count=Count("id")):
                key = (row["company__country"] or "Unknown", row["company__city"] or "Unknown")
                rows.setdefault(key, {"country": key[0], "city": key[1], "companies_count": 0, "users_count": 0, "prospects_count": 0, "opportunities_count": 0})
                rows[key][field] += row["count"]
        data = []
        for item in rows.values():
            lat, lng = CITY_COORDS.get((item["city"] or "").lower(), (None, None))
            data.append({**item, "lat": lat, "lng": lng})
        return Response(sorted(data, key=lambda x: (x["companies_count"], x["users_count"]), reverse=True))


class SuperAdminUsersPerformanceView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        data = []
        users = User.objects.select_related("company").exclude(Q(is_superuser=True) | Q(role="SUPERADMIN"))
        for user in users:
            prospects_count = Prospect.objects.filter(assigned_to=user).count()
            opportunities_count = Opportunity.objects.filter(assigned_to=user).count()
            won_count = Opportunity.objects.filter(assigned_to=user, stage="won").count()
            data.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "company_name": user.company.name if user.company else None,
                "prospects_count": prospects_count,
                "opportunities_count": opportunities_count,
                "tasks_count": Task.objects.filter(assigned_to=user).count(),
                "activities_count": TaskActivity.objects.filter(performed_by=user).count(),
                "conversion_rate": _pct(won_count, opportunities_count),
                "last_activity_at": UserActivity.objects.filter(user=user).aggregate(v=Max("created_at"))["v"],
            })
        return Response(data)


class SuperAdminCompanyStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response({
            "total_companies": Company.objects.count(),
            "active_companies": Company.objects.filter(subscription__is_active=True).count(),
            "inactive_companies": Company.objects.filter(Q(subscription__is_active=False) | Q(subscription__isnull=True)).count(),
            "trial_companies": Company.objects.filter(subscription__is_trial=True, subscription__is_active=True).count(),
            "total_users": User.objects.exclude(Q(is_superuser=True) | Q(role="SUPERADMIN")).count(),
            "total_prospects": Prospect.objects.count(),
            "total_opportunities": Opportunity.objects.count(),
            "total_tasks": Task.objects.count(),
        })


class SuperAdminProspectStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Prospect.objects.all()
        by_origin = list(qs.values("origin").annotate(count=Count("id")).order_by("-count"))
        by_company = list(qs.values("company__name").annotate(count=Count("id")).order_by("-count")[:10])
        return Response({
            "total": qs.count(),
            "new": qs.filter(status="new").count(),
            "contacted": qs.filter(status="contacted").count(),
            "qualified": qs.filter(status="qualified").count(),
            "won": qs.filter(status="won").count(),
            "lost": qs.filter(status="lost").count(),
            "hot": qs.filter(evaluation="hot").count(),
            "warm": qs.filter(evaluation="warm").count(),
            "cold": qs.filter(evaluation="cold").count(),
            "assigned": qs.filter(assigned_to__isnull=False).count(),
            "unassigned": qs.filter(assigned_to__isnull=True).count(),
            "by_origin": by_origin,
            "by_company": by_company,
        })


class SuperAdminOpportunityStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Opportunity.objects.all()
        total = qs.count()
        won = qs.filter(stage="won")
        return Response({
            "total": total,
            "total_amount": float(qs.aggregate(v=Sum("amount"))["v"] or 0),
            "won_amount": float(won.aggregate(v=Sum("amount"))["v"] or 0),
            "lost_amount": float(qs.filter(stage="lost").aggregate(v=Sum("amount"))["v"] or 0),
            "new": qs.filter(stage="new").count(),
            "qualified": qs.filter(stage="qualified").count(),
            "proposal": qs.filter(stage="proposal").count(),
            "negotiation": qs.filter(stage="negotiation").count(),
            "won": won.count(),
            "lost": qs.filter(stage="lost").count(),
            "conversion_rate": _pct(won.count(), total),
            "by_company": list(qs.values("company__name").annotate(count=Count("id"), amount=Sum("amount")).order_by("-amount")[:10]),
            "top_users": list(qs.values("assigned_to__username").annotate(count=Count("id"), amount=Sum("amount")).order_by("-amount")[:10]),
        })


class SuperAdminTaskStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Task.objects.all()
        now = timezone.now()
        return Response({
            "total": qs.count(),
            "todo": qs.filter(status="todo").count(),
            "in_progress": qs.filter(status="in_progress").count(),
            "done": qs.filter(Q(status="done") | Q(status="completed")).count(),
            "cancelled": qs.filter(status="cancelled").count(),
            "high": qs.filter(priority="high").count(),
            "medium": qs.filter(priority="medium").count(),
            "low": qs.filter(priority="low").count(),
            "quota": qs.filter(task_type="quota").count(),
            "overdue": qs.filter(due_date__lt=now).exclude(status__in=["done", "completed", "cancelled"]).count(),
            "ai_created": qs.filter(Q(source__icontains="agent") | Q(created_by__isnull=True)).count(),
            "human_created": qs.filter(created_by__isnull=False).exclude(source__icontains="agent").count(),
        })


class SuperAdminContactStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Contact.objects.all()
        return Response({
            "total_contacts": qs.count(),
            "with_account": qs.filter(account__isnull=False).count(),
            "without_account": qs.filter(account__isnull=True).count(),
            "with_phone": qs.exclude(Q(phone__isnull=True) | Q(phone="")).count(),
            "with_email": qs.exclude(Q(email__isnull=True) | Q(email="")).count(),
            "with_title": qs.exclude(Q(title__isnull=True) | Q(title="")).count(),
        })


class SuperAdminTeamStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Team.objects.all()
        total_members = sum(team.members.count() for team in qs)
        total_teams = qs.count()
        return Response({
            "total_teams": total_teams,
            "total_members": total_members,
            "avg_members": round(total_members / total_teams, 2) if total_teams else 0,
            "with_company": qs.filter(company__isnull=False).count(),
            "without_company": qs.filter(company__isnull=True).count(),
        })


class SuperAdminInvitationStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Invitation.objects.all()
        total = qs.count()
        accepted = qs.filter(accepted=True).count()
        return Response({
            "total": total,
            "accepted": accepted,
            "pending": qs.filter(accepted=False).count(),
            "admins": qs.filter(role="ADMIN").count(),
            "managers": qs.filter(role="MANAGER").count(),
            "commercials": qs.filter(role="COMMERCIAL").count(),
            "acceptance_rate": _pct(accepted, total),
        })


class SuperAdminAIAgentRunListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AIAgentRunSerializer
    pagination_class = SuperAdminPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["query", "company__name", "launched_by__username", "error_message"]
    ordering = ["-started_at"]

    def get_queryset(self):
        qs = AIAgentRun.objects.select_related("company", "launched_by")
        for param in ("agent_type", "status"):
            if value := self.request.query_params.get(param):
                qs = qs.filter(**{param: value})
        if company_id := self.request.query_params.get("company_id"):
            qs = qs.filter(company_id=company_id)
        if date_from := self.request.query_params.get("date_from"):
            qs = qs.filter(started_at__date__gte=date_from)
        if date_to := self.request.query_params.get("date_to"):
            qs = qs.filter(started_at__date__lte=date_to)
        return qs


def _agent_stats_payload(qs):
    return {
        "total_runs": qs.count(),
        "success_runs": qs.filter(status="success").count(),
        "failed_runs": qs.filter(status="failed").count(),
        "partial_runs": qs.filter(status="partial").count(),
        "prospects_found": _sum(qs, "prospects_found"),
        "prospects_imported": _sum(qs, "prospects_imported"),
        "messages_generated": _sum(qs, "messages_generated"),
        "messages_sent": _sum(qs, "messages_sent"),
        "replies_detected": _sum(qs, "replies_detected"),
        "avg_duration_seconds": round(qs.aggregate(v=Avg("duration_seconds"))["v"] or 0, 2),
        "avg_duration": round(qs.aggregate(v=Avg("duration_seconds"))["v"] or 0, 2),
        "by_agent": list(qs.values("agent_type").annotate(count=Count("id")).order_by("-count")),
        "by_source": [
            {"source": "Google Maps", "count": _sum(qs, "source_google_maps")},
            {"source": "LinkedIn", "count": _sum(qs, "source_linkedin")},
            {"source": "Facebook", "count": _sum(qs, "source_facebook")},
            {"source": "Instagram", "count": _sum(qs, "source_instagram")},
            {"source": "Website", "count": _sum(qs, "source_website")},
        ],
    }


class SuperAdminAgentExecutionView(APIView):
    permission_classes = [IsSuperAdmin]

    def _queryset(self, request):
        qs = AIAgentRun.objects.select_related("company", "launched_by").order_by("-started_at")
        for param in ("agent_type", "status"):
            if value := request.query_params.get(param):
                qs = qs.filter(**{param: value})
        if company_id := request.query_params.get("company_id"):
            qs = qs.filter(company_id=company_id)
        if search := request.query_params.get("search"):
            qs = qs.filter(
                Q(query__icontains=search)
                | Q(company__name__icontains=search)
                | Q(launched_by__username__icontains=search)
                | Q(launched_by__email__icontains=search)
                | Q(error_message__icontains=search)
                | Q(agent_type__icontains=search)
            )
        if date_from := request.query_params.get("date_from"):
            qs = qs.filter(started_at__date__gte=date_from)
        if date_to := request.query_params.get("date_to"):
            qs = qs.filter(started_at__date__lte=date_to)
        return qs

    def get(self, request):
        backfill_agent_runs_from_existing_activity()
        qs = self._queryset(request)
        stats = _agent_stats_payload(qs)
        paginator = SuperAdminPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = AIAgentRunSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        response.data["stats"] = stats
        response.data["runs"] = response.data.get("results", [])
        response.data["recent_runs"] = response.data.get("results", [])
        return response


class SuperAdminAIAgentStatsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = AIAgentRun.objects.all()
        total = qs.count()
        daily = list(
            qs.annotate(day=TruncDate("started_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("-day")[:30]
        )
        daily.reverse()
        payload = _agent_stats_payload(qs)
        payload["total_runs"] = total
        payload["daily_activity"] = [{"date": row["day"], "count": row["count"]} for row in daily]
        return Response(payload)


class SuperAdminAuditLogListView(ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = SuperAdminAuditLogSerializer
    pagination_class = SuperAdminPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["module", "action", "object_repr", "description", "actor__email", "actor__username", "company__name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        backfill_audit_logs_from_existing_activity()
        qs = SuperAdminAuditLog.objects.select_related("actor", "company")
        for param in ("action", "module", "company_id", "actor_id"):
            if value := self.request.query_params.get(param):
                qs = qs.filter(**{param: value})
        return qs


class SuperAdminSystemHealthView(APIView):
    permission_classes = [IsSuperAdmin]

    def _log(self, service, status_value, message="", response_time_ms=None):
        return SystemHealthLog.objects.create(
            service=service,
            status=status_value,
            message=message,
            response_time_ms=response_time_ms,
        )

    def get(self, request):
        checks = []
        checks.append(self._log("backend", "online", "Django API is responding", 0))

        start = perf_counter()
        try:
            Company.objects.count()
            checks.append(self._log("database", "online", "Database query succeeded", round((perf_counter() - start) * 1000, 2)))
        except Exception as exc:
            checks.append(self._log("database", "offline", str(exc), round((perf_counter() - start) * 1000, 2)))

        start = perf_counter()
        try:
            cache.set("superadmin_health", "ok", 5)
            ok = cache.get("superadmin_health") == "ok"
            checks.append(self._log("redis", "online" if ok else "warning", "Cache backend responded" if ok else "Cache backend did not echo value", round((perf_counter() - start) * 1000, 2)))
        except Exception as exc:
            checks.append(self._log("redis", "warning", str(exc), round((perf_counter() - start) * 1000, 2)))

        checks.append(self._log("gemini", "online" if (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")) else "warning", "API key configured" if (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")) else "No Gemini/Google API key configured"))

        latest = []
        for service in SystemHealthLog.SERVICE_CHOICES:
            log = SystemHealthLog.objects.filter(service=service[0]).order_by("-checked_at").first()
            if log:
                latest.append(log)
        return Response(SystemHealthLogSerializer(latest, many=True).data)
