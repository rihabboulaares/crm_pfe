import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


@dataclass(frozen=True)
class AgentSettings:
    google_api_key: str
    chat_model: str
    embedding_model: str
    vector_store: str
    chroma_dir: str
    redis_url: str
    redis_ttl_seconds: int
    max_results: int
    llm_timeout: int


def get_agent_settings() -> AgentSettings:
    if load_dotenv is not None:
        load_dotenv()

    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""

    return AgentSettings(
        google_api_key=api_key,
        chat_model=os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash"),
        embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001"),
        vector_store="chroma",
        chroma_dir=os.getenv("PROSPECTION_CHROMA_DIR", ".prospection_chroma"),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        redis_ttl_seconds=int(os.getenv("PROSPECTION_REDIS_TTL_SECONDS", "1800")),
        max_results=int(os.getenv("PROSPECTION_MAX_RESULTS", "10")),
        llm_timeout=int(os.getenv("PROSPECTION_LLM_TIMEOUT", "45")),
    )


def ensure_local_dirs(settings: AgentSettings) -> None:
    Path(settings.chroma_dir).mkdir(parents=True, exist_ok=True)