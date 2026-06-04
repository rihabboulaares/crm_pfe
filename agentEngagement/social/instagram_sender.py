from playwright.sync_api import sync_playwright
import random
import time

from .manual_login import instagram_login_required, wait_manual_login
from .session_manager import get_social_profile_dir


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def close_popups(page):
    selectors = [
        "button:has-text('Pas maintenant')",
        "button:has-text('Not Now')",
        "button:has-text('Tout autoriser')",
        "button:has-text('Allow all cookies')",
        "button:has-text('Accepter')",
    ]

    for sel in selectors:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1500):
                btn.click()
                page.wait_for_timeout(600)
        except Exception:
            pass


def handle_message_request_popup(page):
    selectors = [
        "div[role='dialog'] button:has-text('Envoyer une demande')",
        "div[role='dialog'] div[role='button']:has-text('Envoyer une demande')",
        "div[role='dialog'] button:has-text('Send message request')",
        "div[role='dialog'] button:has-text('Envoyer la demande')",
        "div[role='dialog'] button:has-text('Envoyer')",
    ]

    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                el.click()
                human_delay(1500, 2500)
                return True
        except Exception:
            pass

    return False


def wait_for_message_input(page, timeout_ms=15000):
    selectors = [
        "div[aria-label='Message'][role='textbox']",
        "div[aria-label='Envoyer un message'][role='textbox']",
        "div[aria-label*='essage'][role='textbox']",
        "textarea[placeholder*='essage']",
        "textarea[placeholder*='Envoyer']",
        "[contenteditable='true'][role='textbox']",
        "div[role='dialog'] [contenteditable='true']",
        "div[role='dialog'] div[role='textbox']",
    ]

    deadline = timeout_ms

    while deadline > 0:
        for sel in selectors:
            try:
                loc = page.locator(sel)
                for i in range(loc.count() - 1, -1, -1):
                    el = loc.nth(i)
                    if el.is_visible(timeout=300):
                        return el
            except Exception:
                pass

        page.wait_for_timeout(500)
        deadline -= 500

    return None


def click_message_button(page):
    selectors = [
        "div[role='button']:has-text('Contacter')",
        "button:has-text('Contacter')",
        "div[role='button']:has-text('Envoyer un message')",
        "div[role='button']:has-text('Message')",
        "button:has-text('Message')",
    ]

    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                return el
        except Exception:
            pass

    return None


def handle_contacter_modal(page):
    selectors = [
        "div[role='dialog'] div[role='button']:has-text('Envoyer un message')",
        "div[role='dialog'] button:has-text('Envoyer un message')",
        "div[role='dialog'] div[role='button']:has-text('Message')",
        "a:has-text('Envoyer un message')",
    ]

    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                el.click()
                return True
        except Exception:
            pass

    return False


def send_instagram_message(
    profile_url: str,
    message: str,
    user_id: int,
    send: bool = False,
) -> str:
    profile_dir = get_social_profile_dir("instagram", user_id)
    keep_context_open = False
    playwright = sync_playwright().start()

    try:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            slow_mo=300,
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            page.goto(profile_url, wait_until="domcontentloaded", timeout=60000)

            if instagram_login_required(page):
                ok = wait_manual_login(page, "instagram")

                if not ok:
                    keep_context_open = True
                    return "instagram_login_required"

                page.goto(profile_url, wait_until="domcontentloaded", timeout=60000)

            page.wait_for_timeout(8000)
            close_popups(page)

            if page.locator("h2:has-text('introuvable'), h2:has-text('Not Found')").count() > 0:
                return "not_found"

            msg_btn = click_message_button(page)

            if not msg_btn:
                page.screenshot(path=f"debug_ig_no_btn_user_{user_id}.png")
                return "no_message_button"

            msg_btn.click()
            human_delay(1500, 2500)

            if handle_contacter_modal(page):
                human_delay(1500, 2500)

            try:
                handle_message_request_popup(page)
                page.wait_for_url("**/direct/t/**", timeout=6000)
            except Exception:
                pass

            human_delay(1000, 2000)
            close_popups(page)

            input_box = wait_for_message_input(page, timeout_ms=15000)

            if not input_box:
                page.screenshot(path=f"debug_ig_no_input_user_{user_id}.png")
                return "message_failed"

            input_box.click()
            human_delay(400, 700)
            page.keyboard.type(message, delay=35)
            human_delay(600, 1200)

            if not send:
                return "message_ready"

            sent = False

            selectors = [
                "button:has-text('Envoyer')",
                "button:has-text('Send')",
                "[aria-label='Envoyer']",
                "[aria-label='Send']",
                "div[role='dialog'] button:has-text('Envoyer')",
            ]

            for sel in selectors:
                try:
                    btn = page.locator(sel).last
                    if btn.is_visible(timeout=2000) and btn.is_enabled():
                        btn.click()
                        sent = True
                        break
                except Exception:
                    pass

            if not sent:
                input_box.press("Enter")

            human_delay(2000, 3000)
            return "message_sent"
        finally:
            if not keep_context_open:
                context.close()
    finally:
        if not keep_context_open:
            playwright.stop()
