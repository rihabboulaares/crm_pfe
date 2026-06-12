import random
import time
from pathlib import Path

from django.contrib.auth import get_user_model
from playwright.sync_api import sync_playwright

from .session_manager import close_popups
from social_sessions.services import SocialSessionService


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def take_debug_screenshot(page, filename: str) -> str | None:
    try:
        path = Path(filename)
        page.screenshot(path=str(path), full_page=True)
        return str(path)
    except Exception:
        return None


def wait_for_input(page, selectors, timeout_ms=15000):
    deadline = timeout_ms
    while deadline > 0:
        for selector in selectors:
            try:
                loc = page.locator(selector)
                for index in range(loc.count() - 1, -1, -1):
                    item = loc.nth(index)
                    if item.is_visible(timeout=300):
                        return item
            except Exception:
                pass
        page.wait_for_timeout(500)
        deadline -= 500
    return None


def safe_click(page, selectors, timeout_ms=2000):
    for selector in selectors:
        try:
            loc = page.locator(selector)
            for index in range(loc.count()):
                item = loc.nth(index)
                if item.is_visible(timeout=timeout_ms) and item.is_enabled():
                    item.scroll_into_view_if_needed()
                    page.wait_for_timeout(200)
                    item.click()
                    return item
        except Exception:
            pass
    return None


def launch_context(platform: str, user_id: int, headless: bool = True, viewport=None, slow_mo=300):
    user = get_user_model().objects.get(id=user_id)
    session_status = SocialSessionService.has_valid_session(user, platform)
    if not session_status.get("ok"):
        raise RuntimeError(session_status.get("message") or f"Session {platform} non connectee.")

    session_path = SocialSessionService.get_session_path(user, platform)
    if not session_path:
        raise RuntimeError(f"Session {platform} introuvable pour user {user_id}.")

    playwright = sync_playwright().start()
    try:
        browser, context, page = SocialSessionService.launch_context_with_session_path(
            playwright,
            session_path,
            platform,
            headless=headless,
        )
        if viewport:
            try:
                page.set_viewport_size(viewport)
            except Exception:
                pass
        return playwright, context, page
    except Exception:
        try:
            playwright.stop()
        except Exception:
            pass
        raise


def close_common_popups(page, platform: str):
    close_popups(page, platform)
