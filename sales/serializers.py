from rest_framework import serializers
from django.utils import timezone  # ✅ FIX: manquait
from .models import Account, Prospect, ProspectCompany
from .models import Opportunity
from .models import Contact
from .models import PipelineStageTask
from .models import (
    Task, TaskActivity,
    TaskComment,
)
from users.models import User

from .models import (
    PerformanceScore, ManagerFeedback,
    PerformanceGoal, CommercialBadge,
)
from .models import Pipeline, PipelineStage, OpportunityPipeline, StageHistory, PipelineAlert

# -----------------------
# Account Serializer
# -----------------------
class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = "__all__"
        read_only_fields = ["company", "team", "created_by", "created_at"]


class AccountNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "name", "industry", "city", "country"]
        read_only_fields = fields


# -----------------------
# ProspectCompany Serializer
# -----------------------
class ProspectCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProspectCompany
        fields = "__all__"
        read_only_fields = ["company", "created_at"]

    def validate_number_of_employees(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Le nombre d'employés doit être positif.")
        return value

    def validate_annual_revenue(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Le revenu annuel doit être positif.")
        return value


# -----------------------
# Prospect Serializer
# -----------------------
class ProspectSerializer(serializers.ModelSerializer):
    prospect_company_name = serializers.CharField(write_only=True, required=True)
    company = serializers.PrimaryKeyRelatedField(read_only=True)
    prospect_company = serializers.PrimaryKeyRelatedField(read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Prospect
        fields = [
            "id", "first_name", "last_name", "title", "email", "phone",
            "city", "country",
            "origin", "evaluation", "status",
            "assigned_to", "assigned_to_name",
            "company", "prospect_company", "prospect_company_name",
            "created_at", "updated_at",
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.username
        return None

    def create(self, validated_data):
        prospect_company_name = validated_data.pop("prospect_company_name")
        user = self.context["request"].user
        crm_company = user.company

        prospect_company, _ = ProspectCompany.objects.get_or_create(
            name=prospect_company_name,
            company=crm_company,
        )

        if "assigned_to" not in validated_data or validated_data["assigned_to"] is None:
            validated_data["assigned_to"] = user

        return Prospect.objects.create(
            **validated_data,
            company=crm_company,
            prospect_company=prospect_company,
        )


# -----------------------
# Opportunity Serializer
# -----------------------
class OpportunitySerializer(serializers.ModelSerializer):
    assigned_to_detail = serializers.SerializerMethodField(read_only=True)
    # ✅ Expose pipeline info directly on the opportunity
    pipeline_info = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Opportunity
        fields = "__all__"
        read_only_fields = ["company", "assigned_to_detail", "pipeline_info"]

    def get_assigned_to_detail(self, obj):
        if obj.assigned_to:
            return {
                "id":       obj.assigned_to.id,
                "username": obj.assigned_to.username,
                "role":     obj.assigned_to.role,
            }
        return None

    def get_pipeline_info(self, obj):
        """
        ✅ Retourne les infos pipeline liées à cette opportunité.
        Permet à la liste des opportunités d'afficher le stage pipeline.
        """
        try:
            pd = obj.pipeline_data  # OneToOne reverse relation
            if pd:
                return {
                    "pipeline_id":   pd.pipeline_id,
                    "pipeline_name": pd.pipeline.name if pd.pipeline else None,
                    "stage_name":    pd.current_stage.name if pd.current_stage else None,
                    "stage_color":   pd.current_stage.color_hex if pd.current_stage else None,
                    "status":        pd.status,
                    "progression":   pd.progression,
                    "op_pipeline_id": pd.id,
                }
        except Exception:
            pass
        return None

    def validate(self, data):
        if not data.get("prospect") and not data.get("contact"):
            raise serializers.ValidationError(
                "Vous devez sélectionner au moins un Prospect ou un Contact."
            )
        return data

    def validate_assigned_to(self, value):
        if value and value.role != "COMMERCIAL":
            raise serializers.ValidationError(
                "Une opportunité ne peut être assignée qu'à un commercial."
            )
        return value


# -----------------------
# Contact Serializer
# -----------------------
class ContactSerializer(serializers.ModelSerializer):
    account = AccountNestedSerializer(read_only=True)
    account_id = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(),
        source="account",
        write_only=True,
        required=False,
        allow_null=True,
    )
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [
            "id", "first_name", "last_name", "title", "email", "phone",
            "city", "country",
            "account", "account_id",
            "assigned_to", "assigned_to_name",
            "company", "created_at",
        ]
        read_only_fields = ["company", "created_at", "assigned_to_name", "account"]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.username
        return None


# -----------------------
# Task User Serializer
# -----------------------
class TaskUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "full_name", "role"]

    def get_full_name(self, obj):
        return obj.username


# -----------------------
# Task Activity Serializer
# -----------------------
class TaskActivitySerializer(serializers.ModelSerializer):
    performed_by_detail = TaskUserSerializer(source="performed_by", read_only=True)
    # ✅ Ajout champ email_sent manquant
    email_sent = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = TaskActivity
        fields = [
            "id", "task", "activity_type",
            "performed_by", "performed_by_detail",
            "prospect", "contact",
            "notes", "call_result", "call_duration_minutes",
            "email_subject", "email_body", "email_sent_to", "email_sent",
            "meeting_date", "meeting_location",
            "created_at",
        ]
        read_only_fields = ["performed_by", "performed_by_detail", "email_sent", "created_at"]


# -----------------------
# Task Comment Serializer
# -----------------------
class TaskCommentSerializer(serializers.ModelSerializer):
    author_detail = TaskUserSerializer(source="author", read_only=True)

    class Meta:
        model = TaskComment
        fields = ["id", "task", "author", "author_detail", "content", "created_at"]
        read_only_fields = ["author", "author_detail", "created_at"]


# -----------------------
# Task Serializer
# -----------------------
class TaskSerializer(serializers.ModelSerializer):
    assigned_to_detail = TaskUserSerializer(source="assigned_to", read_only=True)
    created_by_detail  = TaskUserSerializer(source="created_by", read_only=True)
    activities         = TaskActivitySerializer(many=True, read_only=True)
    comments           = TaskCommentSerializer(many=True, read_only=True)
    follow_up_tasks_count = serializers.SerializerMethodField()
    # ✅ Expose is_overdue et quota_percentage
    is_overdue         = serializers.BooleanField(read_only=True)
    quota_percentage   = serializers.IntegerField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "task_type",
            "status", "priority", "due_date",
            "quota_target", "quota_progress", "quota_percentage",
            "assigned_to", "assigned_to_detail",
            "created_by", "created_by_detail",
            "parent_task", "closing_report", "closed_at",
            "calls_count", "emails_count", "meetings_count", "notes_count",
            "prospect", "contact", "opportunity",
            "company", "created_at", "updated_at",
            "activities", "comments",
            "follow_up_tasks_count", "is_overdue",
        ]
        read_only_fields = [
            "assigned_to_detail", "created_by", "created_by_detail",
            "company", "created_at", "updated_at",
            "activities", "comments", "follow_up_tasks_count",
            "is_overdue", "quota_percentage",
        ]

    def get_follow_up_tasks_count(self, obj):
        return obj.follow_up_tasks.count()


# ──────────────────────────────────────────────────────────
# PERFORMANCE SCORE
# ──────────────────────────────────────────────────────────
class PerformanceScoreSerializer(serializers.ModelSerializer):
    commercial_username = serializers.CharField(source="commercial.username", read_only=True)
    commercial_email    = serializers.CharField(source="commercial.email", read_only=True)
    completion_rate     = serializers.SerializerMethodField()
    deadline_rate       = serializers.SerializerMethodField()
    period_label        = serializers.SerializerMethodField()

    class Meta:
        model = PerformanceScore
        fields = [
            "id",
            "commercial", "commercial_username", "commercial_email",
            "year", "month", "period_label",
            "tasks_total", "tasks_done", "tasks_on_time", "tasks_late",
            "calls_count", "emails_count", "meetings_count",
            "opportunities_won", "opportunities_total",
            "penalty_points", "score",
            "completion_rate", "deadline_rate",
            "computed_at",
        ]
        read_only_fields = fields

    def get_completion_rate(self, obj):
        if obj.tasks_total == 0:
            return 100.0
        return round(obj.tasks_done / obj.tasks_total * 100, 1)

    def get_deadline_rate(self, obj):
        if obj.tasks_done == 0:
            return 100.0
        return round(obj.tasks_on_time / obj.tasks_done * 100, 1)

    def get_period_label(self, obj):
        return f"{obj.month:02d}/{obj.year}"


# ──────────────────────────────────────────────────────────
# MANAGER FEEDBACK
# ──────────────────────────────────────────────────────────
class ManagerFeedbackSerializer(serializers.ModelSerializer):
    given_by_username   = serializers.CharField(source="given_by.username", read_only=True)
    commercial_username = serializers.CharField(source="commercial.username", read_only=True)
    stars_display       = serializers.SerializerMethodField()
    period_label        = serializers.SerializerMethodField()

    class Meta:
        model = ManagerFeedback
        fields = [
            "id",
            "given_by", "given_by_username",
            "commercial", "commercial_username",
            "rating", "stars_display",
            "comment",
            "year", "month", "period_label",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "given_by", "given_by_username", "commercial_username",
            "stars_display", "period_label",
            "created_at", "updated_at",
        ]

    def get_stars_display(self, obj):
        return "★" * obj.rating + "☆" * (5 - obj.rating)

    def get_period_label(self, obj):
        if obj.year and obj.month:
            return f"{obj.month:02d}/{obj.year}"
        return None

    def validate_commercial(self, value):
        request = self.context.get("request")
        if request and value.company != request.user.company:
            raise serializers.ValidationError("Ce commercial n'appartient pas à votre société.")
        if value.role != "COMMERCIAL":
            raise serializers.ValidationError("Le feedback ne peut être donné qu'à un commercial.")
        return value

    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("La note doit être entre 1 et 5.")
        return value


# ──────────────────────────────────────────────────────────
# PERFORMANCE GOAL
# ──────────────────────────────────────────────────────────
class PerformanceGoalSerializer(serializers.ModelSerializer):
    commercial_username = serializers.CharField(source="commercial.username", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    goal_type_display   = serializers.CharField(source="get_goal_type_display", read_only=True)
    status_display      = serializers.CharField(source="get_status_display", read_only=True)
    progress_pct        = serializers.SerializerMethodField()
    period_label        = serializers.SerializerMethodField()

    class Meta:
        model = PerformanceGoal
        fields = [
            "id",
            "created_by", "created_by_username",
            "commercial", "commercial_username",
            "goal_type", "goal_type_display",
            "target_value", "current_value", "progress_pct",
            "year", "month", "period_label",
            "status", "status_display",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "created_by", "created_by_username", "commercial_username",
            "goal_type_display", "status_display",
            "progress_pct", "period_label",
            "current_value", "created_at", "updated_at",
        ]

    def get_progress_pct(self, obj):
        return obj.progress_pct

    def get_period_label(self, obj):
        return f"{obj.month:02d}/{obj.year}"

    def validate_commercial(self, value):
        request = self.context.get("request")
        if request and value.company != request.user.company:
            raise serializers.ValidationError("Ce commercial n'appartient pas à votre société.")
        return value

    def validate_target_value(self, value):
        if value <= 0:
            raise serializers.ValidationError("La valeur cible doit être supérieure à 0.")
        return value


# ──────────────────────────────────────────────────────────
# COMMERCIAL BADGE
# ──────────────────────────────────────────────────────────
class CommercialBadgeSerializer(serializers.ModelSerializer):
    commercial_username = serializers.CharField(source="commercial.username", read_only=True)
    badge_label         = serializers.CharField(source="get_badge_type_display", read_only=True)
    period_label        = serializers.SerializerMethodField()
    badge_icon          = serializers.SerializerMethodField()

    BADGE_ICONS = {
        "top_seller":     "🏆",
        "on_time_100":    "⏱️",
        "best_closer":    "🎯",
        "calls_100":      "📞",
        "email_champion": "📧",
        "streak_3":       "🔥",
        "most_improved":  "📈",
    }

    class Meta:
        model = CommercialBadge
        fields = [
            "id",
            "commercial", "commercial_username",
            "badge_type", "badge_label", "badge_icon",
            "year", "month", "period_label",
            "awarded_at",
        ]
        read_only_fields = fields

    def get_period_label(self, obj):
        return f"{obj.month:02d}/{obj.year}"

    def get_badge_icon(self, obj):
        return self.BADGE_ICONS.get(obj.badge_type, "🏅")


# ──────────────────────────────────────────────────────────
# PIPELINE STAGE TASK
# ──────────────────────────────────────────────────────────
class PipelineStageTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineStageTask
        fields = [
            "id", "stage", "title", "description",
            "order", "priority", "due_days_after_entry",
            "activity_type",   # ✅ ajouter cette ligne
            "created_at",
        ]
        read_only_fields = ["company", "created_at"]


# ──────────────────────────────────────────────────────────
# PIPELINE STAGE  (version complète avec task_templates)
# ──────────────────────────────────────────────────────────
class PipelineStageSerializer(serializers.ModelSerializer):
    color_hex           = serializers.ReadOnlyField()
    opportunities_count = serializers.ReadOnlyField()
    task_templates      = PipelineStageTaskSerializer(many=True, read_only=True)

    class Meta:
        model  = PipelineStage
        fields = [
            "id", "pipeline", "name", "order",
            "max_duration_days", "warning_threshold_pct",
            "color", "color_hex", "description",
            "is_terminal", "is_won",
            "crm_stage",          # ✅ ajouter
            "opportunities_count",
            "task_templates",
            "created_at",
        ]
        read_only_fields = [
            "company", "color_hex", "opportunities_count",
            "task_templates", "created_at",
        ]

# ──────────────────────────────────────────────────────────
# PIPELINE
# ──────────────────────────────────────────────────────────
class PipelineSerializer(serializers.ModelSerializer):
    stages              = PipelineStageSerializer(many=True, read_only=True)
    stages_count        = serializers.ReadOnlyField()
    opportunities_count = serializers.ReadOnlyField()
    pipeline_type_display = serializers.CharField(source="get_pipeline_type_display", read_only=True)

    class Meta:
        model = Pipeline
        fields = [
            "id", "name", "pipeline_type", "pipeline_type_display",
            "description", "is_active",
            "stages", "stages_count", "opportunities_count",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "company", "created_by",
            "stages_count", "opportunities_count",
            "created_at", "updated_at",
        ]


class PipelineListSerializer(serializers.ModelSerializer):
    """Version légère pour les listes (sans stages détaillés)."""
    stages_count          = serializers.ReadOnlyField()
    opportunities_count   = serializers.ReadOnlyField()
    pipeline_type_display = serializers.CharField(source="get_pipeline_type_display", read_only=True)

    class Meta:
        model = Pipeline
        fields = [
            "id", "name", "pipeline_type", "pipeline_type_display",
            "description", "is_active",
            "stages_count", "opportunities_count",
            "created_at",
        ]
        read_only_fields = fields


# ──────────────────────────────────────────────────────────
# STAGE HISTORY
# ──────────────────────────────────────────────────────────
class StageHistorySerializer(serializers.ModelSerializer):
    from_stage_name      = serializers.CharField(source="from_stage.name",      read_only=True, default=None)
    to_stage_name        = serializers.CharField(source="to_stage.name",        read_only=True, default=None)
    from_stage_color     = serializers.CharField(source="from_stage.color_hex", read_only=True, default=None)
    to_stage_color       = serializers.CharField(source="to_stage.color_hex",   read_only=True, default=None)
    performed_by_username = serializers.CharField(source="performed_by.username", read_only=True, default=None)
    action_display       = serializers.CharField(source="get_action_display",   read_only=True)

    class Meta:
        model = StageHistory
        fields = [
            "id", "action", "action_display",
            "from_stage", "from_stage_name", "from_stage_color",
            "to_stage",   "to_stage_name",   "to_stage_color",
            "performed_by", "performed_by_username",
            "notes", "duration_in_stage_hours",
            "created_at",
        ]
        read_only_fields = fields


# ──────────────────────────────────────────────────────────
# PIPELINE ALERT
# ──────────────────────────────────────────────────────────
class PipelineAlertSerializer(serializers.ModelSerializer):
    alert_type_display = serializers.CharField(source="get_alert_type_display", read_only=True)
    severity_display   = serializers.CharField(source="get_severity_display",   read_only=True)
    opportunity_name   = serializers.CharField(
        source="opportunity_pipeline.opportunity.name", read_only=True
    )
    opportunity_id     = serializers.IntegerField(
        source="opportunity_pipeline.opportunity.id",  read_only=True
    )

    class Meta:
        model = PipelineAlert
        fields = [
            "id", "alert_type", "alert_type_display",
            "severity", "severity_display",
            "message", "is_read", "is_resolved",
            "opportunity_name", "opportunity_id",
            "assigned_to", "created_at",
        ]
        read_only_fields = [
            "alert_type_display", "severity_display",
            "opportunity_name", "opportunity_id",
            "created_at",
        ]


# ──────────────────────────────────────────────────────────
# OPPORTUNITY PIPELINE — serializer de base
# ──────────────────────────────────────────────────────────
class OpportunityPipelineSerializer(serializers.ModelSerializer):
    opportunity_name         = serializers.CharField(source="opportunity.name",                  read_only=True)
    opportunity_amount       = serializers.DecimalField(source="opportunity.amount", max_digits=12, decimal_places=2, read_only=True)
    opportunity_assigned_to  = serializers.SerializerMethodField()
    opportunity_expected_close = serializers.DateField(source="opportunity.expected_close_date", read_only=True)
    current_stage_detail     = PipelineStageSerializer(source="current_stage", read_only=True)
    time_metrics             = serializers.SerializerMethodField()
    history                  = StageHistorySerializer(many=True, read_only=True)
    alerts                   = PipelineAlertSerializer(many=True, read_only=True)
    status_display           = serializers.CharField(source="get_status_display", read_only=True)
    tasks_summary            = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityPipeline
        fields = [
            "id",
            "opportunity", "opportunity_name", "opportunity_amount",
            "opportunity_assigned_to", "opportunity_expected_close",
            "pipeline",
            "current_stage", "current_stage_detail",
            "stage_entered_at",
            "status", "status_display",
            "progression",
            "time_metrics",
            "notes",
            "history",
            "alerts",
            "tasks_summary",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "company", "progression", "status",
            "current_stage_detail", "time_metrics",
            "history", "alerts", "tasks_summary",
            "opportunity_name", "opportunity_amount",
            "opportunity_assigned_to", "opportunity_expected_close",
            "status_display", "created_at", "updated_at",
        ]

    def get_opportunity_assigned_to(self, obj):
        user = obj.opportunity.assigned_to
        if user:
            return {"id": user.id, "username": user.username, "role": user.role}
        return None

    def get_time_metrics(self, obj):
        return obj.get_time_metrics()

    def get_tasks_summary(self, obj):
        """✅ FIX: timezone était manquant — maintenant importé en haut du fichier."""
        from .models import Task
        tasks = Task.objects.filter(
            opportunity=obj.opportunity,
            company=obj.company,
        )
        total   = tasks.count()
        done    = tasks.filter(status="done").count()
        overdue = tasks.filter(
            status__in=["todo", "in_progress"],
            due_date__lt=timezone.now()   # ✅ timezone disponible
        ).count()
        return {
            "total":          total,
            "done":           done,
            "pending":        total - done,
            "overdue":        overdue,
            "completion_pct": round((done / total) * 100, 1) if total > 0 else 0,
        }


# ──────────────────────────────────────────────────────────
# OPPORTUNITY PIPELINE — version liste légère (Kanban)
# ──────────────────────────────────────────────────────────
class OpportunityPipelineListSerializer(serializers.ModelSerializer):
    opportunity_name      = serializers.CharField(source="opportunity.name",   read_only=True)
    opportunity_amount    = serializers.DecimalField(source="opportunity.amount", max_digits=12, decimal_places=2, read_only=True)
    opportunity_assigned_to = serializers.SerializerMethodField()
    current_stage_name    = serializers.CharField(source="current_stage.name",      read_only=True, default=None)
    current_stage_color   = serializers.CharField(source="current_stage.color_hex", read_only=True, default=None)
    time_metrics          = serializers.SerializerMethodField()
    status_display        = serializers.CharField(source="get_status_display", read_only=True)
    alerts_count          = serializers.SerializerMethodField()
    tasks_summary         = serializers.SerializerMethodField()

    class Meta:
        model = OpportunityPipeline
        fields = [
            "id", "opportunity", "opportunity_name", "opportunity_amount",
            "opportunity_assigned_to",
            "pipeline", "current_stage", "current_stage_name", "current_stage_color",
            "stage_entered_at", "status", "status_display",
            "progression", "time_metrics",
            "alerts_count", "tasks_summary",
            "updated_at",
        ]
        read_only_fields = fields

    def get_opportunity_assigned_to(self, obj):
        user = obj.opportunity.assigned_to
        if user:
            return {"id": user.id, "username": user.username}
        return None

    def get_time_metrics(self, obj):
        return obj.get_time_metrics()

    def get_alerts_count(self, obj):
        return obj.alerts.filter(is_resolved=False).count()

    def get_tasks_summary(self, obj):
        """✅ FIX: timezone importé globalement."""
        from .models import Task
        tasks = Task.objects.filter(opportunity=obj.opportunity, company=obj.company)
        total = tasks.count()
        done  = tasks.filter(status="done").count()
        return {
            "total":          total,
            "done":           done,
            "completion_pct": round((done / total) * 100, 1) if total > 0 else 0,
        }


# ──────────────────────────────────────────────────────────
# OPPORTUNITY PIPELINE — version détail enrichie (retrieve)
# ──────────────────────────────────────────────────────────
class OpportunityPipelineDetailSerializer(serializers.ModelSerializer):
    """Serializer enrichi avec completion des tâches + tâches bloquantes."""
    opportunity_name          = serializers.CharField(source="opportunity.name",          read_only=True)
    opportunity_amount        = serializers.DecimalField(source="opportunity.amount", max_digits=12, decimal_places=2, read_only=True)
    opportunity_assigned_to   = serializers.SerializerMethodField()
    opportunity_expected_close = serializers.DateField(source="opportunity.expected_close_date", read_only=True)
    current_stage_detail      = PipelineStageSerializer(source="current_stage", read_only=True)
    time_metrics              = serializers.SerializerMethodField()
    history                   = serializers.SerializerMethodField()
    alerts                    = serializers.SerializerMethodField()
    status_display            = serializers.CharField(source="get_status_display", read_only=True)
    tasks_summary             = serializers.SerializerMethodField()
    stage_completion          = serializers.SerializerMethodField()

    class Meta:
        model  = OpportunityPipeline
        fields = [
            "id",
            "opportunity", "opportunity_name", "opportunity_amount",
            "opportunity_assigned_to", "opportunity_expected_close",
            "pipeline",
            "current_stage", "current_stage_detail",
            "stage_entered_at",
            "status", "status_display",
            "progression",
            "time_metrics",
            "notes",
            "history",
            "alerts",
            "tasks_summary",
            "stage_completion",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "company", "progression", "status",
            "current_stage_detail", "time_metrics",
            "history", "alerts", "tasks_summary",
            "stage_completion",
            "opportunity_name", "opportunity_amount",
            "opportunity_assigned_to", "opportunity_expected_close",
            "status_display", "created_at", "updated_at",
        ]

    def get_opportunity_assigned_to(self, obj):
        user = obj.opportunity.assigned_to
        if user:
            return {"id": user.id, "username": user.username, "role": user.role}
        return None

    def get_time_metrics(self, obj):
        return obj.get_time_metrics()

    def get_history(self, obj):
        qs = obj.history.select_related(
            "from_stage", "to_stage", "performed_by"
        ).order_by("created_at")
        return StageHistorySerializer(qs, many=True).data

    def get_alerts(self, obj):
        qs = obj.alerts.filter(is_resolved=False).order_by("-created_at")
        return PipelineAlertSerializer(qs, many=True).data

    def get_tasks_summary(self, obj):
        """✅ FIX: timezone importé globalement."""
        from .models import Task
        tasks   = Task.objects.filter(opportunity=obj.opportunity, company=obj.company)
        total   = tasks.count()
        done    = tasks.filter(status="done").count()
        overdue = tasks.filter(
            status__in=["todo", "in_progress"],
            due_date__lt=timezone.now()
        ).count()
        return {
            "total":          total,
            "done":           done,
            "pending":        total - done,
            "overdue":        overdue,
            "completion_pct": round((done / total) * 100, 1) if total > 0 else 0,
        }

    def get_stage_completion(self, obj):
        """
        ✅ Vérifie si les tâches liées à cette opportunité sont toutes terminées.
        Utilisé pour le blocage semi-fort du passage à l'étape suivante.
        Le verrou s'affiche dans le Kanban et le drawer détail.
        """
        if not obj.current_stage:
            return {
                "can_advance":    True,
                "blocking_tasks": [],
                "completed":      0,
                "total":          0,
                "completion_pct": 100,
            }

        from .models import Task
        stage_tasks = Task.objects.filter(
            opportunity=obj.opportunity,
            company=obj.company,
        ).exclude(status="cancelled")

        total    = stage_tasks.count()
        done     = stage_tasks.filter(status="done").count()
        blocking = list(
            stage_tasks.exclude(status="done").values(
                "id", "title", "status", "priority", "due_date"
            )
        )
        can_advance = len(blocking) == 0

        return {
            "can_advance":    can_advance,
            "blocking_tasks": blocking,
            "completed":      done,
            "total":          total,
            "completion_pct": round((done / total) * 100, 1) if total > 0 else 100,
        }


# ──────────────────────────────────────────────────────────
# PIPELINE ANALYTICS (lecture seule)
# ──────────────────────────────────────────────────────────
class PipelineAnalyticsSerializer(serializers.Serializer):
    pipeline_id           = serializers.IntegerField()
    pipeline_name         = serializers.CharField()
    total_opportunities   = serializers.IntegerField()
    total_value           = serializers.DecimalField(max_digits=15, decimal_places=2)
    by_stage              = serializers.ListField()
    by_status             = serializers.DictField()
    avg_duration_by_stage = serializers.ListField()
    conversion_rates      = serializers.ListField()
    blocked_opportunities = serializers.IntegerField()