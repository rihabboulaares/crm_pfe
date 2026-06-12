import json
import logging
import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import SocialSession
from .playwright_utils import detect_social_session_status

logger = logging.getLogger(__name__)

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


def platform_label(platform):
    return {"linkedin": "LinkedIn", "facebook": "Facebook", "instagram": "Instagram"}.get(platform, platform)


def social_session_required_response(platform, status="not_connected"):
    label = platform_label(platform)
    messages = {
        "not_connected": f"Veuillez connecter votre session {label} dans Mes connexions sociales.",
        "expired": f"Votre session {label} a expire. Veuillez importer une nouvelle session.",
        "verification_required": f"{label} demande une verification manuelle. Veuillez reconnecter votre compte.",
        "error": f"Votre session {label} est en erreur. Veuillez verifier Mes connexions sociales.",
    }
    return {
        "ok": False,
        "success": False,
        "status": status,
        "platform": platform,
        "message": messages.get(status, messages["not_connected"]),
        "requires_manual_login": True,
    }


class SocialSessionService:
    @staticmethod
    def session_file_path(user, platform):
        platform = normalize_platform(platform)
        return BASE_SESSION_DIR / platform / f"user_{user.id}" / "state.json"

    @staticmethod
    def get_or_create_session(user, platform):
        platform = normalize_platform(platform)
        return SocialSession.objects.get_or_create(
            user=user,
            platform=platform,
            defaults={"status": SocialSession.NOT_CONNECTED},
        )

    @staticmethod
    def get_session(user, platform):
        platform = normalize_platform(platform)
        return SocialSession.objects.filter(user=user, platform=platform).first()

    @staticmethod
    def get_session_path(user, platform):
        session = SocialSessionService.get_session(user, platform)
        if not session or not session.session_path:
            return None
        path = Path(session.session_path)
        return str(path) if path.exists() else None

    @staticmethod
    def save_uploaded_session(user, platform, uploaded_file):
        platform = normalize_platform(platform)
        filename = getattr(uploaded_file, "name", "") or ""
        if not filename.lower().endswith(".json"):
            return {"ok": False, "platform": platform, "status": "error", "message": "Seuls les fichiers .json sont acceptes."}

        raw = uploaded_file.read()
        try:
            payload = json.loads(raw.decode("utf-8"))
        except UnicodeDecodeError:
            try:
                payload = json.loads(raw.decode("utf-8-sig"))
            except Exception:
                return {"ok": False, "platform": platform, "status": "error", "message": "JSON invalide."}
        except Exception:
            return {"ok": False, "platform": platform, "status": "error", "message": "JSON invalide."}

        if not isinstance(payload, dict) or not (payload.get("cookies") or payload.get("origins")):
            return {"ok": False, "platform": platform, "status": "error", "message": "Le fichier doit contenir cookies ou origins."}

        session_path = SocialSessionService.session_file_path(user, platform)
        session_path.parent.mkdir(parents=True, exist_ok=True)
        session_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

        session, _ = SocialSessionService.get_or_create_session(user, platform)
        session.status = SocialSession.CONNECTED
        session.session_path = str(session_path)
        session.last_error = None
        session.save(update_fields=["status", "session_path", "last_error", "updated_at"])

        return {
            "ok": True,
            "platform": platform,
            "status": session.status,
            "message": "Session importee avec succes.",
        }

    @staticmethod
    def delete_session(user, platform):
        platform = normalize_platform(platform)
        session, _ = SocialSessionService.get_or_create_session(user, platform)
        if session.session_path:
            path = Path(session.session_path)
            if path.exists():
                path.unlink()
            try:
                if path.parent.exists() and not any(path.parent.iterdir()):
                    shutil.rmtree(path.parent)
            except Exception:
                pass
        session.status = SocialSession.NOT_CONNECTED
        session.session_path = None
        session.last_error = None
        session.last_checked_at = timezone.now()
        session.save(update_fields=["status", "session_path", "last_error", "last_checked_at", "updated_at"])
        return {"ok": True, "platform": platform, "status": session.status, "message": "Session supprimee."}

    @staticmethod
    def has_valid_session(user, platform):
        platform = normalize_platform(platform)
        session = SocialSessionService.get_session(user, platform)
        if not session:
            return social_session_required_response(platform, "not_connected")
        if session.status != SocialSession.CONNECTED:
            return social_session_required_response(platform, session.status)
        if not session.session_path or not Path(session.session_path).exists():
            SocialSessionService.mark_expired(user, platform, "Fichier de session introuvable.")
            return social_session_required_response(platform, "not_connected")
        return {"ok": True, "success": True, "status": "connected", "platform": platform, "message": f"Session {platform_label(platform)} connectee."}

    @staticmethod
    def _notify_status(user, platform, status):
        if status not in {SocialSession.EXPIRED, SocialSession.VERIFICATION_REQUIRED}:
            return
        try:
            from Notifications.models import Notification

            Notification.objects.create(
                recipient=user,
                title=f"Session {platform_label(platform)} a reconnecter",
                message=f"Votre session {platform_label(platform)} necessite une reconnexion manuelle.",
                notif_type="warning",
                entity_type="user",
                entity_id=user.id,
                entity_name=getattr(user, "email", "") or getattr(user, "username", ""),
            )
        except Exception as exc:
            logger.warning("Notification session sociale impossible: %s", exc)

    @staticmethod
    def _set_status(user, platform, status, error=None, checked=False):
        session, _ = SocialSessionService.get_or_create_session(user, platform)
        session.status = status
        session.last_error = error
        if checked:
            session.last_checked_at = timezone.now()
        session.save(update_fields=["status", "last_error", "last_checked_at", "updated_at"])
        SocialSessionService._notify_status(user, platform, status)
        return session

    @staticmethod
    def mark_connected(user, platform):
        return SocialSessionService._set_status(user, platform, SocialSession.CONNECTED, None)

    @staticmethod
    def mark_expired(user, platform, error=None):
        return SocialSessionService._set_status(user, platform, SocialSession.EXPIRED, error)

    @staticmethod
    def mark_verification_required(user, platform, error=None):
        return SocialSessionService._set_status(user, platform, SocialSession.VERIFICATION_REQUIRED, error)

    @staticmethod
    def mark_error(user, platform, error=None):
        return SocialSessionService._set_status(user, platform, SocialSession.ERROR, error)

    @staticmethod
    def launch_context_with_session(playwright, user, platform, headless=True):
        platform = normalize_platform(platform)
        session_path = SocialSessionService.get_session_path(user, platform)
        if not session_path:
            raise FileNotFoundError(f"Session {platform} introuvable pour user {user.id}")

        return SocialSessionService.launch_context_with_session_path(playwright, session_path, platform, headless=headless)

    @staticmethod
    def launch_context_with_session_path(playwright, session_path, platform, headless=True):
        platform = normalize_platform(platform)
        browser = playwright.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = browser.new_context(
            storage_state=str(session_path),
            viewport={"width": 1280, "height": 720},
            locale="fr-FR",
            timezone_id="Europe/Paris",
            user_agent=CHROME_USER_AGENT,
        )
        page = context.new_page()
        return browser, context, page

    @staticmethod
    def check_session(user, platform):
        platform = normalize_platform(platform)
        session, _ = SocialSessionService.get_or_create_session(user, platform)
        path = Path(session.session_path or SocialSessionService.session_file_path(user, platform))
        if not path.exists():
            session.status = SocialSession.NOT_CONNECTED
            session.session_path = None
            session.last_checked_at = timezone.now()
            session.last_error = "Fichier state.json introuvable."
            session.save(update_fields=["status", "session_path", "last_checked_at", "last_error", "updated_at"])
            return {"ok": False, "platform": platform, "status": session.status, "message": "Session non connectee.", "requires_manual_login": True}

        result = SocialSessionService._check_session_with_playwright(str(path), platform)

        status = result["status"]
        session.status = status
        session.session_path = str(path)
        session.last_checked_at = timezone.now()
        session.last_error = None if status == SocialSession.CONNECTED else result.get("message")
        session.save(update_fields=["status", "session_path", "last_checked_at", "last_error", "updated_at"])
        SocialSessionService._notify_status(user, platform, status)
        return {
            "ok": status == SocialSession.CONNECTED,
            "platform": platform,
            "status": status,
            "message": result.get("message"),
            "debug_url": result.get("debug_url"),
            "requires_manual_login": status != SocialSession.CONNECTED,
        }

    @staticmethod
    def _check_session_with_playwright(session_path, platform):
        from playwright.sync_api import sync_playwright

        home_urls = {
            "linkedin": "https://www.linkedin.com/feed/",
            "facebook": "https://www.facebook.com/",
            "instagram": "https://www.instagram.com/",
        }
        browser = context = page = None
        try:
            with sync_playwright() as playwright:
                browser, context, page = SocialSessionService.launch_context_with_session_path(playwright, session_path, platform, headless=True)
                page.goto(home_urls[platform], wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(2500)
                result = detect_social_session_status(page, platform)
        except Exception as exc:
            result = {
                "status": SocialSession.ERROR,
                "message": str(exc)[:500],
                "debug_url": getattr(page, "url", "") if page else "",
            }
        finally:
            for obj in (context, browser):
                try:
                    if obj:
                        obj.close()
                except Exception:
                    pass

        return result


def user_from_id(user_id):
    return get_user_model().objects.get(id=user_id)
