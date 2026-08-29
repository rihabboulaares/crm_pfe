import json
import unicodedata
from typing import Any


EMPTY_QUALIFICATION_TARGET = {
    "source": "NONE",
    "target_roles": [],
    "target_sectors": [],
    "target_countries": [],
    "target_cities": [],
    "target_company_size_min": None,
    "target_company_size_max": None,
    "keywords": [],
    "raw_context": {},
}

COUNTRY_ALIASES = {
    "tunisie",
    "tunisia",
    "france",
    "canada",
    "maroc",
    "morocco",
    "algerie",
    "algeria",
    "senegal",
    "belgique",
    "belgium",
    "allemagne",
    "germany",
    "italie",
    "italy",
    "espagne",
    "spain",
    "usa",
    "united states",
    "etats unis",
}


def normalize_text(value) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    return "".join(char for char in text if not unicodedata.combining(char))


def normalize_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, (list, tuple, set)):
        return []

    result = []
    seen = set()
    for item in value:
        text = str(item or "").strip()
        key = normalize_text(text)
        if text and key not in seen:
            result.append(text)
            seen.add(key)
    return result


def has_prospection_origin(prospect) -> bool:
    return any(
        normalize_text(getattr(prospect, field, "")) == "agent_prospection"
        or normalize_text(getattr(prospect, field, "")) == "prospection_agent"
        for field in ["source", "lead_origin", "origin"]
    )


def prospect_identity_values(prospect) -> list[str]:
    values = []
    full_name = " ".join(
        filter(
            None,
            [
                getattr(prospect, "first_name", ""),
                getattr(prospect, "last_name", ""),
            ],
        )
    )
    for value in [
        full_name,
        getattr(prospect, "email", ""),
        getattr(prospect, "phone", ""),
        getattr(prospect, "linkedin_url", ""),
        getattr(prospect, "source_url", ""),
        getattr(getattr(prospect, "prospect_company", None), "name", ""),
    ]:
        normalized = normalize_text(value)
        if len(normalized) >= 4:
            values.append(normalized)
    return values


def run_mentions_prospect(run_data: dict[str, Any], prospect) -> bool:
    if not run_data:
        return False

    haystack = normalize_text(
        json.dumps(
            run_data,
            ensure_ascii=False,
            default=str,
        )
    )
    return any(value in haystack for value in prospect_identity_values(prospect))


def classify_locations(locations: list[str]) -> tuple[list[str], list[str]]:
    countries = []
    cities = []
    for location in locations:
        normalized = normalize_text(location)
        if normalized in COUNTRY_ALIASES:
            countries.append(location)
        else:
            cities.append(location)
    return countries, cities


def extract_size_value(payload: dict[str, Any], keys: list[str]) -> int | None:
    for key in keys:
        value = payload.get(key)
        if value in (None, ""):
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return None


def build_target_from_run(run) -> dict[str, Any]:
    data = run.result_data or {}
    intent = data.get("intent") or {}
    plan = data.get("plan") or {}

    target_roles = normalize_list(intent.get("target_roles"))
    target_sectors = normalize_list(
        intent.get("industries")
        or intent.get("target_sectors")
        or plan.get("industries")
        or plan.get("target_sectors")
    )
    locations = normalize_list(
        intent.get("locations")
        or plan.get("locations")
    )
    countries = normalize_list(
        intent.get("countries")
        or plan.get("countries")
        or plan.get("target_countries")
    )
    cities = normalize_list(
        intent.get("cities")
        or plan.get("cities")
        or plan.get("target_cities")
    )
    inferred_countries, inferred_cities = classify_locations(locations)
    countries = normalize_list(countries + inferred_countries)
    cities = normalize_list(cities + inferred_cities)

    merged_context = {
        **plan,
        **intent,
    }

    return {
        "source": "PROSPECTION_RUN",
        "target_roles": target_roles,
        "target_sectors": target_sectors,
        "target_countries": countries,
        "target_cities": cities,
        "target_company_size_min": extract_size_value(
            merged_context,
            ["target_company_size_min", "company_size_min", "min_employees"],
        ),
        "target_company_size_max": extract_size_value(
            merged_context,
            ["target_company_size_max", "company_size_max", "max_employees"],
        ),
        "keywords": normalize_list(intent.get("search_keywords")),
        "raw_context": {
            "discovery_run_id": run.id,
            "query": run.query,
            "intent": intent,
            "plan": plan,
        },
    }


def resolve_qualification_target(*, prospect, user=None) -> dict[str, Any]:
    if not prospect or not has_prospection_origin(prospect):
        return dict(EMPTY_QUALIFICATION_TARGET)

    try:
        from agentProspection.models import DiscoveryRun
    except Exception:
        return dict(EMPTY_QUALIFICATION_TARGET)

    company = getattr(prospect, "company", None)
    queryset = DiscoveryRun.objects.filter(
        company=company,
        status__in=["success", "partial"],
    )
    if user is not None:
        queryset = queryset.filter(launched_by=user)

    for run in queryset.order_by("-started_at")[:20]:
        data = run.result_data or {}
        if run_mentions_prospect(data, prospect):
            return build_target_from_run(run)

    return dict(EMPTY_QUALIFICATION_TARGET)
