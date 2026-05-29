from asgiref.sync import sync_to_async
from django.db.models import Q
from difflib import SequenceMatcher
from urllib.parse import urlparse

from sales.models import ProspectCompany, Prospect
from users.models import Company, User


def evaluate_score(item: dict) -> tuple[int, str]:
    score = 0

    if item.get("email"):
        score += 30
    if item.get("phone"):
        score += 20
    if item.get("website"):
        score += 15
    if item.get("linkedin_url"):
        score += 20
    if item.get("facebook_url"):
        score += 10
    if item.get("instagram_url"):
        score += 10
    if item.get("google_place_id"):
        score += 15

    if score >= 60:
        evaluation = "hot"
    elif score >= 30:
        evaluation = "warm"
    else:
        evaluation = "cold"

    return score, evaluation


def split_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or "").strip().split()

    if not parts:
        return "", ""

    if len(parts) == 1:
        return parts[0], ""

    return parts[0], " ".join(parts[1:])


def domain_from_url(url: str | None) -> str | None:
    if not url:
        return None

    parsed = urlparse(str(url).strip())
    host = parsed.netloc or parsed.path
    host = host.lower().replace("www.", "").strip("/")
    return host or None


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    return "".join(ch for ch in str(value) if ch.isdigit() or ch == "+")


def clip(value, max_length: int):
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    return text[:max_length]


def safe_origin(value: str | None) -> str:
    text = str(value or "agent_prospection").lower()

    if "linkedin" in text:
        return "linkedin"
    if "facebook" in text:
        return "facebook"
    if "website" in text or "web" in text:
        return "website"

    return "website"


def safe_evaluation(value: str | None, default: str = "cold") -> str:
    value = str(value or default).lower()
    if value in {"hot", "warm", "cold"}:
        return value
    return default


def text_value(item: dict, *fields: str) -> str | None:
    for field in fields:
        value = item.get(field)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def company_name_from_result(item: dict) -> str | None:
    return text_value(item, "company_name", "name")


def maps_identity(item: dict) -> str | None:
    return text_value(item, "google_place_id", "maps_url", "google_maps_url")


def normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").lower().strip().split())


def is_close_name(left: str | None, right: str | None) -> bool:
    left = normalize_text(left)
    right = normalize_text(right)

    if not left or not right:
        return False

    return SequenceMatcher(None, left, right).ratio() >= 0.92


def is_valid_business_result(item: dict) -> bool:
    return any(
        text_value(item, field)
        for field in [
            "company_name",
            "name",
            "phone",
            "email",
            "website",
            "address",
            "linkedin_url",
            "facebook_url",
            "instagram_url",
            "maps_url",
            "google_maps_url",
            "google_place_id",
        ]
    )


def find_existing_company(crm_company, item: dict):
    query = Q()
    company_name = company_name_from_result(item)
    google_identity = maps_identity(item)

    if google_identity:
        query |= Q(google_place_id=clip(google_identity, 150))
    if item.get("facebook_url"):
        query |= Q(facebook_url=item.get("facebook_url"))
    if item.get("instagram_url"):
        query |= Q(instagram_url=item.get("instagram_url"))
    if item.get("linkedin_url"):
        query |= Q(linkedin_url=item.get("linkedin_url"))
    if item.get("email"):
        query |= Q(email=item.get("email"))
    if item.get("phone"):
        query |= Q(phone=item.get("phone"))
    if company_name:
        query |= Q(name__iexact=company_name)

    if query:
        existing = ProspectCompany.objects.filter(company=crm_company).filter(query).first()
        if existing:
            return existing

    if company_name:
        for candidate in ProspectCompany.objects.filter(company=crm_company):
            if is_close_name(candidate.name, company_name):
                return candidate

    website_domain = domain_from_url(item.get("website"))
    if website_domain:
        for candidate in ProspectCompany.objects.filter(company=crm_company).exclude(website__isnull=True):
            if domain_from_url(candidate.website) == website_domain:
                return candidate

    phone = normalize_phone(item.get("phone"))
    if phone:
        for candidate in ProspectCompany.objects.filter(company=crm_company).exclude(phone__isnull=True):
            if normalize_phone(candidate.phone) == phone:
                return candidate

    return None


def update_missing_fields(obj, item: dict, fields: list[str]) -> bool:
    changed = False

    max_lengths = {
        "industry": 150,
        "phone": 20,
        "email": 254,
        "city": 100,
        "country": 100,
        "title": 100,
        "google_place_id": 150,
        "first_name": 50,
        "last_name": 50,
    }

    for field in fields:
        source_field = field
        if field == "google_place_id":
            new_value = maps_identity(item)
        elif field == "raison_score":
            new_value = item.get("raison_score") or item.get("content")
        else:
            new_value = item.get(source_field)

        if field in max_lengths:
            new_value = clip(new_value, max_lengths[field])
        if field in {"website", "linkedin_url", "facebook_url", "instagram_url"}:
            new_value = clip(new_value, 200)

        if new_value and not getattr(obj, field):
            setattr(obj, field, new_value)
            changed = True

    return changed


def find_existing_person(crm_company, related_company, item: dict, first_name: str, last_name: str):
    if item.get("email"):
        existing = Prospect.objects.filter(company=crm_company, email=item.get("email")).first()
        if existing:
            return existing

    query = Q(company=crm_company)

    identity = Q()
    if item.get("linkedin_url"):
        identity |= Q(linkedin_url=item.get("linkedin_url"))
    if item.get("facebook_url"):
        identity |= Q(facebook_url=item.get("facebook_url"))
    if item.get("phone"):
        identity |= Q(phone=item.get("phone"))

    if identity:
        existing = Prospect.objects.filter(query).filter(identity).first()
        if existing:
            return existing

    if first_name and last_name and related_company:
        return Prospect.objects.filter(
            company=crm_company,
            prospect_company=related_company,
            first_name__iexact=first_name,
            last_name__iexact=last_name,
        ).first()

    return None


def find_existing_prospect(crm_company, related_company, item: dict, first_name: str, last_name: str):
    if item.get("email"):
        existing = Prospect.objects.filter(company=crm_company, email=item.get("email")).first()
        if existing:
            return existing

    if item.get("phone"):
        existing = Prospect.objects.filter(company=crm_company, phone=item.get("phone")).first()
        if existing:
            return existing

    if related_company:
        existing = Prospect.objects.filter(
            company=crm_company,
            prospect_company=related_company,
            first_name__iexact=first_name,
            last_name__iexact=last_name,
        ).first()
        if existing:
            return existing

    return None


def person_names_from_result(item: dict) -> tuple[str, str]:
    first_name = text_value(item, "person_first_name", "first_name")
    last_name = text_value(item, "person_last_name", "last_name")

    if first_name or last_name:
        return first_name or "", last_name or ""

    return split_name(text_value(item, "full_name") or "")


def save_result_to_crm(result: dict, assigned_user_id: int, tenant_company_id: int | None = None):
    user = User.objects.get(id=assigned_user_id)
    crm_company = Company.objects.get(id=tenant_company_id or user.company_id)

    if not is_valid_business_result(result):
        return None

    raw_company_name = company_name_from_result(result)
    first_name, last_name = person_names_from_result(result)
    has_human_contact = bool(first_name or last_name)
    company_name = raw_company_name or "Prospects sans entreprise"

    company_item = {
        **result,
        "company_name": company_name,
        "google_place_id": maps_identity(result),
    }

    score, evaluation = evaluate_score(company_item)
    evaluation = safe_evaluation(result.get("evaluation"), evaluation)

    company = find_existing_company(crm_company, company_item)
    if not company:
        company = ProspectCompany.objects.create(
            name=clip(company_name, 255),
            company=crm_company,
            industry=clip(result.get("industry"), 150),
            phone=clip(result.get("phone"), 20),
            email=clip(result.get("email"), 254),
            city=clip(result.get("city"), 100),
            country=clip(result.get("country"), 100),
            website=clip(result.get("website"), 200),
            linkedin_url=clip(result.get("linkedin_url"), 200),
            facebook_url=clip(result.get("facebook_url"), 200),
            instagram_url=clip(result.get("instagram_url"), 200),
            google_place_id=clip(maps_identity(result), 150),
            score_ia=score,
            evaluation=evaluation,
            source="agent_prospection",
        )
        company_created = True
        company_updated = False
    else:
        company_created = False
        company_updated = update_missing_fields(
            company,
            company_item,
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
            ],
        )

        if company.score_ia != score:
            company.score_ia = score
            company_updated = True

        if company.evaluation != evaluation:
            company.evaluation = evaluation
            company_updated = True

        if company_updated:
            company.save()

    if has_human_contact:
        prospect_first_name = clip(first_name, 50)
        prospect_last_name = clip(last_name or company.name, 50)
        prospect_title = clip(result.get("title") or result.get("position"), 100)
    else:
        prospect_first_name = "Contact"
        prospect_last_name = clip(company.name, 50)
        prospect_title = "Contact principal non identifie"

    prospect = find_existing_prospect(
        crm_company,
        company,
        result,
        prospect_first_name,
        prospect_last_name,
    )

    if not prospect:
        prospect = Prospect.objects.create(
            first_name=prospect_first_name,
            last_name=prospect_last_name,
            prospect_company=company,
            company=crm_company,
            email=clip(result.get("email"), 254),
            title=prospect_title,
            phone=clip(result.get("phone"), 20),
            city=clip(result.get("city"), 100),
            country=clip(result.get("country"), 100),
            origin=safe_origin(result.get("source")),
            evaluation=safe_evaluation(result.get("evaluation"), "warm"),
            status="new",
            assigned_to=user,
            source="agent_prospection",
            website=clip(result.get("website"), 200),
            linkedin_url=clip(result.get("linkedin_url"), 200),
            facebook_url=clip(result.get("facebook_url"), 200),
            instagram_url=clip(result.get("instagram_url"), 200),
            raison_score=result.get("raison_score") or result.get("content"),
        )
        prospect_created = True
        prospect_updated = False
    else:
        prospect_created = False
        prospect_updated = False

        replacements = {
            "first_name": prospect_first_name,
            "last_name": prospect_last_name,
            "title": prospect_title,
            "prospect_company": company,
            "assigned_to": user,
        }

        for field, value in replacements.items():
            if value and getattr(prospect, field) != value:
                setattr(prospect, field, value)
                prospect_updated = True

        prospect_updated = update_missing_fields(
            prospect,
            result,
            [
                "phone",
                "city",
                "country",
                "website",
                "linkedin_url",
                "facebook_url",
                "instagram_url",
                "raison_score",
            ],
        ) or prospect_updated

        if result.get("email") and not prospect.email:
            prospect.email = clip(result.get("email"), 254)
            prospect_updated = True

        if result.get("source") and not prospect.origin:
            prospect.origin = safe_origin(result.get("source"))
            prospect_updated = True

        if result.get("evaluation") and not prospect.evaluation:
            prospect.evaluation = safe_evaluation(result.get("evaluation"), "warm")
            prospect_updated = True

        if prospect_updated:
            prospect.save()

    prospect._agent_import_meta = {
        "company_created": company_created,
        "company_updated": company_updated,
        "prospect_created": prospect_created,
        "prospect_updated": prospect_updated,
        "has_human_contact": has_human_contact,
    }

    return prospect


@sync_to_async
def import_leads_to_crm(
    companies: list[dict],
    persons: list[dict],
    tenant_company_id: int,
    user_id: int,
) -> dict:
    crm_company = Company.objects.get(id=tenant_company_id)
    user = User.objects.get(id=user_id)

    stats = {
        "companies_created": 0,
        "companies_updated": 0,
        "companies_skipped": 0,
        "persons_created": 0,
        "persons_updated": 0,
        "persons_skipped": 0,
    }

    company_objects = {}

    for item in companies:
        prospect = save_result_to_crm(item, user_id, tenant_company_id)
        if not prospect:
            stats["companies_skipped"] += 1
            continue

        company_objects[prospect.prospect_company.name.lower().strip()] = prospect.prospect_company
        meta = getattr(prospect, "_agent_import_meta", {})

        if meta.get("company_created"):
            stats["companies_created"] += 1
        elif meta.get("company_updated"):
            stats["companies_updated"] += 1
        else:
            stats["companies_skipped"] += 1

        if meta.get("prospect_created"):
            stats["persons_created"] += 1
        elif meta.get("prospect_updated"):
            stats["persons_updated"] += 1
        else:
            stats["persons_skipped"] += 1

    for item in persons:
        prospect = save_result_to_crm(item, user_id, tenant_company_id)
        if not prospect:
            stats["persons_skipped"] += 1
            continue

        meta = getattr(prospect, "_agent_import_meta", {})

        if meta.get("company_created"):
            stats["companies_created"] += 1
        elif meta.get("company_updated"):
            stats["companies_updated"] += 1
        else:
            stats["companies_skipped"] += 1

        if meta.get("prospect_created"):
            stats["persons_created"] += 1
        elif meta.get("prospect_updated"):
            stats["persons_updated"] += 1
        else:
            stats["persons_skipped"] += 1

    return stats
