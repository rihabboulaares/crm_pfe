# agentProspection/tests/test_pipeline_complet.py
"""
Test pipeline complet : OSM → DDG → Social → Gemini → Cache
Affiche entreprises ET prospects séparément.
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from agentProspection.tools.osm_tool    import OSMTool
from agentProspection.tools.ddg_tool    import DDGTool
from agentProspection.tools.social_tool import SocialTool
from agentProspection.tools.gemini_tool import GeminiTool
from agentProspection.tools.cache_tool  import CacheTool


def test():
    print("=" * 60)
    print("  TEST PIPELINE COMPLET")
    print("  OSM → DDG → Social → Gemini → Cache")
    print("=" * 60)

    osm    = OSMTool()
    ddg    = DDGTool()
    social = SocialTool()
    gemini = GeminiTool()
    cache  = CacheTool()

    print(f"\nCache stats : {cache.stats()}\n")

    entreprises_resultats = []
    prospects_resultats   = []

    # Recherche OSM
    entreprises_osm = osm.rechercher(
        secteur="hotel",
        ville="tunis",
        rayon_km=5,
        max_resultats=3,
    )

    for i, e in enumerate(entreprises_osm, 1):
        print(f"\n{'─'*60}")
        print(f"[{i}/{len(entreprises_osm)}] Traitement : {e.nom}")
        print(f"{'─'*60}")

        e_dict = e.model_dump()
        e_dict["secteur"] = "hotel"

        # DDG
        print("  → Enrichissement web...")
        infos_web = ddg.enrichir(nom=e.nom, ville=e.ville)
        for k in ["telephone", "site_web", "email"]:
            if not e_dict.get(k) and infos_web.get(k):
                e_dict[k] = infos_web[k]

        # Social
        print("  → Réseaux sociaux...")
        infos_social = social.chercher(nom=e.nom, ville=e.ville)
        e_dict.update(infos_social)

        # Gemini (avec cache)
        scoring = cache.get_score(e_dict["place_id"])
        if scoring:
            print("  → Score depuis Redis (cache)")
        else:
            print("  → Scoring Gemini...")
            scoring = gemini.scorer(e_dict)
            cache.set_score(e_dict["place_id"], scoring)
            time.sleep(2)

        e_dict["score_ia"]     = scoring.get("score", 0)
        e_dict["evaluation"]   = scoring.get("evaluation", "cold")
        e_dict["raison_score"] = scoring.get("raison", "")
        e_dict["next_action"]  = scoring.get("next_action", "")

        # Construire prospect
        prospect = {
            "first_name":            "",
            "last_name":             "",
            "title":                 "Gérant",
            "email":                 e_dict.get("email") or "",
            "phone":                 e_dict.get("telephone") or "",
            "city":                  e_dict.get("ville") or "",
            "country":               "Tunisie",
            "origin":                "facebook" if infos_social.get("facebook_url") else "website",
            "evaluation":            e_dict["evaluation"],
            "status":                "new",
            "facebook_url":          infos_social.get("facebook_url") or "",
            "prospect_company_name": e_dict["nom"],
            "place_id":              e_dict["place_id"],
            "score_ia":              e_dict["score_ia"],
            "next_action":           e_dict["next_action"],
        }

        entreprises_resultats.append(e_dict)
        prospects_resultats.append(prospect)

    # ── Affichage des résultats ──────────────────────────────────
    print(f"\n{'='*60}")
    print("  ENTREPRISES PROSPECTÉES")
    print(f"{'='*60}")

    for e in entreprises_resultats:
        label = {"hot":"🔥 HOT","warm":"💛 WARM","cold":"❄️ COLD"}.get(e["evaluation"],"?")
        print(f"\n{label} {e['nom']} — Score: {e['score_ia']}/100")
        print(f"  Téléphone : {e.get('telephone') or '—'}")
        print(f"  Email     : {e.get('email') or '—'}")
        print(f"  Site      : {e.get('site_web') or '—'}")
        print(f"  Facebook  : {e.get('facebook_url') or '—'}")
        print(f"  Instagram : {e.get('instagram_url') or '—'}")
        print(f"  Action    : {e.get('next_action') or '—'}")
        print(f"  Raison    : {e.get('raison_score') or '—'}")

    print(f"\n{'='*60}")
    print("  PROSPECTS (DÉCIDEURS)")
    print(f"{'='*60}")

    for p in prospects_resultats:
        print(f"\n{p['prospect_company_name']}")
        print(f"  Nom       : {p['first_name']} {p['last_name']} ({p['title']})")
        print(f"  Email     : {p['email'] or '—'}")
        print(f"  Téléphone : {p['phone'] or '—'}")
        print(f"  Origine   : {p['origin']}")
        print(f"  Éval.     : {p['evaluation']} — {p['next_action']}")
        print(f"  Facebook  : {p['facebook_url'] or '—'}")

    print(f"\n{'─'*60}")
    print(f"  {len(entreprises_resultats)} entreprises | {len(prospects_resultats)} prospects")
    print(f"  Cache final : {cache.stats()}")
    print(f"\n  Pipeline complet : OK ✅")


if __name__ == "__main__":
    test()