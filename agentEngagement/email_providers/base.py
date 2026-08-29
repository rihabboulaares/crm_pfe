from datetime import timedelta

from django.utils import timezone


EMAIL_LOGIN_REQUIRED = "EMAIL_LOGIN_REQUIRED"
EMAIL_CONNECTION_EXPIRED = "EMAIL_CONNECTION_EXPIRED"
EMAIL_REFRESH_FAILED = "EMAIL_REFRESH_FAILED"
EMAIL_PROVIDER_UNSUPPORTED = "EMAIL_PROVIDER_UNSUPPORTED"


class EmailProvider:
    provider = ""
    auth_url = ""
    token_url = ""

    def build_authorization_url(self, state):
        raise NotImplementedError

    def exchange_code(self, code):
        raise NotImplementedError

    def refresh_connection(self, connection):
        raise NotImplementedError

    def get_profile(self, access_token):
        raise NotImplementedError

    def ensure_valid_token(self, connection):
        if not connection.token_expires_at:
            return True
        if connection.token_expires_at > timezone.now() + timedelta(minutes=2):
            return True
        return self.refresh_connection(connection)
