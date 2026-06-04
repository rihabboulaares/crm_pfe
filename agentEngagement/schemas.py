from typing import Literal
from pydantic import BaseModel, Field


class EngagementResultSchema(BaseModel):
    qualified: bool
    priority: Literal["low", "medium", "high"]

    best_channel: Literal[
        "email",
        "phone",
        "linkedin",
        "facebook",
        "instagram",
        "manual",
    ]

    action_type: Literal[
        "send_email",
        "call",
        "send_linkedin",
        "send_facebook",
        "send_instagram",
        "create_task",
        "no_action",
    ]

    reason: str
    should_create_task: bool
    should_generate_message: bool
    should_send_now: bool = False

    subject: str = ""
    message: str = ""
    call_script: str = ""

    task_title: str = ""
    task_description: str = ""


class ProspectProfileData(BaseModel):
    first_name: str = ""
    last_name: str = ""
    title: str = ""
    description: str = ""
    email: str = ""
    phone: str = ""
    company_name: str = ""
    website: str = ""
    linkedin_url: str = ""
    facebook_url: str = ""
    instagram_url: str = ""

    linkedin_data: dict = Field(default_factory=dict)
    facebook_data: dict = Field(default_factory=dict)
    instagram_data: dict = Field(default_factory=dict)
    website_data: dict = Field(default_factory=dict)
