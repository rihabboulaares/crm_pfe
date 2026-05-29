from typing import Any, List

from pydantic import BaseModel, Field, field_validator


class IntentSchema(BaseModel):
    objective: str
    lead_types: List[str]
    industries: List[str]
    locations: List[str]
    target_roles: List[str]
    sources: List[str]
    max_leads: int
    reasoning_summary: str = ""


class DecisionSchema(BaseModel):
    decision: str
    tool: str = ""
    query: str = ""
    target_urls: List[str] = Field(default_factory=list)
    reason: str = ""
    confidence: float = 0.5

    @field_validator("tool", "query", "reason", mode="before")
    @classmethod
    def none_to_empty_string(cls, value):
        if value is None:
            return ""
        return str(value)

    @field_validator("target_urls", mode="before")
    @classmethod
    def normalize_urls(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        return value


class EntityAnalysisItemSchema(BaseModel):
    index: int
    is_valid: bool
    entity_type: str
    lead_score: int = 0
    evaluation: str = "cold"
    reason: str = ""
    crm_ready: bool = False
    enrichment_status: str = "needs_enrichment"
    qualification_reasons: List[str] = Field(default_factory=list)
    rejection_reason: str = ""
    cleaned_data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("evaluation", mode="before")
    @classmethod
    def normalize_evaluation(cls, value):
        value = str(value or "cold").lower()
        if value not in {"hot", "warm", "cold"}:
            return "cold"
        return value

    @field_validator("reason", "entity_type", mode="before")
    @classmethod
    def none_to_empty_string(cls, value):
        if value is None:
            return ""
        return str(value)

    @field_validator("enrichment_status", mode="before")
    @classmethod
    def normalize_enrichment_status(cls, value):
        value = str(value or "needs_enrichment")
        if value not in {"enriched", "needs_enrichment", "complete"}:
            return "needs_enrichment"
        if value == "complete":
            return "enriched"
        return value

    @field_validator("rejection_reason", mode="before")
    @classmethod
    def normalize_rejection_reason(cls, value):
        if value is None:
            return ""
        return str(value)

    @field_validator("cleaned_data", mode="before")
    @classmethod
    def normalize_cleaned_data(cls, value):
        if isinstance(value, dict):
            return value
        return {}


class EntityAnalysisSchema(BaseModel):
    entities: List[EntityAnalysisItemSchema] = Field(default_factory=list)
