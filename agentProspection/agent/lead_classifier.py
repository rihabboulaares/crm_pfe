import re
import unicodedata


STOPWORDS = {
    "trouve", "chercher", "cherche", "avec", "dans", "pour",
    "des", "les", "une", "un", "de", "du", "la", "le",
    "en", "a", "à", "sur", "tunisie", "prospects",
    "entreprises", "personnes", "contact", "email", "telephone",
}

NOISE_TERMS = {
    "annuaire", "directory", "pages jaunes", "liste", "classement",
    "meilleur", "meilleurs", "formation", "cours", "universite",
    "université", "emploi", "job", "stage", "recrutement",
    "article", "blog", "forum", "pdf", "wikipedia",
}

PERSON_KEYWORDS = {
    "dentiste", "médecin", "medecin", "doctor", "docteur",
    "consultant", "coach", "architecte", "avocat",
    "responsable", "manager", "directeur", "ceo", "founder",
    "fondateur", "recruteur", "rh", "drh",
}

CONTACT_URL_FIELDS = [
    "linkedin_url",
    "facebook_url",
    "instagram_url",
    "website",
    "website_url",
    "maps_url",
    "google_maps_url",
    "source_url",
    "profile_url",
    "company_url",
    "raw_url",
]

COMPANY_KEYWORDS = {
    "cabinet", "clinique", "centre", "restaurant", "agence",
    "startup", "société", "societe", "company", "studio",
    "salon", "laboratoire", "sarl", "suarl", "groupe",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower().strip()


def tokenize(text: str) -> set[str]:
    text = normalize(text)
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text)

    return {
        word
        for word in text.split()
        if len(word) > 2 and word not in STOPWORDS
    }


def is_noise_lead(lead: dict) -> bool:
    text = " ".join([
        str(lead.get("company_name") or ""),
        str(lead.get("title") or ""),
        str(lead.get("content") or ""),
        str(lead.get("raw_url") or ""),
        str(lead.get("website") or ""),
    ])

    fp = normalize(text)

    return any(term in fp for term in NOISE_TERMS)


def has_valid_contact_url(entity: dict) -> bool:
    return any(entity.get(field) for field in CONTACT_URL_FIELDS)


def role_matches(entity: dict, intent: dict) -> bool:
    roles = intent.get("target_roles") or []
    if not roles:
        return True

    entity_text = " ".join([
        str(entity.get("title") or ""),
        str(entity.get("job_title") or ""),
        str(entity.get("content") or ""),
        str(entity.get("full_name") or ""),
        str(entity.get("company_name") or ""),
    ])
    entity_tokens = tokenize(entity_text)

    for role in roles:
        role_tokens = tokenize(role)
        if role_tokens and (role_tokens & entity_tokens):
            return True

    hr_terms = {"rh", "hr", "human", "resources", "ressources", "humaines", "talent", "recruiter", "recrutement"}
    if any(token in entity_tokens for token in hr_terms):
        return any(token in tokenize(" ".join(roles)) for token in hr_terms | {"responsable", "manager", "head"})

    return False


def location_matches(entity: dict, intent: dict) -> bool:
    locations = intent.get("locations") or []
    if not locations:
        return True

    entity_text = " ".join([
        str(entity.get("city") or ""),
        str(entity.get("country") or ""),
        str(entity.get("location") or ""),
        str(entity.get("content") or ""),
        str(entity.get("raw_url") or ""),
    ])
    entity_tokens = tokenize(entity_text)

    for location in locations:
        location_tokens = tokenize(location)
        if location_tokens and (location_tokens & entity_tokens):
            return True

    url_text = " ".join([
        str(entity.get("linkedin_url") or ""),
        str(entity.get("website") or ""),
        str(entity.get("raw_url") or ""),
        str(entity.get("source_url") or ""),
    ]).lower()
    requested = normalize(" ".join(locations))
    if ("tunis" in requested or "tunisie" in requested) and (
        "tn.linkedin.com" in url_text or ".tn" in url_text
    ):
        return True

    return False


def industry_matches(entity: dict, intent: dict) -> bool:
    industries = intent.get("industries") or []
    if not industries:
        return True

    entity_text = " ".join([
        str(entity.get("industry") or ""),
        str(entity.get("company_name") or ""),
        str(entity.get("title") or ""),
        str(entity.get("content") or ""),
        str(entity.get("website") or ""),
        str(entity.get("raw_url") or ""),
    ])
    entity_tokens = tokenize(entity_text)

    for industry in industries:
        industry_tokens = tokenize(industry)
        if industry_tokens and (industry_tokens & entity_tokens):
            return True

    tech_terms = {"it", "tech", "startup", "software", "saas", "digital", "informatique"}
    if any(token in entity_tokens for token in tech_terms):
        return any(token in tokenize(" ".join(industries)) for token in tech_terms)

    return False


def qualify_entity(entity: dict, intent: dict) -> dict:
    score = 0
    reasons = []
    has_source = has_valid_contact_url(entity)
    role_match = role_matches(entity, intent)
    sector_match = industry_matches(entity, intent)
    location_match = location_matches(entity, intent)

    if has_source:
        score += 30
        reasons.append("URL source fiable trouvee")

    if role_match:
        score += 25
        reasons.append("Role compatible avec la recherche")

    if sector_match:
        score += 20
        reasons.append("Secteur ou entreprise compatible")

    if location_match:
        score += 15
        reasons.append("Localisation compatible")

    if entity.get("email"):
        score += 5
        reasons.append("Email trouve")

    if entity.get("phone"):
        score += 5
        reasons.append("Telephone trouve")

    score = min(score, 100)
    is_valid = is_valid_lead(entity, intent, role_match, sector_match, location_match, has_source)
    entity["score"] = score
    entity["lead_score"] = score
    entity["score_ia"] = score
    entity["is_valid"] = is_valid
    entity["crm_ready"] = is_valid and score >= 60
    entity["role_match"] = role_match
    entity["sector_match"] = sector_match
    entity["location_match"] = location_match
    entity["qualification_reasons"] = reasons
    entity["raison_score"] = "; ".join(reasons)
    entity["enrichment_status"] = get_enrichment_status(entity)

    if score >= 70:
        entity["evaluation"] = "hot"
    elif score >= 40:
        entity["evaluation"] = "warm"
    else:
        entity["evaluation"] = "cold"

    return entity


def get_enrichment_status(lead: dict) -> str:
    if lead.get("email") or lead.get("phone"):
        return "enriched"
    return "needs_enrichment"


def intent_lead_types(intent: dict) -> set[str]:
    lead_types = intent.get("lead_types") or intent.get("lead_type") or []
    if isinstance(lead_types, str):
        lead_types = [lead_types]
    return {normalize(item) for item in lead_types}


def is_valid_lead(
    lead: dict,
    intent: dict,
    role_match: bool | None = None,
    sector_match: bool | None = None,
    location_match: bool | None = None,
    has_source: bool | None = None,
) -> bool:
    has_source = has_valid_contact_url(lead) if has_source is None else has_source
    role_match = role_matches(lead, intent) if role_match is None else role_match
    sector_match = industry_matches(lead, intent) if sector_match is None else sector_match
    location_match = location_matches(lead, intent) if location_match is None else location_match

    if not has_source:
        return False

    lead_types = intent_lead_types(intent)
    lead_type = classify_lead_type(lead)

    if "person" in lead_types or lead_type == "person":
        return role_match or sector_match

    if "company" in lead_types or lead_type == "company":
        return sector_match or role_match

    return has_source and (role_match or sector_match)


def classify_lead_type(lead: dict) -> str:
    company_name = normalize(lead.get("company_name"))
    title = normalize(lead.get("title"))
    source = normalize(lead.get("source"))

    full_text = f"{company_name} {title}"

    if lead.get("google_place_id") or source in {"maps", "google_maps"}:
        return "company"

    if lead.get("linkedin_url") and "/in/" in str(lead.get("linkedin_url")).lower():
        return "person"

    if lead.get("linkedin_url") and "/company/" in str(lead.get("linkedin_url")).lower():
        return "company"

    if any(k in full_text for k in COMPANY_KEYWORDS):
        return "company"

    if lead.get("first_name") or lead.get("last_name") or lead.get("full_name"):
        return "person"

    if any(k in full_text for k in PERSON_KEYWORDS):
        if len(company_name) > 60:
            return "company"
        return "person"

    return "company"


def is_relevant_to_query(lead: dict, query: str, intent: dict) -> bool:
    if is_noise_lead(lead):
        lead["rejected_reason"] = "noise_result"
        return False

    if lead.get("google_place_id") and normalize(lead.get("source")) in {"maps", "google_maps"}:
        return True

    lead_text = " ".join([
        str(lead.get("company_name") or ""),
        str(lead.get("title") or ""),
        str(lead.get("content") or ""),
        str(lead.get("website") or ""),
        str(lead.get("raw_url") or ""),
        str(lead.get("city") or ""),
    ])

    lead_tokens = tokenize(lead_text)

    industries = intent.get("industries") or []
    locations = intent.get("locations") or []
    roles = intent.get("target_roles") or []

    intent_tokens = set()

    for item in industries + locations + roles:
        intent_tokens |= tokenize(item)

    if not intent_tokens:
        return True

    if lead_tokens & intent_tokens:
        return True

    lead_type = classify_lead_type(lead)

    if lead_type == "person" and lead.get("linkedin_url"):
        return True

    if has_valid_contact_url(lead) and (role_matches(lead, intent) or industry_matches(lead, intent)):
        return True

    return False
