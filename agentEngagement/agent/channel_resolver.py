import logging

logger = logging.getLogger("agentEngagement.channels")


SUPPORTED_CHANNELS = ("email", "phone", "linkedin", "facebook", "instagram")

CHANNEL_METADATA = {
    "email": {
        "execution_mode": "integrated",
        "content_type": "email",
        "contact_key": "email",
    },
    "phone": {
        "execution_mode": "manual",
        "content_type": "call_script",
        "contact_key": "phone",
    },
    "linkedin": {
        "execution_mode": "manual",
        "content_type": "social_message",
        "contact_key": "linkedin_url",
    },
    "facebook": {
        "execution_mode": "manual",
        "content_type": "social_message",
        "contact_key": "facebook_url",
    },
    "instagram": {
        "execution_mode": "manual",
        "content_type": "social_message",
        "contact_key": "instagram_url",
    },
}


def _has_value(value):
    return bool(str(value or "").strip())


class ChannelResolver:
    """
    Resolve deterministic contact channel capabilities from a structured context.

    This class does not rank channels, choose a strategy, inspect history, read
    prospect scores or call Gemini. It only checks whether contact coordinates
    exist in the context builder output.
    """

    def resolve(self, context: dict) -> dict:
        contact = (context or {}).get("contact") or {}
        channels = {}

        for channel in SUPPORTED_CHANNELS:
            metadata = CHANNEL_METADATA[channel]
            channels[channel] = {
                "available": _has_value(contact.get(metadata["contact_key"])),
                "execution_mode": metadata["execution_mode"],
                "content_type": metadata["content_type"],
            }

        return channels

    def available_channel_names(self, context: dict) -> list[str]:
        channels = self.resolve(context)
        return [name for name, data in channels.items() if data.get("available")]


def log_resolved_channels(prospect_id, channels):
    available_count = sum(1 for data in (channels or {}).values() if data.get("available"))
    logger.info("[ENGAGEMENT][CHANNELS] prospect=%s available_count=%s", prospect_id, available_count)
