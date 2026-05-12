# agentProspection/tests/test_osm.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from agentProspection.tools.osm_tool import OSMTool   # ← corrigé


def test():
    print("=" * 50)
    print("  TEST — OpenStreetMap Tool")
    print("=" * 50)

    outil = OSMTool()

    entreprises = outil.rechercher(
        secteur="restaurant",
        ville="Tunis",
        rayon_km=2,
        max_resultats=5,
    )

    print(f"\n{'─' * 50}")
    print(f"  {len(entreprises)} résultats")
    print(f"{'─' * 50}")

    for i, e in enumerate(entreprises, 1):
        print(f"\n[{i}]")
        e.afficher()

    assert len(entreprises) > 0, "Aucun résultat — problème réseau ?"

    avec_tel  = sum(1 for e in entreprises if e.telephone)
    avec_site = sum(1 for e in entreprises if e.site_web)

    print(f"\n{'─' * 50}")
    print(f"  Avec téléphone : {avec_tel}/{len(entreprises)}")
    print(f"  Avec site web  : {avec_site}/{len(entreprises)}")
    print(f"{'─' * 50}")
    print("\n  Test OSM : OK")


if __name__ == "__main__":
    test()