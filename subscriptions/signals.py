# subscriptions/signals.py
from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.apps import apps
import logging

logger = logging.getLogger(__name__)


@receiver(post_migrate)
def create_default_plans(sender, **kwargs):
    """Crée les plans par défaut après chaque migration"""
    if sender.name != "subscriptions":
        return

    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")

    if SubscriptionPlan.objects.exists():
        return

    logger.info("Création des plans d'abonnement par défaut...")

    plans = [
        {
            "name": "starter",
            "price": 20.00,
            "max_users": 3,
            "max_teams": 1,
            "max_prospects": 50,
            "description": "Plan Starter pour petites équipes",
            "premium_features": {"reports": False, "priority_support": False},
            "duration_days": 30,
        },
        {
            "name": "pro",
            "price": 50.00,
            "max_users": 10,
            "max_teams": 5,
            "max_prospects": 500,
            "description": "Plan Pro pour PME",
            "premium_features": {"reports": True, "priority_support": False},
            "duration_days": 30,
        },
        {
            "name": "enterprise",
            "price": 100.00,
            "max_users": None,
            "max_teams": None,
            "max_prospects": None,
            "description": "Plan Enterprise illimité",
            "premium_features": {"reports": True, "priority_support": True},
            "duration_days": 30,
        },
    ]

    created_count = 0
    for plan_data in plans:
        _, created = SubscriptionPlan.objects.get_or_create(
            name=plan_data["name"], defaults=plan_data
        )
        if created:
            created_count += 1
            logger.info(f"  Plan créé : {plan_data['name']}")

    logger.info(f"Plans créés : {created_count}")