"""
Registre central des sources et des outils du Discovery Agent.

Ce fichier est l'unique source de vérité pour la correspondance :

source logique
    ->
outil technique

Exemples :

linkedin
    -> serper_linkedin

maps
    -> maps_search

meta_ads
    -> ads_library_search
"""


# ============================================================
# SOURCE LOGIQUE -> OUTIL TECHNIQUE
# ============================================================

SOURCE_TO_TOOL = {
    "linkedin": "serper_linkedin",
    "facebook": "serper_facebook",
    "instagram": "serper_instagram",
    "general": "serper_general",
    "maps": "maps_search",
    "meta_ads": "ads_library_search",
}


# ============================================================
# SOURCES AUTORISÉES
# ============================================================

ALLOWED_SOURCES = set(
    SOURCE_TO_TOOL.keys()
)


# ============================================================
# OUTILS AUTORISÉS
# ============================================================

ALLOWED_TOOLS = set(
    SOURCE_TO_TOOL.values()
)


# ============================================================
# ALIAS DES SOURCES
# ============================================================

SOURCE_ALIASES = {
    # LinkedIn
    "linkedin": "linkedin",
    "serper_linkedin": "linkedin",

    # Facebook
    "facebook": "facebook",
    "serper_facebook": "facebook",

    # Instagram
    "instagram": "instagram",
    "serper_instagram": "instagram",

    # Web général
    "general": "general",
    "web": "general",
    "website": "general",
    "serper_general": "general",

    # Google Maps
    "maps": "maps",
    "google_maps": "maps",
    "maps_search": "maps",

    # Meta Ads Library
    "meta_ads": "meta_ads",
    "meta_ads_library": "meta_ads",
    "ads_library": "meta_ads",
    "ads_library_search": "meta_ads",
}


# ============================================================
# TOOL -> SOURCE
# ============================================================

TOOL_TO_SOURCE = {
    tool: source
    for source, tool
    in SOURCE_TO_TOOL.items()
}


# ============================================================
# NORMALISATION
# ============================================================

def normalize_key(
    value: str | None,
) -> str:
    """
    Normalise une source ou un outil.

    Exemple :

    "Meta Ads"
        -> "meta_ads"

    "maps-search"
        -> "maps_search"
    """

    return (
        str(value or "")
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


# ============================================================
# NORMALISER UNE SOURCE
# ============================================================

def normalize_source_name(
    source: str | None,
) -> str | None:
    """
    Retourne toujours une source logique canonique.

    Exemples :

    serper_linkedin
        -> linkedin

    google_maps
        -> maps

    ads_library_search
        -> meta_ads
    """

    key = normalize_key(
        source
    )

    if not key:
        return None

    return SOURCE_ALIASES.get(
        key
    )


# ============================================================
# SOURCE -> TOOL
# ============================================================

def source_to_tool(
    source: str | None,
) -> str | None:
    """
    Convertit une source logique ou un alias
    vers l'outil technique correspondant.

    Exemples :

    linkedin
        -> serper_linkedin

    facebook
        -> serper_facebook

    maps
        -> maps_search

    meta_ads
        -> ads_library_search
    """

    normalized_source = (
        normalize_source_name(
            source
        )
    )

    if not normalized_source:
        return None

    return SOURCE_TO_TOOL.get(
        normalized_source
    )


# ============================================================
# NORMALISER UN NOM D'OUTIL
# ============================================================

def normalize_tool_name(
    tool_name: str | None,
) -> str | None:
    """
    Retourne toujours le nom technique canonique.

    Exemples :

    linkedin
        -> serper_linkedin

    serper_linkedin
        -> serper_linkedin

    google_maps
        -> maps_search

    maps
        -> maps_search

    meta_ads
        -> ads_library_search

    ads_library_search
        -> ads_library_search
    """

    if not tool_name:
        return None

    key = normalize_key(
        tool_name
    )

    # Cas où le tool est déjà canonique.
    if key in ALLOWED_TOOLS:
        return key

    # Sinon essayer comme source/alias.
    return source_to_tool(
        key
    )


# ============================================================
# TOOL -> SOURCE
# ============================================================

def tool_to_source(
    tool_name: str | None,
) -> str | None:
    """
    Convertit un outil technique vers sa source logique.

    Exemples :

    serper_linkedin
        -> linkedin

    maps_search
        -> maps

    ads_library_search
        -> meta_ads
    """

    normalized_tool = (
        normalize_tool_name(
            tool_name
        )
    )

    if not normalized_tool:
        return None

    return TOOL_TO_SOURCE.get(
        normalized_tool
    )


# ============================================================
# VALIDATION
# ============================================================

def is_valid_source(
    source: str | None,
) -> bool:
    """
    Vérifie si une source est supportée.
    """

    return (
        normalize_source_name(
            source
        )
        in ALLOWED_SOURCES
    )


def is_valid_tool(
    tool_name: str | None,
) -> bool:
    """
    Vérifie si un outil est supporté.
    """

    return (
        normalize_tool_name(
            tool_name
        )
        in ALLOWED_TOOLS
    )