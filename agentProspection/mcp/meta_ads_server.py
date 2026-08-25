import json
import logging
import os
import sys
from pathlib import Path
from urllib.parse import quote

import httpx


# ============================================================
# DJANGO INITIALIZATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

if str(BASE_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(BASE_DIR),
    )

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)


import django  # noqa: E402

django.setup()


from django.conf import settings  # noqa: E402
from mcp.server.fastmcp import FastMCP  # noqa: E402

from agentProspection.tools.meta_ads_sanitizer import (  # noqa: E402
    sanitize_meta_payload,
    sanitize_meta_url,
)


# ============================================================
# LOGGING
# ============================================================

logger = logging.getLogger(
    "agentProspection.meta_ads_mcp"
)

logging.getLogger(
    "httpx"
).setLevel(
    logging.WARNING
)

logging.getLogger(
    "httpcore"
).setLevel(
    logging.WARNING
)


# ============================================================
# CONSTANTS
# ============================================================

DEFAULT_COUNTRY_CODE = "TN"

DEFAULT_LIMIT = 10

MAX_LIMIT = 50


# ============================================================
# MCP SERVER
# ============================================================

mcp = FastMCP(
    getattr(
        settings,
        "META_ADS_MCP_SERVER_NAME",
        "viewise-meta-ads",
    )
)


# ============================================================
# HELPERS
# ============================================================

def _clean_list(
    values,
) -> list[str]:
    if values is None:
        return []

    if isinstance(
        values,
        str,
    ):
        values = [
            values
        ]

    if not isinstance(
        values,
        (
            list,
            tuple,
            set,
        ),
    ):
        return []

    result = []

    for value in values:
        text = str(
            value or ""
        ).strip()

        if (
            text
            and text not in result
        ):
            result.append(
                text
            )

    return result


def _sanitize_error(
    text: str,
    token: str,
) -> str:
    safe = str(
        text or ""
    )[:1000]

    if token:
        safe = safe.replace(
            token,
            "[REDACTED]",
        )

        encoded_token = quote(
            token,
            safe="",
        )

        safe = safe.replace(
            encoded_token,
            "[REDACTED]",
        )

    return safe[:400]


# ============================================================
# META AD NORMALIZATION
# ============================================================

def _normalize_ad(
    item: dict,
    reached_countries: list[str],
) -> dict:
    item = sanitize_meta_payload(
        item
    )

    page_id = (
        item.get(
            "page_id"
        )
    )

    page_name = (
        item.get(
            "page_name"
        )
    )

    # ========================================================
    # AD TEXT
    # ========================================================

    bodies = (
        item.get(
            "ad_creative_bodies"
        )
        or []
    )

    if isinstance(
        bodies,
        list,
    ):
        ad_text = (
            str(
                bodies[0]
            ).strip()
            if bodies
            and bodies[0]
            else None
        )

    else:
        ad_text = (
            str(
                bodies
            ).strip()
            or None
        )

    # ========================================================
    # URLS
    # ========================================================

    snapshot_url = sanitize_meta_url(
        item.get(
            "ad_snapshot_url"
        )
    )

    facebook_url = None

    if page_id:
        facebook_url = (
            f"https://www.facebook.com/"
            f"{page_id}"
        )

    source_url = (
        facebook_url
        or snapshot_url
    )

    # ========================================================
    # RESULT
    # ========================================================

    result = {
        "ad_id":
            item.get(
                "id"
            ),

        "advertiser_name":
            page_name,

        "page_name":
            page_name,

        "page_id":
            page_id,

        "facebook_url":
            facebook_url,

        "ad_snapshot_url":
            snapshot_url,

        "ad_text":
            ad_text,

        # Meta Ads Library ne garantit pas
        # la localisation du siège de la société.
        "company_country":
            item.get(
                "company_country"
            ),

        # Pays atteints par la publicité.
        "ad_reached_countries":
            (
                item.get(
                    "ad_reached_countries"
                )
                or reached_countries
            ),

        "platform":
            item.get(
                "publisher_platforms"
            ),

        "source_url":
            source_url,

        "raw": {
            "id":
                item.get(
                    "id"
                ),

            "ad_delivery_start_time":
                item.get(
                    "ad_delivery_start_time"
                ),

            "ad_delivery_stop_time":
                item.get(
                    "ad_delivery_stop_time"
                ),
        },
    }

    return sanitize_meta_payload(
        result
    )


# ============================================================
# MCP TOOL
# ============================================================

@mcp.tool()
async def ads_library_search(
    search_terms: str,
    ad_reached_countries: list[str] | None = None,
    limit: int = DEFAULT_LIMIT,
    search_type: str = "KEYWORD_UNORDERED",
    ad_type: str = "ALL",
    ad_active_status: str = "ACTIVE",
) -> dict:
    """
    Search active advertisers in Meta Ads Library.

    Business rule:
    the CRM prospects the Tunisian market only.

    Therefore:
    ad_reached_countries is always ["TN"].

    Important:
    this means the ad reached Tunisia.
    It does NOT prove the advertiser is headquartered in Tunisia.
    """

    # ========================================================
    # SEARCH TERMS
    # ========================================================

    search_terms = str(
        search_terms or ""
    ).strip()

    if not search_terms:
        return {
            "success":
                False,

            "status":
                "error",

            "error":
                "search_terms is required",

            "results":
                [],
        }

    # ========================================================
    # TOKEN
    # ========================================================

    token = getattr(
        settings,
        "META_ACCESS_TOKEN",
        "",
    )

    if not token:
        return {
            "success":
                False,

            "status":
                "unavailable",

            "error":
                (
                    "Meta access token "
                    "is not configured"
                ),

            "results":
                [],
        }

    # ========================================================
    # COUNTRY
    # ========================================================

    # The application is Tunisia-only.
    countries = [
        DEFAULT_COUNTRY_CODE
    ]

    # ========================================================
    # LIMIT
    # ========================================================

    configured_max = int(
        getattr(
            settings,
            "META_ADS_MAX_RESULTS",
            MAX_LIMIT,
        )
        or MAX_LIMIT
    )

    try:
        safe_limit = int(
            limit
            or DEFAULT_LIMIT
        )

    except (
        TypeError,
        ValueError,
    ):
        safe_limit = (
            DEFAULT_LIMIT
        )

    safe_limit = max(
        1,
        min(
            safe_limit,
            configured_max,
            MAX_LIMIT,
        ),
    )

    # ========================================================
    # API URL
    # ========================================================

    base_url = str(
        getattr(
            settings,
            "META_GRAPH_API_BASE_URL",
            "https://graph.facebook.com",
        )
    ).rstrip("/")

    api_version = str(
        getattr(
            settings,
            "META_GRAPH_API_VERSION",
            "v23.0",
        )
    ).strip("/")

    url = (
        f"{base_url}/"
        f"{api_version}/"
        "ads_archive"
    )

    # ========================================================
    # FIELDS
    # ========================================================

    fields = ",".join(
        [
            "id",
            "page_id",
            "page_name",
            "ad_snapshot_url",
            "ad_creative_bodies",
            "publisher_platforms",
            "ad_delivery_start_time",
            "ad_delivery_stop_time",
        ]
    )

    # ========================================================
    # PARAMS
    # ========================================================

    params = {
        "access_token":
            token,

        "search_terms":
            search_terms,

        "ad_reached_countries":
            json.dumps(
                countries
            ),

        "ad_active_status":
            ad_active_status,

        "ad_type":
            ad_type,

        "search_type":
            search_type,

        "fields":
            fields,

        "limit":
            safe_limit,
    }

    # ========================================================
    # TIMEOUT
    # ========================================================

    timeout_seconds = int(
        getattr(
            settings,
            "META_ADS_REQUEST_TIMEOUT_SECONDS",
            20,
        )
        or 20
    )

    # ========================================================
    # HTTP CALL
    # ========================================================

    try:
        timeout = httpx.Timeout(
            timeout_seconds,
            connect=min(
                timeout_seconds,
                10,
            ),
        )

        async with httpx.AsyncClient(
            timeout=timeout
        ) as client:

            response = (
                await client.get(
                    url,
                    params=params,
                )
            )

            response.raise_for_status()

            payload = (
                response.json()
            )

    except httpx.HTTPStatusError as exc:
        safe_error = (
            _sanitize_error(
                exc.response.text,
                token,
            )
        )

        logger.warning(
            "[META_ADS_MCP] "
            "Meta Graph API HTTP %s",
            exc.response.status_code,
        )

        return {
            "success":
                False,

            "status":
                "error",

            "error":
                (
                    "Meta Graph API error "
                    f"{exc.response.status_code}: "
                    f"{safe_error}"
                ),

            "results":
                [],
        }

    except httpx.RequestError as exc:
        logger.warning(
            "[META_ADS_MCP] "
            "Connection error: %s",
            exc.__class__.__name__,
        )

        return {
            "success":
                False,

            "status":
                "unavailable",

            "error":
                "Meta Graph API connection error",

            "results":
                [],
        }

    except Exception as exc:
        logger.exception(
            "[META_ADS_MCP] "
            "Unexpected error"
        )

        return {
            "success":
                False,

            "status":
                "error",

            "error":
                _sanitize_error(
                    str(exc),
                    token,
                ),

            "results":
                [],
        }

    # ========================================================
    # NORMALIZE RESULTS
    # ========================================================

    data = (
        payload.get(
            "data"
        )
        or []
    )

    results = []

    for item in data:
        if not isinstance(
            item,
            dict,
        ):
            continue

        normalized = (
            _normalize_ad(
                item,
                countries,
            )
        )

        if not (
            normalized.get(
                "page_name"
            )
            or normalized.get(
                "advertiser_name"
            )
        ):
            continue

        results.append(
            normalized
        )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "success":
            True,

        "status":
            "ok",

        "search_terms":
            search_terms,

        "countries":
            countries,

        "ads_count":
            len(data),

        "results":
            sanitize_meta_payload(
                results
            ),

        "paging":
            sanitize_meta_payload(
                payload.get(
                    "paging"
                )
                or {}
            ),
    }


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":
    mcp.run()