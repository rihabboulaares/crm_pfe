import logging

from .email_providers.base import (
    EMAIL_LOGIN_REQUIRED,
    EMAIL_MESSAGE_EMPTY,
    EMAIL_RECIPIENT_MISSING,
    EmailSendResult,
)
from .email_providers.router import get_email_provider
from .models import UserEmailConnection

logger = logging.getLogger("agentEngagement.email_sender")


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


def send_prepared_email(prospect, user, subject: str, message: str) -> dict:
    if not getattr(prospect, "email", None):
        return EmailSendResult(False, EMAIL_RECIPIENT_MISSING, "Email prospect manquant.").to_dict()

    if not (message or "").strip():
        return EmailSendResult(False, EMAIL_MESSAGE_EMPTY, "Message vide interdit.").to_dict()

    connection = get_active_email_connection(user)
    if not connection:
        return EmailSendResult(False, EMAIL_LOGIN_REQUIRED, "Connectez Gmail ou Microsoft avant d'envoyer un email.").to_dict()

    try:
        provider = get_email_provider(connection.provider)
        result = provider.send_email(connection, prospect.email, subject, message)
    except Exception as exc:
        logger.exception("[email_sender] Erreur provider email")
        result = EmailSendResult(False, "EMAIL_SEND_FAILED", str(exc)[:500], provider=getattr(connection, "provider", ""))

    logger.info("[email_sender] result=%s prospect=%s user=%s", result.code, prospect.pk, user.pk)
    return result.to_dict()
