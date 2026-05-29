import re
from urllib.parse import urlparse


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:(?:\+|00)\s?216|216)?[\s.\-()]*(?:\d[\s.\-()]*){8}", re.I)


def extract_email(text: str | None) -> str | None:
    if not text:
        return None

    for match in EMAIL_RE.finditer(text):
        email = match.group(0).lower()
        if any(x in email for x in ["example.com", "noreply", "no-reply", "schema.org"]):
            continue
        return email

    return None


def extract_phone(text: str | None) -> str | None:
    if not text:
        return None

    match = PHONE_RE.search(text)
    if not match:
        return None

    raw = match.group(0)
    digits = re.sub(r"\D", "", raw)

    if digits.startswith("00216"):
        digits = "216" + digits[5:]

    if len(digits) == 8 and digits[0] in "24579":
        return "+216" + digits

    if digits.startswith("216") and len(digits) >= 11:
        return "+" + digits[:11]

    return raw.strip()


def detect_platform(url: str | None) -> str | None:
    if not url:
        return None

    domain = urlparse(url).netloc.lower()

    if "linkedin.com" in domain:
        return "linkedin"
    if "facebook.com" in domain or "fb.com" in domain:
        return "facebook"
    if "instagram.com" in domain:
        return "instagram"

    return None


def clean_text(text: str | None, limit: int = 1200) -> str | None:
    if not text:
        return None

    lines = []
    for line in text.splitlines():
        line = line.strip()
        if len(line) < 2:
            continue
        if line.lower() in {"like", "comment", "share", "j’aime", "commenter", "partager"}:
            continue
        lines.append(line)

    result = "\n".join(lines)
    return result[:limit] if result else None