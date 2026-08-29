from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from langchain_core.messages import AIMessage
from rest_framework.test import APIRequestFactory, force_authenticate

from agentEngagement.models import EngagementLog
from agentProspection.models import DiscoveryRun
from sales.models import Prospect, ProspectActivity, ProspectCompany
from users.models import Company, User

from .agent.nodes.analyze_interactions import analyze_interactions
from .agent.nodes.analyze_profile import analyze_profile
from .agent.nodes.load_context import load_context
from .agent.nodes.qualification_agent import MAX_TOOL_CALLS
from .agent.qualification_target import resolve_qualification_target
from .agent.tools.engagement_history_tool import extract_engagement_interactions
from .agent.tools.interaction_normalizer import normalize_interaction
from .agent.qualification_runtime import QualificationRuntime
from .models import ProspectQualification
from .views import ProspectQualificationHistoryView, ProspectQualificationRunView


def gemini_response(payload):
    import json

    return SimpleNamespace(text=json.dumps(payload))


class ScriptedQualificationController:
    def __init__(self, tool_sequence=None):
        self.tool_sequence = list(
            tool_sequence
            or [
                "get_prospect_profile",
                "get_company_context",
                "get_engagement_history",
                "get_prospect360",
                "get_previous_qualification",
            ]
        )
        self.index = 0

    def invoke(self, _messages):
        if self.index >= len(self.tool_sequence):
            return AIMessage(content="FINALIZE_QUALIFICATION")
        name = self.tool_sequence[self.index]
        self.index += 1
        return AIMessage(
            content="",
            tool_calls=[
                {
                    "name": name,
                    "args": {},
                    "id": f"call_{self.index}",
                }
            ],
        )


class QualificationAgentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            password="pass",
        )
        self.company = Company.objects.create(owner=self.user, name="Acme")
        self.user.company = self.company
        self.user.save(update_fields=["company"])
        self.prospect_company = ProspectCompany.objects.create(
            name="TechNova",
            company=self.company,
            email="contact@technova.test",
            phone="+21670000000",
        )

    def make_prospect(self, **overrides):
        defaults = {
            "first_name": "Amine",
            "last_name": f"Lead{Prospect.objects.count()}",
            "title": "Responsable RH",
            "email": f"lead{Prospect.objects.count()}@example.com",
            "phone": "+21620000000",
            "city": "Tunis",
            "country": "Tunisie",
            "description": "Prospect trouvé par prospection.",
            "company": self.company,
            "assigned_to": self.user,
            "prospect_company": self.prospect_company,
            "source": "agent_prospection",
            "lead_origin": "prospection_agent",
        }
        defaults.update(overrides)
        return Prospect.objects.create(**defaults)

    def ai_payload(self, **overrides):
        payload = {
            "need_level": "UNKNOWN",
            "intent_level": "UNKNOWN",
            "urgency_level": "UNKNOWN",
            "budget_signal": "UNKNOWN",
            "authority_level": "INFLUENCER",
            "engagement_quality": "NONE",
            "detected_needs": [],
            "objections": [],
            "buying_signals": [],
            "missing_information": ["Budget", "Timing"],
            "summary": "Bon profil, mais aucun échange commercial confirmé.",
        }
        payload.update(overrides)
        return payload

    def run_with_ai(self, prospect, payload):
        controller = ScriptedQualificationController()
        with patch("agentQualification.agent.nodes.qualification_agent.get_agent_llm") as agent_llm:
            with patch("agentQualification.agent.nodes.qualification_reasoner.get_gemini_model") as model:
                with patch("agentQualification.agent.nodes.qualification_reasoner.generate_with_retry") as generate:
                    agent_llm.return_value = controller
                    model.return_value = object()
                    generate.return_value = gemini_response(payload)
                    return QualificationRuntime().run(prospect, self.user)

    def test_initial_qualification_without_interactions(self):
        prospect = self.make_prospect()
        result = self.run_with_ai(prospect, self.ai_payload())

        self.assertEqual(result["mode"], "INITIAL")
        self.assertEqual(result["status"], "ENGAGE")
        self.assertFalse(result["opportunity_ready"])
        self.assertEqual(ProspectQualification.objects.count(), 1)
        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)

    def test_positive_interaction_switches_to_post_engagement(self):
        prospect = self.make_prospect()
        ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="message_sent",
            channel="linkedin",
            title="Message LinkedIn envoyé",
            description="Premier message envoyé.",
            source="manual",
            created_by=self.user,
            metadata={
                "kind": "engagement_interaction",
                "channel": "LINKEDIN",
                "action_type": "SOCIAL_MESSAGE_SENT",
                "outcome": "INTERESTED",
                "prospect_response": "Nous réfléchissons à remplacer notre outil RH.",
            },
        )

        result = self.run_with_ai(
            prospect,
            self.ai_payload(
                need_level="HIGH",
                intent_level="MEDIUM",
                engagement_quality="POSITIVE",
                detected_needs=["Remplacement outil RH"],
                buying_signals=["Besoin confirmé"],
            ),
        )

        self.assertEqual(result["mode"], "POST_ENGAGEMENT")
        self.assertIn(result["status"], {"DEEPEN", "READY_FOR_OPPORTUNITY"})
        self.assertIn("Remplacement outil RH", result["detected_needs"])

    def test_refusal_is_not_qualified(self):
        prospect = self.make_prospect()
        ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="reply_received",
            channel="email",
            title="Réponse reçue",
            description="Merci de ne plus nous contacter.",
            source="manual",
            created_by=self.user,
            metadata={
                "kind": "engagement_interaction",
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "NOT_INTERESTED",
                "prospect_response": "Merci de ne plus nous contacter.",
            },
        )

        result = self.run_with_ai(
            prospect,
            self.ai_payload(
                intent_level="LOW",
                engagement_quality="NEGATIVE",
                objections=["Ne plus contacter"],
            ),
        )

        self.assertEqual(result["status"], "NOT_QUALIFIED")
        self.assertEqual(result["recommended_action"], "DO_NOT_CONTACT")

    def test_insufficient_data_keeps_score_in_bounds(self):
        prospect = self.make_prospect(
            title="",
            email=None,
            phone=None,
            prospect_company=None,
            description="",
        )
        result = self.run_with_ai(prospect, self.ai_payload(authority_level="UNKNOWN"))

        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)
        self.assertIn("email", result["missing_information"])
        self.assertIn("phone", result["missing_information"])

    def test_need_without_timing_stays_deepen(self):
        prospect = self.make_prospect()
        ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="message_sent",
            channel="email",
            title="Email envoyé",
            description="Réponse reçue",
            source="manual",
            created_by=self.user,
            metadata={
                "kind": "engagement_interaction",
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "REQUEST_INFORMATION",
                "prospect_response": "Nous cherchons une solution mais pas de date définie.",
            },
        )

        result = self.run_with_ai(
            prospect,
            self.ai_payload(
                need_level="HIGH",
                intent_level="MEDIUM",
                urgency_level="UNKNOWN",
                engagement_quality="POSITIVE",
                detected_needs=["Recherche de solution"],
                buying_signals=[],
            ),
        )

        self.assertEqual(result["status"], "DEEPEN")
        self.assertFalse(result["opportunity_ready"])

    def test_ready_for_opportunity_requires_business_rules(self):
        prospect = self.make_prospect(title="Directeur RH")
        ProspectActivity.objects.create(
            prospect=prospect,
            activity_type="reply_received",
            channel="email",
            title="Réponse positive",
            description="Démonstration acceptée la semaine prochaine.",
            source="manual",
            created_by=self.user,
            metadata={
                "kind": "engagement_interaction",
                "channel": "EMAIL",
                "action_type": "EMAIL_SENT",
                "outcome": "MEETING_REQUEST",
                "prospect_response": "Nous voulons changer avant janvier et organiser une démonstration.",
            },
        )

        result = self.run_with_ai(
            prospect,
            self.ai_payload(
                need_level="HIGH",
                intent_level="HIGH",
                urgency_level="HIGH",
                budget_signal="POSITIVE",
                authority_level="DECISION_MAKER",
                engagement_quality="STRONG",
                detected_needs=["Changer l'outil actuel"],
                buying_signals=["Demande de démonstration", "Échéance communiquée"],
                missing_information=[],
            ),
        )

        self.assertEqual(result["status"], "READY_FOR_OPPORTUNITY")
        self.assertTrue(result["opportunity_ready"])
        self.assertEqual(result["recommended_action"], "CREATE_OPPORTUNITY")

    def test_invalid_json_is_repaired_once(self):
        prospect = self.make_prospect()
        repaired = self.ai_payload(need_level="MEDIUM", intent_level="MEDIUM")
        controller = ScriptedQualificationController()
        with patch("agentQualification.agent.nodes.qualification_agent.get_agent_llm") as agent_llm:
            with patch("agentQualification.agent.nodes.qualification_reasoner.get_gemini_model") as model:
                with patch("agentQualification.agent.nodes.qualification_reasoner.generate_with_retry") as generate:
                    with patch("agentQualification.agent.nodes.qualification_reasoner.repair_json_with_gemini") as repair:
                        agent_llm.return_value = controller
                        model.return_value = object()
                        generate.return_value = SimpleNamespace(text="{invalid")
                        repair.return_value = repaired
                        result = QualificationRuntime().run(prospect, self.user)

        self.assertEqual(result["status"], "ENGAGE")
        self.assertEqual(repair.call_count, 1)

    def test_gemini_unavailable_persists_incomplete_result(self):
        prospect = self.make_prospect()
        controller = ScriptedQualificationController()
        with patch("agentQualification.agent.nodes.qualification_agent.get_agent_llm") as agent_llm:
            with patch("agentQualification.agent.nodes.qualification_reasoner.get_gemini_model") as model:
                agent_llm.return_value = controller
                model.side_effect = RuntimeError("429 RESOURCE_EXHAUSTED")
                result = QualificationRuntime().run(prospect, self.user)

        self.assertEqual(result["status"], "ANALYSIS_INCOMPLETE")
        self.assertEqual(result["recommended_action"], "RETRY_QUALIFICATION")
        self.assertEqual(ProspectQualification.objects.count(), 1)

    def test_user_without_permission_cannot_run(self):
        other_user = User.objects.create_user(email="other@example.com", username="other", password="pass")
        other_company = Company.objects.create(owner=other_user, name="Other")
        other_user.company = other_company
        other_user.save(update_fields=["company"])
        prospect = self.make_prospect()

        request = APIRequestFactory().post(f"/api/qualification/prospects/{prospect.id}/run/")
        force_authenticate(request, user=other_user)
        response = ProspectQualificationRunView.as_view()(request, prospect_id=prospect.id)

        self.assertEqual(response.status_code, 403)

    def test_history_keeps_multiple_qualifications(self):
        prospect = self.make_prospect()
        self.run_with_ai(prospect, self.ai_payload())
        self.run_with_ai(
            prospect,
            self.ai_payload(
                need_level="MEDIUM",
                intent_level="MEDIUM",
                engagement_quality="POSITIVE",
            ),
        )

        request = APIRequestFactory().get(f"/api/qualification/prospects/{prospect.id}/history/")
        force_authenticate(request, user=self.user)
        response = ProspectQualificationHistoryView.as_view()(request, prospect_id=prospect.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertIsNotNone(response.data["results"][0]["previous_score"])

    def test_engagement_log_is_used_as_interaction(self):
        prospect = self.make_prospect()
        EngagementLog.objects.create(
            prospect=prospect,
            user=self.user,
            company=self.company,
            action="replied",
            channel="email",
            message="Pouvez-vous envoyer les tarifs ?",
            status="replied",
        )

        result = self.run_with_ai(
            prospect,
            self.ai_payload(
                need_level="MEDIUM",
                intent_level="HIGH",
                engagement_quality="POSITIVE",
                buying_signals=["Question commerciale précise"],
            ),
        )

        self.assertEqual(result["mode"], "POST_ENGAGEMENT")


class LoopingQualificationController:
    def __init__(self, tool_name="get_recent_activities"):
        self.tool_name = tool_name
        self.index = 0

    def invoke(self, _messages):
        self.index += 1
        return AIMessage(
            content="",
            tool_calls=[
                {
                    "name": self.tool_name,
                    "args": {},
                    "id": f"loop_{self.index}",
                }
            ],
        )


class UnavailableQualificationController:
    def invoke(self, _messages):
        raise RuntimeError("controller unavailable")


class QualificationLangGraphAgentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="agentic@example.com",
            username="agentic",
            password="pass",
        )
        self.company = Company.objects.create(owner=self.user, name="Acme")
        self.user.company = self.company
        self.user.save(update_fields=["company"])
        self.prospect_company = ProspectCompany.objects.create(
            name="TechNova",
            industry="SaaS",
            company=self.company,
            email="contact@technova.test",
            phone="+21670000000",
        )

    def make_prospect(self, **overrides):
        defaults = {
            "first_name": "Nour",
            "last_name": f"Lead{Prospect.objects.count()}",
            "title": "Responsable RH",
            "email": f"nour{Prospect.objects.count()}@example.com",
            "phone": "+21620000000",
            "company": self.company,
            "assigned_to": self.user,
            "prospect_company": self.prospect_company,
            "source": "agent_prospection",
            "lead_origin": "prospection_agent",
        }
        defaults.update(overrides)
        return Prospect.objects.create(**defaults)

    def ai_payload(self, **overrides):
        payload = {
            "need_level": "UNKNOWN",
            "intent_level": "UNKNOWN",
            "urgency_level": "UNKNOWN",
            "budget_signal": "UNKNOWN",
            "authority_level": "INFLUENCER",
            "engagement_quality": "NONE",
            "detected_needs": [],
            "objections": [],
            "buying_signals": [],
            "missing_information": ["Budget"],
            "summary": "Qualification initiale avec donnees CRM disponibles.",
        }
        payload.update(overrides)
        return payload

    def run_agent(self, prospect, controller, payload=None):
        with patch("agentQualification.agent.nodes.qualification_agent.get_agent_llm") as agent_llm:
            with patch("agentQualification.agent.nodes.qualification_reasoner.get_gemini_model") as model:
                with patch("agentQualification.agent.nodes.qualification_reasoner.generate_with_retry") as generate:
                    agent_llm.return_value = controller
                    model.return_value = object()
                    generate.return_value = gemini_response(payload or self.ai_payload())
                    return QualificationRuntime().run(prospect, self.user)

    def last_snapshot(self, prospect):
        return prospect.qualifications.order_by("-created_at").first().source_snapshot

    def test_new_prospect_uses_tools_then_finalizes_initial(self):
        prospect = self.make_prospect()
        result = self.run_agent(
            prospect,
            ScriptedQualificationController(
                [
                    "get_prospect_profile",
                    "get_company_context",
                    "get_engagement_history",
                ]
            ),
        )
        trace = self.last_snapshot(prospect)["agent_trace"]

        self.assertEqual(result["mode"], "INITIAL")
        self.assertEqual([item["action"] for item in trace[:3]], [
            "get_prospect_profile",
            "get_company_context",
            "get_engagement_history",
        ])
        self.assertEqual(trace[-1]["action"], "finalize")

    def test_engaged_prospect_can_follow_different_post_engagement_path(self):
        prospect = self.make_prospect()
        EngagementLog.objects.create(
            prospect=prospect,
            user=self.user,
            company=self.company,
            action="replied",
            channel="email",
            message="Nous voulons une demo la semaine prochaine.",
            status="replied",
        )
        result = self.run_agent(
            prospect,
            ScriptedQualificationController(
                [
                    "get_engagement_history",
                    "get_company_context",
                    "get_recent_activities",
                    "get_previous_qualification",
                ]
            ),
            self.ai_payload(
                need_level="HIGH",
                intent_level="HIGH",
                engagement_quality="POSITIVE",
                buying_signals=["Demande de demo"],
            ),
        )
        trace = self.last_snapshot(prospect)["agent_trace"]

        self.assertEqual(result["mode"], "POST_ENGAGEMENT")
        self.assertEqual(trace[0]["action"], "get_engagement_history")
        self.assertIn("get_previous_qualification", [item["action"] for item in trace])

    def test_tool_is_not_forced_when_agent_does_not_need_it(self):
        prospect = self.make_prospect()
        self.run_agent(
            prospect,
            ScriptedQualificationController(
                [
                    "get_prospect_profile",
                    "get_engagement_history",
                ]
            ),
        )
        actions = [item["action"] for item in self.last_snapshot(prospect)["agent_trace"]]

        self.assertNotIn("get_previous_qualification", actions)
        self.assertNotIn("get_prospect360", actions)

    def test_multiple_agent_tool_cycles_are_traced(self):
        prospect = self.make_prospect()
        self.run_agent(
            prospect,
            ScriptedQualificationController(
                [
                    "get_prospect_profile",
                    "get_company_context",
                    "get_engagement_history",
                    "get_recent_activities",
                ]
            ),
        )
        snapshot = self.last_snapshot(prospect)

        self.assertEqual(snapshot["tool_call_count"], 4)
        self.assertEqual(snapshot["agent_trace"][-1]["action"], "finalize")

    def test_max_tool_calls_stops_loop_cleanly(self):
        prospect = self.make_prospect()
        self.run_agent(prospect, LoopingQualificationController())
        snapshot = self.last_snapshot(prospect)

        self.assertEqual(snapshot["tool_call_count"], MAX_TOOL_CALLS)
        self.assertEqual(snapshot["agent_trace"][-1]["reason"], "max_tool_calls_reached")

    def test_invalid_tool_is_refused_and_persisted_incomplete(self):
        prospect = self.make_prospect()
        result = self.run_agent(
            prospect,
            ScriptedQualificationController(["delete_everything"]),
        )
        snapshot = self.last_snapshot(prospect)

        self.assertEqual(result["status"], "ANALYSIS_INCOMPLETE")
        self.assertEqual(snapshot["agent_trace"][-1]["action"], "invalid_tool_refused")

    def test_controller_unavailable_persists_incomplete(self):
        prospect = self.make_prospect()
        result = self.run_agent(prospect, UnavailableQualificationController())

        self.assertEqual(result["status"], "ANALYSIS_INCOMPLETE")
        self.assertEqual(result["recommended_action"], "RETRY_QUALIFICATION")

    def test_runtime_rejects_unauthorized_prospect(self):
        other_user = User.objects.create_user(
            email="other-agentic@example.com",
            username="otheragentic",
            password="pass",
        )
        other_company = Company.objects.create(owner=other_user, name="Other")
        other_user.company = other_company
        other_user.save(update_fields=["company"])
        prospect = self.make_prospect()

        with self.assertRaises(PermissionError):
            QualificationRuntime().run(prospect, other_user)


class QualificationInteractionModeTests(TestCase):
    def analyze_mode(self, interactions):
        state = analyze_interactions({"interactions": interactions})
        return state["qualification_mode"], state["interaction_signals"]

    def test_email_sent_only_stays_initial(self):
        mode, signals = self.analyze_mode(
            [
                {
                    "action_type": "EMAIL_SENT",
                    "outcome": "SENT",
                    "message": "Bonjour, pouvez-vous échanger cette semaine ?",
                    "prospect_response": "",
                }
            ]
        )

        self.assertEqual(mode, "INITIAL")
        self.assertEqual(signals["significant_interactions"], 0)

    def test_linkedin_message_sent_only_stays_initial(self):
        mode, signals = self.analyze_mode(
            [
                {
                    "channel": "LINKEDIN",
                    "action_type": "SOCIAL_MESSAGE_SENT",
                    "outcome": "SENT",
                    "message": "Message LinkedIn envoyé.",
                    "prospect_response": "",
                }
            ]
        )

        self.assertEqual(mode, "INITIAL")
        self.assertEqual(signals["significant_interactions"], 0)

    def test_email_sent_with_reply_switches_to_post_engagement(self):
        mode, signals = self.analyze_mode(
            [
                {
                    "action_type": "EMAIL_SENT",
                    "outcome": "SENT",
                    "message": "Premier email envoyé.",
                    "prospect_response": "",
                },
                {
                    "action_type": "replied",
                    "outcome": "replied",
                    "message": "Nous sommes intéressés par une démonstration.",
                    "prospect_response": "Nous sommes intéressés par une démonstration.",
                },
            ]
        )

        self.assertEqual(mode, "POST_ENGAGEMENT")
        self.assertEqual(signals["significant_interactions"], 1)
        self.assertTrue(signals["has_prospect_response"])

    def test_objection_switches_to_post_engagement(self):
        mode, signals = self.analyze_mode(
            [
                {
                    "action_type": "reply_received",
                    "outcome": "OBJECTION",
                    "prospect_response": "Nous avons déjà un fournisseur.",
                }
            ]
        )

        self.assertEqual(mode, "POST_ENGAGEMENT")
        self.assertTrue(signals["has_objection"])

    def test_call_with_recorded_result_switches_to_post_engagement(self):
        mode, signals = self.analyze_mode(
            [
                {
                    "action_type": "PHONE_CALL",
                    "outcome": "CALL_LATER",
                    "commercial_notes": "Discussion avec la DRH, rappel demandé mardi.",
                }
            ]
        )

        self.assertEqual(mode, "POST_ENGAGEMENT")
        self.assertEqual(signals["significant_interactions"], 1)

    def test_no_interaction_stays_initial(self):
        mode, signals = self.analyze_mode([])

        self.assertEqual(mode, "INITIAL")
        self.assertEqual(signals["total_interactions"], 0)


class QualificationInteractionNormalizationTests(TestCase):
    def test_email_sent_is_outbound_crm_user(self):
        interaction = normalize_interaction(
            source="ProspectActivity",
            object_id=25,
            action="EMAIL_SENT",
            channel="email",
            message="Bonjour, je souhaite vous présenter notre solution.",
            outcome="SENT",
            created_at="2026-08-29T10:00:00Z",
        )

        self.assertEqual(interaction["direction"], "OUTBOUND")
        self.assertEqual(interaction["actor"], "CRM_USER")
        self.assertEqual(interaction["channel"], "EMAIL")
        self.assertEqual(interaction["interaction_type"], "MESSAGE_SENT")
        self.assertEqual(interaction["content"], "Bonjour, je souhaite vous présenter notre solution.")

    def test_email_reply_is_inbound_prospect_reply(self):
        interaction = normalize_interaction(
            source="EngagementLog",
            object_id=15,
            action="replied",
            channel="EMAIL_DIRECT",
            message="Nous sommes intéressés par une démonstration.",
            response="Nous sommes intéressés par une démonstration.",
            outcome="replied",
            created_at="2026-08-29T10:05:00Z",
        )

        self.assertEqual(interaction["direction"], "INBOUND")
        self.assertEqual(interaction["actor"], "PROSPECT")
        self.assertEqual(interaction["channel"], "EMAIL")
        self.assertEqual(interaction["interaction_type"], "REPLY")
        self.assertEqual(interaction["content"], "Nous sommes intéressés par une démonstration.")

    def test_linkedin_message_sent_is_outbound(self):
        interaction = normalize_interaction(
            source="ProspectActivity",
            object_id=26,
            action="SOCIAL_MESSAGE_SENT",
            channel="linkedin_dm",
            message="Bonjour sur LinkedIn.",
            outcome="SENT",
        )

        self.assertEqual(interaction["direction"], "OUTBOUND")
        self.assertEqual(interaction["actor"], "CRM_USER")
        self.assertEqual(interaction["channel"], "LINKEDIN")
        self.assertEqual(interaction["interaction_type"], "MESSAGE_SENT")

    def test_social_reply_is_inbound(self):
        interaction = normalize_interaction(
            source="EngagementLog",
            object_id=16,
            action="replied",
            channel="instagram_message",
            response="Envoyez-moi vos tarifs.",
            outcome="replied",
        )

        self.assertEqual(interaction["direction"], "INBOUND")
        self.assertEqual(interaction["actor"], "PROSPECT")
        self.assertEqual(interaction["channel"], "INSTAGRAM")
        self.assertEqual(interaction["interaction_type"], "REPLY")

    def test_commercial_note_is_internal_note(self):
        interaction = normalize_interaction(
            source="ProspectActivity",
            object_id=27,
            action="commercial_note",
            channel="other",
            note="Le prospect souhaite être rappelé vendredi.",
        )

        self.assertEqual(interaction["direction"], "INTERNAL")
        self.assertEqual(interaction["actor"], "CRM_USER")
        self.assertEqual(interaction["channel"], "OTHER")
        self.assertEqual(interaction["interaction_type"], "NOTE")
        self.assertEqual(interaction["note"], "Le prospect souhaite être rappelé vendredi.")

    def test_call_with_result_keeps_outcome_and_call_type(self):
        interaction = normalize_interaction(
            source="ProspectActivity",
            object_id=28,
            action="PHONE_CALL",
            channel="PHONE_CALL_MANUAL",
            note="Discussion avec la DRH, rappel demandé mardi.",
            outcome="CALL_LATER",
        )

        self.assertEqual(interaction["direction"], "INTERNAL")
        self.assertEqual(interaction["actor"], "CRM_USER")
        self.assertEqual(interaction["channel"], "PHONE")
        self.assertEqual(interaction["interaction_type"], "CALL")
        self.assertEqual(interaction["outcome"], "CALL_LATER")
        self.assertEqual(interaction["note"], "Discussion avec la DRH, rappel demandé mardi.")

    def test_sent_message_never_becomes_prospect_reply(self):
        interaction = normalize_interaction(
            source="EngagementLog",
            object_id=17,
            action="message_sent",
            channel="email",
            message="Bonjour, je souhaite vous présenter notre solution.",
            outcome="sent",
        )

        self.assertNotEqual(interaction["direction"], "INBOUND")
        self.assertNotEqual(interaction["actor"], "PROSPECT")
        self.assertEqual(interaction["direction"], "OUTBOUND")
        self.assertEqual(interaction["actor"], "CRM_USER")

    def test_extract_interactions_deduplicates_linked_engagement_log(self):
        created_at = timezone.now().isoformat()
        interactions = extract_engagement_interactions(
            activities=[
                {
                    "id": 30,
                    "activity_type": "message_sent",
                    "channel": "email",
                    "description": "Bonjour.",
                    "created_at": created_at,
                    "metadata": {"engagement_log_id": 12},
                }
            ],
            engagement_logs=[
                {
                    "id": 12,
                    "action": "message_sent",
                    "channel": "email",
                    "message": "Bonjour.",
                    "status": "sent",
                    "created_at": created_at,
                }
            ],
        )

        self.assertEqual(len(interactions), 1)
        self.assertEqual(interactions[0]["source"], "ProspectActivity")

    def test_normalized_mode_compatibility(self):
        outbound = normalize_interaction(
            source="ProspectActivity",
            object_id=31,
            action="EMAIL_SENT",
            channel="EMAIL",
            message="Bonjour.",
            outcome="SENT",
        )
        inbound = normalize_interaction(
            source="EngagementLog",
            object_id=32,
            action="replied",
            channel="EMAIL",
            response="Votre solution peut nous intéresser.",
            outcome="replied",
        )

        self.assertEqual(analyze_interactions({"interactions": [outbound]})["qualification_mode"], "INITIAL")
        self.assertEqual(
            analyze_interactions({"interactions": [outbound, inbound]})["qualification_mode"],
            "POST_ENGAGEMENT",
        )


class QualificationProfileSignalTests(TestCase):
    def profile(self, **overrides):
        data = {
            "first_name": "Amine",
            "last_name": "Ben Salah",
            "title": "Responsable RH",
            "email": "amine@example.com",
            "phone": "+21620000000",
            "linkedin_url": "https://linkedin.com/in/amine",
            "facebook_url": "",
            "instagram_url": "",
            "description": "Contact identifié pendant la prospection.",
            "source": "agent_prospection",
            "city": "Tunis",
            "country": "Tunisie",
        }
        data.update(overrides)
        return data

    def company(self, **overrides):
        data = {
            "name": "TechNova",
            "sector": "SaaS",
            "website": "https://technova.test",
            "city": "Tunis",
            "country": "Tunisie",
            "address": "Rue principale",
            "email": "contact@technova.test",
            "phone": "+21670000000",
            "number_of_employees": 120,
            "annual_revenue": "1000000.00",
            "source": "agent_prospection",
        }
        data.update(overrides)
        return data

    def signals(self, prospect=None, company=None):
        state = analyze_profile(
            {
                "prospect": prospect if prospect is not None else self.profile(),
                "company": company if company is not None else self.company(),
                "missing_information": [],
            }
        )
        return state["profile_signals"]

    def test_complete_prospect_with_irrelevant_role_keeps_low_contact_relevance(self):
        signals = self.signals(prospect=self.profile(title="Stagiaire marketing"))

        self.assertGreater(signals["data_completeness_score"], 85)
        self.assertLess(signals["contact_relevance_score"], 35)
        self.assertGreater(signals["data_completeness_score"], signals["contact_relevance_score"])

    def test_decision_maker_with_few_contact_details_keeps_high_relevance_and_low_reachability(self):
        signals = self.signals(
            prospect=self.profile(
                title="Directeur commercial",
                email="",
                phone="",
                linkedin_url="",
                facebook_url="",
                instagram_url="",
            )
        )

        self.assertGreaterEqual(signals["contact_relevance_score"], 80)
        self.assertEqual(signals["reachability_score"], 0)

    def test_prospect_without_contact_channel_has_zero_reachability(self):
        signals = self.signals(
            prospect=self.profile(email="", phone="", linkedin_url="", facebook_url="", instagram_url="")
        )

        self.assertEqual(signals["reachability_score"], 0)

    def test_email_only_has_intermediate_reachability(self):
        signals = self.signals(
            prospect=self.profile(phone="", linkedin_url="", facebook_url="", instagram_url="")
        )

        self.assertEqual(signals["reachability_score"], 40)

    def test_email_phone_and_linkedin_have_high_reachability(self):
        signals = self.signals(prospect=self.profile(email="a@b.test", phone="+2161", linkedin_url="https://linkedin.com/in/a"))

        self.assertEqual(signals["reachability_score"], 100)

    def test_company_with_name_only_has_low_completeness(self):
        signals = self.signals(
            company={
                "name": "Nom Seulement",
                "sector": "",
                "website": "",
                "city": "",
                "country": "",
                "address": "",
                "email": "",
                "phone": "",
                "number_of_employees": None,
                "annual_revenue": None,
            }
        )

        self.assertLessEqual(signals["company_completeness_score"], 20)
        self.assertLess(signals["company_fit_score"], 60)

    def test_well_documented_company_has_high_completeness(self):
        signals = self.signals(company=self.company())

        self.assertGreaterEqual(signals["company_completeness_score"], 90)
        self.assertLessEqual(signals["company_fit_score"], 85)

    def test_missing_job_title_is_reported_and_relevance_is_not_high(self):
        state = analyze_profile(
            {
                "prospect": self.profile(title=""),
                "company": self.company(),
                "missing_information": [],
            }
        )
        signals = state["profile_signals"]

        self.assertLess(signals["contact_relevance_score"], 50)
        self.assertIn("job_title", signals["missing_profile_information"])
        self.assertIn("job_title", state["missing_information"])

    def test_all_profile_scores_stay_between_zero_and_one_hundred(self):
        signals = self.signals(
            prospect=self.profile(title="Stagiaire", email="", phone="", linkedin_url=""),
            company=None,
        )

        for key in [
            "data_completeness_score",
            "company_completeness_score",
            "contact_relevance_score",
            "company_fit_score",
            "reachability_score",
            "profile_fit_score",
        ]:
            self.assertGreaterEqual(signals[key], 0)
            self.assertLessEqual(signals[key], 100)

    def test_target_roles_override_generic_title_rules_when_icp_exists(self):
        target = {
            "source": "PROSPECTION_RUN",
            "target_roles": ["Responsable RH"],
            "target_sectors": [],
            "target_countries": [],
            "target_cities": [],
            "target_company_size_min": None,
            "target_company_size_max": None,
        }
        state = analyze_profile(
            {
                "prospect": self.profile(title="Directeur commercial"),
                "company": self.company(),
                "qualification_target": target,
                "missing_information": [],
            }
        )
        signals = state["profile_signals"]

        self.assertEqual(signals["contact_relevance_source"], "ICP")
        self.assertLess(signals["contact_relevance_score"], 50)
        self.assertEqual(signals["qualification_target_source"], "PROSPECTION_RUN")

    def test_matching_target_role_gets_high_icp_relevance(self):
        target = {
            "source": "PROSPECTION_RUN",
            "target_roles": ["DRH"],
            "target_sectors": [],
            "target_countries": [],
            "target_cities": [],
            "target_company_size_min": None,
            "target_company_size_max": None,
        }
        signals = analyze_profile(
            {
                "prospect": self.profile(title="Responsable ressources humaines"),
                "company": self.company(),
                "qualification_target": target,
                "missing_information": [],
            }
        )["profile_signals"]

        self.assertEqual(signals["contact_relevance_source"], "ICP")
        self.assertGreaterEqual(signals["contact_relevance_score"], 85)

    def test_company_fit_uses_configured_icp_dimensions_only(self):
        target = {
            "source": "PROSPECTION_RUN",
            "target_roles": [],
            "target_sectors": ["SaaS"],
            "target_countries": ["Tunisie"],
            "target_cities": ["Tunis"],
            "target_company_size_min": 50,
            "target_company_size_max": 250,
        }
        signals = analyze_profile(
            {
                "prospect": self.profile(),
                "company": self.company(number_of_employees=120),
                "qualification_target": target,
                "missing_information": [],
            }
        )["profile_signals"]

        self.assertEqual(signals["company_fit_source"], "ICP")
        self.assertGreaterEqual(signals["company_fit_score"], 90)
        self.assertEqual(
            signals["company_fit_breakdown"]["industry_match"]["matched_target"],
            "SaaS",
        )

    def test_missing_configured_company_dimension_stays_unknown_not_mismatch(self):
        target = {
            "source": "PROSPECTION_RUN",
            "target_roles": [],
            "target_sectors": ["SaaS"],
            "target_countries": [],
            "target_cities": [],
            "target_company_size_min": 50,
            "target_company_size_max": 250,
        }
        signals = analyze_profile(
            {
                "prospect": self.profile(),
                "company": self.company(sector="", number_of_employees=None),
                "qualification_target": target,
                "missing_information": [],
            }
        )["profile_signals"]

        self.assertEqual(signals["company_fit_source"], "ICP")
        self.assertIsNone(signals["company_fit_breakdown"]["industry_match"])
        self.assertEqual(signals["company_fit_score"], 50)


class QualificationTargetResolverTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="resolver@example.com",
            username="resolver",
            password="pass",
        )
        self.company = Company.objects.create(owner=self.user, name="Acme")
        self.user.company = self.company
        self.user.save(update_fields=["company"])
        self.prospect_company = ProspectCompany.objects.create(
            name="TechNova",
            company=self.company,
            industry="SaaS",
            city="Tunis",
            country="Tunisie",
        )

    def make_prospect(self, **overrides):
        defaults = {
            "first_name": "Mariam",
            "last_name": "Mallouli",
            "title": "Responsable RH",
            "email": "mariam@example.com",
            "company": self.company,
            "assigned_to": self.user,
            "prospect_company": self.prospect_company,
            "source": "agent_prospection",
            "lead_origin": "prospection_agent",
            "linkedin_url": "https://linkedin.com/in/mariam",
        }
        defaults.update(overrides)
        return Prospect.objects.create(**defaults)

    def test_without_prospection_origin_returns_no_target(self):
        prospect = self.make_prospect(source="commercial", lead_origin="manual")

        target = resolve_qualification_target(prospect=prospect, user=self.user)

        self.assertEqual(target["source"], "NONE")
        self.assertEqual(target["target_roles"], [])

    def test_matching_discovery_run_supplies_qualification_target(self):
        prospect = self.make_prospect()
        DiscoveryRun.objects.create(
            company=self.company,
            launched_by=self.user,
            query="Trouver des responsables RH SaaS à Tunis",
            status="success",
            result_data={
                "intent": {
                    "target_roles": ["Responsable RH"],
                    "industries": ["SaaS"],
                    "locations": ["Tunis", "Tunisie"],
                    "search_keywords": ["logiciel rh"],
                },
                "persons_sample": [
                    {
                        "name": "Mariam Mallouli",
                        "linkedin_url": "https://linkedin.com/in/mariam",
                    }
                ],
            },
        )

        target = resolve_qualification_target(prospect=prospect, user=self.user)

        self.assertEqual(target["source"], "PROSPECTION_RUN")
        self.assertEqual(target["target_roles"], ["Responsable RH"])
        self.assertEqual(target["target_sectors"], ["SaaS"])
        self.assertEqual(target["target_cities"], ["Tunis"])
        self.assertEqual(target["target_countries"], ["Tunisie"])
        self.assertEqual(target["keywords"], ["logiciel rh"])

    def test_unmatched_discovery_run_is_not_used(self):
        prospect = self.make_prospect()
        DiscoveryRun.objects.create(
            company=self.company,
            launched_by=self.user,
            query="Autre recherche",
            status="success",
            result_data={
                "intent": {"target_roles": ["Directeur commercial"]},
                "persons_sample": [{"name": "Autre Contact"}],
            },
        )

        target = resolve_qualification_target(prospect=prospect, user=self.user)

        self.assertEqual(target["source"], "NONE")

    def test_load_context_adds_resolved_target(self):
        prospect = self.make_prospect()
        DiscoveryRun.objects.create(
            company=self.company,
            launched_by=self.user,
            query="RH Tunis",
            status="success",
            result_data={
                "intent": {
                    "target_roles": ["RH"],
                    "industries": ["SaaS"],
                    "locations": ["Tunisie"],
                },
                "persons_sample": [{"name": "Mariam Mallouli"}],
            },
        )

        state = load_context({}, prospect, user=self.user)

        self.assertEqual(state["qualification_target"]["source"], "PROSPECTION_RUN")
        self.assertEqual(state["qualification_target"]["target_roles"], ["RH"])
