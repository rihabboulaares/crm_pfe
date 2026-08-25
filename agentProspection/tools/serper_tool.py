import logging
import os
import re
from urllib.parse import (
    unquote,
    urlparse,
    urlunparse,
)

import httpx

from agentProspection.tools.base_tool import BaseTool


logger = logging.getLogger(
    "agentProspection.serper"
)


# ============================================================
# CONFIGURATION
# ============================================================

SERPER_URL = "https://google.serper.dev/search"

DEFAULT_COUNTRY_CODE = "tn"
DEFAULT_LANGUAGE = "fr"
DEFAULT_RESULTS = 10


# ============================================================
# BLOCKED PATHS
# ============================================================

BLOCKED_PATHS = {
    "linkedin": {
        "/jobs/",
        "/posts/",
        "/pulse/",
        "/learning/",
        "/feed/",
        "/school/",
    },

    "facebook": {
        "/groups/",
        "/events/",
        "/marketplace/",
        "/gaming/",
    },

    "instagram": {
        "/p/",
        "/reel/",
        "/reels/",
        "/explore/",
        "/stories/",
        "/accounts/",
    },
}


FACEBOOK_CONTENT_SEGMENTS = {
    "videos",
    "posts",
    "reel",
    "reels",
    "watch",
    "photo",
    "photos",
    "share",
}


FACEBOOK_NON_PAGE_SEGMENTS = {
    "watch",
    "reel",
    "reels",
    "photo",
    "photos",
    "posts",
    "videos",
    "share",
    "story.php",
    "permalink.php",
    "profile.php",
}


# ============================================================
# URL HELPERS
# ============================================================

def clean_url(
    url: str | None,
) -> str | None:

    if not url:
        return None

    value = str(
        url
    ).strip()

    if not value:
        return None

    if value.startswith("//"):
        value = "https:" + value

    elif value.startswith("www."):
        value = "https://" + value

    if not value.startswith(
        (
            "http://",
            "https://",
        )
    ):
        return None

    try:
        parsed = urlparse(
            value
        )

        if not parsed.netloc:
            return None

        path = (
            parsed.path
            .rstrip("/")
        )

        return urlunparse(
            (
                "https",
                parsed.netloc.lower(),
                path,
                "",
                "",
                "",
            )
        )

    except Exception:
        return None


def canonical_url(
    url: str | None,
) -> str | None:
    return clean_url(
        url
    )


def detect_platform(
    url: str | None,
) -> str | None:

    if not url:
        return None

    try:
        hostname = (
            urlparse(url)
            .netloc
            .lower()
        )

    except Exception:
        return None

    if "linkedin.com" in hostname:
        return "linkedin"

    if (
        "facebook.com" in hostname
        or "fb.com" in hostname
    ):
        return "facebook"

    if "instagram.com" in hostname:
        return "instagram"

    return None


# ============================================================
# LEAD TYPE
# ============================================================

def detect_lead_type(
    url: str | None,
) -> str | None:

    if not url:
        return None

    try:
        parsed = urlparse(
            url
        )

    except Exception:
        return None

    path = (
        parsed.path
        .lower()
    )

    hostname = (
        parsed.netloc
        .lower()
    )

    if "linkedin.com" in hostname:

        if "/in/" in path:
            return "person"

        if "/company/" in path:
            return "company"

        return None

    if (
        "facebook.com" in hostname
        or "fb.com" in hostname
        or "instagram.com" in hostname
    ):
        return "company"

    return None


# ============================================================
# FACEBOOK HELPERS
# ============================================================

def facebook_path_parts(
    url: str | None,
) -> list[str]:

    if not url:
        return []

    try:
        path = (
            urlparse(url)
            .path
            .strip("/")
        )

    except Exception:
        return []

    return [
        part
        for part
        in path.split("/")
        if part
    ]


def is_facebook_content_url(
    url: str | None,
) -> bool:

    parts = [
        part.lower()
        for part
        in facebook_path_parts(
            url
        )
    ]

    if not parts:
        return False

    return any(
        part
        in FACEBOOK_CONTENT_SEGMENTS
        for part
        in parts
    )


def extract_facebook_page_identifier(
    url: str | None,
) -> str | None:

    parts = facebook_path_parts(
        url
    )

    if not parts:
        return None

    first = (
        parts[0]
        .strip()
    )

    if (
        first.lower() == "p"
        and len(parts) > 1
    ):
        candidate = re.sub(
            r"-\d{6,}$",
            "",
            unquote(
                parts[1]
            ),
        ).strip("-")

        return (
            candidate[:120]
            or None
        )

    if (
        first.lower()
        in FACEBOOK_NON_PAGE_SEGMENTS
    ):
        return None

    if first.isdigit():
        return None

    return (
        unquote(
            first
        )[:120]
        or None
    )


def facebook_page_url(
    url: str | None,
) -> str | None:

    identifier = (
        extract_facebook_page_identifier(
            url
        )
    )

    if not identifier:
        return None

    return (
        f"https://facebook.com/"
        f"{identifier}"
    )


# ============================================================
# INSTAGRAM
# ============================================================

def instagram_username(
    url: str | None,
) -> str | None:

    if not url:
        return None

    try:
        parts = [
            part
            for part
            in urlparse(url)
            .path
            .strip("/")
            .split("/")
            if part
        ]

    except Exception:
        return None

    if not parts:
        return None

    username = (
        unquote(
            parts[0]
        )
        .strip()
    )

    if not username:
        return None

    if username.lower() in {
        "p",
        "reel",
        "reels",
        "stories",
        "explore",
        "accounts",
    }:
        return None

    return username[:120]


# ============================================================
# URL VALIDATION
# ============================================================

def is_allowed_platform_url(
    url: str,
    platform: str,
    expected_lead_type: str | None = None,
) -> bool:

    detected = detect_platform(
        url
    )

    if (
        platform != "general"
        and detected != platform
    ):
        return False

    try:
        path = (
            urlparse(url)
            .path
            .lower()
        )

    except Exception:
        return False

    blocked = (
        BLOCKED_PATHS.get(
            detected
            or platform,
            set(),
        )
    )

    if any(
        item in path
        for item in blocked
    ):
        return False

    # ========================================================
    # LINKEDIN
    # ========================================================

    if platform == "linkedin":

        if (
            expected_lead_type
            == "person"
        ):
            return "/in/" in path

        if (
            expected_lead_type
            == "company"
        ):
            return "/company/" in path

        return (
            "/in/" in path
            or "/company/" in path
        )

    # ========================================================
    # FACEBOOK
    # ========================================================

    if platform == "facebook":

        identifier = (
            extract_facebook_page_identifier(
                url
            )
        )

        if (
            is_facebook_content_url(
                url
            )
            and not identifier
        ):
            return False

        if not identifier:
            return False

    # ========================================================
    # INSTAGRAM
    # ========================================================

    if platform == "instagram":

        if not instagram_username(
            url
        ):
            return False

    return True


# ============================================================
# TITLE
# ============================================================

def normalize_title(
    title: str | None,
) -> str | None:

    if not title:
        return None

    value = str(
        title
    ).strip()

    suffixes = [
        "| LinkedIn",
        "- LinkedIn",
        "| Facebook",
        "- Facebook",
        "| Instagram",
        "- Instagram",
    ]

    for suffix in suffixes:

        if (
            value.lower()
            .endswith(
                suffix.lower()
            )
        ):
            value = value[
                :-len(suffix)
            ]

            value = (
                value.strip(
                    " -|"
                )
            )

    return (
        value[:255]
        or None
    )


def parse_linkedin_person_title(
    title: str | None,
) -> tuple[
    str | None,
    str | None,
]:

    value = normalize_title(
        title
    )

    if not value:
        return None, None

    for separator in [
        " - ",
        " | ",
        " – ",
        " — ",
    ]:

        if separator not in value:
            continue

        left, right = (
            value.split(
                separator,
                1,
            )
        )

        left = left.strip()
        right = right.strip()

        if (
            left
            and 1
            <= len(
                left.split()
            )
            <= 6
        ):
            return (
                left[:150],
                right[:150]
                or None,
            )

    return (
        value[:150],
        None,
    )


def parse_linkedin_company_title(
    title: str | None,
) -> str | None:

    value = normalize_title(
        title
    )

    if not value:
        return None

    for suffix in [
        ": Overview",
        " - Overview",
    ]:

        index = (
            value.lower()
            .find(
                suffix.lower()
            )
        )

        if index >= 0:
            value = (
                value[:index]
                .strip()
            )

            break

    return (
        value[:255]
        or None
    )


# ============================================================
# SNIPPET CONTACT EXTRACTION
# ============================================================

def extract_email_from_text(
    text: str | None,
) -> str | None:

    if not text:
        return None

    match = re.search(
        (
            r"\b"
            r"[A-Za-z0-9._%+-]+"
            r"@"
            r"[A-Za-z0-9.-]+"
            r"\."
            r"[A-Za-z]{2,}"
            r"\b"
        ),
        str(text),
    )

    if not match:
        return None

    return (
        match.group(0)
        .strip()
        .lower()
    )


def extract_tunisian_phone_from_text(
    text: str | None,
) -> str | None:

    if not text:
        return None

    value = str(
        text
    )

    patterns = [
        # +216 51 757 097
        # (+216) 51 757 097
        r"(?:\+216|00216)[\s().-]*\d(?:[\d\s().-]{6,14})\d",

        # Tunisian local format when explicit context exists.
        r"\b[24579]\d[\s.-]?\d{3}[\s.-]?\d{3}\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            value,
        )

        if not match:
            continue

        digits = re.sub(
            r"\D",
            "",
            match.group(0),
        )

        if digits.startswith(
            "00216"
        ):
            digits = (
                "216"
                + digits[5:]
            )

        if (
            len(digits) == 8
            and digits[0]
            in "24579"
        ):
            digits = (
                "216"
                + digits
            )

        if (
            digits.startswith("216")
            and len(digits) == 11
        ):
            return (
                f"+{digits}"
            )

    return None


# ============================================================
# QUERY
# ============================================================

def sanitize_query(
    query: str,
) -> str:

    value = str(
        query or ""
    ).strip()

    value = re.sub(
        r"\bsite:[^\s]+",
        " ",
        value,
        flags=re.IGNORECASE,
    )

    value = re.sub(
        r"\bOR\b",
        " ",
        value,
        flags=re.IGNORECASE,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value.strip()


def build_search_query(
    query: str,
    platform: str,
    expected_lead_type: str | None = None,
) -> str:

    query = sanitize_query(
        query
    )

    if not query:
        return ""

    # ========================================================
    # LINKEDIN PERSON
    # ========================================================

    if (
        platform == "linkedin"
        and expected_lead_type
        == "person"
    ):
        return (
            "site:linkedin.com/in "
            f"{query}"
        )

    # ========================================================
    # LINKEDIN COMPANY
    # ========================================================

    if (
        platform == "linkedin"
        and expected_lead_type
        == "company"
    ):
        return (
            "site:linkedin.com/company "
            f"{query}"
        )

    # ========================================================
    # LINKEDIN GENERIC
    # ========================================================

    if platform == "linkedin":

        return (
            "(site:linkedin.com/in "
            "OR site:linkedin.com/company) "
            f"{query}"
        )

    # ========================================================
    # FACEBOOK
    # ========================================================

    if platform == "facebook":

        return (
            "site:facebook.com "
            f"{query}"
        )

    # ========================================================
    # INSTAGRAM
    # ========================================================

    if platform == "instagram":

        return (
            "site:instagram.com "
            f"{query}"
        )

    # ========================================================
    # GENERAL
    # ========================================================

    return query


# ============================================================
# RESULT NORMALIZATION
# ============================================================

def normalize_result(
    item: dict,
    platform: str,
    expected_lead_type: str | None = None,
) -> dict:

    raw_url = canonical_url(
        item.get("link")
    )

    detected_platform = (
        detect_platform(
            raw_url
        )
    )

    detected_type = (
        detect_lead_type(
            raw_url
        )
    )

    lead_type = (
        detected_type
        or expected_lead_type
    )

    title = normalize_title(
        item.get("title")
    )

    snippet = str(
        item.get("snippet")
        or ""
    ).strip()

    snippet_email = (
        extract_email_from_text(
            snippet
        )
    )

    snippet_phone = (
        extract_tunisian_phone_from_text(
            snippet
        )
    )

    result = {
        "lead_type":
            lead_type,

        "company_name":
            None,

        "full_name":
            None,

        "job_title":
            None,

        "industry":
            None,

        "city":
            None,

        # Serper alone does not prove country.
        "country":
            None,

        "email":
            snippet_email,

        "phone":
            snippet_phone,

        "website":
            None,

        "linkedin_url":
            None,

        "facebook_url":
            None,

        "instagram_url":
            None,

        "source":
            f"serper_{platform}",

        "source_label":
            {
                "linkedin":
                    "Serper LinkedIn",

                "facebook":
                    "Serper Facebook",

                "instagram":
                    "Serper Instagram",

                "general":
                    "Serper General",
            }.get(
                platform,
                "Serper",
            ),

        "source_url":
            raw_url,

        "raw_url":
            raw_url,

        "content_title":
            title,

        "content":
            snippet[:1000]
            or None,

        "identity_confidence":
            "medium",

        "source_confidence":
            0.70,
    }

    # ========================================================
    # LINKEDIN PERSON
    # ========================================================

    if (
        detected_platform
        == "linkedin"
        and lead_type
        == "person"
    ):

        full_name, job_title = (
            parse_linkedin_person_title(
                title
            )
        )

        result[
            "full_name"
        ] = full_name

        result[
            "job_title"
        ] = job_title

        result[
            "linkedin_url"
        ] = raw_url

        result[
            "identity_confidence"
        ] = "high"

        return result

    # ========================================================
    # LINKEDIN COMPANY
    # ========================================================

    if (
        detected_platform
        == "linkedin"
        and lead_type
        == "company"
    ):

        result[
            "company_name"
        ] = (
            parse_linkedin_company_title(
                title
            )
        )

        result[
            "linkedin_url"
        ] = raw_url

        result[
            "identity_confidence"
        ] = "high"

        return result

    # ========================================================
    # FACEBOOK
    # ========================================================

    if (
        detected_platform
        == "facebook"
    ):

        identifier = (
            extract_facebook_page_identifier(
                raw_url
            )
        )

        page_url = (
            facebook_page_url(
                raw_url
            )
        )

        if identifier:

            result[
                "company_name"
            ] = identifier

            result[
                "facebook_url"
            ] = canonical_url(
                page_url
            )

            result[
                "facebook_page_identifier"
            ] = identifier

            result[
                "facebook_content_url"
            ] = (
                raw_url
                if is_facebook_content_url(
                    raw_url
                )
                else None
            )

            result[
                "identity_confidence"
            ] = "high"

        return result

    # ========================================================
    # INSTAGRAM
    # ========================================================

    if (
        detected_platform
        == "instagram"
    ):

        username = (
            instagram_username(
                raw_url
            )
        )

        if username:

            result[
                "company_name"
            ] = username

            result[
                "instagram_url"
            ] = raw_url

            result[
                "identity_confidence"
            ] = "medium"

        return result

    # ========================================================
    # GENERAL
    # ========================================================

    if platform == "general":

        result[
            "lead_type"
        ] = (
            expected_lead_type
            or "company"
        )

        result[
            "company_name"
        ] = title

        result[
            "website"
        ] = raw_url

        result[
            "identity_confidence"
        ] = "medium"

    return result


# ============================================================
# SERPER TOOL
# ============================================================

class SerperTool(
    BaseTool
):
    name = "serper"

    def __init__(
        self,
    ):
        super().__init__()

        self.last_status = (
            "idle"
        )

        self.last_error = ""

    async def run(
        self,
        query: str | dict,
        platform: str = "general",
    ) -> list[dict]:

        self.last_status = (
            "running"
        )

        self.last_error = ""

        # ====================================================
        # API KEY
        # ====================================================

        api_key = os.getenv(
            "SERPER_API_KEY"
        )

        if not api_key:

            self.last_status = (
                "unavailable"
            )

            self.last_error = (
                "SERPER_API_KEY missing"
            )

            logger.warning(
                "[SERPER] API key missing"
            )

            return []

        # ====================================================
        # PLATFORM
        # ====================================================

        if platform not in {
            "linkedin",
            "facebook",
            "instagram",
            "general",
        }:
            platform = (
                "general"
            )

        # ====================================================
        # QUERY INPUT
        # ====================================================

        page = 1
        expected_lead_type = None

        if isinstance(
            query,
            dict,
        ):

            page = max(
                1,
                int(
                    query.get(
                        "page"
                    )
                    or 1
                ),
            )

            expected_lead_type = (
                query.get(
                    "lead_type"
                )
                or query.get(
                    "entity_type"
                )
            )

            query_text = str(
                query.get("q")
                or query.get(
                    "query"
                )
                or ""
            ).strip()

        else:

            query_text = str(
                query
                or ""
            ).strip()

        if (
            expected_lead_type
            not in {
                "person",
                "company",
            }
        ):
            expected_lead_type = (
                None
            )

        # ====================================================
        # SEARCH QUERY
        # ====================================================

        search_query = (
            build_search_query(
                query_text,
                platform,
                expected_lead_type=
                    expected_lead_type,
            )
        )

        if not search_query:

            self.last_status = (
                "error"
            )

            self.last_error = (
                "Empty Serper query"
            )

            return []

        # ====================================================
        # PAYLOAD
        # ====================================================

        headers = {
            "X-API-KEY":
                api_key,

            "Content-Type":
                "application/json",
        }

        payload = {
            "q":
                search_query,

            # CRM consacré à la Tunisie.
            "gl":
                DEFAULT_COUNTRY_CODE,

            "hl":
                DEFAULT_LANGUAGE,

            "num":
                DEFAULT_RESULTS,

            "page":
                page,
        }

        logger.info(
            "[SERPER] "
            "platform=%s "
            "lead_type=%s "
            "page=%s "
            "query=%s",
            platform,
            expected_lead_type,
            page,
            search_query,
        )

        # ====================================================
        # HTTP
        # ====================================================

        try:

            timeout = (
                httpx.Timeout(
                    20.0,
                    connect=8.0,
                )
            )

            async with (
                httpx.AsyncClient(
                    timeout=timeout
                )
            ) as client:

                response = (
                    await client.post(
                        SERPER_URL,
                        headers=headers,
                        json=payload,
                    )
                )

                response.raise_for_status()

                data = (
                    response.json()
                )

        except httpx.HTTPStatusError as exc:

            self.last_status = (
                "error"
            )

            self.last_error = (
                f"Serper HTTP "
                f"{exc.response.status_code}"
            )

            logger.warning(
                "[SERPER] HTTP error "
                "status=%s platform=%s",
                exc.response.status_code,
                platform,
            )

            return []

        except httpx.RequestError as exc:

            self.last_status = (
                "unavailable"
            )

            self.last_error = (
                "Serper connection error"
            )

            logger.warning(
                "[SERPER] "
                "connection error "
                "platform=%s "
                "type=%s",
                platform,
                exc.__class__.__name__,
            )

            return []

        except Exception as exc:

            self.last_status = (
                "error"
            )

            self.last_error = (
                "Serper unexpected error: "
                f"{exc.__class__.__name__}"
            )

            logger.exception(
                "[SERPER] Unexpected error"
            )

            return []

        # ====================================================
        # RESULTS
        # ====================================================

        organic = (
            data.get("organic")
            or []
        )

        results = []
        seen_urls = set()

        for item in organic[
            :DEFAULT_RESULTS
        ]:

            if not isinstance(
                item,
                dict,
            ):
                continue

            raw_url = (
                canonical_url(
                    item.get(
                        "link"
                    )
                )
            )

            if not raw_url:
                continue

            if raw_url in seen_urls:
                continue

            if not is_allowed_platform_url(
                raw_url,
                platform,
                expected_lead_type=
                    expected_lead_type,
            ):
                continue

            normalized = (
                normalize_result(
                    item,
                    platform,
                    expected_lead_type=
                        expected_lead_type,
                )
            )

            # Identity required.
            if not (
                normalized.get(
                    "full_name"
                )
                or normalized.get(
                    "company_name"
                )
            ):
                continue

            seen_urls.add(
                raw_url
            )

            results.append(
                normalized
            )

        self.last_status = (
            "ok"
        )

        self.last_error = ""

        logger.info(
            "[SERPER] "
            "platform=%s "
            "raw=%s "
            "normalized=%s",
            platform,
            len(organic),
            len(results),
        )

        return results