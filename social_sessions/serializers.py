from rest_framework import serializers

from .models import SocialSession


class SocialSessionSerializer(serializers.ModelSerializer):
    health_status = serializers.SerializerMethodField()
    session_ready = serializers.SerializerMethodField()

    class Meta:
        model = SocialSession
        fields = [
            "id",
            "platform",
            "status",
            "health_status",
            "session_ready",
            "last_checked_at",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_health_status(self, obj):
        if obj.status == SocialSession.CONNECTED:
            return SocialSession.SESSION_READY
        return obj.status

    def get_session_ready(self, obj):
        return obj.status == SocialSession.CONNECTED
