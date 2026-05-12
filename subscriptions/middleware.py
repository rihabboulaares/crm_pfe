# subscriptions/middleware.py
import logging
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Routes autorisées pour TOUT le monde (même abonnement expiré)
PUBLIC_ROUTES = [
    "/api/users/login/",
    "/api/users/refresh/",
    "/api/token/",
    "/api/token/refresh/",
    "/admin/",
]

# Routes autorisées pour l'ADMIN même si abonnement expiré
ADMIN_ALLOWED_ROUTES = [
    "/api/users/me/",
    "/api/users/logout/",
    "/api/subscriptions/current/",
    "/api/subscriptions/plans/",
    "/api/subscriptions/upgrade/",
    "/api/subscriptions/create-checkout-session/",
    "/api/subscriptions/webhook/",
]


def _matches(path, routes):
    return any(path.startswith(r) for r in routes)


class SubscriptionMiddleware:
    """
    Bloque toutes les routes API si abonnement expiré/inactif.

    ┌─────────────────┬──────────────────────────────────┬──────────────────────┐
    │ Situation        │ ADMIN                            │ Manager/Commercial   │
    ├─────────────────┼──────────────────────────────────┼──────────────────────┤
    │ Abonnement OK   │ Tout autorisé                    │ Tout autorisé        │
    │ Expiré/inactif  │ /me/ + /subscriptions/* seulement│ login/refresh seul   │
    │ Pas d'abonnement│ Idem expiré                      │ login/refresh seul   │
    │ Superadmin      │ Toujours autorisé                │ —                    │
    │ Webhook Stripe  │ Toujours autorisé                │ Toujours autorisé    │
    └─────────────────┴──────────────────────────────────┴──────────────────────┘
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # 1. Webhook Stripe → jamais bloquer
        if path.startswith("/api/subscriptions/webhook/"):
            return self.get_response(request)

        # 2. Routes publiques → toujours passer
        if _matches(path, PUBLIC_ROUTES):
            return self.get_response(request)

        # 3. Hors API → passer (React, admin Django, etc.)
        if not path.startswith("/api/"):
            return self.get_response(request)

        # 4. Non authentifié → laisser DRF gérer (401)
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return self.get_response(request)

        # 5. Superadmin Django → toujours autorisé
        if user.is_staff or user.is_superuser:
            return self.get_response(request)

        # 6. Récupérer la company
        company = getattr(user, "company", None)
        if not company:
            return self.get_response(request)

        # 7. Récupérer l'abonnement
        try:
            subscription = company.subscription
        except Exception:
            subscription = None

        # 8. Pas d'abonnement
        if subscription is None:
            if user.role == "ADMIN" and _matches(path, ADMIN_ALLOWED_ROUTES):
                return self.get_response(request)
            return _blocked("no_subscription",
                "Aucun abonnement actif. Contactez votre administrateur.")

        # 9. Abonnement OK → tout autorisé
        if not subscription.is_blocked():
            return self.get_response(request)

        # 10. Abonnement expiré/inactif
        if user.role == "ADMIN" and _matches(path, ADMIN_ALLOWED_ROUTES):
            return self.get_response(request)

        # Membres → bloqués
        return _blocked("subscription_expired",
            "Votre abonnement a expiré. Contactez votre administrateur.")


def _blocked(error_code, message):
    return JsonResponse(
        {"error": error_code, "message": message, "redirect": "/subscriptions"},
        status=403,
    )