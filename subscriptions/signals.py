import logging

from django.apps import apps
from django.db.models.signals import post_migrate
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_migrate)
def create_default_plans(sender, **kwargs):
    """Create or update the default subscription plans after migrations."""
    if sender.name != "subscriptions":
        return

    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")

    plans = [
        {
            "name": "starter",
            "price": 20.00,
            "max_users": 3,
            "max_teams": 1,
            "max_prospects": 50,
            "description": "Plan Starter pour petites équipes",
            "premium_features": {
                "crm_agent": True,
                "prospection_agent": False,
                "engagement_agent": False,
                "exports": False,
                "reports": False,
                "priority_support": False,
            },
            "duration_days": 30,
        },
        {
            "name": "pro",
            "price": 50.00,
            "max_users": 10,
            "max_teams": 5,
            "max_prospects": 500,
            "description": "Plan Pro pour PME",
            "premium_features": {
                "crm_agent": True,
                "prospection_agent": True,
                "engagement_agent": False,
                "exports": True,
                "reports": True,
                "priority_support": False,
            },
            "duration_days": 30,
        },
        {
            "name": "enterprise",
            "price": 100.00,
            "max_users": None,
            "max_teams": None,
            "max_prospects": None,
            "description": "Plan Enterprise illimité",
            "premium_features": {
                "crm_agent": True,
                "prospection_agent": True,
                "engagement_agent": True,
                "exports": True,
                "reports": True,
                "priority_support": True,
            },
            "duration_days": 30,
        },
    ]

    created_count = 0
    updated_count = 0
    for plan_data in plans:
        plan, created = SubscriptionPlan.objects.get_or_create(
            name=plan_data["name"], defaults=plan_data
        )
        if created:
            created_count += 1
            logger.info("Plan créé : %s", plan_data["name"])
            continue

        for field, value in plan_data.items():
            if field != "name":
                setattr(plan, field, value)
        plan.save(
            update_fields=[
                "price",
                "max_users",
                "max_teams",
                "max_prospects",
                "description",
                "premium_features",
                "duration_days",
            ]
        )
        updated_count += 1

    logger.info("Plans par défaut synchronisés : %s créés, %s mis à jour", created_count, updated_count)
