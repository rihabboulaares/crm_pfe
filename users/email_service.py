import logging
from smtplib import SMTPException
from time import sleep

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from .models import TransactionalEmailLog

logger = logging.getLogger(__name__)


def render_auth_email(*, title, body, action_label=None, action_url=None, code=None):
    code_block = (
        f"""
        <div style="font-size:28px;font-weight:800;letter-spacing:8px;color:#b71c1c;
                    background:#fff5f5;border:1px solid #ffd7d7;border-radius:12px;
                    padding:16px 20px;text-align:center;margin:20px 0;">
          {code}
        </div>
        """
        if code
        else ""
    )
    action_block = (
        f"""
        <p style="margin:24px 0;">
          <a href="{action_url}" style="background:#b71c1c;color:#ffffff;text-decoration:none;
             padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block;">
            {action_label}
          </a>
        </p>
        """
        if action_label and action_url
        else ""
    )
    return f"""
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:28px;">
      <div style="max-width:560px;margin:0 auto;background:white;border:1px solid #e5e7eb;
                  border-radius:16px;overflow:hidden;">
        <div style="background:#b71c1c;color:white;padding:20px 24px;">
          <div style="font-size:18px;font-weight:800;">ViewiseCRM</div>
        </div>
        <div style="padding:24px;color:#1f2937;">
          <h1 style="font-size:22px;margin:0 0 12px;">{title}</h1>
          <p style="font-size:15px;line-height:1.6;margin:0;">{body}</p>
          {code_block}
          {action_block}
          <p style="font-size:12px;color:#64748b;line-height:1.5;margin-top:24px;">
            Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
          </p>
        </div>
      </div>
    </div>
    """


def send_transactional_email(
    *,
    email_type,
    recipient,
    subject,
    text_body,
    html_body=None,
    user=None,
    metadata=None,
    max_attempts=2,
):
    log = TransactionalEmailLog.objects.create(
        email_type=email_type,
        recipient=recipient,
        subject=subject,
        user=user,
        metadata=metadata or {},
    )

    last_error = ""
    for attempt in range(1, max_attempts + 1):
        try:
            message = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient],
            )
            if html_body:
                message.attach_alternative(html_body, "text/html")
            message.send(fail_silently=False)

            log.status = TransactionalEmailLog.Status.SENT
            log.attempts = attempt
            log.error_message = ""
            log.sent_at = timezone.now()
            log.save(update_fields=["status", "attempts", "error_message", "sent_at", "updated_at"])
            return True, None, log
        except (SMTPException, OSError) as exc:
            last_error = str(exc)
            logger.warning(
                "Transactional email failed type=%s recipient=%s attempt=%s error=%s",
                email_type,
                recipient,
                attempt,
                last_error,
            )
            if attempt < max_attempts:
                sleep(1)

    log.status = TransactionalEmailLog.Status.FAILED
    log.attempts = max_attempts
    log.error_message = last_error[:2000]
    log.save(update_fields=["status", "attempts", "error_message", "updated_at"])
    return False, last_error, log
