import json
import logging
import os
import re
import time

import google.generativeai as genai
from django.conf import settings
from google.api_core.exceptions import ResourceExhausted

logger = logging.getLogger("agentEngagement.gemini_client")

GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", ""))
GEMINI_MODEL = getattr(settings, "GEMINI_MODEL", os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))


def get_gemini_model(max_output_tokens=4096, temperature=0.05, top_p=0.7):
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY non configuree")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config={
            "temperature": temperature,
            "top_p": top_p,
            "max_output_tokens": max_output_tokens,
            "response_mime_type": "application/json",
        },
    )


def generate_with_retry(model, prompt: str, max_retries: int = 3, wait_seconds: int = 30, log_prefix="gemini"):
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return model.generate_content(prompt)
        except ResourceExhausted as exc:
            last_error = exc
            wait_time = wait_seconds * attempt
            logger.warning("[%s] quota Gemini atteint. Tentative %s/%s. Attente %s sec.", log_prefix, attempt, max_retries, wait_time)
            time.sleep(wait_time)
    raise last_error or ValueError("gemini_generation_failed")


def clean_json_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"^```json\s*", "", text, flags=re.I)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def extract_json(text: str) -> dict:
    text = clean_json_text(text)
    if not text:
        raise ValueError("empty_gemini_response")
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end + 1])
    raise ValueError(f"Aucun JSON trouve : {text[:300]}")


def repair_json_with_gemini(model, raw_text: str, schema_hint: str, max_retries: int = 2) -> dict:
    repair_prompt = f"""
Corrige ce contenu pour retourner uniquement un JSON valide.
Aucun markdown.
Aucun texte avant ou apres.
Ne change pas le sens.
Si une information manque, utilise une valeur vide, unknown ou une liste vide.
Les retours a la ligne doivent etre echappes avec \\n.

Schema attendu :
{schema_hint}

Contenu a corriger :
{raw_text[:4000]}
""".strip()
    response = generate_with_retry(model, repair_prompt, max_retries=max_retries, log_prefix="json-repair")
    if not response or not getattr(response, "text", None):
        raise ValueError("json_repair_empty_response")
    return extract_json(response.text)
