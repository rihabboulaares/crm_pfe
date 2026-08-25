from dataclasses import dataclass
from difflib import SequenceMatcher
from urllib.parse import urlparse

from asgiref.sync import sync_to_async

from django.db.models import Q

from rest_framework.exceptions import ErrorDetail

from sales.models import Prospect, ProspectCompany
from subscriptions.utils import check_limits
from users.models import Company, User


# ============================================================
# CONSTANTES
# ============================================================

SOURCE_LABELS = {
    "ads_library_search": "Meta Ads Library",
    "meta_ads": "Meta Ads Library",
    "meta_ads_library": "Meta Ads Library",

    "serper_facebook": "Serper Facebook",
    "facebook": "Serper Facebook",

    "serper_instagram": "Serper Instagram",
    "instagram": "Serper Instagram",

    "serper_linkedin": "Serper LinkedIn",
    "linkedin": "Serper LinkedIn",

    "serper_general": "Serper General",
    "general": "Serper General",

    "google_maps": "Google Maps",
    "maps": "Google Maps",
    "maps_search": "Google Maps",

    "manual": "Manuel",
    "commercial": "Manuel",
}


# ============================================================
# IMPORT RESULT
# ============================================================

@dataclass
class ImportResult:
    company: ProspectCompany | None = None
    prospect: Prospect | None = None

    company_created: bool = False
    company_updated: bool = False

    prospect_created: bool = False
    prospect_updated: bool = False


# ============================================================
# BASIC HELPERS
# ============================================================

def split_name(
    full_name: str,
) -> tuple[str, str]:
    parts = (
        full_name
        or ""
    ).strip().split()

    if not parts:
        return "", ""

    if len(parts) == 1:
        return parts[0], ""

    return (
        parts[0],
        " ".join(parts[1:]),
    )


def clip(
    value,
    max_length: int,
):
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    return text[:max_length]


def normalize_text(
    value: str | None,
) -> str:
    return " ".join(
        str(value or "")
        .lower()
        .strip()
        .split()
    )


def normalize_phone(
    value: str | None,
) -> str | None:
    if not value:
        return None

    digits = "".join(
        char
        for char in str(value)
        if char.isdigit()
    )

    if digits.startswith("00"):
        digits = digits[2:]

    if not digits:
        return None

    return f"+{digits}"


def domain_from_url(
    url: str | None,
) -> str | None:
    if not url:
        return None

    try:
        raw = str(url).strip()

        parsed = urlparse(
            raw
            if raw.startswith(
                ("http://", "https://")
            )
            else f"https://{raw}"
        )

        host = (
            parsed.netloc
            .lower()
            .replace("www.", "")
            .strip("/")
        )

        return host or None

    except Exception:
        return None


# ============================================================
# SOURCE HELPERS
# ============================================================

def safe_origin(
    value: str | None,
) -> str:
    text = str(
        value or ""
    ).lower()

    if (
        "google_maps" in text
        or "maps" in text
    ):
        return "google_maps"

    if "linkedin" in text:
        return "linkedin"

    if "facebook" in text:
        return "facebook"

    if "instagram" in text:
        return "instagram"

    if (
        "website" in text
        or "general" in text
        or "web" in text
    ):
        return "website"

    # Le modèle Origin actuel ne possède probablement
    # pas meta_ads. On conserve donc agent_prospection.
    if (
        "meta_ads" in text
        or "ads_library" in text
    ):
        return "agent_prospection"

    return "agent_prospection"


def safe_company_source(
    value: str | None,
) -> str:
    origin = safe_origin(value)

    if origin == "google_maps":
        return "google_maps"

    return "agent_prospection"


def safe_lead_origin(
    value: str | None,
) -> str:
    origin = safe_origin(value)

    if origin in {
        "google_maps",
        "linkedin",
        "facebook",
        "instagram",
        "website",
    }:
        return origin

    return "prospection_agent"


def source_label(
    value: str | None,
) -> str | None:
    text = str(
        value or ""
    ).strip()

    if not text:
        return None

    key = (
        text
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

    return SOURCE_LABELS.get(
        key,
        text,
    )


def normalize_source_values(
    value,
) -> list:
    if value is None:
        return []

    if isinstance(value, str):
        return [value]

    if isinstance(value, dict):
        return list(
            value.values()
        )

    if isinstance(
        value,
        (list, tuple, set),
    ):
        return list(value)

    return [value]


def discovery_sources_from_result(
    item: dict,
) -> list[str]:
    values = []

    values.extend(
        normalize_source_values(
            item.get("sources")
        )
    )

    values.extend(
        normalize_source_values(
            item.get(
                "discovery_sources"
            )
        )
    )

    values.extend(
        [
            item.get(
                "source_label"
            ),
            item.get(
                "source"
            ),
        ]
    )

    result = []

    for value in values:
        label = source_label(
            value
        )

        if (
            label
            and label not in result
        ):
            result.append(label)

    return result


def merge_discovery_sources(
    existing,
    additions,
) -> list[str]:
    result = []

    for value in (
        normalize_source_values(
            existing
        )
        +
        normalize_source_values(
            additions
        )
    ):
        label = source_label(
            value
        )

        if (
            label
            and label not in result
        ):
            result.append(label)

    return result


# ============================================================
# ERROR HELPERS
# ============================================================

def exception_detail(
    exc: Exception,
):
    detail = getattr(
        exc,
        "detail",
        None,
    )

    if detail is not None:
        return detail

    return str(exc)


def json_safe_error(
    value,
):
    if isinstance(
        value,
        ErrorDetail,
    ):
        return str(value)

    if isinstance(
        value,
        dict,
    ):
        return {
            str(key):
                json_safe_error(item)

            for key, item
            in value.items()
        }

    if isinstance(
        value,
        (list, tuple, set),
    ):
        return [
            json_safe_error(item)
            for item in value
        ]

    return str(value)


def import_error_payload(
    item: dict,
    exc: Exception,
    index: int,
    category: str,
) -> dict:
    return {
        "index":
            index,

        "category":
            category,

        "name":
            (
                item.get(
                    "company_name"
                )
                or item.get(
                    "full_name"
                )
                or item.get("name")
                or ""
            ),

        "source":
            (
                item.get("source")
                or item.get(
                    "source_label"
                )
                or ""
            ),

        "error_type":
            exc.__class__.__name__,

        "message":
            json_safe_error(
                exception_detail(
                    exc
                )
            ),
    }


# ============================================================
# ENTITY HELPERS
# ============================================================

def text_value(
    item: dict,
    *fields: str,
) -> str | None:
    for field in fields:
        value = item.get(field)

        if (
            value is not None
            and str(value).strip()
        ):
            return str(
                value
            ).strip()

    return None


def company_name_from_result(
    item: dict,
) -> str | None:
    return text_value(
        item,
        "company_name",
        "name",
    )


def person_names_from_result(
    item: dict,
) -> tuple[str, str]:
    first_name = text_value(
        item,
        "person_first_name",
        "first_name",
    )

    last_name = text_value(
        item,
        "person_last_name",
        "last_name",
    )

    if (
        first_name
        or last_name
    ):
        return (
            first_name or "",
            last_name or "",
        )

    return split_name(
        text_value(
            item,
            "full_name",
        )
        or ""
    )


def prospect_title_from_result(
    item: dict,
):
    return clip(
        item.get("job_title")
        or item.get("title")
        or item.get("position")
        or item.get(
            "content_title"
        ),
        100,
    )


def source_url_from_result(
    item: dict,
):
    return clip(
        item.get("source_url")
        or item.get("raw_url")
        or item.get(
            "ad_snapshot_url"
        )
        or item.get(
            "linkedin_url"
        )
        or item.get(
            "facebook_url"
        )
        or item.get(
            "instagram_url"
        )
        or item.get(
            "website"
        ),
        500,
    )


def maps_identity(
    item: dict,
) -> str | None:
    return text_value(
        item,
        "google_place_id",
    )


def lead_type_from_result(
    item: dict,
) -> str:
    lead_type = str(
        item.get("lead_type")
        or item.get("entity_type")
        or ""
    ).lower()

    if lead_type in {
        "person",
        "company",
    }:
        return lead_type

    linkedin_url = str(
        item.get(
            "linkedin_url"
        )
        or ""
    ).lower()

    if "/in/" in linkedin_url:
        return "person"

    return "company"


def is_valid_business_result(
    item: dict,
) -> bool:
    return bool(
        company_name_from_result(
            item
        )
        or text_value(
            item,
            "full_name",
            "first_name",
            "last_name",
        )
    )


# ============================================================
# NAME MATCHING
# ============================================================

def is_close_name(
    left: str | None,
    right: str | None,
) -> bool:
    left = normalize_text(
        left
    )

    right = normalize_text(
        right
    )

    if not left or not right:
        return False

    # Plus strict pour éviter de fusionner
    # des entreprises différentes.
    return (
        SequenceMatcher(
            None,
            left,
            right,
        ).ratio()
        >= 0.95
    )


# ============================================================
# FIND COMPANY
# ============================================================

def find_existing_company(
    crm_company,
    item: dict,
):
    company_name = (
        company_name_from_result(
            item
        )
    )

    google_place_id = (
        maps_identity(
            item
        )
    )

    # --------------------------------------------------------
    # Strong identifiers
    # --------------------------------------------------------

    if google_place_id:
        existing = (
            ProspectCompany.objects
            .filter(
                company=crm_company,
                google_place_id=
                    clip(
                        google_place_id,
                        150,
                    ),
            )
            .first()
        )

        if existing:
            return existing

    for field in [
        "linkedin_url",
        "facebook_url",
        "instagram_url",
        "email",
        "phone",
    ]:
        value = item.get(
            field
        )

        if not value:
            continue

        existing = (
            ProspectCompany.objects
            .filter(
                company=
                    crm_company,
                **{
                    field:
                        value
                },
            )
            .first()
        )

        if existing:
            return existing

    # --------------------------------------------------------
    # Website domain
    # --------------------------------------------------------

    website_domain = (
        domain_from_url(
            item.get("website")
        )
    )

    if website_domain:
        candidates = (
            ProspectCompany.objects
            .filter(
                company=
                    crm_company,
            )
            .exclude(
                website__isnull=True
            )
        )

        for candidate in candidates:
            if (
                domain_from_url(
                    candidate.website
                )
                == website_domain
            ):
                return candidate

    # --------------------------------------------------------
    # Exact name
    # --------------------------------------------------------

    if company_name:
        existing = (
            ProspectCompany.objects
            .filter(
                company=
                    crm_company,
                name__iexact=
                    company_name,
            )
            .first()
        )

        if existing:
            return existing

    # --------------------------------------------------------
    # Fuzzy name – last resort
    # --------------------------------------------------------

    if company_name:
        candidates = (
            ProspectCompany.objects
            .filter(
                company=
                    crm_company,
            )
            .only(
                "id",
                "name",
            )
        )

        for candidate in candidates:
            if is_close_name(
                candidate.name,
                company_name,
            ):
                return candidate

    return None


# ============================================================
# UPDATE MISSING FIELDS
# ============================================================

def update_missing_fields(
    obj,
    item: dict,
    fields: list[str],
) -> bool:
    changed = False

    max_lengths = {
        "industry": 150,
        "phone": 20,
        "email": 254,
        "city": 100,
        "country": 100,
        "title": 100,
        "google_place_id": 150,
        "address": 500,
        "google_maps_url": 500,
        "first_name": 50,
        "last_name": 50,
        "website": 200,
        "linkedin_url": 200,
        "facebook_url": 200,
        "instagram_url": 200,
    }

    for field in fields:
        if field == "google_place_id":
            new_value = (
                maps_identity(
                    item
                )
            )

        elif field == (
            "google_maps_url"
        ):
            new_value = (
                item.get(
                    "google_maps_url"
                )
                or item.get(
                    "maps_url"
                )
            )

        else:
            new_value = (
                item.get(field)
            )

        if (
            field
            in max_lengths
        ):
            new_value = clip(
                new_value,
                max_lengths[field],
            )

        if (
            new_value is not None
            and new_value != ""
            and not getattr(
                obj,
                field,
                None,
            )
        ):
            setattr(
                obj,
                field,
                new_value,
            )

            changed = True

    return changed


# ============================================================
# COMPANY IMPORT
# ============================================================

def save_company_to_crm(
    item: dict,
    crm_company,
) -> ImportResult:
    company_name = (
        company_name_from_result(
            item
        )
    )

    if not company_name:
        return ImportResult()

    discovery_sources = (
        discovery_sources_from_result(
            item
        )
    )

    company = find_existing_company(
        crm_company,
        item,
    )

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    if not company:
        company = (
            ProspectCompany.objects.create(
                name=
                    clip(
                        company_name,
                        255,
                    ),

                company=
                    crm_company,

                industry=
                    clip(
                        item.get(
                            "industry"
                        ),
                        150,
                    ),

                phone=
                    clip(
                        item.get(
                            "phone"
                        ),
                        20,
                    ),

                email=
                    clip(
                        item.get(
                            "email"
                        ),
                        254,
                    ),

                city=
                    clip(
                        item.get(
                            "city"
                        ),
                        100,
                    ),

                country=
                    clip(
                        item.get(
                            "country"
                        ),
                        100,
                    ),

                website=
                    clip(
                        item.get(
                            "website"
                        ),
                        200,
                    ),

                linkedin_url=
                    clip(
                        item.get(
                            "linkedin_url"
                        ),
                        200,
                    ),

                facebook_url=
                    clip(
                        item.get(
                            "facebook_url"
                        ),
                        200,
                    ),

                instagram_url=
                    clip(
                        item.get(
                            "instagram_url"
                        ),
                        200,
                    ),

                google_place_id=
                    clip(
                        maps_identity(
                            item
                        ),
                        150,
                    ),

                address=
                    clip(
                        item.get(
                            "address"
                        ),
                        500,
                    ),

                latitude=
                    item.get(
                        "latitude"
                    ),

                longitude=
                    item.get(
                        "longitude"
                    ),

                google_maps_url=
                    clip(
                        (
                            item.get(
                                "google_maps_url"
                            )
                            or item.get(
                                "maps_url"
                            )
                        ),
                        500,
                    ),

                # Scoring volontairement séparé.
                score_ia=0,
                evaluation=None,

                source=
                    safe_company_source(
                        item.get(
                            "source"
                        )
                    ),

                discovery_sources=
                    discovery_sources,
            )
        )

        return ImportResult(
            company=company,
            company_created=True,
        )

    # --------------------------------------------------------
    # UPDATE
    # --------------------------------------------------------

    changed = update_missing_fields(
        company,
        item,
        [
            "industry",
            "phone",
            "email",
            "city",
            "country",
            "website",
            "linkedin_url",
            "facebook_url",
            "instagram_url",
            "google_place_id",
            "address",
            "latitude",
            "longitude",
            "google_maps_url",
        ],
    )

    merged_sources = (
        merge_discovery_sources(
            company.discovery_sources,
            discovery_sources,
        )
    )

    if (
        merged_sources
        != (
            company.discovery_sources
            or []
        )
    ):
        company.discovery_sources = (
            merged_sources
        )

        changed = True

    if changed:
        company.save()

    return ImportResult(
        company=company,
        company_updated=changed,
    )


# ============================================================
# FIND PERSON
# ============================================================

def find_existing_person(
    crm_company,
    related_company,
    item: dict,
    first_name: str,
    last_name: str,
):
    # Strong identity first.

    for field in [
        "email",
        "phone",
        "linkedin_url",
        "facebook_url",
        "instagram_url",
    ]:
        value = item.get(
            field
        )

        if not value:
            continue

        existing = (
            Prospect.objects
            .filter(
                company=
                    crm_company,
                **{
                    field:
                        value
                },
            )
            .first()
        )

        if existing:
            return existing

    # Name + related company only.
    if (
        first_name
        and last_name
        and related_company
    ):
        return (
            Prospect.objects
            .filter(
                company=
                    crm_company,

                prospect_company=
                    related_company,

                first_name__iexact=
                    first_name,

                last_name__iexact=
                    last_name,
            )
            .first()
        )

    return None


# ============================================================
# ACTOR
# ============================================================

def mark_prospection_actor(
    instance,
    user=None,
):
    instance._history_actor_type = (
        "prospection_agent"
    )

    instance._history_actor_name = (
        "Agent de prospection"
    )

    if user:
        instance._history_performed_by = (
            user
        )

        instance._actor = user


# ============================================================
# COMPANY AS PROSPECT
# ============================================================

def find_existing_company_prospect(
    crm_company,
    related_company,
):
    """
    Cherche la ligne Prospect représentant directement
    une entreprise déjà enregistrée dans ProspectCompany.

    On utilise la relation prospect_company comme identité
    principale afin d'éviter les doublons.
    """
    if not related_company:
        return None

    return (
        Prospect.objects
        .filter(
            company=crm_company,
            prospect_company=related_company,
            first_name__iexact="Contact",
            last_name__iexact=related_company.name,
        )
        .first()
    )


def save_company_as_prospect(
    item: dict,
    crm_company,
    user,
    related_company,
) -> ImportResult:
    """
    Ajoute aussi l'entreprise dans la table Prospect.

    Affichage souhaité :
        first_name = "Contact"
        last_name  = nom de l'entreprise
        prospect_company = entreprise correspondante

    Les coordonnées disponibles sont recopiées afin que
    cette ligne puisse être gérée depuis le tableau Prospects.
    """
    if not related_company:
        return ImportResult()

    company_name = (
        related_company.name
        or company_name_from_result(item)
        or ""
    ).strip()

    if not company_name:
        return ImportResult(
            company=related_company,
        )

    discovery_sources = (
        discovery_sources_from_result(item)
    )

    prospect = find_existing_company_prospect(
        crm_company,
        related_company,
    )

    if not prospect:
        prospect = Prospect(
            first_name="Contact",

            last_name=clip(
                company_name,
                50,
            ) or "",

            prospect_company=related_company,
            company=crm_company,

            email=clip(
                item.get("email"),
                254,
            ),

            title=clip(
                item.get("industry")
                or "Entreprise",
                100,
            ),

            phone=clip(
                item.get("phone"),
                20,
            ),

            city=clip(
                item.get("city"),
                100,
            ),

            country=clip(
                item.get("country"),
                100,
            ),

            origin=safe_origin(
                item.get("source")
            ),

            lead_origin=safe_lead_origin(
                item.get("source")
            ),

            evaluation=None,
            status="new",
            assigned_to=user,
            source="agent_prospection",

            website=clip(
                item.get("website"),
                200,
            ),

            linkedin_url=clip(
                item.get("linkedin_url"),
                200,
            ),

            facebook_url=clip(
                item.get("facebook_url"),
                200,
            ),

            instagram_url=clip(
                item.get("instagram_url"),
                200,
            ),

            source_url=source_url_from_result(
                item
            ),

            discovery_sources=discovery_sources,

            address=clip(
                item.get("address"),
                500,
            ),

            latitude=item.get("latitude"),
            longitude=item.get("longitude"),

            google_maps_url=clip(
                (
                    item.get("google_maps_url")
                    or item.get("maps_url")
                ),
                500,
            ),

            raison_score=None,
        )

        mark_prospection_actor(
            prospect,
            user,
        )
        prospect.save()

        return ImportResult(
            company=related_company,
            prospect=prospect,
            prospect_created=True,
        )

    changed = update_missing_fields(
        prospect,
        item,
        [
            "phone",
            "city",
            "country",
            "website",
            "linkedin_url",
            "facebook_url",
            "instagram_url",
            "address",
            "latitude",
            "longitude",
            "google_maps_url",
        ],
    )

    if item.get("email") and not prospect.email:
        prospect.email = clip(
            item.get("email"),
            254,
        )
        changed = True

    if not prospect.title:
        prospect.title = clip(
            item.get("industry")
            or "Entreprise",
            100,
        )
        changed = True

    merged_sources = merge_discovery_sources(
        prospect.discovery_sources,
        discovery_sources,
    )

    if merged_sources != (
        prospect.discovery_sources
        or []
    ):
        prospect.discovery_sources = (
            merged_sources
        )
        changed = True

    if changed:
        mark_prospection_actor(
            prospect,
            user,
        )
        prospect.save()

    return ImportResult(
        company=related_company,
        prospect=prospect,
        prospect_updated=changed,
    )


# ============================================================
# PERSON IMPORT
# ============================================================

def save_person_to_crm(
    item: dict,
    crm_company,
    user,
) -> ImportResult:
    first_name, last_name = (
        person_names_from_result(
            item
        )
    )

    # IMPORTANT :
    # ne jamais créer une fausse personne.
    if not (
        first_name
        or last_name
    ):
        return ImportResult()

    # --------------------------------------------------------
    # Optional related company
    # --------------------------------------------------------

    company = None
    company_result = ImportResult()

    company_name = (
        company_name_from_result(
            item
        )
    )

    if company_name:
        company_result = (
            save_company_to_crm(
                item,
                crm_company,
            )
        )

        company = (
            company_result.company
        )

    discovery_sources = (
        discovery_sources_from_result(
            item
        )
    )

    prospect = find_existing_person(
        crm_company,
        company,
        item,
        first_name,
        last_name,
    )

    # --------------------------------------------------------
    # CREATE
    # --------------------------------------------------------

    if not prospect:
        prospect = Prospect(
            first_name=
                clip(
                    first_name,
                    50,
                )
                or "",

            last_name=
                clip(
                    last_name,
                    50,
                )
                or "",

            prospect_company=
                company,

            company=
                crm_company,

            email=
                clip(
                    item.get(
                        "email"
                    ),
                    254,
                ),

            title=
                prospect_title_from_result(
                    item
                ),

            phone=
                clip(
                    item.get(
                        "phone"
                    ),
                    20,
                ),

            city=
                clip(
                    item.get(
                        "city"
                    ),
                    100,
                ),

            country=
                clip(
                    item.get(
                        "country"
                    ),
                    100,
                ),

            origin=
                safe_origin(
                    item.get(
                        "source"
                    )
                ),

            lead_origin=
                safe_lead_origin(
                    item.get(
                        "source"
                    )
                ),

            # Scoring séparé.
            evaluation=None,

            status="new",

            assigned_to=user,

            source=
                "agent_prospection",

            website=
                clip(
                    item.get(
                        "website"
                    ),
                    200,
                ),

            linkedin_url=
                clip(
                    item.get(
                        "linkedin_url"
                    ),
                    200,
                ),

            facebook_url=
                clip(
                    item.get(
                        "facebook_url"
                    ),
                    200,
                ),

            instagram_url=
                clip(
                    item.get(
                        "instagram_url"
                    ),
                    200,
                ),

            source_url=
                source_url_from_result(
                    item
                ),

            discovery_sources=
                discovery_sources,

            address=
                clip(
                    item.get(
                        "address"
                    ),
                    500,
                ),

            latitude=
                item.get(
                    "latitude"
                ),

            longitude=
                item.get(
                    "longitude"
                ),

            google_maps_url=
                clip(
                    (
                        item.get(
                            "google_maps_url"
                        )
                        or item.get(
                            "maps_url"
                        )
                    ),
                    500,
                ),

            raison_score=None,
        )

        mark_prospection_actor(
            prospect,
            user,
        )

        prospect.save()

        return ImportResult(
            company=company,

            prospect=prospect,

            company_created=
                company_result.company_created,

            company_updated=
                company_result.company_updated,

            prospect_created=True,
        )

    # --------------------------------------------------------
    # UPDATE
    # --------------------------------------------------------

    changed = update_missing_fields(
        prospect,
        item,
        [
            "phone",
            "city",
            "country",
            "website",
            "linkedin_url",
            "facebook_url",
            "instagram_url",
            "address",
            "latitude",
            "longitude",
            "google_maps_url",
        ],
    )

    if (
        item.get("email")
        and not prospect.email
    ):
        prospect.email = clip(
            item.get("email"),
            254,
        )

        changed = True

    title = (
        prospect_title_from_result(
            item
        )
    )

    if (
        title
        and not prospect.title
    ):
        prospect.title = title
        changed = True

    if (
        company
        and not prospect.prospect_company
    ):
        prospect.prospect_company = (
            company
        )

        changed = True

    merged_sources = (
        merge_discovery_sources(
            prospect.discovery_sources,
            discovery_sources,
        )
    )

    if (
        merged_sources
        != (
            prospect.discovery_sources
            or []
        )
    ):
        prospect.discovery_sources = (
            merged_sources
        )

        changed = True

    if changed:
        mark_prospection_actor(
            prospect,
            user,
        )

        prospect.save()

    return ImportResult(
        company=company,

        prospect=prospect,

        company_created=
            company_result.company_created,

        company_updated=
            company_result.company_updated,

        prospect_updated=
            changed,
    )


# ============================================================
# IMPORT
# ============================================================

@sync_to_async
def import_leads_to_crm(
    companies: list[dict],
    persons: list[dict],
    tenant_company_id: int,
    user_id: int,
) -> dict:
    crm_company = (
        Company.objects.get(
            id=tenant_company_id
        )
    )

    user = User.objects.get(
        id=user_id
    )

    stats = {
        "companies_created": 0,
        "companies_updated": 0,
        "companies_skipped": 0,
        "companies_failed": 0,

        "company_prospects_created": 0,
        "company_prospects_updated": 0,
        "company_prospects_skipped": 0,

        "persons_created": 0,
        "persons_updated": 0,
        "persons_skipped": 0,
        "persons_failed": 0,

        "errors": [],
    }

    # ========================================================
    # COMPANIES
    # ========================================================

    for index, item in enumerate(
        companies
    ):
        try:
            if (
                lead_type_from_result(
                    item
                )
                != "company"
            ):
                stats[
                    "companies_skipped"
                ] += 1

                continue

            # On vérifie la limite avant création.
            check_limits(
                crm_company,
                "add_prospect",
            )

            company_result = (
                save_company_to_crm(
                    item,
                    crm_company,
                )
            )

            if not company_result.company:
                result = company_result
            else:
                prospect_result = (
                    save_company_as_prospect(
                        item,
                        crm_company,
                        user,
                        company_result.company,
                    )
                )

                result = ImportResult(
                    company=company_result.company,
                    prospect=prospect_result.prospect,
                    company_created=company_result.company_created,
                    company_updated=company_result.company_updated,
                    prospect_created=prospect_result.prospect_created,
                    prospect_updated=prospect_result.prospect_updated,
                )

        except Exception as exc:
            stats[
                "companies_failed"
            ] += 1

            stats["errors"].append(
                import_error_payload(
                    item,
                    exc,
                    index,
                    "company",
                )
            )

            continue

        if not result.company:
            stats[
                "companies_skipped"
            ] += 1

            continue

        if result.company_created:
            stats[
                "companies_created"
            ] += 1

        elif result.company_updated:
            stats[
                "companies_updated"
            ] += 1

        else:
            stats[
                "companies_skipped"
            ] += 1

        # L'entreprise est également représentée dans Prospect
        # sous la forme : Contact + nom de l'entreprise.
        if result.prospect_created:
            stats[
                "company_prospects_created"
            ] += 1
        elif result.prospect_updated:
            stats[
                "company_prospects_updated"
            ] += 1
        elif result.prospect:
            stats[
                "company_prospects_skipped"
            ] += 1

    # ========================================================
    # PERSONS
    # ========================================================

    for index, item in enumerate(
        persons
    ):
        try:
            if (
                lead_type_from_result(
                    item
                )
                != "person"
            ):
                stats[
                    "persons_skipped"
                ] += 1

                continue

            check_limits(
                crm_company,
                "add_prospect",
            )

            result = (
                save_person_to_crm(
                    item,
                    crm_company,
                    user,
                )
            )

        except Exception as exc:
            stats[
                "persons_failed"
            ] += 1

            stats["errors"].append(
                import_error_payload(
                    item,
                    exc,
                    index,
                    "person",
                )
            )

            continue

        if not result.prospect:
            stats[
                "persons_skipped"
            ] += 1

            continue

        # La personne peut aussi avoir créé sa société.
        if result.company_created:
            stats[
                "companies_created"
            ] += 1

        elif result.company_updated:
            stats[
                "companies_updated"
            ] += 1

        if result.prospect_created:
            stats[
                "persons_created"
            ] += 1

        elif result.prospect_updated:
            stats[
                "persons_updated"
            ] += 1

        else:
            stats[
                "persons_skipped"
            ] += 1

    return stats