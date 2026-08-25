import os
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from agentEngagement.models import EngagementLog
from users.models import Company, User
from .models import (
    Prospect,
    ProspectActivity,
    ProspectAgentRun,
    ProspectCompany,
    ProspectDocument,
    ProspectRecommendation,
    ProspectScoreHistory,
)


@override_settings(MEDIA_ROOT=os.path.join(tempfile.gettempdir(), "crm-pfe-test-media"))
class Prospect360ApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="admin@example.com",
            username="admin",
            password="pass",
            role="ADMIN",
            is_verified=True,
        )
        self.company = Company.objects.create(owner=self.owner, name="Acme CRM")
        self.owner.company = self.company
        self.owner.save(update_fields=["company"])
        self.prospect_company = ProspectCompany.objects.create(
            name="TravelPro",
            industry="Tourisme",
            company=self.company,
            score_ia=40,
            evaluation="warm",
        )
        self.prospect = Prospect.objects.create(
            first_name="Mohamed",
            last_name="Ben Ali",
            email="mohamed@example.com",
            phone="22222222",
            status="new",
            evaluation="warm",
            prospect_company=self.prospect_company,
            assigned_to=self.owner,
            company=self.company,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_legacy_prospect_endpoint_still_works(self):
        response = self.client.get(f"/api/sales/prospects/{self.prospect.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "mohamed@example.com")

    def test_create_activity_links_to_prospect_and_creates_score_history(self):
        response = self.client.post(
            f"/api/sales/prospects/{self.prospect.id}/activity-stream/",
            {
                "activity_type": "reply_received",
                "channel": "instagram",
                "title": "Réponse Instagram reçue",
                "description": "Pouvez-vous envoyer une présentation ?",
                "metadata": {"source_message_id": "abc"},
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ProspectActivity.objects.filter(prospect=self.prospect).count(), 1)
        self.assertEqual(ProspectScoreHistory.objects.filter(prospect=self.prospect).count(), 1)

    def test_upload_and_read_document(self):
        upload = SimpleUploadedFile("presentation.txt", b"hello", content_type="text/plain")
        response = self.client.post(
            f"/api/sales/prospects/{self.prospect.id}/documents/",
            {
                "name": "Présentation",
                "document_type": "presentation",
                "description": "Document de test",
                "file": upload,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ProspectDocument.objects.filter(prospect=self.prospect).count(), 1)
        list_response = self.client.get(f"/api/sales/prospects/{self.prospect.id}/documents/")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)

    def test_document_delete_requires_permission(self):
        commercial = User.objects.create_user(
            email="commercial@example.com",
            username="commercial",
            password="pass",
            role="COMMERCIAL",
            company=self.company,
            is_verified=True,
        )
        self.prospect.assigned_to = commercial
        self.prospect.save(update_fields=["assigned_to"])
        document = ProspectDocument.objects.create(
            prospect=self.prospect,
            name="Devis",
            document_type="quote",
            file=SimpleUploadedFile("devis.txt", b"quote"),
            uploaded_by=self.owner,
            source="manual",
        )
        self.client.force_authenticate(commercial)
        response = self.client.delete(
            f"/api/sales/prospects/{self.prospect.id}/documents/{document.id}/"
        )
        self.assertEqual(response.status_code, 403)

    def test_engagement_logs_are_exposed(self):
        EngagementLog.objects.create(
            prospect=self.prospect,
            user=self.owner,
            company=self.company,
            action="message_sent",
            channel="instagram",
            message="Bonjour, voici notre présentation.",
            status="sent",
        )
        response = self.client.get(f"/api/sales/prospects/{self.prospect.id}/engagement/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["action"], "message_sent")

    def test_agent_run_and_recommendations_are_exposed(self):
        ProspectAgentRun.objects.create(
            prospect=self.prospect,
            agent_type="enrichment",
            status="completed",
            output_summary="Email trouvé",
        )
        ProspectRecommendation.objects.create(
            prospect=self.prospect,
            title="Envoyer une présentation",
            recommendation_type="send_presentation",
            priority="high",
        )
        runs = self.client.get(f"/api/sales/prospects/{self.prospect.id}/agent-runs/")
        recommendations = self.client.get(f"/api/sales/prospects/{self.prospect.id}/recommendations/")
        self.assertEqual(runs.status_code, 200)
        self.assertEqual(recommendations.status_code, 200)
        self.assertEqual(runs.data[0]["agent_type"], "enrichment")
        self.assertTrue(any(item["title"] == "Envoyer une présentation" for item in recommendations.data))
