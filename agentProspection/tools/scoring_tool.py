"""
Scoring local — fonctionne sans clé API Gemini.

Utilisé comme :
1. Outil principal dans l'agent ReAct (score_entity)
2. Fallback si Gemini est indisponible dans le pipeline

Le barème est volontairement simple et explicable pour le commercial.
"""


class ScoringTool:

    def scorer(self, prospect: dict) -> dict:
        score = 0
        raisons = []

        # ── Données de contact ────────────────────────────────────────────
        if prospect.get("telephone"):
            score += 30
            raisons.append("téléphone")
        if prospect.get("email"):
            score += 20
            raisons.append("email")
        if prospect.get("site_web"):
            score += 20
            raisons.append("site web")

        # ── Données d'identification ───────────────────────────────────────
        if prospect.get("adresse") and len(str(prospect.get("adresse", ""))) > 5:
            score += 10
            raisons.append("adresse")
        if prospect.get("categorie"):
            score += 10
            raisons.append("catégorie")

        # ── Données GPS ───────────────────────────────────────────────────
        if prospect.get("latitude") and prospect.get("longitude"):
            score += 5
            raisons.append("position GPS")

        # ── Qualité Google Maps ───────────────────────────────────────────
        if int(prospect.get("data_quality") or 0) >= 60:
            score += 15
            raisons.append("qualité Maps")

        # ── Présence digitale ─────────────────────────────────────────────
        if prospect.get("facebook_url") or prospect.get("instagram_url"):
            score += 10
            raisons.append("réseaux sociaux")
        if prospect.get("linkedin_url"):
            score += 10
            raisons.append("LinkedIn")

        score = min(score, 100)

        # ── Évaluation ────────────────────────────────────────────────────
        if score >= 70:
            evaluation = "hot"
        elif score >= 50:
            evaluation = "warm"
        else:
            evaluation = "cold"

        # ── Action recommandée ────────────────────────────────────────────
        if prospect.get("telephone") and score >= 45:
            next_action = "Appel"
        elif prospect.get("email"):
            next_action = "Email"
        elif prospect.get("linkedin_url"):
            next_action = "LinkedIn"
        elif prospect.get("adresse"):
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
            "evaluation": evaluation,
            "raison": raison[:80],
            "next_action": next_action,
        }