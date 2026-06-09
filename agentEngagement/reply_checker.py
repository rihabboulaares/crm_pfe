import json
import logging
import re

from .conversation_utils import detect_reply_from_conversation
from .gemini_client import extract_json, generate_with_retry, get_gemini_model
from .social_conversation_scraper import scrape_social_conversation

logger = logging.getLogger("agentEngagement.reply_checker")

SOCIAL_CHANNELS = {"linkedin", "facebook", "instagram"}

CHECKABLE_STATUSES = {
    "message_sent",
    "waiting_reply",
    "replied",
    "reply_detected",
    "follow_up_required",
    "followup_generated",
    "opportunity_ready",
}

CONVERSATION_REPLY_SCHEMA = """
{
  "has_reply": true,
  "reply_summary": "Resume court",
  "sentiment": "interested | neutral | not_interested | question | objection | no_reply",
  "recommended_action": "reply | follow_up | call | create_opportunity | no_action",
  "generated_reply": "Message propose"
}
""".strip()


def safe_text(value) -> str:
    return str(value or "").strip()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", safe_text(value).lower()).strip()


def prospect_name(prospect) -> str:
    direct_name = getattr(prospect, "name", None) or getattr(prospect, "full_name", None)

    if direct_name:
        return safe_text(direct_name)

    return safe_text(
        f"{getattr(prospect, 'first_name', '')} {getattr(prospect, 'last_name', '')}"
    )


def last_sent_message(prospect) -> str:
    return safe_text(
        getattr(prospect, "last_message_sent", None)
        or getattr(prospect, "generated_message", None)
    )


def has_existing_opportunity(prospect) -> bool:
    try:
        return prospect.opportunities.exists()
    except Exception:
        return False


def is_system_or_noise_message(text: str) -> bool:
    lower = normalize_text(text)

    if not lower:
        return True

    if re.search(r"message sent .* by you", lower):
        return True

    if re.search(r"enter, message sent", lower):
        return True

    exact_noise = {
        "facebook",
        "instagram",
        "linkedin",
        "message",
        "messages",
        "message...",
        "aa",
        "envoyer",
        "send",
        "reply",
        "répondre",
        "repondre",
        "seen",
        "vu",
    }

    if lower in exact_noise:
        return True

    noise_fragments = [
        "il manque des messages",
        "restaurer maintenant",
        "message non envoyé",
        "couldn't send",
        "message unavailable",
        "ce message n’est pas disponible",
        "voir les messages précédents",
        "see previous messages",
        "vous avez envoyé une pièce jointe",
        "a envoyé une pièce jointe",
        "liked a message",
        "a aimé un message",
        "a réagi à votre message",
        "actif il y a",
        "en ligne il y a",
        "message sent",
        "sent by you",
        "enter, message sent",
        "seen ",
        "vu ",
    ]

    return any(fragment in lower for fragment in noise_fragments)


def normalize_conversation_messages(messages, prospect):
    cleaned = []

    for msg in messages or []:
        sender = safe_text(msg.get("sender")).lower()
        text = safe_text(msg.get("text"))

        if sender not in {"me", "prospect"}:
            continue

        if not text:
            continue

        if is_system_or_noise_message(text):
            continue

        cleaned.append(
            {
                "sender": sender,
                "text": text,
                "created_at": msg.get("created_at"),
            }
        )

    last_sent = last_sent_message(prospect)
    has_me = any(item["sender"] == "me" for item in cleaned)

    if last_sent and not has_me:
        cleaned.insert(
            0,
            {
                "sender": "me",
                "text": last_sent,
                "created_at": getattr(prospect, "last_message_sent_at", None),
            },
        )

    return cleaned[-6:]


def fallback_followup(prospect, channel: str) -> str:
    name = safe_text(getattr(prospect, "first_name", "")) or "Bonjour"

    return (
        f"Bonjour {name}, je me permets de revenir vers vous. "
        "Avez-vous eu le temps de regarder mon dernier message ?"
    )


def fallback_reply(reply_text: str) -> str:
    if not reply_text:
        return ""

    lower = normalize_text(reply_text)

    if "disponible" in lower or "oui" in lower or "intéress" in lower:
        return (
            "Merci pour votre retour. Parfait, quel créneau vous conviendrait "
            "pour échanger rapidement ?"
        )

    if "savoir plus" in lower or "plus" in lower:
        return (
            "Merci pour votre retour. Avec plaisir. Je peux vous expliquer rapidement "
            "la solution et voir si elle correspond à vos besoins. Quel créneau vous convient ?"
        )

    if "prix" in lower or "tarif" in lower:
        return (
            "Merci pour votre retour. Pouvez-vous me préciser votre besoin afin que "
            "je vous donne une réponse adaptée ?"
        )

    return "Merci pour votre retour. Je vous propose d’en discuter plus en détail."


def repair_json(raw_text: str) -> dict:
    text = safe_text(raw_text)
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            return {}

    return {}


def fallback_crm_reply(reply_text: str) -> str:
    if not reply_text:
        return ""

    lower = normalize_text(reply_text)

    if "pas interess" in lower or "pas int" in lower:
        return "Merci pour votre retour. Je comprends parfaitement. Bonne continuation a vous."

    if "disponible" in lower or "oui" in lower or "interess" in lower or "intÃ©ress" in lower:
        return (
            "Merci pour votre retour. Parfait, quel creneau vous conviendrait "
            "pour un echange rapide cette semaine ?"
        )

    if "savoir plus" in lower or "plus" in lower:
        return (
            "Merci pour votre retour. Avec plaisir. "
            "Je peux vous expliquer rapidement l'approche et voir si elle correspond a vos besoins actuels. "
            "Quel serait le meilleur moment pour echanger ?"
        )

    if "prix" in lower or "tarif" in lower:
        return (
            "Merci pour votre retour. Pouvez-vous me preciser votre besoin afin que "
            "je vous donne une reponse adaptee ?"
        )

    return "Merci pour votre retour. Je vous propose d'en discuter plus en detail."


def analyze_conversation_reply_with_gemini(
    prospect,
    channel,
    has_reply,
    reply_text,
    conversation_history,
) -> dict:
    history_payload = [
        {
            "sender": item.get("sender"),
            "text": item.get("text"),
            "created_at": str(item.get("created_at") or ""),
        }
        for item in conversation_history[-20:]
        if item.get("sender") in {"me", "prospect"} and item.get("text")
    ]

    try:
        model = get_gemini_model(max_output_tokens=1200, temperature=0.2)

        prompt = f"""
Tu es un agent d'engagement commercial CRM.

Règles strictes :
- Analyse uniquement la conversation privée ci-dessous.
- N'utilise jamais les posts, la bio ou le profil.
- N'invente jamais une réponse du prospect.
- Si le prospect a répondu, génère une réponse pour continuer la discussion.
- Si aucune réponse réelle n'est détectée, génère une relance polie.
- Le message doit être court, naturel et adapté au canal {channel}.
- Retourne uniquement un JSON valide, sans markdown.

Prospect :
- Nom : {prospect_name(prospect)}
- Canal : {channel}

Conversation privée :
{json.dumps(history_payload, ensure_ascii=False)}

Dernière réponse réelle détectée du prospect :
{reply_text if has_reply else "Aucune réponse réelle détectée après notre dernier message."}

Format JSON obligatoire :
{CONVERSATION_REPLY_SCHEMA}
""".strip()

        response = generate_with_retry(
            model,
            prompt,
            max_retries=2,
            wait_seconds=10,
            log_prefix="conversation-reply-check",
        )

        raw_text = getattr(response, "text", "") or ""

        try:
            data = extract_json(raw_text)
        except Exception:
            data = repair_json(raw_text)

    except Exception as exc:
        logger.warning("[reply-check] Gemini conversation indisponible: %s", exc)
        data = {}

    recommended_action = safe_text(data.get("recommended_action"))

    if recommended_action not in {
        "reply",
        "follow_up",
        "call",
        "create_opportunity",
        "no_action",
    }:
        recommended_action = "reply" if has_reply else "follow_up"

    sentiment = safe_text(data.get("sentiment"))

    if sentiment not in {
        "interested",
        "neutral",
        "not_interested",
        "question",
        "objection",
        "no_reply",
    }:
        sentiment = "neutral" if has_reply else "no_reply"

    generated_reply = safe_text(data.get("generated_reply"))

    if not generated_reply:
        generated_reply = fallback_crm_reply(reply_text) if has_reply else fallback_followup(prospect, channel)

    reply_summary = safe_text(data.get("reply_summary"))

    if not reply_summary:
        reply_summary = reply_text[:300] if has_reply else ""

    return {
        "has_reply": bool(has_reply),
        "reply_summary": reply_summary,
        "sentiment": sentiment,
        "recommended_action": recommended_action,
        "generated_reply": generated_reply,
    }


def login_required_result(channel: str, message: str | None = None) -> dict:
    return {
        "success": False,
        "requires_login": True,
        "status": "login_required",
        "platform": channel,
        "message": message or "Connexion requise avant de vérifier les réponses.",
        "messages": [],
    }


def check_prospect_reply(prospect, user=None) -> dict:
    channel = normalize_text(getattr(prospect, "last_engagement_channel", ""))

    if channel not in SOCIAL_CHANNELS:
        return {
            "success": False,
            "status": "unsupported_channel",
            "message": "La vérification de conversation est disponible seulement pour LinkedIn, Facebook et Instagram.",
            "messages": [],
        }

    if has_existing_opportunity(prospect) or getattr(prospect, "status", None) == "won":
        return {
            "success": False,
            "status": "already_converted",
            "message": "Ce prospect est déjà converti ou rattaché à une opportunité.",
            "messages": [],
        }

    current_status = normalize_text(getattr(prospect, "engagement_status", ""))

    if not last_sent_message(prospect) or current_status not in CHECKABLE_STATUSES:
        return {
            "success": False,
            "status": "message_not_sent",
            "message": "Aucun message envoyé à vérifier pour ce prospect.",
            "messages": [],
        }

    user_id = getattr(user, "id", None) or getattr(getattr(prospect, "assigned_to", None), "id", None)

    scrape_result = scrape_social_conversation(
        prospect,
        channel,
        user_id=user_id,
    )

    if scrape_result.get("requires_login"):
        return login_required_result(channel, scrape_result.get("message"))

    if not scrape_result.get("success"):
        return {
            "success": False,
            "status": scrape_result.get("status") or "conversation_scrape_error",
            "message": scrape_result.get("message") or "Erreur scraping conversation.",
            "messages": scrape_result.get("messages", []),
        }

    raw_messages = scrape_result.get("messages", [])

    conversation_messages = normalize_conversation_messages(
        raw_messages,
        prospect,
    )

    logger.warning(
        "[REPLY DEBUG] prospect=%s channel=%s raw_messages=%s normalized=%s",
        prospect.pk,
        channel,
        raw_messages,
        conversation_messages,
    )

    detection = detect_reply_from_conversation(conversation_messages)
    conversation_history = detection.get("conversation_history", conversation_messages)

    has_reply = bool(detection.get("has_reply"))
    reply_text = safe_text(detection.get("reply_text"))

    gemini_result = analyze_conversation_reply_with_gemini(
        prospect=prospect,
        channel=channel,
        has_reply=has_reply,
        reply_text=reply_text,
        conversation_history=conversation_history,
    )

    prospect_status = (
        "opportunity_ready"
        if gemini_result.get("recommended_action") == "create_opportunity"
        else "not_interested"
        if gemini_result.get("sentiment") == "not_interested"
        else "reply_detected"
        if has_reply
        else "followup_generated"
    )

    return {
        "success": True,
        "has_reply": has_reply,
        "message": (
            "Réponse détectée pour ce prospect."
            if has_reply
            else "Aucune réponse détectée pour ce prospect."
        ),
        "reply_text": reply_text,
        "messages": conversation_messages[-20:],
        "conversation_history": conversation_history[-20:],
        "reply_summary": gemini_result.get("reply_summary", ""),
        "sentiment": gemini_result.get("sentiment", ""),
        "recommended_action": gemini_result.get("recommended_action", ""),
        "generated_reply": gemini_result.get("generated_reply", ""),
        "prospect_status": prospect_status,
        "conversation_status": prospect_status,
    }
