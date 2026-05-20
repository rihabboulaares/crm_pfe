"""Deterministic query understanding before the LLM agent runs."""

from __future__ import annotations

import re
import unicodedata
from typing import Any


CITY_ALIASES = {
    "tunis": "Tunis",
    "sfax": "Sfax",
    "sousse": "Sousse",
    "ariana": "Ariana",
    "ben arous": "Ben Arous",
    "nabeul": "Nabeul",
    "monastir": "Monastir",
    "bizerte": "Bizerte",
    "kairouan": "Kairouan",
    "gabes": "Gabes",
    "gafsa": "Gafsa",
    "mahdia": "Mahdia",
    "medenine": "Medenine",
    "la marsa": "La Marsa",
    "lac 1": "Lac 1",
    "lac 2": "Lac 2",
}
COUNTRY_ALIASES = {"tunisie", "tunisia", "tounes"}

SECTOR_ALIASES = [
    ("restaurant", {"restaurant", "restaurants", "resto", "restauration", "pizzeria", "fast food"}),
    ("hotel", {"hotel", "hotels", "hotellerie", "tourisme", "maison d hote", "maisons d hote"}),
    ("clinique", {"clinique", "cliniques", "sante", "medical"}),
    ("pharmacie", {"pharmacie", "pharmacies"}),
    ("garage", {"garage", "garages", "automobile", "auto"}),
    ("cafe", {"cafe", "cafes", "coffee shop", "salon de the"}),
    ("it", {"it", "informatique", "software", "logiciel", "saas", "tech", "technologie"}),
    ("marketing", {"marketing", "communication", "agence digitale", "digital"}),
    ("startup", {"startup", "startups", "scaleup"}),
    ("immobilier", {"immobilier", "agence immobiliere", "promoteur"}),
    ("formation", {"formation", "centre de formation"}),
    ("beaute", {"beaute", "salon de beaute", "coiffure", "esthetic", "spa"}),
    ("avocat", {"avocat", "avocats", "cabinet juridique", "droit", "juridique"}),
    ("notaire", {"notaire", "notaires", "etude notariale"}),
    ("architecte", {"architecte", "architectes", "architecture", "bureau d etudes"}),
    ("dentiste", {"dentiste", "dentistes", "clinique dentaire", "cabinet dentaire"}),
    ("medecin", {"medecin", "medecins", "cabinet medical", "doctor"}),
    ("assurance", {"assurance", "assurances", "courtier assurance"}),
    ("transport", {"transport", "logistique", "livraison", "transitaire"}),
    ("education", {"ecole", "ecoles", "lycee", "college", "primaire"}),
    ("expert comptable", {
        "expert comptable",
        "expert comptables",
        "experts comptable",
        "experts comptables",
        "expertise comptable",
        "comptable",
        "cabinet comptable",
        "cabinet d expertise comptable",
        "commissaire aux comptes",
    }),
    ("finance", {"banque", "finance", "assurance"}),
]

PERSON_TITLES = [
    ("Responsable RH", {"responsable rh", "rh", "hr manager", "human resources", "ressources humaines"}),
    ("CEO", {"ceo", "directeur general", "dg"}),
    ("CTO", {"cto", "directeur technique", "chief technology"}),
    ("Fondateur", {"fondateur", "founder", "co founder", "cofondateur"}),
    ("Directeur Marketing", {"directeur marketing", "marketing manager", "responsable marketing"}),
    ("Responsable Commercial", {"responsable commercial", "sales manager", "business developer"}),
    ("Recruteur IT", {"recruteur it", "it recruiter", "talent acquisition"}),
    ("Developpeur", {"developpeur", "developer", "ingenieur logiciel"}),
    ("Dentiste", {"dentiste", "chirurgien dentiste"}),
    ("Medecin", {"medecin", "docteur", "doctor"}),
]

CREATOR_TERMS = {
    "influenceur",
    "influenceuse",
    "food blogger",
    "foodblogger",
    "blogueur",
    "bloggeur",
    "createur de contenu",
    "content creator",
    "instagrammer",
    "coach",
    "photographe",
    "youtubeur",
    "tiktoker",
}


def enrich_criteria(raw: dict[str, Any], max_results: int = 10) -> dict[str, Any]:
    """Merge deterministic intent hints into user criteria without overwriting explicit fields."""
    criteria = dict(raw or {})
    query = str(criteria.get("query") or criteria.get("prompt") or "").strip()
    if not query:
        return criteria

    fp = _fingerprint(query)
    detected = {
        "query_intent": query,
        "country": "Tunisie",
        "max_resultats": _extract_max_results(fp, criteria.get("max_resultats"), max_results),
    }

    city = _detect_city(fp)
    if city:
        detected["ville"] = city

    sector = _detect_sector(fp)
    if sector:
        detected["secteur"] = sector

    title = _detect_title(fp)
    is_creator = _is_creator_query(fp)
    is_professional_service = sector in {"expert comptable"}
    if (title or is_creator) and not is_professional_service:
        detected["search_type"] = "prospect"
        detected["job_title"] = title or _creator_title(fp)
    else:
        detected["search_type"] = "company"

    sources = _detect_sources(fp, detected["search_type"], is_creator)
    if sources:
        detected["sources"] = sources

    detected.update(_detect_requirements(fp))
    detected["keywords"] = _keywords(fp)

    for key, value in detected.items():
        if key not in criteria or criteria.get(key) in [None, "", []]:
            criteria[key] = value

    if _fingerprint(criteria.get("ville")) in COUNTRY_ALIASES:
        criteria["country"] = "Tunisie"
        criteria["ville"] = ""

    criteria["intent_summary"] = _summary(criteria)
    return criteria


def _fingerprint(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return " ".join(text.split())


def _detect_city(fp: str) -> str:
    padded = f" {fp} "
    return next(
        (
            city
            for alias, city in CITY_ALIASES.items()
            if f" {_fingerprint(alias)} " in padded
        ),
        "",
    )


def _detect_sector(fp: str) -> str:
    for sector, aliases in SECTOR_ALIASES:
        if any(_fingerprint(alias) in fp for alias in aliases):
            return sector
    return ""


def _detect_title(fp: str) -> str:
    for title, aliases in PERSON_TITLES:
        if any(_fingerprint(alias) in fp for alias in aliases):
            return title
    return ""


def _is_creator_query(fp: str) -> bool:
    return any(_fingerprint(term) in fp for term in CREATOR_TERMS)


def _creator_title(fp: str) -> str:
    if "food" in fp or "cuisine" in fp:
        return "Food Blogger"
    if "coach" in fp and "sport" in fp:
        return "Coach sportif"
    if "photographe" in fp:
        return "Photographe"
    return "Influenceur"


def _detect_sources(fp: str, search_type: str, is_creator: bool) -> list[str]:
    sources = []
    source_terms = [
        ("google_maps", {"google maps", "maps", "adresse", "proche", "autour", "gps"}),
        ("website", {"site web", "website", "web", "email", "telephone"}),
        ("linkedin", {"linkedin", "decisionnaire", "b2b", "responsable", "directeur", "ceo", "cto", "fondateur"}),
        ("facebook", {"facebook", "fb"}),
        ("instagram", {"instagram", "insta", "influenceur", "food blogger", "blogueur", "createur"}),
    ]
    for source, terms in source_terms:
        if any(_fingerprint(term) in fp for term in terms):
            sources.append(source)

    # Secteurs physiques → Maps en priorité, pas LinkedIn
    physical_sectors = {"restaurant", "hotel", "clinique", "pharmacie", "garage", "cafe", "dentiste", "medecin"}
    detected_sector = _detect_sector(fp)

    if detected_sector in {"expert comptable"}:
        sources = ["google_maps", "website", "facebook"]
    elif is_creator:
        sources = ["instagram", "facebook"]
    elif search_type == "prospect":
        sources = sources or ["linkedin", "website"]
    elif detected_sector in physical_sectors:
        sources = sources or ["google_maps", "website", "facebook"]
    else:
        sources = sources or ["google_maps", "website", "facebook", "instagram"]

    return _unique(sources)


def _detect_requirements(fp: str) -> dict[str, bool]:
    return {
        "require_phone": any(term in fp for term in ["telephone", "tel", "appel", "numero"]),
        "require_email": "email" in fp or "mail" in fp,
        "require_website": "site web" in fp or "website" in fp,
        "require_linkedin": "linkedin" in fp,
        "require_facebook": "facebook" in fp,
        "require_instagram": "instagram" in fp or "insta" in fp,
    }


def _extract_max_results(fp: str, explicit: Any, fallback: int) -> int:
    if explicit not in [None, ""]:
        try:
            return max(1, min(int(explicit), fallback))
        except (TypeError, ValueError):
            return fallback
    match = re.search(r"\b(?:top|les)?\s*(\d{1,2})\b", fp)
    if match:
        return max(1, min(int(match.group(1)), fallback))
    return min(10, fallback)


def _keywords(fp: str) -> list[str]:
    useful = []
    for token in fp.split():
        if len(token) >= 4 and token not in {
            "avec", "dans", "pour", "trouve", "trouver", "cherche", "recherche",
            "tunisie", "tunis", "sousse", "sfax", "email", "telephone",
        }:
            useful.append(token)
    return _unique(useful[:8])


def _summary(criteria: dict[str, Any]) -> str:
    parts = [criteria.get("search_type", "company")]
    if criteria.get("job_title"):
        parts.append(f"poste={criteria['job_title']}")
    if criteria.get("secteur"):
        parts.append(f"secteur={criteria['secteur']}")
    if criteria.get("ville"):
        parts.append(f"ville={criteria['ville']}")
    if criteria.get("sources"):
        parts.append(f"sources={','.join(criteria['sources'])}")
    return " | ".join(parts)


def _unique(items: list[str]) -> list[str]:
    return [item for index, item in enumerate(items) if item and item not in items[:index]]
