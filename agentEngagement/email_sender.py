from .models import UserEmailConnection


def get_active_email_connection(user):
    return (
        UserEmailConnection.objects.filter(user=user, is_active=True)
        .order_by("-last_verified_at", "-updated_at")
        .first()
    )


def build_sender_signature(user, connection=None):
    name = (
        getattr(connection, "display_name", None)
        or getattr(user, "username", "")
        or getattr(user, "email", "")
    )
    company_name = getattr(getattr(user, "company", None), "name", "")
    role = getattr(user, "job_title", "") or getattr(user, "role", "")
    lines = [str(name).strip()]
    meta = " - ".join(part for part in [role, company_name] if part)
    if meta:
        lines.append(meta)
    if connection and connection.email:
        lines.append(connection.email)
    return "\n".join(line for line in lines if line)


def get_sender_context(user):
    connection = get_active_email_connection(user)
    return {
        "sender_email": connection.email if connection else "",
        "sender_name": connection.display_name if connection else (getattr(user, "username", "") or ""),
        "sender_company": getattr(getattr(user, "company", None), "name", ""),
        "sender_role": getattr(user, "job_title", "") or getattr(user, "role", ""),
        "signature": build_sender_signature(user, connection),
        "email_connected": bool(connection),
        "email_provider": connection.provider if connection else "",
    }
