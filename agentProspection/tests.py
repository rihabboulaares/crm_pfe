import json

from decimal import Decimal
from datetime import datetime

from asgiref.sync import async_to_sync
from django.test import (
    SimpleTestCase,
    TestCase,
    override_settings,
)
from rest_framework.test import APIClient
from unittest.mock import patch


# ============================================================
# BRAIN
# ============================================================

from agentProspection.agent.brain import (
    GEMINI_CIRCUIT_BREAKER,
    GEMINI_STATUS_INVALID_RESPONSE,
    GEMINI_STATUS_RATE_LIMITED,
    GEMINI_STATUS_SUCCESS,
    GEMINI_STATUS_UNAVAILABLE,
    GeminiBrain,
    GeminiRuntimeState,
    build_meta_ads_query,
    build_meta_ads_queries,
    build_search_plan,
    clean_gemini_intent,
    meta_ads_country_codes,
    query_requests_foreign_location,
    safe_gemini_generate,
)

from agentProspection.agent.schemas import (
    AgentDecision,
    IntentSchema,
)


# ============================================================
# DISCOVERY
# ============================================================

from agentProspection.agent.fusion_engine import (
    is_same_company,
    merge_leads,
)

from agentProspection.agent.lead_classifier import (
    location_status,
    qualify_entity,
)

from agentProspection.agent.loop_controller import (
    build_tools,
    execute_broadened_search,
    execute_tool,
    observe_tool_result,
    run_agent,
)

from agentProspection.agent.memory import (
    AgentMemory,
)

from agentProspection.agent.tool_registry import (
    SOURCE_TO_TOOL,
)


# ============================================================
# CRM
# ============================================================

from agentProspection.crm.importer import (
    import_leads_to_crm,
)


# ============================================================
# TOOLS
# ============================================================

from agentProspection.tools.meta_ads_sanitizer import (
    sanitize_meta_payload,
    sanitize_meta_url,
)

from agentProspection.tools.meta_ads_tool import (
    MetaAdsLibraryTool,
    build_args_from_schema,
    dedupe_meta_ads_candidates,
    normalize_meta_ads_result,
)

from agentProspection.tools.serper_tool import (
    build_search_query as build_serper_search_query,
    normalize_result,
)


# ============================================================
# MODELS / SERVICES
# ============================================================

from agentProspection.models import (
    DiscoveryRun,
)

from agentProspection.services.scoring_service import (
    calculate_score,
)

from agentProspection.tenant import (
    get_user_company,
)

from sales.models import (
    Prospect,
    ProspectCompany,
)

from sales.serializers import (
    ProspectSerializer,
)

from users.models import (
    Company,
    User,
)


# ============================================================
# BRAIN / TUNISIA SCOPE
# ============================================================

class BrainArchitectureTests(
    SimpleTestCase
):
    def setUp(self):
        GEMINI_CIRCUIT_BREAKER.opened_until = 0.0

    def tearDown(self):
        GEMINI_CIRCUIT_BREAKER.opened_until = 0.0

    # --------------------------------------------------------
    # TUNISIA ONLY
    # --------------------------------------------------------

    def test_foreign_location_is_detected(self):
        self.assertEqual(
            query_requests_foreign_location(
                "Trouver 5 développeurs à Paris"
            ),
            "paris",
        )

    def test_tunisian_location_is_not_rejected(self):
        self.assertIsNone(
            query_requests_foreign_location(
                "Trouver 5 développeurs à Tunis"
            )
        )

    def test_default_country_is_tunisia(self):
        intent = clean_gemini_intent(
            {
                "objective":
                    "prospection",

                "lead_types":
                    ["company"],

                "industries":
                    ["restaurant"],

                "locations":
                    [],

                "target_roles":
                    [],

                "sources":
                    ["maps"],

                "source_forced":
                    False,

                "max_leads":
                    5,

                "reasoning_summary":
                    "",
            }
        )

        self.assertEqual(
            intent["locations"],
            ["Tunisie"],
        )

    # --------------------------------------------------------
    # META ADS COUNTRY
    # --------------------------------------------------------

    def test_meta_ads_country_is_always_tunisia(self):
        self.assertEqual(
            meta_ads_country_codes(
                {
                    "locations":
                        ["Tunis"]
                }
            ),
            ["TN"],
        )

    def test_meta_ads_country_never_uses_foreign_country(self):
        self.assertEqual(
            meta_ads_country_codes(
                {
                    "locations":
                        ["France"]
                }
            ),
            ["TN"],
        )

    # --------------------------------------------------------
    # META QUERY
    # --------------------------------------------------------

    def test_meta_ads_cosmetics_query_is_short(self):
        intent = {
            "industries": ["cosmetique"],
            "search_keywords": [
                "cosmetics",
                "beauty",
                "skincare",
            ],
        }

        self.assertEqual(
            build_meta_ads_query(intent),
            "cosmetics",
        )

        self.assertEqual(
            build_meta_ads_queries(intent),
            [
                "cosmetics",
                "beauty",
                "skincare",
            ],
        )

    def test_meta_ads_supports_dynamic_industry_keywords(self):
        intent = {
            "industries": ["fabrication de meubles"],
            "search_keywords": [
                "furniture",
                "furniture manufacturer",
                "home furniture",
            ],
        }

        self.assertEqual(
            build_meta_ads_queries(intent),
            [
                "furniture",
                "furniture manufacturer",
                "home furniture",
            ],
        )

    def test_meta_ads_falls_back_to_industry_without_keywords(self):
        intent = {
            "industries": ["architecture"],
            "search_keywords": [],
        }

        self.assertEqual(
            build_meta_ads_query(intent),
            "architecture",
        )

    def test_meta_ads_without_industry_returns_empty_query(self):
        self.assertEqual(
            build_meta_ads_query(
                {
                    "industries":
                        []
                }
            ),
            "",
        )

    # --------------------------------------------------------
    # SEARCH PLAN
    # --------------------------------------------------------

    def test_person_search_defaults_to_linkedin(self):
        plan = build_search_plan(
            {
                "objective":
                    "prospection",

                "lead_types":
                    ["person"],

                "industries":
                    [],

                "locations":
                    ["Tunis"],

                "target_roles":
                    ["DevOps Engineer"],

                "sources":
                    [],

                "source_forced":
                    False,

                "max_leads":
                    5,
            }
        )

        self.assertEqual(
            plan["searches"][0]["tool"],
            "serper_linkedin",
        )

        self.assertIn(
            "DevOps Engineer",
            plan["searches"][0]["query"],
        )

    def test_company_search_accepts_meta_and_facebook(self):
        plan = build_search_plan(
            {
                "objective":
                    "prospection",

                "lead_types":
                    ["company"],

                "industries":
                    ["cosmetique"],

                "locations":
                    ["Tunisie"],

                "target_roles":
                    [],

                "sources":
                    [
                        "meta_ads",
                        "facebook",
                    ],

                "source_forced":
                    True,

                "max_leads":
                    5,
            }
        )

        tools = [
            item["tool"]
            for item
            in plan["searches"]
        ]

        self.assertEqual(
            tools,
            [
                "ads_library_search",
                "serper_facebook",
            ],
        )

    def test_plan_has_maximum_two_sources(self):
        plan = build_search_plan(
            {
                "lead_types":
                    ["company"],

                "industries":
                    ["cosmetique"],

                "locations":
                    ["Tunisie"],

                "target_roles":
                    [],

                "sources":
                    [
                        "meta_ads",
                        "facebook",
                        "instagram",
                        "general",
                    ],

                "max_leads":
                    5,
            }
        )

        self.assertLessEqual(
            len(
                plan["searches"]
            ),
            2,
        )


# ============================================================
# GEMINI - EXACTLY ONE CALL
# ============================================================

class GeminiQuotaTests(
    SimpleTestCase
):
    class FakeResponse:
        text = (
            '{"objective":"prospection",'
            '"lead_types":["company"],'
            '"industries":["restaurant"],'
            '"locations":["Tunis"],'
            '"target_roles":[],'
            '"sources":["maps"],'
            '"source_forced":false,'
            '"max_leads":5,'
            '"reasoning_summary":""}'
        )

    class FakeRateLimit(
        Exception
    ):
        code = 429

        def __str__(
            self,
        ):
            return (
                "HTTP 429 "
                "RESOURCE_EXHAUSTED quota"
            )

    class FakeModels:
        def __init__(
            self,
            outcome,
        ):
            self.outcome = (
                outcome
            )

            self.calls = 0

        def generate_content(
            self,
            **kwargs,
        ):
            self.calls += 1

            if isinstance(
                self.outcome,
                Exception,
            ):
                raise self.outcome

            return self.outcome

    class FakeClient:
        def __init__(
            self,
            outcome,
        ):
            self.models = (
                GeminiQuotaTests
                .FakeModels(
                    outcome
                )
            )

    def setUp(self):
        GEMINI_CIRCUIT_BREAKER.opened_until = 0.0

    def tearDown(self):
        GEMINI_CIRCUIT_BREAKER.opened_until = 0.0

    def test_success_uses_exactly_one_call(self):
        state = (
            GeminiRuntimeState()
        )

        client = (
            self.FakeClient(
                self.FakeResponse()
            )
        )

        result = safe_gemini_generate(
            prompt="test",
            client=client,
            model="gemini-test",
            schema=IntentSchema,
            runtime_state=state,
        )

        self.assertTrue(
            result["success"]
        )

        self.assertEqual(
            state.status,
            GEMINI_STATUS_SUCCESS,
        )

        self.assertEqual(
            state.calls,
            1,
        )

        self.assertEqual(
            client.models.calls,
            1,
        )

    def test_429_does_not_retry(self):
        state = (
            GeminiRuntimeState()
        )

        client = (
            self.FakeClient(
                self.FakeRateLimit()
            )
        )

        result = safe_gemini_generate(
            prompt="test",
            client=client,
            model="gemini-test",
            schema=IntentSchema,
            runtime_state=state,
        )

        self.assertFalse(
            result["success"]
        )

        self.assertEqual(
            state.status,
            GEMINI_STATUS_RATE_LIMITED,
        )

        self.assertEqual(
            state.calls,
            1,
        )

        self.assertEqual(
            client.models.calls,
            1,
        )

        self.assertTrue(
            GEMINI_CIRCUIT_BREAKER.is_open()
        )

    def test_open_circuit_does_not_call_gemini(self):
        GEMINI_CIRCUIT_BREAKER.record_rate_limit()

        state = (
            GeminiRuntimeState()
        )

        client = (
            self.FakeClient(
                self.FakeResponse()
            )
        )

        result = safe_gemini_generate(
            prompt="test",
            client=client,
            model="gemini-test",
            schema=IntentSchema,
            runtime_state=state,
        )

        self.assertFalse(
            result["success"]
        )

        self.assertEqual(
            result["error"],
            "gemini_circuit_open",
        )

        self.assertEqual(
            state.calls,
            0,
        )

        self.assertEqual(
            client.models.calls,
            0,
        )

    @override_settings(
        PROSPECTION_GEMINI_API_KEY="secret-test-key",
        GEMINI_API_KEY="secret-test-key",
    )
    def test_api_key_is_never_returned_in_error(self):
        class SecretError(
            Exception
        ):
            code = 429

            def __str__(
                self,
            ):
                return (
                    "HTTP 429 "
                    "secret-test-key"
                )

        state = (
            GeminiRuntimeState()
        )

        client = (
            self.FakeClient(
                SecretError()
            )
        )

        result = safe_gemini_generate(
            prompt="test",
            client=client,
            model="gemini-test",
            schema=IntentSchema,
            runtime_state=state,
        )

        self.assertNotIn(
            "secret-test-key",
            json.dumps(
                result
            ),
        )


# ============================================================
# AGENT DECISIONS
# ============================================================

class AgentDecisionTests(
    SimpleTestCase
):
    def setUp(self):
        GEMINI_CIRCUIT_BREAKER.opened_until = 0.0

    def tearDown(self):
        GEMINI_CIRCUIT_BREAKER.opened_until = 0.0

    @staticmethod
    def _brain_for_decision_tests():
        brain = object.__new__(GeminiBrain)
        brain.gemini_state = GeminiRuntimeState()
        brain.client = object()
        brain.model = "gemini-test"
        brain.gemini_key_source = "test"
        return brain

    @staticmethod
    def _memory_for_decision_tests():
        memory = AgentMemory(
            query="Trouver des entreprises en Tunisie",
            company_id=1,
            user_id=1,
        )
        memory.intent = {
            "objective": "prospection",
            "lead_types": ["company"],
            "industries": ["technology"],
            "locations": ["Tunisie"],
            "target_roles": [],
            "sources": ["general"],
            "search_keywords": [
                "technology",
                "technology company",
            ],
            "source_forced": False,
            "max_leads": 2,
            "reasoning_summary": "",
        }
        memory.plan = build_search_plan(memory.intent)
        memory.max_leads = 2
        memory.max_iterations = 10
        memory.max_decision_calls = 2
        return memory

    def test_no_gemini_call_when_target_already_reached(self):
        memory = self._memory_for_decision_tests()
        memory.max_leads = 1
        memory.companies.append(
            {
                "lead_type": "company",
                "company_name": "Valid Tunisia Company",
                "crm_ready": True,
            }
        )

        brain = self._brain_for_decision_tests()

        with patch(
            "agentProspection.agent.brain.safe_gemini_generate"
        ) as gemini_mock:
            decision = async_to_sync(
                brain.decide_next_action
            )(
                memory,
                allowed_actions=[
                    "continue_same_strategy",
                    "stop",
                ],
                allowed_sources=[],
            )

        gemini_mock.assert_not_called()
        self.assertEqual(decision["decision"], "stop")
        self.assertEqual(memory.decision_calls_used, 0)

    def test_decision_call_respects_budget_cap(self):
        memory = self._memory_for_decision_tests()
        brain = self._brain_for_decision_tests()

        response = {
            "success": True,
            "text": (
                '{"decision":"continue_same_strategy",'
                '"source":"",'
                '"reason":"Continuer la stratégie actuelle.",'
                '"confidence":0.8}'
            ),
            "error": None,
        }

        with patch(
            "agentProspection.agent.brain.safe_gemini_generate",
            return_value=response,
        ) as gemini_mock:
            first = async_to_sync(
                brain.decide_next_action
            )(
                memory,
                allowed_actions=[
                    "continue_same_strategy",
                    "stop",
                ],
                allowed_sources=[],
            )

            second = async_to_sync(
                brain.decide_next_action
            )(
                memory,
                allowed_actions=[
                    "continue_same_strategy",
                    "stop",
                ],
                allowed_sources=[],
            )

            third = async_to_sync(
                brain.decide_next_action
            )(
                memory,
                allowed_actions=[
                    "continue_same_strategy",
                    "stop",
                ],
                allowed_sources=[],
            )

        self.assertEqual(first["origin"], "gemini")
        self.assertEqual(second["origin"], "gemini")
        self.assertEqual(third["origin"], "deterministic_fallback")
        self.assertEqual(memory.decision_calls_used, 2)
        self.assertEqual(gemini_mock.call_count, 2)

    def test_invalid_gemini_decision_falls_back_deterministically(self):
        memory = self._memory_for_decision_tests()
        memory.pending_verification.append(
            {
                "lead_type": "company",
                "company_name": "Pending Advertiser",
                "verification_required": True,
            }
        )
        brain = self._brain_for_decision_tests()

        invalid_response = {
            "success": True,
            "text": (
                '{"decision":"invented_action",'
                '"source":"",'
                '"reason":"invalid",'
                '"confidence":0.9}'
            ),
            "error": None,
        }

        with patch(
            "agentProspection.agent.brain.safe_gemini_generate",
            return_value=invalid_response,
        ):
            decision = async_to_sync(
                brain.decide_next_action
            )(
                memory,
                allowed_actions=[
                    "verify_pending_meta_ads",
                    "continue_same_strategy",
                    "stop",
                ],
                allowed_sources=[],
            )

        self.assertEqual(
            decision["decision"],
            "verify_pending_meta_ads",
        )
        self.assertEqual(
            decision["origin"],
            "deterministic_fallback",
        )
        self.assertEqual(memory.decision_calls_used, 1)

    def test_decision_changes_behavior(self):
        intent = {
            "objective": "prospection",
            "lead_types": ["company"],
            "industries": ["technology"],
            "locations": ["Tunisie"],
            "target_roles": [],
            "sources": ["general"],
            "search_keywords": [
                "technology",
                "technology company",
            ],
            "source_forced": False,
            "max_leads": 2,
            "reasoning_summary": "",
        }

        async def fake_extract_intent(_self, _query):
            return dict(intent)

        async def fake_initial_search(_memory, tools=None):
            return []

        async def fake_broaden(memory, tools=None):
            memory.iterations += 1
            memory.add_tool_call(
                "serper_general",
                {
                    "q": "technology company Tunisie",
                    "page": 1,
                },
                memory.decision,
            )
            return {
                "success": True,
                "tool": "serper_general",
                "results": [],
            }

        async def stop_decision(
            _self,
            _memory,
            allowed_actions,
            allowed_sources=None,
        ):
            return {
                "decision": "stop",
                "source": "",
                "reason": "Stop test",
                "confidence": 1.0,
                "origin": "test",
            }

        decisions = iter(
            [
                {
                    "decision": "broaden_criteria",
                    "source": "",
                    "reason": "Tester une variante métier.",
                    "confidence": 0.9,
                    "origin": "test",
                },
                {
                    "decision": "stop",
                    "source": "",
                    "reason": "Stop après adaptation.",
                    "confidence": 1.0,
                    "origin": "test",
                },
            ]
        )

        async def broaden_then_stop(
            _self,
            _memory,
            allowed_actions,
            allowed_sources=None,
        ):
            return next(decisions)

        common_patches = [
            patch(
                "agentProspection.agent.loop_controller.GeminiBrain.extract_intent",
                new=fake_extract_intent,
            ),
            patch(
                "agentProspection.agent.loop_controller.execute_search_plan",
                new=fake_initial_search,
            ),
            patch(
                "agentProspection.agent.loop_controller.execute_broadened_search",
                new=fake_broaden,
            ),
        ]

        with common_patches[0], common_patches[1], common_patches[2], patch(
            "agentProspection.agent.loop_controller.GeminiBrain.decide_next_action",
            new=stop_decision,
        ):
            result_stop = async_to_sync(run_agent)(
                query="Trouver 2 entreprises technology",
                tenant_company_id=1,
                user_id=1,
                max_results=2,
            )

        # Recréer les patchers : un patcher ne doit pas être réutilisé.
        with patch(
            "agentProspection.agent.loop_controller.GeminiBrain.extract_intent",
            new=fake_extract_intent,
        ), patch(
            "agentProspection.agent.loop_controller.execute_search_plan",
            new=fake_initial_search,
        ), patch(
            "agentProspection.agent.loop_controller.execute_broadened_search",
            new=fake_broaden,
        ) as broaden_mock, patch(
            "agentProspection.agent.loop_controller.GeminiBrain.decide_next_action",
            new=broaden_then_stop,
        ):
            result_broaden = async_to_sync(run_agent)(
                query="Trouver 2 entreprises technology",
                tenant_company_id=1,
                user_id=1,
                max_results=2,
            )

        self.assertEqual(
            result_stop["decision_trace"][0]["decision"],
            "stop",
        )
        self.assertEqual(
            result_broaden["decision_trace"][0]["decision"],
            "broaden_criteria",
        )
        self.assertNotEqual(
            result_stop["tool_history"],
            result_broaden["tool_history"],
        )
        self.assertGreaterEqual(
            len(result_broaden["tool_history"]),
            1,
        )


# ============================================================
# LEAD CLASSIFICATION
# ============================================================

class LeadQualificationTests(
    SimpleTestCase
):
    def test_tunisian_linkedin_person_is_valid(self):
        intent = {
            "lead_types":
                ["person"],

            "target_roles":
                ["DevOps Engineer"],

            "industries":
                [],

            "locations":
                ["Tunis"],
        }

        lead = {
            "lead_type":
                "person",

            "full_name":
                "Example DevOps",

            "job_title":
                "DevOps Engineer",

            "linkedin_url":
                "https://tn.linkedin.com/in/example",

            "content":
                "DevOps Engineer Tunisia",
        }

        result = qualify_entity(
            lead,
            intent,
        )

        self.assertTrue(
            result["crm_ready"]
        )

    def test_foreign_linkedin_person_is_rejected(self):
        intent = {
            "lead_types":
                ["person"],

            "target_roles":
                ["DevOps Engineer"],

            "industries":
                [],

            "locations":
                ["Tunis"],
        }

        lead = {
            "lead_type":
                "person",

            "full_name":
                "Foreign DevOps",

            "job_title":
                "DevOps Engineer",

            "linkedin_url":
                "https://fr.linkedin.com/in/example",

            "content":
                (
                    "DevOps Engineer "
                    "Location Paris"
                ),
        }

        result = qualify_entity(
            lead,
            intent,
        )

        self.assertFalse(
            result["crm_ready"]
        )

        self.assertEqual(
            result[
                "location_status"
            ],
            "incompatible",
        )

    def test_tunisian_phone_confirms_compatibility(self):
        intent = {
            "lead_types":
                ["person"],

            "target_roles":
                ["DevOps Engineer"],

            "industries":
                [],

            "locations":
                ["Tunis"],
        }

        lead = {
            "lead_type":
                "person",

            "full_name":
                "Barkaoui Test",

            "job_title":
                "DevOps Engineer",

            "linkedin_url":
                "https://linkedin.com/in/test",

            "phone":
                "+21651757097",

            "email":
                "test@supcom.tn",
        }

        result = qualify_entity(
            lead,
            intent,
        )

        self.assertEqual(
            result[
                "location_status"
            ],
            "compatible",
        )

        self.assertTrue(
            result["crm_ready"]
        )

    def test_meta_ad_text_does_not_prove_sector(self):
        intent = {
            "lead_types":
                ["company"],

            "industries":
                ["cosmetics"],

            "locations":
                ["Tunisie"],
        }

        lead = normalize_meta_ads_result(
            {
                "advertiser_name":
                    "Magazine Test",

                "page_id":
                    "123",

                "facebook_url":
                    "https://facebook.com/123",

                "ad_text":
                    (
                        "Get free cosmetics "
                        "for sharing your opinion"
                    ),

                "ad_reached_countries":
                    ["TN"],
            }
        )

        result = qualify_entity(
            lead,
            intent,
        )

        self.assertFalse(
            result["sector_match"]
        )

        self.assertTrue(
            result[
                "verification_required"
            ]
        )

        self.assertFalse(
            result["crm_ready"]
        )

    def test_meta_reached_country_does_not_confirm_location(self):
        intent = {
            "lead_types":
                ["company"],

            "industries":
                ["cosmetics"],

            "locations":
                ["Tunisie"],
        }

        lead = {
            "lead_type":
                "company",

            "company_name":
                "Global Beauty",

            "source":
                "meta_ads_library",

            "facebook_url":
                "https://facebook.com/globalbeauty",

            "ad_reached_countries":
                ["TN"],
        }

        self.assertEqual(
            location_status(
                lead,
                intent,
            ),
            "unknown",
        )


# ============================================================
# SERPER
# ============================================================

class SerperNormalizationTests(
    SimpleTestCase
):
    def test_linkedin_person_query_uses_in_path(self):
        query = (
            build_serper_search_query(
                "DevOps Engineer Tunis",
                "linkedin",
                "person",
            )
        )

        self.assertEqual(
            query,
            (
                "site:linkedin.com/in "
                "DevOps Engineer Tunis"
            ),
        )

    def test_linkedin_company_query_uses_company_path(self):
        query = (
            build_serper_search_query(
                "cybersecurity Tunisie",
                "linkedin",
                "company",
            )
        )

        self.assertEqual(
            query,
            (
                "site:linkedin.com/company "
                "cybersecurity Tunisie"
            ),
        )

    def test_serper_extracts_tunisian_contact_from_snippet(self):
        result = normalize_result(
            {
                "title":
                    (
                        "Barkaoui Chaker - "
                        "System & DevOps Engineer"
                    ),

                "link":
                    (
                        "https://www.linkedin.com/"
                        "in/barkaoui-chaker"
                    ),

                "snippet":
                    (
                        "DevOps Engineer "
                        "(+216) 51 757 097 "
                        "test@supcom.tn"
                    ),
            },
            "linkedin",
            "person",
        )

        self.assertEqual(
            result["phone"],
            "+21651757097",
        )

        self.assertEqual(
            result["email"],
            "test@supcom.tn",
        )


# ============================================================
# META ADS TOOL
# ============================================================

class MetaAdsToolTests(
    SimpleTestCase
):
    def test_ads_library_registered(self):
        tools = build_tools()

        self.assertIn(
            "ads_library_search",
            tools,
        )

        self.assertIsInstance(
            tools[
                "ads_library_search"
            ],
            MetaAdsLibraryTool,
        )

    def test_tool_registry_is_isolated_per_run(self):
        tools_a = build_tools()
        tools_b = build_tools()

        self.assertIsNot(
            tools_a["serper_general"],
            tools_b["serper_general"],
        )

        self.assertIsNot(
            tools_a["ads_library_search"],
            tools_b["ads_library_search"],
        )

        # Les plateformes Serper d'un même run partagent la même
        # instance, mais jamais entre deux runs.
        self.assertIs(
            tools_a["serper_linkedin"],
            tools_a["serper_general"],
        )

    def test_source_registry_maps_meta_ads(self):
        self.assertEqual(
            SOURCE_TO_TOOL[
                "meta_ads"
            ],
            "ads_library_search",
        )

    def test_meta_ads_schema_mapping(self):
        schema = {
            "type":
                "object",

            "properties": {
                "search_terms": {
                    "type":
                        "string"
                },

                "ad_reached_countries": {
                    "type":
                        "array",

                    "items": {
                        "type":
                            "string"
                    },
                },

                "limit": {
                    "type":
                        "integer"
                },
            },

            "required":
                ["search_terms"],
        }

        args = build_args_from_schema(
            schema,
            {
                "q":
                    "cosmetics",

                "ad_reached_countries":
                    ["TN"],
            },
        )

        self.assertEqual(
            args[
                "search_terms"
            ],
            "cosmetics",
        )

        self.assertEqual(
            args[
                "ad_reached_countries"
            ],
            ["TN"],
        )

    def test_meta_ads_results_are_deduplicated_by_page(self):
        items = [
            {
                "ad_id":
                    "1",

                "advertiser_name":
                    "Beauty Store",

                "page_id":
                    "123",

                "ad_text":
                    "A",
            },
            {
                "ad_id":
                    "2",

                "advertiser_name":
                    "Beauty Store",

                "page_id":
                    "123",

                "ad_text":
                    "B",
            },
        ]

        result = (
            dedupe_meta_ads_candidates(
                items
            )
        )

        self.assertEqual(
            len(result),
            1,
        )

        self.assertEqual(
            result[0][
                "meta_ads_count"
            ],
            2,
        )

    def test_meta_ads_country_is_not_invented(self):
        result = (
            normalize_meta_ads_result(
                {
                    "advertiser_name":
                        "Global Beauty",

                    "page_id":
                        "123",

                    "ad_reached_countries":
                        ["TN"],
                }
            )
        )

        self.assertIsNone(
            result["country"]
        )

        self.assertEqual(
            result[
                "ad_reached_countries"
            ],
            ["TN"],
        )

    def test_meta_token_removed_from_url(self):
        value = sanitize_meta_url(
            (
                "https://example.test/"
                "?id=1&access_token=SECRET"
            )
        )

        self.assertNotIn(
            "SECRET",
            value,
        )

        self.assertNotIn(
            "access_token",
            value,
        )

    def test_meta_token_removed_recursively(self):
        payload = {
            "url":
                (
                    "https://example.test/"
                    "?access_token=SECRET"
                ),

            "raw": {
                "access_token":
                    "SECRET"
            },
        }

        result = sanitize_meta_payload(
            payload
        )

        serialized = json.dumps(
            result
        )

        self.assertNotIn(
            "SECRET",
            serialized,
        )


# ============================================================
# OBSERVATION / META PENDING
# ============================================================

class DiscoveryObservationTests(
    SimpleTestCase
):
    def test_meta_ads_candidate_goes_to_pending_verification(self):
        memory = AgentMemory(
            query=(
                "Trouver marques "
                "cosmétiques"
            ),
            company_id=1,
            user_id=1,
        )

        memory.intent = {
            "lead_types":
                ["company"],

            "industries":
                ["cosmetics"],

            "locations":
                ["Tunisie"],
        }

        meta = normalize_meta_ads_result(
            {
                "advertiser_name":
                    "Magazine Test",

                "page_id":
                    "123",

                "ad_text":
                    "cosmetics",

                "ad_reached_countries":
                    ["TN"],
            }
        )

        observe_tool_result(
            memory,
            {
                "success":
                    True,

                "tool":
                    "ads_library_search",

                "status":
                    "ok",

                "results":
                    [meta],

                "errors":
                    [],
            },
        )

        self.assertEqual(
            len(
                memory.companies
            ),
            0,
        )

        self.assertEqual(
            len(
                memory.pending_verification
            ),
            1,
        )

    def test_valid_serper_company_is_added(self):
        memory = AgentMemory(
            query="cybersecurity Tunisie",
            company_id=1,
            user_id=1,
        )

        memory.intent = {
            "lead_types":
                ["company"],

            "industries":
                ["cybersecurity"],

            "locations":
                ["Tunisie"],
        }

        observe_tool_result(
            memory,
            {
                "success":
                    True,

                "tool":
                    "serper_linkedin",

                "status":
                    "ok",

                "results": [
                    {
                        "lead_type":
                            "company",

                        "company_name":
                            "CyberSec Tunisia",

                        "linkedin_url":
                            (
                                "https://tn.linkedin.com/"
                                "company/cybersec"
                            ),

                        "content":
                            (
                                "Cybersecurity company "
                                "Tunisia"
                            ),

                        "source":
                            "serper_linkedin",
                    }
                ],

                "errors":
                    [],
            },
        )

        self.assertEqual(
            len(
                memory.companies
            ),
            1,
        )

        self.assertTrue(
            memory.companies[0][
                "crm_ready"
            ]
        )


# ============================================================
# EXECUTE TOOL
# ============================================================

class ToolExecutionTests(
    SimpleTestCase
):
    def test_serper_tool_execution(self):
        async def fake_run(
            query,
            platform=None,
        ):
            return [
                {
                    "company_name": "Cyber Tunisia",
                    "website": "https://cyber.tn",
                    "source": "serper_general",
                }
            ]

        tools = build_tools()

        with patch.object(
            tools["serper_general"],
            "run",
            new=fake_run,
        ):
            result = async_to_sync(
                execute_tool
            )(
                "serper_general",
                {
                    "q": "cybersecurity Tunisie",
                    "page": 1,
                },
                tools=tools,
            )

        self.assertTrue(
            result["success"]
        )

        self.assertEqual(
            len(result["results"]),
            1,
        )

    def test_meta_ads_does_not_call_scoring(self):
        async def fake_meta(
            query,
        ):
            return [
                {
                    "company_name": "Beauty Test",
                    "facebook_url": "https://facebook.com/test",
                    "source": "meta_ads_library",
                }
            ]

        tools = build_tools()

        with patch.object(
            tools["ads_library_search"],
            "run",
            new=fake_meta,
        ), patch(
            "agentProspection.services.scoring_service.calculate_score"
        ) as score_mock:
            result = async_to_sync(
                execute_tool
            )(
                "ads_library_search",
                {
                    "q": "cosmetics"
                },
                tools=tools,
            )

        self.assertTrue(
            result["success"]
        )

        score_mock.assert_not_called()


# ============================================================
# FUSION
# ============================================================

class FusionTests(
    SimpleTestCase
):
    def test_same_company_can_merge_meta_and_serper(self):
        meta = {
            "company_name":
                "Beauty Tunisia",

            "facebook_url":
                "https://facebook.com/beautytn",

            "source":
                "meta_ads_library",
        }

        serper = {
            "company_name":
                "Beauty Tunisia",

            "facebook_url":
                "https://facebook.com/beautytn",

            "website":
                "https://beautytn.tn",

            "source":
                "serper_facebook",
        }

        self.assertTrue(
            is_same_company(
                meta,
                serper,
            )
        )

        merged = merge_leads(
            meta,
            serper,
        )

        self.assertEqual(
            merged["website"],
            "https://beautytn.tn",
        )





# ============================================================
# SCORING
# ============================================================

class ScoringServiceTests(
    TestCase
):
    def setUp(self):
        self.user = (
            User.objects.create_user(
                email=
                    "score@example.com",

                username=
                    "score",

                password=
                    "password",
            )
        )

        self.crm_company = (
            Company.objects.create(
                owner=
                    self.user,

                name=
                    "Score Tenant",
            )
        )

        self.user.company = (
            self.crm_company
        )

        self.user.save(
            update_fields=[
                "company"
            ]
        )

        self.company = (
            ProspectCompany.objects.create(
                name=
                    "ScoreCo",

                company=
                    self.crm_company,

                website=
                    "https://score.tn",

                linkedin_url=
                    (
                        "https://linkedin.com/"
                        "company/score"
                    ),
            )
        )

        self.prospect = (
            Prospect.objects.create(
                first_name=
                    "Ada",

                last_name=
                    "Test",

                company=
                    self.crm_company,

                prospect_company=
                    self.company,

                assigned_to=
                    self.user,

                email=
                    "ada@score.tn",

                phone=
                    "+21671000000",

                website=
                    "https://score.tn",

                linkedin_url=
                    (
                        "https://linkedin.com/"
                        "in/ada"
                    ),
            )
        )

    def test_score_is_independent(self):
        result = calculate_score(
            self.prospect
        )

        self.assertIn(
            "score",
            result,
        )

    def test_score_does_not_call_gemini(self):
        with patch(
            (
                "agentProspection.agent."
                "brain.safe_gemini_generate"
            )
        ) as gemini:

            calculate_score(
                self.prospect
            )

        gemini.assert_not_called()


# ============================================================
# TENANT / API
# ============================================================

class ProspectAgentEndpointTenantTests(
    TestCase
):
    def setUp(self):
        self.client = (
            APIClient()
        )

        self.user = (
            User.objects.create_user(
                email=
                    "tenant@example.com",

                username=
                    "tenant",

                password=
                    "password",
            )
        )

        self.company = (
            Company.objects.create(
                owner=
                    self.user,

                name=
                    "Tenant Tunisia",
            )
        )

        self.user.company = (
            self.company
        )

        self.user.save(
            update_fields=[
                "company"
            ]
        )

    def test_get_user_company(self):
        self.assertEqual(
            get_user_company(
                self.user
            ),
            self.company,
        )

    def test_agent_requires_authentication(self):
        response = (
            self.client.post(
                "/api/agent/prospect/",
                {
                    "query":
                        "restaurants Tunis"
                },
                format=
                    "json",
            )
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_foreign_query_is_not_supported_by_brain(self):
        brain = object.__new__(
            GeminiBrain
        )

        brain.gemini_state = (
            GeminiRuntimeState()
        )

        brain.client = None
        brain.model = (
            "gemini-test"
        )

        brain.gemini_key_source = (
            "none"
        )

        with self.assertRaises(
            ValueError
        ):
            async_to_sync(
                brain.extract_intent
            )(
                (
                    "Trouver des entreprises "
                    "à Paris"
                )
            )