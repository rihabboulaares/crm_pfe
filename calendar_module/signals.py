"""
calendar_module/serializers.py
Serializer enrichi — expose tous les champs CRM utiles au frontend.
"""
from rest_framework import serializers
from .models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    # ── Champs calculés (lecture seule) ───────────────────────────────────
    color_resolved   = serializers.ReadOnlyField(source="color_resolved")

    # ── Task ──────────────────────────────────────────────────────────────
    task_title       = serializers.CharField(source="task.title",        read_only=True)
    task_status      = serializers.CharField(source="task.status",       read_only=True)
    task_priority    = serializers.CharField(source="task.priority",     read_only=True)
    task_type        = serializers.CharField(source="task.task_type",    read_only=True)
    task_quota_pct   = serializers.ReadOnlyField(source="task.quota_percentage")
    task_is_overdue  = serializers.ReadOnlyField(source="task.is_overdue")

    # ── Opportunity ───────────────────────────────────────────────────────
    opportunity_name  = serializers.CharField(source="opportunity.name",  read_only=True)
    opportunity_stage = serializers.CharField(source="opportunity.stage", read_only=True)
    opportunity_amount= serializers.DecimalField(
        source="opportunity.amount", max_digits=12, decimal_places=2, read_only=True
    )

    # ── Pipeline / Stage ──────────────────────────────────────────────────
    stage_name       = serializers.CharField(source="pipeline_stage.name",          read_only=True)
    pipeline_name    = serializers.CharField(source="pipeline_stage.pipeline.name", read_only=True)
    stage_color_hex  = serializers.ReadOnlyField(source="pipeline_stage.color_hex")
    stage_order      = serializers.IntegerField(source="pipeline_stage.order",      read_only=True)

    # ── OpportunityPipeline ───────────────────────────────────────────────
    op_status        = serializers.CharField(source="opportunity_pipeline.status",     read_only=True)
    op_progression   = serializers.FloatField(source="opportunity_pipeline.progression", read_only=True)

    # ── TaskActivity ──────────────────────────────────────────────────────
    activity_type    = serializers.CharField(source="task_activity.activity_type",   read_only=True)
    activity_result  = serializers.CharField(source="task_activity.call_result",     read_only=True)
    meeting_location = serializers.CharField(source="task_activity.meeting_location",read_only=True)

    # ── PipelineAlert ─────────────────────────────────────────────────────
    alert_type       = serializers.CharField(source="pipeline_alert.alert_type",     read_only=True)
    alert_severity   = serializers.CharField(source="pipeline_alert.severity",       read_only=True)
    alert_is_read    = serializers.BooleanField(source="pipeline_alert.is_read",     read_only=True)

    # ── Assigné ──────────────────────────────────────────────────────────
    assigned_name    = serializers.SerializerMethodField()
    assigned_avatar  = serializers.SerializerMethodField()

    class Meta:
        model  = CalendarEvent
        fields = [
            # Champs propres CalendarEvent
            "id", "title", "description", "start", "end", "all_day",
            "event_type", "priority", "color", "color_resolved",
            "reminder", "is_synced", "created_at", "updated_at",
            # FKs (IDs bruts)
            "task", "opportunity", "pipeline_stage",
            "task_activity", "pipeline_alert", "opportunity_pipeline",
            "assigned_to", "company",
            # Champs enrichis Task
            "task_title", "task_status", "task_priority", "task_type",
            "task_quota_pct", "task_is_overdue",
            # Champs enrichis Opportunity
            "opportunity_name", "opportunity_stage", "opportunity_amount",
            # Champs enrichis Pipeline/Stage
            "stage_name", "pipeline_name", "stage_color_hex", "stage_order",
            # Champs enrichis OpportunityPipeline
            "op_status", "op_progression",
            # Champs enrichis Activity
            "activity_type", "activity_result", "meeting_location",
            # Champs enrichis Alert
            "alert_type", "alert_severity", "alert_is_read",
            # Assigné
            "assigned_name", "assigned_avatar",
        ]
        read_only_fields = ["created_at", "updated_at", "is_synced"]

    def get_assigned_name(self, obj):
        if obj.assigned_to:
            u = obj.assigned_to
            full = f"{getattr(u, 'first_name', '')} {getattr(u, 'last_name', '')}".strip()
            return full or getattr(u, "username", str(u))
        return None

    def get_assigned_avatar(self, obj):
        if obj.assigned_to:
            return getattr(obj.assigned_to, "avatar_url", None)
        return None