from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as AsyncPlaywrightTimeoutError
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError


BASE_DIR = Path(__file__).resolve().parent.parent
SESSIONS_DIR = BASE_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
BASE_LINKEDIN_SESSION_DIR = Path("storage/linkedin_sessions")
BASE_LINKEDIN_SESSION_DIR.mkdir(parents=True, exist_ok=True)
BASE_SOCIAL_SESSION_DIR = Path("storage/social_sessions")
BASE_SOCIAL_SESSION_DIR.mkdir(parents=True, exist_ok=True)
_OPEN_LINKEDIN_LOGIN_SESSIONS = {}
_OPEN_ASYNC_LINKEDIN_LOGIN_SESSIONS = {}
_OPEN_SOCIAL_LOGIN_SESSIONS = {}


LINKEDIN_LOGIN_REQUIRED_RESPONSE = {
    "success": False,
    "status": "linkedin_login_required",
    "message": "Veuillez vous connecter à LinkedIn dans la fenêtre ouverte puis relancer l’action.",
}


def get_profile_dir(platform: str, user_id: int) -> Path:
    platform = (platform or "").lower().strip()

    if platform == "linkedin":
        return get_linkedin_profile_dir(user_id)

    if platform in {"facebook", "instagram"}:
        return get_social_profile_dir(platform, user_id)

    path = SESSIONS_DIR / platform / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_linkedin_profile_dir(user_id: int | str) -> Path:
    path = BASE_LINKEDIN_SESSION_DIR / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_social_profile_dir(platform: str, user_id: int | str) -> Path:
    if platform not in {"instagram", "facebook"}:
        raise ValueError(f"Unsupported social platform: {platform}")

    path = BASE_SOCIAL_SESSION_DIR / platform / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def linkedin_login_required_response() -> dict:
    return dict(LINKEDIN_LOGIN_REQUIRED_RESPONSE)


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
