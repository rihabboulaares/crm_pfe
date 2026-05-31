from typing import List
from pydantic import BaseModel, Field, field_validator


class EngagementDecisionSchema(BaseModel):
    qualified: bool = True
    priority: str = "medium"

    best_channel: str = "manual"

    action_type: str = "create_task"

    reason: str = ""

    should_create_task: bool = True
    should_generate_message: bool = True
    should_send_now: bool = False

    @field_validator(
        "priority",
        "best_channel",
        "action_type",
        "reason",
        mode="before",
    )
    @classmethod
    def normalize_strings(cls, value):
        if value is None:
            return ""
        return str(value)


class EngagementMessageSchema(BaseModel):
    channel: str = ""

    subject: str = ""

    message: str = ""

    call_script: str = ""

    task_title: str = ""

    task_description: str = ""

    @field_validator(
        "channel",
        "subject",
        "message",
        "call_script",
        "task_title",
        "task_description",
        mode="before",
    )
    @classmethod
    def normalize_strings(cls, value):
        if value is None:
            return ""
        return str(value)


class ProspectAnalysisSchema(BaseModel):
    company_name: str = ""

    full_name: str = ""

    industry: str = ""

    activity_summary: str = ""

    signals: List[str] = Field(default_factory=list)

    best_channel: str = ""

    recommended_action: str = ""

    priority: str = "medium"

    reason: str = ""