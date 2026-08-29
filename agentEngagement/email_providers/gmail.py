from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

from .base import EmailProvider


class GmailProvider(EmailProvider):
    provider = "gmail"
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"
    profile_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    scopes = [
        "openid",
        "email",
        "profile",
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
