import json
import logging
import os
import re
import time

import google.generativeai as genai
from django.conf import settings
from google.api_core.exceptions import ResourceExhausted

logger = logging.getLogger("agentEngagement.gemini_client")

GEMINI_MODEL = getattr(
    settings,
    "GEMINI_MODEL",
    os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
)


def _configured_keys():
    candidates = [
        getattr(settings, "GOOGLE_API_KEY", os.environ.get("GOOGLE_API_KEY", "")),
        getattr(settings, "GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", "")),
    ]

    keys = []
    seen = set()
    for raw_key in candidates:
        key = str(raw_key or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        keys.append(key)
    return keys


API_KEYS = _configured_keys()
CURRENT_KEY_INDEX = 0
KEY_COOLDOWNS = {}
KEY_COOLDOWN_SECONDS = 70


def _mask_key(key: str) -> str:
    key = str(key or "")
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


def _get_available_key():
    global CURRENT_KEY_INDEX

    if not API_KEYS:
        raise ValueError("Aucune clé Gemini configurée.")

    now = time.time()
    total = len(API_KEYS)

    for offset in range(total):
        index = (CURRENT_KEY_INDEX + offset) % total
        key = API_KEYS[index]
        if KEY_COOLDOWNS.get(key, 0) <= now:
            CURRENT_KEY_INDEX = index
            return key

    return None


def _rotate_after_quota(key: str):
    global CURRENT_KEY_INDEX

    KEY_COOLDOWNS[key] = time.time() + KEY_COOLDOWN_SECONDS

    if API_KEYS:
        try:
            index = API_KEYS.index(key)
            CURRENT_KEY_INDEX = (index + 1) % len(API_KEYS)
        except ValueError:
            CURRENT_KEY_INDEX = (CURRENT_KEY_INDEX + 1) % len(API_KEYS)


def _create_model(
    *,
    api_key: str,
    max_output_tokens: int = 4096,
    temperature: float = 0.05,
    top_p: float = 0.7,
):
    genai.configure(api_key=api_key)

    return genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        generation_config={
            "temperature": temperature,
            "top_p": top_p,
            "max_output_tokens": max_output_tokens,
            "response_mime_type": "application/json",
        },
    )


def get_gemini_model(
    max_output_tokens: int = 4096,
    temperature: float = 0.05,
    top_p: float = 0.7,
):
    key = _get_available_key()
    if not key:
        raise ResourceExhausted(
            "Toutes les clés Gemini sont temporairement en cooldown."
        )

    return _create_model(
        api_key=key,
        max_output_tokens=max_output_tokens,
        temperature=temperature,
        top_p=top_p,
    )


def _finish_reason(response):
    try:
        return getattr(response.candidates[0], "finish_reason", None)
    except Exception:
        return None


def generate_with_retry(
    model,
    prompt: str,
    max_retries: int = 2,
    wait_seconds: int = 2,
    log_prefix: str = "gemini",
):
    """
    Génération robuste :
    - utilise le modèle fourni lors de la première tentative ;
    - si quota 429, met la clé courante en cooldown et bascule vers une autre clé ;
    - retry court uniquement pour les erreurs non-quota ;
    - ne dort jamais 30/60 secondes dans une requête HTTP Django.
    """

    global CURRENT_KEY_INDEX

    if not API_KEYS:
        raise ValueError("Aucune clé Gemini configurée.")

    last_error = None
    total_attempts = max(int(max_retries), len(API_KEYS), 1)
    current_model = model

    for attempt in range(1, total_attempts + 1):
        key = _get_available_key()
        if not key:
            raise ResourceExhausted(
                "Toutes les clés Gemini ont atteint leur quota temporaire."
            )

        try:
            # À chaque tentative, on reconfigure explicitement la clé active.
            # Cela garantit que la rotation est réellement appliquée.
            if attempt > 1 or current_model is None:
                current_model = _create_model(
                    api_key=key,
                    max_output_tokens=4096,
                    temperature=0.05,
                    top_p=0.7,
                )
            else:
                genai.configure(api_key=key)

            logger.info(
                "[%s] utilisation clé=%s tentative=%s/%s",
                log_prefix,
                _mask_key(key),
                attempt,
                total_attempts,
            )

            response = current_model.generate_content(prompt)

            logger.info(
                "[%s] finish_reason=%s",
                log_prefix,
                _finish_reason(response),
            )

            return response

        except ResourceExhausted as exc:
            last_error = exc

            logger.warning(
                "[%s] quota atteint pour clé=%s ; passage à la clé suivante.",
                log_prefix,
                _mask_key(key),
            )

            _rotate_after_quota(key)
            current_model = None
            continue

        except Exception as exc:
            last_error = exc

            logger.warning(
                "[%s] erreur Gemini tentative=%s/%s : %s",
                log_prefix,
                attempt,
                total_attempts,
                exc,
            )

            if attempt < total_attempts:
                time.sleep(max(0, wait_seconds))
                current_model = None
                continue

            raise

    raise last_error or RuntimeError("gemini_generation_failed")


def clean_json_text(text: str) -> str:
    text = str(text or "").strip()
    text = re.sub(r"^```json\s*", "", text, flags=re.I)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def extract_json(text: str) -> dict:
    """
    Extrait un objet JSON sans masquer les réponses réellement tronquées.
    Une réponse incomplète déclenche donc une erreur que le runtime peut corriger.
    """

    cleaned = clean_json_text(text)
    if not cleaned:
        raise ValueError("empty_gemini_response")

    try:
        value = json.loads(cleaned)
        if not isinstance(value, dict):
            raise ValueError("gemini_json_must_be_object")
        return value
    except json.JSONDecodeError as first_error:
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start != -1 and end != -1 and end > start:
            candidate = cleaned[start : end + 1]
            try:
                value = json.loads(candidate)
                if not isinstance(value, dict):
                    raise ValueError("gemini_json_must_be_object")
                return value
            except json.JSONDecodeError:
                pass

        # Important : conserver le vrai JSONDecodeError pour permettre au runtime
        # d'identifier une réponse tronquée/invalide.
        raise first_error


def repair_json_with_gemini(
    model,
    raw_text: str,
    schema_hint: str,
    max_retries: int = 1,
) -> dict:
    repair_prompt = f"""
Tu dois corriger une réponse JSON invalide.

Retourne UNIQUEMENT un objet JSON valide.
Aucun markdown.
Aucun commentaire.
Aucun texte avant ou après le JSON.
Ne développe pas le contenu : reste très concis.

Schéma attendu :
{schema_hint}

Réponse invalide :
{str(raw_text or '')[:5000]}
""".strip()

    response = generate_with_retry(
        model,
        repair_prompt,
        max_retries=max_retries,
        wait_seconds=1,
        log_prefix="json-repair",
    )

    if not response or not getattr(response, "text", None):
        raise ValueError("json_repair_empty_response")

    return extract_json(response.text)