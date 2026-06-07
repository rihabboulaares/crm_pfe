from pathlib import Path
import logging
import subprocess
import threading
import time
from playwright.async_api import async_playwright, TimeoutError as AsyncPlaywrightTimeoutError
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger("agentEngagement.social.session_manager")

BASE_DIR = Path(__file__).resolve().parent.parent
SESSIONS_DIR = BASE_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
BASE_LINKEDIN_SESSION_DIR = Path("storage/linkedin_sessions")
BASE_LINKEDIN_SESSION_DIR.mkdir(parents=True, exist_ok=True)
BASE_SOCIAL_SESSION_DIR = Path("storage/social_sessions")
BASE_SOCIAL_SESSION_DIR.mkdir(parents=True, exist_ok=True)
FACEBOOK_BROWSER_SESSION_DIR = Path("browser_sessions/facebook")
FACEBOOK_BROWSER_SESSION_DIR.mkdir(parents=True, exist_ok=True)
_OPEN_LINKEDIN_LOGIN_SESSIONS = {}
_OPEN_ASYNC_LINKEDIN_LOGIN_SESSIONS = {}
_OPEN_SOCIAL_LOGIN_SESSIONS = {}
_FACEBOOK_LOGIN_SESSION = {}
_FACEBOOK_LOGIN_LOCK = threading.Lock()

SUPPORTED_PLATFORMS = {"linkedin", "facebook", "instagram"}


def _normalize_platform(platform: str) -> str:
    return (platform or "").lower().strip()


def get_login_url(platform: str) -> str:
    platform = _normalize_platform(platform)
    if platform == "linkedin":
        return "https://www.linkedin.com/login"
    if platform == "facebook":
        return "https://www.facebook.com/login/"
    if platform == "instagram":
        return "https://www.instagram.com/accounts/login/"
    raise ValueError(f"Unsupported social platform: {platform}")


def get_home_url(platform: str) -> str:
    platform = _normalize_platform(platform)
    if platform == "linkedin":
        return "https://www.linkedin.com/feed/"
    if platform == "facebook":
        return "https://www.facebook.com/"
    if platform == "instagram":
        return "https://www.instagram.com/"
    raise ValueError(f"Unsupported social platform: {platform}")


def _session_ready_response(platform: str) -> dict:
    return {"success": True, "status": "session_ready", "platform": platform}


def _login_required_response(platform: str) -> dict:
    names = {"linkedin": "LinkedIn", "facebook": "Facebook", "instagram": "Instagram"}
    if platform == "facebook":
        return {
            "success": False,
            "status": "login_required",
            "platform": platform,
            "message": "Connectez-vous a Facebook via le bouton Connecter Facebook puis relancez l'action.",
        }

    return {
        "success": False,
        "status": "login_required",
        "platform": platform,
        "message": (
            f"Veuillez vous connecter a {names.get(platform, platform)} dans la fenetre "
            "ouverte puis relancer l'action."
        ),
    }


def _checkpoint_required_response(platform: str) -> dict:
    names = {"linkedin": "LinkedIn", "facebook": "Facebook", "instagram": "Instagram"}
    if platform == "facebook":
        return {
            "success": False,
            "status": "checkpoint_required",
            "platform": platform,
            "message": (
                "Facebook demande une verification manuelle. "
                "Cliquez sur Connecter Facebook, terminez la verification puis relancez l'action."
            ),
        }

    return {
        "success": False,
        "status": "checkpoint_required",
        "platform": platform,
        "message": f"{names.get(platform, platform)} demande une verification manuelle.",
    }


def _is_checkpoint_url(url: str) -> bool:
    url = (url or "").lower()
    return any(token in url for token in ("checkpoint", "challenge", "two_step_verification", "2fa"))


def _safe_body_text(page) -> str:
    try:
        return page.inner_text("body", timeout=7000)
    except Exception:
        return ""


def _has_selector(page, selector: str) -> bool:
    try:
        return page.locator(selector).count() > 0
    except Exception:
        return False


def login_required_by_selectors(page, platform: str) -> bool:
    platform = _normalize_platform(platform)
    current_url = (page.url or "").lower()
    body = _safe_body_text(page).lower()

    if platform == "linkedin":
        return (
            "login" in current_url
            or _is_checkpoint_url(current_url)
            or _has_selector(page, "input[name='session_key']")
            or _has_selector(page, "input[name='session_password']")
            or _has_selector(page, "input#username")
            or _has_selector(page, "input#password")
            or "join linkedin" in body
            or "already on linkedin" in body
        )

    if platform == "facebook":
        return (
            "login" in current_url
            or _is_checkpoint_url(current_url)
            or _has_selector(page, "input[name='email']")
            or _has_selector(page, "input[name='pass']")
            or ("email" in body and "password" in body and "facebook" in body)
            or ("se connecter" in body and "mot de passe" in body)
        )

    if platform == "instagram":
        return (
            "accounts/login" in current_url
            or _is_checkpoint_url(current_url)
            or _has_selector(page, 'input[name="username"]')
            or _has_selector(page, 'input[name="password"]')
            or ("log in" in body and "password" in body)
            or ("se connecter" in body and "mot de passe" in body)
        )

    return False


def close_popups(page, platform: str) -> None:
    common = [
        "button:has-text('Pas maintenant')",
        "button:has-text('Not Now')",
        "button:has-text('Tout accepter')",
        "button:has-text('Accept all')",
        "button:has-text('Allow all cookies')",
        "button[aria-label*='Close']",
        "button[aria-label*='Fermer']",
        "div[aria-label='Close'][role='button']",
        "div[aria-label='Fermer'][role='button']",
    ]
    platform_selectors = {
        "facebook": ["[data-cookiebanner='accept_button']"],
        "instagram": ["button:has-text('Tout autoriser')", "button:has-text('Accepter')"],
        "linkedin": ["button:has-text('Ignorer')", "button:has-text('Skip')"],
    }
    for selector in common + platform_selectors.get(_normalize_platform(platform), []):
        try:
            item = page.locator(selector).first
            if item.is_visible(timeout=800):
                item.click()
                page.wait_for_timeout(300)
        except Exception:
            pass


LINKEDIN_LOGIN_REQUIRED_RESPONSE = {
    "success": False,
    "status": "linkedin_login_required",
    "message": "Veuillez vous connecter à LinkedIn dans la fenêtre ouverte puis relancer l’action.",
}


def get_profile_dir(platform: str, user_id: int) -> Path:
    platform = (platform or "").lower().strip()

    if platform == "linkedin":
        return get_linkedin_profile_dir(user_id)

    if platform == "facebook":
        return get_facebook_profile_dir()

    if platform in {"facebook", "instagram"}:
        return get_social_profile_dir(platform, user_id)

    path = SESSIONS_DIR / platform / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_linkedin_profile_dir(user_id: int | str) -> Path:
    path = BASE_LINKEDIN_SESSION_DIR / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_facebook_profile_dir() -> Path:
    FACEBOOK_BROWSER_SESSION_DIR.mkdir(parents=True, exist_ok=True)
    return FACEBOOK_BROWSER_SESSION_DIR


def get_social_profile_dir(platform: str, user_id: int | str) -> Path:
    if platform == "facebook":
        return get_facebook_profile_dir()

    if platform not in {"instagram", "facebook"}:
        raise ValueError(f"Unsupported social platform: {platform}")

    path = BASE_SOCIAL_SESSION_DIR / platform / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _open_session_key(platform: str, user_id: int | str) -> tuple[str, str]:
    return (_normalize_platform(platform), str(user_id))


def _close_open_platform_session(platform: str, user_id: int | str) -> None:
    session = _OPEN_SOCIAL_LOGIN_SESSIONS.pop(_open_session_key(platform, user_id), None)
    if not session:
        return
    try:
        session["context"].close()
    finally:
        session["playwright"].stop()


def _launch_detached_login_browser(executable_path: str, profile_dir: Path, url: str) -> None:
    if not executable_path:
        logger.warning("[session] Chromium executable introuvable pour ouverture login manuel")
        return

    args = [
        executable_path,
        f"--user-data-dir={profile_dir}",
        "--no-first-run",
        "--disable-blink-features=AutomationControlled",
        "--start-maximized",
        url,
    ]
    kwargs = {
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }

    creationflags = 0
    if hasattr(subprocess, "DETACHED_PROCESS"):
        creationflags |= subprocess.DETACHED_PROCESS
    if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
        creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP
    if creationflags:
        kwargs["creationflags"] = creationflags

    try:
        subprocess.Popen(args, **kwargs)
    except Exception as exc:
        logger.warning("[session] ouverture navigateur login manuel impossible: %s", exc)


def _facebook_login_worker():
    playwright = None
    context = None
    try:
        playwright = sync_playwright().start()
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(get_facebook_profile_dir()),
            headless=False,
            slow_mo=100,
            viewport={"width": 1366, "height": 900},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ],
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://www.facebook.com/login", wait_until="domcontentloaded", timeout=90000)

        message = "Connectez-vous à Facebook puis fermez la fenêtre ou relancez l’action."
        logger.info("[facebook-login] %s", message)
        print(message)

        with _FACEBOOK_LOGIN_LOCK:
            _FACEBOOK_LOGIN_SESSION["playwright"] = playwright
            _FACEBOOK_LOGIN_SESSION["context"] = context
            _FACEBOOK_LOGIN_SESSION["page"] = page
            _FACEBOOK_LOGIN_SESSION["started_at"] = time.time()

        deadline = time.time() + 300
        while time.time() < deadline:
            try:
                if page.is_closed():
                    return
                page.wait_for_timeout(1000)
            except Exception:
                return

        logger.info("[facebook-login] Fenetre Facebook laissee ouverte apres 5 minutes.")
        while True:
            try:
                if page.is_closed():
                    return
                page.wait_for_timeout(5000)
            except Exception:
                return
    except Exception as exc:
        logger.exception("[facebook-login] ouverture session impossible: %s", exc)
    finally:
        with _FACEBOOK_LOGIN_LOCK:
            _FACEBOOK_LOGIN_SESSION.pop("thread", None)
            _FACEBOOK_LOGIN_SESSION.pop("page", None)
            _FACEBOOK_LOGIN_SESSION.pop("context", None)
            _FACEBOOK_LOGIN_SESSION.pop("playwright", None)
            _FACEBOOK_LOGIN_SESSION["closed_at"] = time.time()
        try:
            if context:
                context.close()
        except Exception:
            pass
        try:
            if playwright:
                playwright.stop()
        except Exception:
            pass


def open_facebook_login_session() -> dict:
    with _FACEBOOK_LOGIN_LOCK:
        thread = _FACEBOOK_LOGIN_SESSION.get("thread")
        if thread and thread.is_alive():
            return {
                "success": True,
                "status": "facebook_login_window_open",
                "platform": "facebook",
                "message": "La fenêtre Facebook est déjà ouverte. Connectez-vous puis relancez l’action.",
                "user_data_dir": str(get_facebook_profile_dir()),
            }

        thread = threading.Thread(target=_facebook_login_worker, name="facebook-login-session", daemon=True)
        _FACEBOOK_LOGIN_SESSION["thread"] = thread
        thread.start()

    return {
        "success": True,
        "status": "facebook_login_window_open",
        "platform": "facebook",
        "message": "Connectez-vous à Facebook puis fermez la fenêtre ou relancez l’action.",
        "user_data_dir": str(get_facebook_profile_dir()),
    }


def _facebook_login_window_is_open() -> bool:
    with _FACEBOOK_LOGIN_LOCK:
        thread = _FACEBOOK_LOGIN_SESSION.get("thread")
        page = _FACEBOOK_LOGIN_SESSION.get("page")

        if not thread or not thread.is_alive():
            return False

        if page is None:
            return True

        try:
            return not page.is_closed()
        except Exception:
            return True


def _check_existing_open_platform_session(platform: str, user_id: int | str) -> dict | None:
    session = _OPEN_SOCIAL_LOGIN_SESSIONS.get(_open_session_key(platform, user_id))
    if not session:
        return None

    try:
        page = session["page"]
        page.wait_for_timeout(1000)
        if _is_checkpoint_url(page.url):
            url = page.url or get_login_url(platform)
            executable_path = None
            if platform != "facebook":
                executable_path = session["playwright"].chromium.executable_path
            _close_open_platform_session(platform, user_id)
            if platform == "facebook":
                return _checkpoint_required_response(platform)
            _launch_detached_login_browser(executable_path, get_profile_dir(platform, user_id), url)
            return _checkpoint_required_response(platform)
        if login_required_by_selectors(page, platform):
            executable_path = None
            if platform != "facebook":
                executable_path = session["playwright"].chromium.executable_path
            _close_open_platform_session(platform, user_id)
            if platform == "facebook":
                return _login_required_response(platform)
            _launch_detached_login_browser(executable_path, get_profile_dir(platform, user_id), get_login_url(platform))
            return _login_required_response(platform)
        _close_open_platform_session(platform, user_id)
        return _session_ready_response(platform)
    except Exception as exc:
        logger.warning("[session] open %s session check failed: %s", platform, exc)
        _close_open_platform_session(platform, user_id)
        return None


def ensure_platform_session(user_id: int, platform: str, timeout_ms: int = 5000) -> dict:
    """
    Ensure a persistent browser session exists for LinkedIn, Facebook or Instagram.
    If manual login/checkpoint is needed, the browser stays open and this returns quickly.
    """
    platform = _normalize_platform(platform)
    if platform not in SUPPORTED_PLATFORMS:
        return {"success": False, "status": "unsupported_platform", "platform": platform}

    if platform == "facebook" and _facebook_login_window_is_open():
        return {
            "success": False,
            "status": "login_required",
            "platform": "facebook",
            "message": (
                "Session Facebook en cours. Terminez la connexion puis fermez la fenetre "
                "avant de relancer l'action."
            ),
        }

    open_session_result = _check_existing_open_platform_session(platform, user_id)
    if open_session_result is not None:
        return open_session_result

    profile_dir = get_profile_dir(platform, user_id)
    playwright = sync_playwright().start()
    executable_path = playwright.chromium.executable_path
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=str(profile_dir),
        headless=False,
        slow_mo=250,
        viewport={"width": 1400, "height": 900},
        args=[
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )
    page = context.pages[0] if context.pages else context.new_page()

    try:
        page.goto(get_home_url(platform), wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(min(max(timeout_ms, 1000), 8000))
        close_popups(page, platform)

        if _is_checkpoint_url(page.url):
            manual_url = page.url or get_login_url(platform)
            context.close()
            playwright.stop()
            if platform == "facebook":
                return _checkpoint_required_response(platform)
            _launch_detached_login_browser(executable_path, profile_dir, manual_url)
            return _checkpoint_required_response(platform)

        if login_required_by_selectors(page, platform):
            manual_url = get_login_url(platform)
            if platform != "facebook":
                try:
                    page.goto(manual_url, wait_until="domcontentloaded", timeout=90000)
                except Exception:
                    pass
            context.close()
            playwright.stop()
            if platform == "facebook":
                return _login_required_response(platform)
            _launch_detached_login_browser(executable_path, profile_dir, manual_url)
            return _login_required_response(platform)

        context.close()
        playwright.stop()
        return _session_ready_response(platform)
    except Exception as exc:
        logger.exception("[session] %s session check failed", platform)
        try:
            context.close()
        finally:
            playwright.stop()
        return {
            "success": False,
            "status": "session_check_error",
            "platform": platform,
            "error": str(exc)[:500],
        }


def linkedin_login_required_response() -> dict:
    return _login_required_response("linkedin")


def _linkedin_login_required_by_selectors(page) -> bool:
    current_url = (page.url or "").lower()

    def has_selector(selector: str) -> bool:
        try:
            return page.locator(selector).count() > 0
        except Exception:
            return False

    return (
        "login" in current_url
        or "checkpoint" in current_url
        or "challenge" in current_url
        or has_selector("input[name='session_key']")
        or has_selector("input[name='session_password']")
        or has_selector("input#username")
        or has_selector("input#password")
    )


def social_login_required_response(platform: str) -> dict:
    platform = _normalize_platform(platform)
    if platform in {"linkedin", "facebook", "instagram"}:
        return _login_required_response(platform)

    if platform == "instagram":
        return {
            "success": False,
            "status": "instagram_login_required",
            "message": "Veuillez vous connecter à Instagram dans la fenêtre ouverte puis relancer l’action.",
        }

    if platform == "facebook":
        return {
            "success": False,
            "status": "facebook_login_required",
            "message": "Veuillez vous connecter à Facebook dans la fenêtre ouverte puis relancer l’action.",
        }

    return {"success": False, "status": "unsupported_platform"}


def _social_login_required_by_selectors(page, platform: str) -> bool:
    current_url = (page.url or "").lower()

    def has_selector(selector: str) -> bool:
        try:
            return page.locator(selector).count() > 0
        except Exception:
            return False

    if platform == "instagram":
        return (
            "/accounts/login" in current_url
            or "/challenge" in current_url
            or has_selector('input[name="username"]')
            or has_selector('input[name="password"]')
        )

    if platform == "facebook":
        return (
            "/login" in current_url
            or "/checkpoint" in current_url
            or has_selector('input[name="email"]')
            or has_selector('input[name="pass"]')
        )

    return False


def _social_login_url(platform: str) -> str:
    if platform == "instagram":
        return "https://www.instagram.com/"
    if platform == "facebook":
        return "https://www.facebook.com/"
    raise ValueError(f"Unsupported social platform: {platform}")


def _social_login_message(platform: str) -> str:
    if platform == "instagram":
        return "Connexion Instagram requise. Connectez-vous dans la fenêtre ouverte."
    if platform == "facebook":
        return "Connexion Facebook requise. Connectez-vous dans la fenêtre ouverte."
    return "Connexion requise. Connectez-vous dans la fenêtre ouverte."


def _close_social_login_session(platform: str, user_id: int | str) -> None:
    session = _OPEN_SOCIAL_LOGIN_SESSIONS.pop((platform, str(user_id)), None)
    if not session:
        return

    try:
        session["context"].close()
    finally:
        session["playwright"].stop()


def _check_open_social_login_session(platform: str, user_id: int | str) -> dict | None:
    session = _OPEN_SOCIAL_LOGIN_SESSIONS.get((platform, str(user_id)))
    if not session:
        return None

    try:
        page = session["page"]
        page.wait_for_timeout(1000)
        if _social_login_required_by_selectors(page, platform):
            return social_login_required_response(platform)

        print(f"Connexion {platform.capitalize()} réussie.")
        _close_social_login_session(platform, user_id)
        return {"success": True, "status": f"{platform}_session_ready"}
    except Exception:
        _close_social_login_session(platform, user_id)
        return None


def ensure_social_session(user_id: int, platform: str, timeout_ms: int = 300000) -> dict:
    return ensure_platform_session(user_id=user_id, platform=platform, timeout_ms=min(timeout_ms, 8000))

    platform = (platform or "").lower().strip()
    if platform not in {"instagram", "facebook"}:
        return {"success": False, "status": "unsupported_platform"}

    open_session_result = _check_open_social_login_session(platform, user_id)
    if open_session_result is not None:
        return open_session_result

    session_dir = get_social_profile_dir(platform, user_id)
    playwright = sync_playwright().start()
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=str(session_dir),
        headless=False,
        slow_mo=300,
        viewport={"width": 1400, "height": 900},
        args=[
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )

    page = context.pages[0] if context.pages else context.new_page()

    try:
        page.goto(_social_login_url(platform), wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(3000)

        if _social_login_required_by_selectors(page, platform):
            print(_social_login_message(platform))
            print("Attente de la connexion utilisateur...")

            deadline = timeout_ms
            while deadline > 0:
                page.wait_for_timeout(2000)
                deadline -= 2000

                if not _social_login_required_by_selectors(page, platform):
                    print(f"Connexion {platform.capitalize()} réussie.")
                    context.close()
                    playwright.stop()
                    return {"success": True, "status": f"{platform}_session_ready"}

            print(f"Connexion {platform.capitalize()} non terminée dans le délai.")
            _OPEN_SOCIAL_LOGIN_SESSIONS[(platform, str(user_id))] = {
                "playwright": playwright,
                "context": context,
                "page": page,
            }
            return social_login_required_response(platform)

        print(f"Session {platform.capitalize()} déjà active.")
        context.close()
        playwright.stop()
        return {"success": True, "status": f"{platform}_session_ready"}
    except Exception:
        try:
            context.close()
        finally:
            playwright.stop()
        raise


async def _async_linkedin_login_required_by_selectors(page) -> bool:
    current_url = (page.url or "").lower()

    async def has_selector(selector: str) -> bool:
        try:
            return await page.locator(selector).count() > 0
        except Exception:
            return False

    return (
        "login" in current_url
        or "checkpoint" in current_url
        or "challenge" in current_url
        or await has_selector("input[name='session_key']")
        or await has_selector("input[name='session_password']")
        or await has_selector("input#username")
        or await has_selector("input#password")
    )


def ensure_linkedin_session(user_id: int, timeout_ms: int = 300000) -> bool:
    return ensure_platform_session(
        user_id=user_id,
        platform="linkedin",
        timeout_ms=min(timeout_ms, 8000),
    ).get("success", False)

    session_dir = get_linkedin_profile_dir(user_id)
    playwright = sync_playwright().start()
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=str(session_dir),
        headless=False,
        slow_mo=300,
        viewport={"width": 1400, "height": 900},
        args=[
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )

    page = context.pages[0] if context.pages else context.new_page()

    try:
        page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(3000)

        if _linkedin_login_required_by_selectors(page):
            print("Connexion LinkedIn requise. Connectez-vous dans la fenêtre ouverte.")
            print("Attente de la connexion utilisateur...")
            try:
                page.wait_for_url("**/feed/**", timeout=timeout_ms)
                print("Connexion LinkedIn réussie.")
                context.close()
                playwright.stop()
                return True
            except PlaywrightTimeoutError:
                print("Connexion LinkedIn non terminée dans le délai.")
                _OPEN_LINKEDIN_LOGIN_SESSIONS[user_id] = {
                    "playwright": playwright,
                    "context": context,
                    "page": page,
                }
                return False

        print("Session LinkedIn déjà active.")
        context.close()
        playwright.stop()
        return True
    except Exception:
        try:
            context.close()
        finally:
            playwright.stop()
        raise


async def ensure_linkedin_session_async(user_id: int, timeout_ms: int = 300000) -> bool:
    session_dir = get_linkedin_profile_dir(user_id)
    playwright = await async_playwright().start()
    context = await playwright.chromium.launch_persistent_context(
        user_data_dir=str(session_dir),
        headless=False,
        slow_mo=300,
        viewport={"width": 1400, "height": 900},
        args=[
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )

    page = context.pages[0] if context.pages else await context.new_page()

    try:
        await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=90000)
        await page.wait_for_timeout(3000)

        if await _async_linkedin_login_required_by_selectors(page):
            print("Connexion LinkedIn requise. Connectez-vous dans la fenêtre ouverte.")
            print("Attente de la connexion utilisateur...")
            try:
                await page.wait_for_url("**/feed/**", timeout=timeout_ms)
                print("Connexion LinkedIn réussie.")
                await context.close()
                await playwright.stop()
                return True
            except AsyncPlaywrightTimeoutError:
                print("Connexion LinkedIn non terminée dans le délai.")
                _OPEN_ASYNC_LINKEDIN_LOGIN_SESSIONS[user_id] = {
                    "playwright": playwright,
                    "context": context,
                    "page": page,
                }
                return False

        print("Session LinkedIn déjà active.")
        await context.close()
        await playwright.stop()
        return True
    except Exception:
        try:
            await context.close()
        finally:
            await playwright.stop()
        raise


def open_social_login(platform: str, user_id: int) -> str:
    result = ensure_platform_session(user_id=user_id, platform=platform)
    if result.get("success"):
        return "login_success"
    if result.get("status") == "checkpoint_required":
        return "checkpoint_required"
    if result.get("status") == "login_required":
        return "login_required"
    return result.get("status", "login_failed")

    platform = (platform or "").lower().strip()

    if platform not in {"linkedin", "facebook", "instagram"}:
        return "unsupported_platform"

    profile_dir = get_profile_dir(platform, user_id)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            slow_mo=120,
            viewport={"width": 1366, "height": 900},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ],
        )

        page = context.new_page()

        try:
            if platform == "linkedin":
                page.goto(
                    "https://www.linkedin.com/login",
                    wait_until="domcontentloaded",
                    timeout=90000,
                )

                input(
                    "Connecte-toi a LinkedIn. "
                    "Si LinkedIn demande une verification/checkpoint, termine-la aussi, "
                    "puis appuie sur ENTER ici..."
                )

                status = _check_linkedin_page(page)
                return status

            login_url = (
                "https://www.facebook.com/login/"
                if platform == "facebook"
                else "https://www.instagram.com/accounts/login/"
            )
            home_url = "https://www.facebook.com/" if platform == "facebook" else "https://www.instagram.com/"
            checker = _facebook_login_required if platform == "facebook" else _instagram_login_required

            page.goto(login_url, wait_until="domcontentloaded", timeout=90000)

            input(
                f"Connecte-toi a {platform}. "
                "Si la plateforme demande une verification 2FA, termine-la aussi, "
                "puis appuie sur ENTER ici..."
            )

            status = _open_and_check(page, home_url, checker)

            if status == "connected":
                return "login_success"

            if status == "checkpoint":
                return "checkpoint_required"

            return "login_failed"

        except Exception as exc:
            return f"login_error:{str(exc)[:300]}"

        finally:
            context.close()


def check_social_session(platform: str, user_id: int) -> dict:
    result = ensure_platform_session(user_id=user_id, platform=platform)
    status_value = result.get("status")
    return {
        **result,
        "status": "connected" if status_value == "session_ready" else status_value,
    }

    platform = (platform or "").lower().strip()

    if platform not in {"linkedin", "facebook", "instagram"}:
        return {"success": False, "status": "unsupported_platform"}

    profile_dir = get_profile_dir(platform, user_id)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            slow_mo=80,
            viewport={"width": 1366, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )

        page = context.new_page()

        try:
            if platform == "linkedin":
                status = _open_and_check(
                    page,
                    "https://www.linkedin.com/feed/",
                    _linkedin_login_required,
                )

                return {
                    "success": status == "connected",
                    "platform": "linkedin",
                    "status": status,
                    "url": page.url,
                }

            home_url = "https://www.facebook.com/" if platform == "facebook" else "https://www.instagram.com/"
            checker = _facebook_login_required if platform == "facebook" else _instagram_login_required
            status = _open_and_check(page, home_url, checker)

            return {
                "success": status == "connected",
                "platform": platform,
                "status": "connected" if status == "connected" else status,
                "url": page.url,
            }

        except Exception as exc:
            return {
                "success": False,
                "platform": platform,
                "status": "check_error",
                "error": str(exc)[:300],
            }

        finally:
            context.close()

def _open_and_check(page, url: str, checker_func) -> str:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(6000)
    except PlaywrightError:
        pass
    except Exception:
        pass

    current_url = page.url.lower()

    if "checkpoint" in current_url or "challenge" in current_url or "two_step_verification" in current_url:
        return "checkpoint"

    if checker_func(page):
        return "login_required"

    return "connected"


def _check_linkedin_page(page) -> str:
    try:
        page.goto(
            "https://www.linkedin.com/feed/",
            wait_until="domcontentloaded",
            timeout=90000,
        )
        page.wait_for_timeout(6000)
    except Exception:
        pass

    url = page.url.lower()

    if "checkpoint" in url or "challenge" in url:
        return "checkpoint_required"

    if _linkedin_login_required(page):
        return "login_failed"

    return "login_success"


def _safe_body_text(page) -> str:
    try:
        return page.inner_text("body", timeout=7000)
    except Exception:
        return ""


def _linkedin_login_required(page) -> bool:
    url = page.url.lower()
    body = _safe_body_text(page).lower()

    return (
        "login" in url
        or "checkpoint" in url
        or "challenge" in url
        or "join linkedin" in body
        or "agree & join" in body
        or "already on linkedin" in body
        or ("email" in body and "password" in body and "linkedin" in body)
    )


def _facebook_login_required(page) -> bool:
    url = page.url.lower()
    body = _safe_body_text(page).lower()

    return (
        "login" in url
        or "two_step_verification" in url
        or "checkpoint" in url
        or ("email" in body and "password" in body and "facebook" in body)
        or ("se connecter" in body and "mot de passe" in body)
    )


def _instagram_login_required(page) -> bool:
    url = page.url.lower()
    body = _safe_body_text(page).lower()

    return (
        "accounts/login" in url
        or "two_step_verification" in url
        or "checkpoint" in url
        or ("log in" in body and "password" in body)
        or ("phone number, username, or email" in body)
        or ("se connecter" in body and "mot de passe" in body)
    )
