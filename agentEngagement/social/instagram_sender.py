import random
import time

from .base_sender import launch_context, take_debug_screenshot
from .session_manager import ensure_platform_session, login_required_by_selectors


def sender_result(success, status, sent=False, channel="instagram", error=None, screenshot=None):
    return {
        "success": success,
        "status": status,
        "sent": sent,
        "channel": channel,
        "error": error,
        "screenshot": screenshot,
    }


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
) -> dict:
    session_result = ensure_platform_session(user_id=user_id, platform="instagram")
    if not session_result.get("success"):
        return {**session_result, "sent": False, "channel": "instagram"}

    keep_context_open = False
    playwright = None

    try:
        playwright, context, page = launch_context("instagram", user_id, viewport={"width": 1280, "height": 800})

        try:
            page.goto(profile_url, wait_until="domcontentloaded", timeout=60000)

            if login_required_by_selectors(page, "instagram"):
                keep_context_open = True
                return {
                    "success": False,
                    "status": "login_required",
                    "platform": "instagram",
                    "message": "Veuillez vous connecter a Instagram dans la fenetre ouverte puis relancer l'action.",
                    "sent": False,
                    "channel": "instagram",
                }

            page.wait_for_timeout(8000)
            close_popups(page)

            if page.locator("h2:has-text('introuvable'), h2:has-text('Not Found')").count() > 0:
                return sender_result(False, "not_found", error="Profil Instagram introuvable")

            msg_btn = click_message_button(page)

            if not msg_btn:
                screenshot = take_debug_screenshot(page, f"debug_ig_no_btn_user_{user_id}.png")
                return sender_result(False, "no_message_button", error="Bouton message introuvable", screenshot=screenshot)

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
                screenshot = take_debug_screenshot(page, f"debug_ig_no_input_user_{user_id}.png")
                return sender_result(False, "message_failed", error="Champ message introuvable", screenshot=screenshot)

            input_box.click()
            human_delay(400, 700)
            page.keyboard.type(message, delay=35)
            human_delay(600, 1200)

            if not send:
                return sender_result(True, "message_ready", sent=False)

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
            return sender_result(True, "message_sent", sent=True)
        finally:
            if not keep_context_open:
                context.close()
    finally:
        if not keep_context_open:
            playwright.stop()
