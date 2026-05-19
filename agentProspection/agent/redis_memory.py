import hashlib
import json
from datetime import datetime, timezone
from typing import Any

try:
    import redis
except Exception:
    redis = None

from .config import AgentSettings


class RedisAgentMemory:
    """
    Memoire operationnelle unique de l'agent.

    Redis sert a:
    - cacher les recherches recentes,
    - garder l'historique court terme d'une session commerciale,
    - eviter de relancer le pipeline complet pour la meme requete.
    """

    def __init__(self, settings: AgentSettings):
        self.settings = settings
        self.client = None

        if redis is None:
            return

        try:
            self.client = redis.from_url(settings.redis_url, decode_responses=True)
            self.client.ping()
        except Exception:
            self.client = None

    @property
    def available(self) -> bool:
        return self.client is not None

    def get_cached_result(self, criteria: dict[str, Any]) -> dict[str, Any] | None:
        if not self.client:
            return None

        value = self.client.get(self._search_key(criteria))
        if not value:
            return None

        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None

    def set_cached_result(self, criteria: dict[str, Any], result: dict[str, Any]) -> None:
        if not self.client:
            return

        self.client.setex(
            self._search_key(criteria),
            self.settings.redis_ttl_seconds,
            json.dumps(result, ensure_ascii=False),
        )

    def append_history(self, session_id: str, criteria: dict[str, Any], stats: dict[str, Any]) -> None:
        if not self.client:
            return

        item = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "criteria": criteria,
            "stats": stats,
        }
        key = f"prospection:history:{session_id or 'default'}"
        self.client.lpush(key, json.dumps(item, ensure_ascii=False))
        self.client.ltrim(key, 0, 19)
        self.client.expire(key, 60 * 60 * 24 * 30)

    def get_history(self, session_id: str) -> list[dict[str, Any]]:
        if not self.client:
            return []

        key = f"prospection:history:{session_id or 'default'}"
        items = self.client.lrange(key, 0, 19)
        history = []
        for item in items:
            try:
                history.append(json.loads(item))
            except json.JSONDecodeError:
                continue
        return history

    def _search_key(self, criteria: dict[str, Any]) -> str:
        stable = {
            "pipeline_version": 2,
            "search_type": criteria.get("search_type"),
            "secteur": criteria.get("secteur"),
            "ville": criteria.get("ville"),
            "rayon_km": criteria.get("rayon_km"),
            "max_resultats": criteria.get("max_resultats"),
            "score_min": criteria.get("score_min"),
            "query": criteria.get("query"),
            "country": criteria.get("country"),
            "activity_type": criteria.get("activity_type"),
            "job_title": criteria.get("job_title"),
            "seniority_level": criteria.get("seniority_level"),
            "target_company": criteria.get("target_company"),
            "require_facebook": criteria.get("require_facebook"),
            "require_instagram": criteria.get("require_instagram"),
            "require_website": criteria.get("require_website"),
            "require_phone": criteria.get("require_phone"),
            "require_email": criteria.get("require_email"),
            "require_linkedin": criteria.get("require_linkedin"),
            "validation_min": criteria.get("validation_min"),
            "employees_min": criteria.get("employees_min"),
            "employees_max": criteria.get("employees_max"),
            "sources": sorted(criteria.get("sources", [])),
            "keywords": sorted(criteria.get("keywords", [])),
            "criteres": criteria.get("criteres", []),
        }
        raw = json.dumps(stable, sort_keys=True, ensure_ascii=False)
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return f"prospection:search:{digest}"
