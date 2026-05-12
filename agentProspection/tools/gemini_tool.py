# agentProspection/tools/gemini_tool.py
import os
import json
import time
import re
from google import genai


SCORING_PROMPT = """
Tu es un expert en prospection commerciale B2B en Tunisie.
Analyse ce prospect et retourne UNIQUEMENT un JSON valide, sans texte avant ou après.

Prospect :
- Nom         : {nom}
- Secteur     : {secteur}
- Ville       : {ville}
- Téléphone   : {telephone}
- Site web    : {site_web}
- Email       : {email}
- Catégorie   : {categorie}

Barème de scoring :
- Téléphone présent : +30 points
- Site web présent  : +20 points
- Email présent     : +20 points
- Adresse précise   : +15 points
- Catégorie connue  : +15 points

Retourne UNIQUEMENT ce JSON (rien d'autre) :
{{
  "score": <entier entre 0 et 100>,
  "evaluation": "<hot si score>=70 | warm si score>=50 | cold si score<50>",
  "raison": "<explication courte en français, max 80 caractères>",
  "next_action": "<Appel | Email | Visite | Ignorer>"
}}
"""


class GeminiTool:

    def __init__(self):
        # On lit GEMINI_API_KEY EN PREMIER et on la passe
        # explicitement à genai.Client — le SDK n'ira pas
        # chercher GOOGLE_API_KEY tout seul dans ce cas.
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("Clé GEMINI_API_KEY manquante dans le .env")

        # Passer la clé explicitement évite le conflit entre
        # GOOGLE_API_KEY et GEMINI_API_KEY
        self.client = genai.Client(api_key=api_key)
        self.model  = "models/gemini-2.5-flash"
        print(f"[Gemini] Initialisé avec {self.model} ✅")

    def scorer(self, prospect: dict) -> dict:
        prompt = SCORING_PROMPT.format(
            nom=prospect.get("nom", ""),
            secteur=prospect.get("secteur", ""),
            ville=prospect.get("ville", ""),
            telephone=prospect.get("telephone") or "absent",
            site_web=prospect.get("site_web") or "absent",
            email=prospect.get("email") or "absent",
            categorie=prospect.get("categorie") or "inconnu",
        )

        for tentative in range(3):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                )
                texte = response.text.strip()

                # Nettoyer les balises ```json ... ```
                if "```" in texte:
                    texte = texte.split("```")[1]
                    if texte.startswith("json"):
                        texte = texte[4:]

                return json.loads(texte.strip())

            except Exception as e:
                msg = str(e)
                if "429" in msg:
                    m = re.search(r"retry in (\d+)", msg)
                    delai = int(m.group(1)) + 2 if m else 15
                    print(f"  [Gemini] Quota — attente {delai}s (tentative {tentative+1}/3)...")
                    time.sleep(delai)
                else:
                    print(f"  [Gemini] Erreur : {msg[:120]}")
                    break

        return self._score_fallback(prospect)

    def _score_fallback(self, prospect: dict) -> dict:
        score = 0
        if prospect.get("telephone"): score += 30
        if prospect.get("site_web"):  score += 20
        if prospect.get("email"):     score += 20
        if prospect.get("adresse") and len(prospect["adresse"]) > 5: score += 15

        if score >= 70:   evaluation = "hot"
        elif score >= 50: evaluation = "warm"
        else:             evaluation = "cold"

        return {
            "score":       score,
            "evaluation":  evaluation,
            "raison":      "Score basé sur données disponibles",
            "next_action": "Appel" if score >= 30 else "Ignorer",
        }