from smtplib import SMTPException
import os
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import PasswordResetCode, TransactionalEmailLog, User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthenticationFlowTests(APITestCase):
    def test_unverified_user_cannot_login(self):
        User.objects.create_user(
            username="pending",
            email="pending@example.com",
            password="StrongPass1!",
            is_verified=False,
        )

        response = self.client.post(
            "/api/users/login/",
            {"email": "pending@example.com", "password": "StrongPass1!"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("non vérifié", response.data["detail"])

    def test_verified_user_can_login(self):
        User.objects.create_user(
            username="verified",
            email="verified@example.com",
            password="StrongPass1!",
            is_verified=True,
        )

        response = self.client.post(
            "/api/users/login/",
            {"email": "verified@example.com", "password": "StrongPass1!"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_register_rolls_back_when_verification_email_fails(self):
        with patch(
            "users.serializers.send_transactional_email",
            return_value=(False, "SMTP unavailable", None),
        ):
            response = self.client.post(
                "/api/users/register/",
                {
                    "username": "new-admin",
                    "email": "new-admin@example.com",
                    "password": "StrongPass1!",
                    "terms_accepted": True,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="new-admin@example.com").exists())
        self.assertIn("Impossible d'envoyer le code", str(response.data))

    def test_register_requires_terms_acceptance(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "no-terms",
                "email": "no-terms@example.com",
                "password": "StrongPass1!",
                "terms_accepted": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="no-terms@example.com").exists())
        self.assertIn("conditions", str(response.data))

    def test_register_stores_terms_acceptance(self):
        response = self.client.post(
            "/api/users/register/",
            {
                "username": "terms-ok",
                "email": "terms-ok@example.com",
                "password": "StrongPass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        user = User.objects.get(email="terms-ok@example.com")

        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(user.terms_accepted_at)
        self.assertTrue(user.terms_version)

    def test_resend_verification_generates_new_code_for_unverified_user(self):
        user = User.objects.create_user(
            username="pending-resend",
            email="pending-resend@example.com",
            password="StrongPass1!",
            is_verified=False,
            verification_code="111111",
        )

        response = self.client.post(
            "/api/users/resend-verification/",
            {"email": "pending-resend@example.com"},
            format="json",
        )
        user.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(user.verification_code, "111111")
        log = TransactionalEmailLog.objects.get(recipient="pending-resend@example.com")
        self.assertEqual(log.email_type, TransactionalEmailLog.EmailType.RESEND_VERIFICATION)
        self.assertEqual(log.status, TransactionalEmailLog.Status.SENT)
        self.assertEqual(log.attempts, 1)

    def test_resend_verification_does_not_update_code_when_email_fails(self):
        user = User.objects.create_user(
            username="pending-fail",
            email="pending-fail@example.com",
            password="StrongPass1!",
            is_verified=False,
            verification_code="222222",
        )

        with patch(
            "users.views.send_transactional_email",
            return_value=(False, "SMTP unavailable", None),
        ):
            response = self.client.post(
                "/api/users/resend-verification/",
                {"email": "pending-fail@example.com"},
                format="json",
            )
        user.refresh_from_db()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(user.verification_code, "222222")

    @override_settings(AUTH_EMAIL_RESEND_COOLDOWN_SECONDS=3600)
    def test_resend_verification_is_rate_limited(self):
        user = User.objects.create_user(
            username="pending-limited",
            email="pending-limited@example.com",
            password="StrongPass1!",
            is_verified=False,
            verification_code="333333",
        )
        TransactionalEmailLog.objects.create(
            email_type=TransactionalEmailLog.EmailType.RESEND_VERIFICATION,
            recipient=user.email,
            subject="Nouveau code",
            status=TransactionalEmailLog.Status.SENT,
            attempts=1,
            user=user,
            sent_at=timezone.now(),
        )

        response = self.client.post(
            "/api/users/resend-verification/",
            {"email": user.email},
            format="json",
        )

        self.assertEqual(response.status_code, 429)
        self.assertIn("Veuillez patienter", response.data["error"])

    @override_settings(AUTH_VERIFICATION_CODE_TTL_MINUTES=30)
    def test_expired_verification_code_is_rejected(self):
        user = User.objects.create_user(
            username="expired-code",
            email="expired-code@example.com",
            password="StrongPass1!",
            is_verified=False,
            verification_code="444444",
            verification_code_sent_at=timezone.now() - timedelta(minutes=31),
        )

        response = self.client.post(
            "/api/users/verify-email/",
            {"email": user.email, "code": "444444"},
            format="json",
        )
        user.refresh_from_db()

        self.assertEqual(response.status_code, 400)
        self.assertFalse(user.is_verified)
        self.assertIn("expiré", response.data["error"])

    def test_password_reset_request_creates_hashed_code_and_log(self):
        user = User.objects.create_user(
            username="reset-user",
            email="reset@example.com",
            password="StrongPass1!",
            is_verified=True,
        )

        response = self.client.post(
            "/api/users/password-reset/request/",
            {"email": user.email},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        reset_code = PasswordResetCode.objects.get(user=user)
        self.assertNotEqual(reset_code.code_hash, user.verification_code)
        self.assertIsNotNone(reset_code.email_log)
        self.assertEqual(reset_code.email_log.status, TransactionalEmailLog.Status.SENT)

    def test_password_reset_confirm_changes_password(self):
        user = User.objects.create_user(
            username="reset-confirm",
            email="reset-confirm@example.com",
            password="OldStrongPass1!",
            is_verified=True,
        )
        with patch("users.views.random.randint", return_value=123456):
            self.client.post(
                "/api/users/password-reset/request/",
                {"email": user.email},
                format="json",
            )

        response = self.client.post(
            "/api/users/password-reset/confirm/",
            {
                "email": user.email,
                "code": "123456",
                "new_password": "NewStrongPass1!",
            },
            format="json",
        )
        user.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(user.check_password("NewStrongPass1!"))
        self.assertFalse(user.check_password("OldStrongPass1!"))
        self.assertIsNotNone(PasswordResetCode.objects.get(user=user).used_at)

    def test_password_reset_confirm_rejects_invalid_code(self):
        user = User.objects.create_user(
            username="reset-invalid",
            email="reset-invalid@example.com",
            password="OldStrongPass1!",
            is_verified=True,
        )
        with patch("users.views.random.randint", return_value=123456):
            self.client.post(
                "/api/users/password-reset/request/",
                {"email": user.email},
                format="json",
            )

        response = self.client.post(
            "/api/users/password-reset/confirm/",
            {
                "email": user.email,
                "code": "654321",
                "new_password": "NewStrongPass1!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Code invalide", response.data["error"])


@override_settings(MEDIA_ROOT=os.path.join(tempfile.gettempdir(), "crm-pfe-user-test-media"))
class CompleteProfileMediaTests(APITestCase):
    def test_complete_profile_returns_uploaded_profile_picture_and_company_logo(self):
        user = User.objects.create_user(
            username="media-admin",
            email="media-admin@example.com",
            password="StrongPass1!",
            is_verified=True,
        )
        self.client.force_authenticate(user)

        response = self.client.put(
            "/api/users/complete-profile/",
            {
                "phone_number": "12345678",
                "country": "Tunisie",
                "city": "Tunis",
                "job_title": "CEO",
                "name": "Media Company",
                "industry": "Tech",
                "profile_picture": SimpleUploadedFile(
                    "profile.png", b"fake-profile-image", content_type="image/png"
                ),
                "logo": SimpleUploadedFile("logo.png", b"fake-logo-image", content_type="image/png"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("/media/profile_pics/", response.data["user"]["profile_picture"])
        self.assertIn("/media/company_logos/", response.data["user"]["company"]["logo"])
