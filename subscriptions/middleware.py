import logging

from django.http import JsonResponse

logger = logging.getLogger(__name__)

PUBLIC_ROUTES = [
    "/api/users/login/",
    "/api/users/refresh/",
    "/api/token/",
    "/api/token/refresh/",
    "/admin/",
]

ADMIN_ALLOWED_ROUTES = [
    "/api/users/me/",
    "/api/users/logout/",
    "/api/subscriptions/current/",
    "/api/subscriptions/plans/",
    "/api/subscriptions/upgrade/",
    "/api/subscriptions/create-checkout-session/",
    "/api/subscriptions/webhook/",
]

FEATURE_ROUTES = {
    "crm_agent": [
        "/api/agent-crm/",
        "/api/crm-agent/",
        "/api/agent/chat/",
        "/api/agent/reset/",
        "/api/agent/status/",
        "/api/agent/file/",
    ],
    "prospection_agent": [
        "/api/agent/prospect/",
        "/api/prospection/",
    ],
    "engagement_agent": [
        "/api/engagement/",
        "/api/agentEngagement/",
    ],
    "exports": [
        "/api/export/",
        "/api/reports/export/",
    ],
}


def _matches(path, routes):
    return any(path.startswith(r) for r in routes)


def _get_required_feature(path):
    for feature, routes in FEATURE_ROUTES.items():
        if _matches(path, routes):
            return feature
    return None


def _feature_message(feature):
    messages = {
        "prospection_agent": "L'agent de prospection est disponible à partir de l'abonnement Pro.",
        "engagement_agent": "L'agent d'engagement est disponible uniquement avec l'abonnement Enterprise.",
        "exports": "Les exports PDF/Excel sont disponibles à partir de l'abonnement Pro.",
        "crm_agent": "L'agent CRM nécessite un abonnement actif.",
    }
    return messages.get(
        feature, "Cette fonctionnalité n'est pas disponible dans votre abonnement actuel."
    )


def _is_company_admin(user):
    return str(getattr(user, "role", "")).upper() == "ADMIN"


def _blocked(error_code, message, redirect="/subscriptions", **extra):
    payload = {
        "error": error_code,
        "message": message,
        "redirect": redirect,
    }
    payload.update(extra)
    return JsonResponse(payload, status=403)


class SubscriptionMiddleware:
    """Block expired subscriptions globally and enforce plan-scoped feature routes."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        if path.startswith("/api/subscriptions/webhook/"):
            return self.get_response(request)

        if _matches(path, PUBLIC_ROUTES):
            return self.get_response(request)

        if not path.startswith("/api/"):
            return self.get_response(request)

        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return self.get_response(request)

        if user.is_staff or user.is_superuser:
            return self.get_response(request)

        company = getattr(user, "company", None)
        if not company:
            return self.get_response(request)

        try:
            subscription = company.subscription
        except Exception:
            subscription = None

        if subscription is None:
            if _is_company_admin(user) and _matches(path, ADMIN_ALLOWED_ROUTES):
                return self.get_response(request)
            return _blocked(
                "no_subscription",
                "Aucun abonnement actif. Contactez votre administrateur.",
            )

        if not subscription.is_blocked():
            required_feature = _get_required_feature(path)
            if required_feature and not subscription.can_use(required_feature):
                return _blocked(
                    "feature_not_allowed",
                    _feature_message(required_feature),
                    redirect="/subscriptions/upgrade",
                    required_feature=required_feature,
                    current_plan=subscription.plan.name if subscription.plan else None,
                )
            return self.get_response(request)

        if _is_company_admin(user) and _matches(path, ADMIN_ALLOWED_ROUTES):
            return self.get_response(request)

        return _blocked(
            "subscription_expired",
            "Votre abonnement a expiré. Contactez votre administrateur.",
        )
