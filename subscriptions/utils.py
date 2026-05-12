# subscriptions/utils.py
from rest_framework.exceptions import PermissionDenied


def check_limits(company, action):
    """
    Vérifie les limites du plan avant certaines actions.

    :param company: instance Company
    :param action:  "add_user" | "create_team" | "add_prospect"
    :raises PermissionDenied: si limite dépassée ou abonnement inactif
    """
    subscription = getattr(company, "subscription", None)

    if not subscription or not subscription.is_active or subscription.expired:
        raise PermissionDenied("Vous n'avez pas d'abonnement actif.")

    plan = subscription.plan
    if not plan:
        raise PermissionDenied("Aucun plan associé à votre abonnement.")

    if action == "add_user":
        max_val = plan.max_users
        current_val = company.users.count()
        label = "utilisateurs"

    elif action == "create_team":
        max_val = plan.max_teams
        current_val = company.teams.count()
        label = "équipes"

    elif action == "add_prospect":
        max_val = plan.max_prospects
        # Prospect est dans l'app sales → import local pour éviter les imports circulaires
        from sales.models import Prospect
        current_val = Prospect.objects.filter(company=company).count()
        label = "prospects"

    else:
        raise ValueError(f"Action inconnue : {action}")

    if max_val is not None and current_val >= max_val:
        raise PermissionDenied(
            f"Limite {label} atteinte ({current_val}/{max_val}). "
            f"Upgradez votre plan pour continuer."
        )