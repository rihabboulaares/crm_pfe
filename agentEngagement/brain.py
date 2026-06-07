"""
agentEngagement/brain.py
Analyse Gemini : choix canal + message personnalisé + tâche CRM.
Aucun envoi automatique.
"""

import json
import logging
import os
import re
import time
from typing import Optional

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from django.conf import settings

from .schemas import EngagementResultSchema
from .prompts import ENGAGEMENT_SYSTEM_PROMPT, build_engagement_prompt
from .gemini_client import (
    extract_json,
    generate_with_retry,
    get_gemini_model,
    repair_json_with_gemini,
)

logger = logging.getLogger("agentEngagement.brain")

GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GEMINI_MODEL = getattr(
    settings,
    "GEMINI_MODEL",
    os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
)


def _get_model():
    return get_gemini_model(max_output_tokens=4096)

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY non configurée")

    genai.configure(api_key=GEMINI_API_KEY)

    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config={
            "temperature": 0.05,
            "top_p": 0.7,
            "max_output_tokens": 4096,
            "response_mime_type": "application/json",
        },
    )


def _generate_with_retry(model, prompt: str, max_retries: int = 3):
    return generate_with_retry(model, prompt, max_retries=max_retries, wait_seconds=35, log_prefix="brain")

    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            return model.generate_content(prompt)

        except ResourceExhausted as exc:
            last_error = exc
            wait_time = 35 * attempt
            logger.warning(
                "[brain] Quota Gemini atteint. Tentative %s/%s. Attente %s sec.",
                attempt,
                max_retries,
                wait_time,
            )
            time.sleep(wait_time)

    raise last_error


def _extract_json(text: str) -> dict:
    return extract_json(text)

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
            candidate = text[start:end + 1]
            return json.loads(candidate)

        raise ValueError(f"Aucun JSON trouvé : {text[:300]}")


def _repair_json_with_gemini(model, raw_text: str) -> dict:
    schema_hint = """
{
  "qualified": true,
  "priority": "low",
  "best_channel": "linkedin",
  "action_type": "send_linkedin",
  "reason": "string",
  "should_create_task": true,
  "should_generate_message": true,
  "should_send_now": false,
  "subject": "",
  "message": "string",
  "call_script": "",
  "task_title": "string",
  "task_description": "string"
}
""".strip()
    return repair_json_with_gemini(model, raw_text, schema_hint=schema_hint)

    repair_prompt = f"""
Corrige ce contenu pour retourner UNIQUEMENT un JSON valide.
Aucun markdown.
Aucun commentaire.
Ne change pas le sens.
Complète les champs manquants si nécessaire.
Les retours à la ligne doivent être échappés avec \\n.

Schéma attendu :
{{
  "qualified": true,
  "priority": "low",
  "best_channel": "linkedin",
  "action_type": "send_linkedin",
  "reason": "string",
  "should_create_task": true,
  "should_generate_message": true,
  "should_send_now": false,
  "subject": "",
  "message": "string",
  "call_script": "",
  "task_title": "string",
  "task_description": "string"
}}

Contenu à corriger :
{raw_text}
""".strip()

    response = _generate_with_retry(model, repair_prompt)

    if not response or not getattr(response, "text", None):
        raise ValueError("Réparation JSON impossible : réponse vide")

    return _extract_json(response.text)


def _normalize_gemini_data(data: dict) -> dict:
    if not isinstance(data, dict):
        return data

    action_map = {
        "send_linkedin_message": "send_linkedin",
        "send_linkedin_msg": "send_linkedin",
        "linkedin_message": "send_linkedin",
        "message_linkedin": "send_linkedin",
        "linkedin": "send_linkedin",

        "send_facebook_message": "send_facebook",
        "send_facebook_msg": "send_facebook",
        "facebook_message": "send_facebook",
        "message_facebook": "send_facebook",
        "facebook": "send_facebook",

        "send_instagram_message": "send_instagram",
        "send_instagram_msg": "send_instagram",
        "instagram_message": "send_instagram",
        "message_instagram": "send_instagram",
        "instagram": "send_instagram",

        "send_email_message": "send_email",
        "email_message": "send_email",
        "message_email": "send_email",
        "email": "send_email",

        "phone_call": "call",
        "call_phone": "call",
        "create_call_task": "call",
        "call_task": "call",
        "phone": "call",

        "manual": "create_task",
        "manual_task": "create_task",
        "task": "create_task",
        "create_manual_task": "create_task",
    }

    channel_map = {
        "no_action": "manual",
        "manual": "manual",
        "linkedIn": "linkedin",
        "LinkedIn": "linkedin",
        "linked_in": "linkedin",
        "linkedin_message": "linkedin",
        "Facebook": "facebook",
        "facebook_message": "facebook",
        "Instagram": "instagram",
        "instagram_message": "instagram",
        "Email": "email",
        "email_message": "email",
        "Phone": "phone",
        "phone_call": "phone",
    }

    priority_map = {
        "faible": "low",
        "basse": "low",
        "low": "low",
        "moyenne": "medium",
        "medium": "medium",
        "normal": "medium",
        "haute": "high",
        "high": "high",
        "urgent": "high",
    }

    action = str(data.get("action_type", "")).strip()
    channel = str(data.get("best_channel", "")).strip()
    priority = str(data.get("priority", "")).strip()

    if channel:
        data["best_channel"] = channel_map.get(channel, channel.lower())

    if action:
        data["action_type"] = action_map.get(action, action)

    if priority:
        data["priority"] = priority_map.get(priority.lower(), priority.lower())

    data.setdefault("qualified", False)
    data.setdefault("priority", "medium")
    data.setdefault("best_channel", "manual")
    data.setdefault("action_type", "create_task")
    data.setdefault("reason", "Analyse IA effectuée.")
    data.setdefault("should_create_task", True)
    data.setdefault("should_generate_message", True)
    data.setdefault("should_send_now", False)
    data.setdefault("subject", "")
    data.setdefault("message", "")
    data.setdefault("call_script", "")
    data.setdefault("task_title", "")
    data.setdefault("task_description", "")

    data["should_send_now"] = False

    expected_action = {
        "email": "send_email",
        "phone": "call",
        "linkedin": "send_linkedin",
        "facebook": "send_facebook",
        "instagram": "send_instagram",
        "manual": "create_task",
    }

    channel = data.get("best_channel")
    action = data.get("action_type")

    if channel in expected_action:
        if action not in {expected_action[channel], "create_task", "no_action"}:
            data["action_type"] = expected_action[channel]

    if data.get("qualified") is False:
        data["best_channel"] = "manual"
        data["action_type"] = "no_action"
        data["should_create_task"] = False
        data["should_generate_message"] = False
        data["should_send_now"] = False

    if data.get("best_channel") == "phone":
        data["action_type"] = "call"
        data["message"] = ""

        if not data.get("call_script"):
            data["call_script"] = (
                "Bonjour, je vous appelle suite à l'analyse de votre profil. "
                "J'aimerais échanger brièvement avec vous pour comprendre vos besoins."
            )

    if data.get("best_channel") == "email":
        data["action_type"] = "send_email"

        if not data.get("subject"):
            data["subject"] = "Échange rapide"

        if not data.get("message"):
            data["message"] = (
                "Bonjour,\n\n"
                "Je me permets de vous contacter après avoir consulté votre profil. "
                "Seriez-vous disponible pour un court échange ?\n\n"
                "Cordialement,"
            )

    if data.get("best_channel") in {"linkedin", "facebook", "instagram"}:
        data["action_type"] = expected_action[data["best_channel"]]

        if not data.get("message"):
            data["message"] = (
                "Bonjour, j'ai consulté votre profil et je pense qu'un échange "
                "pourrait être intéressant. Seriez-vous disponible pour en discuter ?"
            )

    if not data.get("task_title"):
        data["task_title"] = f"Contacter le prospect via {data.get('best_channel')}"

    if not data.get("task_description"):
        data["task_description"] = (
            f"Tâche préparée par l'agent IA. Canal recommandé : "
            f"{data.get('best_channel')}. Raison : {data.get('reason')}"
        )

    return data


def _compact_profile_data(profile_data: dict) -> dict:
    data = dict(profile_data or {})

    for key in ["linkedin_data", "facebook_data", "instagram_data", "website_data"]:
        sub = data.get(key) or {}

        if isinstance(sub, dict):
            preview = sub.get("page_text_preview", "")

            if preview:
                sub["page_text_preview"] = preview[:1200]

            posts = sub.get("recent_posts") or sub.get("posts") or []

            if isinstance(posts, list):
                compact_posts = []
                for post in posts[:10]:
                    if isinstance(post, dict):
                        text = str(post.get("text") or post.get("content") or "")[:1200]
                        compact_posts.append(
                            {
                                "url": post.get("url") or post.get("link") or post.get("permalink") or "",
                                "text": text,
                                "hashtags": (post.get("hashtags") or [])[:10],
                                "date": post.get("date") or post.get("created_at") or "",
                            }
                        )
                    else:
                        compact_posts.append({"text": str(post)[:1200], "hashtags": []})
                sub["recent_posts"] = compact_posts
                sub["posts"] = compact_posts

            data[key] = sub

    return data


def analyze_and_generate(profile_data: dict, social_analysis: dict = None) -> Optional[EngagementResultSchema]:
    try:
        model = _get_model()
        compact_data = _compact_profile_data(profile_data)

        prompt = f"{ENGAGEMENT_SYSTEM_PROMPT}\n\n{build_engagement_prompt(compact_data, social_analysis=social_analysis)}"

        logger.info(
            "[brain] Analyse Gemini pour %s %s",
            compact_data.get("first_name", ""),
            compact_data.get("last_name", ""),
        )

        response = _generate_with_retry(model, prompt)

        if not response or not getattr(response, "text", None):
            raise ValueError("Réponse Gemini vide")

        raw_text = response.text

        try:
            data = _extract_json(raw_text)
        except Exception:
            logger.warning("[brain] JSON Gemini invalide, tentative de réparation")
            data = _repair_json_with_gemini(model, raw_text)

        data = _normalize_gemini_data(data)

        result = EngagementResultSchema(**data)
        result.should_send_now = False

        logger.info(
            "[brain] Résultat qualified=%s channel=%s action=%s",
            result.qualified,
            result.best_channel,
            result.action_type,
        )

        logger.info("[brain] personalized message generated")
        return result

    except Exception as exc:
        logger.exception("[brain] Erreur analyze_and_generate : %s", exc)
        return None
