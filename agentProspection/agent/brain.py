import asyncio
import logging
import os
import re
import time
import unicodedata
from dataclasses import dataclass

from django.conf import settings
from google import genai
from google.genai import types

from agentProspection.agent.prompts import (
    SYSTEM_PROMPT,
    build_decision_prompt,
    build_validation_prompt,
)

from agentProspection.agent.schemas import (
    AgentDecision,
    IntentSchema,
    ValidationBatch,
)

from agentProspection.agent.tool_registry import (
    normalize_source_name,
    source_to_tool,
)


logger = logging.getLogger(
    "agentProspection.gemini"
)


# ============================================================
# CONSTANTS
# ============================================================

GEMINI_STATUS_SUCCESS = "success"
GEMINI_STATUS_RATE_LIMITED = "rate_limited"
GEMINI_STATUS_UNAVAILABLE = "unavailable"
GEMINI_STATUS_INVALID_RESPONSE = "invalid_response"

DEFAULT_COUNTRY = "Tunisie"
DEFAULT_COUNTRY_CODE = "TN"

MAX_META_ADS_QUERIES = 6
MAX_INTENT_SEARCH_KEYWORDS = 3
MAX_META_SEARCH_KEYWORDS = 6
MIN_META_QUERY_LENGTH = 3


# ============================================================
# RUNTIME STATE
# ============================================================

@dataclass
class GeminiRuntimeState:
    status: str = GEMINI_STATUS_UNAVAILABLE
    calls: int = 0
    last_error: str = ""


# ============================================================
# CIRCUIT BREAKER
# ============================================================

class GeminiCircuitBreaker:
    """
    Empêche de rappeler immédiatement Gemini après un 429.

    Important :
    ce circuit breaker concerne les appels Gemini du process
    courant uniquement.

    Il ne constitue pas un fallback métier.
    """

    def __init__(self):
        self.opened_until = 0.0

    def is_open(
        self,
    ) -> bool:
        return (
            time.monotonic()
            < self.opened_until
        )

    def remaining_seconds(
        self,
    ) -> int:
        return max(
            0,
            round(
                self.opened_until
                - time.monotonic()
            ),
        )

    def record_success(
        self,
    ):
        self.opened_until = 0.0

    def record_rate_limit(
        self,
    ):
        cooldown = int(
            getattr(
                settings,
                "PROSPECTION_GEMINI_CIRCUIT_COOLDOWN_SECONDS",
                300,
            )
            or 300
        )

        self.opened_until = (
            time.monotonic()
            + max(
                1,
                cooldown,
            )
        )


GEMINI_CIRCUIT_BREAKER = (
    GeminiCircuitBreaker()
)


# ============================================================
# LOCATION
# ============================================================

FOREIGN_LOCATION_ALIASES = {
    "france",
    "paris",
    "lyon",
    "marseille",
    "italie",
    "italy",
    "allemagne",
    "germany",
    "espagne",
    "spain",
    "royaume uni",
    "united kingdom",
    "uk",
    "etats unis",
    "etats-unis",
    "états unis",
    "united states",
    "usa",
    "canada",
    "maroc",
    "morocco",
    "algerie",
    "algérie",
    "algeria",
}


TUNISIA_ALIASES = {
    "tunisie",
    "tunisia",
    "tunis",
    "ariana",
    "sousse",
    "sfax",
    "nabeul",
    "bizerte",
    "monastir",
    "mahdia",
    "kairouan",
    "hammamet",
    "djerba",
    "gabes",
    "gabès",
    "ben arous",
    "manouba",
}


# ============================================================
# NORMALIZATION
# ============================================================

def normalize_text(
    value: str | None,
) -> str:
    return re.sub(
        r"\s+",
        " ",
        str(
            value or ""
        )
        .lower()
        .strip(),
    )


def normalize_plain(
    value: str | None,
) -> str:
    text = unicodedata.normalize(
        "NFKD",
        str(
            value or ""
        ),
    )

    text = "".join(
        char
        for char in text
        if not unicodedata.combining(
            char
        )
    )

    text = text.lower()

    text = re.sub(
        r"[^a-z0-9\s'-]",
        " ",
        text,
    )

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def dedupe(
    values,
) -> list[str]:
    result = []
    seen = set()

    for value in (
        values
        or []
    ):
        text = str(
            value
            or ""
        ).strip()

        if not text:
            continue

        key = normalize_plain(
            text
        )

        if (
            not key
            or key in seen
        ):
            continue

        seen.add(
            key
        )

        result.append(
            text
        )

    return result


# ============================================================
# TUNISIA SCOPE
# ============================================================

def query_requests_foreign_location(
    query: str,
) -> str | None:
    normalized = normalize_plain(
        query
    )

    for alias in (
        FOREIGN_LOCATION_ALIASES
    ):
        alias_normalized = (
            normalize_plain(
                alias
            )
        )

        if re.search(
            rf"\b{re.escape(alias_normalized)}\b",
            normalized,
        ):
            return alias

    return None


def enforce_tunisia_scope(
    intent: dict,
) -> dict:
    intent = dict(
        intent
        or {}
    )

    locations = dedupe(
        intent.get(
            "locations"
        )
        or []
    )

    if not locations:
        locations = [
            DEFAULT_COUNTRY
        ]

    intent[
        "locations"
    ] = locations

    return intent


# ============================================================
# INTENT CLEANUP
# ============================================================

def clean_gemini_intent(
    data: dict,
) -> dict:
    """
    Nettoie l'intention produite par Gemini.

    Important :
    search_keywords est conservé car il permet
    au DiscoveryAgent de fonctionner dans n'importe
    quel domaine sans table métier codée en dur.
    """

    lead_types = dedupe(
        data.get(
            "lead_types"
        )
        or []
    )

    industries = dedupe(
        data.get(
            "industries"
        )
        or []
    )

    locations = dedupe(
        data.get(
            "locations"
        )
        or []
    )

    target_roles = dedupe(
        data.get(
            "target_roles"
        )
        or []
    )

    search_keywords = dedupe(
        data.get(
            "search_keywords"
        )
        or []
    )[:MAX_INTENT_SEARCH_KEYWORDS]

    meta_search_keywords = dedupe(
        data.get(
            "meta_search_keywords"
        )
        or []
    )[:MAX_META_SEARCH_KEYWORDS]

    # ========================================================
    # SOURCES
    # ========================================================

    sources = []

    for source in (
        data.get(
            "sources"
        )
        or []
    ):
        normalized = (
            normalize_source_name(
                source
            )
        )

        if (
            normalized
            and normalized
            not in sources
        ):
            sources.append(
                normalized
            )

    sources = (
        sources[:2]
    )

    # ========================================================
    # LEAD TYPE
    # ========================================================

    if len(
        lead_types
    ) != 1:
        raise ValueError(
            "Intent Gemini invalide : "
            "un seul lead_type est requis."
        )

    lead_type = (
        lead_types[0]
    )

    if lead_type not in {
        "person",
        "company",
    }:
        raise ValueError(
            "Intent Gemini invalide : "
            "lead_type non supporté."
        )

    if (
        lead_type
        == "company"
    ):
        target_roles = []

    if (
        lead_type
        == "person"
    ):
        sources = [
            source
            for source
            in sources
            if source
            not in {
                "maps",
                "meta_ads",
            }
        ]

    # ========================================================
    # MAX LEADS
    # ========================================================

    try:
        max_leads = int(
            data.get(
                "max_leads"
            )
            or 10
        )

    except (
        TypeError,
        ValueError,
    ):
        max_leads = 10

    max_leads = max(
        1,
        min(
            max_leads,
            50,
        ),
    )

    # ========================================================
    # FINAL INTENT
    # ========================================================

    intent = {
        "objective":
            "prospection",

        "lead_types":
            [
                lead_type
            ],

        "industries":
            industries,

        "locations":
            locations,

        "target_roles":
            target_roles,

        "sources":
            sources,

        "search_keywords":
            search_keywords,

        # Réservé à Meta Ads : aucun autre outil ne consomme ce champ.
        "meta_search_keywords":
            (
                meta_search_keywords
                if "meta_ads" in sources
                else []
            ),

        "source_forced":
            bool(
                data.get(
                    "source_forced",
                    False,
                )
            ),

        "max_leads":
            max_leads,

        "reasoning_summary":
            str(
                data.get(
                    "reasoning_summary"
                )
                or ""
            ).strip()[:500],
    }

    return enforce_tunisia_scope(
        intent
    )


# ============================================================
# META ADS COUNTRY
# ============================================================

def meta_ads_country_codes(
    intent: dict,
) -> list[str]:
    """
    Retourne les codes pays acceptés par Meta Ads Library.

    L'application reste volontairement limitée à la Tunisie.
    Cette fonction centralise néanmoins la logique afin d'éviter
    les codes pays écrits en dur dans plusieurs endroits.
    """

    locations = dedupe(
        intent.get("locations")
        or []
    )

    # `enforce_tunisia_scope()` garantit déjà la présence de la
    # Tunisie quand aucune localisation n'est fournie. On garde
    # néanmoins un contrôle défensif ici.
    if not locations:
        return [DEFAULT_COUNTRY_CODE]

    for location in locations:
        normalized = normalize_plain(location)

        if any(
            re.search(
                rf"\b{re.escape(normalize_plain(alias))}\b",
                normalized,
            )
            for alias in TUNISIA_ALIASES
        ):
            return [DEFAULT_COUNTRY_CODE]

    # Le périmètre métier actuel est la Tunisie uniquement.
    return [DEFAULT_COUNTRY_CODE]


# ============================================================
# META ADS QUERIES
# ============================================================

def _meta_query_quality_key(value: str) -> tuple[int, int, str]:
    """
    Clé de tri simple pour privilégier les requêtes Meta Ads
    les plus descriptives sans utiliser de dictionnaire métier.

    Priorité :
    - expressions de plusieurs mots ;
    - longueur raisonnable ;
    - ordre alphabétique uniquement comme dernier critère stable.
    """

    normalized = normalize_plain(value)
    words = [
        word
        for word in normalized.split()
        if word
    ]

    return (
        1 if len(words) >= 2 else 0,
        min(len(normalized), 80),
        normalized,
    )


def build_meta_ads_queries(
    intent: dict,
    max_queries: int = MAX_META_ADS_QUERIES,
) -> list[str]:
    """
    Retourne les requêtes Meta Ads préparées par Gemini.

    Principe :
    - Gemini comprend le métier et génère `meta_search_keywords` ;
    - Python NE fabrique aucun synonyme ;
    - Python NE combine jamais automatiquement secteur + mot-clé ;
    - Python se limite au nettoyage, à la déduplication et aux limites.

    Cela évite les requêtes artificielles du type :
    "secteur + mot générique".

    Fallback de sécurité :
    si Gemini n'a fourni aucune variante Meta, on utilise le secteur
    exact, puis seulement le premier search_keyword historique.
    """

    try:
        limit = int(
            max_queries
            or MAX_META_ADS_QUERIES
        )
    except (TypeError, ValueError):
        limit = MAX_META_ADS_QUERIES

    limit = max(
        1,
        min(
            limit,
            MAX_META_ADS_QUERIES,
        ),
    )

    meta_keywords = dedupe(
        intent.get("meta_search_keywords")
        or []
    )

    industries = dedupe(
        intent.get("industries")
        or []
    )

    historical_keywords = dedupe(
        intent.get("search_keywords")
        or []
    )

    # Gemini est la source principale des variantes Meta.
    raw_candidates = list(
        meta_keywords
    )

    # Le secteur exact doit rester disponible si Gemini ne l'a pas
    # déjà inclus explicitement.
    for industry in industries[:2]:
        if industry:
            raw_candidates.insert(
                0,
                industry,
            )

    # Fallback strict uniquement si Gemini n'a rien produit pour Meta.
    if not raw_candidates:
        raw_candidates.extend(
            industries[:1]
        )

        if historical_keywords:
            raw_candidates.append(
                historical_keywords[0]
            )

    result: list[str] = []
    seen = set()

    for candidate in raw_candidates:
        value = re.sub(
            r"\s+",
            " ",
            str(candidate or "").strip(),
        )

        key = normalize_plain(
            value
        )

        if (
            not key
            or len(key) < MIN_META_QUERY_LENGTH
            or key in seen
        ):
            continue

        seen.add(
            key
        )

        result.append(
            value
        )

        if len(result) >= limit:
            break

    return result


def build_meta_ads_query(
    intent: dict,
) -> str:
    """
    Helper de compatibilité.

    Retourne uniquement la première variante Meta.
    """

    queries = (
        build_meta_ads_queries(
            intent,
            max_queries=1,
        )
    )

    return (
        queries[0]
        if queries
        else ""
    )


# ============================================================
# LOCATION FOR SEARCH
# ============================================================

def search_location_text(
    intent: dict,
) -> str:
    locations = (
        intent.get(
            "locations"
        )
        or []
    )

    if not locations:
        return DEFAULT_COUNTRY

    location = str(
        locations[0]
        or ""
    ).strip()

    if not location:
        return DEFAULT_COUNTRY

    return location


# ============================================================
# SEARCH QUERY
# ============================================================

def build_search_query(
    intent: dict,
    source: str,
) -> str:
    """
    Construit une requête déterministe.

    Gemini comprend le métier.
    Python construit la requête réellement envoyée aux outils.
    """

    industries = (
        intent.get(
            "industries"
        )
        or []
    )

    roles = (
        intent.get(
            "target_roles"
        )
        or []
    )

    keywords = (
        intent.get(
            "search_keywords"
        )
        or []
    )

    industry = (
        str(
            industries[0]
        ).strip()
        if industries
        else ""
    )

    role = (
        str(
            roles[0]
        ).strip()
        if roles
        else ""
    )

    keyword = (
        str(
            keywords[0]
        ).strip()
        if keywords
        else ""
    )

    location = (
        search_location_text(
            intent
        )
    )

    lead_types = (
        intent.get(
            "lead_types"
        )
        or []
    )

    # ========================================================
    # LINKEDIN
    # ========================================================

    if source == "linkedin":
        if (
            lead_types
            == ["person"]
        ):
            parts = [
                role,
                industry,
                location,
            ]

        else:
            parts = [
                keyword
                or industry,
                location,
            ]

        return " ".join(
            part
            for part in parts
            if part
        ).strip()

    # ========================================================
    # FACEBOOK / INSTAGRAM / MAPS
    # ========================================================

    if source in {
        "facebook",
        "instagram",
        "maps",
    }:
        return " ".join(
            part
            for part in [
                keyword
                or industry,
                location,
            ]
            if part
        ).strip()

    # ========================================================
    # META ADS
    # ========================================================

    if source == "meta_ads":
        return (
            build_meta_ads_query(
                intent
            )
        )

    # ========================================================
    # GENERAL WEB
    # ========================================================

    return " ".join(
        part
        for part in [
            role,
            keyword
            or industry,
            location,
        ]
        if part
    ).strip()


# ============================================================
# DEFAULT SOURCE
# ============================================================

def default_sources_for_intent(
    intent: dict,
) -> list[str]:
    lead_types = (
        intent.get(
            "lead_types"
        )
        or []
    )

    if (
        lead_types
        == ["person"]
    ):
        return [
            "linkedin"
        ]

    return [
        "maps"
    ]


# ============================================================
# SEARCH PLAN
# ============================================================

def build_search_plan(
    intent: dict,
) -> dict:
    """
    Premier plan déterministe.

    Le plan initial est construit par Python.
    Les décisions suivantes pourront être prises
    par Gemini dans la boucle agentique.
    """

    target_total = int(
        intent.get(
            "max_leads"
        )
        or 10
    )

    target_total = max(
        1,
        min(
            target_total,
            50,
        ),
    )

    # ========================================================
    # SOURCES
    # ========================================================

    sources = dedupe(
        intent.get(
            "sources"
        )
        or []
    )

    sources = [
        source
        for source in sources
        if source_to_tool(
            source
        )
    ][:2]

    if not sources:
        sources = (
            default_sources_for_intent(
                intent
            )
        )

    searches = []

    for source in sources:
        tool = (
            source_to_tool(
                source
            )
        )

        if not tool:
            continue

        # ====================================================
        # META ADS
        # ====================================================

        if source == "meta_ads":
            queries = (
                build_meta_ads_queries(
                    intent,
                    max_queries=
                        MAX_META_ADS_QUERIES,
                )
            )

            if not queries:
                continue

            searches.append(
                {
                    "source":
                        source,

                    "tool":
                        tool,

                    "query":
                        queries[0],

                    "queries":
                        queries,

                    "countries":
                        meta_ads_country_codes(
                            intent
                        ),

                    "page":
                        1,
                }
            )

            continue

        # ====================================================
        # OTHER SOURCES
        # ====================================================

        query = (
            build_search_query(
                intent,
                source,
            )
        )

        if not query:
            continue

        searches.append(
            {
                "source":
                    source,

                "tool":
                    tool,

                "query":
                    query,

                "page":
                    1,
            }
        )

    # ========================================================
    # SAFETY FALLBACK
    # ========================================================

    if not searches:
        for source in (
            default_sources_for_intent(
                intent
            )
        ):
            tool = (
                source_to_tool(
                    source
                )
            )

            query = (
                build_search_query(
                    intent,
                    source,
                )
            )

            if (
                not tool
                or not query
            ):
                continue

            searches.append(
                {
                    "source":
                        source,

                    "tool":
                        tool,

                    "query":
                        query,

                    "page":
                        1,
                }
            )

    return {
        "target_total":
            target_total,

        "source_forced":
            bool(
                intent.get(
                    "source_forced"
                )
            ),

        "source_plan": {
            source:
                target_total
            for source in sources
        },

        "searches":
            searches[:2],

        "stop_conditions": {
            "max_prospects":
                target_total,

            "max_empty_searches":
                2,

            "max_iterations":
                len(
                    searches[:2]
                ),
        },
    }


# ============================================================
# GEMINI API KEY POOL
# ============================================================

@dataclass
class GeminiKeySlot:
    api_key: str
    source: str
    opened_until: float = 0.0

    def is_available(self) -> bool:
        return time.monotonic() >= self.opened_until

    def remaining_seconds(self) -> int:
        return max(
            0,
            round(self.opened_until - time.monotonic()),
        )

    def record_success(self):
        self.opened_until = 0.0

    def record_rate_limit(self):
        cooldown = int(
            getattr(
                settings,
                "PROSPECTION_GEMINI_CIRCUIT_COOLDOWN_SECONDS",
                300,
            )
            or 300
        )
        self.opened_until = (
            time.monotonic()
            + max(1, cooldown)
        )


def prospection_gemini_api_keys() -> list[GeminiKeySlot]:
    """
    Charge jusqu'à deux clés Gemini distinctes.

    Ordre :
    1. GOOGLE_API_KEY
    2. GEMINI_API_KEY

    Les doublons sont supprimés.
    """
    candidates = [
        (
            str(
                getattr(settings, "GOOGLE_API_KEY", "")
                or os.getenv("GOOGLE_API_KEY", "")
                or ""
            ).strip(),
            "GOOGLE_API_KEY",
        ),
        (
            str(
                getattr(settings, "GEMINI_API_KEY", "")
                or os.getenv("GEMINI_API_KEY", "")
                or ""
            ).strip(),
            "GEMINI_API_KEY",
        ),
    ]

    result = []
    seen = set()

    for api_key, source in candidates:
        if not api_key or api_key in seen:
            continue
        seen.add(api_key)
        result.append(
            GeminiKeySlot(
                api_key=api_key,
                source=source,
            )
        )

    return result


def build_gemini_client(api_key: str):
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=(
                int(
                    getattr(
                        settings,
                        "PROSPECTION_LLM_TIMEOUT",
                        30,
                    )
                    or 30
                )
                * 1000
            ),
            retry_options=types.HttpRetryOptions(
                attempts=1,
            ),
        ),
    )


# ============================================================
# ERROR SANITIZATION
# ============================================================

def sanitize_gemini_error(
    text: str,
) -> str:
    value = str(
        text
        or ""
    )

    secrets = [
        getattr(
            settings,
            "GEMINI_API_KEY",
            "",
        ),

        os.getenv(
            "GEMINI_API_KEY",
            "",
        ),

        # Compatibilité de sécurité : si une ancienne clé
        # PROSPECTION_GEMINI_API_KEY existe encore dans le
        # processus, on la masque dans les logs.
        getattr(
            settings,
            "PROSPECTION_GEMINI_API_KEY",
            "",
        ),

        os.getenv(
            "PROSPECTION_GEMINI_API_KEY",
            "",
        ),

        os.getenv(
            "GOOGLE_API_KEY",
            "",
        ),
    ]

    for secret in secrets:
        if secret:
            value = (
                value.replace(
                    secret,
                    "[REDACTED]",
                )
            )

    return value[:500]


# ============================================================
# RATE LIMIT
# ============================================================

def is_rate_limited(
    exc: Exception,
) -> bool:
    text = str(
        exc
    ).lower()

    code = (
        getattr(
            exc,
            "code",
            None,
        )
        or getattr(
            exc,
            "status_code",
            None,
        )
    )

    return (
        code == 429
        or "429" in text
        or "resource_exhausted"
        in text
        or "quota" in text
        or "too many requests"
        in text
    )


# ============================================================
# GEMINI CALL
# ============================================================

def safe_gemini_generate(
    prompt: str,
    key_slots: list[GeminiKeySlot],
    model: str,
    schema,
    runtime_state: GeminiRuntimeState,
):
    """
    Appel Gemini avec failover entre les clés configurées.

    - utilise la première clé disponible ;
    - sur 429, met uniquement cette clé en cooldown ;
    - essaie ensuite la clé suivante une seule fois ;
    - aucune boucle infinie ;
    - les erreurs non liées au quota ne déclenchent pas de switch.
    """

    if not key_slots:
        runtime_state.status = GEMINI_STATUS_UNAVAILABLE
        runtime_state.last_error = "Gemini API key missing"
        return {
            "success": False,
            "text": "",
            "error": runtime_state.last_error,
            "key_source": None,
        }

    try:
        configured_output_tokens = int(
            getattr(
                settings,
                "PROSPECTION_GEMINI_MAX_OUTPUT_TOKENS",
                2048,
            )
            or 2048
        )
    except (TypeError, ValueError):
        configured_output_tokens = 2048

    max_output_tokens = max(
        2048,
        configured_output_tokens,
    )

    config_kwargs = {
        "response_mime_type": "application/json",
        "response_schema": schema,
        "max_output_tokens": max_output_tokens,
        "temperature": 0.0,
    }

    normalized_model = str(model or "").lower()

    if "gemini-2.5-flash" in normalized_model:
        config_kwargs["thinking_config"] = (
            types.ThinkingConfig(
                thinking_budget=1024,
                include_thoughts=False,
            )
        )

    config = types.GenerateContentConfig(
        **config_kwargs
    )

    available_slots = [
        slot
        for slot in key_slots
        if slot.is_available()
    ]

    if not available_slots:
        runtime_state.status = GEMINI_STATUS_RATE_LIMITED
        runtime_state.last_error = "all_gemini_keys_in_cooldown"
        return {
            "success": False,
            "text": "",
            "error": runtime_state.last_error,
            "key_source": None,
        }

    last_error = ""

    for index, slot in enumerate(available_slots):
        try:
            client = build_gemini_client(
                slot.api_key
            )

            runtime_state.calls += 1

            logger.info(
                "[GEMINI][KEY] using=%s attempt=%s/%s",
                slot.source,
                index + 1,
                len(available_slots),
            )

            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )

            response_text = (
                getattr(response, "text", "")
                or ""
            )

            finish_reason = None

            try:
                candidates = (
                    getattr(
                        response,
                        "candidates",
                        None,
                    )
                    or []
                )
                if candidates:
                    finish_reason = getattr(
                        candidates[0],
                        "finish_reason",
                        None,
                    )
            except Exception:
                finish_reason = None

            logger.info(
                "[GEMINI] schema=%s chars=%s finish_reason=%s key=%s",
                getattr(
                    schema,
                    "__name__",
                    str(schema),
                ),
                len(response_text),
                finish_reason,
                slot.source,
            )

            if not response_text.strip():
                runtime_state.status = (
                    GEMINI_STATUS_INVALID_RESPONSE
                )
                runtime_state.last_error = (
                    "Gemini returned an empty structured response"
                )
                return {
                    "success": False,
                    "text": "",
                    "error": runtime_state.last_error,
                    "key_source": slot.source,
                }

            slot.record_success()

            runtime_state.status = GEMINI_STATUS_SUCCESS
            runtime_state.last_error = ""

            return {
                "success": True,
                "text": response_text,
                "error": None,
                "key_source": slot.source,
            }

        except Exception as exc:
            error = sanitize_gemini_error(
                str(exc)
            )
            last_error = error
            runtime_state.last_error = error

            if is_rate_limited(exc):
                runtime_state.status = (
                    GEMINI_STATUS_RATE_LIMITED
                )
                slot.record_rate_limit()

                logger.warning(
                    "[GEMINI][RATE_LIMIT] key=%s cooldown=%ss error=%s",
                    slot.source,
                    slot.remaining_seconds(),
                    error,
                )

                # On tente la prochaine clé disponible.
                continue

            runtime_state.status = (
                GEMINI_STATUS_UNAVAILABLE
            )

            logger.error(
                "[GEMINI][ERROR] key=%s error=%s",
                slot.source,
                error,
            )

            # Une erreur non-quota n'est pas une raison de
            # consommer une autre clé.
            return {
                "success": False,
                "text": "",
                "error": error,
                "key_source": slot.source,
            }

    runtime_state.status = GEMINI_STATUS_RATE_LIMITED
    runtime_state.last_error = (
        last_error
        or "all_gemini_keys_rate_limited"
    )

    return {
        "success": False,
        "text": "",
        "error": runtime_state.last_error,
        "key_source": None,
    }


# ============================================================
# FALLBACK DECISION
# ============================================================

def _fallback_decision(
    memory,
    allowed_actions: list[str] | None = None,
    allowed_sources: list[str] | None = None,
    reason: str = "fallback",
) -> dict:
    """
    Décision stratégique 100 % déterministe.

    Utilisée seulement lorsqu'un appel de décision Gemini
    ne peut pas être effectué ou ne peut pas être exploité.

    Ce fallback ne remplace jamais l'extraction initiale
    d'intention.
    """

    allowed_actions = list(
        allowed_actions
        or []
    )

    allowed_sources = list(
        allowed_sources
        or []
    )

    companies, persons = (
        memory.crm_ready_entities()
    )

    valid_count = (
        len(
            companies
        )
        + len(
            persons
        )
    )

    # ========================================================
    # OBJECTIVE REACHED
    # ========================================================

    if (
        valid_count
        >= memory.max_leads
    ):
        decision = (
            "stop"
        )

        source = None

    # ========================================================
    # META VERIFICATION
    # ========================================================

    elif (
        "verify_pending_meta_ads"
        in allowed_actions
        and memory.pending_verification
    ):
        decision = (
            "verify_pending_meta_ads"
        )

        source = None

    # ========================================================
    # CONTINUE SAME STRATEGY
    # ========================================================

    elif (
        "continue_same_strategy"
        in allowed_actions
        and memory.iterations
        < memory.max_iterations
    ):
        decision = (
            "continue_same_strategy"
        )

        source = None

    # ========================================================
    # SWITCH SOURCE
    # ========================================================

    elif (
        "switch_source"
        in allowed_actions
        and allowed_sources
    ):
        decision = (
            "switch_source"
        )

        source = (
            allowed_sources[0]
        )

    # ========================================================
    # BROADEN CRITERIA
    # ========================================================

    elif (
        "broaden_criteria"
        in allowed_actions
    ):
        decision = (
            "broaden_criteria"
        )

        source = None

    # ========================================================
    # STOP
    # ========================================================

    else:
        decision = (
            "stop"
        )

        source = None

    return {
        "decision":
            decision,

        "source":
            source,

        "reason":
            (
                "Fallback stratégique déterministe : "
                f"{str(reason or 'fallback')[:120]}"
            ),

        "confidence":
            0.5,

        "origin":
            "deterministic_fallback",
    }


# ============================================================
# GEMINI BRAIN
# ============================================================

class GeminiBrain:
    """
    Cerveau du DiscoveryAgent.

    Gemini intervient à trois niveaux distincts :

    1. une fois pour comprendre la demande utilisateur ;
    2. pour valider sémantiquement des candidats préfiltrés ;
    3. jusqu'à max_decision_calls fois pour prendre des
       décisions stratégiques après observation des résultats.

    Python reste responsable de :
    - construire les requêtes ;
    - appeler les outils ;
    - imposer les limites ;
    - valider les prospects ;
    - dédupliquer ;
    - importer dans le CRM.
    """

    def __init__(
        self,
    ):
        self.gemini_state = (
            GeminiRuntimeState()
        )

        self.gemini_keys = (
            prospection_gemini_api_keys()
        )

        self.gemini_key_source = (
            self.gemini_keys[0].source
            if self.gemini_keys
            else "none"
        )

        self.model = getattr(
            settings,
            "GEMINI_MODEL",
            os.getenv(
                "GEMINI_MODEL",
                "gemini-2.5-flash",
            ),
        )

        # Compatibilité avec le reste du code :
        # self.client indique simplement qu'au moins une clé existe.
        self.client = (
            True
            if self.gemini_keys
            else None
        )

        if not self.gemini_keys:
            self.gemini_state.status = (
                GEMINI_STATUS_UNAVAILABLE
            )
            self.gemini_state.last_error = (
                "Gemini API key missing"
            )

        logger.info(
            "[GEMINI][KEY_POOL] configured=%s sources=%s",
            len(self.gemini_keys),
            [
                slot.source
                for slot in self.gemini_keys
            ],
        )

    # ========================================================
    # METADATA
    # ========================================================

    def gemini_metadata(
        self,
    ) -> dict:
        return {
            "gemini_status":
                self.gemini_state.status,

            "gemini_calls":
                self.gemini_state.calls,

            "gemini_model":
                self.model,

            "gemini_key_source":
                self.gemini_key_source,

            "gemini_key_sources":
                [
                    slot.source
                    for slot in self.gemini_keys
                ],

            "gemini_keys_configured":
                len(self.gemini_keys),

            "gemini_fallback_used":
                False,
        }

    # ========================================================
    # INTENT EXTRACTION
    # ========================================================

    async def extract_intent(
        self,
        query: str,
    ) -> dict:
        query = str(
            query
            or ""
        ).strip()

        if not query:
            raise ValueError(
                "La requête de prospection est vide."
            )

        foreign_location = (
            query_requests_foreign_location(
                query
            )
        )

        if foreign_location:
            raise ValueError(
                "Cette application de prospection "
                "est consacrée uniquement à la Tunisie. "
                f"La localisation '{foreign_location}' "
                "n'est pas supportée."
            )

        prompt = f"""
{SYSTEM_PROMPT}

Demande utilisateur :

{query}
""".strip()

        response = (
            await asyncio.to_thread(
                safe_gemini_generate,
                prompt,
                self.gemini_keys,
                self.model,
                IntentSchema,
                self.gemini_state,
            )
        )

        if not response[
            "success"
        ]:
            raise RuntimeError(
                "Gemini indisponible pour "
                "analyser la demande : "
                f"{response['error']}"
            )

        try:
            parsed = (
                IntentSchema
                .model_validate_json(
                    response[
                        "text"
                    ]
                )
            )

            data = (
                parsed.model_dump()
            )

        except Exception as exc:
            self.gemini_state.status = (
                GEMINI_STATUS_INVALID_RESPONSE
            )

            self.gemini_state.last_error = (
                sanitize_gemini_error(
                    str(
                        exc
                    )
                )
            )

            raise RuntimeError(
                "Réponse Gemini invalide : "
                f"{self.gemini_state.last_error}"
            ) from exc

        return clean_gemini_intent(
            data
        )

    # ========================================================
    # SEMANTIC CANDIDATE VALIDATION
    # ========================================================

    async def validate_candidates(
        self,
        intent: dict,
        candidates: list[dict],
    ) -> list[dict]:
        """
        Valide sémantiquement un lot de candidats déjà découverts.

        Cette méthode ne recherche rien et ne décide jamais
        directement qu'un candidat est CRM-ready.

        Elle ajoute uniquement `semantic_validation` à chaque
        candidat lorsque Gemini fournit une réponse exploitable.

        En cas d'indisponibilité ou de réponse incomplète,
        le candidat est conservé sans validation sémantique afin
        que le backend puisse appliquer sa politique de fallback.
        """

        if not candidates:
            return []

        normalized_candidates = []

        for index, candidate in enumerate(candidates):
            item = dict(candidate or {})

            candidate_id = str(
                item.get("candidate_id")
                or item.get("id")
                or f"candidate_{index + 1}"
            ).strip()[:120]

            item["candidate_id"] = candidate_id
            normalized_candidates.append(item)

        # Ne transmettre à Gemini que les informations utiles
        # à la validation. Aucun dictionnaire métier n'est utilisé.
        intent_payload = {
            "lead_types": intent.get("lead_types") or [],
            "industries": intent.get("industries") or [],
            "target_roles": intent.get("target_roles") or [],
            "locations": intent.get("locations") or [],
            "search_keywords": intent.get("search_keywords") or [],
        }

        has_meta_candidate = any(
            str(item.get("source") or "").strip().lower()
            in {"meta_ads", "meta_ads_library", "ads_library_search"}
            for item in normalized_candidates
        )

        if has_meta_candidate:
            intent_payload["meta_search_keywords"] = (
                intent.get("meta_search_keywords") or []
            )

        candidate_payloads = []

        evidence_fields = (
            "candidate_id",
            "company_name",
            "full_name",
            "title",
            "job_title",
            "headline",
            "category",
            "description",
            "snippet",
            "about",
            "city",
            "country",
            "address",
            "website",
            "linkedin_url",
            "facebook_url",
            "instagram_url",
            "email",
            "phone",
            "source",
            "source_label",
            "meta_search_query",
            "meta_search_queries",
            "meta_ads_texts",
            "meta_ads_count",
            "meta_ads_matched_ads_count",
            "meta_ads_query_coverage",
            "meta_ads_exact_phrase_match",
            "meta_evidence_strength",
            "meta_ad_overlap",
            "meta_advertiser_overlap",
            "meta_requires_external_verification",
        )

        for item in normalized_candidates:
            evidence = {}

            for field in evidence_fields:
                value = item.get(field)

                if value not in (None, "", [], {}):
                    evidence[field] = value

            candidate_payloads.append(evidence)

        import json

        prompt = build_validation_prompt(
            intent_summary=json.dumps(
                intent_payload,
                ensure_ascii=False,
                default=str,
            ),
            candidates_payload=json.dumps(
                candidate_payloads,
                ensure_ascii=False,
                default=str,
            ),
        )

        # Validation sémantique = amélioration de qualité.
        # Elle ne doit pas faire tomber tout le run si Gemini
        # est temporairement indisponible.
        if not self.client:
            logger.warning(
                "[SEMANTIC_VALIDATION] Gemini client unavailable; "
                "keeping %s candidates without semantic validation.",
                len(normalized_candidates),
            )
            return normalized_candidates


        response = await asyncio.to_thread(
            safe_gemini_generate,
            prompt,
            self.gemini_keys,
            self.model,
            ValidationBatch,
            self.gemini_state,
        )

        if not response["success"]:
            logger.warning(
                "[SEMANTIC_VALIDATION] Gemini validation unavailable: %s",
                response.get("error") or "unknown_error",
            )
            return normalized_candidates

        try:
            parsed = ValidationBatch.model_validate_json(
                response["text"]
            )
        except Exception as exc:
            error = sanitize_gemini_error(str(exc))

            logger.warning(
                "[SEMANTIC_VALIDATION] Invalid ValidationBatch: %s",
                error,
            )

            return normalized_candidates

        validations = {
            result.candidate_id: result.model_dump()
            for result in parsed.results
        }

        validated_count = 0

        for item in normalized_candidates:
            validation = validations.get(
                item["candidate_id"]
            )

            if not validation:
                continue

            item["semantic_validation"] = {
                "sector_match": bool(
                    validation.get("sector_match")
                ),
                "role_match": bool(
                    validation.get("role_match")
                ),
                "location_status": str(
                    validation.get("location_status")
                    or "unknown"
                ),
                "confidence": float(
                    validation.get("confidence")
                    or 0.0
                ),
                "reason": str(
                    validation.get("reason")
                    or ""
                ).strip()[:300],
            }

            validated_count += 1

        logger.info(
            "[SEMANTIC_VALIDATION] candidates=%s validated=%s missing=%s",
            len(normalized_candidates),
            validated_count,
            len(normalized_candidates) - validated_count,
        )

        return normalized_candidates

    # ========================================================
    # AGENTIC DECISION
    # ========================================================

    async def decide_next_action(
        self,
        memory,
        allowed_actions: list[str],
        allowed_sources: list[str] | None = None,
    ) -> dict:
        """
        Prend une décision stratégique à partir
        de l'état réel du run.

        Budget :
        - extraction d'intent : compteur Gemini général ;
        - décision stratégique : budget spécifique
          memory.max_decision_calls.

        Python reste responsable de valider l'action
        avant son exécution.
        """

        allowed_actions = list(
            dict.fromkeys(
                str(
                    item
                ).strip()
                for item
                in (
                    allowed_actions
                    or []
                )
                if str(
                    item
                    or ""
                ).strip()
            )
        )

        allowed_sources = list(
            dict.fromkeys(
                str(
                    item
                ).strip()
                for item
                in (
                    allowed_sources
                    or []
                )
                if str(
                    item
                    or ""
                ).strip()
            )
        )

        # ====================================================
        # NO AVAILABLE ACTION
        # ====================================================

        if not allowed_actions:
            return {
                "decision":
                    "stop",

                "source":
                    None,

                "reason":
                    (
                        "Aucune action stratégique "
                        "disponible."
                    ),

                "confidence":
                    1.0,

                "origin":
                    "deterministic_guard",
            }

        # ====================================================
        # TARGET ALREADY REACHED
        # ====================================================

        companies, persons = (
            memory.crm_ready_entities()
        )

        valid_count = (
            len(
                companies
            )
            + len(
                persons
            )
        )

        if (
            valid_count
            >= memory.max_leads
        ):
            return {
                "decision":
                    "stop",

                "source":
                    None,

                "reason":
                    (
                        "Objectif de prospects "
                        "valides déjà atteint."
                    ),

                "confidence":
                    1.0,

                "origin":
                    "deterministic_guard",
            }

        # ====================================================
        # DECISION BUDGET
        # ====================================================

        if not (
            memory
            .decision_budget_available()
        ):
            return _fallback_decision(
                memory,
                allowed_actions=
                    allowed_actions,
                allowed_sources=
                    allowed_sources,
                reason=
                    "budget_epuise",
            )

        # ====================================================
        # CLIENT UNAVAILABLE
        # ====================================================

        if not self.client:
            return _fallback_decision(
                memory,
                allowed_actions=
                    allowed_actions,
                allowed_sources=
                    allowed_sources,
                reason=
                    "client_gemini_indisponible",
            )


        # ====================================================
        # DECISION PROMPT
        # ====================================================

        prompt = (
            build_decision_prompt(
                context_summary=
                    memory.decision_context(),

                allowed_actions=
                    allowed_actions,

                allowed_sources=
                    allowed_sources,
            )
        )

        # ====================================================
        # REGISTER REAL GEMINI DECISION CALL
        # ====================================================

        memory.register_decision_call()

        # ====================================================
        # EXACTLY ONE GEMINI CALL
        # ====================================================

        response = (
            await asyncio.to_thread(
                safe_gemini_generate,
                prompt,
                self.gemini_keys,
                self.model,
                AgentDecision,
                self.gemini_state,
            )
        )

        # ====================================================
        # GEMINI FAILURE
        # ====================================================

        if not response[
            "success"
        ]:
            memory.add_error(
                "gemini_decision",
                (
                    response.get(
                        "error"
                    )
                    or "gemini_indisponible"
                ),
            )

            return _fallback_decision(
                memory,
                allowed_actions=
                    allowed_actions,
                allowed_sources=
                    allowed_sources,
                reason=
                    "gemini_indisponible",
            )

        # ====================================================
        # STRICT PARSING
        # ====================================================

        try:
            parsed = (
                AgentDecision
                .model_validate_json(
                    response[
                        "text"
                    ]
                )
            )

            decision = (
                parsed.model_dump()
            )

        except Exception as exc:
            error = (
                sanitize_gemini_error(
                    str(
                        exc
                    )
                )
            )

            memory.add_error(
                "gemini_decision",
                (
                    "Réponse décision invalide : "
                    f"{error}"
                ),
            )

            return _fallback_decision(
                memory,
                allowed_actions=
                    allowed_actions,
                allowed_sources=
                    allowed_sources,
                reason=
                    "reponse_invalide",
            )

        # ====================================================
        # ACTION AUTHORIZATION
        # ====================================================

        action = (
            decision.get(
                "decision"
            )
        )

        if (
            action
            not in allowed_actions
        ):
            return _fallback_decision(
                memory,
                allowed_actions=
                    allowed_actions,
                allowed_sources=
                    allowed_sources,
                reason=
                    (
                        "action_non_autorisee:"
                        f"{action}"
                    ),
            )

        # ====================================================
        # SOURCE AUTHORIZATION
        # ====================================================

        if (
            action
            == "switch_source"
        ):
            source = (
                decision.get(
                    "source"
                )
                or ""
            )

            if (
                not source
                or source
                not in allowed_sources
            ):
                return _fallback_decision(
                    memory,
                    allowed_actions=
                        allowed_actions,
                    allowed_sources=
                        allowed_sources,
                    reason=
                        (
                            "source_non_autorisee:"
                            f"{source}"
                        ),
                )

        else:
            decision[
                "source"
            ] = None

        # ====================================================
        # FINAL DECISION
        # ====================================================

        decision[
            "origin"
        ] = "gemini"

        return decision