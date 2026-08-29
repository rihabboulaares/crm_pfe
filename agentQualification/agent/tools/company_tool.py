def serialize_company(company):
    if not company:
        return None
    return {
        "id": company.id,
        "name": company.name,
        "sector": getattr(company, "sector", "") or getattr(company, "industry", ""),
        "city": getattr(company, "city", ""),
        "country": getattr(company, "country", ""),
        "address": getattr(company, "address", ""),
        "email": getattr(company, "email", ""),
        "phone": getattr(company, "phone", ""),
        "website": getattr(company, "website", ""),
        "linkedin_url": getattr(company, "linkedin_url", ""),
        "facebook_url": getattr(company, "facebook_url", ""),
        "instagram_url": getattr(company, "instagram_url", ""),
        "number_of_employees": getattr(company, "number_of_employees", None),
        "annual_revenue": getattr(company, "annual_revenue", None),
        "source": getattr(company, "source", ""),
        "score_ia": getattr(company, "score_ia", None),
        "evaluation": getattr(company, "evaluation", ""),
    }
