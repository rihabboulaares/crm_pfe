import re
import unicodedata


ROLE_RELEVANCE_RULES = {
    "low": {
        "keywords": [
            "stagiaire",
            "stage",
            "student",
            "etudiant",
            "étudiant",
            "assistant",
            "junior",
            "alternant",
            "apprenti",
        ],
        "score": 22,
    },
    "high": {
        "keywords": [
            "ceo",
            "directeur",
            "directrice",
            "founder",
            "fondateur",
            "gerant",
            "gérant",
            "responsable",
            "head of",
            "head",
            "manager",
            "vp",
            "drh",
            "achats",
            "commercial",
            "marketing",
        ],
        "score": 88,
    },
    "medium": {
        "keywords": [
            "chef de projet",
            "project manager",
            "consultant senior",
            "charge de mission",
            "chargé de mission",
            "coordinateur",
            "coordinator",
            "consultant",
            "lead",
        ],
        "score": 62,
    },
}

PROFILE_COMPLETENESS_FIELDS = [
    ("first_name", "first_name"),
    ("last_name", "last_name"),
    ("title", "job_title"),
    ("email", "email"),
    ("phone", "phone"),
    ("linkedin_url", "linkedin_url"),
    ("description", "description"),
    ("source", "source"),
    ("city", "location"),
    ("country", "location"),
]

COMPANY_COMPLETENESS_FIELDS = [
    ("name", "company_name"),
    ("sector", "industry"),
    ("website", "website"),
    ("city", "company_location"),
    ("country", "company_location"),
    ("address", "company_address"),
    ("email", "company_email"),
    ("phone", "company_phone"),
    ("number_of_employees", "company_size"),
    ("annual_revenue", "annual_revenue"),
]

REACHABILITY_CHANNELS = [
    "email",
    "phone",
    "linkedin_url",
    "facebook_url",
    "instagram_url",
]

ROLE_SYNONYMS = {
    "ressources humaines": "rh",
    "human resources": "rh",
    "hr": "rh",
    "drh": "rh",
    "ventes": "commercial",
    "sales": "commercial",
    "business development": "commercial",
    "bizdev": "commercial",
    "marketing digital": "marketing",
    "digital marketing": "marketing",
}

SECTOR_SYNONYMS = {
    "software as a service": "saas",
    "logiciel": "software",
    "technologie": "tech",
    "technology": "tech",
    "informatique": "it",
    "ressources humaines": "rh",
}


def clamp_score(value):
    return max(0, min(100, int(round(value or 0))))


def has_value(value):
    if isinstance(value, str):
        return bool(value.strip())
    return value is not None


def normalize_text(value) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text)


def canonicalize_text(value, synonyms=None) -> str:
    text = normalize_text(value)
    for source, replacement in (synonyms or {}).items():
        text = re.sub(rf"\b{re.escape(source)}\b", replacement, text)
    return text


def tokens(value) -> set[str]:
    return {
        token
        for token in re.split(r"[^a-z0-9]+", normalize_text(value))
        if len(token) > 1
    }


def contains_any(text, keywords):
    normalized = str(text or "").lower()
    return any(keyword in normalized for keyword in keywords)


def calculate_completeness(data, field_rules):
    missing = []
    present_keys = set()
    for field, missing_key in field_rules:
        if has_value((data or {}).get(field)):
            present_keys.add(missing_key)
        else:
            missing.append(missing_key)
    distinct_expected = {missing_key for _, missing_key in field_rules}
    score = (len(present_keys) / max(len(distinct_expected), 1)) * 100
    return clamp_score(score), sorted(set(missing))


def target_text_match_score(value, targets, synonyms=None):
    if not targets:
        return None, None
    if not has_value(value):
        return 20, None

    canonical_value = canonicalize_text(value, synonyms)
    value_tokens = tokens(canonical_value)
    best_score = 25
    best_target = None

    for target in targets:
        canonical_target = canonicalize_text(target, synonyms)
        target_tokens = tokens(canonical_target)
        if not canonical_target:
            continue
        if canonical_target in canonical_value or canonical_value in canonical_target:
            return 96, target
        if not target_tokens:
            continue
        overlap = len(value_tokens & target_tokens) / len(target_tokens)
        if overlap >= 0.75 and best_score < 85:
            best_score = 85
            best_target = target
        elif overlap >= 0.45 and best_score < 65:
            best_score = 65
            best_target = target

    return best_score, best_target


def calculate_contact_relevance(title, qualification_target=None, return_details=False):
    target_roles = (qualification_target or {}).get("target_roles") or []
    if target_roles:
        score, matched_target = target_text_match_score(
            title,
            target_roles,
            ROLE_SYNONYMS,
        )
        result = {
            "score": clamp_score(score),
            "source": "ICP",
            "matched_target": matched_target,
            "configured_targets": target_roles,
        }
        return result if return_details else result["score"]

    if not has_value(title):
        score = 20
    if contains_any(title, ROLE_RELEVANCE_RULES["low"]["keywords"]):
        score = ROLE_RELEVANCE_RULES["low"]["score"]
    elif contains_any(title, ROLE_RELEVANCE_RULES["high"]["keywords"]):
        score = ROLE_RELEVANCE_RULES["high"]["score"]
    elif contains_any(title, ROLE_RELEVANCE_RULES["medium"]["keywords"]):
        score = ROLE_RELEVANCE_RULES["medium"]["score"]
    else:
        score = 45

    result = {
        "score": clamp_score(score),
        "source": "GENERIC_FALLBACK",
        "matched_target": None,
        "configured_targets": [],
    }
    return result if return_details else result["score"]


def calculate_reachability(prospect):
    channels = [field for field in REACHABILITY_CHANNELS if has_value((prospect or {}).get(field))]
    count = len(channels)
    if count == 0:
        score = 0
    elif count == 1:
        score = 40
    elif count == 2:
        score = 70
    else:
        score = 100
    return score, channels


def location_score(value, targets):
    if not targets:
        return None, None
    if not has_value(value):
        return None, None
    normalized_value = normalize_text(value)
    for target in targets:
        normalized_target = normalize_text(target)
        if normalized_target and (
            normalized_target == normalized_value
            or normalized_target in normalized_value
            or normalized_value in normalized_target
        ):
            return 100, target
    return 20, None


def company_size_score(employee_count, minimum=None, maximum=None):
    if minimum is None and maximum is None:
        return None
    if employee_count in (None, ""):
        return None
    try:
        count = int(employee_count)
    except (TypeError, ValueError):
        return None

    if minimum is not None and count < minimum:
        return 60 if count >= minimum * 0.7 else 20
    if maximum is not None and count > maximum:
        return 60 if count <= maximum * 1.3 else 20
    return 100


def calculate_generic_company_fit(company):
    if not company:
        return 20
    if not has_value(company.get("name")):
        return 25

    score = 45
    if has_value(company.get("sector")):
        score += 15
    if has_value(company.get("website")) or has_value(company.get("linkedin_url")):
        score += 12
    if has_value(company.get("city")) or has_value(company.get("country")) or has_value(company.get("address")):
        score += 8
    if has_value(company.get("number_of_employees")) or has_value(company.get("annual_revenue")):
        score += 10
    if has_value(company.get("source")):
        score += 5
    return clamp_score(min(score, 85))


def calculate_company_fit(company, qualification_target=None, return_details=False):
    target = qualification_target or {}
    configured_dimensions = []
    breakdown = {
        "industry_match": None,
        "country_match": None,
        "city_match": None,
        "company_size_match": None,
    }
    weighted_scores = []

    if target.get("target_sectors"):
        configured_dimensions.append("industry")
        company_sector = (company or {}).get("sector")
        if not has_value(company_sector):
            breakdown["industry_match"] = None
            weighted_scores.append(50)
        else:
            score, matched = target_text_match_score(
                company_sector,
                target.get("target_sectors") or [],
                SECTOR_SYNONYMS,
            )
            breakdown["industry_match"] = {
                "score": score,
                "matched_target": matched,
                "configured_targets": target.get("target_sectors") or [],
            }
            weighted_scores.append(score if score is not None else 50)

    if target.get("target_countries"):
        configured_dimensions.append("country")
        score, matched = location_score(
            (company or {}).get("country"),
            target.get("target_countries") or [],
        )
        breakdown["country_match"] = {
            "score": score,
            "matched_target": matched,
            "configured_targets": target.get("target_countries") or [],
        } if score is not None else None
        weighted_scores.append(score if score is not None else 50)

    if target.get("target_cities"):
        configured_dimensions.append("city")
        score, matched = location_score(
            (company or {}).get("city"),
            target.get("target_cities") or [],
        )
        breakdown["city_match"] = {
            "score": score,
            "matched_target": matched,
            "configured_targets": target.get("target_cities") or [],
        } if score is not None else None
        weighted_scores.append(score if score is not None else 50)

    minimum = target.get("target_company_size_min")
    maximum = target.get("target_company_size_max")
    if minimum is not None or maximum is not None:
        configured_dimensions.append("company_size")
        score = company_size_score(
            (company or {}).get("number_of_employees"),
            minimum,
            maximum,
        )
        breakdown["company_size_match"] = {
            "score": score,
            "configured_min": minimum,
            "configured_max": maximum,
        }
        weighted_scores.append(score if score is not None else 50)

    if configured_dimensions:
        score = clamp_score(sum(weighted_scores) / max(len(weighted_scores), 1))
        result = {
            "score": score,
            "source": "ICP",
            "breakdown": breakdown,
            "configured_dimensions": configured_dimensions,
        }
        return result if return_details else result["score"]

    score = calculate_generic_company_fit(company)
    result = {
        "score": score,
        "source": "GENERIC_FALLBACK",
        "breakdown": breakdown,
        "configured_dimensions": [],
    }
    return result if return_details else result["score"]


def calculate_compat_profile_fit(data_completeness_score, contact_relevance_score, company_fit_score):
    # Backward compatibility until scoring migration in phase 5.
    return clamp_score(
        contact_relevance_score * 0.55
        + company_fit_score * 0.30
        + data_completeness_score * 0.15
    )
