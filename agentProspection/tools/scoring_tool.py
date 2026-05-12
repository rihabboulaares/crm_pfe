class ScoringTool:
    """
    Scoring local gratuit.

    Il remplace Gemini si aucune cle API n'est configuree.
    Tu peux garder Gemini comme bonus, mais ce fallback rend l'agent
    utilisable sans budget.
    """

    def scorer(self, prospect: dict) -> dict:
        score = 0
        raisons = []

        if prospect.get("telephone"):
            score += 25
            raisons.append("telephone")
        if prospect.get("email"):
            score += 20
            raisons.append("email")
        if prospect.get("site_web"):
            score += 15
            raisons.append("site web")
        if prospect.get("adresse") and len(prospect.get("adresse", "")) > 5:
            score += 10
            raisons.append("adresse")
        if prospect.get("categorie"):
            score += 10
            raisons.append("categorie")
        if prospect.get("latitude") and prospect.get("longitude"):
            score += 5
            raisons.append("position")
        if int(prospect.get("data_quality") or 0) >= 60:
            score += 5
            raisons.append("qualite OSM")
        if prospect.get("facebook_url") or prospect.get("instagram_url"):
            score += 10
            raisons.append("reseaux sociaux")
        if prospect.get("linkedin_url"):
            score += 10
            raisons.append("linkedin")

        score = min(score, 100)

        if score >= 70:
            evaluation = "hot"
        elif score >= 50:
            evaluation = "warm"
        else:
            evaluation = "cold"

        if prospect.get("telephone") and score >= 45:
            next_action = "Appel"
        elif prospect.get("email"):
            next_action = "Email"
        elif prospect.get("adresse"):
            next_action = "Visite"
        else:
            next_action = "Ignorer"

        raison = "Donnees: " + ", ".join(raisons[:4]) if raisons else "Peu de donnees publiques"

        return {
            "score": score,
            "evaluation": evaluation,
            "raison": raison[:80],
            "next_action": next_action,
        }
