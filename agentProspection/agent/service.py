from typing import Any

from .config import get_agent_settings
from .graph import ProspectionGraph


class ProspectionAgent:
    def __init__(self):
        self.settings = get_agent_settings()
        self.graph = ProspectionGraph(self.settings)

    def rechercher(self, criteria: dict[str, Any]) -> dict[str, Any]:
        return self.graph.run(criteria)
