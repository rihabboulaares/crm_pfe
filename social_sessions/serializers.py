from rest_framework import serializers

from .models import SocialSession


class SocialSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialSession
        fields = [
            "id",
            "platform",
            "status",
            "last_checked_at",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
