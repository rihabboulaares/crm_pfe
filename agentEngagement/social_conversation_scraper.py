import logging
import re

from .social.base_sender import launch_context
from .social.session_manager import (
    close_popups,
    ensure_platform_session,
    login_required_by_selectors,
)

from .social.facebook_sender import (
    click_message_button as fb_click_message_button,
    handle_non_friend_popup,
    wait_for_message_input as fb_wait_for_message_input,
)

from .social.instagram_sender import (
    click_message_button as ig_click_message_button,
    handle_contacter_modal,
    handle_message_request_popup,
    wait_for_message_input as ig_wait_for_message_input,
)

from .social.linkedin_sender import LinkedInSender

logger = logging.getLogger("agentEngagement.social_conversation_scraper")

SUPPORTED_CHANNELS = {"facebook", "instagram", "linkedin"}


def clean_text(value) -> str:
    text = str(value or "").strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def normalize_key(text: str) -> str:
    return re.sub(r"\s+", " ", clean_text(text).lower()).strip()


def make_result(success, message="", messages=None, requires_login=False, status=None, platform=None):
    data = {
        "success": success,
        "message": message,
        "messages": messages or [],
        "requires_login": requires_login,
    }
    if status:
        data["status"] = status
    if platform:
        data["platform"] = platform
    return data


def login_required(channel):
    return make_result(
        False,
        f"Connexion {channel} requise pour lire la conversation privée.",
        [],
        True,
        "login_required",
        channel,
    )


def is_noise(text: str) -> bool:
    lower = normalize_key(text)

    if not lower:
        return True

    if re.search(r"message sent .* by you", lower):
        return True

    if re.search(r"enter, message sent", lower):
        return True

    if ".tn" in lower or ".com" in lower:
        return True

    noise_exact = {
        "facebook", "instagram", "linkedin",
        "message", "messages", "message...",
        "plus", "tout", "ami(e)s", "amis",
        "photos", "reels", "publications",
        "à propos", "a propos",
        "informations personnelles", "formation",
        "confidentialité", "conditions générales",
        "publicités", "choix publicitaires", "cookies",
        "filtres", "commenter", "partager",
        "j’aime", "j'aime",
        "reply", "répondre", "repondre",
        "envoyer", "send", "aa",
        "active now", "actif maintenant",
        "seen", "vu",
        "ouvrir le clavier des émoticônes",
        "ouvrir les options d’envoi",
        "open emoji keyboard",
        "open send options",
        "joindre une image",
        "attach an image",
        "joindre un fichier",
        "attach a file",
        "envoyer un message...",
        "send message...",
        "write a message...",
    }

    if lower in noise_exact:
        return True

    noise_fragments = [
        "a publié sur",
        "commenter en tant que",
        "écrivez quelque chose",
        "photo/vidéo",
        "identifier des personnes",
        "humeur/activité",
        "voir plus de formations",
        "nombre de notifications",
        "conditions générales",
        "choix publicitaires",
        "amis ont publié",
        "a modifié sa photo",
        "followers",
        "abonnés",
        "publications",
        "posts",
        "reels",
        "il manque des messages",
        "restaurer maintenant",
        "see previous messages",
        "voir les messages précédents",
        "écrire un message",
        "write a message",
        "appuyez sur entrée",
        "press enter",
        "seen ",
        "vu ",
        "actif il y a",
        "active ",
        "message sent",
        "sent by you",
        "by you",
        "enter, message sent",
    ]

    return any(fragment in lower for fragment in noise_fragments)


def append_message(messages, seen, sender, text):
    text = clean_text(text)

    if len(text) < 2 or len(text) > 1500:
        return

    if is_noise(text):
        return

    key = (sender, normalize_key(text))

    if key in seen:
        return

    seen.add(key)
    messages.append(
        {
            "sender": sender,
            "text": text,
            "created_at": None,
        }
    )


def last_useful_messages(messages, limit=20):
    return [m for m in messages if m.get("text")][-limit:]


def add_last_sent_if_missing(messages, last_sent_message):
    if not last_sent_message:
        return messages[-20:]

    has_me = any(m.get("sender") == "me" for m in messages)

    if not has_me:
        messages.insert(
            0,
            {
                "sender": "me",
                "text": last_sent_message,
                "created_at": None,
            },
        )

    return messages[-20:]


# ============================================================
# FACEBOOK
# ============================================================

def extract_facebook_messages_from_input(input_box, last_sent_message=""):
    messages = []
    seen = set()

    try:
        handle = input_box.element_handle()

        items = handle.evaluate(
            """
            (input) => {
                function isVisible(el) {
                    const r = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
                }

                let root = input.closest("div[role='dialog']")
                    || input.closest("[aria-label*='Messenger']")
                    || input.closest("[aria-label*='Conversation']");

                if (!root) {
                    root = input;
                    for (let i = 0; i < 12; i++) {
                        if (root.parentElement) root = root.parentElement;
                    }
                }

                const nodes = Array.from(root.querySelectorAll(
                    "[data-testid='mw_message_row'], div[role='row'], div[dir='auto'], span[dir='auto']"
                ));

                return nodes
                    .filter(isVisible)
                    .map(el => ({
                        text: (el.innerText || el.textContent || "").trim(),
                        aria: el.getAttribute("aria-label") || "",
                        cls: el.className || ""
                    }))
                    .filter(x => x.text);
            }
            """
        )

    except Exception as exc:
        logger.warning("[FB EXTRACT] extraction impossible: %s", exc)
        return []

    last_sent_norm = normalize_key(last_sent_message or "")

    for item in items:
        text = clean_text(item.get("text"))
        meta = f"{item.get('aria') or ''} {item.get('cls') or ''}".lower()

        if not text:
            continue

        sender = "prospect"

        if last_sent_norm and last_sent_norm in normalize_key(text):
            sender = "me"
        elif any(token in meta for token in [
            "you sent",
            "vous avez envoyé",
            "vous avez envoye",
            "outgoing",
            "message sortant",
        ]):
            sender = "me"

        for line in text.splitlines():
            append_message(messages, seen, sender, line)

    return messages[-20:]


def open_facebook_conversation(page, prospect):
    profile_url = getattr(prospect, "facebook_url", "")
    last_sent_message = getattr(prospect, "last_message_sent", "") or ""

    page.goto(profile_url, wait_until="domcontentloaded", timeout=70000)

    if login_required_by_selectors(page, "facebook"):
        return login_required("facebook")

    page.wait_for_timeout(8000)
    close_popups(page, "facebook")

    msg_btn = fb_click_message_button(page)

    if not msg_btn:
        logger.warning("[FB CHECK] Bouton Message introuvable.")
        return make_result(True, "Bouton Message Facebook introuvable.", [])

    msg_btn.click()
    page.wait_for_timeout(4000)
    close_popups(page, "facebook")

    handle_non_friend_popup(page)

    page.wait_for_timeout(4000)
    close_popups(page, "facebook")

    input_box = fb_wait_for_message_input(page, timeout_ms=15000)

    if not input_box:
        logger.warning("[FB CHECK] Conversation non ouverte. url=%s", page.url)
        return make_result(True, "Conversation Facebook non ouverte.", [])

    messages = extract_facebook_messages_from_input(input_box, last_sent_message)
    messages = add_last_sent_if_missing(messages, last_sent_message)

    logger.warning(
        "[CONVERSATION SCRAPER] channel=%s prospect=%s url=%s messages=%s",
        "facebook",
        getattr(prospect, "pk", None),
        page.url,
        messages[:10],
    )

    return make_result(True, "" if messages else "Aucune conversation privee trouvee.", messages)


# ============================================================
# INSTAGRAM
# ============================================================

def extract_instagram_messages_from_input(input_box, last_sent_message=""):
    messages = []
    seen = set()

    try:
        handle = input_box.element_handle()

        items = handle.evaluate(
            """
            (input) => {
                function isVisible(el) {
                    const r = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
                }

                let root = input.closest("section")
                    || input.closest("main")
                    || input.closest("div[role='dialog']");

                if (!root) {
                    root = input;
                    for (let i = 0; i < 12; i++) {
                        if (root.parentElement) root = root.parentElement;
                    }
                }

                const nodes = Array.from(root.querySelectorAll(
                    "div[role='row'], div[dir='auto'], span[dir='auto'], div[aria-label]"
                ));

                return nodes
                    .filter(isVisible)
                    .map(el => ({
                        text: (el.innerText || el.textContent || "").trim(),
                        aria: el.getAttribute("aria-label") || "",
                        cls: el.className || ""
                    }))
                    .filter(x => x.text);
            }
            """
        )

    except Exception as exc:
        logger.warning("[IG EXTRACT] extraction impossible: %s", exc)
        return []

    last_sent_norm = normalize_key(last_sent_message or "")

    for item in items:
        text = clean_text(item.get("text"))
        meta = f"{item.get('aria') or ''} {item.get('cls') or ''}".lower()

        if not text:
            continue

        sender = "prospect"

        if last_sent_norm and last_sent_norm in normalize_key(text):
            sender = "me"
        elif any(token in meta for token in [
            "you sent",
            "sent by you",
            "vous avez envoyé",
            "envoyé par vous",
            "vous avez envoye",
            "envoye par vous",
        ]):
            sender = "me"

        for line in text.splitlines():
            append_message(messages, seen, sender, line)

    return messages[-20:]


def open_instagram_conversation(page, prospect):
    profile_url = getattr(prospect, "instagram_url", "")
    last_sent_message = getattr(prospect, "last_message_sent", "") or ""

    page.goto(profile_url, wait_until="domcontentloaded", timeout=70000)

    if login_required_by_selectors(page, "instagram"):
        return login_required("instagram")

    page.wait_for_timeout(8000)
    close_popups(page, "instagram")

    msg_btn = ig_click_message_button(page)

    if not msg_btn:
        logger.warning("[IG CHECK] Bouton Message introuvable.")
        return make_result(True, "Bouton Message Instagram introuvable.", [])

    msg_btn.click()
    page.wait_for_timeout(2500)

    if handle_contacter_modal(page):
        page.wait_for_timeout(2500)

    try:
        handle_message_request_popup(page)
        page.wait_for_url("**/direct/t/**", timeout=6000)
    except Exception:
        pass

    page.wait_for_timeout(2500)
    close_popups(page, "instagram")

    input_box = ig_wait_for_message_input(page, timeout_ms=15000)

    if not input_box:
        logger.warning("[IG CHECK] Conversation non ouverte. url=%s", page.url)
        return make_result(True, "Conversation Instagram non ouverte.", [])

    messages = extract_instagram_messages_from_input(input_box, last_sent_message)
    messages = add_last_sent_if_missing(messages, last_sent_message)

    logger.warning(
        "[CONVERSATION SCRAPER] channel=%s prospect=%s url=%s messages=%s",
        "instagram",
        getattr(prospect, "pk", None),
        page.url,
        messages[:10],
    )

    return make_result(True, "" if messages else "Aucune conversation privee trouvee.", messages)


# ============================================================
# LINKEDIN
# ============================================================

def extract_linkedin_messages_from_textbox(textbox, last_sent_message=""):
    messages = []
    seen = set()

    try:
        handle = textbox.element_handle()

        items = handle.evaluate(
            """
            (input) => {
                function isVisible(el) {
                    const r = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
                }

                let root = input.closest(".msg-overlay-conversation-bubble")
                    || document.querySelector(".msg-overlay-conversation-bubble")
                    || document.querySelector(".msg-convo-wrapper")
                    || document;

                const events = Array.from(root.querySelectorAll(
                    ".msg-s-message-list__event, li.msg-s-message-list__event, .msg-s-event-listitem"
                ));

                return events
                    .filter(isVisible)
                    .map(event => {
                        const cls = event.className || "";
                        const body =
                            event.querySelector(".msg-s-event-listitem__body")
                            || event.querySelector(".msg-s-event-listitem__body p")
                            || event.querySelector(".msg-s-message-group__message")
                            || event.querySelector("p");

                        const text = body
                            ? (body.innerText || body.textContent || "").trim()
                            : (event.innerText || event.textContent || "").trim();

                        return { text, cls };
                    })
                    .filter(x => x.text);
            }
            """
        )

    except Exception as exc:
        logger.warning("[LINKEDIN EXTRACT] extraction impossible: %s", exc)
        return []

    last_sent_norm = normalize_key(last_sent_message or "")

    for item in items:
        text = clean_text(item.get("text"))
        cls = item.get("cls") or ""

        if not text or is_noise(text):
            continue

        sender = "prospect"

        if "msg-s-message-list__event--own" in cls:
            sender = "me"
        elif last_sent_norm and last_sent_norm in normalize_key(text):
            sender = "me"

        append_message(messages, seen, sender, text)

    return messages[-20:]


def open_linkedin_conversation(page, prospect, user_id):
    profile_url = getattr(prospect, "linkedin_url", "")
    last_sent_message = getattr(prospect, "last_message_sent", "") or ""

    sender = LinkedInSender(user_id=user_id, headless=True)

    page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(5000)

    if login_required_by_selectors(page, "linkedin"):
        return login_required("linkedin")

    page.goto(profile_url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(7000)

    sender.close_overlays(page)

    status = sender.detect_status_from_profile(page)

    if status != "connected":
        return make_result(True, f"Conversation LinkedIn non disponible. Statut : {status}.", [])

    clicked = sender.click_profile_action(page, ["message", "envoyer un message", "send message"])

    if not clicked:
        more_clicked = sender.click_profile_action(page, ["plus", "more"])

        if more_clicked:
            page.wait_for_timeout(1500)
            clicked = sender.click_anywhere_by_text(page, ["Message", "Envoyer un message", "Send message"])

    if not clicked:
        return make_result(True, "Bouton Message LinkedIn introuvable.", [])

    page.wait_for_timeout(5000)

    textbox = sender.wait_textbox(page, timeout_ms=15000)

    if not textbox:
        logger.warning("[LINKEDIN CHECK] Conversation non ouverte. url=%s", page.url)
        return make_result(True, "Conversation LinkedIn non ouverte.", [])

    messages = extract_linkedin_messages_from_textbox(textbox, last_sent_message)
    messages = add_last_sent_if_missing(messages, last_sent_message)

    logger.warning(
        "[CONVERSATION SCRAPER] channel=%s prospect=%s url=%s messages=%s",
        "linkedin",
        getattr(prospect, "pk", None),
        page.url,
        messages[:10],
    )

    return make_result(True, "" if messages else "Aucune conversation privee trouvee.", messages)


# ============================================================
# ENTRY POINT
# ============================================================

def scrape_social_conversation(prospect, channel, user_id=None):
    channel = (channel or "").strip().lower()

    if channel not in SUPPORTED_CHANNELS:
        return make_result(False, "Canal non supporté.", [], status="unsupported_channel", platform=channel)

    profile_url = {
        "facebook": getattr(prospect, "facebook_url", ""),
        "instagram": getattr(prospect, "instagram_url", ""),
        "linkedin": getattr(prospect, "linkedin_url", ""),
    }.get(channel)

    if not profile_url:
        return make_result(False, f"Aucun profil {channel} trouvé.", [], status="missing_profile_url", platform=channel)

    user_id = user_id or getattr(prospect, "assigned_to_id", None)

    if not user_id:
        return make_result(False, "Utilisateur introuvable pour accéder à la session sociale.", [], status="missing_user")

    session_result = ensure_platform_session(user_id=user_id, platform=channel)

    logger.warning(
        "[CONVERSATION SESSION] channel=%s user_id=%s session_result=%s",
        channel,
        user_id,
        session_result,
    )

    if not session_result.get("success"):
        return login_required(channel)

    playwright = None
    context = None

    try:
        playwright, context, page = launch_context(
            channel,
            user_id,
            viewport={"width": 1400, "height": 900},
        )

        if channel == "facebook":
            return open_facebook_conversation(page, prospect)

        if channel == "instagram":
            return open_instagram_conversation(page, prospect)

        if channel == "linkedin":
            return open_linkedin_conversation(page, prospect, user_id)

    except Exception as exc:
        logger.exception(
            "[conversation-scraper] Erreur scraping %s prospect=%s",
            channel,
            getattr(prospect, "pk", None),
        )

        return make_result(
            False,
            f"Erreur scraping conversation: {str(exc)[:400]}",
            [],
            status="conversation_scrape_error",
            platform=channel,
        )

    finally:
        try:
            if context:
                context.close()
        except Exception:
            pass

        try:
            if playwright:
                playwright.stop()
        except Exception:
            pass

    return make_result(False, "Canal non supporté.", [], status="unsupported_channel", platform=channel)
