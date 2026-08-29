from typing import Any, Literal

from pydantic import BaseModel, Field


Level = Literal["UNKNOWN", "LOW", "MEDIUM", "HIGH"]


class QualificationAIResult(BaseModel):
    need_level: Level = "UNKNOWN"
    intent_level: Level = "UNKNOWN"
    urgency_level: Level = "UNKNOWN"
    budget_signal: Literal["UNKNOWN", "NEGATIVE", "NEUTRAL", "POSITIVE"] = "UNKNOWN"
    authority_level: Literal["UNKNOWN", "USER", "INFLUENCER", "DECISION_MAKER"] = "UNKNOWN"
    engagement_quality: Literal["NONE", "NEGATIVE", "WEAK", "POSITIVE", "STRONG"] = "NONE"
    detected_needs: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    buying_signals: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    summary: str = ""


class QualificationScoreBreakdown(BaseModel):
    profile_fit_score: int = 0
    company_fit_score: int = 0
    contact_relevance_score: int = 0
    reachability_score: int = 0
    need_score: int = 0
    intent_score: int = 0
    authority_score: int = 0
    timing_score: int = 0
    engagement_score: int = 0
    buying_signal_score: int = 0


class QualificationDecision(BaseModel):
    status: Literal[
        "ENGAGE",
        "DEEPEN",
        "READY_FOR_OPPORTUNITY",
        "NOT_QUALIFIED",
        "ANALYSIS_INCOMPLETE",
    ]
    opportunity_ready: bool = False
    recommended_action: Literal[
        "ENGAGE_PROSPECT",
        "DEEPEN_DISCOVERY",
        "CREATE_OPPORTUNITY",
        "DO_NOT_CONTACT",
        "RETRY_QUALIFICATION",
    ]
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    summary: str = ""


class QualificationRunResult(BaseModel):
    qualification_id: int
    prospect_id: int
    mode: str
    score: int
    previous_score: int | None = None
    score_delta: int | None = None
    deterministic_score: int
    confidence: float
    status: str
    opportunity_ready: bool
    recommended_action: str
    strengths: list[str]
    risks: list[str]
    missing_information: list[str]
    detected_needs: list[str]
    objections: list[str]
    buying_signals: list[str]
    summary: str
    signal_details: dict[str, Any]

