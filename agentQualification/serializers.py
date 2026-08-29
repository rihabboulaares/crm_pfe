from rest_framework import serializers

from .models import ProspectQualification


class ProspectQualificationSerializer(serializers.ModelSerializer):
    prospect_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    previous_score = serializers.SerializerMethodField()
    score_delta = serializers.SerializerMethodField()

    class Meta:
        model = ProspectQualification
        fields = [
            "id",
            "prospect",
            "prospect_name",
            "created_by",
            "created_by_name",
            "created_at",
            "qualification_mode",
            "score",
            "previous_score",
            "score_delta",
            "deterministic_score",
            "confidence",
            "status",
            "opportunity_ready",
            "recommended_action",
            "strengths",
            "risks",
            "missing_information",
            "detected_needs",
            "objections",
            "buying_signals",
            "summary",
            "signal_details",
            "source_snapshot",
            "error_code",
            "error_message",
        ]
        read_only_fields = fields

    def get_prospect_name(self, obj):
        return str(obj.prospect)

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return ""
        return (
            getattr(user, "get_full_name", lambda: "")()
            or getattr(user, "username", "")
            or getattr(user, "email", "")
        )

    def get_previous_score(self, obj):
        previous = (
            ProspectQualification.objects.filter(prospect=obj.prospect, created_at__lt=obj.created_at)
            .order_by("-created_at")
            .first()
        )
        return previous.score if previous else None

    def get_score_delta(self, obj):
        previous_score = self.get_previous_score(obj)
        return obj.score - previous_score if previous_score is not None else None

