import json
import logging
import os
import re

import google.generativeai as genai
from django.conf import settings

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
    return {**DEFAULT_ANALYSIS, "error": str(error or "gemini_analysis_failed")[:500]}


def _extract_json(text):
    text = (text or "").strip()
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise ValueError("no_json_found")


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


def _normalize_analysis(data):
    data = data if isinstance(data, dict) else {}
    confidence = data.get("confidence", 0)
    try:
        confidence = float(confidence)
    except Exception:
        confidence = 0

    return {
        "success": True,
        "summary": str(data.get("summary") or "")[:800],
        "interests": list(data.get("interests") or [])[:10],
        "activity_level": data.get("activity_level") or "unknown",
        "communication_tone": data.get("communication_tone") or "neutral",
        "recent_topics": list(data.get("recent_topics") or [])[:10],
        "commercial_relevance": data.get("commercial_relevance") or "unknown",
        "personalized_hook": str(data.get("personalized_hook") or "")[:500],
        "message_recommendation": str(data.get("message_recommendation") or "")[:700],
        "confidence": max(0, min(confidence, 1)),
    }


def analyze_social_profile_with_gemini(prospect, scraped_data):
    """
    Analyse le profil social avec Gemini.
    Retourne un JSON standardise.
    Ne doit jamais lever une exception bloquante.
    """
    try:
        if not scraped_data or not scraped_data.get("success"):
            return _failure(scraped_data.get("error") if isinstance(scraped_data, dict) else "no_scraped_data")

        if not GEMINI_API_KEY:
            return _failure("GEMINI_API_KEY non configuree")

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config={
                "temperature": 0.05,
                "top_p": 0.7,
                "max_output_tokens": 2048,
                "response_mime_type": "application/json",
            },
        )

        prospect_json = json.dumps(_prospect_payload(prospect), ensure_ascii=False, default=str)
        scraped_json = json.dumps(scraped_data, ensure_ascii=False, default=str)
        prompt = (
            SOCIAL_PROFILE_ANALYSIS_PROMPT
            .replace("{prospect_data}", prospect_json)
            .replace("{scraped_data}", scraped_json)
        )

        response = model.generate_content(prompt)
        if not response or not getattr(response, "text", None):
            return _failure("reponse_gemini_vide")

        data = _extract_json(response.text)
        return _normalize_analysis(data)

    except Exception as exc:
        logger.warning("[social-analysis] gemini analysis failed: %s", exc)
        return _failure(exc)
