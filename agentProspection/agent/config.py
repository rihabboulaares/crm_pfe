"""
Configuration centralisée de l'agent de prospection.
"""

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Ordre de priorité des modèles Gemini
#
# gemini-2.5-flash-lite  → principal  (free tier, léger, rapide)
# gemini-2.5-flash       → fallback 1 (plus puissant)
# gemini-2.0-flash       → fallback 2 (si 2.5 indisponible)
# gemini-1.5-flash-8b    → fallback 3 (dernier recours)
#
# ── FIX ────────────────────────────────────────────────────────────────────
# gemini-1.5-flash retiré : retourne 404 NOT_FOUND sur l'API v1beta.
# Remplacé par gemini-1.5-flash-8b qui est toujours disponible.
# ────────────────────────────────────────────────────────────────────────────
# Le fallback se déclenche sur : 429 (quota), 503 (indisponible), 500 (erreur
# serveur), 404 (modèle déprécié/introuvable).
# ─────────────────────────────────────────────────────────────────────────────
GEMINI_MODEL_FALLBACKS = [
    "gemini-2.5-flash-lite",   # primaire
    "gemini-2.5-flash",        # fallback 1
    "gemini-2.0-flash",        # fallback 2
    "gemini-1.5-flash-8b",     # fallback 3 (dernier recours) — remplace gemini-1.5-flash (déprécié)
]


@dataclass(frozen=True)
class AgentSettings:

    # API KEYS
    google_api_key: str
    google_maps_api_key: str
    google_search_api_key: str
    google_cse_id: str
    serper_api_key: str
    brave_search_api_key: str

    # MODELS
    chat_model: str
    embedding_model: str

    # STORAGE
    vector_store: str
    chroma_dir: str
    redis_url: str
    redis_ttl_seconds: int

    # LIMITES
    max_results: int
    llm_timeout: int
    max_tool_calls: int

    @property
    def has_gemini(self) -> bool:
        return bool(self.google_api_key)

    @property
    def has_maps(self) -> bool:
        return bool(self.google_maps_api_key)

    @property
    def has_serper(self) -> bool:
        return bool(self.serper_api_key)

    def validate(self) -> list[str]:
        warnings = []
        if not self.has_gemini:
            warnings.append("GOOGLE_API_KEY manquante — LLM désactivé")
        if not self.has_maps:
            warnings.append("GOOGLE_MAPS_API_KEY manquante — google_maps_search désactivé")
        if not self.has_serper:
            warnings.append("SERPER_API_KEY manquante — DuckDuckGo sera utilisé")
        if self.max_tool_calls > 5:
            warnings.append("max_tool_calls élevé → risque de quota Gemini")
        return warnings


def get_agent_settings() -> AgentSettings:

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""

    chat_model = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash-lite")
    if chat_model not in GEMINI_MODEL_FALLBACKS:
        chat_model = GEMINI_MODEL_FALLBACKS[0]

    return AgentSettings(

        google_api_key=api_key,

        google_maps_api_key=(
            os.getenv("GOOGLE_MAPS_API_KEY")
            or os.getenv("GOOGLE_PLACES_API_KEY")
            or ""
        ),

        google_search_api_key=(
            os.getenv("GOOGLE_CUSTOM_SEARCH_API_KEY")
            or os.getenv("GOOGLE_CSE_API_KEY")
            or os.getenv("GOOGLE_SEARCH_API_KEY")
            or ""
        ),

        google_cse_id=(
            os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
            or os.getenv("GOOGLE_CSE_ID")
            or os.getenv("GOOGLE_CX")
            or ""
        ),

        serper_api_key=(
            os.getenv("SERPER_API_KEY")
            or os.getenv("SERPER_DEV_API_KEY")
            or ""
        ),

        brave_search_api_key=(
            os.getenv("BRAVE_SEARCH_API_KEY") or ""
        ),

        chat_model=chat_model,

        embedding_model=os.getenv(
            "GEMINI_EMBEDDING_MODEL",
            "models/text-embedding-004"
        ),

        vector_store=os.getenv("PROSPECTION_VECTOR_STORE", "chroma"),

        chroma_dir=os.getenv("PROSPECTION_CHROMA_DIR", ".prospection_chroma"),

        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),

        redis_ttl_seconds=int(os.getenv("PROSPECTION_REDIS_TTL_SECONDS", "1800")),

        max_results=int(os.getenv("PROSPECTION_MAX_RESULTS", "10")),

        llm_timeout=int(os.getenv("PROSPECTION_LLM_TIMEOUT", "45")),

        max_tool_calls=int(os.getenv("PROSPECTION_MAX_TOOL_CALLS", "3")),
    )


def ensure_local_dirs(settings: AgentSettings) -> None:
    Path(settings.chroma_dir).mkdir(parents=True, exist_ok=True)