import json


SCHEMA_HINT = """
{
  "need_level": "UNKNOWN | LOW | MEDIUM | HIGH",
  "intent_level": "UNKNOWN | LOW | MEDIUM | HIGH",
  "urgency_level": "UNKNOWN | LOW | MEDIUM | HIGH",
  "budget_signal": "UNKNOWN | NEGATIVE | NEUTRAL | POSITIVE",
  "authority_level": "UNKNOWN | USER | INFLUENCER | DECISION_MAKER",
  "engagement_quality": "NONE | NEGATIVE | WEAK | POSITIVE | STRONG",
  "detected_needs": ["..."],
  "objections": ["..."],
  "buying_signals": ["..."],
  "missing_information": ["..."],
  "summary": "..."
}
""".strip()


def build_qualification_prompt(state):
    payload = {
        "qualification_mode": state.get("qualification_mode"),
        "prospect": state.get("prospect"),
        "company": state.get("company"),
        "qualification_target": state.get("qualification_target"),
        "prospect360": state.get("prospect360"),
        "profile_signals": state.get("profile_signals"),
        "interactions": state.get("interactions"),
        "engagement_logs": state.get("engagement_logs"),
        "previous_qualification": state.get("previous_qualification"),
    }

    return f"""
Tu es le moteur d'analyse sémantique d'un agent de qualification commerciale intégré à un CRM.

Règles strictes :
- Analyse uniquement les données fournies.
- N'invente jamais une information absente.
- Une information absente doit rester UNKNOWN ou être ajoutée à missing_information.
- Distingue les faits, les signaux commerciaux et les inconnues.
- Ne donne pas de score final et ne décide pas de créer une opportunité.
- Analyse les échanges pour identifier besoin, intention, urgence, budget, autorité, objections et signaux d'achat.
- Retourne uniquement un objet JSON valide conforme au schéma.

Schéma attendu :
{SCHEMA_HINT}

Données CRM :
{json.dumps(payload, ensure_ascii=False, default=str)[:14000]}
""".strip()
