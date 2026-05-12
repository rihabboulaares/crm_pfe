# notifications/middleware.py
"""
Middleware qui injecte l'utilisateur authentifié dans le thread-local.
Les signals Django lisent get_current_user() pour connaître l'acteur
sans que chaque view ait besoin de faire instance._actor = request.user.
"""
import threading

_thread_locals = threading.local()


def get_current_user():
    """Retourne l'utilisateur de la requête courante (ou None)."""
    return getattr(_thread_locals, "user", None)


class CurrentUserMiddleware:
    """
    Ajouter dans settings.py MIDDLEWARE (avant AuthenticationMiddleware) :
        "notifications.middleware.CurrentUserMiddleware",
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # On stocke l'user APRÈS l'authentification JWT (il sera hydraté)
        _thread_locals.user = getattr(request, "user", None)
        try:
            response = self.get_response(request)
        finally:
            # Nettoyage pour éviter les fuites entre requêtes (worker réutilisé)
            _thread_locals.user = None
        return response