from pathlib import Path
from playwright.sync_api import sync_playwright
import re

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
PROFILE_URL     = "https://www.linkedin.com/in/rihab-boulaares-6b8065225/"
EXPECTED_NAME   = "Rihab Boulaares"
DIRECT_MESSAGE  = "Bonjour Rihab, j'espère que vous allez bien."
CONNECTION_NOTE = "Bonjour Rihab, j'espère que vous allez bien."
SEND            = True
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).resolve().parent
SESSION_DIR  = BASE_DIR / "sessions"
SESSION_DIR.mkdir(exist_ok=True)
STORAGE_FILE = SESSION_DIR / "linkedin_session.json"

# Boutons de la sidebar à toujours ignorer (aria-label contient ces mots)
SIDEBAR_ARIA_FRAGMENTS = ["inviter", "invite", "suivre", "follow"]


def close_overlays(page):
    try:
        for sel in [
            "button[aria-label*='Fermer']",
            "button[aria-label*='Close']",
            "button[aria-label*='Dismiss']",
        ]:
            loc = page.locator(sel)
            for i in range(loc.count() - 1, -1, -1):
                try:
                    b = loc.nth(i)
                    if b.is_visible():
                        b.evaluate("el => el.click()")
                        page.wait_for_timeout(300)
                except Exception:
                    pass
    except Exception:
        pass


def scroll_to_top(page):
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(600)


# ══════════════════════════════════════════════════════════════════════════════
#  STRATÉGIE CLÉ : trouver les boutons UNIQUEMENT par position dans la page
#  La top-card est toujours dans le premier tiers de l'écran (top < 700px).
#  Les boutons de la sidebar sont à droite (left > 60% de la largeur).
#  On filtre par position Y ET par aria-label.
# ══════════════════════════════════════════════════════════════════════════════

def find_topcard_button(page, *texts):
    """
    Trouve un bouton de la top-card par son texte.
    Utilise la POSITION (top < 700px, pas dans aside/sidebar) pour filtrer.
    Ignore complètement les classes CSS hashées de LinkedIn.
    """
    scroll_to_top(page)
    page.wait_for_timeout(1000)

    for text in texts:
        result = page.evaluate(f"""(expectedText) => {{
            const EXPECTED_FIRST = "{EXPECTED_NAME.split()[0].lower()}";
            const allBtns = [...document.querySelectorAll('button')];

            for (const btn of allBtns) {{
                const rect = btn.getBoundingClientRect();
                const btnText = (btn.innerText || '').trim().toLowerCase();
                const aria = (btn.getAttribute('aria-label') || '').toLowerCase();

                // Doit avoir le bon texte
                if (!btnText.includes(expectedText.toLowerCase())) continue;

                // Filtrer la sidebar : boutons à droite (left > 65% de la largeur)
                const pageWidth = window.innerWidth;
                if (rect.left > pageWidth * 0.65) continue;

                // Filtrer les boutons de navigation (top < 60px)
                if (rect.top < 60) continue;

                // Filtrer si l'aria mentionne "inviter" quelqu'un d'autre
                const sidebarWords = ['inviter', 'invite', 'suivre jed', 'suivre aymen',
                                      'suivre rayan', 'suivre tony', 'suivre glenn'];
                if (sidebarWords.some(w => aria.includes(w))) continue;

                // Doit être dans la zone profil (top entre 60 et 700px)
                if (rect.top > 700) continue;

                // ✅ C'est notre bouton
                return {{
                    found: true,
                    text: btnText,
                    aria: aria,
                    top: Math.round(rect.top),
                    left: Math.round(rect.left),
                }};
            }}
            return {{ found: false }};
        }}""", text)

        if result and result.get("found"):
            print(f"✅ Bouton top-card : text='{result['text']}' aria='{result['aria']}' pos=({result['left']},{result['top']})")
            # Maintenant on le récupère en Playwright pour pouvoir cliquer
            btn = _get_button_by_position_and_text(page, text, result["top"], result["left"])
            if btn:
                return btn

    return None


def _get_button_by_position_and_text(page, text, approx_top, approx_left):
    """Récupère le locator Playwright du bouton à la position donnée."""
    loc = page.locator(f"button:has-text('{text}')")
    for i in range(loc.count()):
        try:
            btn = loc.nth(i)
            if not btn.is_visible(timeout=500):
                continue
            box = btn.bounding_box()
            if not box:
                continue
            # Tolérance de 20px
            if abs(box["y"] - approx_top) < 20 and abs(box["x"] - approx_left) < 20:
                return btn
        except Exception:
            pass
    # Fallback : le premier bouton visible avec ce texte dans la zone profil
    for i in range(loc.count()):
        try:
            btn = loc.nth(i)
            if not btn.is_visible(timeout=500):
                continue
            box = btn.bounding_box()
            if not box:
                continue
            page_width = page.evaluate("window.innerWidth")
            if box["x"] < page_width * 0.65 and 60 < box["y"] < 700:
                return btn
        except Exception:
            pass
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  DÉTECTION STATUT
# ══════════════════════════════════════════════════════════════════════════════

def get_status(page):
    scroll_to_top(page)
    # Attendre que la top-card soit chargée
    page.wait_for_timeout(2000)

    # Scan tous les boutons de la top-card par position
    buttons_found = page.evaluate("""() => {
        const pageWidth = window.innerWidth;
        const result = { texts: [] };
        document.querySelectorAll('button').forEach(btn => {
            const rect = btn.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            if (rect.top < 60 || rect.top > 700) return;
            if (rect.left > pageWidth * 0.65) return;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const sidebarWords = ['inviter', 'invite'];
            if (sidebarWords.some(w => aria.includes(w))) return;
            const text = (btn.innerText || '').trim().toLowerCase();
            if (text) result.texts.push(text);
        });
        return result;
    }""")

    texts = set(buttons_found.get("texts", []))
    print(f"🔘 Boutons top-card (par position) : {texts}")

    if "en attente" in texts or "pending" in texts:
        return "pending"

    has_connect = any(t in texts for t in ["se connecter", "connect"])
    has_message = any(t in texts for t in ["message"])

    if has_message and not has_connect:
        return "connected"
    elif has_message and has_connect:
        return "second_degree"
    return "not_connected"


# ══════════════════════════════════════════════════════════════════════════════
#  TEXTBOX
# ══════════════════════════════════════════════════════════════════════════════

def wait_for_textbox(page, timeout_ms=15000):
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
                        print(f"✅ Textbox : {sel}")
                        return el
            except Exception:
                pass
        page.wait_for_timeout(500)
        deadline -= 500
    return None


def type_and_send(page, message):
    textbox = wait_for_textbox(page)
    if not textbox:
        page.screenshot(path="debug_no_textbox.png", full_page=True)
        print("❌ Zone de saisie introuvable → debug_no_textbox.png")
        return False

    textbox.evaluate("el => el.focus()")
    page.wait_for_timeout(300)
    page.keyboard.press("Control+a")
    page.keyboard.press("Delete")
    page.keyboard.type(message, delay=25)
    print("✅ Message écrit")

    if not SEND:
        print("🧪 Mode test")
        return True

    page.wait_for_timeout(600)

    for sel in [
        "button.msg-form__send-button",
        "button[aria-label='Envoyer']",
        "button[aria-label='Send']",
        "button[aria-label*='nvoyer']",
    ]:
        try:
            loc = page.locator(sel)
            for i in range(loc.count() - 1, -1, -1):
                btn = loc.nth(i)
                if btn.is_visible() and btn.is_enabled():
                    btn.evaluate("el => el.click()")
                    page.wait_for_timeout(2000)
                    try:
                        remaining = (textbox.inner_text(timeout=1500) or "").strip()
                        if not remaining or remaining != message:
                            print("✅ Message envoyé")
                            return True
                    except Exception:
                        print("✅ Message envoyé (zone disparue)")
                        return True
        except Exception:
            pass

    # JS fallback
    sent = page.evaluate("""() => {
        const btns = [...document.querySelectorAll('button')].filter(b => {
            const a = (b.getAttribute('aria-label') || '').toLowerCase();
            const t = (b.innerText || '').toLowerCase().trim();
            const c = b.className.toLowerCase();
            return (a.includes('envoyer') || a.includes('send') ||
                    t === 'envoyer' || t === 'send' ||
                    c.includes('send-button')) && !b.disabled;
        });
        if (btns.length) { btns[btns.length-1].click(); return true; }
        return false;
    }""")
    if sent:
        page.wait_for_timeout(2000)
        print("✅ Message envoyé (JS)")
        return True

    textbox.evaluate("el => el.focus()")
    page.keyboard.press("Control+Enter")
    page.wait_for_timeout(2500)
    print("✅ Message envoyé (Ctrl+Enter)")
    return True


# ══════════════════════════════════════════════════════════════════════════════
#  GET MEMBER ID
# ══════════════════════════════════════════════════════════════════════════════

def get_member_id(page):
    try:
        content = page.content()
        m = re.search(r'"entityUrn":"urn:li:member:(\d+)"', content)
        if m:
            return m.group(1)
        m = re.search(r'urn%3Ali%3Afsd_profile%3A([A-Za-z0-9_-]+)', content)
        if m:
            return m.group(1)
        m = re.search(r'"fsd_profile:([A-Za-z0-9_-]+)"', content)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  CAS 1 : MESSAGE DIRECT (1er degré)
# ══════════════════════════════════════════════════════════════════════════════

def send_direct_message(page):
    print("💬 Message direct (1er degré)...")

    # Stratégie A : URL compose
    member_id = get_member_id(page)
    if member_id:
        url = f"https://www.linkedin.com/messaging/compose/?recipient={member_id}"
        print(f"📨 Compose URL : {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)
        tb = wait_for_textbox(page, timeout_ms=10000)
        if tb:
            return type_and_send(page, DIRECT_MESSAGE)
        page.goto(PROFILE_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

    # Stratégie B : clic bouton Message
    msg_btn = find_topcard_button(page, "Message")
    if msg_btn:
        print("👆 Clic bouton Message...")
        msg_btn.evaluate("el => el.click()")
        page.wait_for_timeout(3000)
        for sel in [".msg-overlay-conversation-bubble", ".msg-form__contenteditable", "[contenteditable='true']"]:
            try:
                page.wait_for_selector(sel, timeout=6000)
                return type_and_send(page, DIRECT_MESSAGE)
            except Exception:
                pass
        if "/messaging/" in page.url:
            return type_and_send(page, DIRECT_MESSAGE)

    print("❌ Impossible d'ouvrir la messagerie directe")
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  CAS 2 : 2ème DEGRÉ — tente message, bascule sur connexion si bloqué
# ══════════════════════════════════════════════════════════════════════════════

def send_second_degree(page):
    print("🔗 Profil 2e degré — tentative message direct d'abord...")

    member_id = get_member_id(page)
    if member_id:
        url = f"https://www.linkedin.com/messaging/compose/?recipient={member_id}"
        print(f"📨 Compose URL : {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)

        current = page.url
        if "premium" in current or "login" in current or "checkpoint" in current:
            print("🚫 LinkedIn bloque (Premium requis) — passage à la demande de connexion")
        else:
            tb = wait_for_textbox(page, timeout_ms=8000)
            if tb:
                print("✅ Message direct possible !")
                return type_and_send(page, DIRECT_MESSAGE)

        print("↩️ Retour au profil...")
        page.goto(PROFILE_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

    print("🔗 Envoi demande de connexion avec note...")
    return send_connection_with_note(page)


# ══════════════════════════════════════════════════════════════════════════════
#  CAS 3 : DEMANDE DE CONNEXION + NOTE
# ══════════════════════════════════════════════════════════════════════════════

def send_connection_with_note(page):
    print("🔗 Recherche bouton Se connecter (top-card)...")

    connect_btn = find_topcard_button(page, "Se connecter", "Connect")

    if not connect_btn:
        # Essai via menu "Plus"
        more_btn = find_topcard_button(page, "Plus", "More")
        if more_btn:
            print("🔍 Clic menu Plus...")
            more_btn.evaluate("el => el.click()")
            page.wait_for_timeout(1500)
            for sel in [
                "div[role='option']:has-text('Se connecter')",
                "li[role='option']:has-text('Se connecter')",
                "span:has-text('Se connecter')",
                # Nouvelle UI : dropdown items
                "[data-view-name='profile-overflow-action']:has-text('Se connecter')",
            ]:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        connect_btn = el
                        print(f"✅ Se connecter dans menu Plus : {sel}")
                        break
                except Exception:
                    pass

            # Fallback JS : cherche dans le dropdown ouvert
            if not connect_btn:
                result = page.evaluate("""() => {
                    const items = [...document.querySelectorAll('[role="option"], [role="menuitem"], li')];
                    const item = items.find(el => (el.innerText || '').toLowerCase().includes('connecter'));
                    if (item) {
                        const rect = item.getBoundingClientRect();
                        return { found: true, top: rect.top, left: rect.left, text: item.innerText.trim() };
                    }
                    return { found: false };
                }""")
                if result and result.get("found"):
                    print(f"✅ Item dropdown trouvé : '{result['text']}'")
                    page.evaluate("""() => {
                        const items = [...document.querySelectorAll('[role="option"], [role="menuitem"], li')];
                        const item = items.find(el => (el.innerText || '').toLowerCase().includes('connecter'));
                        if (item) item.click();
                    }""")
                    page.wait_for_timeout(2000)
                    connect_btn = "clicked_via_js"

    if not connect_btn:
        print("❌ Bouton Se connecter introuvable")
        page.screenshot(path="debug_no_connect.png", full_page=True)
        return False

    if connect_btn != "clicked_via_js":
        aria = connect_btn.get_attribute("aria-label") or ""
        txt  = (connect_btn.inner_text() or "").strip()
        print(f"👆 Clic : '{txt}' [{aria}]")
        connect_btn.scroll_into_view_if_needed()
        connect_btn.evaluate("el => el.click()")
        page.wait_for_timeout(3000)

    page.screenshot(path="debug_after_connect_click.png", full_page=True)

    # Attendre le modal
    modal = None
    for sel in ["[role='dialog']", ".artdeco-modal", ".send-invite", "[data-view-name='invitation-modal']"]:
        try:
            page.wait_for_selector(sel, timeout=4000)
            modal = page.locator(sel).first
            print(f"📋 Modal détecté : {sel}")
            break
        except Exception:
            pass

    if not modal:
        print("⚠️ Pas de modal — la demande a peut-être été envoyée directement")
        # Vérifier si le bouton a changé en "En attente"
        page.wait_for_timeout(1500)
        pending_visible = page.evaluate("""() => {
            return [...document.querySelectorAll('button')].some(b =>
                (b.innerText || '').toLowerCase().includes('attente') ||
                (b.innerText || '').toLowerCase().includes('pending')
            );
        }""")
        if pending_visible:
            print("✅ Demande envoyée (sans modal, bouton devenu 'En attente')")
            return True
        return False

    # Bouton "Ajouter une note"
    note_btn = None
    for text in ["Ajouter une note", "Add a note"]:
        try:
            el = modal.locator(f"button:has-text('{text}')").first
            if el.is_visible(timeout=2000):
                note_btn = el
                break
        except Exception:
            pass

    if note_btn:
        note_btn.click()
        page.wait_for_timeout(1200)
        note_area = None
        for sel in ["textarea[name='message']", "textarea#custom-message", "[role='dialog'] textarea", "textarea"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000):
                    note_area = el
                    break
            except Exception:
                pass
        if note_area:
            note_area.fill(CONNECTION_NOTE[:300])
            print("✍️ Note ajoutée")
    else:
        print("ℹ️ Pas de bouton 'Ajouter une note' (envoi sans note)")

    if not SEND:
        print("🧪 Mode test — non envoyé")
        return True

    page.wait_for_timeout(600)

    # Clic bouton Envoyer dans le modal
    for text in ["Envoyer une invitation", "Send invitation", "Envoyer", "Send"]:
        try:
            btn = modal.locator(f"button:has-text('{text}')").last
            if btn.is_visible(timeout=2000) and btn.is_enabled():
                btn.evaluate("el => el.click()")
                page.wait_for_timeout(3000)
                print("✅ Demande de connexion envoyée")
                return True
        except Exception:
            pass

    # JS fallback dans modal
    sent = page.evaluate("""() => {
        const scope = document.querySelector('[role="dialog"], .artdeco-modal') || document;
        const btns = [...scope.querySelectorAll('button')].filter(b => {
            const t = (b.innerText || '').toLowerCase().trim();
            const a = (b.getAttribute('aria-label') || '').toLowerCase();
            return (t.includes('envoyer') || t.includes('send') ||
                    a.includes('envoyer') || a.includes('send')) && !b.disabled;
        });
        if (btns.length) { btns[btns.length-1].click(); return true; }
        return false;
    }""")
    if sent:
        page.wait_for_timeout(3000)
        print("✅ Demande envoyée (JS fallback)")
        return True

    print("❌ Bouton Envoyer du modal introuvable")
    page.screenshot(path="debug_modal_send_failed.png", full_page=True)
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=150)

        if STORAGE_FILE.exists():
            context = browser.new_context(storage_state=str(STORAGE_FILE))
            print("♻️ Session chargée")
        else:
            context = browser.new_context()
            print("🆕 Nouvelle session")

        page = context.new_page()

        page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        if "login" in page.url or "checkpoint" in page.url:
            print("🔐 Connexion requise")
            page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
            input("👉 Connecte-toi manuellement puis ENTER...")
            context.storage_state(path=str(STORAGE_FILE))
            print("💾 Session sauvegardée")

        close_overlays(page)
        print(f"\n👤 Profil : {PROFILE_URL}")
        page.goto(PROFILE_URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(5000)
        close_overlays(page)

        status = get_status(page)
        print(f"📊 Statut : {status}")

        if status == "connected":
            print("📌 ACTION : MESSAGE DIRECT")
            ok = send_direct_message(page)
            result = "message_sent" if ok else "message_failed"

        elif status == "second_degree":
            print("📌 ACTION : 2e DEGRÉ")
            ok = send_second_degree(page)
            result = "success" if ok else "failed"

        elif status == "pending":
            print("📌 ACTION : DÉJÀ EN ATTENTE — rien à faire")
            result = "already_pending"

        else:
            print("📌 ACTION : DEMANDE DE CONNEXION + NOTE")
            ok = send_connection_with_note(page)
            result = "connection_request_sent" if ok else "connection_request_failed"

        context.storage_state(path=str(STORAGE_FILE))
        browser.close()

        print(f"\n{'═'*45}")
        print(f"  📊 Résultat : {result}")
        print(f"{'═'*45}")
        return result


if __name__ == "__main__":
    main()