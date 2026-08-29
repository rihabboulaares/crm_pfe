from datetime import timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

from .base import EmailProvider


class MicrosoftProvider(EmailProvider):
    provider = "microsoft"
    graph_root = "https://graph.microsoft.com/v1.0"
    scopes = ["offline_access", "User.Read"]

    @property
    def tenant_id(self):
        return settings.MICROSOFT_TENANT_ID or "common"

    @property
    def auth_url(self):
        return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/authorize"

    @property
    def token_url(self):
        return f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"

    def build_authorization_url(self, state):
        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
        }
        return f"{self.auth_url}?{urlencode(params)}"

    def exchange_code(self, code):
        response = requests.post(
            self.token_url,
            data={
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
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
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": connection.get_refresh_token(),
                "scope": " ".join(self.scopes),
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
            f"{self.graph_root}/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "email": data.get("mail") or data.get("userPrincipalName") or "",
            "display_name": data.get("displayName") or "",
        }
