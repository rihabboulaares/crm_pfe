"""
Agent ReAct de prospection B2B — version corrigée v5.

Corrections v5 (par rapport à v4) :

A. FIX CRITIQUE — Pollution mémoire inter-requêtes :
   MemorySaver avec thread_id fixe ("crm-chat") accumule tous les messages
   de toutes les requêtes dans la même session. Quand l'agent pose une question
   au lieu d'agir, _extract_prospects_from_tool_messages récupère les
   ToolMessages de la requête PRÉCÉDENTE → résultats erronés retournés.
   CORRECTION : générer un thread_id unique par requête (UUID) pour isoler
   chaque recherche dans sa propre session mémoire.

B. FIX — LLM pose des questions au lieu d'agir :
   Sur des requêtes vagues ("trouver des avocats"), Gemini demande des
   précisions au lieu d'utiliser les valeurs par défaut et d'appeler les outils.
   CORRECTION : renforcement du SYSTEM_PROMPT avec une règle explicite
   "NE JAMAIS poser de question" + valeurs par défaut obligatoires.

C. FIX — _extract_prospects_from_tool_messages ne lit que les messages
   de la requête courante (last_messages), pas tous les messages de session.
   Le paramètre reçoit maintenant uniquement les messages du dernier invoke().
"""

import inspect
import json
import re
import time
import uuid
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
⚠️ RÈGLES ABSOLUES — LIS CECI EN PREMIER, RESPECTE-LES TOUJOURS :

RÈGLE 0 — NE JAMAIS POSER DE QUESTION
Tu ne poses JAMAIS de question à l'utilisateur. Jamais. Même si la requête est vague.
Si des informations manquent, utilise ces valeurs par défaut :
- ville → Tunis
- pays → Tunisie
- secteur → déduis-le du contexte (avocat→juridique, médecin→santé, etc.)
- max_resultats → 10
Lance immédiatement les outils sans demander de précisions.

RÈGLE 1 — FORMAT DE SORTIE OBLIGATOIRE
Tu retournes UNIQUEMENT un objet JSON valide.
Aucun texte avant. Aucun texte après. Aucun markdown. Aucune liste. Aucune explication.
Ton message DOIT commencer par { et se terminer par }.
Si tu retournes autre chose que du JSON pur, la réponse est invalide.

Tu es un agent de prospection B2B expert pour le marché tunisien.
Tu travailles pour un CRM commercial.

RÈGLE 2 — SÉLECTION D'OUTILS
- Avocats, notaires, architectes, experts comptables, médecins, dentistes
  → search_type="company" → google_maps_search en premier
- Entreprises physiques (restaurant, hôtel, clinique, pharmacie, garage, café)
  → google_maps_search en premier, puis web_search_companies si < 3 résultats
- Entreprises digitales / B2B (IT, startup, marketing, agence)
  → web_search_companies, puis social_company_search(["linkedin"])
- Décideurs B2B (responsable, directeur, manager, DRH, CEO, CTO, fondateur, recruteur)
  → linkedin_profiles_search uniquement
- Créateurs de contenu / influenceurs (foodblogger, influenceur, coach, photographe)
  → instagram_profiles_search, puis facebook_profiles_search

RÈGLE 3 — EXÉCUTION
- Maximum 8 appels d'outils au total.
- Après chaque outil, intègre les résultats directement dans ta réponse finale JSON.
- Si un outil retourne 0 résultat, essaie une variante de mots-clés.
- Score chaque résultat avec score_entity.

RÈGLE 4 — QUALITÉ
- Ne jamais inventer email, téléphone, nom ou URL.
- Ne jamais retourner annuaires, articles, offres d'emploi, formations.
- Un résultat valide = une entreprise réelle OU une personne avec au moins une URL publique.

RÈGLE 5 — PROSPECTS CRÉATEURS DE CONTENU
Quand instagram_profiles_search retourne des profils :
- Chaque profil devient un objet dans "prospects" (PAS dans "companies")
- Si nom complet disponible → first_name = prénom, last_name = nom de famille
- Si seulement un handle/pseudo → first_name = handle, last_name = "Blogger"
- instagram_url est OBLIGATOIRE pour chaque créateur Instagram
- origin = "instagram", evaluation = "warm" minimum, score_ia = 55 minimum

RÈGLE 6 — FORMAT DE SORTIE JSON EXACT
Retourne UNIQUEMENT ce JSON, sans aucun caractère avant ou après les accolades :

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

⚠️ RAPPEL ABSOLU : commence par { et termine par }. Aucune question. Aucun texte.
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
   - Extrais l'URL Instagram : "instagram.com/HANDLE" → instagram_url = "https://www.instagram.com/HANDLE"
   - Si pas de nom complet → first_name = handle Instagram, last_name = "Blogger"
   - title = "Food Blogger" ou "Influenceur" selon le contexte
   - origin = "instagram", evaluation = "warm", score_ia = 55
   - next_action = "Message Instagram"
2. Pour les entreprises → tableau "companies"
3. Pour les profils LinkedIn → "prospects" avec origin="linkedin"
4. Ne pas inventer de données manquantes

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


def _clean_content(content: str) -> str:
    """
    Nettoyage agressif avant parse JSON — 3 passes :
    1. Supprimer les blocs markdown ```[json]...```
    2. Chercher le premier '{'
    3. Isoler l'objet JSON complet par comptage d'accolades
    """
    if not content:
        return ""
    s = content.strip()

    s = re.sub(r"^```(?:json)?\s*\n?", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\n?```\s*$", "", s)
    s = s.strip()

    if s and s[0] != "{":
        idx = s.find("{")
        if idx != -1:
            s = s[idx:]
        else:
            return s

    candidate = _find_json_object(s)
    if candidate:
        return candidate

    return s


def _parse_json_robust(content: str) -> dict[str, Any]:
    """Parse JSON depuis une réponse LLM potentiellement balisée."""
    if not content or not content.strip():
        return {}

    cleaned = _clean_content(content)
    stripped = content.strip()

    if cleaned:
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"[parse] T1 nettoyé échoué: {e} | debut: {cleaned[:80]!r}")

    try:
        return json.loads(stripped)
    except json.JSONDecodeError as e:
        print(f"[parse] T2 brut échoué: {e}")

    candidate = _find_json_object(cleaned or stripped)
    if candidate:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as e:
            print(f"[parse] T3 candidate échoué: {e}")

    if cleaned != stripped:
        candidate = _find_json_object(stripped)
        if candidate:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

    try:
        result = extract_json(stripped)
        if result:
            return result
    except Exception:
        pass

    print(f"[parse] ÉCHEC TOTAL — content debut: {content[:200]!r}")
    return {}


def _is_empty_result(parsed: dict[str, Any]) -> bool:
    """Retourne True UNIQUEMENT si le JSON ne contient ni companies ni prospects."""
    if not parsed:
        return True
    companies = parsed.get("companies") or []
    prospects = parsed.get("prospects") or []
    return len(companies) == 0 and len(prospects) == 0


def _truncate_for_synthesis(tool_results_str: str, ai_text: str) -> tuple[str, str]:
    """Tronque les données pour éviter les timeouts 504."""
    MAX_TOOL_CHARS = 8000
    MAX_AI_CHARS = 4000
    if len(tool_results_str) > MAX_TOOL_CHARS:
        tool_results_str = tool_results_str[:MAX_TOOL_CHARS] + "\n... [tronqué]"
    if len(ai_text) > MAX_AI_CHARS:
        ai_text = ai_text[:MAX_AI_CHARS] + "\n... [tronqué]"
    return tool_results_str, ai_text


def _extract_prospects_from_tool_messages(messages: list) -> dict[str, Any]:
    """
    Extrait directement les prospects/entreprises depuis les ToolMessages
    de la requête COURANTE uniquement.

    Reçoit `last_messages` = uniquement les messages du dernier agent.invoke().
    Grâce au thread_id unique par requête (Fix A), il n'y a plus de pollution
    par les sessions précédentes.
    """
    all_prospects = []
    all_companies = []
    tools_used = []
    seen_urls: set[str] = set()

    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        if not msg.content:
            continue

        tool_name = getattr(msg, "name", "") or ""
        if tool_name:
            tools_used.append(tool_name)

        try:
            data = json.loads(msg.content)
        except (json.JSONDecodeError, TypeError):
            continue

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            if data.get("error"):
                continue
            items = data.get("results") or data.get("prospects") or data.get("companies") or []
            if not isinstance(items, list):
                continue
        else:
            continue

        for item in items:
            if not isinstance(item, dict):
                continue

            has_linkedin = bool(item.get("linkedin_url"))
            has_instagram = bool(item.get("instagram_url"))
            has_facebook = bool(item.get("facebook_url"))
            has_first_name = bool(item.get("first_name"))

            # ── Prospect (personne) ───────────────────────────────────────────
            if has_first_name or has_linkedin or has_instagram:
                dedup_key = (
                    item.get("linkedin_url")
                    or item.get("instagram_url")
                    or item.get("facebook_url")
                    or item.get("source_url")
                    or f"{item.get('first_name')}:{item.get('last_name')}"
                )
                if dedup_key in seen_urls:
                    continue

                score = item.get("score_ia") or item.get("score") or 0
                if not score:
                    score = 65 if has_linkedin else 55 if (has_instagram or has_facebook) else 40

                evaluation = "hot" if score >= 70 else "warm" if score >= 50 else "cold"

                next_action = item.get("next_action", "")
                if not next_action:
                    if has_linkedin:
                        next_action = "LinkedIn"
                    elif has_instagram:
                        next_action = "Message Instagram"
                    elif item.get("email"):
                        next_action = "Email"
                    else:
                        next_action = "Vérifier"

                origin = item.get("origin", "")
                if not origin:
                    if has_linkedin:
                        origin = "linkedin"
                    elif has_instagram:
                        origin = "instagram"
                    elif has_facebook:
                        origin = "facebook"
                    else:
                        origin = "website"

                prospect = {
                    "first_name": item.get("first_name", ""),
                    "last_name": item.get("last_name", ""),
                    "title": item.get("title", ""),
                    "email": item.get("email", ""),
                    "phone": item.get("phone", "") or item.get("telephone", ""),
                    "linkedin_url": item.get("linkedin_url", ""),
                    "facebook_url": item.get("facebook_url", ""),
                    "instagram_url": item.get("instagram_url", ""),
                    "source_url": item.get("source_url", ""),
                    "prospect_company_name": item.get("prospect_company_name", ""),
                    "origin": origin,
                    "public_text": str(item.get("public_text", "") or item.get("evidence", ""))[:500],
                    "evaluation": item.get("evaluation", evaluation),
                    "score_ia": score,
                    "next_action": next_action,
                }

                if prospect["first_name"] and (
                    prospect["linkedin_url"]
                    or prospect["instagram_url"]
                    or prospect["facebook_url"]
                    or prospect["source_url"]
                    or prospect["email"]
                ):
                    seen_urls.add(dedup_key)
                    all_prospects.append(prospect)
                    print(
                        f"  [extract_direct] prospect: {prospect['first_name']} {prospect['last_name']} "
                        f"| {origin} | score={score}"
                    )

            # ── Entreprise ────────────────────────────────────────────────────
            elif item.get("nom") or item.get("name"):
                dedup_key = (
                    item.get("place_id")
                    or item.get("site_web")
                    or item.get("linkedin_url")
                    or item.get("facebook_url")
                    or item.get("instagram_url")
                    or item.get("source_url")
                    or item.get("nom")
                    or item.get("name")
                )
                if dedup_key in seen_urls:
                    continue

                score = item.get("score_ia") or item.get("score") or item.get("data_quality") or 0
                evaluation = "hot" if score >= 70 else "warm" if score >= 50 else "cold"

                next_action = item.get("next_action", "")
                if not next_action:
                    if item.get("telephone"):
                        next_action = "Appel"
                    elif item.get("email"):
                        next_action = "Email"
                    elif item.get("linkedin_url"):
                        next_action = "LinkedIn"
                    elif item.get("adresse"):
                        next_action = "Visite"
                    else:
                        next_action = "Ignorer"

                company = {
                    "place_id": item.get("place_id", ""),
                    "nom": item.get("nom") or item.get("name", ""),
                    "secteur": item.get("secteur", ""),
                    "adresse": item.get("adresse", ""),
                    "ville": item.get("ville", ""),
                    "telephone": item.get("telephone", "") or item.get("phone", ""),
                    "email": item.get("email", ""),
                    "site_web": item.get("site_web", "") or item.get("websiteUri", ""),
                    "facebook_url": item.get("facebook_url", ""),
                    "instagram_url": item.get("instagram_url", ""),
                    "linkedin_url": item.get("linkedin_url", ""),
                    "score_ia": score,
                    "evaluation": item.get("evaluation", evaluation),
                    "next_action": next_action,
                    "raison_score": item.get("raison_score", "") or item.get("raison", ""),
                }

                seen_urls.add(dedup_key)
                all_companies.append(company)
                print(f"  [extract_direct] entreprise: {company['nom']} | score={score}")

    total = len(all_prospects) + len(all_companies)
    if total == 0:
        print("[extract_direct] Aucun résultat extrait directement des ToolMessages")
        return {}

    print(
        f"[extract_direct] Extraction directe OK — "
        f"prospects={len(all_prospects)} companies={len(all_companies)}"
    )

    return {
        "search_type": "prospect" if all_prospects else "company",
        "companies": all_companies,
        "prospects": all_prospects,
        "summary": (
            f"{len(all_prospects)} prospect(s) et {len(all_companies)} entreprise(s) "
            f"extraits directement des outils."
        ),
        "tools_used": list(dict.fromkeys(tools_used)),
    }


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

    def _is_quota_error(self, exc: Exception) -> bool:
        return self._is_retryable_error(exc)

    def _retry_delay(self, exc: Exception) -> float:
        return 0.0

    def _next_model(self, current: str) -> str | None:
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
        Synthèse forcée en deux étapes :
        1. Extraction directe depuis les ToolMessages (sans LLM)
        2. Synthèse LLM tronquée (fallback si extraction vide)
        """
        print("[ReactAgent] Tentative extraction directe depuis ToolMessages...")
        direct = _extract_prospects_from_tool_messages(messages)
        if not _is_empty_result(direct):
            print(
                f"[ReactAgent] Extraction directe OK — "
                f"companies={len(direct.get('companies', []))} "
                f"prospects={len(direct.get('prospects', []))}"
            )
            return direct

        print("[ReactAgent] Extraction directe vide — passage à la synthèse LLM")

        tool_results_str = _extract_tool_results(messages)
        ai_text = _get_last_ai_content(messages)

        if not tool_results_str and not ai_text:
            print("[ReactAgent] Synthèse impossible — aucune donnée disponible")
            return {}

        tool_results_str, ai_text = _truncate_for_synthesis(tool_results_str, ai_text)

        context_parts = []
        if tool_results_str:
            context_parts.append("=== RÉSULTATS DES OUTILS ===\n" + tool_results_str)
        if ai_text:
            context_parts.append("=== RÉPONSE DE L'AGENT ===\n" + ai_text)

        raw_data = "\n\n".join(context_parts)
        print(f"[ReactAgent] Synthèse LLM — {len(raw_data)} chars")

        prompt = SYNTHESIS_PROMPT_TEMPLATE.replace("<<<RAW_DATA>>>", raw_data)

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
                    f"[ReactAgent] Synthèse LLM OK ({m}) — "
                    f"companies={len(parsed.get('companies', []))} "
                    f"prospects={len(parsed.get('prospects', []))}"
                )
                return parsed
            except Exception as exc:
                print(f"[ReactAgent] Erreur synthèse LLM ({m}) : {exc}")
                continue

        return {}

    def run(self, raw_input: dict[str, Any]) -> dict[str, Any]:
        started_at = time.perf_counter()

        # ── FIX A : thread_id unique par requête ─────────────────────────────
        # PROBLÈME OBSERVÉ dans les logs :
        #   Session=crm-chat (thread_id fixe) → MemorySaver accumule TOUS les
        #   messages de toutes les requêtes dans la même session.
        #
        #   Quand l'utilisateur tape "trouver des avocats" :
        #   1. Le LLM pose une question au lieu d'appeler un outil
        #   2. all_messages contient AUSSI les ToolMessages de "Responsables RH IT"
        #   3. _extract_prospects_from_tool_messages retourne les RH → FAUX
        #
        # SOLUTION : UUID unique par requête = session mémoire vierge à chaque fois.
        # Chaque appel à run() est complètement isolé.
        # ─────────────────────────────────────────────────────────────────────
        request_thread_id = str(uuid.uuid4())

        query = raw_input.get("query") or raw_input.get("prompt") or ""
        if not query:
            query = self._build_query_from_fields(raw_input)

        config = {"configurable": {"thread_id": request_thread_id}}
        user_message = self._build_user_message(raw_input, query)

        print(f"\n[ReactAgent] thread={request_thread_id[:8]}… modèle={self._active_model}")
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
                    print(f"[DEBUG] parsed companies={companies_count} prospects={prospects_count}")
                    print(f"[DEBUG] content[:300]={content[:300]}")

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

                    print("[ReactAgent] Tous les modèles épuisés")
                    if last_messages:
                        parsed = self._force_synthesis(last_messages, model_tried)
                    else:
                        parsed = {}
                else:
                    print(f"[ReactAgent] Erreur non-retryable : {exc}")
                    if last_messages:
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
                "session_id": request_thread_id,
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