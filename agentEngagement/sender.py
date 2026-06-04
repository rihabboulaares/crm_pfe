import logging

from .email_sender import send_prepared_email
from .social.facebook_sender import send_facebook_message
from .social.instagram_sender import send_instagram_message
from .social.linkedin_sender import send_linkedin_message
from .social.session_manager import (
    ensure_social_session,
    linkedin_login_required_response,
    social_login_required_response,
)

logger = logging.getLogger("agentEngagement.sender")


class EngagementSender:
    def send_prepared(self, prospect, user, send=True) -> dict:
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
            if not send:
                return {
                    "success": True,
                    "status": "message_ready",
                    "sent": False,
                    "test_mode": True,
                    "channel": channel,
                }

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
                session_result = ensure_social_session(
                    user_id=user.id,
                    platform=channel,
                )

                if not session_result.get("success"):
                    return {
                        **session_result,
                        "sent": False,
                        "channel": channel,
                    }

                status = send_facebook_message(
                    profile_url=prospect.facebook_url,
                    message=message,
                    user_id=user.id,
                    send=True,
                )

            elif channel == "instagram":
                session_result = ensure_social_session(
                    user_id=user.id,
                    platform=channel,
                )

                if not session_result.get("success"):
                    return {
                        **session_result,
                        "sent": False,
                        "channel": channel,
                    }

                status = send_instagram_message(
                    profile_url=prospect.instagram_url,
                    message=message,
                    user_id=user.id,
                    send=True,
                )

            else:
                return {"success": False, "status": "unsupported_channel"}

            if status == "linkedin_login_required":
                return {
                    **linkedin_login_required_response(),
                    "sent": False,
                    "channel": channel,
                }

            if status in {"instagram_login_required", "facebook_login_required"}:
                platform = status.replace("_login_required", "")
                return {
                    **social_login_required_response(platform),
                    "sent": False,
                    "channel": channel,
                }

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
