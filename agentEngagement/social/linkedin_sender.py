from pathlib import Path
from playwright.sync_api import sync_playwright
import re


BASE_DIR = Path(__file__).resolve().parent.parent
SESSIONS_DIR = BASE_DIR / "sessions" / "linkedin"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def get_profile_dir(user_id: int) -> Path:
    path = SESSIONS_DIR / f"user_{user_id}"
    path.mkdir(parents=True, exist_ok=True)
    return path


class LinkedInSender:
    def __init__(self, user_id: int, headless: bool = False):
        self.user_id = user_id
        self.headless = headless
        self.profile_dir = get_profile_dir(user_id)

    def send(self, profile_url: str, message: str, send: bool = False) -> str:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.profile_dir),
                headless=self.headless,
                slow_mo=120,
                viewport={"width": 1366, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                ],
            )

            page = context.new_page()

            try:
                self.ensure_login(page)

                print(f"👤 Ouverture profil : {profile_url}")
                page.goto(profile_url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(6000)
                self.close_overlays(page)

                status = self.detect_status_from_top_buttons(page)
                print(f"📊 Statut LinkedIn détecté : {status}")

                if status == "connected":
                    result = self.send_direct_message(page, message, send)

                elif status == "pending":
                    result = "already_pending"

                elif status == "not_connected":
                    result = self.send_connection_request(page, message, send)

                else:
                    page.screenshot(
                        path=f"debug_linkedin_unknown_user_{self.user_id}.png",
                        full_page=True,
                    )
                    result = "unknown_status"

                return result

            except Exception as exc:
                print(f"[LinkedInSender ERROR] {exc}")
                page.screenshot(
                    path=f"debug_linkedin_error_user_{self.user_id}.png",
                    full_page=True,
                )
                return "linkedin_sender_error"

            finally:
                context.close()

    def ensure_login(self, page):
        page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(4000)

        if "login" not in page.url.lower() and "checkpoint" not in page.url.lower():
            print("✅ Session LinkedIn active")
            return True

        print("🔐 Connexion LinkedIn requise")
        page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=90000)

        input("Connecte-toi dans Chrome, puis appuie sur ENTER ici...")

        page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(5000)

        if "login" in page.url.lower() or "checkpoint" in page.url.lower():
            raise RuntimeError("Connexion LinkedIn non confirmée")

        print("✅ Connexion LinkedIn confirmée")
        return True

    def close_overlays(self, page):
        for sel in [
            "button[aria-label*='Fermer']",
            "button[aria-label*='Close']",
            "button[aria-label*='Dismiss']",
        ]:
            try:
                loc = page.locator(sel)
                for i in range(loc.count() - 1, -1, -1):
                    btn = loc.nth(i)
                    if btn.is_visible(timeout=500):
                        btn.click()
                        page.wait_for_timeout(300)
            except Exception:
                pass

    def top_buttons(self, page):
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1500)

        return page.evaluate(
            """
            () => {
                const pageWidth = window.innerWidth;
                const buttons = [];

                document.querySelectorAll('button').forEach((btn, index) => {
                    const rect = btn.getBoundingClientRect();

                    if (!rect || rect.width === 0 || rect.height === 0) return;
                    if (rect.top < 60 || rect.top > 720) return;
                    if (rect.left > pageWidth * 0.72) return;

                    const text = (btn.innerText || '').trim();
                    const aria = (btn.getAttribute('aria-label') || '').trim();

                    if (!text && !aria) return;

                    buttons.push({
                        index,
                        text,
                        aria,
                        top: Math.round(rect.top),
                        left: Math.round(rect.left),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    });
                });

                return buttons;
            }
            """
        )

    def detect_status_from_top_buttons(self, page) -> str:
        buttons = self.top_buttons(page)

        print("🔘 Boutons top-card détectés :")
        for b in buttons:
            print(f" - text='{b.get('text')}' aria='{b.get('aria')}' pos=({b.get('left')},{b.get('top')})")

        normalized = " | ".join(
            f"{b.get('text', '')} {b.get('aria', '')}".lower()
            for b in buttons
        )

        if "en attente" in normalized or "pending" in normalized:
            return "pending"

        if "message" in normalized:
            return "connected"

        if (
            "se connecter" in normalized
            or "connect" in normalized
            or "inviter" in normalized
            or "invite" in normalized
        ):
            return "not_connected"

        return "unknown"

    def click_top_button(self, page, texts) -> bool:
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1000)

        result = page.evaluate(
            """
            (texts) => {
                const wanted = texts.map(t => t.toLowerCase());
                const pageWidth = window.innerWidth;

                const buttons = [...document.querySelectorAll('button')];

                for (const btn of buttons) {
                    const rect = btn.getBoundingClientRect();

                    if (!rect || rect.width === 0 || rect.height === 0) continue;
                    if (rect.top < 60 || rect.top > 720) continue;
                    if (rect.left > pageWidth * 0.72) continue;

                    const text = (btn.innerText || '').trim().toLowerCase();
                    const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();

                    const full = `${text} ${aria}`;

                    if (wanted.some(w => full.includes(w))) {
                        btn.click();
                        return true;
                    }
                }

                return false;
            }
            """,
            texts,
        )

        if result:
            page.wait_for_timeout(2000)
            return True

        return False

    def click_anywhere_by_text(self, page, texts) -> bool:
        for text in texts:
            selectors = [
                f"button:has-text('{text}')",
                f"div[role='button']:has-text('{text}')",
                f"[role='menuitem']:has-text('{text}')",
                f"[role='option']:has-text('{text}')",
                f"span:has-text('{text}')",
            ]

            for sel in selectors:
                try:
                    loc = page.locator(sel)
                    for i in range(loc.count()):
                        el = loc.nth(i)
                        if el.is_visible(timeout=1000):
                            el.scroll_into_view_if_needed()
                            page.wait_for_timeout(300)
                            el.click()
                            page.wait_for_timeout(1500)
                            return True
                except Exception:
                    pass

        return False

    def wait_textbox(self, page, timeout_ms=15000):
        selectors = [
            "div.msg-form__contenteditable[contenteditable='true']",
            "div[role='textbox'][contenteditable='true']",
            ".msg-overlay-conversation-bubble [contenteditable='true']",
            "[contenteditable='true']",
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

    def type_and_send(self, page, message: str, send: bool) -> str:
        textbox = self.wait_textbox(page)

        if not textbox:
            page.screenshot(
                path=f"debug_linkedin_no_textbox_user_{self.user_id}.png",
                full_page=True,
            )
            return "message_failed"

        textbox.click()
        page.wait_for_timeout(500)

        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.keyboard.type(message, delay=25)

        if not send:
            return "message_ready"

        page.wait_for_timeout(1000)

        if self.click_anywhere_by_text(page, ["Envoyer", "Send"]):
            return "message_sent"

        try:
            textbox.press("Control+Enter")
            page.wait_for_timeout(2500)
            return "message_sent"
        except Exception:
            return "message_failed"

    def send_direct_message(self, page, message: str, send: bool) -> str:
        clicked = self.click_top_button(page, ["message"])

        if not clicked:
            page.screenshot(
                path=f"debug_linkedin_no_message_button_user_{self.user_id}.png",
                full_page=True,
            )
            return "message_failed"

        page.wait_for_timeout(4000)
        return self.type_and_send(page, message, send)

    def send_connection_request(self, page, message: str, send: bool) -> str:
        clicked = self.click_top_button(page, ["se connecter", "connect"])

        if not clicked:
            more_clicked = self.click_top_button(page, ["plus", "more"])

            if more_clicked:
                page.wait_for_timeout(1500)
                clicked = self.click_anywhere_by_text(page, ["Se connecter", "Connect"])

        if not clicked:
            page.screenshot(
                path=f"debug_linkedin_no_connect_user_{self.user_id}.png",
                full_page=True,
            )
            return "connection_request_failed"

        page.wait_for_timeout(3000)

        note_clicked = self.click_anywhere_by_text(page, ["Ajouter une note", "Add a note"])

        if note_clicked:
            page.wait_for_timeout(1000)

            for sel in [
                "textarea[name='message']",
                "textarea#custom-message",
                "[role='dialog'] textarea",
                "textarea",
            ]:
                try:
                    area = page.locator(sel).first
                    if area.is_visible(timeout=2000):
                        area.fill(message[:300])
                        break
                except Exception:
                    pass

        if not send:
            return "message_ready"

        if self.click_anywhere_by_text(
            page,
            ["Envoyer une invitation", "Send invitation", "Envoyer", "Send"],
        ):
            return "connection_request_sent"

        page.screenshot(
            path=f"debug_linkedin_send_failed_user_{self.user_id}.png",
            full_page=True,
        )
        return "connection_request_failed"


def send_linkedin_message(
    profile_url: str,
    message: str,
    user_id: int,
    send: bool = False,
) -> str:
    sender = LinkedInSender(user_id=user_id, headless=False)
    return sender.send(
        profile_url=profile_url,
        message=message,
        send=send,
    )