from pathlib import Path
from playwright.sync_api import sync_playwright
import time
import random

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
PROFILE_URL  = "https://www.facebook.com/emna.mnasri.37?locale=fr_FR"  # ← changer ici
MESSAGE      = "Bonjour, j'espère que vous allez bien !"
SEND         = True
# ─────────────────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).resolve().parent
SESSION_DIR  = BASE_DIR / "sessions"
SESSION_DIR.mkdir(exist_ok=True)
STORAGE_FILE = SESSION_DIR / "facebook_session.json"


def human_delay(min_ms=800, max_ms=2000):
    time.sleep(random.uniform(min_ms / 1000, max_ms / 1000))


def close_popups(page):
    """Ferme les popups classiques Facebook (cookies, notifications…)"""
    for sel in [
        # Cookies
        "button:has-text('Autoriser les cookies essentiels et optionnels')",
        "button:has-text('Allow all cookies')",
        "button:has-text('Tout accepter')",
        "button:has-text('Accept all')",
        "[data-cookiebanner='accept_button']",
        # Notifications
        "div[aria-label='Fermer'][role='button']",
        "div[aria-label='Close'][role='button']",
        "button:has-text('Pas maintenant')",
        "button:has-text('Not Now')",
    ]:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1200):
                btn.click()
                page.wait_for_timeout(600)
        except Exception:
            pass


def click_message_button(page):
    """
    Cherche et clique le bouton 'Envoyer un message' / 'Message' sur le profil.
    Facebook affiche ce bouton différemment selon que la personne est amie ou non.
    """
    selectors = [
        # Bouton principal profil — ami
        "div[aria-label='Envoyer un message'][role='button']",
        "div[aria-label='Message'][role='button']",
        "a[aria-label='Envoyer un message']",
        # Texte visible
        "div[role='button']:has-text('Envoyer un message')",
        "span:has-text('Envoyer un message')",
        "div[role='button']:has-text('Message')",
        # EN
        "div[aria-label='Send message'][role='button']",
        "div[role='button']:has-text('Send message')",
    ]
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                print(f"✅ Bouton Message trouvé : {sel}")
                return el
        except Exception:
            pass
    return None


def handle_non_friend_popup(page):
    """
    Quand la cible n'est pas amie, Facebook peut afficher :
      - Un dialog de confirmation ("Envoyer quand même", "Envoyer en tant que demande")
      - Un bouton supplémentaire à cliquer avant d'accéder à la saisie
    Retourne True si une popup a été détectée et gérée.
    """
    confirmation_selectors = [
        "div[role='dialog'] div[role='button']:has-text('Envoyer quand même')",
        "div[role='dialog'] div[role='button']:has-text('Send anyway')",
        "div[role='dialog'] div[role='button']:has-text('Envoyer en tant que demande')",
        "div[role='dialog'] div[role='button']:has-text('Send as request')",
        # Fallback : bouton primaire dans un dialog
        "div[role='dialog'] div[role='button']:has-text('Envoyer')",
        "div[role='dialog'] button:has-text('Envoyer')",
    ]
    for sel in confirmation_selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=3000):
                print(f"⚠️  Popup non-ami détectée → clic : {sel}")
                el.click()
                human_delay(1500, 2500)
                return True
        except Exception:
            pass
    return False


def wait_for_message_input(page, timeout_ms=15000):
    """
    Attend la zone de saisie du message.
    Facebook Messenger intégré au profil utilise un div contenteditable.
    """
    selectors = [
        # Messenger intégré dans la page profil
        "div[aria-label='Message'][role='textbox']",
        "div[aria-label='Écrivez un message…'][role='textbox']",
        "div[aria-label='Write a message…'][role='textbox']",
        "div[aria-label*='essage'][role='textbox']",
        # Dialog overlay
        "div[role='dialog'] div[role='textbox']",
        "div[role='dialog'] [contenteditable='true']",
        # Messenger standalone (si redirect vers messenger.com)
        "div[aria-label='Aa'][role='textbox']",
        "[contenteditable='true'][role='textbox']",
        # Textarea fallback
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
                        print(f"✅ Zone saisie trouvée : {sel}")
                        return el
            except Exception:
                pass
        page.wait_for_timeout(500)
        deadline -= 500
    return None


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
                viewport={"width": 1280, "height": 900},
            )
            print("♻️ Session chargée")
        else:
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 900},
            )
            print("🆕 Nouvelle session")

        page = context.new_page()

        # ── Login check ──────────────────────────────────────────────────────
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
        human_delay(3000, 4000)
        close_popups(page)

        if "login" in page.url or page.locator("input[name='email']").count() > 0:
            print("🔐 Connexion requise")
            page.goto("https://www.facebook.com/login/", wait_until="domcontentloaded")
            input("👉 Connecte-toi manuellement puis ENTER...")
            context.storage_state(path=str(STORAGE_FILE))
            human_delay(2000, 3000)
            close_popups(page)

        # ── Étape 1 : aller sur le profil ────────────────────────────────────
        print(f"\n🔗 Navigation : {PROFILE_URL}")
        page.goto(PROFILE_URL, wait_until="domcontentloaded")
        human_delay(3000, 4000)
        close_popups(page)

        # Vérifier profil introuvable
        if page.locator("div:has-text('Ce contenu n\\'est pas disponible')").count() > 0 \
        or page.locator("div:has-text('This content isn\\'t available')").count() > 0:
            print("❌ Profil introuvable ou privé")
            browser.close()
            return "not_found"

        # ── Étape 2 : cliquer sur le bouton Message ──────────────────────────
        print("🔍 Recherche bouton Message sur le profil...")
        msg_btn = click_message_button(page)

        if not msg_btn:
            print("❌ Bouton Message introuvable — screenshot → debug_fb_no_btn.png")
            page.screenshot(path="debug_fb_no_btn.png")
            browser.close()
            return "no_message_button"

        msg_btn.click()
        print("👆 Bouton Message cliqué")
        human_delay(2000, 3000)
        close_popups(page)

        # ── Étape 2b : popup non-ami (si applicable) ─────────────────────────
        non_friend_handled = handle_non_friend_popup(page)
        if non_friend_handled:
            print("✅ Popup non-ami confirmée")
            human_delay(1500, 2500)

        # ── Étape 3 : attendre redirect Messenger OU overlay ─────────────────
        print("⏳ Attente ouverture de la conversation...")
        try:
            # Facebook peut rediriger vers messenger.com ou ouvrir un chat intégré
            page.wait_for_url(
                lambda url: "messenger.com" in url or "/messages/t/" in url,
                timeout=7000
            )
            print(f"✅ Conversation ouverte (redirect) : {page.url}")
        except Exception:
            print(f"  ℹ️ Pas de redirect — recherche overlay (URL : {page.url})")

        human_delay(1500, 2500)
        close_popups(page)

        # ── Étape 4 : écrire le message ──────────────────────────────────────
        print("✍️ Recherche zone de saisie...")
        input_box = wait_for_message_input(page, timeout_ms=15000)

        if not input_box:
            page.screenshot(path="debug_fb_no_input.png")
            print("❌ Zone de saisie introuvable → debug_fb_no_input.png")
            browser.close()
            return "message_failed"

        input_box.click()
        human_delay(400, 700)
        page.keyboard.type(MESSAGE, delay=40)
        print(f"✅ Message écrit : '{MESSAGE}'")
        human_delay(600, 1200)

        if not SEND:
            print("🧪 Mode test — non envoyé")
            browser.close()
            return "test_mode"

        # ── Étape 5 : envoyer ────────────────────────────────────────────────
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