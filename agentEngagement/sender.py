import logging

from .email_sender import send_prepared_email
from .social.facebook_sender import send_facebook_message
from .social.instagram_sender import send_instagram_message
from .social.linkedin_sender import send_linkedin_message

logger = logging.getLogger("agentEngagement.sender")


class EngagementSender:
    def send_prepared(self, prospect, user) -> dict:
        channel = (prospect.last_engagement_channel or "").lower().strip()
        message = (prospect.generated_message or "").strip()
        subject = getattr(prospect, "engagement_subject", "") or "Contact"

        if not channel:
            return {"success": False, "status": "missing_channel"}

        if channel == "phone":
            return {
                "success": True,
                "status": "call_task_only",
                "sent": False,
                "message": "Canal téléphone : tâche d'appel seulement.",
            }

        if not message:
            return {"success": False, "status": "missing_message"}

        try:
            if channel == "email":
                status = send_prepared_email(prospect, subject, message)

            elif channel == "linkedin":
                status = send_linkedin_message(
                    profile_url=prospect.linkedin_url,
                    message=message,
                    user_id=user.id,
                    send=True,
                )

            elif channel == "facebook":
                status = send_facebook_message(
                    profile_url=prospect.facebook_url,
                    message=message,
                    user_id=user.id,
                    send=True,
                )

            elif channel == "instagram":
                status = send_instagram_message(
                    profile_url=prospect.instagram_url,
                    message=message,
                    user_id=user.id,
                    send=True,
                )

            else:
                return {"success": False, "status": "unsupported_channel"}

            return {
                "success": status in {"message_sent", "connection_request_sent"},
                "status": status,
                "sent": status in {"message_sent", "connection_request_sent"},
                "channel": channel,
            }

        except Exception as exc:
            logger.exception("[sender] Erreur envoi prepared")
            return {
                "success": False,
                "status": "sender_error",
                "error": str(exc)[:500],
            }