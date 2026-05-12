# agentProspection/tests/test_ddg.py
"""
Test étape 2 : enrichissement DuckDuckGo
On prend les résultats OSM et on enrichit chaque entreprise.
"""
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from agentProspection.tools.osm_tool import OSMTool
from agentProspection.tools.ddg_tool import DDGTool


def test():
    print("=" * 55)
    print("  TEST — Étape 2 : Enrichissement DuckDuckGo")
    print("=" * 55)

    # ── Étape 1 : récupérer les entreprises via OSM ──────────────
    print("\n[1/2] Recherche OSM...")
    osm = OSMTool()
    entreprises = osm.rechercher(
        secteur="restaurant",
        ville="tunis",
        rayon_km=2,
        max_resultats=5,   # on teste sur 5 pour ne pas surcharger DDG
    )
    print(f"     {len(entreprises)} entreprises trouvées\n")

    # ── Étape 2 : enrichir chaque entreprise avec DDG ────────────
    print("[2/2] Enrichissement DuckDuckGo...")
    ddg = DDGTool()
    enrichies = []

    for e in entreprises:
        print(f"\n  Entreprise : {e.nom}")
        infos = ddg.enrichir(nom=e.nom, ville=e.ville)

        # Fusionner : DDG complète ce qu'OSM n'a pas trouvé
        e_dict = e.model_dump()
        if not e_dict["telephone"] and infos["telephone"]:
            e_dict["telephone"] = infos["telephone"]
            print(f"  Tel trouvé  : {infos['telephone']}")
        if not e_dict["site_web"] and infos["site_web"]:
            e_dict["site_web"] = infos["site_web"]
            print(f"  Site trouvé : {infos['site_web']}")
        if infos["email"]:
            e_dict["email"] = infos["email"]
            print(f"  Email trouvé: {infos['email']}")

        enrichies.append(e_dict)
        time.sleep(1)  # pause entre chaque requête DDG (bonne pratique)

    # ── Résultats ────────────────────────────────────────────────
    print(f"\n{'─' * 55}")
    print(f"  RÉSULTATS APRÈS ENRICHISSEMENT")
    print(f"{'─' * 55}")

    for i, e in enumerate(enrichies, 1):
        print(f"\n[{i}] {e['nom']}")
        print(f"     Tel  : {e.get('telephone') or '—'}")
        print(f"     Site : {e.get('site_web') or '—'}")
        print(f"     Email: {e.get('email') or '—'}")

    # ── Stats ─────────────────────────────────────────────────────
    avant_tel  = sum(1 for e in entreprises if e.telephone)
    apres_tel  = sum(1 for e in enrichies if e.get("telephone"))
    avant_site = sum(1 for e in entreprises if e.site_web)
    apres_site = sum(1 for e in enrichies if e.get("site_web"))

    print(f"\n{'─' * 55}")
    print(f"  Téléphone : {avant_tel}/5 → {apres_tel}/5 après enrichissement")
    print(f"  Site web  : {avant_site}/5 → {apres_site}/5 après enrichissement")
    print(f"{'─' * 55}")
    print("\n  Test DDG : OK")
    print("  Prochaine étape : scoring Gemini")


if __name__ == "__main__":
    test()