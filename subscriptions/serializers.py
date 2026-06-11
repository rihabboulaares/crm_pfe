from rest_framework import serializers

from .models import CompanySubscription, SubscriptionPlan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "price",
            "duration_days",
            "max_users",
            "max_teams",
            "max_prospects",
            "description",
            "premium_features",
            "stripe_price_id",
        ]


class CompanySubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    expired = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    allowed_features = serializers.SerializerMethodField()
    plan_key = serializers.SerializerMethodField()
    trial_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = CompanySubscription
        fields = [
            "plan",
            "plan_key",
            "is_active",
            "is_trial",
            "start_date",
            "end_date",
            "trial_end_date",
            "trial_expired",
            "expired",
            "days_until_expiry",
            "is_blocked",
            "allowed_features",
        ]

    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry()

    def get_is_blocked(self, obj):
        return obj.is_blocked()

    def get_allowed_features(self, obj):
        return obj.get_allowed_features()

    def get_plan_key(self, obj):
        return obj.get_plan_key()
