import logging
from pathlib import Path

from django.conf import settings
from django.utils import timezone


logger = logging.getLogger(__name__)

VERIFICATION_TOKENS = [
    "checkpoint",
    "challenge",
    "verification",
    "two-factor",
    "two factor",
    "2fa",
    "security check",
    "suspicious login",
    "confirm your identity",
    "enter code",
    "captcha",
    "verify it's you",
    "verify it’s you",
    "authentication code",
]

EXPIRED_URL_TOKENS = ["login", "signin", "authwall", "accounts/login"]
DEBUG_DIR = Path(settings.BASE_DIR) / "storage" / "debug" / "linkedin_check"
LINKEDIN_CONNECTED_PATHS = [
    "linkedin.com/feed",
    "linkedin.com/mynetwork",
    "linkedin.com/in/",
    "linkedin.com/company",
]
LINKEDIN_CONNECTED_BODY_TOKENS = [
    "accueil",
    "mon réseau",
    "messagerie",
    "notifications",
    "commencer un post",
    "pour les entreprises",
]
LINKEDIN_EXPIRED_URL_TOKENS = ["/login", "signin", "authwall", "checkpoint/login"]
LINKEDIN_VERIFICATION_URL_TOKENS = ["checkpoint", "challenge", "security-verification", "captcha"]
LINKEDIN_VERIFICATION_BODY_TOKENS = [
    "entrez le code",
    "enter the code",
    "security verification",
    "confirm your identity",
    "vérification de sécurité",
    "confirmez votre identité",
    "captcha",
]


def _safe_body_text(page) -> str:
    try:
        return page.locator("body").inner_text(timeout=5000)
    except Exception:
        try:
            return page.inner_text("body", timeout=5000)
        except Exception:
            return ""


def _safe_page_title(page) -> str:
    try:
        return page.title()
    except Exception as exc:
        return f"<title unavailable: {exc}>"


def _safe_page_content(page) -> str:
    try:
        return page.content()
    except Exception as exc:
        return f"<!-- page.content unavailable: {exc} -->"


def _debug_filename(platform, status):
    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S_%f")
    safe_platform = (platform or "unknown").lower().strip() or "unknown"
    return f"{safe_platform}_check_{status}_{timestamp}"


def _save_debug_artifacts(page, platform, status):
    if platform != "linkedin":
        return

    try:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        filename = _debug_filename(platform, status)
        screenshot_path = DEBUG_DIR / f"{filename}.png"
        html_path = DEBUG_DIR / f"{filename}.html"
        page.screenshot(path=str(screenshot_path), full_page=True)
        html_path.write_text(_safe_page_content(page), encoding="utf-8")
        logger.warning(
            "LinkedIn check debug saved | status=%s | screenshot=%s | html=%s",
            status,
            screenshot_path,
            html_path,
        )
    except Exception as exc:
        logger.warning("LinkedIn check debug save failed | status=%s | error=%s", status, exc)


def _result(page, platform, status, message):
    _save_debug_artifacts(page, platform, status)
    return {
        "status": status,
        "message": message,
        "debug_url": getattr(page, "url", ""),
    }


def detect_social_session_status(page, platform):
    platform = (platform or "").lower().strip()
    url = (getattr(page, "url", "") or "").lower()
    raw_text = _safe_body_text(page)
    text = raw_text.lower()
    haystack = f"{url} {text}"

    if platform == "linkedin":
        connected_body_matches = [token for token in LINKEDIN_CONNECTED_BODY_TOKENS if token in text]
        if any(token in url for token in LINKEDIN_CONNECTED_PATHS) or len(connected_body_matches) >= 3:
            logger.warning(
                "LinkedIn connected detected by feed indicators | url=%s | title=%s | matches=%s",
                getattr(page, "url", ""),
                _safe_page_title(page),
                connected_body_matches,
            )
            return _result(page, platform, "connected", "Session LinkedIn valide.")

        expired_reason = next((token for token in LINKEDIN_EXPIRED_URL_TOKENS if token in url), None)
        if expired_reason:
            return _result(page, platform, "expired", f"La session {platform} a expire ou demande une connexion.")

        verification_reason = next((token for token in LINKEDIN_VERIFICATION_URL_TOKENS if token in url), None)
        if not verification_reason:
            verification_reason = next((token for token in LINKEDIN_VERIFICATION_BODY_TOKENS if token in text), None)
        if verification_reason:
            logger.warning(
                "LinkedIn verification detected | url=%s | title=%s | reason=%s | body_first_1000=%s",
                getattr(page, "url", ""),
                _safe_page_title(page),
                verification_reason,
                raw_text[:1000],
            )
            return _result(page, platform, "verification_required", f"{platform} demande une verification manuelle.")

        return _result(page, platform, "error", f"Impossible de confirmer le statut de la session {platform}.")

    verification_reason = next((token for token in VERIFICATION_TOKENS if token in haystack), None)
    if verification_reason:
        return _result(page, platform, "verification_required", f"{platform} demande une verification manuelle.")

    if any(token in url for token in EXPIRED_URL_TOKENS):
        return _result(page, platform, "expired", f"La session {platform} a expire ou demande une connexion.")

    if platform == "facebook":
        if "facebook.com" in url and "login" not in url and "checkpoint" not in url:
            return _result(page, platform, "connected", "Session Facebook connectee.")

    if platform == "instagram":
        if "instagram.com" in url and "accounts/login" not in url and "challenge" not in url:
            return _result(page, platform, "connected", "Session Instagram connectee.")

    return _result(page, platform, "error", f"Impossible de confirmer le statut de la session {platform}.")
