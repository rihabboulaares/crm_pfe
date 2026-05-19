"""
Registre unique des outils LangChain pour l'agent ReAct.

IMPORTANT : Ce fichier remplace tools.py (supprimé).
Il est le seul endroit où les outils sont définis et exportés.
"""

import json
from typing import Any

from langchain_core.tools import tool

from .config import AgentSettings


def build_agent_tools(settings: AgentSettings) -> list:
    """
    Construit et retourne la liste des outils disponibles pour l'agent ReAct.
    Toutes les dépendances (GoogleMaps, DDG, Social, Scorer) sont instanciées
    une seule fois ici et capturées par les closures des @tool.
    """
    from agentProspection.tools.ddg_tool import DDGTool
    from agentProspection.tools.google_maps_tool import GoogleMapsTool
    from agentProspection.tools.social_tool import SocialTool
    from agentProspection.tools.scoring_tool import ScoringTool

    maps = GoogleMapsTool(settings.google_maps_api_key)
    ddg = DDGTool()
    social = SocialTool(
        google_search_api_key=settings.google_search_api_key,
        google_cse_id=settings.google_cse_id,
        serper_api_key=settings.serper_api_key,
        brave_search_api_key=settings.brave_search_api_key,
    )
    scorer = ScoringTool()

    # ── Sérialiseur JSON robuste ───────────────────────────────────────────
    def _json(data: Any) -> str:
        try:
            return json.dumps(data, ensure_ascii=False, default=str)
        except Exception:
            return str(data)

    # ── Outil 1 : Google Maps ─────────────────────────────────────────────
    @tool
    def google_maps_search(
        secteur: str,
        ville: str,
        rayon_km: int = 5,
        max_resultats: int = 10,
    ) -> str:
        """
        Recherche des entreprises PHYSIQUES via Google Places API.

        QUAND UTILISER : restaurants, hôtels, cliniques, pharmacies, garages,
        cafés, commerces, toute entreprise avec une adresse GPS.

        RETOURNE : liste JSON avec nom, adresse, téléphone, coordonnées GPS,
        catégorie, qualité de données (data_quality 0-100).

        Si Google Maps n'est pas configuré (clé manquante), retourne un message
        d'erreur — essaie alors web_search_companies.
        """
        if not maps.available:
            return json.dumps({
                "error": "Google Maps non configuré.",
                "hint": "Ajoute GOOGLE_MAPS_API_KEY dans .env, ou utilise web_search_companies."
            })
        results = maps.rechercher(
            secteur=secteur,
            ville=ville,
            rayon_km=rayon_km,
            max_resultats=max_resultats,
        )
        data = [r.model_dump() if hasattr(r, "model_dump") else r for r in results]
        return _json(data)

    # ── Outil 2 : Recherche web entreprises ───────────────────────────────
    @tool
    def web_search_companies(secteur: str, ville: str, max_resultats: int = 10) -> str:
        """
        Recherche des entreprises via le web (DuckDuckGo — gratuit, sans clé API).

        QUAND UTILISER :
        - Compléter Google Maps si peu de résultats
        - Agences, startups, cabinets, entreprises B2B sans adresse physique visible
        - Quand Google Maps n'est pas configuré

        RETOURNE : liste JSON avec nom, site web, texte_web, ville.
        Les emails et téléphones sont extraits des snippets si disponibles.
        """
        return _json(ddg.rechercher_entreprises(
            secteur=secteur,
            ville=ville,
            max_resultats=max_resultats,
        ))

    # ── Outil 3 : Enrichissement d'une entreprise connue ─────────────────
    @tool
    def enrich_company(nom: str, ville: str) -> str:
        """
        Enrichit une entreprise DÉJÀ TROUVÉE avec ses coordonnées publiques.

        QUAND UTILISER : tu as le nom d'une entreprise mais pas son téléphone,
        email ou site web. Appelle cet outil pour les trouver.

        INPUT : nom exact de l'entreprise + ville
        RETOURNE : JSON avec telephone, email, site_web, texte_brut.
        """
        return _json(ddg.enrichir(nom=nom, ville=ville))

    # ── Outil 4 : Pages entreprises sur les réseaux ───────────────────────
    @tool
    def social_company_search(
        secteur: str,
        ville: str,
        plateformes: list[str],
        max_resultats: int = 10,
    ) -> str:
        """
        Recherche des PAGES D'ENTREPRISES sur les réseaux sociaux.

        QUAND UTILISER : compléter la recherche avec la présence sociale
        des entreprises (pages Facebook, comptes Instagram, pages LinkedIn company).

        plateformes acceptées (liste) : ["facebook"], ["instagram"], ["linkedin"],
        ou combinaison : ["facebook", "instagram", "linkedin"]

        RETOURNE : liste JSON avec nom, url réseau, bio extraite.
        """
        return _json(social.rechercher_entreprises(
            secteur=secteur,
            ville=ville,
            plateformes=plateformes,
            max_resultats=max_resultats,
        ))

    # ── Outil 5 : Profils LinkedIn décideurs B2B ──────────────────────────
    @tool
    def linkedin_profiles_search(
        job_title: str,
        secteur: str,
        ville: str,
        company_name: str = "",
        max_resultats: int = 10,
    ) -> str:
        """
        Recherche des PROFILS LINKEDIN PUBLICS de décideurs B2B.

        QUAND UTILISER : la demande vise des PERSONNES avec un titre de poste
        professionnel — responsable, directeur, manager, DRH, CEO, CTO,
        fondateur, recruteur, talent acquisition, commercial, ingénieur.

        NE PAS UTILISER POUR : influenceurs, foodbloggers, créateurs de contenu,
        coachs fitness, photographes → utilise instagram_profiles_search.

        Utilise l'index public Google/Serper — ne scrape PAS LinkedIn.
        Les URLs retournées sont de type linkedin.com/in/...

        job_title : titre exact recherché (ex: "Responsable RH", "CEO", "CTO")
        company_name : optionnel, filtre par entreprise
        RETOURNE : liste JSON de profils avec first_name, last_name, title,
        linkedin_url, prospect_company_name, public_text.
        """
        if company_name:
            results = social.rechercher_prospects(
                company={"nom": company_name, "secteur": secteur, "ville": ville},
                job_title=job_title,
                ville=ville,
                max_resultats=max_resultats,
            )
        else:
            results = social.rechercher_profils_publics(
                job_title=job_title,
                secteur=secteur,
                ville=ville,
                plateformes=["linkedin"],
                max_resultats=max_resultats,
            )
        return _json(results)

    # ── Outil 6 : Profils Instagram créateurs de contenu ─────────────────
    @tool
    def instagram_profiles_search(
        job_title: str,
        secteur: str,
        ville: str = "",
        max_resultats: int = 10,
    ) -> str:
        """
        Recherche des PROFILS INSTAGRAM PUBLICS de créateurs de contenu.

        QUAND UTILISER — si la demande contient l'un de ces termes :
        foodblogger, food blogger, bloggeur cuisine, influenceur cuisine,
        influenceur, influenceuse, créateur de contenu, content creator,
        coach fitness, coach sportif, photographe, vidéaste,
        beauty blogger, makeup artist, travel blogger, tiktoker, youtuber.

        NE PAS UTILISER pour les décideurs B2B → utilise linkedin_profiles_search.

        job_title : niche ou titre (ex: "foodblogger", "coach fitness", "photographe")
        secteur : secteur de niche (ex: "cuisine", "sport", "beauté")
        RETOURNE : liste JSON avec instagram_url, first_name (ou handle),
        public_text, confidence.
        """
        niche = secteur or _infer_sector(job_title)
        normalized = _normalize_creator_title(job_title, niche)

        if _is_creator_query(job_title):
            return _json(social.rechercher_createurs_contenu(
                niche=normalized,
                ville=ville,
                plateforme="instagram",
                max_resultats=max_resultats,
            ))
        return _json(social.rechercher_profils_publics(
            job_title=normalized,
            secteur=niche,
            ville=ville,
            plateformes=["instagram"],
            max_resultats=max_resultats,
        ))

    # ── Outil 7 : Profils Facebook créateurs / pages locales ─────────────
    @tool
    def facebook_profiles_search(
        job_title: str,
        secteur: str,
        ville: str = "",
        max_resultats: int = 10,
    ) -> str:
        """
        Recherche des PROFILS ET PAGES FACEBOOK PUBLICS.

        QUAND UTILISER :
        - Créateurs de contenu (foodbloggers, influenceurs) — en complément d'Instagram
        - Entrepreneurs locaux avec page Facebook business
        - Pages de commerces locaux sans fiche Google Maps

        job_title : niche ou titre (ex: "foodblogger", "coach fitness")
        secteur : secteur (ex: "cuisine", "sport")
        RETOURNE : liste JSON avec facebook_url, first_name, public_text.
        """
        niche = secteur or _infer_sector(job_title)
        normalized = _normalize_creator_title(job_title, niche)

        if _is_creator_query(job_title):
            return _json(social.rechercher_createurs_contenu(
                niche=normalized,
                ville=ville,
                plateforme="facebook",
                max_resultats=max_resultats,
            ))
        return _json(social.rechercher_profils_publics(
            job_title=normalized,
            secteur=niche,
            ville=ville,
            plateformes=["facebook"],
            max_resultats=max_resultats,
        ))

    # ── Outil 8 : Scoring d'un résultat ──────────────────────────────────
    @tool
    def score_entity(entity_json: str) -> str:
        """
        Calcule le score de qualité d'une entreprise ou d'un prospect.

        QUAND UTILISER : après avoir collecté des résultats, pour les évaluer
        et décider lesquels valent la peine d'être retournés au commercial.

        INPUT : JSON string avec les champs disponibles.
        Champs utiles : nom, telephone, email, site_web, adresse, categorie,
        latitude, longitude, facebook_url, instagram_url, linkedin_url.

        RETOURNE : JSON avec score (0-100), evaluation (hot/warm/cold),
        raison, next_action.
        """
        try:
            entity = json.loads(entity_json)
        except Exception:
            return '{"score": 0, "evaluation": "cold", "raison": "JSON invalide", "next_action": "Ignorer"}'
        return _json(scorer.scorer(entity))

    return [
        google_maps_search,
        web_search_companies,
        enrich_company,
        social_company_search,
        linkedin_profiles_search,
        instagram_profiles_search,
        facebook_profiles_search,
        score_entity,
    ]


# ── Fonctions utilitaires (privées, hors @tool) ───────────────────────────────

def _normalize_creator_title(job_title: str, secteur: str) -> str:
    """
    Traduit les termes créateurs vers des variantes mieux indexées
    par les moteurs de recherche.
    """
    mapping = {
        "foodblogger":          "food blogger cuisine",
        "food blogger":         "food blogger cuisine",
        "bloggeur cuisine":     "food blogger cuisine recette",
        "blogueur food":        "food blogger cuisine recette",
        "influenceur cuisine":  "influenceur cuisine recette food",
        "chef":                 "chef cuisinier cuisine",
        "coach fitness":        "coach fitness sport musculation",
        "coach sportif":        "coach fitness sport",
        "beauty blogger":       "beauty blogger maquillage beauté",
        "influenceur beauté":   "influenceur beauté makeup",
        "makeup artist":        "makeup artist maquillage beauté",
        "photographe":          "photographe professionnel",
        "travel blogger":       "travel blogger voyage",
        "bloggeur voyage":      "travel blogger voyage",
        "tiktoker":             "créateur contenu tiktok",
        "youtuber":             "créateur contenu youtube",
        "instagrammer":         "influenceur instagram",
        "influenceur":          "influenceur créateur contenu",
        "créateur de contenu":  "créateur contenu influenceur",
        "content creator":      "créateur contenu influenceur",
    }
    key = job_title.lower().strip()
    return mapping.get(key, job_title)


def _infer_sector(job_title: str) -> str:
    """Déduit le secteur depuis le titre si non fourni."""
    jt = job_title.lower()
    if any(w in jt for w in ["food", "cuisine", "recette", "chef", "cuisinier"]):
        return "cuisine"
    if any(w in jt for w in ["fitness", "sport", "coach", "gym", "musculation"]):
        return "sport"
    if any(w in jt for w in ["beauty", "beauté", "makeup", "maquillage"]):
        return "beauté"
    if any(w in jt for w in ["voyage", "travel", "tourisme"]):
        return "voyage"
    if any(w in jt for w in ["photo", "vidéo", "video"]):
        return "photographie"
    return "influenceur"


def _is_creator_query(job_title: str) -> bool:
    """Détecte si la recherche vise un créateur de contenu / influenceur."""
    creator_terms = {
        "blogger", "bloggeur", "influenceur", "influenceuse",
        "foodblogger", "food blogger", "content creator", "créateur",
        "tiktoker", "youtuber", "instagrammer", "coach",
        "photographe", "artiste", "makeup", "beauty", "influencer",
    }
    jt = job_title.lower()
    return any(term in jt for term in creator_terms)