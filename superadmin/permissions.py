# superadmin/permissions.py
from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """
    Autorise uniquement :
      - is_superuser = True  (créé via createsuperuser)
      - OU role = SUPERADMIN
    Compatible avec le champ User.Role.SUPERADMIN existant.
    """
    message = "Accès réservé au Super Admin."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_superuser
            or request.user.role == "SUPERADMIN"
        )