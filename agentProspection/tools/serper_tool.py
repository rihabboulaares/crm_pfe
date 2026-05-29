import os
import re
from urllib.parse import urlparse, urlunparse

import httpx

from agentProspection.tools.base_tool import BaseTool


SERPER_URL = "https://google.serper.dev/search"

SITE_FILTERS = {
    "linkedin": "site:linkedin.com/in OR site:linkedin.com/company",
    "facebook": "site:facebook.com",
    "instagram": "site:instagram.com",
    "general": "",
}

BLOCKED_PATHS = {
    "linkedin": ["/jobs/", "/posts/", "/pulse/", "/learning/"],
    "facebook": ["/groups/", "/events/", "/watch/", "/posts/", "/photos/", "/reel/"],
    "instagram": ["/p/", "/reel/", "/explore/", "/stories/", "/accounts/"],
}


def clean_url(url: str | None) -> str | None:
    if not url:
        return None

    url = url.strip().split("?")[0].split("#")[0].rstrip("/")

    if url.startswith("//"):
        url = "https:" + url

    if url.startswith("www."):
        url = "https://" + url

    return url


def canonical_url(url: str | None) -> str | None:
    url = clean_url(url)

    if not url:
        return None

    if not url.startswith(("http://", "https://")):
        return url

    parsed = urlparse(url)
    path = parsed.path.rstrip("/")

    return urlunparse(("https", parsed.netloc.lower(), path, "", "", ""))


def detect_platform(url: str | None) -> str | None:
    if not url:
        return None

    netloc = urlparse(url).netloc.lower()

    if "linkedin.com" in netloc:
        return "linkedin"
    if "facebook.com" in netloc or "fb.com" in netloc:
        return "facebook"
    if "instagram.com" in netloc:
        return "instagram"

    return None


def detect_lead_type(url: str | None) -> str | None:
    if not url:
        return None

    parsed = urlparse(url)
    path = parsed.path.lower()
    netloc = parsed.netloc.lower()

    if "linkedin.com" in netloc:
        if "/in/" in path:
            return "person"
        if "/company/" in path:
            return "company"

    return None


def is_allowed_platform_url(url: str, platform: str) -> bool:
    detected = detect_platform(url)

    if platform != "general" and detected != platform:
        return False

    parsed = urlparse(url)
    path = parsed.path.lower()

    blocked = BLOCKED_PATHS.get(detected or platform, [])

    if any(item in path for item in blocked):
        return False

    return True


def normalize_title(title: str | None) -> str | None:
    if not title:
        return None

    value = title
    for word in ["| LinkedIn", "LinkedIn", "| Facebook", "Facebook", "| Instagram", "Instagram"]:
        value = value.replace(word, "")

    value = value.strip(" -|")

    return value[:255] or None


def build_search_query(query: str, platform: str) -> str:
    platform = platform if platform in SITE_FILTERS else "general"
    site_filter = SITE_FILTERS[platform]
    query = sanitize_query(query, platform)

    if not site_filter:
        return query.strip()

    return f"{site_filter} {query}".strip()


def sanitize_query(query: str, platform: str) -> str:
    value = str(query or "").strip()

    if platform != "general":
        value = re.sub(r"\bOR\s+site:[^\s]+", " ", value, flags=re.IGNORECASE)
        value = re.sub(r"\bsite:[^\s]+", " ", value, flags=re.IGNORECASE)

    value = re.sub(r"\s+", " ", value).strip()
    return value


def normalize_result(item: dict, platform: str) -> dict:
    raw_url = canonical_url(item.get("link"))
    detected_platform = detect_platform(raw_url) or platform
    lead_type = detect_lead_type(raw_url)

    title = normalize_title(item.get("title"))
    snippet = item.get("snippet") or ""

    result = {
        "content": snippet[:500] if snippet else None,
        "source": f"serper_{platform}",
        "raw_url": raw_url,
        "linkedin_url": raw_url if detected_platform == "linkedin" else None,
        "facebook_url": raw_url if detected_platform == "facebook" else None,
        "instagram_url": raw_url if detected_platform == "instagram" else None,
        "lead_type": lead_type,
    }

    if lead_type == "person":
        result["full_name"] = title
        result["company_name"] = None
    else:
        result["company_name"] = title

    return result


class SerperTool(BaseTool):
    name = "serper"

    async def run(self, query: str, platform: str = "general") -> list[dict]:
        api_key = os.getenv("SERPER_API_KEY")

        if not api_key:
            return []

        platform = platform if platform in SITE_FILTERS else "general"
        search_query = build_search_query(query, platform)

        headers = {
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "q": search_query,
            "gl": "tn",
            "hl": "fr",
            "num": 10,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    SERPER_URL,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

        except Exception:
            return []

        results = []
        seen_urls = set()

        for item in data.get("organic", [])[:10]:
            raw_url = canonical_url(item.get("link"))

            if not raw_url:
                continue

            if raw_url in seen_urls:
                continue

            if not is_allowed_platform_url(raw_url, platform):
                continue

            seen_urls.add(raw_url)
            results.append(normalize_result(item, platform))

        return results
