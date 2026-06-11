# superadmin/serializers.py  (version complète avec toutes les tables)
from rest_framework import serializers
from django.db.models import Max, Sum
from django.utils import timezone
from users.models import User, Company, Team, Invitation
from subscriptions.models import SubscriptionPlan, CompanySubscription
from sales.models import (
    Prospect, ProspectCompany, Contact,
    Opportunity, Task, TaskActivity, TaskComment, Account,
)
from .models import (
    UserAcquisitionSource,
    AppRating,
    UserFeedback,
    UserActivity,
    SuperAdminAuditLog,
    AIAgentRun,
    SystemHealthLog,
)




# ===============================
# SUBSCRIPTION PLAN
# ===============================
class SuperAdminPlanSerializer(serializers.ModelSerializer):
    subscribers_count = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id", "name", "price", "duration_days",
            "max_users", "max_teams", "max_prospects",
            "description", "premium_features", "stripe_price_id",
            "subscribers_count",
        ]

    def get_subscribers_count(self, obj):
        return CompanySubscription.objects.filter(plan=obj, is_active=True).count()

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Le prix ne peut pas être négatif.")
        return value


# ===============================
# COMPANY SUBSCRIPTION
# ===============================
class SuperAdminSubscriptionSerializer(serializers.ModelSerializer):
    plan_name  = serializers.CharField(source="plan.name", read_only=True)
    plan_price = serializers.DecimalField(
        source="plan.price", max_digits=8, decimal_places=2, read_only=True
    )
    days_until_expiry = serializers.SerializerMethodField()
    expired           = serializers.SerializerMethodField()

    class Meta:
        model = CompanySubscription
        fields = [
            "id", "plan_name", "plan_price",
            "start_date", "end_date", "is_active",
            "is_trial", "trial_end_date", "auto_renew",
            "cancelled_at", "days_until_expiry", "expired",
        ]

    def get_days_until_expiry(self, obj): return obj.days_until_expiry()
    def get_expired(self, obj):           return obj.expired


# ===============================
# COMPANY
# ===============================
class SuperAdminCompanyListSerializer(serializers.ModelSerializer):
    owner_email    = serializers.EmailField(source="owner.email", read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    users_count    = serializers.SerializerMethodField()
    prospects_count = serializers.SerializerMethodField()
    contacts_count = serializers.SerializerMethodField()
    opportunities_count = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()
    last_activity_at = serializers.SerializerMethodField()
    estimated_revenue = serializers.SerializerMethodField()
    subscription_plan   = serializers.SerializerMethodField()
    subscription_active = serializers.SerializerMethodField()
    is_trial            = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "industry", "country", "city",
            "phone_number", "number_of_employees", "founded_year",
            "company_created", "created_at",
            "owner_email", "owner_username",
            "users_count", "prospects_count", "contacts_count",
            "opportunities_count", "tasks_count", "last_activity_at",
            "estimated_revenue", "subscription_plan", "subscription_active", "is_trial",
        ]

    def get_users_count(self, obj):         return obj.users.count()
    def get_prospects_count(self, obj):     return Prospect.objects.filter(company=obj).count()
    def get_contacts_count(self, obj):      return Contact.objects.filter(company=obj).count()
    def get_opportunities_count(self, obj): return Opportunity.objects.filter(company=obj).count()
    def get_tasks_count(self, obj):         return Task.objects.filter(company=obj).count()
    def get_last_activity_at(self, obj):    return UserActivity.objects.filter(user__company=obj).aggregate(last=Max("created_at"))["last"]
    def get_estimated_revenue(self, obj):
        s = self._sub(obj)
        return float(s.plan.price) if s and s.is_active and s.plan else 0
    def _sub(self, obj):                    return getattr(obj, "subscription", None)
    def get_subscription_plan(self, obj):   s = self._sub(obj); return s.plan.name if s and s.plan else None
    def get_subscription_active(self, obj): s = self._sub(obj); return s.is_active if s else False
    def get_is_trial(self, obj):            s = self._sub(obj); return s.is_trial if s else False


class SuperAdminCompanyDetailSerializer(SuperAdminCompanyListSerializer):
    subscription = serializers.SerializerMethodField()
    crm_stats = serializers.SerializerMethodField()
    agents_stats = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()

    class Meta(SuperAdminCompanyListSerializer.Meta):
        fields = SuperAdminCompanyListSerializer.Meta.fields + ["subscription", "crm_stats", "agents_stats", "recent_activity"]

    def get_subscription(self, obj):
        sub = getattr(obj, "subscription", None)
        return SuperAdminSubscriptionSerializer(sub).data if sub else None

    def get_crm_stats(self, obj):
        return {
            "prospects": Prospect.objects.filter(company=obj).count(),
            "contacts": Contact.objects.filter(company=obj).count(),
            "opportunities": Opportunity.objects.filter(company=obj).count(),
            "tasks": Task.objects.filter(company=obj).count(),
            "activities": TaskActivity.objects.filter(task__company=obj).count(),
        }

    def get_agents_stats(self, obj):
        qs = AIAgentRun.objects.filter(company=obj)
        return {
            "total_runs": qs.count(),
            "success_runs": qs.filter(status="success").count(),
            "failed_runs": qs.filter(status="failed").count(),
            "prospects_found": qs.aggregate(v=Sum("prospects_found"))["v"] or 0,
            "messages_sent": qs.aggregate(v=Sum("messages_sent"))["v"] or 0,
        }

    def get_recent_activity(self, obj):
        qs = UserActivity.objects.filter(user__company=obj).select_related("user").order_by("-created_at")[:10]
        return UserActivitySerializer(qs, many=True).data


# ===============================
# USER
# ===============================
class SuperAdminUserSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()
    company_id   = serializers.SerializerMethodField()
    prospects_count = serializers.SerializerMethodField()
    opportunities_count = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()
    activities_count = serializers.SerializerMethodField()
    last_activity_at = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "role",
            "is_active", "is_verified", "is_staff",
            "phone_number", "country", "city", "job_title",
            "profile_completed", "company_id", "company_name",
            "prospects_count", "opportunities_count", "tasks_count",
            "activities_count", "last_activity_at",
        ]
        read_only_fields = ["id", "email", "username", "is_verified", "is_staff", "profile_completed"]

    def get_company_name(self, obj): return obj.company.name if obj.company else None
    def get_company_id(self, obj):   return obj.company.id   if obj.company else None
    def get_prospects_count(self, obj): return Prospect.objects.filter(assigned_to=obj).count()
    def get_opportunities_count(self, obj): return Opportunity.objects.filter(assigned_to=obj).count()
    def get_tasks_count(self, obj): return Task.objects.filter(assigned_to=obj).count()
    def get_activities_count(self, obj): return TaskActivity.objects.filter(performed_by=obj).count()
    def get_last_activity_at(self, obj): return UserActivity.objects.filter(user=obj).aggregate(last=Max("created_at"))["last"]


# ===============================
# TEAM
# ===============================
class SuperAdminTeamSerializer(serializers.ModelSerializer):
    company_name   = serializers.CharField(source="company.name",       read_only=True)
    owner_username = serializers.CharField(source="owner.username",     read_only=True)
    owner_email    = serializers.CharField(source="owner.email",        read_only=True)
    members_count  = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id", "name", "company", "company_name",
            "owner_username", "owner_email", "members_count",
        ]

    def get_members_count(self, obj): return obj.members.count()


# ===============================
# INVITATION
# ===============================
class SuperAdminInvitationSerializer(serializers.ModelSerializer):
    team_name      = serializers.CharField(source="team.name",          read_only=True)
    invited_by_email = serializers.CharField(source="invited_by.email", read_only=True)
    company_name   = serializers.CharField(source="team.company.name",  read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "id", "email", "token", "role", "accepted",
            "created_at", "team_name", "invited_by_email", "company_name",
        ]


# ===============================
# PROSPECT COMPANY
# ===============================
class SuperAdminProspectCompanySerializer(serializers.ModelSerializer):
    crm_company_name = serializers.CharField(source="company.name", read_only=True)
    prospects_count  = serializers.SerializerMethodField()

    class Meta:
        model = ProspectCompany
        fields = [
            "id", "name", "industry", "phone", "email",
            "number_of_employees", "annual_revenue",
            "city", "country", "created_at",
            "crm_company_name", "prospects_count",
        ]

    def get_prospects_count(self, obj): return obj.prospects.count()


# ===============================
# PROSPECT
# ===============================
class SuperAdminProspectSerializer(serializers.ModelSerializer):
    company_name         = serializers.CharField(source="company.name",                read_only=True)
    prospect_company_name = serializers.CharField(source="prospect_company.name",      read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username",        read_only=True, default=None)
    created_by_username = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    ai_score = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = Prospect
        fields = [
            "id", "first_name", "last_name", "title",
            "email", "phone", "origin", "evaluation", "status",
            "created_at", "updated_at",
            "company_name", "prospect_company_name", "assigned_to_username",
            "created_by_username", "source", "ai_score", "latitude", "longitude",
        ]

    def get_created_by_username(self, obj):
        user = getattr(obj, "created_by", None)
        return user.username if user else None

    def get_source(self, obj):
        return getattr(obj, "source", None) or getattr(obj, "origin", None)

    def get_ai_score(self, obj):
        return getattr(obj, "ai_score", None) or getattr(obj, "score_ia", None)

    def get_latitude(self, obj):
        return getattr(obj, "latitude", None)

    def get_longitude(self, obj):
        return getattr(obj, "longitude", None)


# ===============================
# CONTACT
# ===============================
class SuperAdminContactSerializer(serializers.ModelSerializer):
    company_name  = serializers.CharField(source="company.name",        read_only=True)
    account_name  = serializers.CharField(source="account.name",        read_only=True, default=None)

    class Meta:
        model = Contact
        fields = [
            "id", "first_name", "last_name", "title",
            "email", "phone", "created_at",
            "company_name", "account_name",
        ]


# ===============================
# OPPORTUNITY
# ===============================
class SuperAdminOpportunitySerializer(serializers.ModelSerializer):
    company_name         = serializers.CharField(source="company.name",           read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username",   read_only=True, default=None)
    prospect_name        = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = [
            "id", "name", "amount", "stage",
            "expected_close_date", "created_at", "updated_at",
            "company_name", "assigned_to_username", "prospect_name",
        ]

    def get_prospect_name(self, obj):
        if obj.prospect:
            return f"{obj.prospect.first_name} {obj.prospect.last_name}"
        if obj.contact:
            return f"{obj.contact.first_name} {obj.contact.last_name}"
        return None


# ===============================
# TASK
# ===============================
class SuperAdminTaskSerializer(serializers.ModelSerializer):
    company_name         = serializers.CharField(source="company.name",           read_only=True)
    assigned_to_username = serializers.CharField(source="assigned_to.username",   read_only=True, default=None)
    created_by_username  = serializers.CharField(source="created_by.username",    read_only=True, default=None)
    realized_by_label = serializers.SerializerMethodField()
    realized_by_type = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "task_type",
            "status", "priority", "due_date",
            "quota_target", "quota_progress",
            "calls_count", "emails_count", "meetings_count", "notes_count",
            "created_at", "updated_at",
            "company_name", "assigned_to_username", "created_by_username",
            "realized_by_label", "realized_by_type", "is_overdue",
        ]

    def _agent_label(self, obj):
        source = (getattr(obj, "source", "") or "").lower()
        task_type = (getattr(obj, "task_type", "") or "").lower()
        if "prospection" in source or "prospection" in task_type:
            return "Agent Prospection"
        if "engagement" in source or "engagement" in task_type:
            return "Agent Engagement"
        return None

    def get_realized_by_label(self, obj):
        if obj.created_by:
            return obj.created_by.username
        return self._agent_label(obj) or "Systeme"

    def get_realized_by_type(self, obj):
        return "Utilisateur" if obj.created_by else ("IA" if self._agent_label(obj) else "Systeme")

    def get_is_overdue(self, obj):
        return bool(obj.due_date and obj.status not in ("done", "completed", "cancelled") and obj.due_date < timezone.now())


# ===============================
# TASK ACTIVITY
# ===============================
class SuperAdminTaskActivitySerializer(serializers.ModelSerializer):
    task_title           = serializers.CharField(source="task.title",             read_only=True)
    performed_by_username = serializers.CharField(source="performed_by.username", read_only=True, default=None)
    company_name         = serializers.CharField(source="task.company.name",      read_only=True)

    class Meta:
        model = TaskActivity
        fields = [
            "id", "activity_type", "notes",
            "call_result", "call_duration_minutes",
            "email_subject", "email_sent_to",
            "meeting_date", "meeting_location",
            "created_at",
            "task_title", "performed_by_username", "company_name",
        ]


# ===============================
# TASK COMMENT
# ===============================
class SuperAdminTaskCommentSerializer(serializers.ModelSerializer):
    task_title    = serializers.CharField(source="task.title",    read_only=True)
    author_username = serializers.CharField(source="author.username", read_only=True, default=None)
    company_name  = serializers.CharField(source="task.company.name", read_only=True)

    class Meta:
        model = TaskComment
        fields = [
            "id", "content", "created_at", "updated_at",
            "task_title", "author_username", "company_name",
        ]


# ===============================
# STATS GLOBALES
# ===============================
class SuperAdminStatsSerializer(serializers.Serializer):
    total_companies          = serializers.IntegerField()
    total_users              = serializers.IntegerField()
    active_subscriptions     = serializers.IntegerField()
    trial_subscriptions      = serializers.IntegerField()
    expired_subscriptions    = serializers.IntegerField()
    total_revenue_monthly    = serializers.FloatField()
    companies_by_plan        = serializers.DictField()
    new_companies_this_month = serializers.IntegerField()
    total_prospects          = serializers.IntegerField()
    total_contacts           = serializers.IntegerField()
    total_opportunities      = serializers.IntegerField()
    total_tasks              = serializers.IntegerField()
    total_teams              = serializers.IntegerField()
    total_activities         = serializers.IntegerField()
    total_feedbacks          = serializers.IntegerField()
    avg_rating               = serializers.FloatField()
    ai_total_runs            = serializers.IntegerField()
    ai_success_runs          = serializers.IntegerField()
    ai_failed_runs           = serializers.IntegerField()
    ai_prospects_found       = serializers.IntegerField()
    ai_prospects_imported    = serializers.IntegerField()
    ai_messages_generated    = serializers.IntegerField()
    ai_messages_sent         = serializers.IntegerField()
    ai_replies_detected      = serializers.IntegerField()


class AIAgentRunSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True, default=None)
    launched_by_username = serializers.CharField(source="launched_by.username", read_only=True, default=None)

    class Meta:
        model = AIAgentRun
        fields = "__all__"


class SuperAdminAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, default=None)
    actor_email = serializers.CharField(source="actor.email", read_only=True, default=None)
    company_name = serializers.CharField(source="company.name", read_only=True, default=None)

    class Meta:
        model = SuperAdminAuditLog
        fields = "__all__"


class SystemHealthLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemHealthLog
        fields = "__all__"

# superadmin/serializers.py (partie marketing)


class AcquisitionSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAcquisitionSource
        fields = ["id", "source", "created_at"]
        read_only_fields = ["created_at"]


class AppRatingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = AppRating
        fields = ["id", "username", "rating", "comment", "created_at"]
        read_only_fields = ["created_at"]


class UserFeedbackSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = UserFeedback
        fields = [
            "id", "username", "company_name", "category",
            "message", "status", "admin_response", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_company_name(self, obj):
        return obj.user.company.name if obj.user.company else None


class UserActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserActivity
        fields = ["id", "module", "action", "created_at"]
        read_only_fields = ["created_at"]
