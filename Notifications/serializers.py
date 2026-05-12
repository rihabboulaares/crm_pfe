# notifications/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import HistoryLog, Notification

User = get_user_model()


class ActorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["id", "username", "role"]


class HistoryLogSerializer(serializers.ModelSerializer):
    actor          = ActorSerializer(read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    entity_display = serializers.CharField(source="get_entity_type_display", read_only=True)

    class Meta:
        model  = HistoryLog
        fields = [
            "id", "actor", "action", "action_display",
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