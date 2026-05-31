from agentEngagement.social.facebook_sender import send_facebook_message
from agentEngagement.social.instagram_sender import send_instagram_message
from agentEngagement.social.linkedin_sender import send_linkedin_message


class EngagementSender:
    def send_message(
        self,
        channel: str,
        profile_url: str,
        message: str,
        user_id: int,
        send: bool = False,
    ) -> dict:
        channel = (channel or "").lower().strip()

        if not profile_url:
            return {
                "success": False,
                "status": "missing_url",
                "channel": channel,
                "profile_url": profile_url,
                "message": "URL du profil manquante.",
            }

        if not message:
            return {
                "success": False,
                "status": "missing_message",
                "channel": channel,
                "profile_url": profile_url,
                "message": "Message vide.",
            }

        try:
            if channel == "facebook":
                status = send_facebook_message(
                    profile_url=profile_url,
                    message=message,
                    user_id=user_id,
                    send=send,
                )

            elif channel == "instagram":
                status = send_instagram_message(
                    profile_url=profile_url,
                    message=message,
                    user_id=user_id,
                    send=send,
                )

            elif channel == "linkedin":
                status = send_linkedin_message(
                    profile_url=profile_url,
                    message=message,
                    user_id=user_id,
                    send=send,
                )

            else:
                return {
                    "success": False,
                    "status": "unsupported_channel",
                    "channel": channel,
                    "profile_url": profile_url,
                    "message": f"Canal non supporté : {channel}",
                }

            return {
                "success": status in {
                    "message_sent",
                    "message_ready",
                    "connection_request_sent",
                    "already_pending",
                    "test_mode",
                    "success",
                },
                "status": status,
                "channel": channel,
                "profile_url": profile_url,
            }

        except Exception as exc:
            return {
                "success": False,
                "status": "sender_error",
                "channel": channel,
                "profile_url": profile_url,
                "error": str(exc)[:500],
            }