import json

from google import genai

from django.conf import settings

from .schemas import (
    EngagementDecisionSchema,
    EngagementMessageSchema,
)


class EngagementBrain:

    def __init__(self):

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    async def analyze_prospect(
        self,
        prospect_data: dict,
        scraped_profiles: dict,
    ):

        prompt = f"""
Analyse ce prospect CRM.

PROSPECT :
{json.dumps(prospect_data, ensure_ascii=False)}

PROFILES :
{json.dumps(scraped_profiles, ensure_ascii=False)}

Détermine :

1. si le prospect est intéressant

2. quel est le meilleur canal :
- phone
- email
- linkedin
- instagram
- facebook

3. quelle action faire :

- create_task
- call
- send_email
- send_linkedin
- send_instagram
- send_facebook

Retourne uniquement du JSON :

{{
  "qualified": true,
  "priority": "high",
  "best_channel": "linkedin",
  "action_type": "send_linkedin",
  "reason": "..."
}}
"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        text = response.text.strip()

        try:
            data = json.loads(text)

            return EngagementDecisionSchema(
                **data
            ).model_dump()

        except Exception:

            return {
                "qualified": True,
                "priority": "medium",
                "best_channel": "manual",
                "action_type": "create_task",
                "reason": "fallback",
                "should_create_task": True,
                "should_generate_message": True,
                "should_send_now": False,
            }

    async def generate_message(
        self,
        prospect_data: dict,
        analysis: dict,
    ):

        prompt = f"""
Tu es un commercial B2B expert.

Prospect :

{json.dumps(prospect_data, ensure_ascii=False)}

Analyse :

{json.dumps(analysis, ensure_ascii=False)}

Génère :

- un message personnalisé
- un titre de tâche
- une description de tâche

Retourne uniquement du JSON :

{{
  "channel": "linkedin",
  "subject": "",
  "message": "",
  "call_script": "",
  "task_title": "",
  "task_description": ""
}}
"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        text = response.text.strip()

        try:

            data = json.loads(text)

            return EngagementMessageSchema(
                **data
            ).model_dump()

        except Exception:

            return {
                "channel": analysis.get(
                    "best_channel",
                    "manual",
                ),
                "subject": "",
                "message": "",
                "call_script": "",
                "task_title": "Contacter prospect",
                "task_description": "Action commerciale",
            }