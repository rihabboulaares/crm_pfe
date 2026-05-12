from langchain_core.tools import tool

from agentProspection.tools.ddg_tool import DDGTool
from agentProspection.tools.osm_tool import OSMTool
from agentProspection.tools.social_tool import SocialTool


def _model_to_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


@tool
def search_osm_businesses(
    secteur: str,
    ville: str,
    rayon_km: int = 5,
    max_resultats: int = 10,
) -> list[dict]:
    """Recherche des entreprises publiques avec OpenStreetMap/Overpass."""
    results = OSMTool().rechercher(
        secteur=secteur,
        ville=ville,
        rayon_km=rayon_km,
        max_resultats=max_resultats,
    )
    return [_model_to_dict(item) for item in results]


@tool
def enrich_business_web(nom: str, ville: str) -> dict:
    """Enrichit une entreprise avec telephone, email et site web via DuckDuckGo."""
    return DDGTool().enrichir(nom=nom, ville=ville)


@tool
def discover_public_social_links(nom: str, ville: str) -> dict:
    """Decouvre des liens publics Facebook, Instagram et LinkedIn via DuckDuckGo."""
    return SocialTool().chercher(nom=nom, ville=ville)


LANGCHAIN_TOOLS = [
    search_osm_businesses,
    enrich_business_web,
    discover_public_social_links,
]