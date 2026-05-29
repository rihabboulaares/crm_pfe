def get_user_company(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None

    if hasattr(user, "company") and user.company:
        return user.company

    profile = getattr(user, "profile", None)
    if profile and hasattr(profile, "company") and profile.company:
        return profile.company

    if hasattr(user, "organization") and user.organization:
        return user.organization

    if hasattr(user, "tenant") and user.tenant:
        return user.tenant

    return None
