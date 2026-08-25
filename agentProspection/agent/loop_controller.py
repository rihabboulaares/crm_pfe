import logging

from django.conf import settings

from agentProspection.agent.brain import (
    GeminiBrain,
    build_meta_ads_queries,
    build_search_plan,
    build_search_query,
    meta_ads_country_codes,
)
from agentProspection.agent.fusion_engine import (
    is_same_company,
    is_same_person,
    merge_leads,
)
from agentProspection.agent.lead_classifier import (
    classify_lead_type,
    qualify_entity,
)
from agentProspection.agent.memory import (
    AgentMemory,
)
from agentProspection.agent.tool_registry import (
    normalize_tool_name,
    source_to_tool,
)
from agentProspection.crm.importer import (
    import_leads_to_crm,
)
from agentProspection.tools.maps_tool import (
    MapsTool,
)
from agentProspection.tools.meta_ads_tool import (
    MetaAdsLibraryTool,
)
from agentProspection.tools.serper_tool import (
    SerperTool,
)


logger = logging.getLogger(
    __name__
)


# ============================================================
# TOOL REGISTRY - ONE REGISTRY PER RUN
# ============================================================

def build_tools() -> dict:
    """
    Construit un registre d'outils indépendant pour un seul run.

    SerperTool, MapsTool et MetaAdsLibraryTool conservent un état
    mutable (notamment last_status / last_error). Ils ne doivent
    donc pas être partagés entre deux requêtes concurrentes.

    Les quatre variantes Serper partagent volontairement UNE même
    instance à l'intérieur d'un run, mais jamais entre deux runs.
    """
    serper_tool = SerperTool()
    maps_tool = MapsTool()
    meta_ads_tool = MetaAdsLibraryTool()

    return {
        "serper_linkedin": serper_tool,
        "serper_facebook": serper_tool,
        "serper_instagram": serper_tool,
        "serper_general": serper_tool,
        "maps_search": maps_tool,
        "maps": maps_tool,
        "ads_library_search": meta_ads_tool,
    }


# Compatibilité avec d'anciens tests/imports éventuels.
# Le code de production n'utilise jamais ce dictionnaire comme
# registre global partagé : run_agent() crée son propre registre.
TOOLS: dict = {}


# ============================================================
# BASIC HELPERS
# ============================================================

def is_company(
    lead: dict,
) -> bool:
    return (
        lead.get("lead_type")
        == "company"
    )


def is_person(
    lead: dict,
) -> bool:
    return (
        lead.get("lead_type")
        == "person"
    )


def imported_count(
    import_stats: dict | None,
) -> int:
    stats = (
        import_stats
        or {}
    )

    return (
        int(
            stats.get(
                "companies_created",
                0,
            )
            or 0
        )
        +
        int(
            stats.get(
                "companies_updated",
                0,
            )
            or 0
        )
        +
        int(
            stats.get(
                "persons_created",
                0,
            )
            or 0
        )
        +
        int(
            stats.get(
                "persons_updated",
                0,
            )
            or 0
        )
    )


def valid_prospect_count(
    memory: AgentMemory,
) -> int:
    companies, persons = (
        memory.crm_ready_entities()
    )

    return (
        len(companies)
        + len(persons)
    )


def requested_lead_type(
    intent: dict | None,
) -> str | None:
    intent = (
        intent
        or {}
    )

    lead_types = (
        intent.get(
            "lead_types"
        )
        or []
    )

    if len(
        lead_types
    ) != 1:
        return None

    value = str(
        lead_types[0]
    ).strip().lower()

    if value in {
        "person",
        "company",
    }:
        return value

    return None


def requested_industry(
    intent: dict | None,
) -> str:
    intent = (
        intent
        or {}
    )

    industries = (
        intent.get(
            "industries"
        )
        or []
    )

    if not industries:
        return ""

    return str(
        industries[0]
        or ""
    ).strip()


def requested_location(
    intent: dict | None,
) -> str:
    intent = (
        intent
        or {}
    )

    locations = (
        intent.get(
            "locations"
        )
        or []
    )

    if not locations:
        return "Tunisie"

    return str(
        locations[0]
        or "Tunisie"
    ).strip()


# ============================================================
# REJECTION DIAGNOSTIC
# ============================================================

def log_rejected_diagnostics(
    memory: AgentMemory,
):
    """
    Affiche dans les logs Django un diagnostic lisible des
    prospects rejetés.

    Ce diagnostic sert uniquement au développement / debug.
    Il ne modifie jamais la décision du classifier.

    Les données affichées sont limitées aux champs utiles
    pour comprendre un rejet :
    - identité ;
    - source ;
    - localisation ;
    - secteur ;
    - moyens de contact ;
    - raison de rejet.
    """

    if not settings.DEBUG:
        return

    rejected_results = list(
        memory.rejected_results
        or []
    )

    logger.info(
        "========== DISCOVERY DIAGNOSTIC =========="
    )

    logger.info(
        "[DISCOVERY][DIAGNOSTIC] valid=%s rejected=%s pending=%s iterations=%s",
        valid_prospect_count(memory),
        len(rejected_results),
        len(memory.pending_verification),
        memory.iterations,
    )

    for index, rejected in enumerate(
        rejected_results,
        start=1,
    ):
        if not isinstance(
            rejected,
            dict,
        ):
            continue

        logger.info(
            (
                "[DISCOVERY][REJECTED %s] "
                "company_name=%r | "
                "full_name=%r | "
                "source=%r | "
                "source_label=%r | "
                "facebook_url=%r | "
                "instagram_url=%r | "
                "linkedin_url=%r | "
                "city=%r | "
                "country=%r | "
                "location_status=%r | "
                "sector_match=%r | "
                "sector_match_origin=%r | "
                "semantic_confidence=%r | "
                "phone=%r | "
                "email=%r | "
                "website=%r | "
                "crm_ready=%r | "
                "reason=%r"
            ),
            index,
            rejected.get(
                "company_name"
            ),
            rejected.get(
                "full_name"
            ),
            rejected.get(
                "source"
            ),
            rejected.get(
                "source_label"
            ),
            rejected.get(
                "facebook_url"
            ),
            rejected.get(
                "instagram_url"
            ),
            rejected.get(
                "linkedin_url"
            ),
            rejected.get(
                "city"
            ),
            rejected.get(
                "country"
            ),
            rejected.get(
                "location_status"
            ),
            rejected.get(
                "sector_match"
            ),
            rejected.get(
                "sector_match_origin"
            ),
            (
                rejected.get("semantic_validation")
                or {}
            ).get("confidence"),
            rejected.get(
                "phone"
            ),
            rejected.get(
                "email"
            ),
            rejected.get(
                "website"
            ),
            rejected.get(
                "crm_ready"
            ),
            (
                rejected.get(
                    "rejection_reason"
                )
                or rejected.get(
                    "rejected_reason"
                )
                or "raison_inconnue"
            ),
        )

    logger.info(
        "=========================================="
    )


# ============================================================
# IMPORT ERRORS
# ============================================================

def log_import_errors(
    import_stats: dict | None,
):
    if not settings.DEBUG:
        return

    for error in (
        import_stats
        or {}
    ).get(
        "errors"
    ) or []:

        logger.error(
            "[DISCOVERY][CRM_IMPORT] "
            "type=%s message=%s",
            error.get(
                "error_type"
            )
            or "Unknown",
            error.get(
                "message"
            )
            or "",
        )


def attach_import_errors(
    memory: AgentMemory,
    import_stats: dict | None,
):
    for error in (
        import_stats
        or {}
    ).get(
        "errors"
    ) or []:

        memory.add_error(
            "crm_import",
            (
                error.get(
                    "message"
                )
                or error.get(
                    "error_type"
                )
                or "Import CRM impossible"
            ),
        )


# ============================================================
# LEAD NORMALIZATION
# ============================================================

def normalize_lead(
    lead: dict,
    source: str,
) -> dict:
    lead = dict(
        lead
        or {}
    )

    lead[
        "source"
    ] = (
        lead.get(
            "source"
        )
        or source
    )

    # Identifiant stable utilisé uniquement pour faire correspondre
    # la réponse de validation Gemini au candidat du lot courant.
    if not lead.get("candidate_id"):
        identity = (
            lead.get("company_name")
            or lead.get("full_name")
            or lead.get("page_name")
            or lead.get("advertiser_name")
            or lead.get("source_url")
            or lead.get("raw_url")
            or ""
        )
        lead["candidate_id"] = (
            f"{source}:{identity}".strip()[:120]
        )

    defaults = {
        "company_name":
            None,

        "first_name":
            None,

        "last_name":
            None,

        "full_name":
            None,

        "title":
            None,

        "job_title":
            None,

        "phone":
            None,

        "email":
            None,

        "website":
            None,

        "city":
            None,

        "country":
            None,

        "address":
            None,

        "linkedin_url":
            None,

        "facebook_url":
            None,

        "instagram_url":
            None,

        "google_place_id":
            None,

        "google_maps_url":
            None,

        "maps_url":
            None,

        "latitude":
            None,

        "longitude":
            None,

        "source_label":
            None,

        "raw_url":
            None,

        "source_url":
            None,

        "profile_url":
            None,

        "content":
            None,
    }

    for key, value in (
        defaults.items()
    ):
        lead.setdefault(
            key,
            value,
        )

    # ========================================================
    # JOB TITLE
    # ========================================================

    if not lead.get(
        "job_title"
    ):
        lead[
            "job_title"
        ] = (
            lead.get(
                "title"
            )
        )

    # ========================================================
    # MAP URL
    # ========================================================

    if not lead.get(
        "maps_url"
    ):
        lead[
            "maps_url"
        ] = (
            lead.get(
                "google_maps_url"
            )
        )

    # ========================================================
    # SOURCE URL
    # ========================================================

    if not lead.get(
        "source_url"
    ):
        lead[
            "source_url"
        ] = (
            lead.get(
                "raw_url"
            )
            or lead.get(
                "linkedin_url"
            )
            or lead.get(
                "facebook_url"
            )
            or lead.get(
                "instagram_url"
            )
            or lead.get(
                "website"
            )
            or lead.get(
                "google_maps_url"
            )
        )

    if not lead.get(
        "profile_url"
    ):
        lead[
            "profile_url"
        ] = (
            lead.get(
                "source_url"
            )
        )

    # ========================================================
    # SOURCE NORMALIZATION
    # ========================================================

    source_value = str(
        lead.get("source")
        or source
        or ""
    ).strip().lower()

    if source_value in {
        "maps",
        "google_maps",
        "maps_search",
    }:
        lead[
            "source"
        ] = "google_maps"

        lead[
            "source_label"
        ] = "Google Maps"

    elif source_value in {
        "meta_ads",
        "meta_ads_library",
        "ads_library_search",
    }:
        lead[
            "source"
        ] = "meta_ads_library"

        lead[
            "source_label"
        ] = "Meta Ads Library"

    elif source_value == (
        "serper_linkedin"
    ):
        lead[
            "source_label"
        ] = "Serper LinkedIn"

    elif source_value == (
        "serper_facebook"
    ):
        lead[
            "source_label"
        ] = "Serper Facebook"

    elif source_value == (
        "serper_instagram"
    ):
        lead[
            "source_label"
        ] = "Serper Instagram"

    elif source_value == (
        "serper_general"
    ):
        lead[
            "source_label"
        ] = "Serper General"

    # ========================================================
    # MAP LOCATION
    # ========================================================

    latitude = (
        lead.get(
            "latitude"
        )
    )

    longitude = (
        lead.get(
            "longitude"
        )
    )

    if (
        latitude is not None
        and longitude is not None
        and not lead.get(
            "map_location"
        )
    ):
        lead[
            "map_location"
        ] = {
            "lat":
                latitude,

            "lng":
                longitude,

            "address":
                lead.get(
                    "address"
                ),

            "google_maps_url":
                (
                    lead.get(
                        "google_maps_url"
                    )
                    or lead.get(
                        "maps_url"
                    )
                ),
        }

    # ========================================================
    # LEAD TYPE
    # ========================================================

    if (
        lead.get(
            "lead_type"
        )
        not in {
            "person",
            "company",
        }
    ):
        lead[
            "lead_type"
        ] = (
            classify_lead_type(
                lead
            )
        )

    return lead


# ============================================================
# MERGE
# ============================================================

def add_or_merge_company(
    companies: list[dict],
    lead: dict,
):
    for existing in companies:

        if is_same_company(
            existing,
            lead,
        ):
            merge_leads(
                existing,
                lead,
            )

            return (
                existing
            )

    companies.append(
        lead
    )

    return lead


def add_or_merge_person(
    persons: list[dict],
    lead: dict,
):
    for existing in persons:

        if is_same_person(
            existing,
            lead,
        ):
            merge_leads(
                existing,
                lead,
            )

            return (
                existing
            )

    persons.append(
        lead
    )

    return lead


# ============================================================
# META ADS PENDING HELPERS
# ============================================================

def find_pending_meta_match(
    memory: AgentMemory,
    lead: dict,
) -> dict | None:
    if not is_company(
        lead
    ):
        return None

    for candidate in (
        memory.pending_verification
    ):
        if is_same_company(
            candidate,
            lead,
        ):
            return (
                candidate
            )

    return None


def pending_meta_exists(
    memory: AgentMemory,
    candidate: dict,
) -> bool:
    """Déduplique les annonceurs Meta Ads trouvés par plusieurs variantes."""
    if not is_company(candidate):
        return False

    for existing in memory.pending_verification:
        if is_same_company(existing, candidate):
            merge_leads(existing, candidate)
            return True

    return False


def remove_pending_candidate(
    memory: AgentMemory,
    candidate: dict,
):
    try:
        memory.pending_verification.remove(
            candidate
        )

    except ValueError:
        pass


def merge_verified_meta_candidate(
    candidate: dict,
    evidence: dict,
) -> dict:
    """
    Fusionne un candidat Meta Ads avec une preuve provenant
    d'une deuxième source.

    IMPORTANT :
    après confirmation, la source principale devient la source
    de vérification afin que lead_classifier ne traite plus
    l'entité comme "Meta Ads seul".

    Les informations Meta restent dans `sources`.
    """

    meta_source = (
        candidate.get(
            "source"
        )
        or "meta_ads_library"
    )

    evidence_source = (
        evidence.get(
            "source"
        )
        or "serper_general"
    )

    sources = []

    for value in (
        candidate.get(
            "sources"
        )
        or []
    ):
        if (
            value
            and value not in sources
        ):
            sources.append(
                value
            )

    for value in (
        meta_source,
        evidence_source,
    ):
        if (
            value
            and value not in sources
        ):
            sources.append(
                value
            )

    merge_leads(
        candidate,
        evidence,
    )

    candidate[
        "sources"
    ] = sources

    # Crucial :
    # ce n'est plus "Meta Ads seul".
    candidate[
        "source"
    ] = evidence_source

    candidate[
        "source_label"
    ] = (
        evidence.get(
            "source_label"
        )
        or candidate.get(
            "source_label"
        )
    )

    candidate[
        "verification_required"
    ] = False

    candidate[
        "verification_source"
    ] = evidence_source

    # Marque explicitement qu'une deuxième source indépendante
    # a confirmé l'identité / activité du candidat Meta.
    candidate[
        "meta_secondary_verified"
    ] = True

    candidate[
        "verification_status"
    ] = "verified"

    verification_sources = list(
        candidate.get(
            "verification_sources"
        )
        or []
    )

    if (
        evidence_source
        not in verification_sources
    ):
        verification_sources.append(
            evidence_source
        )

    candidate[
        "verification_sources"
    ] = verification_sources

    return candidate


# ============================================================
# SINGLE TOOL EXECUTION
# ============================================================

async def execute_single_tool(
    tool_name: str,
    tool_query,
    tools: dict | None = None,
    user_id: int | None = None,
):
    """Exécute un outil appartenant au registre du run courant."""
    normalized_tool = normalize_tool_name(tool_name)
    runtime_tools = tools if tools is not None else build_tools()
    tool = runtime_tools.get(normalized_tool)

    if not tool:
        raise RuntimeError(f"Tool introuvable: {normalized_tool}")

    if normalized_tool.startswith("serper_"):
        platform = normalized_tool.replace("serper_", "", 1)
        return await tool.run(tool_query, platform=platform)

    if normalized_tool == "ads_library_search":
        return await tool.run(tool_query)

    if normalized_tool in {"maps", "maps_search"}:
        if isinstance(tool_query, dict):
            query_text = tool_query.get("q") or tool_query.get("query") or ""
        else:
            query_text = str(tool_query or "")
        return await tool.run(query_text)

    raise RuntimeError(f"Tool non supporté: {normalized_tool}")

# ============================================================
# TOOL WRAPPER
# ============================================================

async def execute_tool(
    tool_name: str,
    tool_query,
    tools: dict | None = None,
    user_id: int | None = None,
) -> dict:
    """
    Wrapper normalisé autour des outils du run courant.

    `tools` doit être fourni par run_agent() en production. Le fallback
    build_tools() existe uniquement pour préserver les appels directs
    de tests/console et crée alors un registre isolé pour cet appel.
    """
    normalized_tool = normalize_tool_name(tool_name)
    runtime_tools = tools if tools is not None else build_tools()

    try:
        results = await execute_single_tool(
            normalized_tool,
            tool_query,
            tools=runtime_tools,
            user_id=user_id,
        )

        if isinstance(results, dict):
            results = [results]
        elif not isinstance(results, list):
            results = []

        tool = runtime_tools.get(normalized_tool)
        status_value = str(
            getattr(tool, "last_status", "ok") if tool else "ok"
        ).lower()
        error_message = getattr(tool, "last_error", "") if tool else ""

        errors = []
        if status_value in {"error", "unavailable"} and error_message:
            errors.append(str(error_message)[:400])

        success = status_value not in {"error", "unavailable"}

        return {
            "success": success,
            "tool": normalized_tool,
            "status": status_value,
            "results": results,
            "errors": errors,
            "metadata": {"query": tool_query},
        }

    except Exception as exc:
        reason = str(exc)[:400]
        logger.warning(
            "[DISCOVERY][TOOL_ERROR] tool=%s error=%s",
            normalized_tool,
            reason,
        )
        return {
            "success": False,
            "tool": normalized_tool,
            "status": "error",
            "results": [],
            "errors": [reason],
            "metadata": {"query": tool_query},
        }

# ============================================================
# OBSERVATION
# ============================================================

META_SEMANTIC_DIRECT_REJECT_CONFIDENCE = 0.70
META_SEMANTIC_MIN_PLAUSIBLE_CONFIDENCE = 0.30
META_SEMANTIC_TRUE_MIN_CONFIDENCE = 0.40


def _is_meta_ads_lead(
    lead: dict,
) -> bool:
    source = str(
        lead.get("source")
        or ""
    ).strip().lower()

    return source in {
        "meta_ads",
        "meta_ads_library",
        "ads_library_search",
    }


def meta_semantic_gate(
    lead: dict,
) -> tuple[str, str]:
    """
    Décide uniquement si un candidat Meta mérite une vérification Serper.

    Retour :
    - ("verify", reason) : candidat plausible ou ambigu ;
    - ("reject", reason) : candidat clairement hors cible / sans signal ;
    - ("normal", reason) : non-Meta, ne change rien au pipeline.

    Aucun secteur n'est codé en dur.
    """

    if not _is_meta_ads_lead(
        lead
    ):
        return (
            "normal",
            "",
        )

    validation = (
        lead.get(
            "semantic_validation"
        )
        or {}
    )

    if not isinstance(
        validation,
        dict,
    ) or not validation:
        return (
            "reject",
            "Validation Gemini Meta Ads absente ou inexploitable",
        )

    try:
        confidence = float(
            validation.get(
                "confidence"
            )
            or 0.0
        )
    except (
        TypeError,
        ValueError,
    ):
        confidence = 0.0

    sector_match = bool(
        validation.get(
            "sector_match"
        )
    )

    reason = str(
        validation.get(
            "reason"
        )
        or ""
    ).strip()

    # Candidat jugé plausible par Gemini :
    # une seconde source doit encore le confirmer.
    if (
        sector_match
        and confidence
        >= META_SEMANTIC_TRUE_MIN_CONFIDENCE
    ):
        return (
            "verify",
            reason
            or "Activité Meta Ads sémantiquement compatible",
        )

    # Gemini est suffisamment certain que l'activité ne correspond pas.
    if (
        not sector_match
        and confidence
        >= META_SEMANTIC_DIRECT_REJECT_CONFIDENCE
    ):
        return (
            "reject",
            reason
            or "Secteur incompatible selon Gemini",
        )

    # Très peu de signal : ne pas gaspiller Facebook/Web sur un
    # annonceur arbitraire.
    if confidence < META_SEMANTIC_MIN_PLAUSIBLE_CONFIDENCE:
        return (
            "reject",
            reason
            or "Preuves Meta Ads trop faibles",
        )

    # Cas réellement ambigu : on autorise Serper à trancher.
    return (
        "verify",
        reason
        or "Candidat Meta Ads ambigu à vérifier",
    )


async def observe_tool_result(
    memory: AgentMemory,
    standard_result: dict,
    brain: GeminiBrain,
):
    """
    Normalise d'abord tout le lot, demande ensuite à Gemini une
    validation sémantique générique, puis applique qualify_entity().

    Les règles déterministes restent dans lead_classifier.py.
    Gemini ne fait ni import CRM ni décision CRM-ready directe.
    """
    tool_name = (
        standard_result.get("tool")
        or "unknown"
    )

    results = (
        standard_result.get("results")
        or []
    )

    memory.raw_results.append(
        standard_result
    )

    for error in (
        standard_result.get("errors")
        or []
    ):
        memory.add_error(
            "tool_error",
            f"{tool_name}: {error}",
        )

    accepted = 0
    rejected = 0
    pending = 0

    normalized_leads: list[dict] = []

    for raw_item in results:
        if not isinstance(raw_item, dict):
            continue

        normalized_leads.append(
            normalize_lead(
                raw_item,
                tool_name,
            )
        )

    # Validation sémantique en lot avant la qualification finale.
    if normalized_leads:
        normalized_leads = await brain.validate_candidates(
            memory.intent or {},
            normalized_leads,
        )

    for lead in normalized_leads:
        qualify_entity(
            lead,
            memory.intent or {},
        )

        if (
            not lead.get("crm_ready")
            and lead.get("verification_required")
        ):
            gate_action, gate_reason = (
                meta_semantic_gate(
                    lead
                )
            )

            # Ce bloc supplémentaire ne concerne que Meta Ads.
            if gate_action == "reject":
                lead[
                    "meta_validation_status"
                ] = "rejected_by_gemini_prevalidation"

                lead[
                    "rejected_reason"
                ] = (
                    gate_reason
                    or lead.get(
                        "rejection_reason"
                    )
                    or "Annonceur Meta Ads non pertinent"
                )

                memory.rejected_results.append(
                    lead
                )

                rejected += 1
                continue

            if gate_action == "verify":
                lead[
                    "meta_validation_status"
                ] = "pending_secondary_verification"

            if not pending_meta_exists(
                memory,
                lead,
            ):
                memory.add_pending_verification(
                    lead
                )

            pending += 1
            continue

        if not lead.get("crm_ready"):
            lead["rejected_reason"] = (
                lead.get("rejection_reason")
                or "Prospect non pertinent"
            )
            memory.rejected_results.append(lead)
            rejected += 1
            continue

        if is_person(lead):
            add_or_merge_person(
                memory.persons,
                lead,
            )
            accepted += 1
            continue

        if is_company(lead):
            pending_meta = find_pending_meta_match(
                memory,
                lead,
            )

            if pending_meta:
                verified = merge_verified_meta_candidate(
                    pending_meta,
                    lead,
                )

                # La fusion peut modifier les preuves. On conserve la
                # validation du lead secondaire et requalifie l'ensemble.
                qualify_entity(
                    verified,
                    memory.intent or {},
                )

                if verified.get("crm_ready"):
                    add_or_merge_company(
                        memory.companies,
                        verified,
                    )
                    remove_pending_candidate(
                        memory,
                        pending_meta,
                    )
                    memory.verification_history.append(
                        {
                            "company_name": verified.get("company_name"),
                            "verified": True,
                            "source": lead.get("source"),
                            "mode": "planned_source",
                        }
                    )
                    accepted += 1
                    continue

            add_or_merge_company(
                memory.companies,
                lead,
            )
            accepted += 1
            continue

        lead["rejected_reason"] = "Type d'entité inconnu"
        memory.rejected_results.append(lead)
        rejected += 1

    memory.refresh_prospects()

    memory.add_log(
        "observe",
        (
            f"{len(results)} résultats avec {tool_name}. "
            f"Acceptés={accepted}, "
            f"Pending={pending}, "
            f"Rejetés={rejected}, "
            f"Companies={len(memory.companies)}, "
            f"Persons={len(memory.persons)}"
        ),
    )


# ============================================================
# PLAN ITEM QUERY
# ============================================================

def plan_item_query(
    item: dict,
    intent: dict,
) -> dict:
    query = {
        "q":
            item.get(
                "query"
            )
            or "",

        "page":
            max(
                1,
                int(
                    item.get(
                        "page"
                    )
                    or 1
                ),
            ),
    }

    lead_type = (
        requested_lead_type(
            intent
        )
    )

    if lead_type:
        query[
            "lead_type"
        ] = lead_type

    tool = (
        normalize_tool_name(
            item.get(
                "tool"
            )
            or source_to_tool(
                item.get(
                    "source"
                )
            )
        )
    )

    if (
        tool
        == "ads_library_search"
    ):
        countries = (
            item.get(
                "countries"
            )
            or meta_ads_country_codes(
                intent
            )
        )

        if countries:
            query[
                "ad_reached_countries"
            ] = countries

    return query


# ============================================================
# SEARCH PLAN
# ============================================================


async def execute_search_plan(
    memory: AgentMemory,
    brain: GeminiBrain,
    tools: dict | None = None,
) -> list[dict]:
    runtime_tools = tools if tools is not None else build_tools()
    """Exécute le plan initial, avec jusqu'à 3 variantes pour Meta Ads."""
    plan = memory.plan or {}
    searches = (plan.get("searches") or [])[:2]
    target = max(1, int(plan.get("target_total") or memory.max_leads or 10))
    source_forced = bool(plan.get("source_forced"))
    executed: list[dict] = []

    for item in searches:
        if not source_forced and valid_prospect_count(memory) >= target:
            break

        tool_name = normalize_tool_name(
            item.get("tool") or source_to_tool(item.get("source"))
        )
        if not tool_name:
            memory.add_error("plan", f"Impossible de résoudre l'outil pour {item}")
            continue

        if tool_name == "ads_library_search":
            queries = item.get("queries") or [item.get("query")]
            queries = [
                str(v).strip()
                for v in queries
                if str(v or "").strip()
            ][:4]

            for query_text in queries:
                if valid_prospect_count(memory) >= target:
                    break
                if memory.iterations >= memory.max_iterations:
                    break

                tool_query = {
                    "q": query_text,
                    "page": 1,
                    "lead_type": "company",
                    "ad_reached_countries": item.get("countries") or ["TN"],
                }
                if memory.already_used(tool_name, tool_query):
                    continue

                memory.add_tool_call(
                    tool_name,
                    tool_query,
                    {
                        "decision": "planned_search",
                        "reason": "Recherche Meta Ads avec variante métier.",
                    },
                )
                memory.set_phase("searching")
                result = await execute_tool(tool_name, tool_query, tools=runtime_tools, user_id=memory.user_id)
                await observe_tool_result(memory, result, brain)
                memory.iterations += 1
                executed.append({
                    "tool": tool_name,
                    "query": tool_query,
                    "results_count": len(result.get("results") or []),
                    "success": bool(result.get("success")),
                    "status": result.get("status"),
                })
            continue

        tool_query = plan_item_query(item, memory.intent or {})
        if not str(tool_query.get("q") or "").strip():
            continue
        if memory.already_used(tool_name, tool_query):
            continue

        memory.add_tool_call(
            tool_name,
            tool_query,
            {"decision": "planned_search", "reason": "Search Plan Discovery."},
        )
        memory.set_phase("searching")
        result = await execute_tool(tool_name, tool_query, tools=runtime_tools, user_id=memory.user_id)
        await observe_tool_result(memory, result, brain)
        memory.iterations += 1
        executed.append({
            "tool": tool_name,
            "query": tool_query,
            "results_count": len(result.get("results") or []),
            "success": bool(result.get("success")),
            "status": result.get("status"),
        })

    return executed



# ============================================================
# META ADS SECONDARY VERIFICATION
# ============================================================

def _candidate_company_name(candidate: dict) -> str:
    return str(
        candidate.get("company_name")
        or candidate.get("page_name")
        or candidate.get("advertiser_name")
        or ""
    ).strip()


def _normalized_text(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def meta_candidate_priority(candidate: dict, intent: dict | None = None) -> tuple:
    """
    Classe les candidats Meta Ads avant de consommer des appels Serper.
    Cette fonction ne valide pas un prospect : elle détermine uniquement
    l'ordre de vérification.
    """
    intent = intent or {}
    name = _normalized_text(_candidate_company_name(candidate))
    content = _normalized_text(
        candidate.get("content")
        or candidate.get("ad_creative_body")
        or candidate.get("ad_text")
        or candidate.get("description")
        or ""
    )
    haystack = f"{name} {content}".strip()

    keywords: list[str] = []
    for value in (
        list(intent.get("industries") or [])
        + list(intent.get("search_keywords") or [])
    ):
        token = _normalized_text(value)
        if token and token not in keywords:
            keywords.append(token)

    keyword_hits = sum(1 for keyword in keywords if keyword in haystack)
    identity_score = sum(
        int(bool(candidate.get(field)))
        for field in ("facebook_url", "website", "phone", "email")
    )

    return (-keyword_hits, -identity_score, name)


def build_meta_verification_query(
    candidate: dict,
    intent: dict | None,
    *,
    include_location: bool = True,
) -> str:
    """
    Construit : "Nom entreprise" + secteur + localisation.
    Exemple : "Dianke Furniture" furniture Tunisie
    """
    intent = intent or {}
    company_name = _candidate_company_name(candidate)
    if not company_name:
        return ""

    industry = requested_industry(intent)
    location = requested_location(intent) if include_location else ""

    parts = [f'"{company_name}"']

    if (
        industry
        and _normalized_text(industry) not in _normalized_text(company_name)
    ):
        parts.append(industry)

    if location:
        parts.append(location)

    return " ".join(parts).strip()



def _meta_verification_evidence_text(
    evidence: dict,
) -> str:
    """
    Texte utilisé UNIQUEMENT pour rapprocher un résultat Serper
    d'un annonceur Meta pendant la vérification secondaire.

    On ne modifie pas `is_same_company()` globalement afin de ne pas
    affecter la déduplication/fusion des autres outils.
    """
    values = [
        evidence.get("company_name"),
        evidence.get("name"),
        evidence.get("page_name"),
        evidence.get("advertiser_name"),
        evidence.get("title"),
        evidence.get("content_title"),
        evidence.get("headline"),
        evidence.get("description"),
        evidence.get("snippet"),
        evidence.get("content"),
        evidence.get("source_url"),
        evidence.get("raw_url"),
        evidence.get("facebook_url"),
        evidence.get("instagram_url"),
        evidence.get("website"),
    ]

    return _normalized_text(
        " ".join(
            str(value or "")
            for value in values
            if value
        )
    )


def meta_verification_identity_match(
    candidate: dict,
    evidence: dict,
) -> bool:
    """
    Matching d'identité réservé à la vérification Meta Ads.

    Pourquoi :
    un résultat Serper peut contenir le vrai nom de l'entreprise dans
    `title`, `snippet` ou `content` sans renseigner `company_name`.
    Dans ce cas `is_same_company()` est trop strict et élimine la preuve
    avant même que Gemini puisse l'évaluer.

    Cette fonction ne valide PAS le secteur.
    Elle autorise seulement la preuve à être examinée ensuite par Gemini.
    """

    # 1. Les règles globales restent le signal le plus fort.
    if is_same_company(
        candidate,
        evidence,
    ):
        return True

    company_name = _normalized_text(
        _candidate_company_name(
            candidate
        )
    )

    if not company_name:
        return False

    evidence_text = _meta_verification_evidence_text(
        evidence
    )

    if not evidence_text:
        return False

    # 2. Nom complet explicitement présent dans le résultat Serper.
    if company_name in evidence_text:
        return True

    # 3. Comparaison par tokens pour les titres comme
    #    "Lexxi Digital | Agence ..." ou "Holygo Voyages Tunisie".
    candidate_tokens = [
        token
        for token in company_name.split()
        if len(token) >= 3
    ]

    if not candidate_tokens:
        return False

    evidence_tokens = set(
        evidence_text.split()
    )

    matched = [
        token
        for token in candidate_tokens
        if token in evidence_tokens
    ]

    # Pour un nom composé, on exige tous les tokens significatifs.
    if len(candidate_tokens) >= 2:
        return len(matched) == len(candidate_tokens)

    # Pour une marque en un seul mot, le token doit être suffisamment
    # distinctif. Gemini vérifiera ensuite le secteur.
    token = candidate_tokens[0]

    return (
        len(token) >= 5
        and token in evidence_tokens
    )


async def _try_meta_verification_source(
    memory: AgentMemory,
    brain: GeminiBrain,
    candidate: dict,
    *,
    tool_name: str,
    query_text: str,
    reason: str,
    tools: dict,
) -> dict | None:
    """
    Vérifie un candidat Meta Ads avec une deuxième source.

    Étapes :
    1. appelle Serper sur une requête centrée sur l'identité ;
    2. conserve uniquement les résultats qui correspondent
       réellement à la même entreprise ;
    3. demande à Gemini de valider sémantiquement ces preuves ;
    4. fusionne la meilleure preuve avec le candidat Meta ;
    5. requalifie le candidat fusionné avec les règles normales.

    Important :
    - Meta Ads seul ne devient jamais CRM-ready ;
    - aucun comportement des recherches Serper normales n'est modifié ;
    - cette logique est utilisée uniquement pendant la vérification
      secondaire des candidats Meta Ads.
    """
    if not query_text:
        return None

    tool_query = {
        "q": query_text,
        "page": 1,
        "lead_type": "company",
    }

    if memory.already_used(tool_name, tool_query):
        return None

    memory.add_tool_call(
        tool_name,
        tool_query,
        {
            "decision": "meta_ads_verification",
            "reason": reason,
        },
    )

    memory.set_phase("verification")

    result = await execute_tool(
        tool_name,
        tool_query,
        tools=tools,
        user_id=memory.user_id,
    )

    memory.raw_results.append(result)
    memory.iterations += 1

    evidence_candidates: list[dict] = []

    for raw_item in result.get("results") or []:
        if not isinstance(raw_item, dict):
            continue

        evidence = normalize_lead(
            raw_item,
            tool_name,
        )

        if not is_company(evidence):
            continue

        # Matching réservé à la vérification Meta :
        # Serper peut placer le nom réel dans title/snippet/content
        # plutôt que dans company_name.
        if not meta_verification_identity_match(
            candidate,
            evidence,
        ):
            continue

        evidence_candidates.append(
            evidence
        )

    logger.info(
        "[META_VERIFY] company=%r source=%s raw=%s identity_matches=%s",
        _candidate_company_name(candidate),
        tool_name,
        len(result.get("results") or []),
        len(evidence_candidates),
    )

    if not evidence_candidates:
        return None

    # Gemini valide uniquement les preuves secondaires retenues.
    # Cela ne modifie pas le fonctionnement de Serper ailleurs.
    evidence_candidates = await brain.validate_candidates(
        memory.intent or {},
        evidence_candidates,
    )

    # Prioriser les preuves sémantiques les plus fortes.
    def evidence_priority(item: dict):
        validation = (
            item.get("semantic_validation")
            or {}
        )

        try:
            confidence = float(
                validation.get("confidence")
                or 0.0
            )
        except (TypeError, ValueError):
            confidence = 0.0

        return (
            bool(
                validation.get("sector_match")
            ),
            confidence,
            bool(
                item.get("website")
            ),
            bool(
                item.get("facebook_url")
            ),
            bool(
                item.get("phone")
                or item.get("email")
            ),
        )

    evidence_candidates.sort(
        key=evidence_priority,
        reverse=True,
    )

    for evidence in evidence_candidates:
        validation = (
            evidence.get("semantic_validation")
            or {}
        )

        # Une preuve Gemini explicitement incompatible ne doit jamais
        # confirmer le candidat Meta.
        try:
            semantic_confidence = float(
                validation.get("confidence")
                or 0.0
            )
        except (TypeError, ValueError):
            semantic_confidence = 0.0

        if (
            semantic_confidence >= 0.70
            and validation.get("sector_match") is False
        ):
            continue

        merged_candidate = dict(
            candidate
        )

        verified = merge_verified_meta_candidate(
            merged_candidate,
            evidence,
        )

        # La validation sémantique de la preuve secondaire devient
        # la validation active du candidat fusionné.
        if validation:
            verified[
                "semantic_validation"
            ] = dict(
                validation
            )

        # Conserver la preuve secondaire pour le diagnostic/historique.
        secondary_evidence = list(
            verified.get(
                "verification_evidence"
            )
            or []
        )

        secondary_evidence.append(
            {
                "source":
                    evidence.get(
                        "source"
                    )
                    or tool_name,

                "source_label":
                    evidence.get(
                        "source_label"
                    ),

                "title":
                    evidence.get(
                        "title"
                    )
                    or evidence.get(
                        "content_title"
                    ),

                "snippet":
                    evidence.get(
                        "snippet"
                    )
                    or evidence.get(
                        "description"
                    )
                    or evidence.get(
                        "content"
                    ),

                "website":
                    evidence.get(
                        "website"
                    ),

                "facebook_url":
                    evidence.get(
                        "facebook_url"
                    ),

                "city":
                    evidence.get(
                        "city"
                    ),

                "country":
                    evidence.get(
                        "country"
                    ),
            }
        )

        verified[
            "verification_evidence"
        ] = secondary_evidence

        qualify_entity(
            verified,
            memory.intent or {},
        )

        if verified.get(
            "crm_ready"
        ):
            return verified

    return None


async def verify_pending_meta_ads(
    memory: AgentMemory,
    brain: GeminiBrain,
    tools: dict | None = None,
) -> list[dict]:
    """
    Vérifie les candidats Meta Ads via une seconde source.

    1. Classe les annonceurs les plus prometteurs.
    2. Vérifie Facebook avec nom + secteur.
    3. Vérifie ensuite le Web avec nom + secteur + localisation.
    4. Requalifie après fusion.
    5. Accepte uniquement les prospects devenus CRM-ready.
    """
    runtime_tools = tools if tools is not None else build_tools()

    pending = list(memory.pending_verification)
    if not pending:
        return []

    configured_limit = int(
        getattr(settings, "PROSPECTION_META_VERIFICATION_LIMIT", 15) or 15
    )
    configured_limit = max(1, min(configured_limit, 20))

    pending.sort(
        key=lambda candidate: meta_candidate_priority(
            candidate,
            memory.intent or {},
        )
    )

    history: list[dict] = []

    for candidate in pending[:configured_limit]:
        if valid_prospect_count(memory) >= memory.max_leads:
            break

        if memory.iterations >= memory.max_iterations:
            break

        company_name = _candidate_company_name(candidate)

        if not company_name:
            candidate["rejected_reason"] = "Annonceur Meta Ads sans nom exploitable."
            memory.rejected_results.append(candidate)
            remove_pending_candidate(memory, candidate)
            continue

        industry = requested_industry(memory.intent)
        location = requested_location(memory.intent)

        # 1) Facebook : nom exact + secteur.
        facebook_query = build_meta_verification_query(
            candidate,
            memory.intent or {},
            include_location=False,
        )

        verified = await _try_meta_verification_source(
            memory,
            brain,
            candidate,
            tool_name="serper_facebook",
            query_text=facebook_query,
            reason=(
                "Vérification de l'annonceur Meta Ads sur Facebook "
                "avec son identité et son secteur."
            ),
            tools=runtime_tools,
        )

        if verified and verified.get("crm_ready"):
            add_or_merge_company(memory.companies, verified)
            remove_pending_candidate(memory, candidate)

            item = {
                "company_name": company_name,
                "verified": True,
                "source": "serper_facebook",
                "query": facebook_query,
            }
            history.append(item)
            memory.verification_history.append(item)
            continue

        if memory.iterations >= memory.max_iterations:
            break

        # 2) Web : nom exact + secteur + localisation.
        general_query = build_meta_verification_query(
            candidate,
            memory.intent or {},
            include_location=True,
        )

        verified = await _try_meta_verification_source(
            memory,
            brain,
            candidate,
            tool_name="serper_general",
            query_text=general_query,
            reason=(
                "Facebook insuffisant ; vérification Web avec "
                "nom, secteur et localisation."
            ),
            tools=runtime_tools,
        )

        if verified and verified.get("crm_ready"):
            add_or_merge_company(memory.companies, verified)
            remove_pending_candidate(memory, candidate)

            item = {
                "company_name": company_name,
                "verified": True,
                "source": (
                    verified.get("verification_source")
                    or "serper_general"
                ),
                "query": general_query,
            }
            history.append(item)
            memory.verification_history.append(item)
            continue

        # L'absence de confirmation n'est pas une preuve que
        # l'annonceur est hors secteur. On le retire de la file active
        # mais on conserve un statut "unverified" au lieu de le classer
        # comme faux prospect.
        candidate[
            "verification_required"
        ] = False

        candidate[
            "verification_status"
        ] = "unverified"

        candidate[
            "meta_secondary_verified"
        ] = False

        candidate[
            "rejected_reason"
        ] = (
            "Annonceur Meta Ads non confirmé par une seconde source "
            "avec suffisamment de preuves."
        )

        memory.rejected_results.append(
            candidate
        )

        remove_pending_candidate(
            memory,
            candidate
        )

        item = {
            "company_name": company_name,
            "verified": False,
            "source": None,
            "query": general_query,
            "reason": candidate["rejected_reason"],
            "status": "unverified",
        }

        history.append(item)
        memory.verification_history.append(item)

    memory.refresh_prospects()
    return history


# ============================================================
# ONE EXTRA SEARCH
# ============================================================

async def execute_one_extra_search(
    memory: AgentMemory,
    brain: GeminiBrain,
    tools: dict | None = None,
) -> dict | None:
    runtime_tools = tools if tools is not None else build_tools()
    max_extra_searches = max(
        0,
        int(
            getattr(
                settings,
                "PROSPECTION_MAX_EXTRA_SEARCHES",
                1,
            )
        ),
    )

    if (
        max_extra_searches == 0
    ):
        return None

    if (
        valid_prospect_count(
            memory
        )
        >= memory.max_leads
    ):
        return None

    searches = (
        memory.plan
        or {}
    ).get(
        "searches"
    ) or []

    for item in searches[:2]:

        tool_name = (
            normalize_tool_name(
                item.get(
                    "tool"
                )
                or source_to_tool(
                    item.get(
                        "source"
                    )
                )
            )
        )

        if not (
            tool_name
            and tool_name.startswith(
                "serper_"
            )
        ):
            continue

        query = (
            plan_item_query(
                item,
                memory.intent
                or {},
            )
        )

        query[
            "page"
        ] = 2

        if memory.already_used(
            tool_name,
            query,
        ):
            continue

        memory.add_tool_call(
            tool_name,
            query,
            {
                "decision":
                    "single_extra_search",

                "reason":
                    "Une seule page Serper supplémentaire.",
            },
        )

        result = (
            await execute_tool(
                tool_name,
                query,
                tools=runtime_tools,
                user_id=
                    memory.user_id,
            )
        )

        await observe_tool_result(
            memory,
            result,
            brain,
        )

        memory.iterations += 1

        return {
            "tool":
                tool_name,

            "query":
                query,

            "results_count":
                len(
                    result.get(
                        "results"
                    )
                    or []
                ),

            "success":
                bool(
                    result.get(
                        "success"
                    )
                ),

            "status":
                result.get(
                    "status"
                ),
        }

    return None


# ============================================================
# AGENTIC STRATEGY HELPERS
# ============================================================

def available_decision_actions(
    memory: AgentMemory,
) -> tuple[list[str], list[str]]:
    """Retourne uniquement les actions et sources réellement exécutables."""
    actions: list[str] = []
    intent = memory.intent or {}
    current_sources = set(intent.get("sources") or [])
    source_forced = bool(intent.get("source_forced"))
    lead_type = requested_lead_type(intent)

    if memory.pending_verification:
        actions.append("verify_pending_meta_ads")

    if memory.iterations < memory.max_iterations:
        actions.append("continue_same_strategy")

    if len(intent.get("search_keywords") or []) > 1:
        actions.append("broaden_criteria")

    allowed_sources: list[str] = []
    if not source_forced:
        if lead_type == "person":
            candidates = ["linkedin", "general", "facebook"]
        else:
            candidates = ["linkedin", "general", "facebook", "instagram", "meta_ads"]
            if getattr(settings, "GOOGLE_MAPS_API_KEY", ""):
                candidates.append("maps")

        allowed_sources = [
            source
            for source in candidates
            if source not in current_sources and source_to_tool(source)
        ]
        if allowed_sources:
            actions.append("switch_source")

    actions.append("stop")
    return list(dict.fromkeys(actions)), allowed_sources


async def execute_switched_source(
    memory: AgentMemory,
    source: str,
    brain: GeminiBrain,
    tools: dict | None = None,
):
    runtime_tools = tools if tools is not None else build_tools()
    """Exécute une nouvelle source choisie par Gemini ; Python construit les queries."""
    source = str(source or "").strip()
    tool_name = source_to_tool(source)
    if not tool_name:
        return None

    if source == "meta_ads":
        results = []
        for query_text in build_meta_ads_queries(
            memory.intent or {},
            max_queries=4,
        ):
            if memory.iterations >= memory.max_iterations:
                break
            tool_query = {
                "q": query_text,
                "page": 1,
                "lead_type": "company",
                "ad_reached_countries": ["TN"],
            }
            if memory.already_used(tool_name, tool_query):
                continue
            memory.add_tool_call(tool_name, tool_query, memory.decision)
            result = await execute_tool(tool_name, tool_query, tools=runtime_tools, user_id=memory.user_id)
            await observe_tool_result(memory, result, brain)
            memory.iterations += 1
            results.append(result)
            if valid_prospect_count(memory) >= memory.max_leads:
                break
        return results or None

    query_text = build_search_query(memory.intent or {}, source)
    if not query_text:
        return None
    tool_query = {"q": query_text, "page": 1}
    lead_type = requested_lead_type(memory.intent)
    if lead_type:
        tool_query["lead_type"] = lead_type
    if memory.already_used(tool_name, tool_query):
        return None

    memory.add_tool_call(tool_name, tool_query, memory.decision)
    result = await execute_tool(tool_name, tool_query, tools=runtime_tools, user_id=memory.user_id)
    await observe_tool_result(memory, result, brain)
    memory.iterations += 1
    return result


async def execute_broadened_search(
    memory: AgentMemory,
    brain: GeminiBrain,
    tools: dict | None = None,
):
    runtime_tools = tools if tools is not None else build_tools()
    """Essaie une autre formulation métier sans changer la Tunisie ni le secteur."""
    intent = memory.intent or {}
    keywords = intent.get("search_keywords") or []
    if len(keywords) < 2:
        return None

    searches = (memory.plan or {}).get("searches") or []
    lead_type = requested_lead_type(intent)
    location = requested_location(intent)

    for keyword in keywords[1:]:
        for item in searches[:2]:
            source = item.get("source") or ""
            if source == "meta_ads":
                continue
            tool_name = normalize_tool_name(item.get("tool") or source_to_tool(source))
            if not tool_name:
                continue

            if source == "linkedin" and lead_type == "person":
                roles = intent.get("target_roles") or []
                role = str(roles[0]).strip() if roles else ""
                query_text = " ".join(p for p in [role, str(keyword).strip(), location] if p)
            else:
                query_text = " ".join(p for p in [str(keyword).strip(), location] if p)

            tool_query = {"q": query_text, "page": 1, "lead_type": lead_type or "company"}
            if memory.already_used(tool_name, tool_query):
                continue
            memory.add_tool_call(tool_name, tool_query, memory.decision)
            result = await execute_tool(tool_name, tool_query, tools=runtime_tools, user_id=memory.user_id)
            await observe_tool_result(memory, result, brain)
            memory.iterations += 1
            return result

    return None


# ============================================================
# CRM IMPORT
# ============================================================

async def import_valid_prospects(
    memory: AgentMemory,
    tenant_company_id: int,
    user_id: int,
    max_leads: int,
) -> dict:
    """
    Importe automatiquement dans le CRM tous les prospects validés.

    Règles :
    - seuls les prospects présents dans crm_ready_entities() sont importés ;
    - les prospects rejetés ne sont jamais importés ;
    - les prospects en attente de vérification ne sont jamais importés ;
    - l'import respecte la limite max_leads demandée ;
    - les créations, mises à jour, doublons ignorés et échecs
      sont comptabilisés explicitement.
    """

    companies, persons = memory.crm_ready_entities()
    lead_type = requested_lead_type(memory.intent)

    if lead_type == "company":
        selected_companies = list(companies[:max_leads])
        selected_persons = []

    elif lead_type == "person":
        selected_companies = []
        selected_persons = list(persons[:max_leads])

    else:
        remaining = max_leads
        selected_companies = list(companies[:remaining])
        remaining -= len(selected_companies)
        selected_persons = list(
            persons[:max(0, remaining)]
        )

    total_to_import = (
        len(selected_companies)
        + len(selected_persons)
    )

    if total_to_import == 0:
        memory.add_log(
            "crm_import",
            "Aucun prospect valide à importer dans le CRM.",
        )

        return {
            "companies_created": 0,
            "companies_updated": 0,
            "companies_skipped": 0,
            "companies_failed": 0,
            "persons_created": 0,
            "persons_updated": 0,
            "persons_skipped": 0,
            "persons_failed": 0,
            "errors": [],
        }

    memory.set_phase("crm_import")

    memory.add_log(
        "crm_import",
        (
            "Import CRM démarré : "
            f"{len(selected_companies)} entreprise(s), "
            f"{len(selected_persons)} personne(s)."
        ),
    )

    try:
        stats = await import_leads_to_crm(
            companies=selected_companies,
            persons=selected_persons,
            tenant_company_id=tenant_company_id,
            user_id=user_id,
        )

        stats = dict(stats or {})

        defaults = {
            "companies_created": 0,
            "companies_updated": 0,
            "companies_skipped": 0,
            "companies_failed": 0,
            "persons_created": 0,
            "persons_updated": 0,
            "persons_skipped": 0,
            "persons_failed": 0,
            "errors": [],
        }

        for key, value in defaults.items():
            stats.setdefault(key, value)

        log_import_errors(stats)
        attach_import_errors(memory, stats)

        created_or_updated = imported_count(stats)

        skipped = (
            int(stats.get("companies_skipped", 0) or 0)
            + int(stats.get("persons_skipped", 0) or 0)
        )

        failed = (
            int(stats.get("companies_failed", 0) or 0)
            + int(stats.get("persons_failed", 0) or 0)
        )

        memory.add_log(
            "crm_import",
            (
                "Import CRM terminé : "
                f"importés={created_or_updated}, "
                f"ignorés={skipped}, "
                f"échecs={failed}."
            ),
        )

        if created_or_updated > 0:
            memory.stop_reason = "imported"
        elif failed > 0:
            memory.stop_reason = "import_failed"
        elif skipped > 0:
            memory.stop_reason = "already_existing"
        else:
            memory.stop_reason = "nothing_imported"

        return stats

    except Exception as exc:
        if settings.DEBUG:
            logger.exception(
                "[DISCOVERY][CRM_IMPORT] Import failed"
            )

        error_message = str(exc)[:400]

        memory.add_error(
            "crm_import",
            error_message,
        )

        memory.add_log(
            "crm_import",
            (
                "Import CRM impossible : "
                f"{error_message}"
            ),
        )

        memory.stop_reason = "import_failed"

        return {
            "companies_created": 0,
            "companies_updated": 0,
            "companies_skipped": 0,
            "companies_failed": len(selected_companies),
            "persons_created": 0,
            "persons_updated": 0,
            "persons_skipped": 0,
            "persons_failed": len(selected_persons),
            "errors": [
                {
                    "error_type": exc.__class__.__name__,
                    "message": error_message,
                }
            ],
        }


# ============================================================
# MAP RESULTS
# ============================================================

def build_map_prospects(
    leads: list[dict],
) -> list[dict]:
    result = []

    for item in leads:
        latitude = (
            item.get(
                "latitude"
            )
        )

        longitude = (
            item.get(
                "longitude"
            )
        )

        if (
            latitude is None
            or longitude is None
        ):
            continue

        result.append(
            {
                "id":
                    (
                        item.get(
                            "google_place_id"
                        )
                        or item.get(
                            "company_name"
                        )
                        or item.get(
                            "full_name"
                        )
                    ),

                "name":
                    (
                        item.get(
                            "company_name"
                        )
                        or item.get(
                            "full_name"
                        )
                    ),

                "lead_type":
                    item.get(
                        "lead_type"
                    ),

                "source":
                    item.get(
                        "source"
                    ),

                "source_label":
                    item.get(
                        "source_label"
                    ),

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "address":
                    item.get(
                        "address"
                    ),

                "city":
                    item.get(
                        "city"
                    ),

                "country":
                    item.get(
                        "country"
                    ),

                "phone":
                    item.get(
                        "phone"
                    ),

                "website":
                    item.get(
                        "website"
                    ),

                "google_maps_url":
                    (
                        item.get(
                            "google_maps_url"
                        )
                        or item.get(
                            "maps_url"
                        )
                    ),

                "rating":
                    item.get(
                        "rating"
                    ),
            }
        )

    return result


# ============================================================
# GEMINI FAILURE
# ============================================================

def build_gemini_failure_result(
    memory: AgentMemory,
    brain: GeminiBrain,
) -> dict:
    metadata = (
        brain.gemini_metadata()
    )

    return {
        "success":
            False,

        "companies_found":
            0,

        "persons_found":
            0,

        "brain_mode":
            "gemini",

        "iterations":
            0,

        "stop_reason":
            (
                memory.stop_reason
                or metadata.get(
                    "gemini_status"
                )
                or "gemini_unavailable"
            ),

        "intent":
            None,

        "plan":
            None,

        "tool_history":
            [],

        "import_stats":
            {},

        "imported_count":
            0,

        "import_failed_count":
            0,

        "import_skipped_count":
            0,

        "prospect_companies":
            [],

        "prospect_persons":
            [],

        "map_prospects":
            [],

        "meta_ads_verifications":
            [],

        "raw_results_count":
            0,

        "unique_entities_count":
            0,

        "rejected_results":
            0,

        "errors":
            memory.errors,

        "logs":
            memory.logs,

        "gemini_fallback_used":
            False,

        **metadata,
    }


# ============================================================
# RUN AGENT
# ============================================================


async def run_agent(
    query: str,
    tenant_company_id: int,
    user_id: int,
    max_results: int | None = None,
    force_local_fallback: bool = False,
) -> dict:
    memory = AgentMemory(query=query, company_id=tenant_company_id, user_id=user_id)

    # Registre isolé pour ce run uniquement : aucun last_status/last_error
    # n'est partagé avec une autre requête concurrente.
    tools = build_tools()

    memory.brain_mode = "gemini"
    memory.add_log("init", "Agent Discovery initialisé")
    brain = GeminiBrain()

    if force_local_fallback:
        memory.add_log("warning", "force_local_fallback ignoré : aucun fallback local pour l'intent.")

    # 1. Intent : un appel Gemini obligatoire.
    memory.set_phase("intent")
    try:
        memory.intent = await brain.extract_intent(query)
    except Exception as exc:
        metadata = brain.gemini_metadata()
        memory.add_error("gemini", str(exc)[:400])
        memory.stop_reason = metadata.get("gemini_status") or "gemini_unavailable"
        memory.set_phase("done")
        return build_gemini_failure_result(memory, brain)

    # 2. Limite utilisateur/API.
    if max_results is not None:
        try:
            requested_max = int(max_results)
        except (TypeError, ValueError):
            requested_max = 10
        memory.intent["max_leads"] = max(1, min(requested_max, 50))

    # 3. Plan initial.
    memory.plan = build_search_plan(memory.intent)
    max_leads = max(1, min(int(memory.intent.get("max_leads") or 10), 50))
    memory.max_leads = max_leads
    memory.max_decision_calls = 2
    memory.max_iterations = max(
        6,
        min(
            30,
            len(memory.plan.get("searches", [])) * 3
            + min(max_leads * 2, 20)
            + memory.max_decision_calls * 2,
        ),
    )

    memory.add_log("intent", f"Intent extrait: {memory.intent}")
    memory.add_log("plan", f"Plan Discovery: {memory.plan.get('searches')}")

    # 4. Recherche initiale.
    executed_searches = await execute_search_plan(memory, brain, tools=tools)

    # 5-6. Boucle agentique bornée.
    meta_ads_verifications: list[dict] = []
    extra_search = None

    while valid_prospect_count(memory) < max_leads:
        if memory.iterations >= memory.max_iterations:
            memory.stop_reason = memory.stop_reason or "max_iterations_reached"
            break

        # Budget de décision épuisé : une dernière action déterministe utile, puis stop.
        if not memory.decision_budget_available():
            if memory.pending_verification:
                step_result = await verify_pending_meta_ads(memory, brain, tools=tools)
                meta_ads_verifications.extend(step_result)
            else:
                extra_search = await execute_one_extra_search(memory, brain, tools=tools)
            break

        allowed_actions, allowed_sources = available_decision_actions(memory)
        memory.set_phase("decision")
        decision = await brain.decide_next_action(
            memory,
            allowed_actions=allowed_actions,
            allowed_sources=allowed_sources,
        )
        memory.add_decision(decision)
        action = decision.get("decision")

        if action == "stop":
            memory.stop_reason = memory.stop_reason or "decision_stop"
            break

        if action == "verify_pending_meta_ads":
            if not memory.pending_verification:
                memory.stop_reason = memory.stop_reason or "no_pending_meta_ads"
                break
            step_result = await verify_pending_meta_ads(memory, brain, tools=tools)
            meta_ads_verifications.extend(step_result)
            continue

        if action == "continue_same_strategy":
            result = await execute_one_extra_search(memory, brain, tools=tools)
            if result:
                extra_search = result
                continue
            memory.stop_reason = memory.stop_reason or "strategy_exhausted"
            break

        if action == "broaden_criteria":
            result = await execute_broadened_search(memory, brain, tools=tools)
            if result:
                continue
            memory.stop_reason = memory.stop_reason or "criteria_exhausted"
            break

        if action == "switch_source":
            source = str(decision.get("source") or "").strip()
            if not source:
                memory.stop_reason = memory.stop_reason or "invalid_source_decision"
                break
            result = await execute_switched_source(memory, source, brain, tools=tools)
            if result:
                continue
            memory.stop_reason = memory.stop_reason or "switched_source_exhausted"
            break

        memory.stop_reason = memory.stop_reason or "unsupported_decision"
        break

    # 7. Import CRM.
    import_stats = {}
    if valid_prospect_count(memory) > 0:
        import_stats = await import_valid_prospects(
            memory,
            tenant_company_id,
            user_id,
            max_leads,
        )
    else:
        memory.stop_reason = memory.stop_reason or "no_valid_prospects"

    # 8. Résultat final.
    memory.set_phase("done")
    companies, persons = memory.crm_ready_entities()
    lead_type = requested_lead_type(memory.intent)

    if lead_type == "company":
        companies = companies[:max_leads]
        persons = []
        selected = list(companies)
    elif lead_type == "person":
        persons = persons[:max_leads]
        companies = []
        selected = list(persons)
    else:
        selected = (companies + persons)[:max_leads]
        companies = [lead for lead in selected if is_company(lead)]
        persons = [lead for lead in selected if is_person(lead)]

    target_reached = len(selected) >= max_leads
    map_prospects = build_map_prospects(selected)
    gemini_metadata = brain.gemini_metadata()
    gemini_metadata["gemini_fallback_used"] = any(
        item.get("origin") == "deterministic_fallback"
        for item in memory.gemini_decisions
    )

    # Diagnostic de développement : explique précisément
    # pourquoi les candidats ont été rejetés.
    log_rejected_diagnostics(
        memory
    )

    return {
        "success": True,
        "companies_found": len(companies),
        "persons_found": len(persons),
        "brain_mode": "gemini",
        "iterations": memory.iterations,
        "decision_trace": memory.gemini_decisions,
        "decision_calls_used": memory.decision_calls_used,
        "max_decision_calls": memory.max_decision_calls,
        "stop_reason": memory.stop_reason or "completed",
        "intent": memory.intent,
        "plan": memory.plan,
        "target_valid_prospects": max_leads,
        "current_valid_prospects": len(selected),
        "missing_valid_prospects": max(0, max_leads - len(selected)),
        "target_reached": target_reached,
        "search_space_exhausted": not target_reached,
        "executed_searches": executed_searches,
        "additional_search": extra_search,
        "meta_ads_verifications": meta_ads_verifications,
        "pending_verification_count": len(memory.pending_verification),
        "tool_history": memory.tool_history,

        "import_stats": import_stats,

        "imported_count": imported_count(import_stats),

        "import_failed_count": (
            int(import_stats.get("companies_failed", 0) or 0)
            + int(import_stats.get("persons_failed", 0) or 0)
        ),

        "import_skipped_count": (
            int(import_stats.get("companies_skipped", 0) or 0)
            + int(import_stats.get("persons_skipped", 0) or 0)
        ),

        "prospect_companies": companies,
        "prospect_persons": persons,
        "map_prospects": map_prospects,
        "raw_results_count": sum(
            len(item.get("results") or []) for item in memory.raw_results
        ),
        "unique_entities_count": len(memory.companies) + len(memory.persons),
        "rejected_results": len(memory.rejected_results),
        "rejected_details": memory.rejected_results[-20:],
        "rejection_summary": [
            {
                "company_name": item.get("company_name"),
                "full_name": item.get("full_name"),
                "source": item.get("source"),
                "location_status": item.get("location_status"),
                "sector_match": item.get("sector_match"),
                "reason": (
                    item.get("rejection_reason")
                    or item.get("rejected_reason")
                    or "raison_inconnue"
                ),
            }
            for item in memory.rejected_results[-20:]
            if isinstance(item, dict)
        ],
        "verification_history": memory.verification_history,
        "errors": memory.errors,
        "logs": memory.logs,
        **gemini_metadata,
    }