"""
Scoring via Gemini — optionnel, enrichit le scoring local.

Dans l'agent ReAct, le scoring est fait via score_entity (ScoringTool local).
GeminiTool est utilisé dans le pipeline déterministe (graph.py) pour un
scoring plus contextuel basé sur le RAG.
"""

import json
import os
import re
import time

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
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "Clé GEMINI_API_KEY manquante dans .env — "
                "GeminiTool ne peut pas être instancié."
            )
        # Passe la clé explicitement pour éviter les conflits GOOGLE_API_KEY / GEMINI_API_KEY
        self.client = genai.Client(api_key=api_key)
        self.model = "models/gemini-2.5-flash"
        print(f"[GeminiTool] Initialisé avec {self.model} ✅")

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
                    if texte.lower().startswith("json"):
                        texte = texte[4:]

                return json.loads(texte.strip())

            except Exception as exc:
                msg = str(exc)
                if "429" in msg:
                    match = re.search(r"retry in (\d+)", msg)
                    delai = int(match.group(1)) + 2 if match else 15
                    print(f"  [GeminiTool] Quota — attente {delai}s (tentative {tentative+1}/3)")
                    time.sleep(delai)
                else:
                    print(f"  [GeminiTool] Erreur : {msg[:120]}")
                    break

        return self._score_fallback(prospect)

    def _score_fallback(self, prospect: dict) -> dict:
        """Fallback local si Gemini est indisponible."""
        score = 0
        if prospect.get("telephone"):
            score += 30
        if prospect.get("site_web"):
            score += 20
        if prospect.get("email"):
            score += 20
        if prospect.get("adresse") and len(str(prospect.get("adresse", ""))) > 5:
            score += 15

        score = min(score, 100)
        evaluation = "hot" if score >= 70 else "warm" if score >= 50 else "cold"

        return {
            "score": score,
            "evaluation": evaluation,
            "raison": "Score basé sur données disponibles (fallback)",
            "next_action": "Appel" if score >= 30 else "Ignorer",
        }