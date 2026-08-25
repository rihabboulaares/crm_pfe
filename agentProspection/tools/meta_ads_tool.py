import asyncio
import json
import logging
import re
import shlex
import unicodedata

from django.conf import settings

from agentProspection.tools.base_tool import BaseTool
from agentProspection.tools.meta_ads_sanitizer import (
    sanitize_meta_payload,
    sanitize_meta_url,
)


logger = logging.getLogger(
    "agentProspection.meta_ads"
)


# ============================================================
# CONSTANTS
# ============================================================

DISPLAY_SOURCE = (
    "Meta Ads Library"
)

DEFAULT_COUNTRY_CODE = "TN"
DEFAULT_RESULT_LIMIT = 10

# Un mot isolé ne suffit plus : il faut un vrai signal métier
# (2 tokens en commun), ou un token fort + un signal d'identité
# pour l'annonceur (déjà bonus ailleurs dans le score).
MIN_META_AD_RELEVANCE_SCORE = 2
MIN_META_ADVERTISER_SCORE = 4
MIN_META_DISCOVERY_SCORE = 2.0

META_STOPWORDS = {
    "a", "an", "and", "or", "the", "of", "for", "to", "in", "on",
    "de", "des", "du", "la", "le", "les", "et", "en", "pour",
    "un", "une", "sur", "avec",
    "company", "business", "entreprise",
    "tunisie", "tunisia", "tunis", "tn",
    # Mots génériques de nommage d'entreprise, tous secteurs confondus :
    # ne prouvent jamais un domaine d'activité à eux seuls.
    "agence", "agences", "societe", "societes", "groupe", "groupes",
    "cabinet", "cabinets", "compagnie", "compagnies",
    "etablissement", "etablissements",
}


def _stem_token(token: str) -> str:
    """
    Même logique que agent/lead_classifier._stem_token, dupliquée ici
    volontairement pour éviter un import croisé tools/ <-> agent/.
    Garde le tokenizer Meta Ads cohérent avec le reste du pipeline :
    une requête au pluriel doit matcher une pub/annonceur au singulier.
    """
    if len(token) <= 4:
        return token

    for suffix in ("ements", "ement", "ations", "ation", "iques", "ique"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            return token[:-len(suffix)]

    if token.endswith("ies") and len(token) > 5:
        return token[:-3] + "y"

    if token.endswith("s") and len(token) > 4:
        return token[:-1]

    return token


def _tokenize(
    value: str | None,
) -> set[str]:
    """
    Tokenisation générique pour mesurer la pertinence
    d'un annonceur Meta Ads sans coder un secteur en dur.
    """
    normalized = _normalize_key(value)
    result = set()

    for token in normalized.split():
        if len(token) < 3:
            continue

        if token in META_STOPWORDS:
            continue

        stemmed = _stem_token(token)

        if (
            stemmed
            and stemmed not in META_STOPWORDS
        ):
            result.add(stemmed)

    return result


def _requested_countries(
    query: str | dict,
) -> list[str]:
    """
    Récupère les pays demandés par le run.
    """
    if not isinstance(
        query,
        dict,
    ):
        return [
            DEFAULT_COUNTRY_CODE
        ]

    value = (
        query.get(
            "ad_reached_countries"
        )
        or query.get(
            "countries"
        )
        or query.get(
            "country"
        )
    )

    if not value:
        return [
            DEFAULT_COUNTRY_CODE
        ]

    if isinstance(
        value,
        str,
    ):
        value = [
            value
        ]

    result = []

    for item in value:
        code = str(
            item
            or ""
        ).strip().upper()

        if (
            code
            and code not in result
        ):
            result.append(
                code
            )

    return (
        result
        or [DEFAULT_COUNTRY_CODE]
    )


def _requested_limit(
    query: str | dict,
) -> int:
    """
    Respecte la limite demandée par l'appelant.
    """
    if not isinstance(
        query,
        dict,
    ):
        return DEFAULT_RESULT_LIMIT

    raw = (
        query.get("limit")
        or query.get("max_results")
        or query.get("count")
        or DEFAULT_RESULT_LIMIT
    )

    try:
        value = int(raw)
    except (
        TypeError,
        ValueError,
    ):
        value = DEFAULT_RESULT_LIMIT

    configured_max = int(
        getattr(
            settings,
            "META_ADS_MAX_RESULTS",
            50,
        )
        or 50
    )

    return max(
        1,
        min(
            value,
            configured_max,
        ),
    )


def _unique_texts(values) -> list[str]:
    result = []
    seen = set()

    for value in values or []:
        text = str(value or "").strip()
        key = _normalize_key(text)

        if not key or key in seen:
            continue

        seen.add(key)
        result.append(text)

    return result


def meta_relevance_analysis(
    candidate: dict,
    query_text: str,
) -> dict:
    """
    Mesure uniquement la qualité du signal de découverte Meta Ads.

    Cette fonction ne valide jamais le secteur réel de l'annonceur.
    Tout résultat Meta retenu doit toujours passer par la vérification
    secondaire déjà prévue dans le DiscoveryAgent.
    """

    query_tokens = _tokenize(query_text)
    normalized_query = _normalize_key(query_text)

    if not query_tokens and not normalized_query:
        return {
            "ad_match": False,
            "advertiser_match": False,
            "discovery_relevant": False,
            "ad_score": 0,
            "advertiser_score": 0,
            "discovery_score": 0.0,
            "query_tokens": [],
            "ad_overlap": [],
            "advertiser_overlap": [],
            "matched_ads_count": 0,
            "query_coverage": 0.0,
            "exact_phrase_match": False,
            "evidence_strength": "weak",
            "requires_external_verification": True,
        }

    advertiser_identity_text = " ".join(
        str(value or "")
        for value in [
            candidate.get("company_name"),
            candidate.get("name"),
        ]
        if value
    )

    advertiser_tokens = _tokenize(advertiser_identity_text)
    advertiser_overlap = query_tokens & advertiser_tokens
    advertiser_score = len(advertiser_overlap) * 4

    if advertiser_overlap and candidate.get("facebook_url"):
        advertiser_score += 1
    if advertiser_overlap and candidate.get("instagram_url"):
        advertiser_score += 1
    if advertiser_overlap and candidate.get("website"):
        advertiser_score += 1

    advertiser_match = (
        advertiser_score >= MIN_META_ADVERTISER_SCORE
    )

    meta_ads_texts = candidate.get("meta_ads_texts") or []
    if isinstance(meta_ads_texts, str):
        meta_ads_texts = [meta_ads_texts]
    if candidate.get("ad_text"):
        meta_ads_texts = [candidate.get("ad_text"), *meta_ads_texts]

    meta_ads_texts = _unique_texts(meta_ads_texts)

    union_overlap = set()
    matched_ads_count = 0
    exact_phrase_match = False

    for ad_text in meta_ads_texts:
        ad_tokens = _tokenize(ad_text)
        overlap = query_tokens & ad_tokens

        if overlap:
            matched_ads_count += 1
            union_overlap.update(overlap)

        normalized_ad = _normalize_key(ad_text)
        if (
            normalized_query
            and normalized_ad
            and len(normalized_query) >= 4
            and normalized_query in normalized_ad
        ):
            exact_phrase_match = True

    ad_overlap = union_overlap
    query_coverage = (
        len(ad_overlap) / max(1, len(query_tokens))
        if query_tokens
        else 0.0
    )

    ad_score = len(ad_overlap)
    if matched_ads_count:
        ad_score += min(matched_ads_count, 3)
    if exact_phrase_match:
        ad_score += 2

    ad_match = (
        exact_phrase_match
        or matched_ads_count >= 2
        or (
            bool(ad_overlap)
            and query_coverage >= 0.50
            and ad_score >= MIN_META_AD_RELEVANCE_SCORE
        )
    )

    discovery_score = 0.0
    if ad_match:
        discovery_score += 2.0
    if advertiser_match:
        discovery_score += 1.5
    discovery_score += min(query_coverage, 1.0)
    if matched_ads_count >= 2:
        discovery_score += 1.0
    if exact_phrase_match:
        discovery_score += 1.0
    if candidate.get("facebook_url"):
        discovery_score += 0.25
    if candidate.get("website"):
        discovery_score += 0.25

    discovery_relevant = (
        discovery_score >= MIN_META_DISCOVERY_SCORE
        and (ad_match or advertiser_match)
    )

    if exact_phrase_match and matched_ads_count >= 2 and query_coverage >= 0.50:
        evidence_strength = "strong"
    elif ad_match or advertiser_match:
        evidence_strength = "medium"
    else:
        evidence_strength = "weak"

    return {
        "ad_match": ad_match,
        "advertiser_match": advertiser_match,
        "discovery_relevant": discovery_relevant,
        "ad_score": ad_score,
        "advertiser_score": advertiser_score,
        "discovery_score": round(discovery_score, 3),
        "query_tokens": sorted(query_tokens),
        "ad_overlap": sorted(ad_overlap),
        "advertiser_overlap": sorted(advertiser_overlap),
        "matched_ads_count": matched_ads_count,
        "query_coverage": round(query_coverage, 3),
        "exact_phrase_match": exact_phrase_match,
        "evidence_strength": evidence_strength,
        "requires_external_verification": bool(discovery_relevant),
    }


# ============================================================
# EXCEPTION
# ============================================================

class MetaAdsMCPError(
    RuntimeError
):
    pass


# ============================================================
# HELPERS
# ============================================================

def _json_dict(
    value: str | None,
) -> dict:

    if not value:
        return {}

    try:
        data = json.loads(
            value
        )

    except json.JSONDecodeError:
        return {}

    return (
        data
        if isinstance(
            data,
            dict,
        )
        else {}
    )


def _first_present(
    data: dict,
    names: list[str],
):
    for name in names:

        value = data.get(
            name
        )

        if value not in (
            None,
            "",
            [],
            {},
        ):
            return value

    return None


def _normalize_key(
    value: str | None,
) -> str:

    text = unicodedata.normalize(
        "NFKD",
        str(
            value
            or ""
        ),
    )

    text = "".join(
        char
        for char
        in text
        if not unicodedata.combining(
            char
        )
    )

    text = re.sub(
        r"[^a-z0-9]+",
        " ",
        text.lower(),
    )

    return (
        " ".join(
            text.split()
        )
    )


def _to_plain_tool(
    tool,
) -> dict:

    return {
        "name":
            getattr(
                tool,
                "name",
                "",
            ),

        "description":
            (
                getattr(
                    tool,
                    "description",
                    "",
                )
                or ""
            ),

        "inputSchema":
            (
                getattr(
                    tool,
                    "inputSchema",
                    None,
                )
                or getattr(
                    tool,
                    "input_schema",
                    None,
                )
                or {}
            ),
    }


# ============================================================
# SCHEMA HELPERS
# ============================================================

def _schema_accepts_array(
    prop: dict,
) -> bool:

    if (
        prop.get("type")
        == "array"
    ):
        return True

    variants = []

    for key in (
        "anyOf",
        "oneOf",
    ):
        value = prop.get(
            key
        )

        if isinstance(
            value,
            list,
        ):
            variants.extend(
                item
                for item
                in value
                if isinstance(
                    item,
                    dict,
                )
            )

    return any(
        item.get("type")
        == "array"
        for item
        in variants
    )


# ============================================================
# MCP RESULT EXTRACTION
# ============================================================

def _items_from_mcp_result(
    result,
) -> list[dict]:

    structured = (
        getattr(
            result,
            "structuredContent",
            None,
        )
        or getattr(
            result,
            "structured_content",
            None,
        )
    )

    # ========================================================
    # STRUCTURED DICT
    # ========================================================

    if isinstance(
        structured,
        dict,
    ):

        for key in (
            "results",
            "items",
            "data",
            "ads",
        ):

            value = structured.get(
                key
            )

            if isinstance(
                value,
                list,
            ):

                return [
                    sanitize_meta_payload(
                        item
                    )
                    for item
                    in value
                    if isinstance(
                        item,
                        dict,
                    )
                ]

        if (
            structured.get(
                "success"
            )
            is True
            and isinstance(
                structured.get(
                    "results"
                ),
                list,
            )
        ):
            return (
                structured[
                    "results"
                ]
            )

        return []

    # ========================================================
    # STRUCTURED LIST
    # ========================================================

    if isinstance(
        structured,
        list,
    ):

        return [
            sanitize_meta_payload(
                item
            )
            for item
            in structured
            if isinstance(
                item,
                dict,
            )
        ]

    # ========================================================
    # TEXT RESULT
    # ========================================================

    items = []

    for content in (
        getattr(
            result,
            "content",
            [],
        )
        or []
    ):

        text = getattr(
            content,
            "text",
            None,
        )

        if not text:
            continue

        try:
            parsed = json.loads(
                text
            )

        except json.JSONDecodeError:
            continue

        if isinstance(
            parsed,
            list,
        ):

            items.extend(
                sanitize_meta_payload(
                    item
                )
                for item
                in parsed
                if isinstance(
                    item,
                    dict,
                )
            )

            continue

        if not isinstance(
            parsed,
            dict,
        ):
            continue

        for key in (
            "results",
            "items",
            "data",
            "ads",
        ):

            value = parsed.get(
                key
            )

            if isinstance(
                value,
                list,
            ):

                items.extend(
                    sanitize_meta_payload(
                        item
                    )
                    for item
                    in value
                    if isinstance(
                        item,
                        dict,
                    )
                )

                break

    return items


# ============================================================
# MCP ERROR
# ============================================================

def _error_from_mcp_result(
    result,
) -> str:

    payloads = []

    structured = (
        getattr(
            result,
            "structuredContent",
            None,
        )
        or getattr(
            result,
            "structured_content",
            None,
        )
    )

    if isinstance(
        structured,
        dict,
    ):
        payloads.append(
            structured
        )

    for content in (
        getattr(
            result,
            "content",
            [],
        )
        or []
    ):

        text = getattr(
            content,
            "text",
            None,
        )

        if not text:
            continue

        try:
            parsed = json.loads(
                text
            )

        except json.JSONDecodeError:
            continue

        if isinstance(
            parsed,
            dict,
        ):
            payloads.append(
                parsed
            )

    for payload in payloads:

        success = payload.get(
            "success"
        )

        status = str(
            payload.get(
                "status"
            )
            or ""
        ).lower()

        if (
            success is False
            or status in {
                "error",
                "failed",
                "unavailable",
            }
        ):

            return str(
                payload.get(
                    "error"
                )
                or payload.get(
                    "message"
                )
                or status
                or "MCP tool error"
            )[:400]

    if getattr(
        result,
        "isError",
        False,
    ):
        return (
            "MCP tool returned "
            "isError=true"
        )

    return ""


# ============================================================
# MCP ARGUMENT BUILDER
# ============================================================

def build_args_from_schema(
    schema: dict,
    query: str | dict,
) -> dict:

    if isinstance(
        query,
        dict,
    ):

        query_text = str(
            query.get("q")
            or query.get(
                "query"
            )
            or ""
        ).strip()

    else:

        query_text = str(
            query
            or ""
        ).strip()

    if not query_text:
        raise MetaAdsMCPError(
            "Meta Ads query is empty"
        )

    properties = (
        (schema or {})
        .get(
            "properties"
        )
        or {}
    )

    if not properties:
        raise MetaAdsMCPError(
            "ads_library_search "
            "schema unavailable"
        )

    args = {}

    # ========================================================
    # QUERY FIELD
    # ========================================================

    query_fields = [
        "search_terms",
        "query",
        "q",
        "search_query",
        "keyword",
        "keywords",
    ]

    query_field = None

    for field in query_fields:

        if field in properties:
            query_field = (
                field
            )

            break

    if not query_field:

        required = (
            schema.get(
                "required"
            )
            or []
        )

        candidate_fields = []

        for field in required:

            prop = (
                properties.get(
                    field
                )
                or {}
            )

            if prop.get(
                "type"
            ) in {
                "string",
                None,
            }:

                candidate_fields.append(
                    field
                )

        if (
            len(
                candidate_fields
            )
            != 1
        ):

            raise MetaAdsMCPError(
                "Unable to detect Meta Ads "
                "search query field"
            )

        query_field = (
            candidate_fields[0]
        )

    args[
        query_field
    ] = query_text

    # ========================================================
    # COUNTRY
    # ========================================================

    requested_countries = (
        _requested_countries(
            query
        )
    )

    for field in (
        "ad_reached_countries",
        "countries",
        "country",
    ):

        if field not in properties:
            continue

        prop = (
            properties.get(
                field
            )
            or {}
        )

        if _schema_accepts_array(
            prop
        ):
            args[field] = (
                requested_countries
            )

        else:
            args[field] = (
                requested_countries[0]
            )

        break

    # ========================================================
    # LIMIT
    # ========================================================

    requested_limit = (
        _requested_limit(
            query
        )
    )

    for field in (
        "limit",
        "max_results",
        "count",
    ):

        if field in properties:
            args[field] = (
                requested_limit
            )
            break

    # ========================================================
    # ACTIVE ADS
    # ========================================================

    if (
        "ad_active_status"
        in properties
    ):

        args[
            "ad_active_status"
        ] = "ACTIVE"

    return args


# ============================================================
# NORMALIZE META RESULT
# ============================================================

def normalize_meta_ads_result(
    item: dict,
    query_text: str = "",
    requested_countries: list[str] | None = None,
) -> dict:

    item = sanitize_meta_payload(
        item
    )

    page_name = _first_present(
        item,
        [
            "advertiser_name",
            "page_name",
            "advertiser",
            "name",
        ],
    )

    page_id = _first_present(
        item,
        [
            "page_id",
            "advertiser_id",
        ],
    )

    facebook_url = (
        sanitize_meta_url(
            _first_present(
                item,
                [
                    "facebook_url",
                    "page_url",
                    "facebook_page_url",
                ],
            )
        )
    )

    if (
        not facebook_url
        and page_id
    ):

        facebook_url = (
            f"https://www.facebook.com/"
            f"{page_id}"
        )

    instagram_url = sanitize_meta_url(
        _first_present(
            item,
            [
                "instagram_url",
                "instagram_profile_url",
            ],
        )
    )

    website = sanitize_meta_url(
        _first_present(
            item,
            [
                "website",
                "website_url",
                "landing_page_url",
            ],
        )
    )

    snapshot = sanitize_meta_url(
        _first_present(
            item,
            [
                "ad_snapshot_url",
                "snapshot_url",
                "ad_url",
            ],
        )
    )

    ad_text = _first_present(
        item,
        [
            "ad_text",
            "body",
            "text",
            "creative_body",
        ],
    )

    company_country = _first_present(
        item,
        [
            "company_country",
            "country",
        ],
    )

    reached_countries = _first_present(
        item,
        [
            "ad_reached_countries",
            "countries",
        ],
    )

    if not reached_countries:

        reached_countries = (
            requested_countries
            or [DEFAULT_COUNTRY_CODE]
        )

    elif isinstance(
        reached_countries,
        str,
    ):

        reached_countries = [
            reached_countries
        ]

    ad_id = _first_present(
        item,
        [
            "ad_id",
            "id",
        ],
    )

    platform = _first_present(
        item,
        [
            "platform",
            "publisher_platforms",
            "platforms",
        ],
    )

    source_url = (
        facebook_url
        or instagram_url
        or website
        or snapshot
    )

    if (
        page_name
        and (
            page_id
            or facebook_url
        )
    ):

        identity_confidence = (
            "high"
        )

    elif page_name:

        identity_confidence = (
            "medium"
        )

    else:

        identity_confidence = (
            "low"
        )

    result = {
        "entity_type":
            "company",

        "lead_type":
            "company",

        "company_name":
            page_name,

        "name":
            page_name,

        "facebook_url":
            facebook_url,

        "instagram_url":
            instagram_url,

        "website":
            website,

        "meta_ads_page_id":
            page_id,

        "meta_ads_active":
            True,

        "identity_confidence":
            identity_confidence,

        "source_confidence":
            0.85,

        "meta_ads_count":
            1,

        "meta_ads_ad_ids":
            (
                [ad_id]
                if ad_id
                else []
            ),

        "ad_snapshot_url":
            snapshot,

        "ad_text":
            ad_text,

        "meta_ads_texts":
            (
                [ad_text]
                if ad_text
                else []
            ),

        "discovery_signals": [
            "meta_ads_active"
        ],

        # Search relevance information.
        "content":
            " ".join(
                value
                for value
                in [
                    str(
                        page_name
                        or ""
                    ),
                    str(
                        ad_text
                        or ""
                    ),
                ]
                if value
            )[:1000],

        # Do not fake company location.
        "company_country":
            company_country,

        "country":
            company_country,

        # Marché ciblé par la publicité.
        # Ce champ n'est PAS utilisé comme localisation réelle
        # de l'entreprise.
        "market_country":
            None,

        "market_country_code":
            (
                (
                    requested_countries
                    or [DEFAULT_COUNTRY_CODE]
                )[0]
            ),

        "meta_search_query":
            query_text,

        "meta_search_queries":
            ([query_text] if query_text else []),

        # Advertising reach.
        "ad_reached_countries":
            reached_countries,

        "platform":
            platform,

        "source":
            "meta_ads_library",

        "source_label":
            DISPLAY_SOURCE,

        "source_url":
            source_url,

        "raw_url":
            source_url,
    }

    return sanitize_meta_payload(
        result
    )


# ============================================================
# IDENTITY
# ============================================================

def meta_ads_identity_key(
    lead: dict,
) -> str | None:

    page_id = (
        lead.get(
            "meta_ads_page_id"
        )
        or lead.get(
            "page_id"
        )
    )

    if page_id:
        return (
            f"page:{page_id}"
        )

    facebook_url = sanitize_meta_url(
        lead.get(
            "facebook_url"
        )
    )

    if facebook_url:
        return (
            "facebook:"
            + facebook_url
            .rstrip("/")
            .lower()
        )

    name = _normalize_key(
        lead.get(
            "company_name"
        )
        or lead.get(
            "name"
        )
    )

    if not name:
        return None

    return (
        f"name:{name}"
    )


# ============================================================
# MERGE
# ============================================================

def merge_meta_ads_candidate(
    existing: dict,
    new: dict,
) -> dict:

    existing[
        "meta_ads_count"
    ] = (
        int(
            existing.get(
                "meta_ads_count"
            )
            or 1
        )
        +
        int(
            new.get(
                "meta_ads_count"
            )
            or 1
        )
    )

    # ========================================================
    # LIST VALUES
    # ========================================================

    for key in (
        "meta_ads_ad_ids",
        "meta_ads_texts",
        "ad_reached_countries",
        "discovery_signals",
        "meta_search_queries",
    ):

        current = (
            existing.get(
                key
            )
            or []
        )

        incoming = (
            new.get(
                key
            )
            or []
        )

        if not isinstance(
            current,
            list,
        ):

            current = [
                current
            ]

        if not isinstance(
            incoming,
            list,
        ):

            incoming = [
                incoming
            ]

        for value in incoming:

            if (
                value
                and value
                not in current
            ):

                current.append(
                    value
                )

        existing[
            key
        ] = current

    # ========================================================
    # FILL MISSING VALUES
    # ========================================================

    for key in (
        "facebook_url",
        "instagram_url",
        "website",
        "ad_snapshot_url",
        "source_url",
        "raw_url",
        "company_country",
        "country",
        "platform",
    ):

        if (
            not existing.get(
                key
            )
            and new.get(
                key
            )
        ):

            existing[
                key
            ] = new[
                key
            ]

    # ========================================================
    # CONTENT
    # ========================================================

    existing_content = str(
        existing.get(
            "content"
        )
        or ""
    )

    new_content = str(
        new.get(
            "content"
        )
        or ""
    )

    if (
        new_content
        and new_content
        not in existing_content
    ):

        existing[
            "content"
        ] = (
            f"{existing_content} "
            f"{new_content}"
        ).strip()[:1500]

    return sanitize_meta_payload(
        existing
    )


# ============================================================
# DEDUPE
# ============================================================

def dedupe_meta_ads_candidates(
    items: list[dict],
    query_text: str = "",
    requested_countries: list[str] | None = None,
) -> list[dict]:

    grouped = {}

    order = []

    for item in items:

        if not isinstance(
            item,
            dict,
        ):
            continue

        lead = (
            normalize_meta_ads_result(
                item,
                query_text=query_text,
                requested_countries=requested_countries,
            )
        )

        key = (
            meta_ads_identity_key(
                lead
            )
        )

        if not key:
            continue

        if key in grouped:

            grouped[
                key
            ] = (
                merge_meta_ads_candidate(
                    grouped[
                        key
                    ],
                    lead,
                )
            )

            continue

        grouped[
            key
        ] = lead

        order.append(
            key
        )

    return [
        grouped[
            key
        ]
        for key
        in order
    ]


# ============================================================
# TOOL
# ============================================================

class MetaAdsLibraryTool(
    BaseTool
):
    name = (
        "ads_library_search"
    )

    def __init__(
        self,
        client_factory=None,
    ):
        super().__init__()

        self.client_factory = (
            client_factory
        )

        self._schema = None

        self.last_status = (
            "idle"
        )

        self.last_error = ""

    # ========================================================
    # REAL MCP
    # ========================================================

    async def _call_with_real_mcp(
        self,
        query: str | dict,
    ) -> list[dict]:

        try:
            from mcp import (
                ClientSession,
                StdioServerParameters,
            )

            from mcp.client.stdio import (
                stdio_client,
            )

        except Exception as exc:

            raise MetaAdsMCPError(
                "MCP client unavailable"
            ) from exc

        command = getattr(
            settings,
            "META_ADS_MCP_COMMAND",
            "",
        )

        if not command:

            raise MetaAdsMCPError(
                "META_ADS_MCP_COMMAND "
                "is not configured"
            )

        raw_args = getattr(
            settings,
            "META_ADS_MCP_ARGS",
            "",
        ) or ""

        args = shlex.split(
            raw_args
        )

        env = _json_dict(
            getattr(
                settings,
                "META_ADS_MCP_ENV_JSON",
                "{}",
            )
        )

        tool_name = getattr(
            settings,
            "META_ADS_MCP_TOOL_NAME",
            self.name,
        )

        server_params = (
            StdioServerParameters(
                command=command,
                args=args,
                env=env or None,
            )
        )

        async with stdio_client(
            server_params
        ) as (
            read,
            write,
        ):

            async with ClientSession(
                read,
                write,
            ) as session:

                await (
                    session.initialize()
                )

                tools_result = (
                    await session.list_tools()
                )

                tools = [
                    _to_plain_tool(
                        tool
                    )
                    for tool
                    in getattr(
                        tools_result,
                        "tools",
                        [],
                    )
                ]

                selected = next(
                    (
                        tool
                        for tool
                        in tools
                        if tool.get(
                            "name"
                        )
                        == tool_name
                    ),
                    None,
                )

                if not selected:

                    raise MetaAdsMCPError(
                        f"{tool_name} "
                        "not exposed by MCP server"
                    )

                self._schema = (
                    selected.get(
                        "inputSchema"
                    )
                    or {}
                )

                call_args = (
                    build_args_from_schema(
                        self._schema,
                        query,
                    )
                )

                result = (
                    await session.call_tool(
                        tool_name,
                        call_args,
                    )
                )

                error = (
                    _error_from_mcp_result(
                        result
                    )
                )

                if error:

                    raise MetaAdsMCPError(
                        error
                    )

                return (
                    _items_from_mcp_result(
                        result
                    )
                )

    # ========================================================
    # MCP WRAPPER
    # ========================================================

    async def _call_mcp(
        self,
        query: str | dict,
    ) -> list[dict]:

        if self.client_factory:

            client = (
                self.client_factory()
            )

            schema = (
                await client.get_tool_schema(
                    self.name
                )
            )

            self._schema = (
                schema
            )

            args = (
                build_args_from_schema(
                    schema,
                    query,
                )
            )

            result = (
                await client.call_tool(
                    self.name,
                    args,
                )
            )

            if isinstance(
                result,
                list,
            ):

                return result

            if isinstance(
                result,
                dict,
            ):

                return [
                    result
                ]

            return []

        timeout = int(
            getattr(
                settings,
                "META_ADS_MCP_TIMEOUT_SECONDS",
                20,
            )
            or 20
        )

        return await asyncio.wait_for(
            self._call_with_real_mcp(
                query
            ),
            timeout=timeout,
        )

    # ========================================================
    # RUN
    # ========================================================

    async def run(
        self,
        query: str | dict,
    ) -> list[dict]:

        self.last_status = (
            "running"
        )

        self.last_error = ""

        # ====================================================
        # QUERY
        # ====================================================

        if isinstance(
            query,
            dict,
        ):

            query_text = str(
                query.get("q")
                or query.get(
                    "query"
                )
                or ""
            ).strip()

        else:

            query_text = str(
                query
                or ""
            ).strip()

        if not query_text:

            self.last_status = (
                "error"
            )

            self.last_error = (
                "Meta Ads query is empty"
            )

            return []

        # ====================================================
        # CALL
        # ====================================================

        try:

            raw_items = (
                await self._call_mcp(
                    query
                )
            )

        except asyncio.TimeoutError:

            self.last_status = (
                "unavailable"
            )

            self.last_error = (
                "Meta Ads MCP timeout"
            )

            logger.warning(
                "[META_ADS] MCP timeout"
            )

            return []

        except MetaAdsMCPError as exc:

            self.last_status = (
                "unavailable"
            )

            self.last_error = (
                str(exc)[:400]
            )

            logger.warning(
                "[META_ADS] "
                "MCP unavailable: %s",
                self.last_error,
            )

            return []

        except Exception as exc:

            self.last_status = (
                "error"
            )

            self.last_error = (
                "Meta Ads unexpected error: "
                f"{exc.__class__.__name__}"
            )

            logger.exception(
                "[META_ADS] "
                "Unexpected error"
            )

            return []

        # ====================================================
        # NORMALIZE + DEDUPE
        # ====================================================

        valid_items = [
            item
            for item
            in raw_items
            if isinstance(
                item,
                dict,
            )
        ]

        requested_countries = (
            _requested_countries(
                query
            )
        )

        candidates = (
            dedupe_meta_ads_candidates(
                valid_items,
                query_text=query_text,
                requested_countries=requested_countries,
            )
        )

        # ====================================================
        # FORWARD ALL NORMALIZED ADVERTISERS TO GEMINI
        # ====================================================
        #
        # Ce tool ne décide plus si l'annonceur appartient au secteur.
        # Son rôle est strictement :
        # - récupérer les annonces ;
        # - normaliser ;
        # - regrouper par annonceur ;
        # - conserver les preuves publicitaires.
        #
        # La compréhension métier appartient à GeminiBrain.
        # ====================================================

        forwarded_candidates = []

        for candidate in candidates:
            if not (
                candidate.get("company_name")
                or candidate.get("name")
            ):
                continue

            candidate[
                "meta_requires_external_verification"
            ] = True

            candidate[
                "verification_required"
            ] = True

            candidate[
                "verification_source"
            ] = "secondary_source"

            candidate[
                "meta_relevance_confirmed"
            ] = False

            candidate[
                "meta_validation_status"
            ] = "awaiting_gemini_validation"

            # Diagnostic technique uniquement.
            # Aucun score métier n'est calculé ici.
            candidate[
                "meta_evidence_strength"
            ] = "unassessed"

            forwarded_candidates.append(
                candidate
            )

        # Les annonceurs ayant plusieurs publicités sont présentés
        # d'abord à Gemini, sans conclure qu'ils sont plus pertinents.
        forwarded_candidates.sort(
            key=lambda item: (
                int(
                    item.get("meta_ads_count")
                    or 0
                ),
                bool(
                    item.get("website")
                ),
                bool(
                    item.get("facebook_url")
                ),
            ),
            reverse=True,
        )

        requested_limit = _requested_limit(
            query
        )

        forwarded_candidates = (
            forwarded_candidates[
                :requested_limit
            ]
        )

        self.last_status = "ok"
        self.last_error = ""

        logger.info(
            "[META_ADS] "
            "query=%s raw=%s advertisers=%s "
            "forwarded_to_gemini=%s countries=%s",
            query_text,
            len(valid_items),
            len(candidates),
            len(forwarded_candidates),
            requested_countries,
        )

        return forwarded_candidates