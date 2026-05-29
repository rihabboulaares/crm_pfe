from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from asgiref.sync import async_to_sync
from unittest.mock import patch

from agentProspection.agent.lead_classifier import qualify_entity
from agentProspection.crm.importer import save_result_to_crm
from agentProspection.tenant import get_user_company
from agentProspection.tools.profile_scraper import (
    ProfileScraperTool,
    SocialSessionManager,
    browser_profile_dir,
    evaluate_scrape_quality,
)
from sales.models import Prospect, ProspectCompany
from users.models import Company, User


class LeadQualificationTests(SimpleTestCase):
    def test_linkedin_person_without_email_or_phone_is_valid(self):
        intent = {
            "lead_types": ["person"],
            "target_roles": ["CTO"],
            "industries": ["startup fintech"],
            "locations": ["Tunisie"],
        }
        lead = {
            "lead_type": "person",
            "full_name": "Mohamed Bouchair",
            "title": "CTO, PMO, IS Expert",
            "linkedin_url": "https://tn.linkedin.com/in/mohamedbouchair/en",
            "content": "CTO fintech startup Tunisia",
            "email": None,
            "phone": None,
            "country": "Tunisie",
        }

        qualified = qualify_entity(lead, intent)

        self.assertTrue(qualified["is_valid"])
        self.assertTrue(qualified["crm_ready"])
        self.assertEqual(qualified["enrichment_status"], "needs_enrichment")

    def test_person_with_incompatible_role_is_invalid(self):
        intent = {
            "lead_types": ["person"],
            "target_roles": ["CTO"],
            "industries": ["startup fintech"],
            "locations": ["Tunisie"],
        }
        lead = {
            "lead_type": "person",
            "full_name": "Example Person",
            "title": "Chef de cuisine",
            "linkedin_url": "https://tn.linkedin.com/in/example",
            "content": "Restaurant Tunis",
            "country": "Tunisie",
        }

        qualified = qualify_entity(lead, intent)

        self.assertFalse(qualified["is_valid"])
        self.assertFalse(qualified["crm_ready"])

    def test_company_with_website_only_is_valid(self):
        intent = {
            "lead_types": ["company"],
            "industries": ["startup fintech"],
            "locations": ["Tunisie"],
        }
        lead = {
            "lead_type": "company",
            "company_name": "Fintech Startup TN",
            "website": "https://fintechstartup.tn",
            "content": "Startup fintech basee en Tunisie",
            "email": None,
            "phone": None,
        }

        qualified = qualify_entity(lead, intent)

        self.assertTrue(qualified["is_valid"])
        self.assertTrue(qualified["crm_ready"])
        self.assertEqual(qualified["enrichment_status"], "needs_enrichment")

    def test_maps_restaurant_without_email_is_valid(self):
        intent = {
            "lead_types": ["company"],
            "industries": ["restaurant"],
            "locations": ["Tunis"],
        }
        lead = {
            "lead_type": "company",
            "company_name": "Restaurant Tunis",
            "industry": "Restaurant",
            "city": "Tunis",
            "google_maps_url": "https://maps.google.com/?cid=123",
            "email": None,
        }

        qualified = qualify_entity(lead, intent)

        self.assertTrue(qualified["is_valid"])
        self.assertTrue(qualified["crm_ready"])


class ScrapeQualityTests(SimpleTestCase):
    def test_linkedin_status_999_with_content_is_successful(self):
        debug = {
            "status": 999,
            "title": "LinkedIn Profile",
            "html_length": 12000,
            "text_length": 650,
            "text_preview": "CTO fintech startup Tunisia " * 20,
        }

        evaluated = evaluate_scrape_quality(debug)

        self.assertTrue(evaluated["scraping_success"])
        self.assertFalse(evaluated["blocked"])

    def test_empty_page_is_not_successful(self):
        debug = {
            "status": None,
            "title": "",
            "html_length": 0,
            "text_length": 0,
            "text_preview": "",
        }

        evaluated = evaluate_scrape_quality(debug)

        self.assertFalse(evaluated["scraping_success"])
        self.assertTrue(evaluated["blocked"])

    def test_social_browser_profile_is_scoped_by_user_and_platform(self):
        self.assertEqual(
            browser_profile_dir(12, "instagram").replace("\\", "/"),
            "browser_profiles/user_12/instagram",
        )
        self.assertEqual(
            browser_profile_dir(12, "linkedin").replace("\\", "/"),
            "browser_profiles/user_12/linkedin",
        )

    def test_social_login_fallback_is_non_blocking_result(self):
        data = ProfileScraperTool().fallback(
            "https://www.instagram.com/example/",
            "instagram",
            "Connexion manuelle requise",
            requires_login=True,
        )

        self.assertFalse(data["scraping_debug"]["scraping_success"])
        self.assertTrue(data["requires_login"])
        self.assertTrue(data["scrape_blocked"])
        self.assertEqual(data["scraping_debug"]["step"], "manual_login_required")

    def test_social_session_manager_checks_login_once_per_platform(self):
        class FakePage:
            async def goto(self, *args, **kwargs):
                return None

            async def wait_for_timeout(self, *args, **kwargs):
                return None

            async def close(self):
                return None

        class FakeContext:
            def __init__(self):
                self.pages_created = 0

            async def new_page(self):
                self.pages_created += 1
                return FakePage()

        async def run_case():
            manager = SocialSessionManager(user_id=12)
            context = FakeContext()

            async def fake_get_context(platform):
                return context

            manager.get_context = fake_get_context

            with patch("agentProspection.tools.profile_scraper.is_login_required") as mocked:
                mocked.return_value = False
                first = await manager.ensure_login_once("instagram", "https://www.instagram.com/example/")
                second = await manager.ensure_login_once("instagram", "https://www.instagram.com/another/")

            return first, second, mocked.call_count, context.pages_created

        first, second, login_checks, pages_created = async_to_sync(run_case)()

        self.assertTrue(first)
        self.assertTrue(second)
        self.assertEqual(login_checks, 1)
        self.assertEqual(pages_created, 1)


class SaveResultToCrmTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="commercial@example.com",
            username="commercial",
            password="password",
            role=User.Role.COMMERCIAL,
        )
        self.crm_company = Company.objects.create(
            owner=self.user,
            name="CRM Test",
            company_created=True,
        )
        self.user.company = self.crm_company
        self.user.save(update_fields=["company"])

    def test_company_only_restaurant_creates_identifiable_contact_prospect(self):
        prospect = save_result_to_crm(
            {
                "company_name": "Restaurant La Terrasse",
                "city": "Tunis",
                "country": "Tunisie",
                "google_maps_url": "https://maps.google.com/?cid=terrasse",
                "source": "google_maps",
            },
            self.user.id,
            self.crm_company.id,
        )

        company = ProspectCompany.objects.get(name="Restaurant La Terrasse")

        self.assertEqual(prospect.prospect_company, company)
        self.assertEqual(prospect.first_name, "Contact")
        self.assertEqual(prospect.last_name, "Restaurant La Terrasse")
        self.assertEqual(f"{prospect.first_name} {prospect.last_name}", "Contact Restaurant La Terrasse")
        self.assertEqual(prospect.title, "Contact principal non identifie")

    def test_company_only_clinics_never_create_unknown_unknown(self):
        for name in ["Clinique El Amen", "Clinique Y", "Clinique Z"]:
            save_result_to_crm(
                {
                    "company_name": name,
                    "city": "Sousse",
                    "website": f"https://{name.lower().replace(' ', '-')}.tn",
                },
                self.user.id,
                self.crm_company.id,
            )

        names = {f"{p.first_name} {p.last_name}" for p in Prospect.objects.all()}

        self.assertIn("Contact Clinique El Amen", names)
        self.assertIn("Contact Clinique Y", names)
        self.assertIn("Contact Clinique Z", names)
        self.assertNotIn("Inconnu Inconnu", names)
        self.assertNotIn("inconnu inconnu", {name.lower() for name in names})

    def test_human_contact_creates_normal_person_linked_to_company(self):
        prospect = save_result_to_crm(
            {
                "company_name": "GeniusTalks",
                "first_name": "Mohamed",
                "last_name": "Ben Ali",
                "title": "Responsable RH",
                "linkedin_url": "https://tn.linkedin.com/in/mohamed-ben-ali",
                "source": "linkedin",
            },
            self.user.id,
            self.crm_company.id,
        )

        self.assertEqual(prospect.first_name, "Mohamed")
        self.assertEqual(prospect.last_name, "Ben Ali")
        self.assertEqual(prospect.title, "Responsable RH")
        self.assertEqual(prospect.prospect_company.name, "GeniusTalks")

    def test_running_same_company_result_twice_updates_without_duplicates(self):
        result = {
            "company_name": "Startup AlphaTech",
            "website": "https://alphatech.tn",
            "city": "Tunis",
        }

        first = save_result_to_crm(result, self.user.id, self.crm_company.id)
        second = save_result_to_crm(
            {**result, "phone": "+216 71 000 000"},
            self.user.id,
            self.crm_company.id,
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(ProspectCompany.objects.filter(name="Startup AlphaTech").count(), 1)
        self.assertEqual(Prospect.objects.filter(first_name="Contact", last_name="Startup AlphaTech").count(), 1)
        self.assertEqual(second.phone, "+216 71 000 000")
        self.assertEqual(second.prospect_company.phone, "+216 71 000 000")

    def test_company_without_email_or_phone_but_with_maps_is_accepted(self):
        prospect = save_result_to_crm(
            {
                "company_name": "Cabinet Dr Sami",
                "google_maps_url": "https://maps.google.com/?cid=cabinet-sami",
                "email": None,
                "phone": None,
            },
            self.user.id,
            self.crm_company.id,
        )

        self.assertIsNotNone(prospect)
        self.assertEqual(prospect.first_name, "Contact")
        self.assertEqual(prospect.last_name, "Cabinet Dr Sami")
        self.assertEqual(prospect.prospect_company.google_place_id, "https://maps.google.com/?cid=cabinet-sami")


class ProspectAgentEndpointTenantTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="tenant-user@example.com",
            username="tenantuser",
            password="password",
        )
        self.other_user = User.objects.create_user(
            email="other-user@example.com",
            username="otheruser",
            password="password",
        )
        self.company = Company.objects.create(owner=self.user, name="Tenant A")
        self.other_company = Company.objects.create(owner=self.other_user, name="Tenant B")
        self.user.company = self.company
        self.user.save(update_fields=["company"])
        self.other_user.company = self.other_company
        self.other_user.save(update_fields=["company"])

    def test_get_user_company_reads_user_company(self):
        self.assertEqual(get_user_company(self.user), self.company)

    def test_agent_requires_authenticated_user(self):
        response = self.client.post(
            "/api/agent/prospect/",
            {"query": "trouve des restaurants a Tunis"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["message"], "Utilisateur non authentifie")

    def test_agent_rejects_user_without_company(self):
        self.user.company = None
        self.user.save(update_fields=["company"])
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/agent/prospect/",
            {"query": "trouve des restaurants a Tunis"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["message"], "Aucune societe associee a cet utilisateur")

    def test_agent_ignores_company_id_sent_by_frontend(self):
        self.client.force_authenticate(user=self.user)

        async def fake_run_agent(query, tenant_company_id, user_id):
            return {
                "companies_found": 1,
                "persons_found": 0,
                "import_stats": {"companies_created": 1, "persons_created": 1},
                "received": {
                    "query": query,
                    "tenant_company_id": tenant_company_id,
                    "user_id": user_id,
                },
            }

        with patch("agentProspection.api.views.run_agent", fake_run_agent):
            response = self.client.post(
                "/api/agent/prospect/",
                {
                    "query": "trouve des restaurants a Tunis",
                    "company_id": self.other_company.id,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["company_id"], self.company.id)
        self.assertEqual(response.data["received"]["tenant_company_id"], self.company.id)
        self.assertEqual(response.data["received"]["user_id"], self.user.id)
