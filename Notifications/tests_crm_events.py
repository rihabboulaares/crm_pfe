from django.test import TestCase
from rest_framework.test import APIClient

from Notifications.crm_event_service import (
    event_from_agent_run,
    event_from_document,
    event_from_prospect_activity,
    event_from_score_history,
    record_crm_event,
)
from Notifications.models import CRMEvent, HistoryLog
from sales.models import (
    Prospect,
    ProspectActivity,
    ProspectAgentRun,
    ProspectCompany,
    ProspectDocument,
    ProspectScoreHistory,
)
from users.models import Company, User


class CRMEventTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin-history@example.com",
            username="admin-history",
            password="pass",
            role="ADMIN",
            is_verified=True,
        )
        self.company = Company.objects.create(owner=self.admin, name="History CRM")
        self.admin.company = self.company
        self.admin.save(update_fields=["company"])
        self.commercial = User.objects.create_user(
            email="commercial-history@example.com",
            username="commercial-history",
            password="pass",
            role="COMMERCIAL",
            company=self.company,
            is_verified=True,
        )
        self.other = User.objects.create_user(
            email="other-history@example.com",
            username="other-history",
            password="pass",
            role="COMMERCIAL",
            company=self.company,
            is_verified=True,
        )
        self.prospect_company = ProspectCompany.objects.create(
            name="TravelPro",
            industry="Tourisme",
            company=self.company,
            score_ia=67,
        )
        self.prospect = Prospect.objects.create(
            first_name="Mohamed",
            last_name="Ben Ali",
            email="mohamed.history@example.com",
            prospect_company=self.prospect_company,
            assigned_to=self.commercial,
            company=self.company,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_record_crm_event_is_idempotent_and_sanitizes_metadata(self):
        baseline = CRMEvent.objects.count()
        first = record_crm_event(
            event_type="reply_received",
            category="engagement",
            title="Réponse reçue",
            source_type="prospect_activity",
            source_id=154,
            user=self.commercial,
            prospect=self.prospect,
            metadata={"channel": "instagram", "access_token": "secret"},
            fail_silently=False,
        )
        second = record_crm_event(
            event_type="reply_received",
            category="engagement",
            title="Réponse reçue doublon",
            source_type="prospect_activity",
            source_id=154,
            user=self.commercial,
            prospect=self.prospect,
            fail_silently=False,
        )
        self.assertEqual(first.id, second.id)
        self.assertEqual(CRMEvent.objects.count(), baseline + 1)
        self.assertEqual(first.metadata["access_token"], "[filtered]")

    def test_business_sources_create_events(self):
        activity = ProspectActivity.objects.create(
            prospect=self.prospect,
            activity_type="reply_received",
            channel="instagram",
            title="Réponse Instagram",
            created_by=self.commercial,
            source="manual",
        )
        score = ProspectScoreHistory.objects.create(
            prospect=self.prospect,
            previous_score=67,
            new_score=82,
            reason="Réponse positive",
            activity=activity,
        )
        run = ProspectAgentRun.objects.create(
            prospect=self.prospect,
            agent_type="engagement",
            status="failed",
            error_message="Erreur contrôlée",
        )
        document = ProspectDocument.objects.create(
            prospect=self.prospect,
            name="Proposition",
            document_type="proposal",
            file="prospect_documents/test.txt",
            uploaded_by=self.commercial,
        )

        event_from_prospect_activity(activity)
        event_from_score_history(score)
        event_from_agent_run(run)
        event_from_document(document)

        self.assertTrue(CRMEvent.objects.filter(event_type="reply_received").exists())
        self.assertTrue(CRMEvent.objects.filter(event_type="score_changed").exists())
        self.assertTrue(CRMEvent.objects.filter(event_type="agent_failed", severity="critical").exists())
        self.assertTrue(CRMEvent.objects.filter(event_type="document_uploaded").exists())

    def test_activity_api_filters_search_pagination_stats_and_export(self):
        baseline = CRMEvent.objects.count()
        for index in range(30):
            record_crm_event(
                event_type="message_sent" if index % 2 else "score_changed",
                category="engagement" if index % 2 else "scoring",
                title=f"Événement TravelPro {index}",
                description="Instagram" if index == 3 else "",
                source_type="manual",
                source_id=f"event-{index}",
                user=self.commercial,
                prospect=self.prospect,
            )

        response = self.client.get("/api/notifications/activity/?page=1&page_size=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], baseline + 30)
        self.assertEqual(len(response.data["results"]), 10)

        filtered = self.client.get("/api/notifications/activity/?category=scoring&search=TravelPro")
        self.assertEqual(filtered.status_code, 200)
        self.assertGreaterEqual(filtered.data["total"], 1)

        stats = self.client.get("/api/notifications/activity/stats/")
        self.assertEqual(stats.status_code, 200)
        self.assertEqual(stats.data["total"], baseline + 30)

        export = self.client.get("/api/notifications/activity/export/?category=scoring")
        self.assertEqual(export.status_code, 200)
        self.assertIn("text/csv", export["Content-Type"])

    def test_permissions_hide_unassigned_commercial_events(self):
        record_crm_event(
            event_type="message_sent",
            category="engagement",
            title="Message envoyé",
            source_type="manual",
            source_id="visible",
            user=self.commercial,
            prospect=self.prospect,
        )
        self.client.force_authenticate(self.other)
        response = self.client.get("/api/notifications/activity/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 0)

    def test_existing_history_endpoint_still_works(self):
        baseline = HistoryLog.objects.count()
        HistoryLog.objects.create(
            actor=self.admin,
            performed_by=self.admin,
            action="create",
            entity_type="prospect",
            entity_id=self.prospect.id,
            entity_name="Mohamed Ben Ali",
            description="Prospect créé",
            company=self.company,
        )
        response = self.client.get("/api/notifications/history/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], baseline + 1)
