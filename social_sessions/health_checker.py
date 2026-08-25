import json
from dataclasses import dataclass
from pathlib import Path

from .models import SocialSession
from .services_constants import CHROME_USER_AGENT, normalize_platform


CONTROL_URLS = {
    "linkedin": "https://www.linkedin.com/feed/",
    "facebook": "https://www.facebook.com/",
    "instagram": "https://www.instagram.com/",
}

CHROMIUM_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
]


@dataclass
class SessionHealthResult:
    status: str
    message: str = ""
    final_url: str = ""
    error_code: str = ""
    browser_closed: bool = False

    @property
    def ok(self):
        return self.status == SocialSession.SESSION_READY

    def as_dict(self):
        return {
            "ok": self.ok,
            "status": self.status,
            "message": self.message,
            "final_url": self.final_url,
            "error_code": self.error_code,
            "browser_closed": self.browser_closed,
        }


class SocialSessionHealthChecker:
    login_selectors = {
        "linkedin": ["input[name='session_key']", "input[name='session_password']", "button:has-text('Sign in')"],
        "facebook": ["input[name='email']", "input[name='pass']", "button[name='login']"],
        "instagram": ["input[name='username']", "input[name='password']", "button:has-text('Log in')"],
    }
    ready_selectors = {
        "linkedin": ["a[href*='/feed/']", "a[href*='/mynetwork/']", "button:has-text('Start a post')"],
        "facebook": ["a[aria-label='Home']", "div[role='feed']", "input[aria-label*=\"What's on your mind\"]"],
        "instagram": ["a[href='/']", "a[href*='/direct/']", "svg[aria-label='Home']"],
    }
    checkpoint_markers = {
        "linkedin": ["checkpoint", "challenge", "confirm your identity", "security verification"],
        "facebook": ["checkpoint", "two_step_verification", "confirm your identity", "security check"],
        "instagram": ["challenge", "suspicious login attempt", "checkpoint"],
    }
    captcha_markers = ["captcha", "recaptcha", "security code"]
    meta_profile_markers = ["utiliser un autre profil", "use another profile", "continuer", "continue as"]

    def check(self, session_path, platform, *, timeout_ms=90000):
        platform = normalize_platform(platform)
        path = Path(session_path or "")
        storage_result = self._validate_storage_state(path)
        if storage_result:
            return storage_result

        browser = context = page = None
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, args=CHROMIUM_ARGS)
                context = browser.new_context(
                    storage_state=str(path),
                    viewport={"width": 1280, "height": 720},
                    locale="fr-FR",
                    timezone_id="Europe/Paris",
                    user_agent=CHROME_USER_AGENT,
                )
                page = context.new_page()
                page.goto(CONTROL_URLS[platform], wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(2500)
                return self.evaluate_page(page, platform)
        except Exception as exc:
            return SessionHealthResult(
                status=SocialSession.SESSION_HEALTHCHECK_FAILED,
                message=str(exc)[:500],
                final_url=getattr(page, "url", "") if page else "",
                error_code="HEALTHCHECK_EXCEPTION",
                browser_closed=False,
            )
        finally:
            for obj in (context, browser):
                try:
                    if obj:
                        obj.close()
                except Exception:
                    pass

    def evaluate_page(self, page, platform):
        platform = normalize_platform(platform)
        url = (getattr(page, "url", "") or "").lower()
        text = self._body_text(page).lower()
        haystack = f"{url} {text}"
        if any(marker in haystack for marker in self.checkpoint_markers[platform]):
            return SessionHealthResult(SocialSession.CHECKPOINT_REQUIRED, "Checkpoint detecte.", url, "CHECKPOINT_REQUIRED", True)
        if any(marker in haystack for marker in self.captcha_markers):
            return SessionHealthResult(SocialSession.CAPTCHA_REQUIRED, "CAPTCHA detecte.", url, "CAPTCHA_REQUIRED", True)
        if self._has_any_selector(page, self.login_selectors[platform]) or self._url_has_login(url, platform):
            return SessionHealthResult(SocialSession.LOGIN_REQUIRED, "Formulaire de connexion detecte.", url, "LOGIN_REQUIRED", True)
        if platform in {"facebook", "instagram"} and all(marker in text for marker in ["continuer", "utiliser un autre profil"]):
            return SessionHealthResult(SocialSession.LOGIN_REQUIRED, "Page Meta de choix de profil detectee.", url, "LOGIN_REQUIRED", True)
        if any(marker in text for marker in self.meta_profile_markers) and "créer un nouveau compte" in text:
            return SessionHealthResult(SocialSession.LOGIN_REQUIRED, "Page Meta de choix de profil detectee.", url, "LOGIN_REQUIRED", True)
        if self._has_any_selector(page, self.ready_selectors[platform]) or self._has_ready_text(text, platform):
            return SessionHealthResult(SocialSession.SESSION_READY, "Session authentifiee confirmee.", url, "", True)
        return SessionHealthResult(SocialSession.SESSION_EXPIRED, "Aucun marqueur authentifie confirme.", url, "SESSION_EXPIRED", True)

    def _validate_storage_state(self, path):
        if not path or not path.exists():
            return SessionHealthResult(SocialSession.SESSION_FILE_MISSING, "Fichier storage_state introuvable.", "", "SESSION_FILE_MISSING", True)
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return SessionHealthResult(SocialSession.SESSION_FILE_INVALID, "Fichier storage_state JSON invalide.", "", "SESSION_FILE_INVALID", True)
        cookies = payload.get("cookies") if isinstance(payload, dict) else None
        origins = payload.get("origins") if isinstance(payload, dict) else None
        if not isinstance(payload, dict) or not (isinstance(cookies, list) or isinstance(origins, list)):
            return SessionHealthResult(SocialSession.SESSION_FILE_INVALID, "Fichier storage_state incomplet.", "", "SESSION_FILE_INVALID", True)
        if isinstance(cookies, list) and cookies and self._all_cookies_expired(cookies):
            return SessionHealthResult(SocialSession.SESSION_EXPIRED, "Cookies expires.", "", "SESSION_EXPIRED", True)
        return None

    def _all_cookies_expired(self, cookies):
        import time

        expiring = [cookie.get("expires") for cookie in cookies if isinstance(cookie, dict) and cookie.get("expires")]
        if not expiring:
            return False
        now = time.time()
        return all(float(value) > 0 and float(value) < now for value in expiring)

    def _body_text(self, page):
        try:
            return page.locator("body").inner_text(timeout=5000)
        except Exception:
            try:
                return page.inner_text("body", timeout=5000)
            except Exception:
                return ""

    def _has_any_selector(self, page, selectors):
        for selector in selectors:
            try:
                if page.locator(selector).first().is_visible(timeout=1500):
                    return True
            except Exception:
                continue
        return False

    def _url_has_login(self, url, platform):
        return {
            "linkedin": any(token in url for token in ["/login", "authwall", "signin"]),
            "facebook": any(token in url for token in ["/login", "checkpoint"]),
            "instagram": any(token in url for token in ["/accounts/login", "/challenge"]),
        }[platform]

    def _has_ready_text(self, text, platform):
        markers = {
            "linkedin": ["accueil", "messagerie", "notifications", "start a post", "commencer un post"],
            "facebook": ["fil d'actualité", "news feed", "watch", "marketplace"],
            "instagram": ["home", "messages", "notifications"],
        }[platform]
        return sum(1 for marker in markers if marker in text) >= 2
