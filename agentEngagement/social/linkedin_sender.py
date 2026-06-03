from pathlib import Path
from playwright.sync_api import sync_playwright


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
                if not self.ensure_login(page):
                    return "login_required"

                print(f"👤 Ouverture profil : {profile_url}")
                page.goto(profile_url, wait_until="domcontentloaded", timeout=90000)
                page.wait_for_timeout(7000)
                self.close_overlays(page)

                status = self.detect_status_from_profile(page)
                print(f"📊 Statut LinkedIn détecté : {status}")

                if status == "connected":
                    return self.send_direct_message(page, message, send)

                if status == "pending":
                    return "already_pending"

                if status == "not_connected":
                    return self.send_connection_request(page, message, send)

                page.screenshot(
                    path=f"debug_linkedin_unknown_user_{self.user_id}.png",
                    full_page=True,
                )
                return "unknown_status"

            except Exception as exc:
                print(f"[LinkedInSender ERROR] {exc}")
                try:
                    page.screenshot(
                        path=f"debug_linkedin_error_user_{self.user_id}.png",
                        full_page=True,
                    )
                except Exception:
                    pass
                return "linkedin_sender_error"

            finally:
                context.close()

    def ensure_login(self, page) -> bool:
        page.goto(
            "https://www.linkedin.com/feed/",
            wait_until="domcontentloaded",
            timeout=90000,
        )
        page.wait_for_timeout(5000)

        url = page.url.lower()

        if "login" not in url and "checkpoint" not in url and "challenge" not in url:
            print("✅ Session LinkedIn active")
            return True

        print("🔐 Session LinkedIn non active ou checkpoint requis")
        return False

    def close_overlays(self, page):
        selectors = [
            "button[aria-label*='Fermer']",
            "button[aria-label*='Close']",
            "button[aria-label*='Dismiss']",
            "button:has-text('Ignorer')",
            "button:has-text('Skip')",
        ]

        for sel in selectors:
            try:
                loc = page.locator(sel)
                for i in range(loc.count() - 1, -1, -1):
                    btn = loc.nth(i)
                    if btn.is_visible(timeout=500):
                        btn.click()
                        page.wait_for_timeout(300)
            except Exception:
                pass

    def detect_status_from_profile(self, page) -> str:
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1200)

        actions = self.collect_profile_actions(page)

        print("🔘 Actions profil détectées :")
        for a in actions:
            print(
                f" - tag='{a.get('tag')}' text='{a.get('text')}' "
                f"aria='{a.get('aria')}' pos=({a.get('x')},{a.get('y')})"
            )

        normalized = " | ".join(
            f"{a.get('text', '')} {a.get('aria', '')}".lower()
            for a in actions
        )

        if "message" in normalized or "envoyer un message" in normalized:
            return "connected"

        if "en attente" in normalized or "pending" in normalized:
            return "pending"

        if (
            "se connecter" in normalized
            or "connect" in normalized
            or "inviter" in normalized
            or "invite" in normalized
        ):
            return "not_connected"

        if "plus" in normalized or "more" in normalized:
            more_status = self.detect_status_inside_more_menu(page)
            if more_status:
                return more_status

        return "unknown"

    def collect_profile_actions(self, page):
        return page.evaluate(
            """
            () => {
                const nodes = [
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('a'),
                    ...document.querySelectorAll('div[role="button"]')
                ];

                const actions = [];

                for (const el of nodes) {
                    const rect = el.getBoundingClientRect();

                    if (!rect || rect.width === 0 || rect.height === 0) continue;

                    // zone top-card du profil LinkedIn
                    if (rect.top < 330 || rect.top > 680) continue;
                    if (rect.left < 70 || rect.left > 700) continue;

                    const text = (el.innerText || '').trim();
                    const aria = (el.getAttribute('aria-label') || '').trim();

                    if (!text && !aria) continue;

                    actions.push({
                        tag: el.tagName,
                        text,
                        aria,
                        x: Math.round(rect.left),
                        y: Math.round(rect.top),
                        w: Math.round(rect.width),
                        h: Math.round(rect.height),
                    });
                }

                return actions;
            }
            """
        )

    def detect_status_inside_more_menu(self, page):
        if not self.click_profile_action(page, ["plus", "more"]):
            return None

        page.wait_for_timeout(1800)

        menu_text = ""

        for sel in [
            "[role='menu']",
            "div.artdeco-dropdown__content",
            "div[role='dialog']",
        ]:
            try:
                loc = page.locator(sel).first
                if loc.is_visible(timeout=1000):
                    menu_text += " " + loc.inner_text(timeout=3000).lower()
            except Exception:
                pass

        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        if "message" in menu_text or "envoyer un message" in menu_text:
            return "connected"

        if (
            "se connecter" in menu_text
            or "connect" in menu_text
            or "inviter" in menu_text
            or "invite" in menu_text
        ):
            return "not_connected"

        if "en attente" in menu_text or "pending" in menu_text:
            return "pending"

        return None

    def click_profile_action(self, page, texts) -> bool:
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1000)

        wanted = [t.lower() for t in texts]

        selectors = [
            "button",
            "a",
            "div[role='button']",
            "span",
        ]

        for sel in selectors:
            try:
                loc = page.locator(sel)
                count = loc.count()

                for i in range(count):
                    el = loc.nth(i)

                    try:
                        if not el.is_visible(timeout=300):
                            continue

                        box = el.bounding_box()
                        if not box:
                            continue

                        # zone top-card du profil LinkedIn
                        if box["y"] < 330 or box["y"] > 700:
                            continue

                        if box["x"] < 70 or box["x"] > 700:
                            continue

                        text = (el.inner_text(timeout=500) or "").strip().lower()
                        aria = (el.get_attribute("aria-label") or "").strip().lower()
                        full = f"{text} {aria}"

                        if any(w in full for w in wanted):
                            el.scroll_into_view_if_needed()
                            page.wait_for_timeout(300)
                            el.click()
                            page.wait_for_timeout(2000)
                            return True

                    except Exception:
                        pass

            except Exception:
                pass

        return False

    def click_anywhere_by_text(self, page, texts) -> bool:
        for text in texts:
            selectors = [
                f"button:has-text('{text}')",
                f"a:has-text('{text}')",
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
                            page.wait_for_timeout(1800)
                            return True
                except Exception:
                    pass

        return False

    def wait_textbox(self, page, timeout_ms=15000):
        selectors = [
            "div.msg-form__contenteditable[contenteditable='true']",
            "div[role='textbox'][contenteditable='true']",
            ".msg-overlay-conversation-bubble [contenteditable='true']",
            ".msg-form__msg-content-container [contenteditable='true']",
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
        page.wait_for_timeout(700)

        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")
        page.keyboard.type(message, delay=25)

        if not send:
            return "message_ready"

        page.wait_for_timeout(1200)

        if self.click_anywhere_by_text(page, ["Envoyer", "Send"]):
            page.wait_for_timeout(2500)
            return "message_sent"

        try:
            textbox.press("Control+Enter")
            page.wait_for_timeout(2500)
            return "message_sent"
        except Exception:
            return "message_failed"

    def send_direct_message(self, page, message: str, send: bool) -> str:
        clicked = self.click_profile_action(
            page,
            ["message", "envoyer un message", "send message"],
        )

        if not clicked:
            more_clicked = self.click_profile_action(page, ["plus", "more"])

            if more_clicked:
                page.wait_for_timeout(1500)
                clicked = self.click_anywhere_by_text(
                    page,
                    ["Message", "Envoyer un message", "Send message"],
                )

        if not clicked:
            page.screenshot(
                path=f"debug_linkedin_no_message_button_user_{self.user_id}.png",
                full_page=True,
            )
            return "message_failed"

        page.wait_for_timeout(4000)
        return self.type_and_send(page, message, send)

    def send_connection_request(self, page, message: str, send: bool) -> str:
        clicked = self.click_profile_action(
            page,
            ["se connecter", "connect", "inviter", "invite"],
        )

        if not clicked:
            more_clicked = self.click_profile_action(page, ["plus", "more"])

            if more_clicked:
                page.wait_for_timeout(1500)
                clicked = self.click_anywhere_by_text(
                    page,
                    ["Se connecter", "Connect", "Inviter", "Invite"],
                )

        if not clicked:
            page.screenshot(
                path=f"debug_linkedin_no_connect_user_{self.user_id}.png",
                full_page=True,
            )
            return "connection_request_failed"

        page.wait_for_timeout(3000)

        note_clicked = self.click_anywhere_by_text(
            page,
            ["Ajouter une note", "Add a note"],
        )

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
            page.wait_for_timeout(2500)
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