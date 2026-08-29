from rest_framework import serializers

from .interaction_recorder import (
    INTERACTION_ACTION_TYPES,
    INTERACTION_CHANNELS,
    INTERACTION_OUTCOMES,
    normalize_interaction_value,
)


class EngagementInteractionSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=INTERACTION_CHANNELS)
    action_type = serializers.ChoiceField(choices=INTERACTION_ACTION_TYPES)
    outcome = serializers.ChoiceField(choices=INTERACTION_OUTCOMES)
    prospect_response = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    commercial_notes = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    generated_content_reference = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    strategy_reference = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True, max_length=120)
    performed_at = serializers.DateTimeField(required=False)

    def to_internal_value(self, data):
        data = dict(data or {})
        for field in ("channel", "action_type", "outcome"):
            if field in data:
                data[field] = normalize_interaction_value(data[field])
        return super().to_internal_value(data)

    def validate(self, attrs):
        channel = attrs.get("channel")
        action_type = attrs.get("action_type")

        if action_type == "EMAIL_SENT" and channel != "EMAIL":
            raise serializers.ValidationError({"action_type": "EMAIL_SENT requires channel EMAIL."})

        if action_type == "PHONE_CALL" and channel != "PHONE":
            raise serializers.ValidationError({"action_type": "PHONE_CALL requires channel PHONE."})

        if action_type == "SOCIAL_MESSAGE_SENT" and channel not in {"LINKEDIN", "FACEBOOK", "INSTAGRAM"}:
            raise serializers.ValidationError(
                {"action_type": "SOCIAL_MESSAGE_SENT requires LINKEDIN, FACEBOOK or INSTAGRAM."}
            )

        return attrs
