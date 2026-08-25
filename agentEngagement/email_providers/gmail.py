import base64
from datetime import timedelta
from email.message import EmailMessage
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

from .base import EMAIL_REFRESH_FAILED, EMAIL_SEND_FAILED, EmailProvider, EmailSendResult


class GmailProvider(EmailProvider):
    provider = "gmail"
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"
    profile_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    send_url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.send",
    ]

    def build_authorization_url(self, state):
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{self.auth_url}?{urlencode(params)}"

    def exchange_code(self, code):
        response = requests.post(
            self.token_url,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
                "code": code,
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def refresh_connection(self, connection):
        if not connection.get_refresh_token():
            return False
        response = requests.post(
            self.token_url,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": connection.get_refresh_token(),
            },
            timeout=20,
        )
        if response.status_code >= 400:
            connection.is_active = False
            connection.save(update_fields=["is_active", "updated_at"])
            return False
        data = response.json()
        connection.set_access_token(data.get("access_token"))
        if data.get("refresh_token"):
            connection.set_refresh_token(data.get("refresh_token"))
        expires_in = int(data.get("expires_in") or 3600)
        connection.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
        connection.is_active = True
        connection.save(update_fields=["access_token", "refresh_token", "token_expires_at", "is_active", "updated_at"])
        return True

    def get_profile(self, access_token):
        response = requests.get(
            self.profile_url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "email": data.get("email") or "",
            "display_name": data.get("name") or "",
        }

    def send_email(self, connection, to_email, subject, message):
        if not self.ensure_valid_token(connection):
            return EmailSendResult(False, EMAIL_REFRESH_FAILED, "Connexion Gmail expiree.", self.provider)

        mime = EmailMessage()
        mime["To"] = to_email
        mime["From"] = connection.email
        mime["Subject"] = subject or "Contact"
        mime.set_content(message)
        raw = base64.urlsafe_b64encode(mime.as_bytes()).decode("utf-8")

        response = requests.post(
            self.send_url,
            headers={"Authorization": f"Bearer {connection.get_access_token()}"},
            json={"raw": raw},
            timeout=30,
        )
        if response.status_code >= 400:
            return EmailSendResult(False, EMAIL_SEND_FAILED, response.text[:500], self.provider)
        data = response.json()
        return EmailSendResult(
            True,
            "EMAIL_SENT",
            "Email envoye.",
            self.provider,
            sender_email=connection.email,
            sender_name=connection.display_name or "",
            provider_message_id=data.get("id") or "",
        )
