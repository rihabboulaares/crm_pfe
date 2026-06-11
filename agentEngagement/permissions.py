from django.db.models import Q

from sales.models import Prospect, Task
from sales.visibility import get_visible_users
from users.models import Team, User


def is_global_engagement_admin(user):
    return bool(getattr(user, "is_superuser", False) or getattr(user, "role", "") == "SUPERADMIN")


def is_company_engagement_admin(user):
    return bool(
        is_global_engagement_admin(user)
        or getattr(user, "is_staff", False)
        or getattr(user, "role", "") == "ADMIN"
    )


def get_team_users_for_manager(user):
    if not getattr(user, "company_id", None):
        return User.objects.none()

    teams = Team.objects.filter(company=user.company).filter(Q(owner=user) | Q(members=user)).distinct()
    return User.objects.filter(
        Q(id=user.id) | Q(teams__in=teams, role="COMMERCIAL"),
        company=user.company,
        is_active=True,
    ).distinct()


def get_engagement_queryset_for_user(user):
    qs = Prospect.objects.select_related("prospect_company", "assigned_to")

    if is_global_engagement_admin(user):
        return qs.all()

    if not getattr(user, "company_id", None):
        return qs.none()

    qs = qs.filter(company=user.company)
    role = getattr(user, "role", "")

    if is_company_engagement_admin(user):
        return qs

    if role == "MANAGER":
        return qs.filter(assigned_to__in=get_visible_users(user)).distinct()

    if role == "COMMERCIAL":
        return qs.filter(assigned_to=user).distinct()

    return qs.none()


def get_task_queryset_for_user(user):
    qs = Task.objects.select_related("assigned_to", "created_by", "prospect")

    if is_global_engagement_admin(user):
        return qs.all()

    if not getattr(user, "company_id", None):
        return qs.none()

    qs = qs.filter(company=user.company)
    role = getattr(user, "role", "")

    if is_company_engagement_admin(user):
        return qs

    if role == "MANAGER":
        return qs.filter(assigned_to__in=get_visible_users(user)).distinct()

    if role == "COMMERCIAL":
        return qs.filter(assigned_to=user).distinct()

    return qs.none()
