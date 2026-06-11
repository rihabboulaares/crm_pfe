from rest_framework.exceptions import PermissionDenied


def check_limits(company, action):
    """
    Vérifie les limites du plan avant certaines actions.

    action: "add_user" | "create_team" | "add_prospect"
    """
    subscription = getattr(company, "subscription", None)

    if not subscription or subscription.is_blocked():
        raise PermissionDenied(
            {
                "error": "subscription_expired",
                "message": "Votre abonnement est expiré ou inactif.",
                "redirect": "/subscriptions",
            }
        )

    plan = subscription.plan
    if not plan:
        raise PermissionDenied(
            {
                "error": "subscription_expired",
                "message": "Votre abonnement est expiré ou inactif.",
                "redirect": "/subscriptions",
            }
        )

    if action == "add_user":
        max_val = plan.max_users
        current_val = company.users.count()
        label = "utilisateurs"
    elif action == "create_team":
        max_val = plan.max_teams
        current_val = company.teams.count()
        label = "équipes"
    elif action == "add_prospect":
        from sales.models import Prospect

        max_val = plan.max_prospects
        current_val = Prospect.objects.filter(company=company).count()
        label = "prospects"
    else:
        raise ValueError(f"Action inconnue : {action}")

    if max_val is not None and current_val >= max_val:
        messages = {
            "add_user": (
                "Vous avez atteint la limite d'utilisateurs de votre abonnement. "
                "Passez à un plan supérieur pour ajouter plus d'utilisateurs."
            ),
            "create_team": "Vous avez atteint la limite d'équipes de votre abonnement.",
            "add_prospect": (
                f"Limite {label} atteinte ({current_val}/{max_val}). "
                "Upgradez votre plan pour continuer."
            ),
        }
        raise PermissionDenied(
            {
                "error": "limit_reached",
                "message": messages.get(action, f"Limite {label} atteinte."),
                "redirect": "/subscriptions/upgrade",
                "limit_type": action,
                "current": current_val,
                "max": max_val,
            }
        )

    return True


def check_feature_access(company, feature):
    subscription = getattr(company, "subscription", None)

    if not subscription or subscription.is_blocked():
        raise PermissionDenied(
            {
                "error": "subscription_expired",
                "message": "Votre abonnement est expiré ou inactif.",
                "redirect": "/subscriptions",
            }
        )

    if not subscription.can_use(feature):
        raise PermissionDenied(
            {
                "error": "feature_not_allowed",
                "message": "Cette fonctionnalité n'est pas disponible dans votre abonnement actuel.",
                "redirect": "/subscriptions/upgrade",
                "required_feature": feature,
                "current_plan": subscription.plan.name if subscription.plan else None,
            }
        )

    return True
