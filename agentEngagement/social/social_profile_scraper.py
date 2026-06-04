import logging
import re

from agentEngagement.scraper import EngagementScraper

logger = logging.getLogger("agentEngagement.social_profile_scraper")


SOCIAL_PLATFORMS = ("linkedin", "instagram", "facebook")


def _profile_url(prospect, platform):
    return getattr(prospect, f"{platform}_url", None) or ""


def _pick_platform(prospect, channel=None):
    channel = (channel or "").strip().lower()
    if channel in SOCIAL_PLATFORMS and _profile_url(prospect, channel):
        return channel

    for platform in SOCIAL_PLATFORMS:
        if _profile_url(prospect, platform):
            return platform

    return channel if channel in SOCIAL_PLATFORMS else "unknown"


def _hashtags_from_text(text):
    return sorted(set(re.findall(r"#([\w\-]+)", text or "")))


def _normalize_posts(posts):
    normalized = []
    for item in (posts or [])[:10]:
        if isinstance(item, dict):
            text = item.get("text") or item.get("caption") or item.get("content") or ""
            date = item.get("date") or item.get("created_at") or ""
            hashtags = item.get("hashtags") or _hashtags_from_text(text)

            if text:
                normalized.append(
                    {
                        "url": item.get("url") or item.get("link") or item.get("permalink") or "",
                        "text": str(text)[:1200],
                        "date": str(date or "")[:80],
                        "hashtags": hashtags[:10],
                        "likes": item.get("likes"),
                        "comments": item.get("comments"),
                    }
                )
        elif item:
            text = str(item)
            normalized.append(
                {
                    "text": text[:1200],
                    "date": "",
                    "hashtags": _hashtags_from_text(text)[:10],
                    "likes": None,
                    "comments": None,
                }
            )
    return normalized


def _activity_level(posts):
    count = len(posts or [])
    if count >= 4:
        return "active"
    if count >= 2:
        return "medium"
    if count == 1:
        return "low"
    return "unknown"


def _normalize_success(platform, profile_url, data):
    data = data or {}
    posts = _normalize_posts(
        data.get("recent_posts")
        or data.get("posts")
        or data.get("publications")
        or data.get("feed_posts")
        or data.get("captions")
    )
    display_name = data.get("display_name") or data.get("full_name") or data.get("name") or data.get("username") or ""
    username = data.get("username") or ""
    bio = (
        data.get("bio")
        or data.get("description")
        or data.get("header")
        or data.get("about")
        or data.get("intro")
        or data.get("main_text")
        or ""
    )
    headline = data.get("headline") or data.get("title") or data.get("header") or ""
    visible_text = data.get("main_text") or data.get("page_text_preview") or data.get("header") or ""
    profile_description = " ".join(
        [
            str(display_name or ""),
            str(headline or ""),
            str(bio or ""),
            str(data.get("about") or ""),
            str(data.get("experience") or ""),
        ]
    )[:3000]

    return {
        "success": True,
        "platform": platform,
        "profile_url": profile_url,
        "username": username,
        "display_name": display_name,
        "headline": headline,
        "bio": bio,
        "description": data.get("description") or bio,
        "profile_description": profile_description,
        "visible_text": str(visible_text)[:2500],
        "page_text_preview": str(data.get("page_text_preview") or "")[:2500],
        "main_text": str(data.get("main_text") or "")[:2500],
        "location": data.get("location") or "",
        "company": data.get("company") or "",
        "recent_posts": posts,
        "posts": posts,
        "activity_level": _activity_level(posts),
        "raw": {
            key: value
            for key, value in data.items()
            if key not in {"page_text_preview", "main_text"}
        },
    }


def _normalize_failure(platform, profile_url, error):
    return {
        "success": False,
        "platform": platform,
        "profile_url": profile_url,
        "error": str(error or "scraping_failed")[:500],
        "recent_posts": [],
        "posts": [],
    }


def normalize_scraped_social_profile(prospect, platform, data):
    profile_url = _profile_url(prospect, platform) if platform in SOCIAL_PLATFORMS else ""
    if not data:
        return _normalize_failure(platform, profile_url, "empty_existing_scraped_data")
    if data.get("error"):
        return _normalize_failure(platform, profile_url, data.get("error"))
    return _normalize_success(platform, profile_url, data.get("data") if isinstance(data.get("data"), dict) else data)


def scrape_social_profile(prospect, channel=None):
    """
    Retourne un dictionnaire standardise avec les donnees sociales disponibles.
    Ne doit jamais bloquer l'agent.
    En cas d'erreur, retourne un dict avec success=False.
    """
    platform = _pick_platform(prospect, channel)
    profile_url = _profile_url(prospect, platform) if platform in SOCIAL_PLATFORMS else ""

    if not profile_url:
        return _normalize_failure(platform, profile_url, "no_social_profile_url")

    try:
        scraper = EngagementScraper()
        user_id = getattr(getattr(prospect, "assigned_to", None), "id", None)

        if platform == "linkedin":
            scraped = scraper.scrape_linkedin(profile_url, user_id=user_id)
        elif platform == "instagram":
            scraped = scraper.scrape_instagram(profile_url, user_id=user_id)
        elif platform == "facebook":
            scraped = scraper.scrape_facebook(profile_url, user_id=user_id)
        else:
            return _normalize_failure(platform, profile_url, "unsupported_platform")

        if not isinstance(scraped, dict):
            return _normalize_failure(platform, profile_url, "invalid_scraper_response")

        if scraped.get("success") is False:
            return _normalize_failure(
                platform,
                profile_url,
                scraped.get("error") or scraped.get("message") or scraped.get("status"),
            )

        data = scraped.get("data") if isinstance(scraped.get("data"), dict) else scraped
        if data.get("error"):
            return _normalize_failure(platform, profile_url, data.get("error"))

        return _normalize_success(platform, profile_url, data)

    except Exception as exc:
        logger.warning("[social-analysis] scraping failed: %s", exc)
        return _normalize_failure(platform, profile_url, exc)
