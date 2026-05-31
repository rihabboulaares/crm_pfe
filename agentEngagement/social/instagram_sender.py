from pathlib import Path
from playwright.sync_api import sync_playwright
import time
import random


BASE_DIR = Path(__file__).resolve().parent.parent
SESSION_DIR = BASE_DIR / "sessions"
SESSION_DIR.mkdir(exist_ok=True)


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def get_storage_file(user_id: int):
    return SESSION_DIR / f"instagram_session_user_{user_id}.json"


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
    storage_file = get_storage_file(user_id)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            slow_mo=80,
            args=["--disable-blink-features=AutomationControlled"],
        )

        context_kwargs = {
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "viewport": {"width": 1280, "height": 800},
        }

        if storage_file.exists():
            context_kwargs["storage_state"] = str(storage_file)

        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        page.goto("https://www.instagram.com/", wait_until="domcontentloaded")
        human_delay(3000, 4000)
        close_popups(page)

        if "login" in page.url or page.locator("input[name='username']").count() > 0:
            page.goto("https://www.instagram.com/accounts/login/", wait_until="domcontentloaded")
            input("Connecte-toi à Instagram puis appuie sur ENTER...")
            context.storage_state(path=str(storage_file))
            human_delay(2000, 3000)
            close_popups(page)

        page.goto(profile_url, wait_until="domcontentloaded")
        human_delay(3000, 4000)
        close_popups(page)

        if page.locator("h2:has-text('introuvable'), h2:has-text('Not Found')").count() > 0:
            context.storage_state(path=str(storage_file))
            browser.close()
            return "not_found"

        msg_btn = click_message_button(page)

        if not msg_btn:
            page.screenshot(path=f"debug_ig_no_btn_user_{user_id}.png")
            context.storage_state(path=str(storage_file))
            browser.close()
            return "no_message_button"

        msg_btn.click()
        human_delay(1500, 2500)

        if handle_contacter_modal(page):
            human_delay(1500, 2500)

        request_confirmed = handle_message_request_popup(page)

        if request_confirmed:
            try:
                page.wait_for_url("**/direct/t/**", timeout=6000)
            except Exception:
                pass
            human_delay(1000, 2000)
        else:
            try:
                page.wait_for_url("**/direct/t/**", timeout=6000)
            except Exception:
                pass
            human_delay(1000, 2000)

        close_popups(page)

        input_box = wait_for_message_input(page, timeout_ms=15000)

        if not input_box:
            page.screenshot(path=f"debug_ig_no_input_user_{user_id}.png")
            context.storage_state(path=str(storage_file))
            browser.close()
            return "message_failed"

        input_box.click()
        human_delay(400, 700)
        page.keyboard.type(message, delay=35)
        human_delay(600, 1200)

        if not send:
            context.storage_state(path=str(storage_file))
            browser.close()
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
        context.storage_state(path=str(storage_file))
        browser.close()

        return "message_sent"