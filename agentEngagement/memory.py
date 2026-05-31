from dataclasses import dataclass, field
from typing import Any


@dataclass
class EngagementMemory:

    prospect_id: int

    company_id: int

    user_id: int

    prospect_data: dict[str, Any] = field(default_factory=dict)

    scraped_profiles: dict[str, Any] = field(default_factory=dict)

    analysis: dict[str, Any] = field(default_factory=dict)

    decision: dict[str, Any] = field(default_factory=dict)

    generated_message: dict[str, Any] = field(default_factory=dict)

    created_task_id: int | None = None

    logs: list[dict[str, Any]] = field(default_factory=list)

    errors: list[dict[str, Any]] = field(default_factory=list)

    def add_log(self, step: str, message: str):
        self.logs.append(
            {
                "step": step,
                "message": str(message),
            }
        )

    def add_error(self, step: str, message: str):
        self.errors.append(
            {
                "step": step,
                "message": str(message),
            }
        )

    def to_summary(self):

        return {
            "prospect": self.prospect_data,
            "scraped_profiles": self.scraped_profiles,
            "analysis": self.analysis,
            "decision": self.decision,
        }