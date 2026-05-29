from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_URL = "https://www.linkedin.com/in/rihab-boulaares-6b8065225/"
EXPECTED_NAME = "Rihab Boulaares"
MESSAGE = "Bonjour Rihab, j’espère que vous allez bien."

SEND_MESSAGE = False

BASE_DIR = Path(__file__).resolve().parent.parent
SESSION_DIR = BASE_DIR / "sessions"
SESSION_DIR.mkdir(exist_ok=True)

STORAGE_FILE = SESSION_DIR / "linkedin_session.json"


def find_visible_last(page, selector):
    locators = page.locator(selector)
    for i in range(locators.count() - 1, -1, -1):
        try:
            item = locators.nth(i)
            if item.is_visible():
                return item
        except:
            pass
    return None


def close_old_message_windows(page):
    buttons = page.locator(
        "button[aria-label*='Fermer'], "
        "button[aria-label*='Close'], "
        "button.msg-overlay-bubble-header__control"
    )

    for i in range(buttons.count() - 1, -1, -1):
        try:
            btn = buttons.nth(i)
            if btn.is_visible():
                btn.evaluate("(el) => el.click()")
                page.wait_for_timeout(500)
        except:
            pass


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=300)

        if STORAGE_FILE.exists():
            context = browser.new_context(storage_state=str(STORAGE_FILE))
        else:
            context = browser.new_context()

        page = context.new_page()

        page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        if "login" in page.url or "checkpoint" in page.url:
            print("🔐 Connexion LinkedIn requise")
            page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
            input("Connecte-toi puis ENTER...")
            context.storage_state(path=str(STORAGE_FILE))

        close_old_message_windows(page)

        print("🔍 Ouverture du profil...")
        page.goto(PROFILE_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(7000)

        close_old_message_windows(page)

        print("💬 Recherche du bouton Message du profil...")

        message_button = page.locator(
            "main a[href*='/messaging/compose/']"
        ).first

        try:
            message_button.wait_for(timeout=15000)
            message_button.scroll_into_view_if_needed()
            message_button.evaluate("(el) => el.click()")
        except Exception:
            print("❌ Bouton Message introuvable")
            browser.close()
            return "no_message_button"

        page.wait_for_timeout(8000)

        print("🔎 Vérification du destinataire...")

        page_text = page.locator("body").inner_text(timeout=5000)

        if EXPECTED_NAME not in page_text:
            print("❌ Mauvaise conversation détectée")
            print(f"👉 Destinataire attendu : {EXPECTED_NAME}")
            page.screenshot(path=str(BASE_DIR / "linkedin_wrong_conversation.png"), full_page=True)
            browser.close()
            return "wrong_conversation"

        print(f"✅ Conversation correcte : {EXPECTED_NAME}")

        print("✍️ Recherche zone message...")

        textbox = find_visible_last(
            page,
            "div.msg-form__contenteditable[contenteditable='true'], "
            "div[role='textbox'][contenteditable='true'], "
            "div[contenteditable='true']"
        )

        if not textbox:
            print("❌ Zone message introuvable")
            browser.close()
            return "not_connected_or_no_textbox"

        textbox.evaluate("(el) => el.focus()")
        page.keyboard.type(MESSAGE, delay=30)

        print("✅ Message écrit")

        if SEND_MESSAGE:
            send_button = find_visible_last(
                page,
                "button.msg-form__send-button, "
                "button[aria-label*='Envoyer'], "
                "button[aria-label*='Send']"
            )

            if send_button and send_button.is_enabled():
                send_button.evaluate("(el) => el.click()")
                print("✅ Message envoyé")
                result = "message_sent"
            else:
                print("❌ Bouton Envoyer introuvable")
                result = "send_button_missing"
        else:
            print("🧪 Mode test : message non envoyé")
            result = "message_ready"

        context.storage_state(path=str(STORAGE_FILE))
        browser.close()
        return result


if __name__ == "__main__":
    status = main()
    print("Résultat final :", status)