from pathlib import Path

from django.conf import settings


SUPPORTED_PLATFORMS = {"linkedin", "facebook", "instagram"}
BASE_SESSION_DIR = Path(settings.BASE_DIR) / "storage" / "social_sessions"
CHROME_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def normalize_platform(platform):
    value = (platform or "").lower().strip()
    if value not in SUPPORTED_PLATFORMS:
        raise ValueError(f"Plateforme non supportee: {platform}")
    return value
