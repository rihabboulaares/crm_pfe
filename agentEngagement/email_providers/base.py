from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone


EMAIL_LOGIN_REQUIRED = "EMAIL_LOGIN_REQUIRED"
EMAIL_CONNECTION_EXPIRED = "EMAIL_CONNECTION_EXPIRED"
EMAIL_REFRESH_FAILED = "EMAIL_REFRESH_FAILED"
EMAIL_PROVIDER_UNSUPPORTED = "EMAIL_PROVIDER_UNSUPPORTED"
EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED"
EMAIL_RECIPIENT_MISSING = "EMAIL_RECIPIENT_MISSING"
EMAIL_MESSAGE_EMPTY = "EMAIL_MESSAGE_EMPTY"
EMAIL_SENT = "EMAIL_SENT"


@dataclass
class EmailSendResult:
    success: bool
    code: str
    message: str = ""
    provider: str = ""
    sender_email: str = ""
    sender_name: str = ""
    provider_message_id: str = ""

    @property
    def sent(self):
        return self.success and self.code == EMAIL_SENT

    def to_dict(self):
        return {
            "success": self.success,
            "sent": self.sent,
            "status": self.code,
            "code": self.code,
            "message": self.message,
            "provider": self.provider,
            "sender_email": self.sender_email,
            "sender_name": self.sender_name,
            "provider_message_id": self.provider_message_id,
            "error": "" if self.success else self.message,
        }


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

    def send_email(self, connection, to_email, subject, message):
        raise NotImplementedError

    def ensure_valid_token(self, connection):
        if not connection.token_expires_at:
            return True
        if connection.token_expires_at > timezone.now() + timedelta(minutes=2):
            return True
        return self.refresh_connection(connection)

