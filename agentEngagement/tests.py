import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from Notifications.models import HistoryLog
from sales.models import Prospect, ProspectActivity, ProspectCompany, Task, TaskActivity
from users.models import Company, User

from .agent.channel_resolver import ChannelResolver
from .agent.content_generator import (
    EngagementContentGenerationUnavailable,
    EngagementContentGenerator,
    GeneratedEngagementContent,
)
from .agent.continuation import EngagementContinuationService
from .agent.context_builder import ProspectEngagementContextBuilder
from .agent.memory_manager import EngagementMemoryManager, serialize_memory
from .agent.policy_engine import EngagementPolicyEngine
from .agent.response_analyzer import (
    ProspectResponseAnalysis,
    ProspectResponseAnalysisUnavailable,
    ProspectResponseAnalyzer,
)
from .agent.replanner import EngagementReplanningService
from .agent.strategy_planner import (
    EngagementPlanningUnavailable,
    EngagementStrategyPlan,
    EngagementStrategyPlanner,
)
from .models import EngagementLog, UserEmailConnection
from .models import ProspectEngagementMemory
from .views import EmailConnectionsView
from .views import (
    EngagementInteractionOptionsView,
    ProspectInitialEngagementPlanView,
    ProspectInteractionAnalysisView,
    ProspectInteractionsView,
    ProspectLogsView,
)
from .views import ProspectInteractionContinueView, ProspectInteractionReplanView


class EngagementAgentWorkflowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="pass",
        )
        self.company = Company.objects.create(owner=self.owner, name="Acme")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])

    def make_prospect(self, **overrides):
        defaults = {
            "first_name": "Ada",
            "last_name": f"Lead{Prospect.objects.count()}",
            "company": self.company,
            "assigned_to": self.owner,
            "engagement_status": "new",
            "email": f"lead{Prospect.objects.count()}@example.com",
        }
        defaults.update(overrides)
        return Prospect.objects.create(**defaults)

    def test_email_connections_are_user_scoped(self):
        other = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="pass",
            company=self.company,
        )
        UserEmailConnection.objects.create(
            user=other,
            provider=UserEmailConnection.PROVIDER_GMAIL,
            email="other.gmail@example.com",
            display_name="Other",
            access_token="token",
            is_active=True,
        )
        request = APIRequestFactory().get("/api/engagement/connections/email/")
        force_authenticate(request, user=self.owner)

        response = EmailConnectionsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["active"]["connected"])

    def test_no_browser_automation_imports_in_engagement_agent_sources(self):
        from pathlib import Path

        forbidden = "play" + "wright"
        base = Path(__file__).resolve().parent
        scanned = []
        for path in base.rglob("*.py"):
            if "__pycache__" in path.parts or "migrations" in path.parts:
                continue
            text = path.read_text(encoding="utf-8")
            scanned.append(path.name)
            self.assertNotIn(forbidden, text.lower(), path.name)

        self.assertIn("initial_flow.py", scanned)


class ProspectEngagementContextBuilderTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="context-owner@example.com",
            username="context-owner",
            password="pass",
        )
        self.company = Company.objects.create(
            owner=self.owner,
            name="Context CRM",
            industry="Software",
            city="Tunis",
            country="TN",
        )
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.builder = ProspectEngagementContextBuilder()

    def make_prospect_company(self, **overrides):
        defaults = {
            "name": "ABC Technologies",
            "industry": "SaaS",
            "city": "Ariana",
            "country": "TN",
            "website": "https://abc.example.com",
            "number_of_employees": 42,
            "company": self.company,
            "created_by": self.owner,
            "assigned_to": self.owner,
        }
        defaults.update(overrides)
        return ProspectCompany.objects.create(**defaults)

    def make_prospect(self, **overrides):
        defaults = {
            "first_name": "Ahmed",
            "last_name": f"Lead{Prospect.objects.count()}",
            "title": "Directeur commercial",
            "email": f"context{Prospect.objects.count()}@example.com",
            "phone": "+21611111111",
            "city": "Tunis",
            "country": "TN",
            "description": "Prospect CRM existant.",
            "status": "new",
            "source": "commercial",
            "lead_origin": "manual",
            "company": self.company,
            "assigned_to": self.owner,
            "prospect_company": self.make_prospect_company(),
        }
        defaults.update(overrides)
        return Prospect.objects.create(**defaults)

    def test_context_contains_prospect_contact_and_company_data(self):
        prospect = self.make_prospect()

        context = self.builder.build(prospect)

        self.assertEqual(context["prospect"]["id"], prospect.id)
        self.assertEqual(context["prospect"]["first_name"], "Ahmed")
        self.assertEqual(context["prospect"]["job_title"], "Directeur commercial")
        self.assertEqual(context["contact"]["email"], prospect.email)
        self.assertEqual(context["contact"]["phone"], "+21611111111")
        self.assertEqual(context["company"]["name"], "ABC Technologies")
        self.assertEqual(context["company"]["industry"], "SaaS")

    def test_context_without_prospect_company_is_valid(self):
        prospect = self.make_prospect(prospect_company=None)

        context = self.builder.build(prospect)

        self.assertIsNone(context["company"])
        self.assertEqual(context["prospect"]["full_name"], f"{prospect.first_name} {prospect.last_name}")

    def test_context_without_email_or_phone_is_valid(self):
        prospect = self.make_prospect(email=None, phone=None)

        context = self.builder.build(prospect)

        self.assertIsNone(context["contact"]["email"])
        self.assertIsNone(context["contact"]["phone"])

    def test_facebook_url_is_preserved_as_metadata(self):
        prospect = self.make_prospect(facebook_url="https://facebook.com/abc.profile")

        context = self.builder.build(prospect)

        self.assertEqual(context["contact"]["facebook_url"], "https://facebook.com/abc.profile")
        self.assertNotIn("recommended_channel", context)

    def test_history_is_returned_oldest_to_newest(self):
        prospect = self.make_prospect()
        older = HistoryLog.objects.create(
            actor=self.owner,
            actor_type="user",
            actor_name="Owner",
            performed_by=self.owner,
            action="create",
            entity_type="prospect",
            entity_id=prospect.id,
            entity_name=str(prospect),
            description="Older history",
            company=self.company,
        )
        newer = HistoryLog.objects.create(
            actor=self.owner,
            actor_type="user",
            actor_name="Owner",
            performed_by=self.owner,
            action="update",
            entity_type="prospect",
            entity_id=prospect.id,
            entity_name=str(prospect),
            description="Newer history",
            company=self.company,
        )
        HistoryLog.objects.filter(pk=older.pk).update(created_at=timezone.now() - timezone.timedelta(days=2))
        HistoryLog.objects.filter(pk=newer.pk).update(created_at=timezone.now() - timezone.timedelta(days=1))

        context = self.builder.build(prospect)
        history_summaries = [
            item["summary"]
            for item in context["history"]
            if item["source"] == "history_log" and item["summary"] in {"Older history", "Newer history"}
        ]

        self.assertEqual(history_summaries, ["Older history", "Newer history"])

    def test_activities_and_tasks_are_included_without_model_instances(self):
        prospect = self.make_prospect()
        ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="commercial_note",
            channel="email",
            title="Note prospect",
            description="Description note",
            source="manual",
            created_by=self.owner,
        )
        task = Task.objects.create(
            title="Relancer Ahmed",
            description="Relance CRM",
            task_type="follow_up",
            status="todo",
            priority="medium",
            prospect=prospect,
            assigned_to=self.owner,
            created_by=self.owner,
            company=self.company,
        )
        TaskActivity.objects.create(
            task=task,
            activity_type="note",
            performed_by=self.owner,
            prospect=prospect,
            notes="Note de tache",
        )

        context = self.builder.build(prospect)

        self.assertTrue(any(item["source"] == "prospect_activity" for item in context["activities"]))
        self.assertTrue(any(item["title"] == "Relancer Ahmed" for item in context["tasks"]))
        json.dumps(context)

    def test_oauth_tokens_are_not_included(self):
        prospect = self.make_prospect()
        UserEmailConnection.objects.create(
            user=self.owner,
            provider=UserEmailConnection.PROVIDER_GMAIL,
            email="context-owner@gmail.example.com",
            access_token="secret-access-token",
            refresh_token="secret-refresh-token",
            is_active=True,
        )

        context_json = json.dumps(self.builder.build(prospect))

        self.assertNotIn("secret-access-token", context_json)
        self.assertNotIn("secret-refresh-token", context_json)
        self.assertNotIn("access_token", context_json)
        self.assertNotIn("refresh_token", context_json)

    def test_context_is_json_serializable(self):
        prospect = self.make_prospect(facebook_url="https://facebook.com/example")

        context = self.builder.build(prospect)

        encoded = json.dumps(context)
        self.assertIn("facebook.com/example", encoded)


class ChannelResolverTests(TestCase):
    def setUp(self):
        self.resolver = ChannelResolver()

    def make_context(self, **contact):
        defaults = {
            "email": None,
            "phone": None,
            "linkedin_url": None,
            "facebook_url": None,
            "instagram_url": None,
        }
        defaults.update(contact)
        return {"contact": defaults}

    def test_email_only(self):
        channels = self.resolver.resolve(self.make_context(email="lead@example.com"))

        self.assertTrue(channels["email"]["available"])
        self.assertEqual(channels["email"]["execution_mode"], "integrated")
        self.assertFalse(channels["phone"]["available"])
        self.assertFalse(channels["facebook"]["available"])

    def test_phone_only(self):
        channels = self.resolver.resolve(self.make_context(phone="+21622222222"))

        self.assertTrue(channels["phone"]["available"])
        self.assertEqual(channels["phone"]["execution_mode"], "manual")
        self.assertEqual(channels["phone"]["content_type"], "call_script")
        self.assertFalse(channels["email"]["available"])

    def test_email_and_phone_are_both_available_without_preference(self):
        channels = self.resolver.resolve(
            self.make_context(email="lead@example.com", phone="+21622222222")
        )

        self.assertTrue(channels["email"]["available"])
        self.assertTrue(channels["phone"]["available"])
        self.assertNotIn("recommended_channel", channels)
        self.assertNotIn("best_channel", channels)

    def test_facebook_url_available_as_manual_social_message(self):
        channels = self.resolver.resolve(self.make_context(facebook_url="https://facebook.com/lead"))

        self.assertTrue(channels["facebook"]["available"])
        self.assertEqual(channels["facebook"]["execution_mode"], "manual")
        self.assertEqual(channels["facebook"]["content_type"], "social_message")

    def test_linkedin_url_available_as_manual_social_message(self):
        channels = self.resolver.resolve(self.make_context(linkedin_url="https://linkedin.com/in/lead"))

        self.assertTrue(channels["linkedin"]["available"])
        self.assertEqual(channels["linkedin"]["execution_mode"], "manual")

    def test_instagram_url_available_as_manual_social_message(self):
        channels = self.resolver.resolve(self.make_context(instagram_url="https://instagram.com/lead"))

        self.assertTrue(channels["instagram"]["available"])
        self.assertEqual(channels["instagram"]["execution_mode"], "manual")

    def test_no_channel_is_valid(self):
        channels = self.resolver.resolve(self.make_context())

        self.assertTrue(all(not data["available"] for data in channels.values()))
        self.assertEqual(set(channels.keys()), {"email", "phone", "linkedin", "facebook", "instagram"})

    def test_empty_values_are_not_available(self):
        channels = self.resolver.resolve(
            self.make_context(
                email="   ",
                phone="",
                linkedin_url=None,
                facebook_url="   ",
                instagram_url="",
            )
        )

        self.assertTrue(all(not data["available"] for data in channels.values()))

    def test_result_is_json_serializable(self):
        channels = self.resolver.resolve(self.make_context(email="lead@example.com"))

        encoded = json.dumps(channels)
        self.assertIn("integrated", encoded)

    def test_result_contains_no_strategy_or_scoring_fields(self):
        channels = self.resolver.resolve(
            self.make_context(email="lead@example.com", phone="+21622222222")
        )
        encoded = json.dumps(channels)

        for forbidden in ["recommended_channel", "best_channel", "strategy", "priority", "score", "temperature"]:
            self.assertNotIn(forbidden, encoded)

    def test_context_builder_and_channel_resolver_integration(self):
        owner = User.objects.create_user(
            email="channel-owner@example.com",
            username="channel-owner",
            password="pass",
        )
        company = Company.objects.create(owner=owner, name="Channel CRM")
        owner.company = company
        owner.save(update_fields=["company"])
        prospect = Prospect.objects.create(
            first_name="Nour",
            last_name="Channel",
            email="nour@example.com",
            phone="+21633333333",
            facebook_url="https://facebook.com/nour",
            company=company,
            assigned_to=owner,
        )

        context = ProspectEngagementContextBuilder().build(prospect)
        channels = self.resolver.resolve(context)

        self.assertTrue(channels["email"]["available"])
        self.assertTrue(channels["phone"]["available"])
        self.assertTrue(channels["facebook"]["available"])
        self.assertFalse(channels["linkedin"]["available"])
        self.assertFalse(channels["instagram"]["available"])


class EngagementStrategyPlannerTests(TestCase):
    def setUp(self):
        self.planner = EngagementStrategyPlanner(model=object())

    def make_context(self):
        return {
            "prospect": {
                "first_name": "Nour",
                "last_name": "Ben Ali",
                "job_title": "Sales Director",
                "lead_origin": "manual",
            },
            "contact": {
                "email": "nour@example.com",
                "phone": "+21622222222",
                "linkedin_url": None,
                "facebook_url": None,
                "instagram_url": None,
            },
            "company": {"name": "Acme", "industry": "B2B services"},
            "crm": {"engagement_status": "new"},
            "history": [],
            "activities": [],
            "tasks": [],
        }

    def make_channels(self, **availability):
        defaults = {
            "email": True,
            "phone": False,
            "linkedin": False,
            "facebook": False,
            "instagram": False,
        }
        defaults.update(availability)
        return {
            channel: {
                "available": available,
                "execution_mode": "integrated" if channel == "email" else "manual",
                "content_type": "email" if channel == "email" else "social_message",
            }
            for channel, available in defaults.items()
        }

    def make_plan_payload(self, **overrides):
        payload = {
            "situation_summary": "Prospect B2B non contacte avec un canal exploitable.",
            "engagement_stage": "FIRST_CONTACT",
            "prospect_temperature": "COLD",
            "objective": "START_CONVERSATION",
            "strategy": "DIRECT_OUTREACH",
            "primary_channel": "email",
            "secondary_channels": [],
            "confidence": 0.82,
            "reasons": ["Un email professionnel est disponible."],
            "missing_information": ["besoin actuel"],
            "should_wait": False,
            "suggested_wait_days": None,
        }
        payload.update(overrides)
        return payload

    def gemini_response(self, payload):
        return SimpleNamespace(text=json.dumps(payload))

    def test_schema_validates_complete_plan(self):
        plan = EngagementStrategyPlan(**self.make_plan_payload())

        self.assertEqual(plan.engagement_stage, "FIRST_CONTACT")
        self.assertEqual(plan.primary_channel, "email")
        self.assertEqual(plan.confidence, 0.82)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_email_only_and_gemini_selects_email(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.make_plan_payload(primary_channel="email"))

        plan = self.planner.plan(self.make_context(), self.make_channels(email=True))

        self.assertEqual(plan.primary_channel, "email")
        self.assertEqual(plan.secondary_channels, [])
        generate_mock.assert_called_once()

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_phone_and_email_and_gemini_selects_phone(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.make_plan_payload(
                primary_channel="phone",
                secondary_channels=[],
                reasons=["Le telephone est pertinent pour un premier contact direct."],
            )
        )

        plan = self.planner.plan(self.make_context(), self.make_channels(email=True, phone=True))

        self.assertEqual(plan.primary_channel, "phone")

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_secondary_channel_must_be_available(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.make_plan_payload(primary_channel="phone", secondary_channels=["email"])
        )

        plan = self.planner.plan(self.make_context(), self.make_channels(email=True, phone=True))

        self.assertEqual(plan.primary_channel, "phone")
        self.assertEqual(plan.secondary_channels, ["email"])

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_unavailable_instagram_is_corrected_once(self, generate_mock):
        invalid = self.make_plan_payload(primary_channel="instagram")
        corrected = self.make_plan_payload(primary_channel="email")
        generate_mock.side_effect = [self.gemini_response(invalid), self.gemini_response(corrected)]

        plan = self.planner.plan(self.make_context(), self.make_channels(email=True, instagram=False))

        self.assertEqual(plan.primary_channel, "email")
        self.assertEqual(generate_mock.call_count, 2)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_no_channel_does_not_invent_channel(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.make_plan_payload(
                objective="WAIT",
                strategy="WAIT",
                primary_channel=None,
                secondary_channels=[],
                should_wait=True,
                suggested_wait_days=3,
                confidence=0.95,
                reasons=["Aucun moyen de contact exploitable n'est enregistre."],
            )
        )

        plan = self.planner.plan(
            self.make_context(),
            self.make_channels(email=False, phone=False, linkedin=False, facebook=False, instagram=False),
        )

        self.assertIsNone(plan.primary_channel)
        self.assertEqual(plan.secondary_channels, [])
        self.assertTrue(plan.should_wait)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_confidence_above_one_is_invalid_after_correction_attempt(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.make_plan_payload(confidence=1.5))

        with self.assertRaises(EngagementPlanningUnavailable):
            self.planner.plan(self.make_context(), self.make_channels(email=True))

        self.assertEqual(generate_mock.call_count, 2)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_content_fields_are_not_required_or_returned(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.make_plan_payload(primary_channel="email"))

        plan = self.planner.plan(self.make_context(), self.make_channels(email=True))
        encoded = json.dumps(plan.dict())

        self.assertNotIn("email_subject", encoded)
        self.assertNotIn("email_body", encoded)
        self.assertNotIn("call_script", encoded)
        self.assertNotIn("linkedin_message", encoded)

    def test_strategy_prompt_requires_french_text_without_crm_software_assumption(self):
        prompt = self.planner._build_prompt(self.make_context(), self.make_channels(email=True))

        self.assertIn("professional, natural French", prompt)
        self.assertIn("Never assume the target prospect is looking for CRM software", prompt)
        self.assertIn("Keep structured enum fields exactly", prompt)


class EngagementContentGeneratorTests(TestCase):
    def setUp(self):
        self.generator = EngagementContentGenerator(model=object())

    def make_context(self, **contact_overrides):
        contact = {
            "email": "ahmed@example.com",
            "phone": "+21622222222",
            "linkedin_url": "https://linkedin.com/in/ahmed",
            "facebook_url": "https://facebook.com/ahmed",
            "instagram_url": "https://instagram.com/ahmed",
            "website": None,
        }
        contact.update(contact_overrides)
        return {
            "prospect": {
                "first_name": "Ahmed",
                "last_name": "Mansour",
                "full_name": "Ahmed Mansour",
                "job_title": "Sales Manager",
                "lead_origin": "manual",
            },
            "contact": contact,
            "company": {"name": "ABC", "industry": None},
            "crm": {"engagement_status": "new"},
            "history": [],
            "activities": [],
            "tasks": [],
        }

    def make_plan(self, **overrides):
        payload = {
            "situation_summary": "Prospect B2B avec contexte CRM limite.",
            "engagement_stage": "FIRST_CONTACT",
            "prospect_temperature": "COLD",
            "objective": "START_CONVERSATION",
            "strategy": "DIRECT_OUTREACH",
            "primary_channel": "email",
            "secondary_channels": [],
            "confidence": 0.8,
            "reasons": ["Un canal de contact est disponible."],
            "missing_information": ["besoin actuel"],
            "should_wait": False,
            "suggested_wait_days": None,
        }
        payload.update(overrides)
        return EngagementStrategyPlan(**payload)

    def gemini_response(self, payload):
        return SimpleNamespace(text=json.dumps(payload))

    def email_payload(self):
        return {
            "content_required": True,
            "channel": "email",
            "content_type": "email",
            "reason": "Email adapte au premier contact.",
            "email": {
                "subject": "Echange autour de votre organisation commerciale",
                "body": "Bonjour Ahmed,\n\nJe me permets de vous contacter au sujet de votre organisation commerciale chez ABC.\n\nSeriez-vous disponible pour un court echange cette semaine ?",
                "tone": "professional",
                "objective": "start_conversation",
            },
            "call_script": None,
            "social_message": None,
        }

    def call_payload(self):
        return {
            "content_required": True,
            "channel": "phone",
            "content_type": "call_script",
            "reason": "Script adapte a un appel de decouverte.",
            "email": None,
            "call_script": {
                "call_objective": "Comprendre les priorites commerciales actuelles.",
                "opening": "Bonjour Ahmed, je vous appelle rapidement au sujet de votre organisation commerciale.",
                "hook": "Votre role de Sales Manager indique un possible sujet d'organisation commerciale.",
                "discovery_questions": [
                    "Quelles sont vos priorites commerciales ce trimestre ?",
                    "Comment suivez-vous aujourd'hui vos opportunites ?",
                ],
                "value_proposition": "Identifier si un echange plus approfondi peut vous etre utile.",
                "possible_objections": [
                    {
                        "objection": "Je n'ai pas le temps.",
                        "suggested_response": "Je comprends, pouvons-nous fixer un moment plus adapte ?",
                    }
                ],
                "call_to_action": "Proposer un court rendez-vous de qualification.",
                "closing": "Merci pour votre temps, je vous envoie une invitation si cela vous convient.",
            },
            "social_message": None,
        }

    def social_payload(self, channel):
        return {
            "content_required": True,
            "channel": channel,
            "content_type": "social_message",
            "reason": "Message manuel adapte au canal social.",
            "email": None,
            "call_script": None,
            "social_message": {
                "channel": channel,
                "message": "Bonjour Ahmed, je serais ravi d'echanger brievement sur vos priorites commerciales chez ABC.",
                "tone": "professional",
                "objective": "start_conversation",
                "execution_mode": "manual",
            },
        }

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_email_content_generation(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.email_payload())

        content = self.generator.generate(self.make_context(), self.make_plan(primary_channel="email"))

        self.assertTrue(content.content_required)
        self.assertEqual(content.channel, "email")
        self.assertTrue(content.email.subject)
        self.assertTrue(content.email.body)
        self.assertIsNone(content.call_script)
        self.assertIsNone(content.social_message)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_phone_content_generation(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.call_payload())

        content = self.generator.generate(self.make_context(), self.make_plan(primary_channel="phone"))

        self.assertEqual(content.channel, "phone")
        self.assertTrue(content.call_script.opening)
        self.assertTrue(content.call_script.discovery_questions)
        self.assertTrue(content.call_script.call_to_action)
        self.assertIsNone(content.email)
        self.assertIsNone(content.social_message)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_facebook_content_generation_is_manual(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.social_payload("facebook"))

        content = self.generator.generate(self.make_context(), self.make_plan(primary_channel="facebook"))

        self.assertEqual(content.channel, "facebook")
        self.assertEqual(content.social_message.channel, "facebook")
        self.assertEqual(content.social_message.execution_mode, "manual")
        self.assertTrue(content.social_message.message)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_linkedin_content_generation_is_manual(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.social_payload("linkedin"))

        content = self.generator.generate(self.make_context(), self.make_plan(primary_channel="linkedin"))

        self.assertEqual(content.channel, "linkedin")
        self.assertEqual(content.social_message.channel, "linkedin")
        self.assertEqual(content.social_message.execution_mode, "manual")

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_instagram_content_generation_is_manual(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.social_payload("instagram"))

        content = self.generator.generate(self.make_context(), self.make_plan(primary_channel="instagram"))

        self.assertEqual(content.channel, "instagram")
        self.assertEqual(content.social_message.channel, "instagram")
        self.assertEqual(content.social_message.execution_mode, "manual")

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_wait_plan_requires_no_content_and_no_gemini_call(self, generate_mock):
        content = self.generator.generate(
            self.make_context(),
            self.make_plan(strategy="WAIT", objective="WAIT", primary_channel=None, should_wait=True),
        )

        self.assertFalse(content.content_required)
        self.assertEqual(content.reason, "Strategy is WAIT")
        generate_mock.assert_not_called()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_stop_engagement_requires_no_content_and_no_gemini_call(self, generate_mock):
        content = self.generator.generate(
            self.make_context(),
            self.make_plan(strategy="STOP_ENGAGEMENT", primary_channel=None),
        )

        self.assertFalse(content.content_required)
        self.assertEqual(content.reason, "Strategy is STOP_ENGAGEMENT")
        generate_mock.assert_not_called()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_channel_mismatch_refuses_generation(self, generate_mock):
        context = self.make_context(phone=None)

        with self.assertRaises(EngagementContentGenerationUnavailable):
            self.generator.generate(context, self.make_plan(primary_channel="phone"))

        generate_mock.assert_not_called()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_prompt_uses_minimal_context_without_python_invented_data(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.email_payload())
        context = self.make_context(
            phone=None,
            linkedin_url=None,
            facebook_url=None,
            instagram_url=None,
        )
        context["prospect"] = {"first_name": "Ahmed", "full_name": "Ahmed"}
        context["company"] = {"name": "ABC"}

        self.generator.generate(context, self.make_plan(primary_channel="email"))

        prompt = generate_mock.call_args.args[1]
        self.assertIn("Ahmed", prompt)
        self.assertIn("ABC", prompt)
        self.assertIn("Do not invent", prompt)
        self.assertNotIn("Salesforce", prompt)
        self.assertNotIn("recent post", json.dumps(context))
        self.assertNotIn("budget", json.dumps(context))

    def test_content_prompt_requires_french_and_generic_industry_positioning(self):
        context = self.make_context()
        context["prospect"] = {"first_name": "", "last_name": "", "full_name": ""}
        prompt = self.generator._build_prompt(
            context=context,
            plan=self.make_plan(primary_channel="email"),
        )

        self.assertIn("Generate all user-facing sales content in French", prompt)
        self.assertIn("Bonjour,", prompt)
        self.assertIn("Never assume the target prospect is looking for CRM software", prompt)
        self.assertIn("priorities", prompt)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_result_is_json_serializable(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.email_payload())

        content = self.generator.generate(self.make_context(), self.make_plan(primary_channel="email"))
        encoded = json.dumps(content.dict())

        self.assertIn("email", encoded)
        self.assertIsInstance(GeneratedEngagementContent(**content.dict()), GeneratedEngagementContent)


class EngagementInteractionRecordingTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="interaction-owner@example.com",
            username="interaction-owner",
            password="pass",
            role="COMMERCIAL",
        )
        self.company = Company.objects.create(owner=self.owner, name="Interaction CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.prospect = Prospect.objects.create(
            first_name="Ahmed",
            last_name="Interaction",
            email="ahmed@example.com",
            phone="+21622222222",
            company=self.company,
            assigned_to=self.owner,
        )
        self.factory = APIRequestFactory()

    def test_interaction_options_api_exposes_backend_enums(self):
        request = self.factory.get("/api/engagement/interactions/options/")
        force_authenticate(request, user=self.owner)

        response = EngagementInteractionOptionsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertIn("EMAIL", response.data["channels"])
        self.assertIn("PHONE_CALL", response.data["action_types"])
        self.assertIn("UNSUBSCRIBE", response.data["outcomes"])

    def post_interaction(self, payload, user=None, prospect_id=None):
        request = self.factory.post(
            f"/api/engagement/prospects/{prospect_id or self.prospect.id}/interactions/",
            payload,
            format="json",
        )
        force_authenticate(request, user=user or self.owner)
        return ProspectInteractionsView.as_view()(request, prospect_id=prospect_id or self.prospect.id)

    def test_create_phone_interaction(self):
        response = self.post_interaction(
            {
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "INTERESTED",
                "prospect_response": "Envoyez-moi une presentation.",
                "commercial_notes": "Disponible la semaine prochaine.",
            }
        )

        self.assertEqual(response.status_code, 201)
        interaction = response.data["interaction"]
        self.assertEqual(interaction["channel"], "PHONE")
        self.assertEqual(interaction["action_type"], "PHONE_CALL")
        self.assertEqual(interaction["outcome"], "INTERESTED")
        self.assertEqual(ProspectActivity.objects.count(), 1)
        self.assertTrue(HistoryLog.objects.filter(entity_id=self.prospect.id, entity_type="prospect").exists())

    def test_create_email_interaction(self):
        response = self.post_interaction(
            {
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "SENT",
            }
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["interaction"]["channel"], "EMAIL")
        self.assertEqual(response.data["interaction"]["outcome"], "SENT")

    def test_sent_message_and_prospect_response_are_separate_conversation_items(self):
        sent_message = "Bonjour Ahmed, souhaitez-vous echanger demain ?"
        prospect_reply = "Oui, on peut discuter demain."
        self.post_interaction(
            {
                "channel": "LINKEDIN",
                "action_type": "SOCIAL_MESSAGE_SENT",
                "outcome": "INTERESTED",
                "generated_content_reference": sent_message,
                "prospect_response": prospect_reply,
            }
        )
        request = self.factory.get(f"/api/engagement/prospects/{self.prospect.id}/logs/")
        force_authenticate(request, user=self.owner)

        response = ProspectLogsView.as_view()(request, prospect_id=self.prospect.id)
        conversation = response.data["conversation"]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(conversation), 2)
        self.assertEqual(conversation[0]["actor"], "commercial")
        self.assertEqual(conversation[0]["text"], sent_message)
        self.assertEqual(conversation[1]["actor"], "prospect")
        self.assertEqual(conversation[1]["text"], prospect_reply)

    @patch("agentEngagement.views.EngagementInitialFlowService")
    def test_initial_agent_generation_is_persisted_in_conversation(self, service_mock):
        message = "Bonjour Ahmed, je vous propose un court echange cette semaine."
        service_mock.return_value.run.return_value = {
            "available_channels": {"linkedin": {"available": True}},
            "plan": SimpleNamespace(
                primary_channel="linkedin",
                model_dump=lambda: {
                    "primary_channel": "linkedin",
                    "strategy": "DIRECT_OUTREACH",
                },
            ),
            "policy": SimpleNamespace(
                allowed=True,
                status="ALLOWED",
                model_dump=lambda: {"allowed": True, "status": "ALLOWED"},
            ),
            "content": GeneratedEngagementContent(
                content_required=True,
                channel="linkedin",
                content_type="social_message",
                social_message={
                    "channel": "linkedin",
                    "message": message,
                    "tone": "professional",
                    "objective": "start_conversation",
                    "execution_mode": "manual",
                },
            ),
            "agent_trace": [],
        }
        request = self.factory.post(f"/api/engagement/prospects/{self.prospect.id}/initial-plan/")
        force_authenticate(request, user=self.owner)

        response = ProspectInitialEngagementPlanView.as_view()(request, prospect_id=self.prospect.id)
        self.prospect.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.prospect.generated_message, message)
        self.assertEqual(self.prospect.engagement_status, "message_ready")
        self.assertTrue(
            EngagementLog.objects.filter(
                prospect=self.prospect,
                action="message_generated",
                message=message,
            ).exists()
        )

    def test_create_facebook_manual_interaction(self):
        response = self.post_interaction(
            {
                "channel": "FACEBOOK",
                "action_type": "SOCIAL_MESSAGE_SENT",
                "outcome": "SENT",
            }
        )

        self.assertEqual(response.status_code, 201)
        activity = ProspectActivity.objects.get()
        self.assertEqual(activity.channel, "facebook")
        self.assertEqual(activity.metadata["action_type"], "SOCIAL_MESSAGE_SENT")

    def test_prospect_not_found_or_forbidden(self):
        response = self.post_interaction(
            {
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "SENT",
            },
            prospect_id=999999,
        )

        self.assertEqual(response.status_code, 403)

    def test_invalid_channel_enum_is_rejected(self):
        response = self.post_interaction(
            {
                "channel": "WHATSAPP",
                "action_type": "SOCIAL_MESSAGE_SENT",
                "outcome": "SENT",
            }
        )

        self.assertEqual(response.status_code, 400)

    def test_invalid_outcome_enum_is_rejected(self):
        response = self.post_interaction(
            {
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "VERY_HAPPY",
            }
        )

        self.assertEqual(response.status_code, 400)

    def test_no_response_without_text_is_valid(self):
        response = self.post_interaction(
            {
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "NO_RESPONSE",
                "prospect_response": "",
                "commercial_notes": "",
            }
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["interaction"]["outcome"], "NO_RESPONSE")
        self.assertEqual(response.data["interaction"]["prospect_response"], "")

    def test_interested_with_response_text_is_recorded(self):
        response_text = "Nous utilisons Salesforce, envoyez-moi une presentation."

        response = self.post_interaction(
            {
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "INTERESTED",
                "prospect_response": response_text,
            }
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["interaction"]["prospect_response"], response_text)
        self.assertEqual(ProspectActivity.objects.get().metadata["prospect_response"], response_text)

    def test_interaction_appears_in_context_builder(self):
        self.post_interaction(
            {
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "INTERESTED",
                "prospect_response": "Envoyez-moi une presentation.",
                "commercial_notes": "Prospect decisionnaire.",
            }
        )

        context = ProspectEngagementContextBuilder().build(self.prospect)
        interaction = next(
            item
            for item in context["activities"]
            if (item.get("metadata") or {}).get("kind") == "engagement_interaction"
        )

        self.assertEqual(interaction["metadata"]["outcome"], "INTERESTED")
        self.assertEqual(interaction["metadata"]["prospect_response"], "Envoyez-moi une presentation.")
        self.assertEqual(interaction["metadata"]["commercial_notes"], "Prospect decisionnaire.")

    def test_user_without_permission_is_refused(self):
        other_user = User.objects.create_user(
            email="interaction-other@example.com",
            username="interaction-other",
            password="pass",
            role="COMMERCIAL",
        )
        other_company = Company.objects.create(owner=other_user, name="Other CRM")
        other_user.company = other_company
        other_user.save(update_fields=["company"])

        response = self.post_interaction(
            {
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "SENT",
            },
            user=other_user,
        )

        self.assertEqual(response.status_code, 403)

    def test_get_interactions_returns_json_api(self):
        self.post_interaction(
            {
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "SENT",
            }
        )
        request = self.factory.get(f"/api/engagement/prospects/{self.prospect.id}/interactions/")
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionsView.as_view()(request, prospect_id=self.prospect.id)
        encoded = json.dumps(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["interactions"][0]["channel"], "EMAIL")
        self.assertIn("created_at", encoded)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    def test_recording_interaction_triggers_no_gemini_call(self, content_generate_mock, planner_generate_mock):
        response = self.post_interaction(
            {
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "SENT",
            }
        )

        self.assertEqual(response.status_code, 201)
        content_generate_mock.assert_not_called()
        planner_generate_mock.assert_not_called()

    def test_idempotency_key_prevents_duplicate_creation(self):
        payload = {
            "channel": "EMAIL",
            "action_type": "EMAIL_SENT",
            "outcome": "SENT",
            "idempotency_key": "email-sent-1",
        }

        first = self.post_interaction(payload)
        second = self.post_interaction(payload)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.data["created"])
        self.assertEqual(ProspectActivity.objects.count(), 1)


class ProspectResponseAnalyzerTests(TestCase):
    def setUp(self):
        self.analyzer = ProspectResponseAnalyzer(model=object())
        self.owner = User.objects.create_user(
            email="analysis-owner@example.com",
            username="analysis-owner",
            password="pass",
            role="COMMERCIAL",
        )
        self.company = Company.objects.create(owner=self.owner, name="Analysis CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.prospect = Prospect.objects.create(
            first_name="Sarah",
            last_name="Analysis",
            email="sarah@example.com",
            phone="+21622222222",
            company=self.company,
            assigned_to=self.owner,
            engagement_status="waiting_reply",
            evaluation="warm",
        )
        self.factory = APIRequestFactory()

    def make_context(self):
        return ProspectEngagementContextBuilder().build(self.prospect)

    def make_interaction(self, **overrides):
        payload = {
            "id": 1,
            "prospect_id": self.prospect.id,
            "user_id": self.owner.id,
            "channel": "PHONE",
            "action_type": "PHONE_CALL",
            "outcome": "INTERESTED",
            "prospect_response": "Envoyez-moi vos tarifs.",
            "commercial_notes": "",
            "status": "recorded",
        }
        payload.update(overrides)
        return payload

    def gemini_response(self, payload):
        return SimpleNamespace(text=json.dumps(payload))

    def analysis_payload(self, **overrides):
        payload = {
            "intent": "INFORMATION_REQUEST",
            "sentiment": "NEUTRAL",
            "interest_level": "MEDIUM",
            "objections": [],
            "requests": ["presentation"],
            "pain_points": [],
            "buying_signals": ["requests_follow_up"],
            "current_solution": None,
            "timing": None,
            "decision_role_signal": None,
            "explicit_facts": [],
            "inferred_signals": ["The prospect shows continued interest."],
            "unknown_information": ["budget", "decision_timeline"],
            "recommended_direction": "SEND_INFORMATION",
            "confidence": 0.86,
            "summary": "The prospect requested information.",
        }
        payload.update(overrides)
        return payload

    def test_response_analyzer_prompt_requires_french_text_without_crm_software_assumption(self):
        prompt = self.analyzer._build_prompt(self.make_context(), self.make_interaction())

        self.assertIn("professional, natural French", prompt)
        self.assertIn("Never assume the target prospect is looking for CRM software", prompt)
        self.assertIn("Keep structured enum fields exactly", prompt)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_pricing_request(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="PRICING_REQUEST",
                sentiment="POSITIVE",
                interest_level="HIGH",
                requests=["pricing"],
                buying_signals=["asks_for_pricing"],
                summary="The prospect requests pricing information.",
            )
        )

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction(prospect_response="Envoyez-moi vos tarifs."))

        self.assertEqual(analysis.intent, "PRICING_REQUEST")
        self.assertEqual(analysis.interest_level, "HIGH")
        self.assertIn("pricing", analysis.requests)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_price_objection(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="OBJECTION",
                sentiment="NEGATIVE",
                interest_level="MEDIUM",
                objections=[
                    {
                        "type": "PRICE",
                        "original_text": "C'est trop cher.",
                        "confidence": 0.94,
                    }
                ],
                recommended_direction="HANDLE_OBJECTION",
                summary="The prospect raised a price objection.",
            )
        )

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction(prospect_response="C'est trop cher."))

        self.assertEqual(analysis.intent, "OBJECTION")
        self.assertEqual(analysis.objections[0].type, "PRICE")

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_current_solution_is_explicit_fact(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="OBJECTION",
                current_solution="Salesforce",
                objections=[
                    {
                        "type": "ALREADY_HAVE_SOLUTION",
                        "original_text": "Nous utilisons deja Salesforce.",
                        "confidence": 0.91,
                    }
                ],
                explicit_facts=[
                    {
                        "key": "current_solution",
                        "value": "Salesforce",
                        "source": "PROSPECT_RESPONSE",
                        "confidence": 0.99,
                    }
                ],
            )
        )

        analysis = self.analyzer.analyze(
            self.make_context(),
            self.make_interaction(prospect_response="Nous utilisons deja Salesforce."),
        )

        self.assertEqual(analysis.current_solution, "Salesforce")
        self.assertEqual(analysis.explicit_facts[0].source, "PROSPECT_RESPONSE")

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_callback_timing(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="CALL_LATER",
                sentiment="NEUTRAL",
                interest_level="UNKNOWN",
                requests=["callback"],
                timing="octobre",
                recommended_direction="WAIT",
            )
        )

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction(prospect_response="Rappelez-moi en octobre."))

        self.assertEqual(analysis.intent, "CALL_LATER")
        self.assertEqual(analysis.timing, "octobre")
        self.assertEqual(analysis.recommended_direction, "WAIT")

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_unsubscribe(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="UNSUBSCRIBE",
                sentiment="NEGATIVE",
                interest_level="LOW",
                recommended_direction="STOP",
                summary="The prospect asked not to be contacted again.",
            )
        )

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction(outcome="UNSUBSCRIBE", prospect_response="Ne me contactez plus."))

        self.assertEqual(analysis.intent, "UNSUBSCRIBE")
        self.assertEqual(analysis.recommended_direction, "STOP")

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_wrong_contact(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="WRONG_CONTACT",
                sentiment="NEUTRAL",
                interest_level="LOW",
                recommended_direction="MANUAL_REVIEW",
            )
        )

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction(prospect_response="Je ne suis pas la bonne personne."))

        self.assertEqual(analysis.intent, "WRONG_CONTACT")

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_manager_approval_objection(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="OBJECTION",
                objections=[
                    {
                        "type": "NEED_MANAGER_APPROVAL",
                        "original_text": "Je dois en parler a mon directeur.",
                        "confidence": 0.9,
                    }
                ],
                decision_role_signal="Needs manager approval",
                recommended_direction="FOLLOW_UP",
            )
        )

        analysis = self.analyzer.analyze(
            self.make_context(),
            self.make_interaction(prospect_response="Je dois en parler a mon directeur."),
        )

        self.assertEqual(analysis.objections[0].type, "NEED_MANAGER_APPROVAL")

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_ambiguous_response_can_be_unknown(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.analysis_payload(
                intent="UNKNOWN",
                sentiment="UNKNOWN",
                interest_level="UNKNOWN",
                requests=[],
                buying_signals=[],
                confidence=0.42,
                summary="The response is too ambiguous to classify confidently.",
            )
        )

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction(prospect_response="OK."))

        self.assertEqual(analysis.intent, "UNKNOWN")
        self.assertLess(analysis.confidence, 0.5)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_no_response_without_text_skips_gemini(self, generate_mock):
        analysis = self.analyzer.analyze(
            self.make_context(),
            self.make_interaction(outcome="NO_RESPONSE", prospect_response="", commercial_notes=""),
        )

        self.assertEqual(analysis.intent, "NO_RESPONSE")
        self.assertEqual(analysis.sentiment, "UNKNOWN")
        self.assertEqual(analysis.interest_level, "UNKNOWN")
        generate_mock.assert_not_called()

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_invalid_schema_raises_controlled_error_after_correction(self, generate_mock):
        generate_mock.return_value = self.gemini_response({"intent": "INTERESTED"})

        with self.assertRaises(ProspectResponseAnalysisUnavailable):
            self.analyzer.analyze(self.make_context(), self.make_interaction())

        self.assertEqual(generate_mock.call_count, 2)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_invalid_confidence_raises_controlled_error_after_correction(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.analysis_payload(confidence=1.4))

        with self.assertRaises(ProspectResponseAnalysisUnavailable):
            self.analyzer.analyze(self.make_context(), self.make_interaction())

        self.assertEqual(generate_mock.call_count, 2)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_analysis_is_json_serializable(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.analysis_payload())

        analysis = self.analyzer.analyze(self.make_context(), self.make_interaction())
        encoded = json.dumps(analysis.dict())

        self.assertIn("recommended_direction", encoded)
        self.assertIsInstance(ProspectResponseAnalysis(**analysis.dict()), ProspectResponseAnalysis)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_analyzer_does_not_mutate_strategy_score_or_status(self, generate_mock):
        generate_mock.return_value = self.gemini_response(self.analysis_payload())
        before_status = self.prospect.engagement_status
        before_evaluation = self.prospect.evaluation

        self.analyzer.analyze(self.make_context(), self.make_interaction())
        self.prospect.refresh_from_db()

        self.assertEqual(self.prospect.engagement_status, before_status)
        self.assertEqual(self.prospect.evaluation, before_evaluation)


class EngagementMemoryManagerTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="memory-owner@example.com",
            username="memory-owner",
            password="pass",
            role="COMMERCIAL",
        )
        self.company = Company.objects.create(owner=self.owner, name="Memory CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.prospect = Prospect.objects.create(
            first_name="Maya",
            last_name="Memory",
            email="maya@example.com",
            company=self.company,
            assigned_to=self.owner,
            engagement_status="waiting_reply",
            evaluation="warm",
        )
        self.manager = EngagementMemoryManager()
        self.factory = APIRequestFactory()

    def interaction(self, **overrides):
        payload = {
            "id": 101,
            "channel": "PHONE",
            "outcome": "INTERESTED",
            "strategy_reference": {"strategy": "DISCOVERY", "objective": "QUALIFY_NEED"},
        }
        payload.update(overrides)
        return payload

    def analysis(self, **overrides):
        payload = {
            "intent": "INFORMATION_REQUEST",
            "sentiment": "POSITIVE",
            "interest_level": "HIGH",
            "objections": [],
            "requests": [],
            "pain_points": [],
            "buying_signals": [],
            "current_solution": None,
            "timing": None,
            "decision_role_signal": None,
            "explicit_facts": [],
            "inferred_signals": [],
            "unknown_information": ["budget"],
            "recommended_direction": "SEND_INFORMATION",
            "confidence": 0.88,
            "summary": "The relationship has useful new information.",
        }
        payload.update(overrides)
        return ProspectResponseAnalysis(**payload)

    def analysis_payload(self, **overrides):
        payload = self.analysis(**overrides)
        if hasattr(payload, "model_dump"):
            return payload.model_dump()
        return payload.dict()

    def gemini_response(self, payload):
        return SimpleNamespace(text=json.dumps(payload))

    def test_current_solution_from_explicit_analysis(self):
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=1),
            self.analysis(
                current_solution="Salesforce",
                explicit_facts=[
                    {
                        "key": "current_solution",
                        "value": "Salesforce",
                        "source": "PROSPECT_RESPONSE",
                        "confidence": 0.99,
                    }
                ],
            ),
        )

        self.assertEqual(memory.current_solution, "Salesforce")
        self.assertEqual(memory.confirmed_facts[0]["source_interaction_id"], 1)
        self.assertEqual(memory.confirmed_facts[0]["source"], "PROSPECT_RESPONSE")

    def test_objections_are_merged_without_duplicates(self):
        self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=1),
            self.analysis(
                objections=[
                    {"type": "PRICE", "original_text": "C'est trop cher.", "confidence": 0.95},
                ]
            ),
        )
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=2),
            self.analysis(
                objections=[
                    {"type": "PRICE", "original_text": "Encore trop cher.", "confidence": 0.9},
                    {"type": "NOT_PRIORITY", "original_text": "Ce n'est pas prioritaire.", "confidence": 0.86},
                ]
            ),
        )

        self.assertEqual(memory.known_objections, ["PRICE", "NOT_PRIORITY"])

    def test_requests_are_merged(self):
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(),
            self.analysis(requests=["presentation", "pricing", "presentation"]),
        )

        self.assertEqual(memory.known_requests, ["presentation", "pricing"])

    def test_pain_points_are_preserved(self):
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(),
            self.analysis(pain_points=["manual_prospecting"]),
        )

        self.assertEqual(memory.known_pain_points, ["manual_prospecting"])

    def test_new_explicit_current_solution_replaces_old_value(self):
        self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=1),
            self.analysis(current_solution="Salesforce"),
        )
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=2),
            self.analysis(
                current_solution="HubSpot",
                explicit_facts=[
                    {
                        "key": "current_solution",
                        "value": "HubSpot",
                        "source": "PROSPECT_RESPONSE",
                        "confidence": 0.98,
                    }
                ],
            ),
        )

        self.assertEqual(memory.current_solution, "HubSpot")

    def test_missing_new_information_does_not_clear_memory(self):
        self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=1),
            self.analysis(current_solution="Salesforce", timing="octobre"),
        )
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(id=2),
            self.analysis(current_solution=None, timing=None, requests=[]),
        )

        self.assertEqual(memory.current_solution, "Salesforce")
        self.assertEqual(memory.timing, "octobre")

    def test_applying_same_analysis_twice_is_idempotent(self):
        analysis = self.analysis(
            requests=["presentation"],
            pain_points=["manual_prospecting"],
            objections=[{"type": "PRICE", "original_text": "Trop cher.", "confidence": 0.95}],
            explicit_facts=[
                {
                    "key": "current_solution",
                    "value": "Salesforce",
                    "source": "PROSPECT_RESPONSE",
                    "confidence": 0.99,
                }
            ],
        )

        self.manager.update_from_analysis(self.prospect, self.interaction(id=7), analysis)
        memory = self.manager.update_from_analysis(self.prospect, self.interaction(id=7), analysis)

        self.assertEqual(memory.known_requests, ["presentation"])
        self.assertEqual(memory.known_pain_points, ["manual_prospecting"])
        self.assertEqual(memory.known_objections, ["PRICE"])
        self.assertEqual(len(memory.confirmed_facts), 1)

    def test_memory_tracks_last_interaction_and_direction(self):
        memory = self.manager.update_from_analysis(
            self.prospect,
            self.interaction(channel="EMAIL", outcome="SENT"),
            self.analysis(recommended_direction="FOLLOW_UP", confidence=0.67),
        )

        self.assertEqual(memory.last_interaction_channel, "EMAIL")
        self.assertEqual(memory.last_interaction_outcome, "SENT")
        self.assertEqual(memory.last_strategy, "DISCOVERY")
        self.assertEqual(memory.last_objective, "QUALIFY_NEED")
        self.assertEqual(memory.next_direction, "FOLLOW_UP")
        self.assertEqual(memory.last_analysis_confidence, 0.67)

    def test_context_builder_returns_engagement_memory(self):
        self.manager.update_from_analysis(
            self.prospect,
            self.interaction(),
            self.analysis(
                current_solution="Salesforce",
                requests=["presentation"],
                objections=[{"type": "PRICE", "original_text": "Trop cher.", "confidence": 0.9}],
            ),
        )

        context = ProspectEngagementContextBuilder().build(self.prospect)

        self.assertEqual(context["engagement_memory"]["current_solution"], "Salesforce")
        self.assertEqual(context["engagement_memory"]["known_objections"], ["PRICE"])
        self.assertEqual(context["engagement_memory"]["known_requests"], ["presentation"])
        json.dumps(context["engagement_memory"])

    def test_memory_update_does_not_mutate_prospect_score_or_status(self):
        before_status = self.prospect.engagement_status
        before_evaluation = self.prospect.evaluation

        self.manager.update_from_analysis(
            self.prospect,
            self.interaction(),
            self.analysis(interest_level="VERY_HIGH"),
        )
        self.prospect.refresh_from_db()

        self.assertEqual(self.prospect.engagement_status, before_status)
        self.assertEqual(self.prospect.evaluation, before_evaluation)

    def create_recorded_interaction(self, prospect=None):
        prospect = prospect or self.prospect
        activity = ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="call_done",
            channel="phone",
            title="Phone Call - Interested",
            description="Prospect response: Envoyez-moi vos tarifs.",
            source="manual",
            created_by=self.owner,
            metadata={
                "kind": "engagement_interaction",
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "INTERESTED",
                "prospect_response": "Envoyez-moi vos tarifs.",
                "commercial_notes": "",
                "status": "recorded",
            },
        )
        return activity

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_api_analyzes_valid_interaction(self, generate_mock):
        activity = self.create_recorded_interaction()
        generate_mock.return_value = self.gemini_response(self.analysis_payload(intent="PRICING_REQUEST", requests=["pricing"]))
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{activity.id}/analyze/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionAnalysisView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=activity.id,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["analysis"]["intent"], "PRICING_REQUEST")
        self.assertEqual(response.data["engagement_memory"]["known_requests"], ["pricing"])

    def test_api_missing_interaction_returns_404(self):
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/999999/analyze/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionAnalysisView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=999999,
        )

        self.assertEqual(response.status_code, 404)

    def test_api_missing_or_forbidden_prospect_returns_403(self):
        request = self.factory.post("/api/engagement/prospects/999999/interactions/1/analyze/", {}, format="json")
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionAnalysisView.as_view()(request, prospect_id=999999, interaction_id=1)

        self.assertEqual(response.status_code, 403)

    def test_api_permission_denied(self):
        activity = self.create_recorded_interaction()
        other_user = User.objects.create_user(
            email="analysis-other@example.com",
            username="analysis-other",
            password="pass",
            role="COMMERCIAL",
        )
        other_company = Company.objects.create(owner=other_user, name="Other Analysis")
        other_user.company = other_company
        other_user.save(update_fields=["company"])
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{activity.id}/analyze/",
            {},
            format="json",
        )
        force_authenticate(request, user=other_user)

        response = ProspectInteractionAnalysisView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=activity.id,
        )

        self.assertEqual(response.status_code, 403)

    def test_api_cannot_analyze_interaction_from_another_prospect(self):
        other_prospect = Prospect.objects.create(
            first_name="Other",
            last_name="Prospect",
            company=self.company,
            assigned_to=self.owner,
        )
        activity = self.create_recorded_interaction(prospect=other_prospect)
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{activity.id}/analyze/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionAnalysisView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=activity.id,
        )

        self.assertEqual(response.status_code, 404)

    @patch("agentEngagement.agent.response_analyzer.generate_with_retry")
    def test_api_returns_json_analysis_without_status_or_score_mutation(self, generate_mock):
        activity = self.create_recorded_interaction()
        generate_mock.return_value = self.gemini_response(self.analysis_payload())
        before_status = self.prospect.engagement_status
        before_evaluation = self.prospect.evaluation
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{activity.id}/analyze/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionAnalysisView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=activity.id,
        )
        self.prospect.refresh_from_db()
        encoded = json.dumps(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertIn("analysis", encoded)
        self.assertEqual(self.prospect.engagement_status, before_status)
        self.assertEqual(self.prospect.evaluation, before_evaluation)


class EngagementReplanningServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="replan-owner@example.com",
            username="replan-owner",
            password="pass",
            role="COMMERCIAL",
        )
        self.company = Company.objects.create(owner=self.owner, name="Replan CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.prospect = Prospect.objects.create(
            first_name="Yasmine",
            last_name="Replan",
            email="yasmine@example.com",
            phone="+21622222222",
            company=self.company,
            assigned_to=self.owner,
            engagement_status="waiting_reply",
            evaluation="warm",
        )
        self.factory = APIRequestFactory()
        self.service = EngagementReplanningService()

    def plan_payload(self, **overrides):
        payload = {
            "situation_summary": "Updated context after prospect response.",
            "engagement_stage": "OBJECTION",
            "prospect_temperature": "WARM",
            "objective": "HANDLE_OBJECTION",
            "strategy": "OBJECTION_HANDLING",
            "primary_channel": "phone",
            "secondary_channels": ["email"],
            "confidence": 0.91,
            "reasons": ["The memory contains a price objection."],
            "missing_information": ["budget"],
            "should_wait": False,
            "suggested_wait_days": None,
        }
        payload.update(overrides)
        return payload

    def gemini_response(self, payload):
        return SimpleNamespace(text=json.dumps(payload))

    def create_memory(self, **overrides):
        defaults = {
            "interest_level": "HIGH",
            "known_objections": ["PRICE"],
            "known_requests": [],
            "current_solution": None,
            "next_direction": "HANDLE_OBJECTION",
            "last_interaction_channel": "PHONE",
            "last_interaction_outcome": "OBJECTION",
        }
        defaults.update(overrides)
        return ProspectEngagementMemory.objects.create(prospect=self.prospect, **defaults)

    def create_interaction(self, prospect=None):
        prospect = prospect or self.prospect
        return ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="call_done",
            channel="phone",
            title="Phone Call - Objection",
            description="Prospect response: The price is high.",
            source="manual",
            created_by=self.owner,
            metadata={
                "kind": "engagement_interaction",
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "OBJECTION",
                "prospect_response": "The price is high.",
                "commercial_notes": "",
                "status": "recorded",
            },
        )

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_price_objection_context_contains_memory(self, generate_mock):
        self.create_memory(known_objections=["PRICE"], interest_level="HIGH")
        generate_mock.return_value = self.gemini_response(self.plan_payload(strategy="OBJECTION_HANDLING"))

        result = self.service.replan(self.prospect, self.owner)

        self.assertEqual(result["plan"].strategy, "OBJECTION_HANDLING")
        prompt = generate_mock.call_args.args[1]
        self.assertIn("engagement_memory", prompt)
        self.assertIn("PRICE", prompt)
        self.assertIn("confirmed_facts", prompt)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_presentation_request(self, generate_mock):
        self.create_memory(known_requests=["presentation"], interest_level="HIGH", next_direction="SEND_INFORMATION")
        generate_mock.return_value = self.gemini_response(
            self.plan_payload(
                engagement_stage="FOLLOW_UP",
                objective="PROVIDE_INFORMATION",
                strategy="VALUE_FIRST",
                primary_channel="email",
                secondary_channels=[],
            )
        )

        result = self.service.replan(self.prospect, self.owner)

        self.assertEqual(result["plan"].strategy, "VALUE_FIRST")
        self.assertEqual(result["plan"].primary_channel, "email")

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_wait_with_timing(self, generate_mock):
        self.create_memory(timing="October", next_direction="WAIT", known_objections=[])
        generate_mock.return_value = self.gemini_response(
            self.plan_payload(
                engagement_stage="NURTURING",
                objective="NURTURE",
                strategy="NURTURING",
                primary_channel=None,
                secondary_channels=[],
                should_wait=True,
                suggested_wait_days=30,
            )
        )

        result = self.service.replan(self.prospect, self.owner)

        self.assertTrue(result["plan"].should_wait)
        self.assertIsNone(result["plan"].primary_channel)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_unsubscribe_stop(self, generate_mock):
        self.create_memory(next_direction="STOP", known_objections=[], interest_level="LOW")
        generate_mock.return_value = self.gemini_response(
            self.plan_payload(
                engagement_stage="NOT_INTERESTED",
                objective="WAIT",
                strategy="STOP_ENGAGEMENT",
                primary_channel=None,
                secondary_channels=[],
                should_wait=False,
            )
        )

        result = self.service.replan(self.prospect, self.owner)

        self.assertEqual(result["plan"].strategy, "STOP_ENGAGEMENT")
        self.assertIsNone(result["plan"].primary_channel)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_invalid_channel_uses_strategy_planner_validation(self, generate_mock):
        self.create_memory()
        generate_mock.return_value = self.gemini_response(
            self.plan_payload(primary_channel="linkedin", secondary_channels=[])
        )

        with self.assertRaises(Exception):
            self.service.replan(self.prospect, self.owner)

        self.assertEqual(generate_mock.call_count, 2)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_context_contains_history_and_memory(self, generate_mock):
        self.create_memory(known_objections=["PRICE"])
        HistoryLog.objects.create(
            actor=self.owner,
            actor_type="user",
            actor_name="Replan Owner",
            performed_by=self.owner,
            action="comment",
            entity_type="prospect",
            entity_id=self.prospect.id,
            description="Previous interaction note",
            company=self.company,
        )
        generate_mock.return_value = self.gemini_response(self.plan_payload())

        self.service.replan(self.prospect, self.owner)

        prompt = generate_mock.call_args.args[1]
        self.assertIn("engagement_memory", prompt)
        self.assertIn("Previous interaction note", prompt)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_without_memory_still_works(self, generate_mock):
        generate_mock.return_value = self.gemini_response(
            self.plan_payload(
                engagement_stage="FIRST_CONTACT",
                objective="START_CONVERSATION",
                strategy="DIRECT_OUTREACH",
                primary_channel="email",
                secondary_channels=[],
            )
        )

        result = self.service.replan(self.prospect, self.owner)

        self.assertEqual(result["context"]["engagement_memory"], None)
        self.assertEqual(result["plan"].strategy, "DIRECT_OUTREACH")

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_is_idempotent_for_history_and_activities(self, generate_mock):
        self.create_memory()
        generate_mock.return_value = self.gemini_response(self.plan_payload())
        before_activities = ProspectActivity.objects.count()
        before_history = HistoryLog.objects.count()

        self.service.replan(self.prospect, self.owner)
        self.service.replan(self.prospect, self.owner)

        self.assertEqual(ProspectActivity.objects.count(), before_activities)
        self.assertEqual(HistoryLog.objects.count(), before_history)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_does_not_mutate_prospect_score_or_status(self, generate_mock):
        self.create_memory()
        generate_mock.return_value = self.gemini_response(self.plan_payload())
        before_status = self.prospect.engagement_status
        before_evaluation = self.prospect.evaluation

        self.service.replan(self.prospect, self.owner)
        self.prospect.refresh_from_db()

        self.assertEqual(self.prospect.engagement_status, before_status)
        self.assertEqual(self.prospect.evaluation, before_evaluation)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_updates_memory_last_strategy_and_objective_only(self, generate_mock):
        self.create_memory(last_strategy="DIRECT_OUTREACH", last_objective="START_CONVERSATION")
        generate_mock.return_value = self.gemini_response(
            self.plan_payload(strategy="OBJECTION_HANDLING", objective="HANDLE_OBJECTION")
        )

        self.service.replan(self.prospect, self.owner)
        memory = ProspectEngagementMemory.objects.get(prospect=self.prospect)

        self.assertEqual(memory.last_strategy, "OBJECTION_HANDLING")
        self.assertEqual(memory.last_objective, "HANDLE_OBJECTION")
        self.assertIsNone(memory.preferred_channel)

    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_replan_api_returns_new_plan(self, generate_mock):
        self.create_memory(known_objections=["PRICE"])
        interaction = self.create_interaction()
        generate_mock.return_value = self.gemini_response(self.plan_payload(strategy="OBJECTION_HANDLING"))
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{interaction.id}/replan/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionReplanView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=interaction.id,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["plan"]["strategy"], "OBJECTION_HANDLING")
        self.assertIn("available_channels", response.data)

    def test_replan_api_missing_interaction_returns_404(self):
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/999999/replan/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionReplanView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=999999,
        )

        self.assertEqual(response.status_code, 404)

    def test_replan_api_permission_denied(self):
        interaction = self.create_interaction()
        other_user = User.objects.create_user(
            email="replan-other@example.com",
            username="replan-other",
            password="pass",
            role="COMMERCIAL",
        )
        other_company = Company.objects.create(owner=other_user, name="Other Replan")
        other_user.company = other_company
        other_user.save(update_fields=["company"])
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{interaction.id}/replan/",
            {},
            format="json",
        )
        force_authenticate(request, user=other_user)

        response = ProspectInteractionReplanView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=interaction.id,
        )

        self.assertEqual(response.status_code, 403)


class EngagementPolicyEngineTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="policy-owner@example.com",
            username="policy-owner",
            password="pass",
            role="COMMERCIAL",
        )
        self.other = User.objects.create_user(
            email="policy-other@example.com",
            username="policy-other",
            password="pass",
            role="COMMERCIAL",
        )
        self.company = Company.objects.create(owner=self.owner, name="Policy CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.other.company = self.company
        self.other.save(update_fields=["company"])
        self.prospect = Prospect.objects.create(
            first_name="Nadia",
            last_name="Policy",
            email="nadia.policy@example.com",
            phone="+21633333333",
            facebook_url="https://facebook.com/nadia.policy",
            company=self.company,
            assigned_to=self.owner,
            engagement_status="new",
        )
        self.engine = EngagementPolicyEngine()

    def plan_payload(self, **overrides):
        payload = {
            "situation_summary": "Policy validation.",
            "engagement_stage": "FIRST_CONTACT",
            "prospect_temperature": "WARM",
            "objective": "START_CONVERSATION",
            "strategy": "VALUE_FIRST",
            "primary_channel": "email",
            "secondary_channels": [],
            "confidence": 0.88,
            "reasons": ["Email exists."],
            "missing_information": [],
            "should_wait": False,
            "suggested_wait_days": None,
        }
        payload.update(overrides)
        return payload

    def context(self, **overrides):
        payload = {
            "contact": {
                "email": self.prospect.email,
                "phone": self.prospect.phone,
                "facebook_url": self.prospect.facebook_url,
            },
            "engagement_memory": {},
        }
        payload.update(overrides)
        return payload

    def channels(self, **overrides):
        payload = {
            "email": {"available": True, "execution_mode": "integrated", "content_type": "email"},
            "phone": {"available": True, "execution_mode": "manual", "content_type": "call_script"},
            "linkedin": {"available": False, "execution_mode": "manual", "content_type": "social_message"},
            "facebook": {"available": True, "execution_mode": "manual", "content_type": "social_message"},
            "instagram": {"available": False, "execution_mode": "manual", "content_type": "social_message"},
        }
        payload.update(overrides)
        return payload

    def evaluate(self, plan=None, user=None, context=None, channels=None, **kwargs):
        return self.engine.evaluate(
            prospect=self.prospect,
            user=user or self.owner,
            context=context if context is not None else self.context(),
            available_channels=channels if channels is not None else self.channels(),
            plan=plan or self.plan_payload(),
            **kwargs,
        )

    def test_email_plan_with_available_email_is_allowed(self):
        decision = self.evaluate()

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.status, "ALLOWED")
        self.assertEqual(decision.violations, [])

    def test_phone_plan_without_available_phone_is_blocked(self):
        decision = self.evaluate(
            plan=self.plan_payload(primary_channel="phone"),
            channels=self.channels(phone={"available": False, "execution_mode": "manual", "content_type": "call_script"}),
        )

        self.assertFalse(decision.allowed)
        self.assertEqual(decision.status, "BLOCKED")
        self.assertIn("PRIMARY_CHANNEL_UNAVAILABLE", decision.violations)

    def test_unsubscribe_interaction_blocks_engagement(self):
        ProspectActivity.objects.create(
            prospect=self.prospect,
            activity_type="email_sent",
            channel="email",
            title="Unsubscribe",
            description="Prospect asked to unsubscribe.",
            source="manual",
            created_by=self.owner,
            metadata={
                "kind": "engagement_interaction",
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "UNSUBSCRIBE",
            },
        )

        decision = self.evaluate()

        self.assertFalse(decision.allowed)
        self.assertIn("UNSUBSCRIBE", decision.violations)

    def test_closed_engagement_status_blocks_engagement(self):
        self.prospect.engagement_status = "closed"
        self.prospect.save(update_fields=["engagement_status"])

        decision = self.evaluate()

        self.assertFalse(decision.allowed)
        self.assertIn("ENGAGEMENT_STATUS_TERMINAL", decision.violations)

    def test_wait_plan_is_allowed_without_content_required(self):
        decision = self.evaluate(
            plan=self.plan_payload(
                objective="WAIT",
                strategy="WAIT",
                primary_channel=None,
                should_wait=True,
            )
        )

        self.assertTrue(decision.allowed)
        self.assertTrue(decision.no_content_required)

    def test_stop_plan_is_allowed_without_content_required(self):
        decision = self.evaluate(
            plan=self.plan_payload(
                objective="WAIT",
                strategy="STOP_ENGAGEMENT",
                primary_channel=None,
            )
        )

        self.assertTrue(decision.allowed)
        self.assertTrue(decision.no_content_required)

    def test_manual_social_channel_is_allowed_without_social_session_lookup(self):
        decision = self.evaluate(plan=self.plan_payload(primary_channel="facebook"))

        self.assertTrue(decision.allowed)
        self.assertEqual(decision.violations, [])

    def test_user_without_prospect_access_is_blocked(self):
        decision = self.evaluate(user=self.other)

        self.assertFalse(decision.allowed)
        self.assertIn("PROSPECT_ACCESS_DENIED", decision.violations)

    def test_email_provider_missing_is_warning_not_blocker(self):
        decision = self.evaluate()

        self.assertTrue(decision.allowed)
        self.assertIn("EMAIL_PROVIDER_NOT_READY", decision.warnings)

    def test_existing_idempotency_key_adds_duplicate_warning(self):
        ProspectActivity.objects.create(
            prospect=self.prospect,
            activity_type="email_sent",
            channel="email",
            title="Existing",
            description="Existing interaction.",
            source="manual",
            created_by=self.owner,
            metadata={
                "kind": "engagement_interaction",
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "SENT",
                "idempotency_key": "policy-key-1",
            },
        )

        decision = self.evaluate(idempotency_key="policy-key-1")

        self.assertTrue(decision.allowed)
        self.assertIn("DUPLICATE_IDEMPOTENCY_KEY", decision.warnings)


class EngagementContinuationServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="continue-owner@example.com",
            username="continue-owner",
            password="pass",
            role="COMMERCIAL",
        )
        self.company = Company.objects.create(owner=self.owner, name="Continue CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.prospect = Prospect.objects.create(
            first_name="Ahmed",
            last_name="Continue",
            email="ahmed.continue@example.com",
            phone="+21622222222",
            linkedin_url="https://linkedin.com/in/ahmed-continue",
            company=self.company,
            assigned_to=self.owner,
            engagement_status="waiting_reply",
            evaluation="warm",
        )
        self.factory = APIRequestFactory()
        self.service = EngagementContinuationService()

    def create_memory(self, **overrides):
        defaults = {
            "interest_level": "HIGH",
            "current_solution": "Salesforce",
            "known_pain_points": ["manual_prospecting"],
            "known_objections": ["PRICE"],
            "known_requests": ["presentation"],
            "buying_signals": ["requests_follow_up"],
            "next_direction": "SEND_INFORMATION",
            "last_interaction_channel": "PHONE",
            "last_interaction_outcome": "INTERESTED",
        }
        defaults.update(overrides)
        return ProspectEngagementMemory.objects.create(prospect=self.prospect, **defaults)

    def create_interaction(self):
        return ProspectActivity.objects.create(
            prospect=self.prospect,
            activity_type="call_done",
            channel="phone",
            title="Phone Call - Presentation requested",
            description="Prospect response: We use Salesforce, price is high, send me a presentation.",
            source="manual",
            created_by=self.owner,
            metadata={
                "kind": "engagement_interaction",
                "channel": "PHONE",
                "action_type": "PHONE_CALL",
                "outcome": "INTERESTED",
                "prospect_response": "We use Salesforce, price is high, send me a presentation.",
                "commercial_notes": "Prospect asked for follow-up by email.",
                "status": "recorded",
            },
        )

    def plan_payload(self, **overrides):
        payload = {
            "situation_summary": "Continuation after analyzed interaction.",
            "engagement_stage": "FOLLOW_UP",
            "prospect_temperature": "WARM",
            "objective": "PROVIDE_INFORMATION",
            "strategy": "VALUE_FIRST",
            "primary_channel": "email",
            "secondary_channels": [],
            "confidence": 0.91,
            "reasons": ["The prospect requested a presentation."],
            "missing_information": ["budget"],
            "should_wait": False,
            "suggested_wait_days": None,
        }
        payload.update(overrides)
        return payload

    def email_payload(self):
        return {
            "content_required": True,
            "channel": "email",
            "content_type": "email",
            "reason": "Follow-up email after presentation request.",
            "email": {
                "subject": "Presentation suite a notre echange",
                "body": "Bonjour Ahmed,\n\nMerci pour notre echange. Comme evoque, je vous transmets une presentation adaptee a votre contexte Salesforce et aux etapes de prospection encore manuelles.\n\nSeriez-vous disponible pour en discuter apres lecture ?",
                "tone": "professional",
                "objective": "provide_information",
            },
            "call_script": None,
            "social_message": None,
        }

    def call_payload(self):
        return {
            "content_required": True,
            "channel": "phone",
            "content_type": "call_script",
            "reason": "Call script for price objection handling.",
            "email": None,
            "call_script": {
                "call_objective": "Clarifier l'objection prix.",
                "opening": "Bonjour Ahmed, je vous rappelle au sujet de votre question sur le prix.",
                "hook": "Vous aviez mentionne que certaines etapes restent manuelles.",
                "discovery_questions": ["Qu'est-ce qui rend le prix difficile a justifier aujourd'hui ?"],
                "value_proposition": "Relier la valeur aux gains sur la prospection.",
                "possible_objections": [
                    {"objection": "Prix eleve", "suggested_response": "Clarifier le perimetre et la valeur attendue."}
                ],
                "call_to_action": "Valider une prochaine etape.",
                "closing": "Merci, je vous envoie les elements convenus.",
            },
            "social_message": None,
        }

    def social_payload(self):
        return {
            "content_required": True,
            "channel": "linkedin",
            "content_type": "social_message",
            "reason": "Manual LinkedIn follow-up.",
            "email": None,
            "call_script": None,
            "social_message": {
                "channel": "linkedin",
                "message": "Bonjour Ahmed, suite a notre echange, je peux vous transmettre les elements sur la presentation demandee.",
                "tone": "professional",
                "objective": "provide_information",
                "execution_mode": "manual",
            },
        }

    def gemini_response(self, payload):
        return SimpleNamespace(text=json.dumps(payload))

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_phone_to_email_generates_followup_email(self, strategy_mock, content_mock):
        self.create_memory()
        self.create_interaction()
        strategy_mock.return_value = self.gemini_response(self.plan_payload(primary_channel="email"))
        content_mock.return_value = self.gemini_response(self.email_payload())

        result = self.service.continue_after_interaction(self.prospect, user=self.owner)

        self.assertEqual(result["plan"].strategy, "VALUE_FIRST")
        self.assertEqual(result["content"].channel, "email")
        self.assertTrue(result["content"].email.subject)
        self.assertIsNone(result["content"].call_script)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_email_to_phone_generates_call_script(self, strategy_mock, content_mock):
        self.create_memory(known_requests=[], known_objections=["PRICE"], next_direction="HANDLE_OBJECTION")
        self.create_interaction()
        strategy_mock.return_value = self.gemini_response(
            self.plan_payload(
                engagement_stage="OBJECTION",
                objective="HANDLE_OBJECTION",
                strategy="OBJECTION_HANDLING",
                primary_channel="phone",
            )
        )
        content_mock.return_value = self.gemini_response(self.call_payload())

        result = self.service.continue_after_interaction(self.prospect, user=self.owner)

        self.assertEqual(result["plan"].primary_channel, "phone")
        self.assertTrue(result["content"].call_script.opening)
        self.assertTrue(result["content"].call_script.discovery_questions)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_wait_plan_returns_no_content_without_generation_call(self, strategy_mock, content_mock):
        self.create_memory(next_direction="WAIT", timing="October")
        strategy_mock.return_value = self.gemini_response(
            self.plan_payload(
                objective="NURTURE",
                strategy="WAIT",
                primary_channel=None,
                should_wait=True,
                secondary_channels=[],
            )
        )

        result = self.service.continue_after_interaction(self.prospect, user=self.owner)

        self.assertFalse(result["content"].content_required)
        self.assertEqual(result["content"].reason, "Strategy is WAIT")
        content_mock.assert_not_called()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_stop_plan_returns_no_content_without_generation_call(self, strategy_mock, content_mock):
        self.create_memory(next_direction="STOP")
        strategy_mock.return_value = self.gemini_response(
            self.plan_payload(
                engagement_stage="NOT_INTERESTED",
                objective="WAIT",
                strategy="STOP_ENGAGEMENT",
                primary_channel=None,
                secondary_channels=[],
            )
        )

        result = self.service.continue_after_interaction(self.prospect, user=self.owner)

        self.assertFalse(result["content"].content_required)
        self.assertEqual(result["content"].reason, "Strategy is STOP_ENGAGEMENT")
        content_mock.assert_not_called()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_blocked_policy_stops_before_content_generator(self, strategy_mock, content_mock):
        self.prospect.engagement_status = "closed"
        self.prospect.save(update_fields=["engagement_status"])
        strategy_mock.return_value = self.gemini_response(self.plan_payload(primary_channel="email"))

        result = self.service.continue_after_interaction(self.prospect, user=self.owner)

        self.assertFalse(result["policy"].allowed)
        self.assertEqual(result["policy"].status, "BLOCKED")
        self.assertIn("ENGAGEMENT_STATUS_TERMINAL", result["policy"].violations)
        self.assertIsNone(result["content"])
        content_mock.assert_not_called()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_social_replan_generates_manual_social_message(self, strategy_mock, content_mock):
        self.create_memory(next_direction="FOLLOW_UP")
        strategy_mock.return_value = self.gemini_response(
            self.plan_payload(
                objective="FOLLOW_UP",
                strategy="FOLLOW_UP",
                primary_channel="linkedin",
                secondary_channels=[],
            )
        )
        content_mock.return_value = self.gemini_response(self.social_payload())

        result = self.service.continue_after_interaction(self.prospect, user=self.owner)

        self.assertEqual(result["content"].social_message.channel, "linkedin")
        self.assertEqual(result["content"].social_message.execution_mode, "manual")

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_content_payload_contains_memory_and_history(self, strategy_mock, content_mock):
        self.create_memory()
        self.create_interaction()
        strategy_mock.return_value = self.gemini_response(self.plan_payload(primary_channel="email"))
        content_mock.return_value = self.gemini_response(self.email_payload())

        self.service.continue_after_interaction(self.prospect, user=self.owner)

        content_prompt = content_mock.call_args.args[1]
        self.assertIn("engagement_memory", content_prompt)
        self.assertIn("Salesforce", content_prompt)
        self.assertIn("Phone Call - Presentation requested", content_prompt)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_strategy_planner_called_once(self, strategy_mock, content_mock):
        self.create_memory()
        strategy_mock.return_value = self.gemini_response(self.plan_payload(primary_channel="email"))
        content_mock.return_value = self.gemini_response(self.email_payload())

        self.service.continue_after_interaction(self.prospect, user=self.owner)

        strategy_mock.assert_called_once()

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_no_automatic_execution_or_prospect_mutation(
        self,
        strategy_mock,
        content_mock,
    ):
        self.create_memory()
        strategy_mock.return_value = self.gemini_response(self.plan_payload(primary_channel="email"))
        content_mock.return_value = self.gemini_response(self.email_payload())
        before_status = self.prospect.engagement_status
        before_evaluation = self.prospect.evaluation

        self.service.continue_after_interaction(self.prospect, user=self.owner)
        self.prospect.refresh_from_db()

        self.assertEqual(self.prospect.engagement_status, before_status)
        self.assertEqual(self.prospect.evaluation, before_evaluation)

    @patch("agentEngagement.agent.content_generator.generate_with_retry")
    @patch("agentEngagement.agent.strategy_planner.generate_with_retry")
    def test_continue_api_returns_plan_and_content(self, strategy_mock, content_mock):
        self.create_memory()
        interaction = self.create_interaction()
        strategy_mock.return_value = self.gemini_response(self.plan_payload(primary_channel="email"))
        content_mock.return_value = self.gemini_response(self.email_payload())
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/{interaction.id}/continue/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionContinueView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=interaction.id,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["plan"]["primary_channel"], "email")
        self.assertTrue(response.data["content"]["email"]["subject"])

    def test_continue_api_missing_interaction_returns_404(self):
        request = self.factory.post(
            f"/api/engagement/prospects/{self.prospect.id}/interactions/999999/continue/",
            {},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = ProspectInteractionContinueView.as_view()(
            request,
            prospect_id=self.prospect.id,
            interaction_id=999999,
        )

        self.assertEqual(response.status_code, 404)
