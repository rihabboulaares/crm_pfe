# agentProspection/tools/cache_tool.py
import os
import json
from typing import Optional
import redis


class CacheTool:

    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.r = redis.from_url(redis_url, decode_responses=True)
        try:
            self.r.ping()
            print("[Cache] Redis connecté ✅")
        except Exception as e:
            print(f"[Cache] Redis non disponible : {e}")
            self.r = None

    def get_score(self, place_id: str) -> Optional[dict]:
        if not self.r or not place_id:
            return None
        val = self.r.get(f"score:{place_id}")
        if val:
            print(f"  [Cache] Score depuis Redis ✅")
            return json.loads(val)
        return None

    def set_score(self, place_id: str, scoring: dict, ttl_jours: int = 7):
        if not self.r or not place_id:
            return
        self.r.setex(f"score:{place_id}", ttl_jours * 86400, json.dumps(scoring))

    def est_importe(self, place_id: str) -> bool:
        if not self.r or not place_id:
            return False
        return bool(self.r.exists(f"importe:{place_id}"))

    def marquer_importe(self, place_id: str):
        if not self.r or not place_id:
            return
        self.r.setex(f"importe:{place_id}", 90 * 86400, "1")

    def stats(self) -> dict:
        if not self.r:
            return {"status": "non connecté"}
        return {
            "status": "connecté",
            "scores_en_cache": len(self.r.keys("score:*")),
            "prospects_importes": len(self.r.keys("importe:*")),
        }
