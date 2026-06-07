from pathlib import Path
import queue
import shutil
import threading
import time
import logging

from playwright.sync_api import sync_playwright, Error as PlaywrightError

logger = logging.getLogger("agentEngagement.social.session_manager")

SUPPORTED_PLATFORMS = {"linkedin", "facebook", "instagram"}

BASE_SOCIAL_SESSION_DIR = Path("storage/social_sessions")
BASE_SOCIAL_SESSION_DIR.mkdir(parents=True, exist_ok=True)

_OPEN_SOCIAL_LOGIN_SESSIONS = {}
_SOCIAL_SESSION_LOCKS = {}


def normalize_platform(platform: str) -> str:
    return (platform or "").lower().strip()


def open_session_key(platform: str, user_id: int | str):
    return (normalize_platform(platform), str(user_id))


def get_platform_lock(platform: str, user_id: int | str):
    key = open_session_key(platform, user_id)
    if key not in _SOCIAL_SESSION_LOCKS:
        _SOCIAL_SESSION_LOCKS[key] = threading.Lock()
    return _SOCIAL_SESSION_LOCKS[key]


def get_profile_dir(platform: str, user_id: int | str) -> Path:
    platform = normalize_platform(platform)

    if platform not in SUPPORTED_PLATFORMS:
        raise ValueError(f"Unsupported platform: {platform}")

    path = BASE_SOCIAL_SESSION_DIR / platform / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_login_url(platform: str) -> str:
    platform = normalize_platform(platform)

    if platform == "linkedin":
        return "https://www.linkedin.com/login"
    if platform == "facebook":
        return "https://www.facebook.com/login/"
    if platform == "instagram":
        return "https://www.instagram.com/accounts/login/"

    raise ValueError(f"Unsupported platform: {platform}")


def get_home_url(platform: str) -> str:
    platform = normalize_platform(platform)

    if platform == "linkedin":
        return "https://www.linkedin.com/feed/"
    if platform == "facebook":
        return "https://www.facebook.com/"
    if platform == "instagram":
        return "https://www.instagram.com/"

    raise ValueError(f"Unsupported platform: {platform}")


def safe_body_text(page) -> str:
    try:
        return page.inner_text("body", timeout=5000)
    except Exception:
        return ""


def has_selector(page, selector: str) -> bool:
    try:
        return page.locator(selector).count() > 0
    except Exception:
        return False


def is_checkpoint_url(url: str) -> bool:
    url = (url or "").lower()
    return any(
        token in url
        for token in [
            "checkpoint",
            "challenge",
            "two_step_verification",
            "2fa",
            "security",
        ]
    )


def login_required_by_selectors(page, platform: str) -> bool:
    platform = normalize_platform(platform)
    url = (page.url or "").lower()
    body = safe_body_text(page).lower()

    if platform == "linkedin":
        return (
            "login" in url
            or "checkpoint" in url
            or "challenge" in url
            or has_selector(page, "input[name='session_key']")
            or has_selector(page, "input[name='session_password']")
            or has_selector(page, "input#username")
            or has_selector(page, "input#password")
            or "join linkedin" in body
            or "already on linkedin" in body
        )

    if platform == "facebook":
        return (
            "login" in url
            or "checkpoint" in url
            or "two_step_verification" in url
            or has_selector(page, "input[name='email']")
            or has_selector(page, "input[name='pass']")
            or ("email" in body and "password" in body and "facebook" in body)
            or ("se connecter" in body and "mot de passe" in body)
        )

    if platform == "instagram":
        return (
            "accounts/login" in url
            or "challenge" in url
            or "two_step_verification" in url
            or has_selector(page, 'input[name="username"]')
            or has_selector(page, 'input[name="password"]')
            or ("log in" in body and "password" in body)
            or ("se connecter" in body and "mot de passe" in body)
        )

    return True


def close_popups(page, platform: str):
    selectors = [
        "button:has-text('Pas maintenant')",
        "button:has-text('Not Now')",
        "button:has-text('Tout accepter')",
        "button:has-text('Accept all')",
        "button:has-text('Allow all cookies')",
        "button:has-text('Autoriser tous les cookies')",
        "button:has-text('Tout autoriser')",
        "button:has-text('Accepter')",
        "div[aria-label='Fermer'][role='button']",
        "div[aria-label='Close'][role='button']",
        "button[aria-label*='Close']",
        "button[aria-label*='Fermer']",
    ]

    for selector in selectors:
        try:
            item = page.locator(selector).first
            if item.is_visible(timeout=700):
                item.click()
                page.wait_for_timeout(300)
        except Exception:
            pass


def session_ready_response(platform: str) -> dict:
    return {
        "success": True,
        "status": "session_ready",
        "platform": platform,
        "message": f"{platform} connecte.",
    }


def login_required_response(platform: str) -> dict:
    return {
        "success": False,
        "status": "login_required",
        "platform": platform,
        "message": f"Connexion {platform} requise. Cliquez sur Connecter puis terminez la connexion.",
    }


def checkpoint_required_response(platform: str) -> dict:
    return {
        "success": False,
        "status": "checkpoint_required",
        "platform": platform,
        "message": f"{platform} demande une verification. Terminez-la dans la fenetre ouverte.",
    }


def close_open_social_window(user_id: int | str, platform: str):
    platform = normalize_platform(platform)
    key = open_session_key(platform, user_id)
    session = _OPEN_SOCIAL_LOGIN_SESSIONS.pop(key, None)

    if not session:
        return

    command_queue = session.get("command_queue")
    response_queue = queue.Queue(maxsize=1)

    if command_queue:
        try:
            command_queue.put(("close", response_queue), timeout=1)
            response_queue.get(timeout=5)
        except Exception:
            pass

    thread = session.get("thread")
    if thread and thread.is_alive():
        thread.join(timeout=5)


def get_existing_open_session(user_id: int | str, platform: str):
    key = open_session_key(platform, user_id)
    session = _OPEN_SOCIAL_LOGIN_SESSIONS.get(key)

    if not session:
        return None

    thread = session.get("thread")
    if thread and thread.is_alive():
        return session

    close_open_social_window(user_id, platform)
    return None


def run_social_login_worker(platform: str, user_id: int, startup_queue, command_queue):
    playwright = None
    context = None

    try:
        profile_dir = get_profile_dir(platform, user_id)
        playwright = sync_playwright().start()

        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            slow_mo=200,
            viewport={"width": 1400, "height": 900},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-popup-blocking",
            ],
        )

        page = context.pages[0] if context.pages else context.new_page()
        page.goto(get_login_url(platform), wait_until="domcontentloaded", timeout=90000)
        startup_queue.put({"success": True})

        while True:
            command, response_queue = command_queue.get()

            if command == "close":
                response_queue.put({"closed": True})
                break

            if command == "focus":
                try:
                    page.bring_to_front()
                except Exception:
                    pass
                response_queue.put({"success": True})
                continue

            if command == "check":
                try:
                    page.wait_for_timeout(1000)
                    close_popups(page, platform)

                    if is_checkpoint_url(page.url):
                        response_queue.put(checkpoint_required_response(platform))
                        continue

                    if login_required_by_selectors(page, platform):
                        response_queue.put(
                            {
                                **login_required_response(platform),
                                "message": (
                                    f"Connexion {platform} non terminee. "
                                    "Continuez dans la fenetre ouverte puis cliquez sur Verifier."
                                ),
                            }
                        )
                        continue

                    response_queue.put({**session_ready_response(platform), "close_session": True})
                    break

                except Exception as exc:
                    logger.warning("[social-session] worker check failed %s: %s", platform, exc)
                    response_queue.put(
                        {
                            "success": False,
                            "status": "session_check_error",
                            "platform": platform,
                            "error": str(exc)[:500],
                            "message": f"Verification {platform} impossible.",
                            "close_session": True,
                        }
                    )
                    break

    except PlaywrightError as exc:
        startup_queue.put(
            {
                "success": False,
                "status": "browser_open_failed",
                "platform": platform,
                "error": str(exc)[:500],
                "message": (
                    f"Impossible d'ouvrir {platform}. "
                    "Fermez les anciennes fenetres Chromium/Playwright puis reessayez."
                ),
            }
        )
        logger.exception("[social-session] open login failed %s", platform)

    except Exception as exc:
        startup_queue.put(
            {
                "success": False,
                "status": "browser_open_failed",
                "platform": platform,
                "error": str(exc)[:500],
                "message": f"Impossible d'ouvrir la fenetre {platform}.",
            }
        )
        logger.exception("[social-session] open login failed %s", platform)

    finally:
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


def send_login_worker_command(session: dict, command: str, timeout: int = 30) -> dict:
    command_queue = session.get("command_queue")
    if not command_queue:
        return {"success": False, "status": "login_window_closed"}

    response_queue = queue.Queue(maxsize=1)
    command_queue.put((command, response_queue), timeout=1)
    return response_queue.get(timeout=timeout)


def open_social_login_window(user_id: int, platform: str) -> dict:
    platform = normalize_platform(platform)

    if platform not in SUPPORTED_PLATFORMS:
        return {
            "success": False,
            "status": "unsupported_platform",
            "platform": platform,
            "message": "Plateforme non supportee.",
        }

    lock = get_platform_lock(platform, user_id)

    with lock:
        existing_session = get_existing_open_session(user_id, platform)

        if existing_session:
            try:
                send_login_worker_command(existing_session, "focus", timeout=5)
            except Exception:
                pass

            return {
                "success": True,
                "status": "login_window_open",
                "platform": platform,
                "message": f"Fenetre {platform} deja ouverte. Connectez-vous puis cliquez sur Verifier.",
            }

        try:
            startup_queue = queue.Queue(maxsize=1)
            command_queue = queue.Queue()
            thread = threading.Thread(
                target=run_social_login_worker,
                args=(platform, user_id, startup_queue, command_queue),
                name=f"social-login-{platform}-user-{user_id}",
                daemon=True,
            )
            thread.start()

            startup_result = startup_queue.get(timeout=120)
            if not startup_result.get("success"):
                return startup_result

            _OPEN_SOCIAL_LOGIN_SESSIONS[open_session_key(platform, user_id)] = {
                "thread": thread,
                "command_queue": command_queue,
                "started_at": time.time(),
            }

            return {
                "success": True,
                "status": "login_window_open",
                "platform": platform,
                "message": f"Connectez-vous a {platform} dans la fenetre ouverte puis cliquez sur Verifier.",
            }

        except Exception as exc:
            logger.exception("[social-session] open login failed %s", platform)

            return {
                "success": False,
                "status": "browser_open_failed",
                "platform": platform,
                "error": str(exc)[:500],
                "message": f"Impossible d'ouvrir la fenetre {platform}.",
            }


def check_social_session(user_id: int, platform: str) -> dict:
    platform = normalize_platform(platform)

    if platform not in SUPPORTED_PLATFORMS:
        return {
            "success": False,
            "status": "unsupported_platform",
            "platform": platform,
            "message": "Plateforme non supportee.",
        }

    lock = get_platform_lock(platform, user_id)

    with lock:
        open_session = get_existing_open_session(user_id, platform)

        if open_session:
            try:
                result = send_login_worker_command(open_session, "check", timeout=30)
                if result.pop("close_session", False):
                    _OPEN_SOCIAL_LOGIN_SESSIONS.pop(open_session_key(platform, user_id), None)
                    thread = open_session.get("thread")
                    if thread and thread.is_alive():
                        thread.join(timeout=5)
                return result

            except Exception as exc:
                logger.warning("[social-session] open page check failed %s: %s", platform, exc)
                close_open_social_window(user_id, platform)

        playwright = None
        context = None

        try:
            profile_dir = get_profile_dir(platform, user_id)
            playwright = sync_playwright().start()

            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=True,
                viewport={"width": 1400, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            )

            page = context.pages[0] if context.pages else context.new_page()
            page.goto(get_home_url(platform), wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(2500)
            close_popups(page, platform)

            if is_checkpoint_url(page.url):
                context.close()
                playwright.stop()
                return checkpoint_required_response(platform)

            if login_required_by_selectors(page, platform):
                context.close()
                playwright.stop()
                return login_required_response(platform)

            context.close()
            playwright.stop()
            return session_ready_response(platform)

        except Exception as exc:
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

            logger.exception("[social-session] check failed %s", platform)

            return {
                "success": False,
                "status": "session_check_error",
                "platform": platform,
                "error": str(exc)[:500],
                "message": f"Verification {platform} impossible.",
            }


def ensure_platform_session(user_id: int, platform: str) -> dict:
    """
    Used by scrapers/senders. Never opens a login window and never waits for
    user input; it only checks the shared persistent session.
    """
    return check_social_session(user_id, platform)


def reset_social_session(user_id: int, platform: str) -> dict:
    platform = normalize_platform(platform)

    if platform not in SUPPORTED_PLATFORMS:
        return {
            "success": False,
            "status": "unsupported_platform",
            "platform": platform,
        }

    lock = get_platform_lock(platform, user_id)

    with lock:
        close_open_social_window(user_id, platform)

        profile_dir = get_profile_dir(platform, user_id)

        try:
            if profile_dir.exists():
                shutil.rmtree(profile_dir)
            profile_dir.mkdir(parents=True, exist_ok=True)

            return {
                "success": True,
                "status": "session_reset",
                "platform": platform,
                "message": f"Session {platform} reinitialisee.",
            }

        except Exception as exc:
            return {
                "success": False,
                "status": "session_reset_failed",
                "platform": platform,
                "error": str(exc)[:500],
            }
