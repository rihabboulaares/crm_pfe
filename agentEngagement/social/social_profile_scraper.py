import logging
import re
import traceback
from concurrent.futures import ThreadPoolExecutor

from django.apps import apps
from django.contrib.auth import get_user_model

from agentEngagement.scraper import EngagementScraper
from social_sessions.services import SocialSessionService

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


def _scrape_with_platform_scraper(platform, url, user_id, session_path=None):
    scraper = EngagementScraper()

    if platform == "linkedin":
        return scraper.scrape_linkedin(url, user_id=user_id, session_path=session_path)
    if platform == "instagram":
        return scraper.scrape_instagram(url, user_id=user_id, session_path=session_path)
    if platform == "facebook":
        return scraper.scrape_facebook(url, user_id=user_id, session_path=session_path)

    return {
        "success": False,
        "status": "unsupported_platform",
        "error": "unsupported_platform",
        "platform": platform,
        "url": url,
    }


def run_social_scraping_sync(user_id, prospect_id, platform, url):
    """
    Unique sync boundary for social scraping.
    Django ORM, SocialSessionService and Playwright sync_api must stay inside
    this function or functions called synchronously from here.
    """
    logger.info("[social-scraper-sync] entered")
    logger.info("[social-scraper-sync] platform=%s", platform)

    if not user_id:
        return {
            "success": False,
            "status": "missing_user_id",
            "error": "missing_user_id",
            "platform": platform,
            "url": url,
        }

    User = get_user_model()
    Prospect = apps.get_model("sales", "Prospect")

    user = User.objects.get(id=user_id)
    prospect = Prospect.objects.get(id=prospect_id) if prospect_id else None
    profile_url = url or (_profile_url(prospect, platform) if prospect else "")

    session_result = SocialSessionService.has_valid_session(user, platform)
    session_path = SocialSessionService.get_session_path(user, platform)
    logger.info("[social-scraper-sync] session loaded")

    if not session_result.get("ok") or not session_path:
        return {
            "success": False,
            "status": session_result.get("status") or "login_required",
            "error": session_result.get("message") or session_result.get("status") or "login_required",
            "platform": platform,
            "url": profile_url,
        }

    logger.info("[social-scraper-sync] browser launched")
    result = _scrape_with_platform_scraper(platform, profile_url, user.id, session_path=session_path)
    logger.info("[social-scraper-sync] url opened")

    if isinstance(result, dict) and result.get("status") in {"expired", "verification_required"}:
        if result.get("status") == "verification_required":
            SocialSessionService.mark_verification_required(
                user,
                platform,
                result.get("message") or result.get("error"),
            )
        else:
            SocialSessionService.mark_expired(user, platform, result.get("message") or result.get("error"))

    if isinstance(result, dict) and result.get("success") is False:
        return result

    logger.info("[social-scraper-sync] scraping success")
    return result


def _run_social_scraping_outside_async_context(user_id, prospect_id, platform, url):
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(run_social_scraping_sync, user_id, prospect_id, platform, url)
        return future.result()


def scrape_prospect_social_profiles(prospect, user):
    result = {
        "linkedin": {},
        "facebook": {},
        "instagram": {},
        "website": {},
    }
    user_id = getattr(user, "id", None)
    prospect_id = getattr(prospect, "id", None) or getattr(prospect, "pk", None)

    for platform in SOCIAL_PLATFORMS:
        profile_url = _profile_url(prospect, platform)
        if not profile_url:
            continue

        try:
            scraped = _run_social_scraping_outside_async_context(
                user_id,
                prospect_id,
                platform,
                profile_url,
            )
        except Exception as exc:
            print("[social-analysis] FULL TRACEBACK")
            print(traceback.format_exc())
            logger.warning("[social-analysis] scraping failed: %s", exc)
            result[platform] = {
                "success": False,
                "platform": platform,
                "status": "scraping_exception",
                "error": str(exc),
            }
            continue

        if not isinstance(scraped, dict):
            result[platform] = {
                "success": False,
                "platform": platform,
                "status": "invalid_scraper_response",
                "error": "invalid_scraper_response",
            }
            continue

        if scraped.get("success") is False or scraped.get("error"):
            result[platform] = {
                "success": False,
                "platform": platform,
                "status": scraped.get("status"),
                "error": scraped.get("error") or scraped.get("message") or scraped.get("status"),
            }
            logger.warning("[scraper] %s failed but workflow continues", platform.capitalize())
            continue

        result[platform] = scraped.get("data", scraped)
        logger.info("[scraper] %s scraped for Prospect #%s", platform.capitalize(), prospect_id)

    if getattr(prospect, "website", None):
        result["website"] = EngagementScraper().scrape_website(prospect.website)
        logger.info("[scraper] Website scraped for Prospect #%s", prospect_id)

    return result


def scrape_social_profile(prospect, channel=None, user=None):
    """
    Retourne un dictionnaire standardise avec les donnees sociales disponibles.
    Ne doit jamais bloquer l'agent.
    En cas d'erreur, retourne un dict avec success=False.
    """
    platform = _pick_platform(prospect, channel)
    profile_url = _profile_url(prospect, platform) if platform in SOCIAL_PLATFORMS else ""
    user_id = getattr(user, "id", None) or getattr(prospect, "assigned_to_id", None)
    prospect_id = getattr(prospect, "id", None) or getattr(prospect, "pk", None)

    if not profile_url:
        return _normalize_failure(platform, profile_url, "no_social_profile_url")

    try:
        logger.info("[social-analysis] using sync flow")
        logger.info("[social-analysis] platform=%s", platform)
        scraped = _run_social_scraping_outside_async_context(user_id, prospect_id, platform, profile_url)

        if not isinstance(scraped, dict):
            return _normalize_failure(platform, profile_url, "invalid_scraper_response")

        if scraped.get("success") is False:
            logger.info("[social-analysis] scrape_status=%s", scraped.get("status") or scraped.get("error"))
            return _normalize_failure(
                platform,
                profile_url,
                scraped.get("error") or scraped.get("message") or scraped.get("status"),
            )

        data = scraped.get("data") if isinstance(scraped.get("data"), dict) else scraped
        if data.get("error"):
            logger.info("[social-analysis] scrape_status=%s", data.get("error"))
            return _normalize_failure(platform, profile_url, data.get("error"))

        logger.info("[social-analysis] final_url=%s", data.get("url") or data.get("profile_url") or profile_url)
        logger.info("[social-analysis] scrape_status=connected")
        logger.info("[social-analysis] scraping success")
        return _normalize_success(platform, profile_url, data)

    except Exception as exc:
        print("[social-analysis] FULL TRACEBACK")
        print(traceback.format_exc())
        logger.warning("[social-analysis] scraping failed: %s", exc)
        return _normalize_failure(platform, profile_url, exc)
