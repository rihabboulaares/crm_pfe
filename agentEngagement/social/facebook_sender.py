from playwright.sync_api import sync_playwright
import random
import time

from .manual_login import facebook_login_required, wait_manual_login
from .session_manager import get_social_profile_dir


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def close_popups(page):
    selectors = [
        "button:has-text('Autoriser les cookies essentiels et optionnels')",
        "button:has-text('Allow all cookies')",
        "button:has-text('Tout accepter')",
        "button:has-text('Accept all')",
        "[data-cookiebanner='accept_button']",
        "div[aria-label='Fermer'][role='button']",
        "div[aria-label='Close'][role='button']",
        "button:has-text('Pas maintenant')",
        "button:has-text('Not Now')",
    ]

    for sel in selectors:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1200):
                btn.click()
                page.wait_for_timeout(600)
        except Exception:
            pass


def click_message_button(page):
    selectors = [
        "div[aria-label='Envoyer un message'][role='button']",
        "div[aria-label='Message'][role='button']",
        "a[aria-label='Envoyer un message']",
        "div[role='button']:has-text('Envoyer un message')",
        "span:has-text('Envoyer un message')",
        "div[role='button']:has-text('Message')",
        "div[aria-label='Send message'][role='button']",
        "div[role='button']:has-text('Send message')",
    ]

    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                return el
        except Exception:
            pass

    return None


def handle_non_friend_popup(page):
    selectors = [
        "div[role='dialog'] div[role='button']:has-text('Envoyer quand même')",
        "div[role='dialog'] div[role='button']:has-text('Send anyway')",
        "div[role='dialog'] div[role='button']:has-text('Envoyer en tant que demande')",
        "div[role='dialog'] div[role='button']:has-text('Send as request')",
        "div[role='dialog'] div[role='button']:has-text('Envoyer')",
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
        "div[aria-label='Écrivez un message…'][role='textbox']",
        "div[aria-label='Write a message…'][role='textbox']",
        "div[aria-label*='essage'][role='textbox']",
        "div[role='dialog'] div[role='textbox']",
        "div[role='dialog'] [contenteditable='true']",
        "div[aria-label='Aa'][role='textbox']",
        "[contenteditable='true'][role='textbox']",
        "textarea[placeholder*='essage']",
        "textarea[placeholder*='Aa']",
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


def send_facebook_message(
    profile_url: str,
    message: str,
    user_id: int,
    send: bool = False,
) -> str:
    profile_dir = get_social_profile_dir("facebook", user_id)
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
            viewport={"width": 1280, "height": 900},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            page.goto(profile_url, wait_until="domcontentloaded", timeout=60000)

            if facebook_login_required(page):
                ok = wait_manual_login(page, "facebook")

                if not ok:
                    keep_context_open = True
                    return "facebook_login_required"

                page.goto(profile_url, wait_until="domcontentloaded", timeout=60000)

            page.wait_for_timeout(8000)
            close_popups(page)

            unavailable = (
                page.locator("div:has-text('Ce contenu n\\'est pas disponible')").count() > 0
                or page.locator("div:has-text('This content isn\\'t available')").count() > 0
            )

            if unavailable:
                return "not_found"

            msg_btn = click_message_button(page)

            if not msg_btn:
                page.screenshot(path=f"debug_fb_no_btn_user_{user_id}.png")
                return "no_message_button"

            msg_btn.click()
            human_delay(2000, 3000)
            close_popups(page)

            handle_non_friend_popup(page)

            try:
                page.wait_for_url(
                    lambda url: "messenger.com" in url or "/messages/t/" in url,
                    timeout=7000,
                )
            except Exception:
                pass

            human_delay(1500, 2500)
            close_popups(page)

            input_box = wait_for_message_input(page, timeout_ms=15000)

            if not input_box:
                page.screenshot(path=f"debug_fb_no_input_user_{user_id}.png")
                return "message_failed"

            input_box.click()
            human_delay(400, 700)
            page.keyboard.type(message, delay=40)
            human_delay(600, 1200)

            if not send:
                return "message_ready"

            sent = False

            send_selectors = [
                "div[aria-label='Envoyer'][role='button']",
                "div[aria-label='Send'][role='button']",
                "button[aria-label='Envoyer']",
                "button[aria-label='Send']",
                "div[role='button']:has-text('Envoyer')",
            ]

            for sel in send_selectors:
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
