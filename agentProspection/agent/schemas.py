from dataclasses import dataclass, field
from typing import Any


@dataclass
class SearchCriteria:
    search_type: str = "company"
    secteur: str = "restaurant"
    ville: str = "tunis"
    country: str = "Tunisie"
    rayon_km: int = 5
    max_resultats: int = 10
    score_min: int = 0
    employees_min: int | None = None
    employees_max: int | None = None
    activity_type: str = ""
    job_title: str = ""
    seniority_level: str = ""
    target_company: str = ""
    require_facebook: bool = False
    require_instagram: bool = False
    require_website: bool = False
    require_phone: bool = False
    require_email: bool = False
    require_linkedin: bool = False
    validation_min: int = 0
    query: str = ""
    session_id: str = "default"
    criteres: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=lambda: ["website", "linkedin"])
    keywords: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any], max_allowed_results: int = 10) -> "SearchCriteria":
        max_resultats = _to_int(data.get("max_resultats", 10), 10, 1, max_allowed_results)
        return cls(
            search_type=_normalize_search_type(data.get("search_type") or data.get("type")),
            secteur=str(data.get("secteur") or "restaurant").strip().lower(),
            ville=str(data.get("ville") or "tunis").strip().lower(),
            country=str(data.get("country") or "Tunisie").strip(),
            rayon_km=_to_int(data.get("rayon_km", 5), 5, 1, 30),
            max_resultats=max_resultats,
            score_min=_to_int(data.get("score_min", 0), 0, 0, 100),
            employees_min=_optional_int(data.get("employees_min")),
            employees_max=_optional_int(data.get("employees_max")),
            activity_type=str(data.get("activity_type") or "").strip().lower(),
            job_title=str(data.get("job_title") or data.get("poste") or "").strip(),
            seniority_level=str(data.get("seniority_level") or data.get("niveau_hierarchique") or "").strip().lower(),
            target_company=str(data.get("target_company") or data.get("entreprise_cible") or "").strip(),
            require_facebook=_to_bool(data.get("require_facebook")),
            require_instagram=_to_bool(data.get("require_instagram")),
            require_website=_to_bool(data.get("require_website")),
            require_phone=_to_bool(data.get("require_phone")),
            require_email=_to_bool(data.get("require_email")),
            require_linkedin=_to_bool(data.get("require_linkedin")),
            validation_min=_to_int(data.get("validation_min", 0), 0, 0, 100),
            query=str(data.get("query") or data.get("prompt") or "").strip(),
            session_id=str(data.get("session_id") or "default"),
            criteres=list(data.get("criteres") or []),
            sources=_normalize_sources(data.get("sources")),
            keywords=_normalize_list(data.get("keywords")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "search_type": self.search_type,
            "secteur": self.secteur,
            "ville": self.ville,
            "country": self.country,
            "rayon_km": self.rayon_km,
            "max_resultats": self.max_resultats,
            "score_min": self.score_min,
            "employees_min": self.employees_min,
            "employees_max": self.employees_max,
            "activity_type": self.activity_type,
            "job_title": self.job_title,
            "seniority_level": self.seniority_level,
            "target_company": self.target_company,
            "require_facebook": self.require_facebook,
            "require_instagram": self.require_instagram,
            "require_website": self.require_website,
            "require_phone": self.require_phone,
            "require_email": self.require_email,
            "require_linkedin": self.require_linkedin,
            "validation_min": self.validation_min,
            "query": self.query,
            "session_id": self.session_id,
            "criteres": self.criteres,
            "sources": self.sources,
            "keywords": self.keywords,
        }


def normalize_company(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "place_id": raw.get("place_id") or raw.get("id") or "",
        "nom": raw.get("nom") or raw.get("company_name") or raw.get("name") or "",
        "secteur": raw.get("secteur") or raw.get("industry") or "",
        "adresse": raw.get("adresse") or raw.get("address") or "",
        "ville": raw.get("ville") or raw.get("city") or "",
        "country": raw.get("country") or "Tunisie",
        "latitude": raw.get("latitude"),
        "longitude": raw.get("longitude"),
        "telephone": raw.get("telephone") or raw.get("phone") or "",
        "email": raw.get("email") or "",
        "site_web": raw.get("site_web") or raw.get("website") or "",
        "categorie": raw.get("categorie") or raw.get("category") or "",
        "source": raw.get("source") or "google_maps",
        "source_url": raw.get("source_url") or "",
        "google_maps_url": raw.get("google_maps_url") or raw.get("source_url") or "",
        "facebook_url": raw.get("facebook_url") or "",
        "instagram_url": raw.get("instagram_url") or "",
        "linkedin_url": raw.get("linkedin_url") or "",
        "texte_web": raw.get("texte_web") or "",
        "facebook_bio": raw.get("facebook_bio") or "",
        "instagram_bio": raw.get("instagram_bio") or "",
        "linkedin_bio": raw.get("linkedin_bio") or "",
        "opening_hours": raw.get("opening_hours") or "",
        "cuisine": raw.get("cuisine") or "",
        "postcode": raw.get("postcode") or "",
        "distance_km": raw.get("distance_km"),
        "data_quality": raw.get("data_quality") or 0,
        "sources_detected": raw.get("sources_detected") or [],
        "validation_score": raw.get("validation_score") or 0,
        "validation_status": raw.get("validation_status") or "pending",
        "validation_reasons": raw.get("validation_reasons") or [],
        "score_ia": raw.get("score_ia") or 0,
        "evaluation": raw.get("evaluation") or "cold",
        "raison_score": raw.get("raison_score") or "",
        "next_action": raw.get("next_action") or "",
        "message_approche": raw.get("message_approche") or "",
        "besoin_probable": raw.get("besoin_probable") or "",
        "memory_status": raw.get("memory_status") or "new",
    }


def normalize_prospect(raw: dict[str, Any], company: dict[str, Any]) -> dict[str, Any]:
    return {
        "first_name": raw.get("first_name") or "",
        "last_name": raw.get("last_name") or "",
        "title": raw.get("title") or "",
        "email": raw.get("email") or "",
        "phone": raw.get("phone") or raw.get("telephone") or "",
        "city": company.get("ville") or "",
        "country": company.get("country") or "Tunisie",
        "origin": raw.get("origin") or "website",
        "evaluation": raw.get("evaluation") or company.get("evaluation") or "cold",
        "status": "new",
        "linkedin_url": raw.get("linkedin_url") or company.get("linkedin_url") or "",
        "facebook_url": raw.get("facebook_url") or company.get("facebook_url") or "",
        "instagram_url": raw.get("instagram_url") or company.get("instagram_url") or "",
        "source_url": raw.get("source_url") or company.get("source_url") or "",
        "prospect_company_name": raw.get("prospect_company_name") or company.get("nom") or "",
        "place_id": company.get("place_id") or "",
        "score_ia": raw.get("score_ia") or company.get("score_ia") or 0,
        "raison_score": raw.get("raison_score") or company.get("raison_score") or "",
        "next_action": raw.get("next_action") or company.get("next_action") or "",
        "message_approche": raw.get("message_approche") or company.get("message_approche") or "",
        "besoin_probable": raw.get("besoin_probable") or company.get("besoin_probable") or "",
        "validation_score": raw.get("validation_score") or 0,
        "validation_status": raw.get("validation_status") or "pending",
        "validation_reasons": raw.get("validation_reasons") or [],
        "confidence": raw.get("confidence") or 0,
        "evidence": raw.get("evidence") or "",
        "public_text": raw.get("public_text") or raw.get("evidence") or "",
    }


def is_person_prospect(prospect: dict[str, Any]) -> bool:
    """
    Valide qu'un prospect est une vraie personne avec au moins un moyen de contact.

    Règle relaxée pour les créateurs Instagram :
    - first_name suffit (last_name optionnel — un handle comme "cuisine.faye" est valide)
    - Au moins une URL sociale ou un email ou un téléphone obligatoire
    """
    # Doit avoir au minimum un prénom (handle accepté)
    has_name = bool(prospect.get("first_name") and str(prospect["first_name"]).strip())

    # Doit avoir au moins un moyen de contact ou une URL publique
    has_contact = bool(
        prospect.get("email")
        or prospect.get("phone")
        or prospect.get("linkedin_url")
        or prospect.get("facebook_url")
        or prospect.get("instagram_url")
        or prospect.get("source_url")
    )

    return has_name and has_contact


# ─────────────────────────────────────────────────────────────────────────────
# Fonctions de normalisation internes
# ─────────────────────────────────────────────────────────────────────────────

def _normalize_search_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"prospect", "prospects", "prospect_search", "person", "people", "personne", "humain"}:
        return "prospect"
    if normalized in {"company", "companies", "company_search", "entreprise", "entreprises", "business"}:
        return "company"
    return "company"


def _to_int(value: Any, default: int, min_value: int, max_value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(min_value, min(parsed, max_value))


def _optional_int(value: Any) -> int | None:
    if value in [None, ""]:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value in [None, ""]:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "oui", "on"}


def _normalize_sources(value: Any) -> list[str]:
    allowed = {"google_maps", "website", "facebook", "instagram", "linkedin"}
    aliases = {
        "maps": ["google_maps"],
        "google": ["google_maps"],
        "google maps": ["google_maps"],
        "googlemaps": ["google_maps"],
        "google_maps_api": ["google_maps"],
        "google_places": ["google_maps"],
        "web": ["website"],
        "duckduckgo": ["website"],
        "site": ["website"],
        "web_index": ["linkedin", "facebook", "instagram"],
        "google_dork": ["linkedin"],
        "google_dorks": ["linkedin"],
        "linkedin_indexed": ["linkedin"],
    }
    if not value:
        return ["website", "linkedin"]
    if isinstance(value, str):
        raw_items = [item.strip().lower() for item in value.split(",")]
    else:
        raw_items = [str(item).strip().lower() for item in value]
    selected = []
    for item in raw_items:
        if item in aliases:
            selected.extend(aliases[item])
        elif item in allowed:
            selected.append(item)
    selected = [item for index, item in enumerate(selected) if item in allowed and item not in selected[:index]]
    return selected or ["website", "linkedin"]


def _normalize_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [item.strip().lower() for item in value.split(",") if item.strip()]
    return [str(item).strip().lower() for item in value if str(item).strip()]