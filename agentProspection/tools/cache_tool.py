"""
Cache Redis pour l'agent de prospection.

Utilisé pour :
- Mémoriser les scores calculés (éviter de rappeler Gemini)
- Marquer les entreprises déjà importées dans le CRM

Redis est OPTIONNEL. Si non disponible, tout fonctionne en mode dégradé.
"""

import json
import os
from typing import Optional


class CacheTool:

    def __init__(self):
        self.r = None  # défaut sûr avant toute connexion
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        try:
            import redis as _redis
            client = _redis.from_url(redis_url, decode_responses=True)
            client.ping()
            self.r = client
            print("[Cache] Redis connecté ✅")
        except Exception as exc:
            print(f"[Cache] Redis non disponible — mode dégradé : {exc}")

    @property
    def available(self) -> bool:
        return self.r is not None

    def get_score(self, place_id: str) -> Optional[dict]:
        if not self.r or not place_id:
            return None
        val = self.r.get(f"score:{place_id}")
        if val:
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                return None
        return None

    def set_score(self, place_id: str, scoring: dict, ttl_jours: int = 7) -> None:
        if not self.r or not place_id:
            return
        self.r.setex(
            f"score:{place_id}",
            ttl_jours * 86_400,
            json.dumps(scoring, ensure_ascii=False),
        )

    def est_importe(self, place_id: str) -> bool:
        if not self.r or not place_id:
            return False
        return bool(self.r.exists(f"importe:{place_id}"))

    def marquer_importe(self, place_id: str) -> None:
        if not self.r or not place_id:
            return
        self.r.setex(f"importe:{place_id}", 90 * 86_400, "1")

    def stats(self) -> dict:
        if not self.r:
            return {"status": "non connecté"}
        try:
            return {
                "status": "connecté",
                "scores_en_cache": len(self.r.keys("score:*")),
                "prospects_importes": len(self.r.keys("importe:*")),
            }
        except Exception:
            return {"status": "erreur"}