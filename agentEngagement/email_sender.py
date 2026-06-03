import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger("agentEngagement.email_sender")


def send_prepared_email(prospect, subject: str, message: str) -> str:
    if not prospect.email:
        return "missing_email"

    if not message:
        return "missing_message"

    send_mail(
        subject=subject or "Contact",
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[prospect.email],
        fail_silently=False,
    )

    logger.info("[email_sender] Email envoyé à Prospect #%s", prospect.pk)

    return "message_sent"