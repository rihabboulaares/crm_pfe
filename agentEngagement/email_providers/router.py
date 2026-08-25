from django.conf import settings

from agentEngagement.models import UserEmailConnection

from .base import EMAIL_PROVIDER_UNSUPPORTED
from .gmail import GmailProvider
from .microsoft import MicrosoftProvider


PROVIDERS = {
    UserEmailConnection.PROVIDER_GMAIL: GmailProvider,
    "google": GmailProvider,
    UserEmailConnection.PROVIDER_MICROSOFT: MicrosoftProvider,
}


def normalize_email_provider_name(provider_name):
    provider_name = (provider_name or "").lower()
    if provider_name == "google":
        return UserEmailConnection.PROVIDER_GMAIL
    return provider_name


def get_email_provider(provider_name):
    provider_class = PROVIDERS.get((provider_name or "").lower())
    if not provider_class:
        raise ValueError(EMAIL_PROVIDER_UNSUPPORTED)
    return provider_class()


def provider_is_configured(provider_name):
    provider_name = normalize_email_provider_name(provider_name)
    if provider_name == UserEmailConnection.PROVIDER_GMAIL:
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)
    if provider_name == UserEmailConnection.PROVIDER_MICROSOFT:
        return bool(settings.MICROSOFT_CLIENT_ID and settings.MICROSOFT_CLIENT_SECRET and settings.MICROSOFT_REDIRECT_URI)
    return False
