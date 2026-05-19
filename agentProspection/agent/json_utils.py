"""
Utilitaires JSON partagés entre tous les modules de l'agent.
"""

import json
import re
from typing import Any


def _find_json_object(text: str) -> str | None:
    """
    Trouve le premier objet JSON valide dans un texte
    en comptant les accolades ouvrantes/fermantes.
    Plus fiable que le regex .* pour les objets imbriqués.
    """
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape_next = False

    for i, char in enumerate(text[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if char == "\\" and in_string:
            escape_next = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]

    return None


def extract_json(text: str) -> dict[str, Any]:
    """
    Extrait le premier objet JSON valide depuis une réponse LLM.
    Gère les balises ```json ... ```, le texte avant/après, et les JSON imbriqués.
    """
    if not text:
        return {}

    cleaned = text.strip()

    # Cas 1 : balise ```json ... ```
    if "```" in cleaned:
        parts = cleaned.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].strip()
            try:
                result = json.loads(candidate)
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                continue

    # Cas 2 : JSON direct
    try:
        result = json.loads(cleaned)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Cas 3 : extraction par comptage d'accolades (robuste pour JSON imbriqués)
    candidate = _find_json_object(cleaned)
    if candidate:
        try:
            result = json.loads(candidate)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    # Cas 4 : regex simple en dernier recours
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(0))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    return {}


def clamp_score(value: Any) -> int:
    """Force un score entre 0 et 100."""
    try:
        score = int(value)
    except (TypeError, ValueError):
        score = 0
    return max(0, min(score, 100))