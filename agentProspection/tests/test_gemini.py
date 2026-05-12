# agentProspection/tests/test_gemini.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Charger la clé API depuis .env
from dotenv import load_dotenv
load_dotenv()

from agentProspection.tools.osm_tool import OSMTool
from agentProspection.tools.ddg_tool import DDGTool
from agentProspection.tools.gemini_tool import GeminiTool
import time


def test():
    print("=" * 55)
    print("  TEST — Étape 3 : Scoring Gemini")
    print("=" * 55)

    # Étape 1 : OSM
    osm = OSMTool()
    entreprises = osm.rechercher(secteur="pharmacie", ville="tunis", rayon_km=3, max_resultats=3)

    # Étape 2 : DDG
    ddg = DDGTool()
    gemini = GeminiTool()

    prospects = []
    for e in entreprises:
        e_dict = e.model_dump()
        e_dict["secteur"] = "pharmacie"

        # Enrichissement DDG
        infos = ddg.enrichir(nom=e.nom, ville=e.ville)
        for k in ["telephone", "site_web", "email"]:
            if not e_dict.get(k) and infos.get(k):
                e_dict[k] = infos[k]

        # Scoring Gemini
        print(f"\n[Gemini] Score de : {e.nom}")
        scoring = gemini.scorer(e_dict)
        e_dict.update(scoring)
        prospects.append(e_dict)
        time.sleep(1)

    # Résultats
    print(f"\n{'─' * 55}")
    print("  RÉSULTATS SCORÉS")
    print(f"{'─' * 55}")

    prospects.sort(key=lambda x: x.get("score", 0), reverse=True)
    for p in prospects:
        eval_label = {"hot": "🔥 HOT", "warm": "💛 WARM", "cold": "❄️ COLD"}.get(p.get("evaluation"), "?")
        print(f"\n{eval_label} — {p['nom']}")
        print(f"  Score      : {p.get('score', 0)}/100")
        print(f"  Raison     : {p.get('raison', '')}")
        print(f"  Next action: {p.get('next_action', '')}")
        print(f"  Téléphone  : {p.get('telephone') or '—'}")

    print(f"\n{'─' * 55}")
    print("  Test Gemini : OK")
    print("  Prochaine étape : Redis cache")


if __name__ == "__main__":
    test()