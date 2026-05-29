import re
import unicodedata
from urllib.parse import urlparse


LEGAL_WORDS = {
    "sarl", "suarl", "sa", "sas", "ltd", "llc", "inc",
    "societe", "société", "company", "compagnie", "groupe",
    "group", "holding", "tunisie", "tunisia",
}


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def normalize_company_name(value: str | None) -> str:
    tokens = normalize_text(value).split()
    tokens = [t for t in tokens if t not in LEGAL_WORDS]
    return " ".join(tokens)


def normalize_phone(value: str | None) -> str:
    digits = re.sub(r"\D", "", str(value or ""))

    if digits.startswith("00216"):
        digits = "216" + digits[5:]

    if len(digits) == 8 and digits[0] in "24579":
        digits = "216" + digits

    if digits.startswith("216") and len(digits) >= 11:
        return "+" + digits[:11]

    return digits


def domain_from_url(url: str | None) -> str:
    if not url:
        return ""

    try:
        parsed = urlparse(url if url.startswith(("http://", "https://")) else f"https://{url}")
        return parsed.netloc.lower().replace("www.", "")
    except Exception:
        return ""


def email_domain(email: str | None) -> str:
    if not email or "@" not in email:
        return ""

    return email.lower().split("@")[-1].strip()


def social_identity(lead: dict) -> set[str]:
    return {
        str(lead.get("linkedin_url") or "").rstrip("/"),
        str(lead.get("facebook_url") or "").rstrip("/"),
        str(lead.get("instagram_url") or "").rstrip("/"),
    } - {""}


def company_identity(lead: dict) -> dict:
    return {
        "google_place_id": lead.get("google_place_id") or "",
        "name": normalize_company_name(lead.get("company_name")),
        "website_domain": domain_from_url(lead.get("website")),
        "email_domain": email_domain(lead.get("email")),
        "phone": normalize_phone(lead.get("phone")),
        "socials": social_identity(lead),
    }


def person_identity(lead: dict) -> dict:
    return {
        "first_name": normalize_text(lead.get("first_name")),
        "last_name": normalize_text(lead.get("last_name")),
        "full_name": normalize_text(lead.get("full_name")),
        "email": normalize_text(lead.get("email")),
        "phone": normalize_phone(lead.get("phone")),
        "linkedin_url": str(lead.get("linkedin_url") or "").rstrip("/"),
        "company_name": normalize_company_name(lead.get("company_name")),
    }


def is_same_company(a: dict, b: dict) -> bool:
    ia = company_identity(a)
    ib = company_identity(b)

    if ia["google_place_id"] and ib["google_place_id"]:
        return ia["google_place_id"] == ib["google_place_id"]

    if ia["website_domain"] and ib["website_domain"]:
        return ia["website_domain"] == ib["website_domain"]

    if ia["email_domain"] and ib["email_domain"]:
        return ia["email_domain"] == ib["email_domain"]

    if ia["phone"] and ib["phone"]:
        return ia["phone"] == ib["phone"]

    if ia["socials"] and ib["socials"] and ia["socials"] & ib["socials"]:
        return True

    if ia["name"] and ib["name"]:
        if ia["name"] == ib["name"]:
            return True

        a_tokens = set(ia["name"].split())
        b_tokens = set(ib["name"].split())

        if a_tokens and b_tokens:
            overlap = len(a_tokens & b_tokens) / max(len(a_tokens), len(b_tokens))
            if overlap >= 0.75:
                return True

    return False


def is_same_person(a: dict, b: dict) -> bool:
    ia = person_identity(a)
    ib = person_identity(b)

    if ia["linkedin_url"] and ib["linkedin_url"]:
        return ia["linkedin_url"] == ib["linkedin_url"]

    if ia["email"] and ib["email"]:
        return ia["email"] == ib["email"]

    if ia["phone"] and ib["phone"]:
        return ia["phone"] == ib["phone"]

    if ia["full_name"] and ib["full_name"] and ia["company_name"] and ib["company_name"]:
        return ia["full_name"] == ib["full_name"] and ia["company_name"] == ib["company_name"]

    if ia["first_name"] and ia["last_name"] and ib["first_name"] and ib["last_name"]:
        same_name = ia["first_name"] == ib["first_name"] and ia["last_name"] == ib["last_name"]

        if same_name:
            if ia["company_name"] and ib["company_name"]:
                return ia["company_name"] == ib["company_name"]
            return True

    return False


SOURCE_PRIORITY = {
    "maps": 90,
    "google_maps": 90,
    "profile_scraper_linkedin": 85,
    "profile_scraper_facebook": 80,
    "profile_scraper_instagram": 75,
    "playwright_scraper": 80,
    "serper_linkedin": 50,
    "serper_facebook": 45,
    "serper_instagram": 45,
    "serper_general": 40,
}


def source_priority(source: str | None) -> int:
    return SOURCE_PRIORITY.get(str(source or ""), 10)


def merge_leads(existing: dict, new: dict) -> dict:
    existing_source = existing.get("source")
    new_source = new.get("source")

    for key, value in new.items():
        if value in [None, "", [], {}]:
            continue

        current = existing.get(key)

        if current in [None, "", [], {}]:
            existing[key] = value
            continue

        if key in {"content", "raw_text"}:
            if len(str(value)) > len(str(current)):
                existing[key] = value
            continue

        if source_priority(new_source) > source_priority(existing_source):
            if key in {
                "phone", "email", "website", "linkedin_url",
                "facebook_url", "instagram_url", "google_place_id",
            }:
                existing[key] = value

    existing["source"] = existing_source or new_source
    return existing