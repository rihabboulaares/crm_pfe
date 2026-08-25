import re
import unicodedata
from urllib.parse import urlparse


# ============================================================
# NORMALISATION
# ============================================================

LEGAL_WORDS = {
    "sarl",
    "suarl",
    "sa",
    "sas",
    "ltd",
    "llc",
    "inc",
    "societe",
    "société",
    "company",
    "compagnie",
    "groupe",
    "group",
    "holding",
}


GENERIC_COMPANY_WORDS = {
    "services",
    "service",
    "solutions",
    "solution",
    "consulting",
    "consult",
    "international",
    "global",
    "business",
    "digital",
    "technology",
    "technologies",
    "tech",
}


FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.fr",
    "hotmail.com",
    "hotmail.fr",
    "outlook.com",
    "live.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
}


def normalize_text(value: str | None) -> str:
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

    text = re.sub(
        r"[^a-z0-9]+",
        " ",
        text,
    )

    return " ".join(text.split())


def normalize_company_name(
    value: str | None,
) -> str:
    tokens = normalize_text(value).split()

    tokens = [
        token
        for token in tokens
        if token not in LEGAL_WORDS
    ]

    return " ".join(tokens)


# ============================================================
# PHONE
# ============================================================

def normalize_phone(
    value: str | None,
) -> str:
    """
    Normalise le téléphone sans inventer ni tronquer
    arbitrairement les numéros.

    Le préfixe tunisien est ajouté uniquement pour
    un numéro tunisien local clairement reconnaissable.
    """

    digits = re.sub(
        r"\D",
        "",
        str(value or ""),
    )

    if not digits:
        return ""

    if digits.startswith("00"):
        digits = digits[2:]

    # Numéro tunisien local : 8 chiffres.
    if (
        len(digits) == 8
        and digits[0] in "24579"
    ):
        digits = f"216{digits}"

    # Validation générale E.164.
    if not 8 <= len(digits) <= 15:
        return ""

    return f"+{digits}"


# ============================================================
# URL / DOMAIN
# ============================================================

def normalize_url(
    value: str | None,
) -> str:
    if not value:
        return ""

    raw = str(value).strip()

    try:
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
        )

        path = parsed.path.rstrip("/")

        if not host:
            return ""

        return f"https://{host}{path}"

    except Exception:
        return ""


def domain_from_url(
    url: str | None,
) -> str:
    normalized = normalize_url(url)

    if not normalized:
        return ""

    try:
        return (
            urlparse(normalized)
            .netloc
            .lower()
            .replace("www.", "")
        )
    except Exception:
        return ""


# ============================================================
# EMAIL
# ============================================================

def email_domain(
    email: str | None,
) -> str:
    if not email or "@" not in str(email):
        return ""

    domain = (
        str(email)
        .lower()
        .split("@")[-1]
        .strip()
    )

    # Gmail/Outlook/etc. ne constituent pas
    # une identité d'entreprise fiable.
    if domain in FREE_EMAIL_DOMAINS:
        return ""

    return domain


def normalize_email(
    email: str | None,
) -> str:
    value = str(email or "").strip().lower()

    if not value or "@" not in value:
        return ""

    return value


# ============================================================
# SOCIALS
# ============================================================

def social_identity(
    lead: dict,
) -> set[str]:
    values = {
        normalize_url(
            lead.get("linkedin_url")
        ),
        normalize_url(
            lead.get("facebook_url")
        ),
        normalize_url(
            lead.get("instagram_url")
        ),
    }

    return values - {""}


# ============================================================
# COMPANY IDENTITY
# ============================================================

def company_identity(
    lead: dict,
) -> dict:
    return {
        "google_place_id":
            str(
                lead.get("google_place_id")
                or ""
            ).strip(),

        "name":
            normalize_company_name(
                lead.get("company_name")
            ),

        "website_domain":
            domain_from_url(
                lead.get("website")
            ),

        "email_domain":
            email_domain(
                lead.get("email")
            ),

        "phone":
            normalize_phone(
                lead.get("phone")
            ),

        "socials":
            social_identity(lead),
    }


# ============================================================
# PERSON IDENTITY
# ============================================================

def person_identity(
    lead: dict,
) -> dict:
    return {
        "first_name":
            normalize_text(
                lead.get("first_name")
            ),

        "last_name":
            normalize_text(
                lead.get("last_name")
            ),

        "full_name":
            normalize_text(
                lead.get("full_name")
            ),

        "email":
            normalize_email(
                lead.get("email")
            ),

        "phone":
            normalize_phone(
                lead.get("phone")
            ),

        "linkedin_url":
            normalize_url(
                lead.get("linkedin_url")
            ),

        "company_name":
            normalize_company_name(
                lead.get("company_name")
            ),
    }


# ============================================================
# COMPANY NAME SIMILARITY
# ============================================================

def meaningful_name_tokens(
    name: str,
) -> set[str]:
    return {
        token
        for token in str(name or "").split()
        if len(token) >= 3
        and token not in GENERIC_COMPANY_WORDS
    }


def company_names_are_close(
    name_a: str,
    name_b: str,
) -> bool:
    tokens_a = meaningful_name_tokens(name_a)
    tokens_b = meaningful_name_tokens(name_b)

    if not tokens_a or not tokens_b:
        return False

    common = tokens_a & tokens_b

    if not common:
        return False

    # Ratio basé sur le plus PETIT des deux ensembles de tokens :
    # ça capture correctement le cas "nom court entièrement contenu
    # dans un nom plus long" (ex: "Holygo" vs "Holygo Voyages Tunisie"),
    # sans assouplir le cas de deux noms différents de longueur
    # comparable qui ne partagent qu'un mot par coïncidence.
    overlap = len(common) / min(
        len(tokens_a),
        len(tokens_b),
    )

    return overlap >= 0.85


# ============================================================
# SAME COMPANY
# ============================================================

def is_same_company(
    a: dict,
    b: dict,
) -> bool:
    ia = company_identity(a)
    ib = company_identity(b)

    # 1. Google Place ID : signal très fort.
    if (
        ia["google_place_id"]
        and ib["google_place_id"]
    ):
        return (
            ia["google_place_id"]
            == ib["google_place_id"]
        )

    # 2. Domaine officiel.
    if (
        ia["website_domain"]
        and ib["website_domain"]
    ):
        return (
            ia["website_domain"]
            == ib["website_domain"]
        )

    # 3. Domaine email professionnel.
    if (
        ia["email_domain"]
        and ib["email_domain"]
    ):
        return (
            ia["email_domain"]
            == ib["email_domain"]
        )

    # 4. Téléphone.
    if (
        ia["phone"]
        and ib["phone"]
    ):
        return (
            ia["phone"]
            == ib["phone"]
        )

    # 5. URL sociale identique.
    if (
        ia["socials"]
        and ib["socials"]
        and ia["socials"] & ib["socials"]
    ):
        return True

    # 6. Nom.
    if company_names_are_close(
        ia["name"],
        ib["name"],
    ):
        return True

    return False


# ============================================================
# SAME PERSON
# ============================================================

def is_same_person(
    a: dict,
    b: dict,
) -> bool:
    ia = person_identity(a)
    ib = person_identity(b)

    # LinkedIn = meilleur signal pour une personne.
    if (
        ia["linkedin_url"]
        and ib["linkedin_url"]
    ):
        return (
            ia["linkedin_url"]
            == ib["linkedin_url"]
        )

    if (
        ia["email"]
        and ib["email"]
    ):
        return (
            ia["email"]
            == ib["email"]
        )

    if (
        ia["phone"]
        and ib["phone"]
    ):
        return (
            ia["phone"]
            == ib["phone"]
        )

    if (
        ia["full_name"]
        and ib["full_name"]
        and ia["company_name"]
        and ib["company_name"]
    ):
        return (
            ia["full_name"]
            == ib["full_name"]
            and ia["company_name"]
            == ib["company_name"]
        )

    if (
        ia["first_name"]
        and ia["last_name"]
        and ib["first_name"]
        and ib["last_name"]
    ):
        same_name = (
            ia["first_name"]
            == ib["first_name"]
            and ia["last_name"]
            == ib["last_name"]
        )

        if not same_name:
            return False

        # Si les deux entreprises sont connues,
        # elles doivent être compatibles.
        if (
            ia["company_name"]
            and ib["company_name"]
        ):
            return (
                ia["company_name"]
                == ib["company_name"]
            )

        # Même prénom + nom peut être accepté
        # uniquement faute d'autre identité.
        return True

    return False


# ============================================================
# SOURCE PRIORITY
# ============================================================

SOURCE_PRIORITY = {
    "maps": 90,
    "google_maps": 95,
    "maps_search": 95,

    "serper_linkedin": 70,

    "ads_library_search": 65,
    "meta_ads_library": 65,

    "serper_facebook": 55,
    "serper_instagram": 55,

    "serper_general": 40,
}


def source_priority(
    source: str | None,
) -> int:
    return SOURCE_PRIORITY.get(
        str(source or ""),
        10,
    )


# ============================================================
# SOURCE NORMALIZATION
# ============================================================

def source_label(
    source: str | None,
) -> str:
    mapping = {
        "maps": "Google Maps",
        "google_maps": "Google Maps",
        "maps_search": "Google Maps",

        "serper_linkedin":
            "Serper LinkedIn",

        "serper_facebook":
            "Serper Facebook",

        "serper_instagram":
            "Serper Instagram",

        "serper_general":
            "Serper General",

        "ads_library_search":
            "Meta Ads Library",

        "meta_ads_library":
            "Meta Ads Library",
    }

    return mapping.get(
        str(source or ""),
        str(source or ""),
    )


# ============================================================
# MERGE
# ============================================================

def merge_leads(
    existing: dict,
    new: dict,
) -> dict:
    existing_source = (
        existing.get("source")
    )

    new_source = (
        new.get("source")
    )

    # ========================================================
    # SOURCES
    # ========================================================

    sources = list(
        existing.get("sources")
        or []
    )

    for source in [
        existing_source,
        new_source,
    ]:
        label = source_label(source)

        if (
            label
            and label not in sources
        ):
            sources.append(label)

    if sources:
        existing["sources"] = sources
        existing["discovery_sources"] = list(
            sources
        )

    # ========================================================
    # DISCOVERY SIGNALS
    # ========================================================

    signals = list(
        existing.get("discovery_signals")
        or []
    )

    for signal in (
        new.get("discovery_signals")
        or []
    ):
        if (
            signal
            and signal not in signals
        ):
            signals.append(signal)

    if signals:
        existing[
            "discovery_signals"
        ] = signals

    # ========================================================
    # FIELD MERGE
    # ========================================================

    protected_identity_fields = {
        "company_name",
        "first_name",
        "last_name",
        "full_name",
    }

    contact_fields = {
        "phone",
        "email",
        "website",
        "linkedin_url",
        "facebook_url",
        "instagram_url",
        "google_place_id",
        "maps_url",
    }

    for key, value in new.items():
        if value in (
            None,
            "",
            [],
            {},
        ):
            continue

        if key in {
            "sources",
            "discovery_sources",
            "discovery_signals",
        }:
            continue

        current = existing.get(key)

        if current in (
            None,
            "",
            [],
            {},
        ):
            existing[key] = value
            continue

        if key in {
            "content",
            "raw_text",
            "snippet",
        }:
            if len(str(value)) > len(
                str(current)
            ):
                existing[key] = value

            continue

        # Ne pas remplacer arbitrairement
        # une identité déjà établie.
        if key in protected_identity_fields:
            continue

        # Pour les coordonnées, privilégier
        # la source la plus fiable.
        if key in contact_fields:
            if (
                source_priority(new_source)
                >
                source_priority(existing_source)
            ):
                existing[key] = value

            continue

    # ========================================================
    # PRIMARY SOURCE
    # ========================================================

    if (
        source_priority(new_source)
        >
        source_priority(existing_source)
    ):
        existing["source"] = new_source
    else:
        existing["source"] = (
            existing_source
            or new_source
        )

    return existing