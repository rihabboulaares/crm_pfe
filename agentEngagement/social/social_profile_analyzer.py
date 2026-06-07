import json
import logging
import os
import re
import time

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from django.conf import settings

from agentEngagement.gemini_client import (
    extract_json,
    generate_with_retry,
    get_gemini_model,
    repair_json_with_gemini,
)
from agentEngagement.prompts import SOCIAL_PROFILE_ANALYSIS_PROMPT

logger = logging.getLogger("agentEngagement.social_profile_analyzer")

GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GEMINI_MODEL = getattr(
    settings,
    "GEMINI_MODEL",
    os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
)


DEFAULT_ANALYSIS = {
    "success": False,
    "summary": "",
    "description": "",
    "profile_type": "",
    "interests": [],
    "activity_level": "unknown",
    "communication_tone": "neutral",
    "recent_topics": [],
    "commercial_relevance": "unknown",
    "personalized_hook": "",
    "message_recommendation": "",
    "confidence": 0,
}


def _failure(error):
    return {
        **DEFAULT_ANALYSIS,
        "error": str(error or "gemini_analysis_failed")[:500],
    }


def _get_model():
    return get_gemini_model(max_output_tokens=2048)

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY non configuree")

    genai.configure(api_key=GEMINI_API_KEY)

    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config={
            "temperature": 0.05,
            "top_p": 0.7,
            "max_output_tokens": 2048,
            "response_mime_type": "application/json",
        },
    )


def _generate_with_retry(model, prompt: str, max_retries: int = 3):
    return generate_with_retry(model, prompt, max_retries=max_retries, wait_seconds=30, log_prefix="social-analysis")

    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            return model.generate_content(prompt)

        except ResourceExhausted as exc:
            last_error = exc
            wait_time = 30 * attempt
            logger.warning(
                "[social-analysis] quota Gemini atteint. Tentative %s/%s. Attente %s sec.",
                attempt,
                max_retries,
                wait_time,
            )
            time.sleep(wait_time)

        except Exception:
            raise

    raise last_error or ValueError("gemini_generation_failed")


def _clean_json_text(text: str) -> str:
    text = (text or "").strip()

    text = re.sub(r"^```json\s*", "", text, flags=re.I)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    text = text.strip()
    return text


def _extract_json(text):
    return extract_json(text)

    text = _clean_json_text(text)

    if not text:
        raise ValueError("empty_gemini_response")

    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        candidate = text[start:end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    raise ValueError("no_json_found")


def _repair_json_with_gemini(model, raw_text: str) -> dict:
    schema_hint = """
{
  "summary": "resume court en 1 ou 2 phrases",
  "description": "description complete du profil en 4 a 8 lignes",
  "profile_type": "type du prospect",
  "interests": ["centre d'interet 1", "centre d'interet 2"],
  "activity_level": "active | medium | low | inactive | unknown",
  "communication_tone": "professional | friendly | technical | formal | casual | neutral",
  "recent_topics": ["sujet recent 1", "sujet recent 2"],
  "commercial_relevance": "high | medium | low | unknown",
  "personalized_hook": "phrase d'accroche personnalisee basee sur les donnees reelles",
  "message_recommendation": "conseil court pour ecrire le message",
  "confidence": 0.0
}
""".strip()
    return repair_json_with_gemini(model, raw_text, schema_hint=schema_hint)

    repair_prompt = f"""
Corrige ce contenu pour retourner uniquement un JSON valide.
Aucun markdown.
Aucun texte avant ou apres.
Ne change pas le sens.
Si une information manque, utilise une valeur vide, unknown ou une liste vide.
Les retours à la ligne doivent être échappés avec \\n.

Schema exact attendu :
{{
  "summary": "resume court en 1 ou 2 phrases",
  "description": "description complete du profil en 4 a 8 lignes",
  "profile_type": "type du prospect",
  "interests": ["centre d'interet 1", "centre d'interet 2"],
  "activity_level": "active | medium | low | inactive | unknown",
  "communication_tone": "professional | friendly | technical | formal | casual | neutral",
  "recent_topics": ["sujet recent 1", "sujet recent 2"],
  "commercial_relevance": "high | medium | low | unknown",
  "personalized_hook": "phrase d'accroche personnalisee basee sur les donnees reelles",
  "message_recommendation": "conseil court pour ecrire le message",
  "confidence": 0.0
}}

Contenu a corriger :
{raw_text[:4000]}
""".strip()

    response = _generate_with_retry(model, repair_prompt, max_retries=2)

    if not response or not getattr(response, "text", None):
        raise ValueError("json_repair_empty_response")

    return _extract_json(response.text)


def _compact_scraped_data(scraped_data: dict) -> dict:
    """
    Evite d'envoyer trop de texte a Gemini.
    On garde les infos utiles seulement.
    """
    data = dict(scraped_data or {})

    raw = data.pop("raw", None)

    for key in [
        "page_text_preview",
        "main_text",
        "visible_text",
        "profile_description",
        "description",
        "bio",
        "headline",
    ]:
        if data.get(key):
            data[key] = str(data.get(key))[:1500]

    posts = data.get("recent_posts") or data.get("posts") or []

    compact_posts = []
    if isinstance(posts, list):
        for post in posts[:6]:
            if isinstance(post, dict):
                compact_posts.append(
                    {
                        "url": post.get("url") or "",
                        "text": str(
                            post.get("text")
                            or post.get("caption")
                            or post.get("content")
                            or ""
                        )[:900],
                        "date": str(post.get("date") or "")[:80],
                        "hashtags": list(post.get("hashtags") or [])[:10],
                        "likes": post.get("likes"),
                        "comments": post.get("comments"),
                    }
                )
            elif post:
                compact_posts.append(
                    {
                        "text": str(post)[:900],
                        "hashtags": [],
                    }
                )

    data["recent_posts"] = compact_posts
    data["posts"] = compact_posts

    return data


def _prospect_payload(prospect):
    company_name = ""
    if getattr(prospect, "prospect_company", None):
        company_name = prospect.prospect_company.name or ""

    return {
        "id": prospect.pk,
        "first_name": prospect.first_name or "",
        "last_name": prospect.last_name or "",
        "title": prospect.title or "",
        "description": prospect.description or "",
        "company": company_name,
        "city": prospect.city or "",
        "country": prospect.country or "",
        "email_available": bool(prospect.email),
        "phone_available": bool(prospect.phone),
        "linkedin_url": prospect.linkedin_url or "",
        "facebook_url": prospect.facebook_url or "",
        "instagram_url": prospect.instagram_url or "",
    }


def _safe_list(value, limit=10):
    if not value:
        return []

    if isinstance(value, list):
        return [str(item)[:120] for item in value if item][:limit]

    if isinstance(value, str):
        return [value[:120]]

    return []


def _normalize_choice(value, allowed, default):
    value = str(value or "").strip().lower()
    return value if value in allowed else default


def _normalize_analysis(data):
    data = data if isinstance(data, dict) else {}

    confidence = data.get("confidence", 0)
    try:
        confidence = float(confidence)
    except Exception:
        confidence = 0

    activity_level = _normalize_choice(
        data.get("activity_level"),
        {"active", "medium", "low", "inactive", "unknown"},
        "unknown",
    )

    communication_tone = _normalize_choice(
        data.get("communication_tone"),
        {"professional", "friendly", "technical", "formal", "casual", "neutral"},
        "neutral",
    )

    commercial_relevance = _normalize_choice(
        data.get("commercial_relevance"),
        {"high", "medium", "low", "unknown"},
        "unknown",
    )

    return {
        "success": True,
        "summary": str(data.get("summary") or "")[:800],
        "description": str(data.get("description") or "")[:2000],
        "profile_type": str(data.get("profile_type") or "")[:150],
        "interests": _safe_list(data.get("interests"), limit=10),
        "activity_level": activity_level,
        "communication_tone": communication_tone,
        "recent_topics": _safe_list(data.get("recent_topics"), limit=10),
        "commercial_relevance": commercial_relevance,
        "personalized_hook": str(data.get("personalized_hook") or "")[:500],
        "message_recommendation": str(data.get("message_recommendation") or "")[:700],
        "confidence": max(0, min(confidence, 1)),
    }


def _fallback_analysis_from_scraped_data(scraped_data: dict) -> dict:
    """
    Si Gemini echoue, on cree quand meme une petite analyse basique.
    Cela evite que le frontend reste vide.
    """
    platform = scraped_data.get("platform") or "social"
    username = scraped_data.get("username") or ""
    display_name = scraped_data.get("display_name") or scraped_data.get("full_name") or ""
    bio = scraped_data.get("bio") or scraped_data.get("description") or ""
    activity_level = scraped_data.get("activity_level") or "unknown"
    posts = scraped_data.get("recent_posts") or scraped_data.get("posts") or []

    topics = []
    hashtags = []

    for post in posts[:6]:
        if isinstance(post, dict):
            hashtags.extend(post.get("hashtags") or [])

    hashtags = sorted(set(str(tag).strip("#") for tag in hashtags if tag))[:10]
    topics = hashtags[:5]

    name = display_name or username or "Ce prospect"

    summary = f"{name} possede un profil {platform} public exploitable."
    if bio:
        summary = str(bio)[:500]

    description_parts = [
        f"Profil detecte sur {platform}.",
    ]

    if username:
        description_parts.append(f"Nom d'utilisateur : {username}.")

    if bio:
        description_parts.append(f"Bio / description : {bio[:800]}")

    if posts:
        description_parts.append(f"{len(posts)} publication(s) recente(s) ont ete detectee(s).")

    return {
        **DEFAULT_ANALYSIS,
        "success": True,
        "summary": summary[:800],
        "description": " ".join(description_parts)[:2000],
        "profile_type": "profil social",
        "interests": hashtags,
        "activity_level": activity_level,
        "communication_tone": "neutral",
        "recent_topics": topics,
        "commercial_relevance": "unknown",
        "personalized_hook": "",
        "message_recommendation": "Personnaliser le message avec les informations visibles du profil.",
        "confidence": 0.35,
        "fallback": True,
    }


def analyze_social_profile_with_gemini(prospect, scraped_data):
    """
    Analyse le profil social avec Gemini.
    Retourne toujours un JSON standardise.
    Ne leve jamais une exception bloquante.
    """
    try:
        if not scraped_data or not isinstance(scraped_data, dict):
            return _failure("no_scraped_data")

        if not scraped_data.get("success"):
            return _failure(scraped_data.get("error") or scraped_data.get("status") or "scraping_failed")

        compact_scraped_data = _compact_scraped_data(scraped_data)

        if not GEMINI_API_KEY:
            logger.warning("[social-analysis] GEMINI_API_KEY non configuree, fallback local utilise")
            return _fallback_analysis_from_scraped_data(compact_scraped_data)

        model = _get_model()

        prospect_json = json.dumps(
            _prospect_payload(prospect),
            ensure_ascii=False,
            default=str,
        )
        scraped_json = json.dumps(
            compact_scraped_data,
            ensure_ascii=False,
            default=str,
        )

        prompt = (
            SOCIAL_PROFILE_ANALYSIS_PROMPT
            .replace("{prospect_data}", prospect_json)
            .replace("{scraped_data}", scraped_json)
        )

        response = _generate_with_retry(model, prompt)

        if not response or not getattr(response, "text", None):
            logger.warning("[social-analysis] Gemini response empty, fallback local utilise")
            return _fallback_analysis_from_scraped_data(compact_scraped_data)

        raw_text = response.text

        try:
            data = _extract_json(raw_text)
        except Exception as exc:
            logger.warning("[social-analysis] JSON Gemini invalide: %s", exc)
            logger.warning("[social-analysis] raw Gemini response preview: %s", raw_text[:1000])

            try:
                data = _repair_json_with_gemini(model, raw_text)
            except Exception as repair_exc:
                logger.warning("[social-analysis] JSON repair failed: %s", repair_exc)
                return _fallback_analysis_from_scraped_data(compact_scraped_data)

        return _normalize_analysis(data)

    except Exception as exc:
        logger.warning("[social-analysis] gemini analysis failed: %s", exc)
        try:
            return _fallback_analysis_from_scraped_data(scraped_data or {})
        except Exception:
            return _failure(exc)
