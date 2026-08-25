def _get_value(prospect, field: str):
    if isinstance(prospect, dict):
        return prospect.get(field)
    return getattr(prospect, field, None)


def calculate_score(prospect) -> dict:
    score = 0
    reasons = []

    if _get_value(prospect, "email"):
        score += 30
        reasons.append("Email disponible")
    if _get_value(prospect, "phone"):
        score += 20
        reasons.append("Telephone disponible")
    if _get_value(prospect, "website"):
        score += 15
        reasons.append("Site web disponible")
    if _get_value(prospect, "linkedin_url"):
        score += 20
        reasons.append("LinkedIn disponible")
    if _get_value(prospect, "facebook_url"):
        score += 10
        reasons.append("Facebook disponible")
    if _get_value(prospect, "instagram_url"):
        score += 10
        reasons.append("Instagram disponible")
    if _get_value(prospect, "google_place_id") or _get_value(prospect, "google_maps_url"):
        score += 15
        reasons.append("Google Maps disponible")

    score = min(score, 100)
    if score >= 60:
        evaluation = "hot"
    elif score >= 30:
        evaluation = "warm"
    else:
        evaluation = "cold"

    return {
        "score": score,
        "evaluation": evaluation,
        "reasons": reasons,
    }
