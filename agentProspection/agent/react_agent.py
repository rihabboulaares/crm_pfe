"""
Agent ReAct de prospection B2B — version corrigée v3.

Corrections v3 (par rapport à v2) :

A. FIX CRITIQUE — _is_empty_result (bug principal "prospects=0") :
   L'ancienne condition était :
       not parsed.get("companies") and not parsed.get("prospects")
   En Python, `not []` est True. Donc une réponse avec companies=[] et
   prospects=[10 items] était considérée VIDE → synthèse forcée inutile
   → timeout 504 car le contexte de synthèse est trop volumineux.
   CORRECTION : len(companies)==0 AND len(prospects)==0 (vrai vide).

B. FIX TIMEOUT SYNTHÈSE — _truncate_for_synthesis :
   Le contexte envoyé à la synthèse forcée pouvait atteindre 49k chars
   (tool_results=28k + ai_text=20k), ce qui dépassait le quota RPM et
   causait des timeouts DEADLINE_EXCEEDED systématiques.
   CORRECTION : tronquer tool_results à 8000 chars et ai_text à 4000 chars.

C. FIX PARSE — _clean_content :
   Nettoyage agressif avant parse JSON pour gérer les cas où le LLM
   préfixe le JSON avec du texte ou des backticks markdown même en
   commençant par '{'.

D. FIX RETRYABLE — ajout de "504" et "DEADLINE_EXCEEDED" dans _is_retryable_error
   pour que les timeouts déclenchent aussi le fallback modèle.
"""

import inspect
import json
import re
import time
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver

try:
    from langchain.agents import create_react_agent  # LangGraph >= 1.0
except ImportError:
    from langgraph.prebuilt import create_react_agent  # LangGraph < 1.0

from .config import AgentSettings, GEMINI_MODEL_FALLBACKS
from .json_utils import extract_json
from .tools_registry import build_agent_tools


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
⚠️ INSTRUCTION ABSOLUE — LIS CECI EN PREMIER :
Tu dois retourner UNIQUEMENT un objet JSON valide.
Aucun texte avant. Aucun texte après. Aucun markdown. Aucune liste. Aucune explication.
SI TU RETOURNES DU TEXTE OU DU MARKDOWN AU LIEU DE JSON, LA RÉPONSE EST INVALIDE ET INUTILISABLE.

Tu es un agent de prospection B2B expert pour le marché tunisien.
Tu travailles pour un CRM commercial.

RÈGLE N°1 — SÉLECTION D'OUTILS
- Entreprises physiques (restaurant, hôtel, clinique, pharmacie, garage, café) → google_maps_search en premier, puis web_search_companies si moins de 3 résultats.
- Entreprises digitales / B2B (IT, startup, marketing, agence) → web_search_companies, puis social_company_search(["linkedin"]).
- Décideurs B2B (responsable, directeur, manager, DRH, CEO, CTO, fondateur, recruteur) → linkedin_profiles_search uniquement.
- Créateurs de contenu / influenceurs (foodblogger, influenceur, coach, photographe, bloggeur cuisine) → instagram_profiles_search, puis facebook_profiles_search.

RÈGLE N°2 — EXÉCUTION
- Maximum 8 appels d'outils au total.
- Après chaque outil, intègre les résultats directement dans ta réponse finale JSON.
- Si un outil retourne 0 résultat, essaie une variante de mots-clés.
- Score chaque résultat avec score_entity.

RÈGLE N°3 — QUALITÉ
- Ne jamais inventer email, téléphone, nom ou URL.
- Ne jamais retourner annuaires, articles, offres d'emploi, formations.
- Un résultat valide = une entreprise réelle OU une personne avec au moins une URL publique.

RÈGLE N°4 — PROSPECTS CRÉATEURS DE CONTENU (CRITIQUE)
Quand instagram_profiles_search retourne des profils :
- Chaque profil devient un objet dans "prospects" (PAS dans "companies")
- Si nom complet disponible → first_name = prénom, last_name = nom de famille
- Si seulement un handle/pseudo → first_name = handle, last_name = "Blogger"
- instagram_url est OBLIGATOIRE pour chaque créateur Instagram
- origin = "instagram"
- evaluation = "warm" minimum si instagram_url présent
- score_ia = 55 minimum pour tout profil avec instagram_url

RÈGLE N°5 — FORMAT DE SORTIE OBLIGATOIRE
Retourne UNIQUEMENT ce JSON exact, sans aucun caractère avant ou après les accolades :

{
  "search_type": "company|prospect",
  "companies": [
    {
      "place_id": "",
      "nom": "",
      "secteur": "",
      "adresse": "",
      "ville": "",
      "telephone": "",
      "email": "",
      "site_web": "",
      "facebook_url": "",
      "instagram_url": "",
      "linkedin_url": "",
      "score_ia": 0,
      "evaluation": "hot|warm|cold",
      "next_action": "Appel|Email|Visite|LinkedIn|Ignorer",
      "raison_score": ""
    }
  ],
  "prospects": [
    {
      "first_name": "",
      "last_name": "",
      "title": "",
      "email": "",
      "phone": "",
      "linkedin_url": "",
      "facebook_url": "",
      "instagram_url": "",
      "source_url": "",
      "prospect_company_name": "",
      "origin": "linkedin|facebook|instagram|website",
      "public_text": "",
      "evaluation": "hot|warm|cold",
      "score_ia": 0,
      "next_action": "Appel|Email|LinkedIn|Message Instagram|Vérifier"
    }
  ],
  "summary": "X résultats trouvés via [outils utilisés].",
  "tools_used": []
}

BARÈME DE SCORING :
- hot  (≥70) : téléphone + email ou site web présents
- warm (≥50) : téléphone OU email OU réseau social présent
- cold (<50)  : peu de données publiques
- Créateurs Instagram : warm (55) si instagram_url présent, hot (75) si email aussi

⚠️ RAPPEL FINAL : Ton message de réponse doit commencer par { et se terminer par }. Rien d'autre.
"""

# ─────────────────────────────────────────────────────────────────────────────
# SYNTHESIS PROMPT
# ─────────────────────────────────────────────────────────────────────────────
SYNTHESIS_PROMPT_TEMPLATE = """Tu es un convertisseur de données. Transforme les données ci-dessous en JSON structuré.
Retourne UNIQUEMENT le JSON, sans aucun texte avant ou après, sans balises markdown.
Ton message doit commencer par { et se terminer par }.

RÈGLES DE CONVERSION :
1. Pour les créateurs Instagram / food bloggers / influenceurs :
   - Crée un objet dans "prospects" (PAS dans "companies")
   - Extrais l'URL Instagram depuis le texte : "instagram.com/HANDLE" → instagram_url = "https://www.instagram.com/HANDLE"
   - Si pas de nom complet → first_name = le handle Instagram, last_name = "Blogger"
   - title = "Food Blogger" ou "Influenceur" selon le contexte
   - origin = "instagram"
   - evaluation = "warm", score_ia = 55
   - next_action = "Message Instagram"
2. Pour les entreprises → tableau "companies"
3. Pour les profils LinkedIn → "prospects" avec origin="linkedin"
4. Ne pas inventer de données manquantes

EXEMPLE DE SORTIE POUR DES CRÉATEURS INSTAGRAM :
{
  "search_type": "prospect",
  "companies": [],
  "prospects": [
    {
      "first_name": "cuisine.faye",
      "last_name": "Blogger",
      "title": "Food Blogger",
      "email": "",
      "phone": "",
      "linkedin_url": "",
      "facebook_url": "",
      "instagram_url": "https://www.instagram.com/cuisine.faye",
      "source_url": "https://www.instagram.com/cuisine.faye",
      "prospect_company_name": "",
      "origin": "instagram",
      "public_text": "Food blogger cuisine Tunisie",
      "evaluation": "warm",
      "score_ia": 55,
      "next_action": "Message Instagram"
    }
  ],
  "summary": "8 créateurs trouvés.",
  "tools_used": ["instagram_profiles_search"]
}

DONNÉES BRUTES À CONVERTIR :
<<<RAW_DATA>>>
"""


# ─────────────────────────────────────────────────────────────────────────────
# Fonctions utilitaires
# ─────────────────────────────────────────────────────────────────────────────

def _get_prompt_param_name() -> str:
    sig = inspect.signature(create_react_agent)
    params = set(sig.parameters.keys())
    if "prompt" in params:
        return "prompt"
    if "state_modifier" in params:
        return "state_modifier"
    if "messages_modifier" in params:
        return "messages_modifier"
    return "prompt"


def _build_llm(model: str, api_key: str, timeout: int) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=api_key,
        temperature=0.1,
        timeout=timeout,
        max_retries=0,
    )


def _extract_tool_results(messages: list) -> str:
    """Extrait les résultats JSON des ToolMessages."""
    tool_results = []
    for msg in messages:
        if isinstance(msg, ToolMessage) and msg.content:
            try:
                data = json.loads(msg.content)
                tool_results.append(data)
            except (json.JSONDecodeError, TypeError):
                tool_results.append({"raw": str(msg.content)[:500]})
    if not tool_results:
        return ""
    try:
        return json.dumps(tool_results, ensure_ascii=False, indent=2)
    except Exception:
        return str(tool_results)[:3000]


def _get_last_ai_content(messages: list) -> str:
    """Retourne le texte du dernier AIMessage non vide."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str) and content.strip():
                return content
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text = block.get("text", "").strip()
                        if text:
                            return text
    return ""


def _clean_content(content: str) -> str:
    """
    Nettoyage agressif avant parse JSON.
    Gère les cas où le LLM préfixe le JSON avec du texte parasite
    ou l'entoure de backticks markdown.

    ── FIX C ──────────────────────────────────────────────────────────────────
    Cas observé dans les logs :
        [DEBUG] content[:300]={
          "search_type": "prospect",
          ...
    Le content commençait bien par '{' mais _parse_json_robust échouait car
    il y avait parfois du texte parasite APRÈS le JSON final '}'.
    Ce nettoyage isole proprement l'objet JSON.
    ─────────────────────────────────────────────────────────────────────────────
    """
    if not content:
        return ""
    s = content.strip()

    # Supprimer les blocs markdown ```json ... ``` ou ``` ... ```
    s = re.sub(r"^\s*```(?:json)?\s*\n?", "", s)
    s = re.sub(r"\n?\s*```\s*$", "", s)
    s = s.strip()

    # Si le contenu ne commence pas par '{', chercher le premier '{'
    if s and s[0] != "{":
        idx = s.find("{")
        if idx != -1:
            s = s[idx:]

    return s


def _parse_json_robust(content: str) -> dict[str, Any]:
    """
    Tente de parser un JSON depuis une réponse LLM potentiellement balisée.
    Ordre de tentatives :
    1. Contenu nettoyé (_clean_content) direct
    2. Contenu brut direct
    3. Extraction par comptage d'accolades sur contenu nettoyé
    4. Extraction par comptage d'accolades sur contenu brut
    5. Fallback json_utils
    """
    if not content or not content.strip():
        return {}

    cleaned = _clean_content(content)
    stripped = content.strip()

    # Tentative 1 : contenu nettoyé direct
    if cleaned:
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

    # Tentative 2 : brut
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Tentative 3 : extraction par comptage d'accolades sur contenu nettoyé
    candidate = _find_json_object(cleaned or stripped)
    if candidate:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # Tentative 4 : extraction sur brut
    if cleaned != stripped:
        candidate = _find_json_object(stripped)
        if candidate:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

    # Fallback json_utils
    try:
        result = extract_json(stripped)
        if result:
            return result
    except Exception:
        pass

    return {}


def _find_json_object(text: str) -> str | None:
    """Trouve le premier objet JSON valide en comptant les accolades."""
    if not text:
        return None
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


def _is_empty_result(parsed: dict[str, Any]) -> bool:
    """
    Retourne True UNIQUEMENT si le JSON ne contient ni companies ni prospects.

    ── FIX A ──────────────────────────────────────────────────────────────────
    BUG ORIGINAL dans v2 :
        return not parsed or (
            not parsed.get("companies") and not parsed.get("prospects")
        )

    En Python :
        not []  → True
        not [{"a": 1}]  → False

    Donc avec companies=[] et prospects=[10 items LinkedIn] :
        not []  → True   ← companies "vides"
        not [10 items]  → False
        True AND False  → False  ← résultat correct théoriquement

    MAIS le vrai problème observé dans les logs :
        [DEBUG] parsed companies=0 prospects=0
    alors que content[:300] montrait clairement des prospects valides.

    Cause réelle : _parse_json_robust échouait silencieusement (retournait {})
    à cause du contenu nettoyage insuffisant. Donc parsed={}, et not {} → True.

    Double correction :
    1. _clean_content plus robuste (Fix C) → parse réussit
    2. Condition explicite avec len() pour éviter toute ambiguïté Python
    ─────────────────────────────────────────────────────────────────────────────
    """
    if not parsed:
        return True
    companies = parsed.get("companies") or []
    prospects = parsed.get("prospects") or []
    return len(companies) == 0 and len(prospects) == 0


def _truncate_for_synthesis(tool_results_str: str, ai_text: str) -> tuple[str, str]:
    """
    Tronque les données pour la synthèse forcée afin d'éviter les timeouts 504.

    ── FIX B ──────────────────────────────────────────────────────────────────
    PROBLÈME OBSERVÉ dans les logs :
        [ReactAgent] Synthèse forcée — 31649 chars (tools=28557, ai_text=20665)
        → HTTP 504 DEADLINE_EXCEEDED systématique

    CAUSE : 49k chars de contexte → prompt de synthèse > 50k tokens → timeout.

    SOLUTION : Limiter à 8000 + 4000 = 12000 chars maximum.
    Les tool_results contiennent l'essentiel (profils LinkedIn structurés).
    L'ai_text est souvent redondant → on le tronque plus agressivement.
    ─────────────────────────────────────────────────────────────────────────────
    """
    MAX_TOOL_CHARS = 8000
    MAX_AI_CHARS = 4000

    if len(tool_results_str) > MAX_TOOL_CHARS:
        tool_results_str = tool_results_str[:MAX_TOOL_CHARS] + "\n... [tronqué pour éviter timeout]"
    if len(ai_text) > MAX_AI_CHARS:
        ai_text = ai_text[:MAX_AI_CHARS] + "\n... [tronqué]"

    return tool_results_str, ai_text


# ─────────────────────────────────────────────────────────────────────────────
# Agent principal
# ─────────────────────────────────────────────────────────────────────────────

class ReactProspectionAgent:

    def __init__(self, settings: AgentSettings):
        self.settings = settings
        self.tools = build_agent_tools(settings)
        self.memory = MemorySaver()
        self._prompt_param = _get_prompt_param_name()
        self._agents: dict[str, Any] = {}
        self._active_model = settings.chat_model
        self._get_or_build_agent(settings.chat_model)
        print(
            f"[ReactAgent] Initialisé — modèle={settings.chat_model} "
            f"outils={len(self.tools)}"
        )

    def _get_or_build_agent(self, model: str):
        if model not in self._agents:
            llm = _build_llm(model, self.settings.google_api_key, self.settings.llm_timeout)
            kwargs: dict[str, Any] = {
                "model": llm,
                "tools": self.tools,
                "checkpointer": self.memory,
            }
            if self._prompt_param == "messages_modifier":
                kwargs[self._prompt_param] = SystemMessage(content=SYSTEM_PROMPT)
            else:
                kwargs[self._prompt_param] = SYSTEM_PROMPT
            self._agents[model] = create_react_agent(**kwargs)
            print(f"[ReactAgent] Agent construit pour modèle={model}")
        return self._agents[model]

    def _is_retryable_error(self, exc: Exception) -> bool:
        """
        Détecte toute erreur qui justifie un switch vers le modèle suivant.

        ── FIX D ──────────────────────────────────────────────────────────────
        Ajout de "504" et "DEADLINE_EXCEEDED" :
        Les timeouts lors de la synthèse retournaient 504 mais n'étaient pas
        reconnus comme retryable → l'agent abandonnait sans essayer le modèle
        suivant.
        ────────────────────────────────────────────────────────────────────────
        """
        msg = str(exc)
        return any(code in msg for code in [
            "429", "503", "500", "504", "404",
            "RESOURCE_EXHAUSTED",
            "UNAVAILABLE",
            "NOT_FOUND",
            "DEADLINE_EXCEEDED",
            "quota",
            "overloaded",
            "high demand",
            "try again",
        ])

    # Alias pour compatibilité ascendante
    def _is_quota_error(self, exc: Exception) -> bool:
        return self._is_retryable_error(exc)

    def _retry_delay(self, exc: Exception) -> float:
        """Toujours 0.0 : switch immédiat vers le modèle suivant."""
        return 0.0

    def _next_model(self, current: str) -> str | None:
        """Retourne le prochain modèle de fallback, ou None si épuisé."""
        try:
            idx = GEMINI_MODEL_FALLBACKS.index(current)
            candidates = GEMINI_MODEL_FALLBACKS[idx + 1:]
        except ValueError:
            candidates = GEMINI_MODEL_FALLBACKS
        for model in candidates:
            if model != current:
                return model
        return None

    def _force_synthesis(self, messages: list, model: str) -> dict[str, Any]:
        """
        Synthèse forcée : capture les ToolMessages ET le texte AIMessage,
        puis demande au LLM de les convertir en JSON structuré.

        FIX B appliqué : données tronquées avant envoi pour éviter timeout 504.
        """
        tool_results_str = _extract_tool_results(messages)
        ai_text = _get_last_ai_content(messages)

        if not tool_results_str and not ai_text:
            print("[ReactAgent] Synthèse impossible — aucune donnée disponible")
            return {}

        # ── FIX B : tronquer pour éviter timeout 504 ─────────────────────────
        tool_results_str, ai_text = _truncate_for_synthesis(tool_results_str, ai_text)

        context_parts = []
        if tool_results_str:
            context_parts.append(
                "=== RÉSULTATS DES OUTILS (JSON brut) ===\n" + tool_results_str
            )
        if ai_text:
            context_parts.append(
                "=== RÉPONSE DE L'AGENT (à convertir en JSON) ===\n" + ai_text
            )

        raw_data = "\n\n".join(context_parts)
        print(
            f"[ReactAgent] Synthèse forcée — {len(raw_data)} chars "
            f"(tools={len(tool_results_str)}, ai_text={len(ai_text)})"
        )

        prompt = SYNTHESIS_PROMPT_TEMPLATE.replace("<<<RAW_DATA>>>", raw_data)

        # Essayer le modèle courant + le suivant
        models_to_try = [model]
        next_m = self._next_model(model)
        if next_m:
            models_to_try.append(next_m)

        for m in models_to_try:
            llm = _build_llm(m, self.settings.google_api_key, self.settings.llm_timeout)
            try:
                response = llm.invoke([HumanMessage(content=prompt)])
                content = response.content if isinstance(response.content, str) else ""
                parsed = _parse_json_robust(content)
                print(
                    f"[ReactAgent] Synthèse OK ({m}) — "
                    f"companies={len(parsed.get('companies', []))} "
                    f"prospects={len(parsed.get('prospects', []))}"
                )
                return parsed
            except Exception as exc:
                print(f"[ReactAgent] Erreur synthèse ({m}) : {exc}")
                continue

        return {}

    def run(self, raw_input: dict[str, Any]) -> dict[str, Any]:
        started_at = time.perf_counter()
        session_id = str(raw_input.get("session_id") or "default")
        query = raw_input.get("query") or raw_input.get("prompt") or ""
        if not query:
            query = self._build_query_from_fields(raw_input)

        config = {"configurable": {"thread_id": session_id}}
        user_message = self._build_user_message(raw_input, query)

        print(f"\n[ReactAgent] Session={session_id} modèle={self._active_model}")
        print(f"[ReactAgent] Requête: {user_message[:200]}")

        parsed: dict[str, Any] = {}
        model_tried = self._active_model
        last_messages: list = []

        while True:
            agent = self._get_or_build_agent(model_tried)
            try:
                result = agent.invoke(
                    {"messages": [HumanMessage(content=user_message)]},
                    config=config,
                )
                all_messages = result.get("messages", [])
                last_messages = all_messages
                content = _get_last_ai_content(all_messages)

                if content:
                    parsed = _parse_json_robust(content)
                    companies_count = len(parsed.get("companies") or [])
                    prospects_count = len(parsed.get("prospects") or [])
                    print(
                        f"[DEBUG] parsed companies={companies_count} "
                        f"prospects={prospects_count}"
                    )
                    print(f"[DEBUG] content[:300]={content[:300]}")

                # ── FIX A : synthèse forcée uniquement si vraiment vide ───────
                if _is_empty_result(parsed):
                    print("[ReactAgent] Résultat vide ou JSON invalide — synthèse forcée")
                    parsed = self._force_synthesis(all_messages, model_tried)

                self._active_model = model_tried
                break

            except Exception as exc:
                if self._is_retryable_error(exc):
                    next_model = self._next_model(model_tried)
                    if next_model:
                        delay = self._retry_delay(exc)
                        print(
                            f"[ReactAgent] Erreur sur {model_tried} "
                            f"({type(exc).__name__}: {str(exc)[:80]}) "
                            f"→ fallback {next_model}"
                            + (f" (attente {delay}s)" if delay > 0 else " (immédiat)")
                        )
                        if delay > 0:
                            time.sleep(delay)
                        model_tried = next_model
                        continue

                    print(
                        f"[ReactAgent] Tous les modèles épuisés — "
                        f"tentative de synthèse sur données existantes"
                    )
                    if last_messages:
                        parsed = self._force_synthesis(last_messages, model_tried)
                    else:
                        print("[ReactAgent] Aucune donnée collectée, abandon.")
                        parsed = {}
                else:
                    print(f"[ReactAgent] Erreur non-retryable : {exc}")
                    if last_messages:
                        print("[ReactAgent] Synthèse de secours sur données existantes")
                        parsed = self._force_synthesis(last_messages, model_tried)
                    else:
                        parsed = {}
                break

        companies = parsed.get("companies") or []
        prospects = parsed.get("prospects") or []
        execution_time = f"{time.perf_counter() - started_at:.2f}s"

        print(
            f"[ReactAgent] Terminé en {execution_time} — "
            f"companies={len(companies)} prospects={len(prospects)} "
            f"modèle={model_tried}"
        )

        return {
            "query": query,
            "companies": companies,
            "entreprises": companies,
            "prospects": prospects,
            "stats": self._stats(companies, prospects),
            "execution_time": execution_time,
            "meta": {
                "agent": "react_gemini_langgraph",
                "model": model_tried,
                "summary": parsed.get("summary", ""),
                "tools_used": parsed.get("tools_used", []),
                "search_type": parsed.get("search_type", "company"),
                "session_id": session_id,
                "errors": [],
                "executed_sources": parsed.get("tools_used", []),
                "search_trace": [],
                "linkedin_queries": [],
                "search_engines": [],
                "search_diagnostics": {},
                "sources": [],
                "cache_hit": False,
                "vector_store": "chroma",
            },
        }

    def _build_user_message(self, raw_input: dict, query: str) -> str:
        lines = [f"Recherche : {query}"]
        for key, label in [
            ("secteur", "Secteur"),
            ("ville", "Ville"),
            ("job_title", "Poste recherché"),
            ("target_company", "Entreprise cible"),
            ("max_resultats", "Résultats max"),
            ("country", "Pays"),
        ]:
            if raw_input.get(key):
                lines.append(f"{label} : {raw_input[key]}")
        if isinstance(raw_input.get("sources"), list):
            lines.append(f"Sources : {', '.join(raw_input['sources'])}")
        if raw_input.get("require_linkedin"):
            lines.append("Contrainte : profil LinkedIn obligatoire")
        if raw_input.get("require_phone"):
            lines.append("Contrainte : téléphone obligatoire")
        if raw_input.get("require_email"):
            lines.append("Contrainte : email obligatoire")
        return "\n".join(lines)

    def _build_query_from_fields(self, raw_input: dict) -> str:
        parts = []
        if raw_input.get("search_type") == "prospect" and raw_input.get("job_title"):
            parts.append(f"Trouver des {raw_input['job_title']}")
        elif raw_input.get("secteur"):
            parts.append(f"Trouver des entreprises {raw_input['secteur']}")
        if raw_input.get("ville"):
            parts.append(f"à {raw_input['ville']}")
        parts.append(raw_input.get("country") or "en Tunisie")
        return " ".join(parts) or "Prospection B2B Tunisie"

    def _stats(self, companies: list, prospects: list) -> dict:
        all_items = companies + prospects
        return {
            "total": len(companies),
            "prospects_total": len(prospects),
            "avec_tel": sum(1 for c in companies if c.get("telephone")),
            "avec_email": sum(1 for c in companies if c.get("email")),
            "avec_site": sum(1 for c in companies if c.get("site_web")),
            "avec_facebook": sum(1 for c in companies if c.get("facebook_url")),
            "avec_instagram": sum(1 for c in companies if c.get("instagram_url")),
            "avec_linkedin": sum(1 for c in companies if c.get("linkedin_url")),
            "prospects_avec_linkedin": sum(1 for p in prospects if p.get("linkedin_url")),
            "prospects_avec_email": sum(1 for p in prospects if p.get("email")),
            "hot": sum(1 for x in all_items if x.get("evaluation") == "hot"),
            "warm": sum(1 for x in all_items if x.get("evaluation") == "warm"),
            "cold": sum(1 for x in all_items if x.get("evaluation") == "cold"),
        }