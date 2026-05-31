from pathlib import Path
from playwright.sync_api import sync_playwright
import time
import random

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
PROFILE_URL  = "https://www.instagram.com/follaarfaoui/"
MESSAGE      = "Bonjour, j'espère que vous allez bien !"
SEND         = True
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).resolve().parent
SESSION_DIR  = BASE_DIR / "sessions"
SESSION_DIR.mkdir(exist_ok=True)
STORAGE_FILE = SESSION_DIR / "instagram_session.json"


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def close_popups(page):
    for sel in [
        "button:has-text('Pas maintenant')",
        "button:has-text('Not Now')",
        "button:has-text('Tout autoriser')",
        "button:has-text('Allow all cookies')",
        "button:has-text('Accepter')",
    ]:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1500):
                btn.click()
                page.wait_for_timeout(600)
        except Exception:
            pass


# ─── NOUVEAU : confirmer la demande de message (non-follower) ────────────────
def handle_message_request_popup(page):
    """
    Quand la personne ne nous suit pas, Instagram affiche une popup
    "Envoyer une demande de message ?" avec un bouton de confirmation.
    On détecte et on clique ce bouton.
    Retourne True si la popup a été trouvée et confirmée.
    """
    confirmation_selectors = [
        # Bouton principal de confirmation dans un dialog
        "div[role='dialog'] button:has-text('Envoyer une demande')",
        "div[role='dialog'] div[role='button']:has-text('Envoyer une demande')",
        "div[role='dialog'] button:has-text('Send message request')",
        # Parfois le texte est raccourci
        "div[role='dialog'] button:has-text('Envoyer la demande')",
        # Fallback : tout bouton primaire dans un dialog qui contient "Envoyer"
        "div[role='dialog'] button:has-text('Envoyer')",
    ]
    for sel in confirmation_selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                print(f"⚠️  Popup demande de message détectée → clic sur : {sel}")
                el.click()
                human_delay(1500, 2500)
                return True
        except Exception:
            pass
    return False


def wait_for_message_input(page, timeout_ms=15000):
    """
    Attend la zone de saisie DM.
    Fonctionne pour :
      - Redirection vers /direct/t/...
      - Overlay/modal ouvert en place
      - Thread après confirmation de demande de message
    """
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
                        print(f"✅ Zone saisie trouvée : {sel}")
                        return el
            except Exception:
                pass
        page.wait_for_timeout(500)
        deadline -= 500
    return None


def click_message_button(page):
    """Clique sur le bouton Message / Contacter du profil (FR + EN)."""
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
                print(f"✅ Bouton trouvé : {sel}")
                return el
        except Exception:
            pass
    return None


def handle_contacter_modal(page):
    """
    Après 'Contacter', Instagram peut afficher un dialog avec plusieurs options
    (email, DM…). On clique 'Envoyer un message'.
    """
    for sel in [
        "div[role='dialog'] div[role='button']:has-text('Envoyer un message')",
        "div[role='dialog'] button:has-text('Envoyer un message')",
        "div[role='dialog'] div[role='button']:has-text('Message')",
        "a:has-text('Envoyer un message')",
    ]:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                print(f"✅ Option DM dans le modal Contacter : {sel}")
                el.click()
                return True
        except Exception:
            pass
    return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            slow_mo=80,
            args=["--disable-blink-features=AutomationControlled"],
        )

        if STORAGE_FILE.exists():
            context = browser.new_context(
                storage_state=str(STORAGE_FILE),
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
            )
            print("♻️ Session chargée")
        else:
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
            )
            print("🆕 Nouvelle session")

        page = context.new_page()

        # ── Login check ──────────────────────────────────────────────────────
        page.goto("https://www.instagram.com/", wait_until="domcontentloaded")
        human_delay(3000, 4000)
        close_popups(page)

        if "login" in page.url or page.locator("input[name='username']").count() > 0:
            print("🔐 Connexion requise")
            page.goto("https://www.instagram.com/accounts/login/", wait_until="domcontentloaded")
            input("👉 Connecte-toi manuellement puis ENTER...")
            context.storage_state(path=str(STORAGE_FILE))
            human_delay(2000, 3000)
            close_popups(page)

        # ── Étape 1 : aller sur le profil ────────────────────────────────────
        print(f"\n🔗 Navigation : {PROFILE_URL}")
        page.goto(PROFILE_URL, wait_until="domcontentloaded")
        human_delay(3000, 4000)
        close_popups(page)

        if page.locator("h2:has-text('introuvable'), h2:has-text('Not Found')").count() > 0:
            print("❌ Profil introuvable")
            browser.close()
            return "not_found"

        # ── Étape 2 : cliquer sur Message / Contacter ────────────────────────
        print("🔍 Recherche bouton Message/Contacter sur le profil...")
        msg_btn = click_message_button(page)

        if not msg_btn:
            print("❌ Bouton Message/Contacter introuvable sur le profil")
            page.screenshot(path="debug_ig_no_btn.png")
            browser.close()
            return "no_message_button"

        msg_btn.click()
        print("👆 Bouton cliqué")
        human_delay(1500, 2500)

        # ── Étape 2b : modal "Contacter" (multi-options) ─────────────────────
        modal_handled = handle_contacter_modal(page)
        if modal_handled:
            print("✅ Option DM sélectionnée dans le modal Contacter")
            human_delay(1500, 2500)

        # ── Étape 2c : popup "Envoyer une demande de message" ────────────────
        # Cas où la cible ne nous suit pas → Instagram demande confirmation
        request_confirmed = handle_message_request_popup(page)
        if request_confirmed:
            print("✅ Demande de message confirmée (non-follower)")
            # Attendre éventuelle redirection après confirmation
            try:
                page.wait_for_url("**/direct/t/**", timeout=6000)
                print(f"✅ Thread ouvert (redirect) : {page.url}")
            except Exception:
                print(f"  ℹ️ Pas de redirect après confirmation (URL : {page.url})")
            human_delay(1000, 2000)

        # ── Étape 3 : attendre la redirection OU l'overlay DM ───────────────
        if not request_confirmed:
            print("⏳ Attente ouverture du thread (URL ou overlay)...")
            try:
                page.wait_for_url("**/direct/t/**", timeout=6000)
                print(f"✅ Thread ouvert (redirect) : {page.url}")
            except Exception:
                print(f"  ℹ️ Pas de redirection URL — recherche overlay (URL : {page.url})")
            human_delay(1000, 2000)

        close_popups(page)

        # ── Étape 4 : écrire le message ──────────────────────────────────────
        print("✍️ Recherche zone de saisie...")
        input_box = wait_for_message_input(page, timeout_ms=15000)

        if not input_box:
            page.screenshot(path="debug_ig_no_input.png")
            print("❌ Zone de saisie introuvable → debug_ig_no_input.png")
            browser.close()
            return "message_failed"

        input_box.click()
        human_delay(400, 700)
        page.keyboard.type(MESSAGE, delay=35)
        print(f"✅ Message écrit : '{MESSAGE}'")
        human_delay(600, 1200)

        if not SEND:
            print("🧪 Mode test — non envoyé")
            browser.close()
            return "test_mode"

        # ── Étape 5 : envoyer ────────────────────────────────────────────────
        sent = False
        for sel in [
            "button:has-text('Envoyer')",
            "button:has-text('Send')",
            "[aria-label='Envoyer']",
            "[aria-label='Send']",
            "div[role='dialog'] button:has-text('Envoyer')",
        ]:
            try:
                btn = page.locator(sel).last
                if btn.is_visible(timeout=2000) and btn.is_enabled():
                    btn.click()
                    sent = True
                    print(f"✅ Envoyé via bouton : {sel}")
                    break
            except Exception:
                pass

        if not sent:
            input_box.press("Enter")
            print("✅ Envoyé via Enter")

        human_delay(2000, 3000)
        print("✅ Message envoyé !")

        context.storage_state(path=str(STORAGE_FILE))
        browser.close()

        print(f"\n{'═'*45}")
        print(f"  📊 Résultat : message_sent")
        print(f"{'═'*45}\n")
        return "message_sent"


if __name__ == "__main__":
    main()