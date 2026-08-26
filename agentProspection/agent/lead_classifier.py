import re
import unicodedata
from difflib import SequenceMatcher
from urllib.parse import urlparse


# ============================================================
# CONSTANTS
# ============================================================

STOPWORDS = {
    "trouve", "trouver", "cherche", "chercher",
    "avec", "dans", "pour", "des", "les", "une", "un",
    "de", "du", "la", "le", "en", "a", "à", "sur",
    "prospect", "prospects", "entreprise", "entreprises",
    "personne", "personnes",
    "company", "companies", "business", "businesses",
}

NOISE_TERMS = {
    "annuaire",
    "directory",
    "pages jaunes",
    "classement",
    "wikipedia",
    "captcha",
    "access denied",
    "sign in",
    "login required",
    "job vacancy",
    "job vacancies",
    "offre d emploi",
    "offres d emploi",
}

CONTACT_URL_FIELDS = {
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
}

META_ADS_SOURCES = {
    "meta_ads",
    "meta_ads_library",
    "ads_library_search",
}

TUNISIA_TERMS = {
    "tunisie", "tunisia", "tunis", "ariana", "ben arous",
    "manouba", "sousse", "sfax", "nabeul", "bizerte",
    "monastir", "mahdia", "gabes", "kairouan", "hammamet",
    "djerba", "medenine", "tozeur", "gafsa", "beja",
    "jendouba", "kef", "siliana", "zaghouan", "kasserine",
    "sidi bouzid", "tataouine", "kebili",
}

FOREIGN_LOCATION_TERMS = {
    "paris", "nanterre", "france", "lyon", "marseille",
    "ile de france", "region parisienne",
    "paris et peripherie", "maroc", "morocco",
    "algerie", "algeria", "allemagne", "germany",
    "italie", "italy", "espagne", "spain", "canada",
}


# ============================================================
# NORMALIZATION
# ============================================================

def normalize(value: str | None) -> str:
    text = unicodedata.normalize(
        "NFKD",
        str(value or ""),
    )
    text = "".join(
        char
        for char in text
        if not unicodedata.combining(char)
    )
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return " ".join(text.split())


def _stem_token(token: str) -> str:
    """
    Stemming volontairement léger et générique — aucun dictionnaire
    de domaine. Objectif : rapprocher les variantes morphologiques
    simples les plus fréquentes en français/anglais, quel que soit
    le secteur (agence/agences, restaurant/restaurants, meuble/meubles,
    company/companies...).
    """
    token = normalize(token)

    if len(token) <= 4:
        return token

    # Suffixes composés à traiter avant le "s" générique.
    for suffix in ("ements", "ement", "ations", "ation", "iques", "ique"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            return token[:-len(suffix)]

    # Pluriel anglais en "-ies" -> singulier "-y" (company/companies).
    if token.endswith("ies") and len(token) > 5:
        return token[:-3] + "y"

    # Pluriel simple (le cas le plus courant en français ET en anglais) :
    # une seule lettre "s" en trop, jamais deux. NE PAS traiter "-es"
    # comme un suffixe à part : "agences" doit redevenir "agence",
    # pas "agenc" (ce qui cassait tout matching pluriel/singulier).
    if token.endswith("s") and len(token) > 4:
        return token[:-1]

    return token


def tokenize(value: str | None) -> set[str]:
    result = set()

    for token in normalize(value).split():
        if len(token) <= 2:
            continue

        if token in STOPWORDS:
            continue

        stemmed = _stem_token(token)

        if stemmed:
            result.add(stemmed)

    return result

def _dedupe_text(values) -> list[str]:
    result = []
    seen = set()

    for value in values or []:
        text = str(value or "").strip()
        key = normalize(text)

        if not key or key in seen:
            continue

        seen.add(key)
        result.append(text)

    return result


# ============================================================
# SOURCE
# ============================================================

def source_name(entity: dict) -> str:
    return normalize(
        entity.get("source")
        or entity.get("source_name")
        or ""
    ).replace(" ", "_")


def is_meta_ads_source(entity: dict) -> bool:
    source = source_name(entity)

    normalized_sources = {
        normalize(value).replace(" ", "_")
        for value in META_ADS_SOURCES
    }

    return source in normalized_sources


# ============================================================
# CONTACT
# ============================================================

def has_valid_contact_url(entity: dict) -> bool:
    return any(
        bool(entity.get(field))
        for field in CONTACT_URL_FIELDS
    )


def has_contact_information(entity: dict) -> bool:
    return bool(
        entity.get("email")
        or entity.get("phone")
        or has_valid_contact_url(entity)
    )


# ============================================================
# IDENTITY
# ============================================================

def has_identity(entity: dict) -> bool:
    return bool(
        entity.get("company_name")
        or entity.get("full_name")
        or entity.get("page_name")
        or entity.get("advertiser_name")
    )


# ============================================================
# EVIDENCE
# ============================================================

def secondary_evidence_text(entity: dict) -> str:
    """
    Agrège toutes les preuves secondaires connues.

    Le classifier ne connaît aucun secteur à l'avance.
    Il exploite uniquement les preuves réellement ramenées
    par Serper / Maps / LinkedIn / Facebook / Instagram / Web.
    """

    parts = []

    for field in (
        "verified_industry",
        "verified_category",
        "verified_description",
        "verification_text",
        "secondary_source_text",
        "serper_title",
        "serper_snippet",
        "serper_content",
        "content_title",
        "content",
        "description",
        "snippet",
        "title",
    ):
        value = entity.get(field)

        if value:
            parts.append(str(value))

    evidence = (
        entity.get("verification_evidence")
        or entity.get("secondary_evidence")
        or entity.get("evidence")
        or []
    )

    if isinstance(evidence, dict):
        evidence = [evidence]

    if isinstance(evidence, list):
        for item in evidence:
            if isinstance(item, dict):
                for field in (
                    "title",
                    "snippet",
                    "description",
                    "content",
                    "industry",
                    "category",
                    "location",
                    "address",
                    "city",
                    "country",
                    "source_name",
                ):
                    value = item.get(field)

                    if value:
                        parts.append(str(value))
            elif item:
                parts.append(str(item))

    return " ".join(parts).strip()


def entity_business_text(entity: dict) -> str:
    """
    Texte métier fiable utilisé pour comparer un candidat
    avec l'intention comprise par Gemini.
    """

    parts = [
        entity.get("industry"),
        entity.get("category"),
        entity.get("primary_type"),
        entity.get("company_name"),
        entity.get("page_name"),
        entity.get("advertiser_name"),
        entity.get("job_title"),
        entity.get("content_title"),
        entity.get("content"),
        entity.get("description"),
        entity.get("snippet"),
        entity.get("website"),
        secondary_evidence_text(entity),
    ]

    # Pour Meta Ads seul, le texte publicitaire ne doit pas prouver
    # le secteur de l'annonceur. On garde seulement l'identité et
    # les preuves secondaires déjà obtenues.
    if is_meta_ads_source(entity):
        parts = [
            entity.get("industry"),
            entity.get("category"),
            entity.get("primary_type"),
            entity.get("company_name"),
            entity.get("page_name"),
            entity.get("advertiser_name"),
            entity.get("website"),
            secondary_evidence_text(entity),
        ]

    return " ".join(
        str(value or "")
        for value in parts
        if value
    )


# ============================================================
# NOISE
# ============================================================

def is_noise_lead(lead: dict) -> bool:
    text = normalize(
        " ".join(
            [
                str(lead.get("company_name") or ""),
                str(lead.get("full_name") or ""),
                str(lead.get("job_title") or ""),
                str(lead.get("content_title") or ""),
                str(lead.get("content") or ""),
            ]
        )
    )

    return any(
        normalize(term) in text
        for term in NOISE_TERMS
    )


# ============================================================
# TYPE
# ============================================================

def classify_lead_type(lead: dict) -> str:
    explicit = normalize(
        lead.get("lead_type")
        or lead.get("entity_type")
    )

    if explicit in {"person", "company"}:
        return explicit

    linkedin_url = str(
        lead.get("linkedin_url")
        or lead.get("source_url")
        or ""
    ).lower()

    if "linkedin.com/in/" in linkedin_url:
        return "person"

    if "linkedin.com/company/" in linkedin_url:
        return "company"

    if (
        lead.get("google_place_id")
        or lead.get("google_maps_url")
        or lead.get("maps_url")
    ):
        return "company"

    if (
        lead.get("advertiser_name")
        or lead.get("page_name")
        or lead.get("facebook_page_identifier")
        or lead.get("meta_ads_page_id")
    ):
        return "company"

    if (
        lead.get("full_name")
        or lead.get("first_name")
        or lead.get("last_name")
    ):
        return "person"

    if lead.get("company_name"):
        return "company"

    return "unknown"


def intent_lead_type(intent: dict) -> str:
    values = intent.get("lead_types") or []

    if isinstance(values, str):
        values = [values]

    for value in values:
        value = normalize(value)

        if value in {"person", "company"}:
            return value

    return ""


def type_matches(lead: dict, intent: dict) -> bool:
    requested = intent_lead_type(intent)
    actual = classify_lead_type(lead)

    if not requested:
        return actual != "unknown"

    return requested == actual


# ============================================================
# ROLE
# ============================================================

def role_matches(entity: dict, intent: dict) -> bool:
    roles = intent.get("target_roles") or []

    if not roles:
        return True

    text = normalize(
        " ".join(
            [
                str(entity.get("job_title") or ""),
                str(entity.get("content_title") or ""),
                str(entity.get("content") or ""),
                str(entity.get("description") or ""),
                str(entity.get("snippet") or ""),
                secondary_evidence_text(entity),
            ]
        )
    )

    if not text:
        return False

    entity_tokens = tokenize(text)

    for role in roles:
        role_normalized = normalize(role)

        if not role_normalized:
            continue

        if role_normalized in text:
            return True

        role_tokens = tokenize(role_normalized)

        if not role_tokens:
            continue

        overlap = len(
            role_tokens & entity_tokens
        ) / len(role_tokens)

        if overlap >= 0.70:
            return True

    return False


# ============================================================
# GENERIC BUSINESS MATCHING
# ============================================================

def intent_business_terms(intent: dict) -> list[str]:
    """
    Les termes métier viennent de Gemini :
    - industries
    - search_keywords

    Aucun domaine n'est codé en dur dans le classifier.
    """

    return _dedupe_text(
        list(intent.get("industries") or [])
        + list(intent.get("search_keywords") or [])
    )


def _term_match_score(
    target: str,
    evidence_text: str,
) -> float:
    target_norm = normalize(target)
    evidence_norm = normalize(evidence_text)

    if not target_norm or not evidence_norm:
        return 0.0

    if target_norm in evidence_norm:
        return 1.0

    target_tokens = tokenize(target_norm)
    evidence_tokens = tokenize(evidence_norm)

    if not target_tokens or not evidence_tokens:
        return 0.0

    token_overlap = len(
        target_tokens & evidence_tokens
    ) / len(target_tokens)

    # Similarité textuelle utilisée seulement comme appoint,
    # pas comme validation principale.
    sequence_ratio = SequenceMatcher(
        None,
        target_norm,
        evidence_norm,
    ).ratio()

    return max(
        token_overlap,
        sequence_ratio * 0.60,
    )


def industry_matches(entity: dict, intent: dict) -> bool:
    """
    Validation métier générique.

    Gemini comprend le secteur et génère industries/search_keywords.
    Python vérifie ensuite si les preuves du candidat correspondent
    réellement à ces termes.

    Aucun dictionnaire restaurant/meuble/voyage/etc.
    """

    business_terms = intent_business_terms(intent)

    if not business_terms:
        return True

    evidence_text = entity_business_text(entity)

    if not evidence_text:
        return False

    scores = [
        _term_match_score(
            term,
            evidence_text,
        )
        for term in business_terms
    ]

    # Une correspondance claire sur au moins une formulation
    # métier fournie par Gemini suffit.
    return max(scores, default=0.0) >= 0.55


# ============================================================
# LOCATION SIGNALS
# ============================================================

def linkedin_hostname(entity: dict) -> str:
    value = str(
        entity.get("linkedin_url")
        or entity.get("source_url")
        or ""
    )

    if not value:
        return ""

    try:
        return (urlparse(value).hostname or "").lower()
    except Exception:
        return ""


def has_tn_linkedin_signal(entity: dict) -> bool:
    return linkedin_hostname(entity) == "tn.linkedin.com"


def has_tunisian_contact_signal(entity: dict) -> bool:
    phone = re.sub(
        r"\D",
        "",
        str(entity.get("phone") or ""),
    )

    if phone.startswith("216"):
        return True

    email = str(entity.get("email") or "").lower()

    if "@" in email:
        domain = email.split("@")[-1]

        if domain.endswith(".tn"):
            return True

    website = str(entity.get("website") or "")

    if website:
        try:
            hostname = (
                urlparse(
                    website
                    if "://" in website
                    else "https://" + website
                ).hostname
                or ""
            ).lower()

            if hostname.endswith(".tn"):
                return True
        except Exception:
            pass

    return False


def _structured_location_text(entity: dict) -> str:
    return normalize(
        " ".join(
            [
                str(entity.get("city") or ""),
                str(entity.get("country") or ""),
                str(entity.get("company_country") or ""),
                str(entity.get("location") or ""),
                str(entity.get("address") or ""),
            ]
        )
    )


def _evidence_location_text(entity: dict) -> str:
    """
    Les preuves de localisation externes sont utilisables.
    Le texte publicitaire Meta seul ne l'est pas.
    """
    return normalize(
        " ".join(
            [
                _structured_location_text(entity),
                secondary_evidence_text(entity),
            ]
        )
    )


def detect_explicit_foreign_location(entity: dict) -> str | None:
    text = _evidence_location_text(entity)

    for term in FOREIGN_LOCATION_TERMS:
        normalized_term = normalize(term)

        if (
            normalized_term
            and normalized_term in text
        ):
            return normalized_term

    return None


def detect_explicit_tunisian_current_location(entity: dict) -> str | None:
    text = _evidence_location_text(entity)

    for term in TUNISIA_TERMS:
        normalized_term = normalize(term)

        if (
            normalized_term
            and normalized_term in text
        ):
            return normalized_term

    return None


def location_status(entity: dict, intent: dict) -> str:
    locations = intent.get("locations") or ["Tunisie"]

    requested = normalize(
        " ".join(
            str(value)
            for value in locations
        )
    )

    if detect_explicit_foreign_location(entity):
        return "incompatible"

    current = detect_explicit_tunisian_current_location(entity)

    if current:
        if requested in {"tunisie", "tunisia"}:
            return "confirmed"

        requested_tokens = tokenize(requested)
        current_tokens = tokenize(current)

        if (
            requested_tokens
            and requested_tokens & current_tokens
        ):
            return "confirmed"

        # Même pays mais ville non prouvée précisément.
        return "compatible"

    if (
        entity.get("google_place_id")
        and normalize(entity.get("country"))
        in {"tunisie", "tunisia"}
    ):
        return "confirmed"

    if has_tunisian_contact_signal(entity):
        return "compatible"

    if has_tn_linkedin_signal(entity):
        return "compatible"

    # Important :
    # ad_reached_countries=["TN"] ne prouve pas que
    # l'annonceur est tunisien.
    return "unknown"


def location_matches(entity: dict, intent: dict) -> bool:
    return location_status(
        entity,
        intent,
    ) in {
        "confirmed",
        "compatible",
    }


# ============================================================
# SEMANTIC VALIDATION
# ============================================================

SEMANTIC_VALIDATION_MIN_CONFIDENCE = 0.70


def semantic_validation(entity: dict) -> dict:
    """
    Retourne la validation sémantique ajoutée par GeminiBrain.

    Aucun domaine métier n'est codé en dur ici.
    """
    value = entity.get("semantic_validation")

    if not isinstance(value, dict):
        return {}

    return value


def semantic_validation_is_usable(entity: dict) -> bool:
    validation = semantic_validation(entity)

    if not validation:
        return False

    try:
        confidence = float(
            validation.get("confidence")
            or 0.0
        )
    except (TypeError, ValueError):
        return False

    return confidence >= SEMANTIC_VALIDATION_MIN_CONFIDENCE


def resolved_sector_match(
    entity: dict,
    intent: dict,
) -> tuple[bool, str]:
    """
    Résout la compatibilité secteur.

    Règle spéciale Meta Ads :
    dès qu'une validation Gemini existe, sa décision sectorielle est
    utilisée directement, même avec une confiance prudente.

    Pourquoi :
    le fallback lexical est adapté comme secours pour les autres sources,
    mais il est dangereux pour Meta Ads car le texte publicitaire peut
    contenir les mots du secteur sans que l'annonceur appartienne
    réellement à ce secteur.

    Les autres outils gardent exactement leur comportement historique.
    """
    validation = semantic_validation(entity)

    if is_meta_ads_source(entity) and validation:
        return (
            bool(validation.get("sector_match")),
            "gemini_meta",
        )

    if semantic_validation_is_usable(entity):
        return (
            bool(validation.get("sector_match")),
            "gemini",
        )

    return (
        industry_matches(entity, intent),
        "lexical_fallback",
    )


def resolved_role_match(
    entity: dict,
    intent: dict,
) -> tuple[bool, str]:
    roles = intent.get("target_roles") or []

    if not roles:
        return True, "not_required"

    validation = semantic_validation(entity)

    if semantic_validation_is_usable(entity):
        return (
            bool(validation.get("role_match")),
            "gemini",
        )

    return (
        role_matches(entity, intent),
        "lexical_fallback",
    )


def resolved_location_status(
    entity: dict,
    intent: dict,
) -> tuple[str, str]:
    """
    Les preuves déterministes explicitement incompatibles restent
    prioritaires. Gemini peut compléter une localisation inconnue,
    mais ne peut pas annuler une incompatibilité explicite.
    """
    deterministic = location_status(
        entity,
        intent,
    )

    if deterministic == "incompatible":
        return "incompatible", "deterministic"

    validation = semantic_validation(entity)

    if semantic_validation_is_usable(entity):
        semantic_status = str(
            validation.get("location_status")
            or "unknown"
        ).strip().lower()

        if semantic_status in {
            "confirmed",
            "compatible",
            "unknown",
            "incompatible",
        }:
            if semantic_status == "incompatible":
                return "incompatible", "gemini"

            # Une preuve déterministe confirmée/compatible est
            # plus forte qu'une réponse Gemini "unknown".
            if (
                deterministic in {"confirmed", "compatible"}
                and semantic_status == "unknown"
            ):
                return deterministic, "deterministic"

            return semantic_status, "gemini"

    return deterministic, "deterministic"


# ============================================================
# VALID LEAD
# ============================================================

def is_valid_lead(
    lead: dict,
    intent: dict,
    role_match: bool | None = None,
    sector_match: bool | None = None,
    location_match: bool | None = None,
    has_source: bool | None = None,
) -> bool:
    # Meta Ads seul n'est jamais CRM-ready.
    # Un candidat Meta confirmé par une source secondaire est
    # normalement fusionné avec cette source et n'a donc plus
    # "meta_ads_library" comme source principale. Ce garde-fou
    # couvre aussi le cas où la source serait restée Meta par erreur.
    if (
        is_meta_ads_source(lead)
        and not lead.get("meta_secondary_verified")
    ):
        return False

    if is_noise_lead(lead):
        return False

    if not has_identity(lead):
        return False

    if not type_matches(lead, intent):
        return False

    if has_source is None:
        has_source = has_contact_information(lead)

    if not has_source:
        return False

    requested_type = intent_lead_type(intent)

    if role_match is None:
        role_match, _ = resolved_role_match(
            lead,
            intent,
        )

    if sector_match is None:
        sector_match, _ = resolved_sector_match(
            lead,
            intent,
        )

    if (
        requested_type == "person"
        and intent.get("target_roles")
        and not role_match
    ):
        return False

    if (
        requested_type == "company"
        and intent_business_terms(intent)
        and not sector_match
    ):
        return False

    status, _ = resolved_location_status(
        lead,
        intent,
    )

    # Une localisation explicitement incompatible reste éliminatoire.
    if status == "incompatible":
        return False

    if status in {"confirmed", "compatible"}:
        return True

    # Une localisation inconnue peut être acceptée lorsque
    # le secteur a été confirmé.
    if status == "unknown" and sector_match:
        return True

    return False


# ============================================================
# REJECTION
# ============================================================

def rejection_reason(lead: dict, intent: dict) -> str:
    sector_match, sector_origin = resolved_sector_match(
        lead,
        intent,
    )

    role_match, role_origin = resolved_role_match(
        lead,
        intent,
    )

    status, location_origin = resolved_location_status(
        lead,
        intent,
    )

    if (
        is_meta_ads_source(lead)
        and not lead.get("meta_secondary_verified")
    ):
        if not has_identity(lead):
            return "Annonceur Meta Ads sans identité exploitable"

        if (
            intent_business_terms(intent)
            and not sector_match
        ):
            return "Secteur non confirmé pour l'annonceur Meta Ads"

        return "Annonceur Meta Ads à vérifier avec une seconde source"

    if is_noise_lead(lead):
        return "Résultat bruité ou non exploitable"

    if not has_identity(lead):
        return "Identité insuffisante"

    if not type_matches(lead, intent):
        return "Type d'entité incompatible"

    if not has_contact_information(lead):
        return "Aucun moyen de contact exploitable"

    requested_type = intent_lead_type(intent)

    if (
        requested_type == "person"
        and intent.get("target_roles")
        and not role_match
    ):
        return (
            "Rôle incompatible"
            if role_origin != "gemini"
            else "Rôle incompatible selon validation sémantique"
        )

    if (
        requested_type == "company"
        and intent_business_terms(intent)
        and not sector_match
    ):
        return (
            "Secteur incompatible"
            if sector_origin != "gemini"
            else "Secteur incompatible selon validation sémantique"
        )

    if status == "incompatible":
        return (
            "Localisation incompatible"
            if location_origin != "gemini"
            else "Localisation incompatible selon validation sémantique"
        )

    if status == "unknown":
        return "Localisation non confirmée"

    return "Prospect insuffisamment pertinent"


# ============================================================
# QUALIFICATION
# ============================================================

def qualify_entity(entity: dict, intent: dict) -> dict:
    entity["lead_type"] = classify_lead_type(entity)

    type_match = type_matches(
        entity,
        intent,
    )

    role_match, role_match_origin = resolved_role_match(
        entity,
        intent,
    )

    sector_match, sector_match_origin = resolved_sector_match(
        entity,
        intent,
    )

    location_state, location_origin = resolved_location_status(
        entity,
        intent,
    )

    location_match = (
        location_state
        in {
            "confirmed",
            "compatible",
        }
    )

    source_match = has_contact_information(
        entity
    )

    meta_ads_candidate = is_meta_ads_source(
        entity
    )

    meta_ads_unverified = (
        meta_ads_candidate
        and not entity.get(
            "meta_secondary_verified"
        )
    )

    valid = is_valid_lead(
        entity,
        intent,
        role_match=role_match,
        sector_match=sector_match,
        has_source=source_match,
    )

    if meta_ads_unverified:
        # Meta Ads seul n'est jamais CRM-ready.
        valid = False
        entity["verification_required"] = True
        entity["verification_source"] = "secondary_source"
        entity["meta_validation_status"] = "pending_secondary_verification"
    else:
        entity["verification_required"] = False
        entity["verification_source"] = (
            entity.get("verification_source")
            or None
        )

    entity["is_valid"] = valid
    entity["crm_ready"] = valid
    entity["type_match"] = type_match
    entity["role_match"] = role_match
    entity["sector_match"] = sector_match
    entity["location_match"] = location_match
    entity["location_status"] = location_state
    entity["has_contact"] = source_match

    # Diagnostic : permet de savoir si la décision vient
    # de Gemini ou du fallback déterministe.
    entity["role_match_origin"] = role_match_origin
    entity["sector_match_origin"] = sector_match_origin
    entity["location_status_origin"] = location_origin

    reasons = []

    if type_match:
        reasons.append("Type compatible")

    if role_match:
        reasons.append("Rôle compatible")

    if sector_match:
        reasons.append("Secteur compatible")

    if location_state == "confirmed":
        reasons.append("Localisation confirmée")
    elif location_state == "compatible":
        reasons.append("Localisation tunisienne compatible")
    elif location_state == "unknown" and sector_match:
        reasons.append("Localisation inconnue acceptée avec secteur confirmé")

    if source_match:
        reasons.append("Moyen de contact disponible")

    if semantic_validation_is_usable(entity):
        reasons.append("Validation sémantique Gemini")

    if meta_ads_candidate:
        reasons.append("Annonceur actif détecté via Meta Ads")

        strength = str(
            entity.get("meta_evidence_strength")
            or ""
        ).strip().lower()

        if strength == "strong":
            reasons.append("Signal Meta Ads cohérent sur plusieurs publicités")
        elif strength == "medium":
            reasons.append("Signal Meta Ads à confirmer")

        reasons.append("Validation secondaire requise")

    entity["qualification_reasons"] = reasons

    entity["rejection_reason"] = (
        ""
        if valid
        else rejection_reason(
            entity,
            intent,
        )
    )

    if meta_ads_unverified:
        entity["enrichment_status"] = "verification_required"
    else:
        entity["enrichment_status"] = get_enrichment_status(
            entity
        )

    return entity


# ============================================================
# COMPATIBILITY
# ============================================================

def final_quality_rejection_reason(
    lead: dict,
    intent: dict,
    query: str,
) -> str:
    if lead.get("is_valid"):
        return ""

    return rejection_reason(
        lead,
        intent,
    )


def brand_company_rejection_reason(
    lead: dict,
    query: str,
) -> str:
    return ""


def is_relevant_to_query(
    lead: dict,
    query: str,
    intent: dict,
) -> bool:
    return is_valid_lead(
        lead,
        intent,
    )


# ============================================================
# ENRICHMENT STATUS
# ============================================================

def get_enrichment_status(
    lead: dict,
) -> str:
    if (
        lead.get("email")
        or lead.get("phone")
    ):
        return "enriched"

    if has_valid_contact_url(lead):
        return "source_only"

    return "needs_enrichment"