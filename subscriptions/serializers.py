# subscriptions/serializers.py
from rest_framework import serializers
from .models import SubscriptionPlan, CompanySubscription
from django.utils import timezone


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "name",
            "price",
            "max_users",
            "max_teams",
            "max_prospects",
            "description",
            "premium_features",
            # ⚠️ "is_trial" RETIRÉ — ce champ n'existe pas sur SubscriptionPlan
        ]


class CompanySubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    trial_expired = serializers.SerializerMethodField()

    class Meta:
        model = CompanySubscription
        fields = [
            "plan",
            "is_active",
            "start_date",
            "end_date",
            "trial_expired",
        ]

    def get_trial_expired(self, obj):
        # is_trial est sur CompanySubscription, pas sur SubscriptionPlan
        if obj.is_trial and obj.end_date:
            return obj.end_date < timezone.now().date()
        return False