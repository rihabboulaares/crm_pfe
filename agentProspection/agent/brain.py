import os
import re
import json
import logging
import time

from google import genai
from google.genai import types

from agentProspection.agent.lead_classifier import (
    classify_lead_type,
    has_valid_contact_url,
    qualify_entity,
)
from agentProspection.agent.schemas import (
    DecisionSchema,
    EntityAnalysisSchema,
    IntentSchema,
)
from agentProspection.agent.prompts import SYSTEM_PROMPT

logger = logging.getLogger("agentProspection.gemini")

GEMINI_RETRY_DELAYS = (3, 10, 30)


ROLE_KEYWORDS = [
    "responsable rh",
    "responsables rh",
    "directeur rh",
    "directrice rh",
    "drh",
    "rh",
    "recruteur",
    "recruteuse",
    "recrutement",
    "hr",
    "human resources",
    "ceo",
    "cto",
    "founder",
    "fondateur",
    "fondatrice",
    "manager",
    "directeur",
    "directrice",
    "responsable",
    "consultant",
    "commercial",
    "sales",
    "marketing manager",
    "dentiste",
    "médecin",
    "medecin",
    "avocat",
    "architecte",
]

SOURCE_KEYWORDS = {
    "linkedin": ["linkedin"],
    "facebook": ["facebook"],
    "instagram": ["instagram"],
    "general": ["site web", "website", "web", "email", "contact"],
    "maps": ["maps", "google maps", "adresse", "telephone", "téléphone"],
}

LOCATION_KEYWORDS = [
    "tunis",
    "ariana",
    "sousse",
    "sfax",
    "nabeul",
    "bizerte",
    "monastir",
    "mahdia",
    "gabes",
    "gabès",
    "kairouan",
    "hammamet",
    "la marsa",
    "ben arous",
    "djerba",
]

INDUSTRY_KEYWORDS = [
    "startup",
    "startups",
    "it",
    "informatique",
    "software",
    "saas",
    "technologie",
    "tech",
    "restaurant",
    "restaurants",
    "cafe",
    "café",
    "hotel",
    "hotels",
    "hôtel",
    "hôtels",
    "dentiste",
    "dentistes",
    "cabinet dentaire",
    "avocat",
    "avocats",
    "cabinet avocat",
    "architecte",
    "architectes",
    "marketing",
    "agence marketing",
    "agence",
    "agences",
    "pharmacie",
    "pharmacies",
    "clinique",
    "cliniques",
    "garage",
    "garages",
    "salon",
    "coiffure",
    "beaute",
    "beauté",
    "immobilier",
    "agence immobiliere",
    "agence immobilière",
]

STOPWORDS = {
    "trouve",
    "trouver",
    "cherche",
    "chercher",
    "des",
    "les",
    "une",
    "un",
    "de",
    "du",
    "la",
    "le",
    "dans",
    "avec",
    "sur",
    "a",
    "à",
    "en",
    "et",
    "ou",
    "pour",
    "prospect",
    "prospects",
    "entreprise",
    "entreprises",
    "personne",
    "personnes",
    "site",
    "web",
    "website",
    "email",
    "mail",
    "contact",
    "telephone",
    "téléphone",
    "linkedin",
    "facebook",
    "instagram",
    "maps",
    "google",
}


ROLE_ALIASES = {
    "responsables rh": "responsable rh",
    "responsable rh": "responsable rh",
    "directeur rh": "responsable rh",
    "directrice rh": "responsable rh",
    "drh": "responsable rh",
    "rh": "responsable rh",
    "hr": "responsable rh",
    "human resources": "responsable rh",
    "recruteur": "recruteur",
    "recruteuse": "recruteur",
    "recrutement": "recruteur",
    "ceo": "ceo",
    "cto": "cto",
    "founder": "fondateur",
    "fondateur": "fondateur",
    "fondatrice": "fondateur",
    "manager": "manager",
    "directeur": "directeur",
    "directrice": "directeur",
    "responsable": "responsable",
    "consultant": "consultant",
    "commercial": "commercial",
    "sales": "commercial",
    "marketing manager": "responsable marketing",
    "dentiste": "dentiste",
    "médecin": "médecin",
    "medecin": "médecin",
    "avocat": "avocat",
    "architecte": "architecte",
}


INDUSTRY_ALIASES = {
    "startups": "startup",
    "startup": "startup",
    "it": "IT",
    "informatique": "IT",
    "software": "IT",
    "saas": "SaaS",
    "technologie": "IT",
    "tech": "IT",
    "restaurants": "restaurant",
    "restaurant": "restaurant",
    "cafe": "café",
    "café": "café",
    "hotels": "hôtel",
    "hotel": "hôtel",
    "hôtel": "hôtel",
    "hôtels": "hôtel",
    "dentistes": "dentiste",
    "dentiste": "dentiste",
    "cabinet dentaire": "dentiste",
    "avocats": "avocat",
    "avocat": "avocat",
    "cabinet avocat": "avocat",
    "architectes": "architecte",
    "architecte": "architecte",
    "agence marketing": "marketing",
    "marketing": "marketing",
    "agences": "agence",
    "agence": "agence",
    "pharmacies": "pharmacie",
    "pharmacie": "pharmacie",
    "cliniques": "clinique",
    "clinique": "clinique",
    "garages": "garage",
    "garage": "garage",
    "salon": "salon",
    "coiffure": "coiffure",
    "beaute": "beauté",
    "beauté": "beauté",
    "immobilier": "immobilier",
    "agence immobiliere": "immobilier",
    "agence immobilière": "immobilier",
}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").lower()).strip()


def dedupe(values: list[str]) -> list[str]:
    result = []
    seen = set()

    for value in values:
        value = str(value or "").strip()

        if not value:
            continue

        key = value.lower()

        if key in seen:
            continue

        seen.add(key)
        result.append(value)

    return result


def parse_json_text(text: str) -> dict:
    value = (text or "").strip()

    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?", "", value, flags=re.IGNORECASE).strip()
        value = re.sub(r"```$", "", value).strip()

    return json.loads(value)


def ensure_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def repair_decision_payload(data) -> dict:
    if isinstance(data, list):
        data = data[0] if data else {}
    if not isinstance(data, dict):
        data = {}

    decision = data.get("decision") or data.get("action") or "analyze_entities"
    target_urls = (
        data.get("target_urls")
        or data.get("urls")
        or data.get("target")
        or data.get("targets")
        or data.get("target_url")
        or []
    )

    return {
        "decision": str(decision or "analyze_entities"),
        "tool": data.get("tool") or data.get("next_tool") or "",
        "query": data.get("query") or data.get("next_query") or "",
        "target_urls": ensure_list(target_urls),
        "reason": data.get("reason") or data.get("rationale") or "",
        "confidence": data.get("confidence") or 0.5,
    }


def score_to_evaluation(score: int) -> str:
    if score >= 70:
        return "hot"
    if score >= 40:
        return "warm"
    return "cold"


def repair_analysis_payload(data) -> dict:
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = (
            data.get("entities")
            or data.get("analysis")
            or data.get("analyses")
            or data.get("results")
            or data.get("items")
            or []
        )
    else:
        items = []

    repaired = []
    for position, item in enumerate(ensure_list(items)):
        if not isinstance(item, dict):
            continue

        raw_index = (
            item.get("index")
            if item.get("index") is not None
            else item.get("entity_index")
            if item.get("entity_index") is not None
            else item.get("id")
        )
        try:
            index = int(raw_index)
        except Exception:
            index = position

        score = item.get("lead_score", item.get("score", item.get("score_ia", 0)))
        try:
            score = int(score or 0)
        except Exception:
            score = 0

        is_valid = item.get("is_valid")
        if is_valid is None:
            is_valid = item.get("valid")
        if is_valid is None:
            is_valid = item.get("relevant")
        if is_valid is None:
            is_valid = bool(score >= 40 or item.get("crm_ready"))

        cleaned_data = item.get("cleaned_data") or item.get("data") or {}
        if not isinstance(cleaned_data, dict):
            cleaned_data = {}

        repaired.append({
            "index": index,
            "is_valid": bool(is_valid),
            "entity_type": item.get("entity_type") or item.get("lead_type") or "company",
            "lead_score": max(0, min(score, 100)),
            "evaluation": item.get("evaluation") or score_to_evaluation(score),
            "reason": item.get("reason") or item.get("rationale") or item.get("evaluation_reason") or "",
            "crm_ready": bool(item.get("crm_ready")),
            "enrichment_status": item.get("enrichment_status") or "needs_enrichment",
            "qualification_reasons": item.get("qualification_reasons") or [],
            "rejection_reason": item.get("rejection_reason") or "",
            "cleaned_data": cleaned_data,
        })

    return {"entities": repaired}


def normalize_source_name(source: str) -> str | None:
    value = normalize_text(source).replace("-", "_")

    mapping = {
        "serper_linkedin": "linkedin",
        "linkedin": "linkedin",
        "linked_in": "linkedin",
        "serper_facebook": "facebook",
        "facebook": "facebook",
        "serper_instagram": "instagram",
        "instagram": "instagram",
        "serper_general": "general",
        "general": "general",
        "website": "general",
        "web": "general",
        "site_web": "general",
        "email": "general",
        "maps_search": "maps",
        "google_maps": "maps",
        "maps": "maps",
    }

    return mapping.get(value)


def extract_locations(query: str) -> list[str]:
    q = normalize_text(query)
    found = []

    for loc in LOCATION_KEYWORDS:
        if re.search(rf"\b{re.escape(loc)}\b", q):
            found.append(loc.title())

    return dedupe(found)


def extract_sources(query: str) -> list[str]:
    q = normalize_text(query)
    sources = []

    for source, keywords in SOURCE_KEYWORDS.items():
        if any(keyword in q for keyword in keywords):
            sources.append(source)

    if not sources:
        sources = ["general"]

    return dedupe(sources)


def extract_roles(query: str) -> list[str]:
    q = normalize_text(query)
    found = []

    for role in ROLE_KEYWORDS:
        if re.search(rf"\b{re.escape(role)}\b", q):
            found.append(ROLE_ALIASES.get(role, role))

    return dedupe(found)


def extract_industries(query: str) -> list[str]:
    q = normalize_text(query)
    found = []

    for keyword in INDUSTRY_KEYWORDS:
        if re.search(rf"\b{re.escape(keyword)}\b", q):
            found.append(INDUSTRY_ALIASES.get(keyword, keyword))

    cleaned = []

    for item in found:
        if normalize_text(item) in STOPWORDS:
            continue

        cleaned.append(item)

    if cleaned:
        return dedupe(cleaned)

    words = re.sub(r"[^a-zA-ZÀ-ÿ0-9\s]", " ", q).split()
    candidates = []

    for word in words:
        if word in STOPWORDS:
            continue

        if len(word) <= 2:
            continue

        candidates.append(word)

    return dedupe(candidates[:2])


def detect_lead_types(query: str) -> list[str]:
    q = normalize_text(query)
    roles = extract_roles(q)

    if roles:
        return ["person", "company"]

    person_terms = [
        "responsable",
        "directeur",
        "manager",
        "recruteur",
        "consultant",
        "coach",
        "fondateur",
        "ceo",
        "cto",
        "rh",
        "drh",
    ]

    if any(term in q for term in person_terms):
        return ["person", "company"]

    return ["company"]


def clean_gemini_intent(data: dict, original_query: str) -> dict:
    fallback = local_intent_parser(original_query)

    industries = data.get("industries") or fallback["industries"]
    locations = data.get("locations") or fallback["locations"]
    sources = data.get("sources") or fallback["sources"]
    lead_types = data.get("lead_types") or fallback["lead_types"]
    target_roles = data.get("target_roles") or fallback["target_roles"]

    cleaned_industries = []

    for industry in industries:
        text = normalize_text(industry)

        parts = [
            word
            for word in re.split(r"\s+", text)
            if word not in STOPWORDS
        ]

        cleaned = " ".join(parts).strip()

        if cleaned:
            cleaned_industries.append(INDUSTRY_ALIASES.get(cleaned, cleaned))

    if not cleaned_industries:
        cleaned_industries = fallback["industries"]

    normalized_sources = []
    for source in sources:
        normalized = normalize_source_name(source)
        if normalized:
            normalized_sources.append(normalized)

    if not normalized_sources:
        normalized_sources = fallback["sources"]

    return {
        "objective": "prospection",
        "lead_types": dedupe(lead_types),
        "industries": dedupe(cleaned_industries),
        "locations": dedupe(locations),
        "target_roles": dedupe(target_roles),
        "sources": dedupe(normalized_sources),
        "max_leads": min(int(data.get("max_leads") or 10), 10),
        "reasoning_summary": data.get("reasoning_summary") or "",
    }


def local_intent_parser(query: str) -> dict:
    industries = extract_industries(query)
    locations = extract_locations(query)
    sources = extract_sources(query)
    roles = extract_roles(query)
    lead_types = detect_lead_types(query)

    if not industries:
        industries = ["business"]

    if not locations:
        locations = ["Tunisie"]

    if "company" in lead_types:
        physical_terms = {
            "restaurant",
            "hôtel",
            "hotel",
            "café",
            "cafe",
            "dentiste",
            "avocat",
            "pharmacie",
            "clinique",
            "garage",
            "salon",
        }

        if any(normalize_text(ind) in physical_terms for ind in industries):
            if "maps" not in sources:
                sources.insert(0, "maps")

    if "person" in lead_types:
        if "linkedin" not in sources:
            sources.insert(0, "linkedin")

        if "general" not in sources:
            sources.append("general")

    return {
        "objective": "prospection",
        "lead_types": lead_types,
        "industries": industries,
        "locations": locations,
        "target_roles": roles,
        "sources": sources,
        "max_leads": 10,
        "reasoning_summary": "Intent extrait localement car Gemini est indisponible.",
    }


def compact_json(data) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def gemini_error_text(exc: Exception) -> str:
    parts = [str(exc)]
    for attr in ("code", "status_code", "message"):
        value = getattr(exc, attr, None)
        if value:
            parts.append(str(value))
    return " ".join(parts)


def is_retryable_gemini_error(exc: Exception) -> bool:
    text = gemini_error_text(exc).lower()
    return any(
        marker in text
        for marker in (
            "429",
            "too many requests",
            "resource_exhausted",
            "quota",
            "503",
            "unavailable",
            "timeout",
            "timed out",
            "connection",
            "network",
            "temporarily",
        )
    )


def safe_gemini_generate(
    prompt: str,
    client=None,
    model: str | None = None,
    schema=None,
    response_mime_type: str = "application/json",
) -> dict:
    if not client:
        logger.warning("Gemini indisponible - fallback local activé")
        return {
            "success": False,
            "text": "",
            "error": "Gemini client unavailable",
            "fallback": True,
        }

    config_kwargs = {"response_mime_type": response_mime_type}
    if schema is not None:
        config_kwargs["response_schema"] = schema
    config = types.GenerateContentConfig(**config_kwargs)

    last_error = None
    attempts = len(GEMINI_RETRY_DELAYS) + 1

    for attempt in range(attempts):
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
            return {
                "success": True,
                "text": getattr(response, "text", "") or "",
                "error": None,
                "fallback": False,
            }
        except Exception as exc:
            last_error = exc
            if not is_retryable_gemini_error(exc) or attempt >= len(GEMINI_RETRY_DELAYS):
                break

            if "429" in gemini_error_text(exc) or "quota" in gemini_error_text(exc).lower():
                logger.warning("Gemini rate limit atteint - retry en cours")
            else:
                logger.warning("Gemini indisponible - retry en cours")
            time.sleep(GEMINI_RETRY_DELAYS[attempt])

    logger.warning("Gemini indisponible - fallback local activé")
    return {
        "success": False,
        "text": "",
        "error": gemini_error_text(last_error)[:500] if last_error else "gemini_unavailable",
        "fallback": True,
    }


def local_search_query(intent: dict) -> str:
    industries = intent.get("industries") or ["business"]
    locations = intent.get("locations") or ["Tunisie"]
    roles = intent.get("target_roles") or []

    industry = " ".join(industries[:2]).strip()
    location = locations[0]
    role = " ".join(roles[:2]).strip()

    if role:
        return f"{role} {industry} {location}".strip()
    return f"{industry} {location}".strip()


def local_decision_from_memory(memory_summary: dict, error: str | None = None) -> dict:
    intent = memory_summary.get("intent") or local_intent_parser(memory_summary.get("query") or "")
    pending_urls = memory_summary.get("pending_urls") or []
    valid_count = int(memory_summary.get("valid_leads_count") or 0)
    companies_count = int(memory_summary.get("companies_count") or 0)
    persons_count = int(memory_summary.get("persons_count") or 0)
    entity_samples = (memory_summary.get("companies_sample") or []) + (memory_summary.get("persons_sample") or [])
    needs_batch_analysis = (companies_count or persons_count) and (
        not entity_samples or any(not item.get("gemini_analyzed") for item in entity_samples)
    )
    tools_used = memory_summary.get("tools_used") or []
    used_tool_names = {item.get("tool") for item in tools_used if item.get("tool")}

    if needs_batch_analysis:
        return {
            "decision": "analyze_entities",
            "tool": "",
            "query": "",
            "target_urls": [],
            "reason": "Fallback local: analyser le batch d'entites avant import CRM.",
            "confidence": 0.7,
            "gemini_error": error,
            "fallback_local": bool(error),
        }

    if valid_count > 0:
        return {
            "decision": "import_crm",
            "tool": "crm_importer",
            "query": "",
            "target_urls": [],
            "reason": "Fallback local: des prospects sont prêts pour import CRM.",
            "confidence": 0.75,
            "gemini_error": error,
            "fallback_local": bool(error),
        }

    if pending_urls:
        return {
            "decision": "crawl_urls",
            "tool": "playwright_profile_scraper",
            "query": "",
            "target_urls": [item.get("url") for item in pending_urls[:3] if item.get("url")],
            "reason": "Fallback local: crawler les URLs deja trouvees.",
            "confidence": 0.65,
            "gemini_error": error,
            "fallback_local": bool(error),
        }

    source_to_tool = {
        "maps": "maps_search",
        "linkedin": "serper_linkedin",
        "facebook": "serper_facebook",
        "instagram": "serper_instagram",
        "general": "serper_general",
    }
    for source in intent.get("sources") or ["general"]:
        tool = source_to_tool.get(source, "serper_general")
        if tool not in used_tool_names:
            return {
                "decision": "use_tool",
                "tool": tool,
                "query": local_search_query(intent),
                "target_urls": [],
                "reason": "Fallback local: lancer la prochaine source de recherche.",
                "confidence": 0.65,
                "gemini_error": error,
                "fallback_local": bool(error),
            }

    return {
        "decision": "import_crm" if valid_count else "analyze_entities",
        "tool": "crm_importer" if valid_count else "",
        "query": "",
        "target_urls": [],
        "reason": "Fallback local: finaliser les prospects trouves sans arret lie a Gemini.",
        "confidence": 0.55,
        "gemini_error": error,
        "fallback_local": bool(error),
    }


def first_search_query(intent: dict, source: str) -> str:
    industries = intent.get("industries") or ["business"]
    locations = intent.get("locations") or ["Tunisie"]
    roles = intent.get("target_roles") or []

    industry = " ".join(industries[:2]).strip()
    location = locations[0]
    role = " ".join(roles[:2]).strip()

    people_query = f"{role} {industry} {location}".strip() if role else f"{industry} {location}".strip()

    if source == "linkedin":
        if role:
            return f"site:linkedin.com/in {people_query}"
        return f"site:linkedin.com/company {industry} {location}"
    if source == "facebook":
        return f"site:facebook.com {industry} {location} page officielle"
    if source == "instagram":
        return f"site:instagram.com {industry} {location}"
    if source == "maps":
        return f"{industry} {location}".strip()

    if role:
        return f"{people_query} email contact site web"
    return f"{industry} {location} site officiel contact"


class GeminiBrainBase:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    def fallback_intent(self, query: str) -> dict:
        return local_intent_parser(query)

    async def extract_intent(self, query: str) -> dict:
        if not self.client:
            return self.fallback_intent(query)

        prompt = f"""
{SYSTEM_PROMPT}

Demande utilisateur :
{query}

Tu dois extraire :
- objectif
- types de leads recherchés
- secteur ou métier
- localisation
- sources utiles
- nombre maximum de leads

Règles :
- Ne limite jamais aux restaurants ou dentistes.
- Ne mets jamais "email", "site web", "facebook", "linkedin", "instagram" dans industries.
- Si la demande vise RH, CEO, CTO, manager, recruteur, responsable : lead_types doit contenir "person".
- Si la demande vise restaurants, hôtels, cliniques, pharmacies, dentistes, avocats : source maps utile.
- Retourne uniquement du JSON valide.
"""

        try:
            response = safe_gemini_generate(
                prompt,
                client=self.client,
                model=self.model,
                schema=IntentSchema,
            )
            if not response.get("success"):
                raise RuntimeError(response.get("error") or "gemini_unavailable")

            data = IntentSchema.model_validate_json(response.get("text") or "{}").model_dump()
            return clean_gemini_intent(data, query)

        except Exception as e:
            data = self.fallback_intent(query)
            data["gemini_error"] = str(e)[:400]
            return data

    async def decide_next_action(self, memory) -> dict:
        # Pour éviter quota Gemini : décision locale suffisante.
        total_leads = len(getattr(memory, "companies", []) or []) + len(getattr(memory, "persons", []) or [])
        plan = memory.plan or {}
        max_leads = plan.get("stop_conditions", {}).get("max_prospects", 10)

        pending_urls = any(
            not item.get("crawled")
            for item in getattr(memory, "crawl_queue", []) or []
        )

        if total_leads >= max_leads and not pending_urls:
            return {
                "decision": "enough_data",
                "next_tool": "",
                "next_query": "",
                "reason": "Nombre suffisant de leads et aucune URL restante.",
                "confidence": 1.0,
            }

        return {
            "decision": "continue",
            "next_tool": "",
            "next_query": "",
            "reason": "Continuer le plan local.",
            "confidence": 0.7,
        }


class GeminiBrain(GeminiBrainBase):
    def generate_json(self, prompt: str, schema=None):
        response = safe_gemini_generate(
            prompt,
            client=self.client,
            model=self.model,
            schema=schema,
        )
        if not response.get("success"):
            raise RuntimeError(response.get("error") or "gemini_unavailable")
        return response.get("text") or ""

    def fallback_decision(self, memory_summary: dict, error: str | None = None) -> dict:
        logger.warning("Gemini indisponible - fallback local activé")
        return local_decision_from_memory(memory_summary, error=error)

    async def decide_next_action(self, memory_summary: dict) -> dict:
        return local_decision_from_memory(memory_summary)

        if not self.client:
            return self.fallback_decision(memory_summary, "Gemini client unavailable")

        if (memory_summary.get("companies_count") or 0) or (memory_summary.get("persons_count") or 0):
            return local_decision_from_memory(memory_summary)

        if memory_summary.get("pending_urls"):
            return local_decision_from_memory(memory_summary)

        prompt = f"""
{SYSTEM_PROMPT}

Tu es le cerveau principal d'un agent de prospection. Tu controles la boucle.

Tools disponibles et noms exacts :
- maps_search : recherche Google Maps / Places pour entreprises physiques.
- serper_linkedin : recherche Google sur LinkedIn.
- serper_facebook : recherche Google sur Facebook.
- serper_instagram : recherche Google sur Instagram.
- serper_general : recherche web generale.
- playwright_profile_scraper : scrape uniquement des URLs LinkedIn/Facebook/Instagram deja trouvees.
- website_scraper : scrape uniquement des sites web deja trouves.
- crm_importer : importe les entites deja analysees.

Decisions autorisees :
- use_tool : renseigne tool et query.
- crawl_urls : renseigne tool et target_urls.
- analyze_entities : quand les donnees doivent etre qualifiees/scorees.
- import_crm : quand les entites crm_ready suffisent.
- stop : quand il faut arreter sans importer.

Priorite de decision :
1. Si aucune recherche n'a ete faite, choisis la meilleure source initiale.
2. Si des URLs fiables sont decouvertes et non crawlees, choisis crawl_urls.
3. Si des entites brutes existent mais ne sont pas analysees, choisis analyze_entities.
4. Si des entites crm_ready existent, choisis import_crm.
5. Si une source ne donne rien, change de requete ou de source.
6. Ne stoppe jamais uniquement parce que Gemini/API est indisponible ou en quota : utilise le fallback local.

JSON attendu exactement :
{{
  "decision": "use_tool|crawl_urls|analyze_entities|import_crm|stop",
  "tool": "nom_tool_ou_chaine_vide",
  "query": "requete_ou_chaine_vide",
  "target_urls": [],
  "reason": "raison courte",
  "confidence": 0.0
}}

Contraintes :
- Tu choisis une seule prochaine action.
- N'utilise jamais null. Si un champ est inutile, mets "" ou [].
- Pour serper_linkedin, serper_facebook et serper_instagram, n'ajoute jamais site:... dans query : le tool ajoute deja le filtre.
- Les query doivent etre des mots-cles metier/localisation/role, pas des operateurs Google complexes.
- Playwright ne doit crawler que des URLs presentes dans pending_urls/urls_found.
- Evite annuaires, jobs, blogs, PDF, TikTok, Scribd, YouTube, Threads.
- Si peu de donnees, change de source ou enrichis les URLs.
- Si max_leads est atteint, analyse puis importe.
- N'utilise import_crm que si des entites ont deja crm_ready=true dans la memoire.
- N'utilise analyze_entities qu'apres au moins un resultat brut, une entreprise ou une personne.
- Si Serper a trouve un profil pertinent, ne le rejette pas parce que le crawl Playwright est bloque.
- Email et telephone sont des bonus, jamais des prerequis de decision.
- Retourne uniquement un JSON valide compatible avec DecisionSchema.

Memoire resumee :
{compact_json(memory_summary)}
"""

        try:
            text = self.generate_json(prompt)
            data = parse_json_text(text)
            data = repair_decision_payload(data)
            return DecisionSchema.model_validate(data).model_dump()
        except Exception as exc:
            return self.fallback_decision(memory_summary, str(exc)[:400])

    def fallback_analysis(
        self,
        entities: list[dict],
        reason: str | None = None,
        memory_summary: dict | None = None,
    ) -> dict:
        logger.warning("Gemini indisponible - fallback local activé")
        intent = (memory_summary or {}).get("intent") or {}
        fallback_entities = []

        for index, entity in enumerate(entities[:30]):
            local_entity = dict(entity or {})
            qualify_entity(local_entity, intent)
            entity_type = local_entity.get("lead_type") or classify_lead_type(local_entity)
            score = int(local_entity.get("lead_score") or local_entity.get("score") or 0)
            has_source = has_valid_contact_url(local_entity)
            is_valid = bool(local_entity.get("is_valid") or has_source)
            crm_ready = bool(local_entity.get("crm_ready") or has_source)
            evaluation = local_entity.get("evaluation") or ("warm" if score >= 40 else "cold")
            fallback_reason = (
                "review_needed: analyse IA indisponible, qualification locale appliquee. "
                f"{reason or 'Gemini unavailable'}"
            )

            fallback_entities.append(
                {
                    "index": index,
                    "is_valid": is_valid,
                    "entity_type": entity_type or "company",
                    "lead_score": score,
                    "evaluation": evaluation,
                    "reason": fallback_reason,
                    "crm_ready": crm_ready,
                    "enrichment_status": local_entity.get("enrichment_status") or "needs_enrichment",
                    "qualification_reasons": list(local_entity.get("qualification_reasons") or []),
                    "rejection_reason": "" if is_valid else "local_review_needed",
                    "cleaned_data": {
                        "analysis_status": "review_needed",
                        "gemini_analyzed": True,
                        "raison_score": fallback_reason,
                        "enrichment_status": local_entity.get("enrichment_status") or "needs_enrichment",
                    },
                }
            )

        return {
            "entities": fallback_entities,
            "gemini_required": True,
            "gemini_error": reason or "Gemini analysis unavailable",
            "analysis_status": "review_needed",
        }

    async def analyze_entities(self, entities: list[dict], memory_summary: dict) -> dict:
        if not entities:
            return {"entities": []}

        if not self.client:
            return self.fallback_analysis(entities, "Gemini indisponible.", memory_summary)

        indexed_entities = [
            {"index": index, "data": entity}
            for index, entity in enumerate(entities[:30])
        ]

        prompt = f"""
{SYSTEM_PROMPT}

Analyse ces entites scrapees/recherchees pour la prospection.
Pour chaque index, decide :
- est-ce un vrai prospect ou une vraie entreprise ?
- est-ce pertinent pour la requete et l'intent ?
- score 0-100, evaluation hot/warm/cold, crm_ready.
- nettoie uniquement les champs fiables dans cleaned_data si necessaire.
- IMPORTANT : ne rejette jamais un prospect uniquement parce qu'il n'a pas d'email ou de telephone.
- Un profil LinkedIn, Facebook, Instagram, Google Maps ou site web fiable peut suffire pour accepter un prospect.
- Email et telephone sont des bonus d'enrichissement, pas des conditions de validation.
- Mets is_valid=true et crm_ready=true si le prospect correspond a l'intention et possede une URL fiable, meme sans email/telephone.
- Mets enrichment_status="needs_enrichment" quand email et telephone sont absents.
- Ne confonds pas scraping bloque avec prospect invalide : si la source Serper/snippet est fiable, accepte le prospect et explique que l'enrichissement reste a faire.
- Si une page crawlee est login/captcha/vide, juge le scrape comme faible mais conserve les donnees fiables deja connues.
- Pour une personne, garde first_name et last_name sous 50 caracteres chacun.
- Pour un title, garde une formulation courte sous 100 caracteres.

JSON attendu exactement :
{{
  "entities": [
    {{
      "index": 0,
      "is_valid": true,
      "entity_type": "person|company",
      "lead_score": 0,
      "evaluation": "hot|warm|cold",
      "reason": "raison courte",
      "crm_ready": true,
      "enrichment_status": "enriched|needs_enrichment",
      "qualification_reasons": [],
      "rejection_reason": "",
      "cleaned_data": {{}}
    }}
  ]
}}

Regles de format :
- Retourne un objet avec la cle "entities".
- Utilise les index fournis dans Entites indexees.
- N'utilise jamais null. Utilise false, "", [] ou {{}}.

Rejette les annuaires, jobs, blogs, PDF et reseaux non autorises.
Retourne uniquement JSON valide compatible avec EntityAnalysisSchema.

Memoire :
{compact_json(memory_summary)}

Entites indexees :
{compact_json(indexed_entities)}
"""

        try:
            text = self.generate_json(prompt)
            data = parse_json_text(text)
            data = repair_analysis_payload(data)
            return EntityAnalysisSchema.model_validate(data).model_dump()
        except Exception as exc:
            return self.fallback_analysis(entities, str(exc)[:400], memory_summary)
