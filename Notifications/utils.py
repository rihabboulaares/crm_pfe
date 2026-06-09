def get_user_display_name(user):
    if not user:
        return "Système"

    first_name = (getattr(user, "first_name", "") or "").strip()
    last_name = (getattr(user, "last_name", "") or "").strip()
    full_name = f"{first_name} {last_name}".strip()

    if full_name:
        return full_name

    if first_name:
        return first_name

    username = getattr(user, "username", None)
    if username:
        return username

    email = getattr(user, "email", None)
    if email:
        return email

    return str(user)
