from django.db.models import Q

from users.models import User


def _empty_users():
    return User.objects.none()


def get_visible_users(user):
    if not getattr(user, "company_id", None):
        return _empty_users()

    if getattr(user, "is_staff", False) or getattr(user, "role", "") == "ADMIN":
        return User.objects.filter(company=user.company, is_active=True)

    if getattr(user, "role", "") == "MANAGER":
        try:
            from agentEngagement.permissions import get_team_users_for_manager

            team_users = get_team_users_for_manager(user)
        except Exception:
            team_users = User.objects.filter(
                teams__in=user.teams.all(),
                company=user.company,
                role="COMMERCIAL",
                is_active=True,
            ).distinct()

        return User.objects.filter(
            Q(pk=user.pk) | Q(pk__in=team_users.filter(role="COMMERCIAL").values("pk")),
            company=user.company,
            is_active=True,
        ).distinct()

    if getattr(user, "role", "") == "COMMERCIAL":
        return User.objects.filter(pk=user.pk, company=user.company, is_active=True)

    return _empty_users()


def user_can_access_user(request_user, target_user):
    if not target_user:
        return False
    return get_visible_users(request_user).filter(pk=target_user.pk).exists()


def filter_by_visible_users(queryset, user, field="assigned_to"):
    return queryset.filter(**{f"{field}__in": get_visible_users(user)})
