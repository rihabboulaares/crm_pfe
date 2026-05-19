from unittest import TestCase
from agentProspection.tools.social_tool import SocialTool
from agentProspection.agent.schemas import SearchCriteria

try:
    from agentProspection.agent.graph import ProspectionGraph
except Exception:  # pragma: no cover - depends on optional LangChain runtime in CI
    ProspectionGraph = None


class FakeSocialTool(SocialTool):
    def __init__(self, items):
        super().__init__()
        self.items = items
        self.queries = []

    def _web_search(self, query: str, max_results: int = 6) -> list[dict]:
        self.queries.append(query)
        items = self.items[:max_results]
        self._record_search_trace(query, "fake", len(items))
        return items


class LinkedinSearchLogicTests(TestCase):
    def test_linkedin_queries_include_role_sector_and_location(self):
        tool = SocialTool()

        queries = tool._linkedin_profile_queries(
            job_title="Responsable RH",
            secteur="IT",
            ville="Tunis",
        )

        joined = " ".join(queries)
        self.assertGreaterEqual(len(queries), 3)
        self.assertIn("site:linkedin.com/in", joined)
        self.assertIn("Tunis", joined)
        self.assertTrue("HR Manager" in joined or "Responsable RH" in joined)
        self.assertTrue("IT" in joined or "informatique" in joined or "software" in joined)

    def test_public_linkedin_profile_is_structured_and_canonicalized(self):
        tool = FakeSocialTool(
            [
                {
                    "title": "Sarah Ben Ali - HR Manager - Tech IT Tunisia | LinkedIn",
                    "href": "https://www.linkedin.com/in/sarah-ben-ali?trk=public_profile",
                    "body": "Tunis, Tunisia. Human Resources Manager in IT.",
                }
            ]
        )

        results = tool.rechercher_profils_publics(
            job_title="Responsable RH",
            secteur="IT",
            ville="Tunis",
            plateformes=["linkedin"],
            max_resultats=5,
        )

        self.assertEqual(len(results), 1)
        prospect = results[0]
        self.assertEqual(prospect["first_name"], "Sarah")
        self.assertEqual(prospect["last_name"], "Ben Ali")
        self.assertEqual(prospect["origin"], "linkedin")
        self.assertEqual(prospect["linkedin_url"], "https://www.linkedin.com/in/sarah-ben-ali")
        self.assertIn("HR Manager", prospect["title"])

    def test_company_linkedin_search_keeps_only_profile_urls(self):
        tool = FakeSocialTool(
            [
                {
                    "title": "Sarah Ben Ali - HR Manager - Tech IT Tunisia | LinkedIn",
                    "href": "https://www.linkedin.com/in/sarah-ben-ali?trk=public_profile",
                    "body": "HR Manager at Tech IT Tunisia, Tunis.",
                },
                {
                    "title": "Tech IT Tunisia: Jobs | LinkedIn",
                    "href": "https://www.linkedin.com/company/tech-it-tunisia/jobs/",
                    "body": "Open jobs.",
                },
            ]
        )

        results = tool.rechercher_prospects(
            company={"nom": "Tech IT Tunisia", "secteur": "IT"},
            job_title="Responsable RH",
            ville="Tunis",
            max_resultats=5,
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["linkedin_url"], "https://www.linkedin.com/in/sarah-ben-ali")
        self.assertTrue(all("site:linkedin.com/in" in query for query in tool.queries))
        self.assertGreater(len(tool.get_trace()), 0)
        self.assertTrue(any(item["source"] == "linkedin_public_index" for item in tool.get_trace()))
        self.assertTrue(any(item["source"] == "linkedin_company_profile_candidates" for item in tool.get_trace()))

    def test_relaxed_company_search_keeps_social_page_with_partial_snippet(self):
        tool = FakeSocialTool(
            [
                {
                    "title": "Growth Agency Tunisia | Facebook",
                    "href": "https://www.facebook.com/growthagencytn/posts/123",
                    "body": "Marketing digital et communication.",
                }
            ]
        )

        results = tool.rechercher_entreprises(
            secteur="marketing",
            ville="Tunis",
            plateformes=["facebook"],
            max_resultats=5,
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["source"], "facebook")
        self.assertEqual(results[0]["facebook_url"], "https://www.facebook.com/growthagencytn/posts/123")
        self.assertTrue(any("facebook_company_candidates" == item["source"] for item in tool.get_trace()))

    def test_web_profile_fallback_extracts_contact_and_source_url(self):
        tool = FakeSocialTool(
            [
                {
                    "title": "Sarah Ben Ali - HR Manager - Growth Agency",
                    "href": "https://growth.example/team/sarah-ben-ali",
                    "body": "Tunis Tunisia. Human Resources Manager in marketing. sarah@growth.example +216 22 333 444",
                }
            ]
        )

        results = tool.rechercher_profils_publics(
            job_title="Responsable RH",
            secteur="marketing",
            ville="Tunis",
            plateformes=["website"],
            max_resultats=5,
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["origin"], "website")
        self.assertEqual(results[0]["source_url"], "https://growth.example/team/sarah-ben-ali")
        self.assertEqual(results[0]["email"], "sarah@growth.example")
        self.assertIn("+216", results[0]["phone"])

    def test_source_normalization_accepts_public_web_aliases(self):
        criteria = SearchCriteria.from_dict({"sources": ["google maps", "web", "linkedin"]})

        self.assertEqual(criteria.sources, ["google_maps", "website", "linkedin"])

    def test_prospect_intent_preserves_selected_company_sources(self):
        if ProspectionGraph is None:
            self.skipTest("ProspectionGraph dependencies are not installed")
        graph = ProspectionGraph.__new__(ProspectionGraph)

        criteria = {
            "query": "Je cherche des responsables RH dans des societes marketing a Tunis",
            "search_type": "company",
            "sources": ["google_maps", "website", "linkedin"],
            "secteur": "restaurant",
            "ville": "tunis",
        }
        result = graph._apply_query_intent_overrides(criteria, {"query": criteria["query"], "sources": criteria["sources"]})

        self.assertEqual(result["search_type"], "prospect")
        self.assertEqual(result["sources"], ["google_maps", "website", "linkedin"])
        self.assertEqual(result["job_title"], "Responsable RH")
