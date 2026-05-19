"""
Point d'entrée unique — ReactAgent UNIQUEMENT.
"""
from typing import Any
from .config import get_agent_settings


class ProspectionAgent:
    def __init__(self):
        self.settings = get_agent_settings()
        self._react_agent = None
        for w in self.settings.validate():
            print(f"[ProspectionAgent] ⚠ {w}")

    def rechercher(self, criteria: dict[str, Any]) -> dict[str, Any]:
        # Construire une query naturelle si absente
        if not criteria.get("query") and not criteria.get("prompt"):
            criteria = dict(criteria)
            criteria["query"] = self._build_query(criteria)
        try:
            return self._get_react_agent().run(criteria)
        except Exception as exc:
            print(f"[ProspectionAgent] Erreur: {exc}")
            raise

    def _get_react_agent(self):
        if self._react_agent is None:
            from .react_agent import ReactProspectionAgent
            self._react_agent = ReactProspectionAgent(self.settings)
        return self._react_agent

    def _build_query(self, c: dict) -> str:
        parts = []
        if c.get("search_type") == "prospect" and c.get("job_title"):
            parts.append(f"Trouver des {c['job_title']}")
        elif c.get("secteur"):
            parts.append(f"Entreprises {c['secteur']}")
        if c.get("ville"):
            parts.append(f"à {c['ville']}")
        parts.append("en Tunisie")
        return " ".join(parts)