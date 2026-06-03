from pathlib import Path
from playwright.sync_api import sync_playwright, Error as PlaywrightError


BASE_DIR = Path(__file__).resolve().parent.parent
SESSIONS_DIR = BASE_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def get_profile_dir(platform: str, user_id: int) -> Path:
    if platform in {"facebook", "instagram"}:
        platform = "meta"

    path = SESSIONS_DIR / platform / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def open_social_login(platform: str, user_id: int) -> str:
    if platform in {"facebook", "instagram"}:
        platform = "meta"

    if platform not in {"linkedin", "meta"}:
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
                    "Connecte-toi à LinkedIn. "
                    "Si LinkedIn demande une vérification/checkpoint, termine-la aussi, "
                    "puis appuie sur ENTER ici..."
                )

                status = _check_linkedin_page(page)
                return status

            if platform == "meta":
                page.goto(
                    "https://www.facebook.com/login/",
                    wait_until="domcontentloaded",
                    timeout=90000,
                )

                input(
                    "Connecte-toi à Facebook/Meta. "
                    "Si Meta demande une vérification 2FA, termine-la aussi, "
                    "puis appuie sur ENTER ici..."
                )

                facebook_status = _open_and_check(
                    page,
                    "https://www.facebook.com/",
                    _facebook_login_required,
                )

                instagram_status = _open_and_check(
                    page,
                    "https://www.instagram.com/",
                    _instagram_login_required,
                )

                if facebook_status == "connected" or instagram_status == "connected":
                    return "login_success"

                if facebook_status == "checkpoint" or instagram_status == "checkpoint":
                    return "checkpoint_required"

                return "login_failed"

        except Exception as exc:
            return f"login_error:{str(exc)[:300]}"

        finally:
            context.close()


def check_social_session(platform: str, user_id: int) -> dict:
    if platform in {"facebook", "instagram"}:
        platform = "meta"

    if platform not in {"linkedin", "meta"}:
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

            facebook_status = _open_and_check(
                page,
                "https://www.facebook.com/",
                _facebook_login_required,
            )

            instagram_status = _open_and_check(
                page,
                "https://www.instagram.com/",
                _instagram_login_required,
            )

            return {
                "success": facebook_status == "connected" or instagram_status == "connected",
                "platform": "meta",
                "facebook": facebook_status,
                "instagram": instagram_status,
                "status": "connected"
                if facebook_status == "connected" or instagram_status == "connected"
                else "login_required",
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