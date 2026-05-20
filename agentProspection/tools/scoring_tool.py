class ScoringTool:

    def scorer(self, entity: dict) -> dict:
        # Détecte automatiquement si c'est un prospect ou une entreprise
        is_prospect = bool(
            entity.get("linkedin_url") or entity.get("instagram_url")
            or entity.get("first_name")
        ) and not entity.get("telephone")

        if is_prospect:
            return self._score_prospect(entity)
        return self._score_company(entity)

    def _score_company(self, prospect: dict) -> dict:
        score = 0
        raisons = []

        if prospect.get("telephone"):
            score += 30; raisons.append("téléphone")
        if prospect.get("email"):
            score += 20; raisons.append("email")
        if prospect.get("site_web"):
            score += 20; raisons.append("site web")
        if prospect.get("adresse") and len(str(prospect.get("adresse", ""))) > 5:
            score += 10; raisons.append("adresse")
        if prospect.get("categorie"):
            score += 10; raisons.append("catégorie")
        if prospect.get("latitude") and prospect.get("longitude"):
            score += 5; raisons.append("GPS")
        if int(prospect.get("data_quality") or 0) >= 60:
            score += 15; raisons.append("qualité Maps")
        if prospect.get("facebook_url") or prospect.get("instagram_url"):
            score += 10; raisons.append("réseaux sociaux")
        if prospect.get("linkedin_url"):
            score += 10; raisons.append("LinkedIn")

        return self._build_result(min(score, 100), raisons, prospect, mode="company")

    def _score_prospect(self, entity: dict) -> dict:
        score = 0
        raisons = []

        if entity.get("linkedin_url"):
            score += 50; raisons.append("LinkedIn public")
        if entity.get("instagram_url"):
            score += 30; raisons.append("Instagram public")
        if entity.get("facebook_url"):
            score += 20; raisons.append("Facebook public")
        if entity.get("email"):
            score += 25; raisons.append("email")
        if entity.get("phone") or entity.get("telephone"):
            score += 20; raisons.append("téléphone")
        if entity.get("prospect_company_name"):
            score += 10; raisons.append("entreprise connue")
        if entity.get("public_text") and len(str(entity.get("public_text", ""))) > 50:
            score += 5; raisons.append("profil détaillé")

        return self._build_result(min(score, 100), raisons, entity, mode="prospect")

    def _build_result(self, score: int, raisons: list, entity: dict, mode: str) -> dict:
        if score >= 70:
            evaluation = "hot"
        elif score >= 50:
            evaluation = "warm"
        else:
            evaluation = "cold"

        if mode == "prospect":
            if entity.get("linkedin_url"):
                next_action = "LinkedIn"
            elif entity.get("instagram_url"):
                next_action = "Message Instagram"
            elif entity.get("email"):
                next_action = "Email"
            else:
                next_action = "Vérifier"
        else:
            if entity.get("telephone") and score >= 45:
                next_action = "Appel"
            elif entity.get("email"):
                next_action = "Email"
            elif entity.get("linkedin_url"):
                next_action = "LinkedIn"
            elif entity.get("adresse"):
                next_action = "Visite"
            else:
                next_action = "Ignorer"

        raison = (
            "Données: " + ", ".join(raisons[:4])
            if raisons
            else "Peu de données publiques disponibles"
        )

        return {
            "score": score,
            "score_ia": score,
            "evaluation": evaluation,
            "raison": raison[:120],
            "raison_score": raison[:120],
            "next_action": next_action,
        }
    # scoring_tool.py — ajouter cette fonction publique en bas du fichier

def compute_local_score(item: dict) -> dict:
    """
    Fonction standalone utilisée par react_agent.py pour ne pas dupliquer la logique.
    Délègue entièrement à ScoringTool.
    """
    return ScoringTool().scorer(item)