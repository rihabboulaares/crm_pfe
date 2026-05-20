"""
Cache Redis pour l'agent de prospection.

Utilisé pour :
- Mémoriser les scores calculés (éviter de rappeler Gemini)
- Marquer les entreprises déjà importées dans le CRM

Redis est OPTIONNEL. Si non disponible, tout fonctionne en mode dégradé.
"""
import hashlib 
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
        
    
    # cache_tool.py — APRÈS


    def _query_key(self, criteria: dict) -> str:
    # Tous les paramètres qui changent les résultats attendus
        relevant = {
            "secteur":        str(criteria.get("secteur") or "").lower(),
            "ville":          str(criteria.get("ville") or "").lower(),
            "search_type":    str(criteria.get("search_type") or "company"),
            "job_title":      str(criteria.get("job_title") or "").lower(),
            "max_resultats":  int(criteria.get("max_resultats") or 10),
            "require_phone":  bool(criteria.get("require_phone")),
            "require_email":  bool(criteria.get("require_email")),
            "require_website":bool(criteria.get("require_website")),
            "require_linkedin":bool(criteria.get("require_linkedin")),
            "sources":        sorted(criteria.get("sources") or []),
        }
        raw = json.dumps(relevant, sort_keys=True)
        return "query:" + hashlib.sha256(raw.encode()).hexdigest()[:20]

    def get_query_result(self, criteria: dict) -> dict | None:
        if not self.r:
            return None
        key = self._query_key(criteria)
        val = self.r.get(key)
        if val:
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                return None
        return None

    def set_query_result(self, criteria: dict, result: dict, ttl_heures: int = 6) -> None:
        if not self.r:
            return
        key = self._query_key(criteria)
        self.r.setex(key, ttl_heures * 3600, json.dumps(result, ensure_ascii=False))