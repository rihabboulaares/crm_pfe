# notifications/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CRMEvent, HistoryLog, Notification
from .utils import get_user_display_name

User = get_user_model()


class ActorSerializer(serializers.ModelSerializer):
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    def get_first_name(self, obj):
        return getattr(obj, "first_name", "") or ""

    def get_last_name(self, obj):
        return getattr(obj, "last_name", "") or ""

    def get_full_name(self, obj):
        return get_user_display_name(obj)

    class Meta:
        model  = User
        fields = ["id", "username", "first_name", "last_name", "email", "full_name", "role"]


def resolve_actor_name(log):
    if log.actor_type == "engagement_agent":
        return "Agent d'engagement"

    if log.actor_type == "prospection_agent":
        return "Agent de prospection"

    user = getattr(log, "performed_by", None) or getattr(log, "actor", None)
    if user:
        return get_user_display_name(user)

    if log.actor_name:
        return log.actor_name

    if log.actor_type == "prospection_agent":
        return "Agent de prospection"

    if log.actor_type == "engagement_agent":
        return "Agent d'engagement"

    return "Système"


class HistoryLogSerializer(serializers.ModelSerializer):
    actor          = ActorSerializer(read_only=True)
    actor_id = serializers.IntegerField(read_only=True)
    performed_by_display = serializers.SerializerMethodField()
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    entity_display = serializers.CharField(source="get_entity_type_display", read_only=True)

    def get_performed_by_display(self, obj):
        return resolve_actor_name(obj)

    class Meta:
        model  = HistoryLog
        fields = [
            "id", "actor", "actor_id", "action", "action_display",
            "actor_type", "actor_name", "performed_by_display",
            "entity_type", "entity_display", "entity_id", "entity_name",
            "description", "old_value", "new_value",
            "created_at",
        ]


class NotificationSerializer(serializers.ModelSerializer):
    history_log = HistoryLogSerializer(read_only=True)

    class Meta:
        model  = Notification
        fields = [
            "id", "title", "message", "notif_type",
            "entity_type", "entity_id", "entity_name",
            "is_read", "created_at", "history_log",
        ]


class CRMEventSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    prospect_display = serializers.SerializerMethodField()
    company_display = serializers.SerializerMethodField()
    event_type_display = serializers.CharField(source="get_event_type_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    severity_display = serializers.CharField(source="get_severity_display", read_only=True)

    def get_user_display(self, obj):
        return get_user_display_name(obj.user) if obj.user else None

    def get_prospect_display(self, obj):
        prospect = obj.prospect
        if not prospect:
            return None
        name = f"{prospect.first_name or ''} {prospect.last_name or ''}".strip()
        company = getattr(prospect, "prospect_company", None)
        return name or getattr(company, "name", None) or prospect.email or f"Prospect #{prospect.id}"

    def get_company_display(self, obj):
        return getattr(obj.company, "name", None) if obj.company else None

    class Meta:
        model = CRMEvent
        fields = [
            "id", "event_type", "event_type_display", "category", "category_display",
            "title", "description", "severity", "severity_display", "source_type",
            "source_name", "source_id", "user", "user_display", "prospect",
            "prospect_display", "company", "company_display", "agent_run",
            "related_object_type", "related_object_id", "status", "channel",
            "metadata", "created_at",
        ]
        read_only_fields = fields
