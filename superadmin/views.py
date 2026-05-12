# superadmin/views.py  (version complète — toutes les tables)
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status, filters
from rest_framework.pagination import PageNumberPagination
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Count, Avg, Q


from .models import UserAcquisitionSource, AppRating, UserFeedback, UserActivity
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
            serializer.save()
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
            return Response(s.data)
        return Response(s.errors, status=400)

    def delete(self, request, pk):
        plan = self._get(pk)
        if not plan:
            return Response({"error": "Plan introuvable"}, status=404)
        active = CompanySubscription.objects.filter(plan=plan, is_active=True).count()
        if active > 0:
            return Response({"error": f"Plan utilisé par {active} entreprise(s) active(s)"}, status=400)
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
        for field in ["name", "industry", "country", "city", "phone_number", "number_of_employees", "founded_year"]:
            if field in request.data:
                setattr(company, field, request.data[field])
        company.save()
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
        module = request.data.get("module")
        action = request.data.get("action", "")

        valid_modules = [m[0] for m in UserActivity.MODULE_CHOICES]
        if not module or module not in valid_modules:
            return Response({"error": "Module invalide"}, status=400)

        UserActivity.objects.create(
            user=request.user,
            module=module,
            action=action,
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

        return Response(UserFeedbackSerializer(feedback).data)