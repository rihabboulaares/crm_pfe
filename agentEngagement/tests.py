from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from sales.models import Prospect
from users.models import Company, User

from .email_sender import send_prepared_email
from .memory import save_prepared_message
from .models import UserEmailConnection
from .runner import launch_engagement_agent
from .views import EmailConnectionsView, LaunchEngagementAgentView


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

    def test_save_prepared_message_sets_pending_validation(self):
        prospect = self.make_prospect()
        result = SimpleNamespace(
            message="Bonjour Ada",
            call_script="",
            best_channel="email",
            subject="Contact",
        )

        save_prepared_message(prospect, result)
        prospect.refresh_from_db()

        self.assertEqual(prospect.engagement_status, "pending_validation")
        self.assertEqual(prospect.generated_message, "Bonjour Ada")

    def test_launch_agent_skips_pending_validation_prospects(self):
        new_prospect = self.make_prospect(first_name="New")
        self.make_prospect(first_name="Pending", engagement_status="pending_validation")

        with patch("agentEngagement.runner.prepare_engagement") as prepare_mock:
            prepare_mock.return_value = {
                "success": True,
                "status": "pending_validation",
                "prospect_id": new_prospect.pk,
            }

            result = launch_engagement_agent(self.company, self.owner, limit=25, scrape=True)

        self.assertTrue(result["success"])
        self.assertEqual(result["processed"], 1)
        prepare_mock.assert_called_once()

    @override_settings(ENGAGEMENT_AGENT_AUTO_SEND_ENABLED=False)
    def test_launch_view_rejects_auto_send_without_setting(self):
        request = APIRequestFactory().post(
            "/api/engagement/launch/",
            {"auto_send": True},
            format="json",
        )
        force_authenticate(request, user=self.owner)

        response = LaunchEngagementAgentView.as_view()(request)

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])

    def test_email_send_requires_current_user_connection(self):
        prospect = self.make_prospect()

        result = send_prepared_email(prospect, self.owner, "Contact", "Bonjour Ada")

        self.assertFalse(result["success"])
        self.assertEqual(result["code"], "EMAIL_LOGIN_REQUIRED")

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
