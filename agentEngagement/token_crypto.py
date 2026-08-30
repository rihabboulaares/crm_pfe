import base64
import hashlib
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

ENCRYPTED_PREFIX = "enc:v1:"


def _fernet():
    try:
        from cryptography.fernet import Fernet
    except Exception:
        logger.warning("cryptography.fernet unavailable; email tokens will be stored as plain text")
        return None

    secret = str(getattr(settings, "SECRET_KEY", "") or "")
    if not secret:
        return None
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_token(value):
    token = str(value or "")
    if not token or token.startswith(ENCRYPTED_PREFIX):
        return token

    fernet = _fernet()
    if not fernet:
        return token

    encrypted = fernet.encrypt(token.encode("utf-8")).decode("ascii")
    return f"{ENCRYPTED_PREFIX}{encrypted}"


def decrypt_token(value):
    token = str(value or "")
    if not token.startswith(ENCRYPTED_PREFIX):
        return token

    fernet = _fernet()
    if not fernet:
        return ""

    payload = token[len(ENCRYPTED_PREFIX):]
    try:
        return fernet.decrypt(payload.encode("ascii")).decode("utf-8")
    except Exception:
        logger.exception("Unable to decrypt stored email token")
        return ""
