import random
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

from .session_manager import close_popups, get_profile_dir


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
    playwright = sync_playwright().start()
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=str(get_profile_dir(platform, user_id)),
        headless=headless,
        slow_mo=slow_mo,
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        viewport=viewport or {"width": 1280, "height": 900},
        args=[
            "--disable-blink-features=AutomationControlled",
            "--start-maximized",
        ],
    )
    page = context.pages[0] if context.pages else context.new_page()
    return playwright, context, page


def close_common_popups(page, platform: str):
    close_popups(page, platform)
