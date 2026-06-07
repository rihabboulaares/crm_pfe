import logging

from django.utils import timezone

from .brain import analyze_and_generate
from .schemas import ProspectProfileData
from .scraper import EngagementScraper
from .memory import (
    set_status,
    save_prepared_message,
    mark_contacted,
    is_already_processed,
)
from .task_manager import create_engagement_task, create_task_activity
from .sender import EngagementSender
from .social.social_profile_analyzer import analyze_social_profile_with_gemini
from .social.social_profile_scraper import normalize_scraped_social_profile, scrape_social_profile

logger = logging.getLogger("agentEngagement.runner")


def _dump(obj):
    if obj is None:
        return None
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return obj


def build_profile_data(prospect, scraped_data=None):
    scraped_data = scraped_data or {}

    company_name = ""
    if getattr(prospect, "prospect_company", None):
        company_name = prospect.prospect_company.name or ""

    data = ProspectProfileData(
        first_name=prospect.first_name or "",
        last_name=prospect.last_name or "",
        title=prospect.title or "",
        description=prospect.description or "",
        email=prospect.email or "",
        phone=prospect.phone or "",
        company_name=company_name,
        website=prospect.website or "",
        linkedin_url=prospect.linkedin_url or "",
        facebook_url=prospect.facebook_url or "",
        instagram_url=prospect.instagram_url or "",
        linkedin_data=scraped_data.get("linkedin", {}),
        facebook_data=scraped_data.get("facebook", {}),
        instagram_data=scraped_data.get("instagram", {}),
        website_data=scraped_data.get("website", {}),
    )

    return _dump(data)


def _scrape_failed(scraped_data: dict) -> bool:
    return isinstance(scraped_data, dict) and scraped_data.get("success") is False


def _scrape_failure_response(scraped_data: dict, prospect) -> dict:
    status = scraped_data.get("status") or "scrape_empty"
    platform = scraped_data.get("platform") or ""

    if status in {"instagram_login_required", "facebook_login_required"}:
        message = scraped_data.get("message") or "Connexion ou vérification requise."
    elif status.startswith("instagram"):
        message = (
            "Le profil Instagram n’a pas pu être analysé. "
            "Connectez-vous à Instagram ou vérifiez l’URL du profil."
        )
    elif status.startswith("facebook"):
        message = (
            "Le profil Facebook n’a pas pu être analysé. "
            "Connectez-vous à Facebook ou vérifiez l’URL du profil."
        )
    else:
        message = scraped_data.get("message") or "Le profil n’a pas pu être analysé."

    return {
        "success": False,
        "status": status,
        "message": message,
        "prospect_id": prospect.pk,
        "platform": platform,
        "data": {},
    }


def _facebook_session_block_response(scraped_data: dict, prospect) -> dict | None:
    if not isinstance(scraped_data, dict):
        return None

    facebook_data = scraped_data.get("facebook")
    if not isinstance(facebook_data, dict):
        return None

    status = facebook_data.get("status")
    if status not in {"login_required", "checkpoint_required", "facebook_login_required"}:
        return None

    message = (
        facebook_data.get("message")
        or facebook_data.get("error")
        or "Connectez-vous a Facebook via le bouton Connecter Facebook puis relancez l'action."
    )
    return {
        "success": False,
        "status": status,
        "platform": "facebook",
        "message": message,
        "error": message,
        "prospect_id": prospect.pk,
        "data": {},
    }


def should_reuse_social_analysis(prospect):
    if not getattr(prospect, "social_profile_last_analyzed_at", None):
        return False

    delta = timezone.now() - prospect.social_profile_last_analyzed_at
    return delta.days < 7 and bool(getattr(prospect, "social_profile_analysis", None))


def _save_social_analysis(prospect, analysis):
    prospect.social_profile_summary = analysis.get("summary", "")
    prospect.social_profile_description = analysis.get("description", "")
    prospect.social_profile_interests = analysis.get("interests", [])
    prospect.social_profile_activity_level = analysis.get("activity_level", "unknown")
    prospect.social_profile_tone = analysis.get("communication_tone", "neutral")
    prospect.social_profile_relevance = analysis.get("commercial_relevance", "unknown")
    prospect.social_profile_hook = analysis.get("personalized_hook", "")
    prospect.social_profile_topics = analysis.get("recent_topics", [])
    prospect.social_profile_analysis = analysis
    prospect.social_profile_last_analyzed_at = timezone.now()

    prospect.save(
        update_fields=[
            "social_profile_summary",
            "social_profile_description",
            "social_profile_interests",
            "social_profile_activity_level",
            "social_profile_tone",
            "social_profile_relevance",
            "social_profile_hook",
            "social_profile_topics",
            "social_profile_analysis",
            "social_profile_last_analyzed_at",
        ]
    )


def get_existing_social_analysis(prospect):
    analysis = getattr(prospect, "social_profile_analysis", None) or {}

    if analysis:
        return analysis

    if getattr(prospect, "social_profile_description", None) or getattr(prospect, "social_profile_summary", None):
        return {
            "success": True,
            "summary": prospect.social_profile_summary or "",
            "description": prospect.social_profile_description or "",
            "interests": prospect.social_profile_interests or [],
            "activity_level": prospect.social_profile_activity_level or "unknown",
            "communication_tone": prospect.social_profile_tone or "neutral",
            "commercial_relevance": prospect.social_profile_relevance or "unknown",
            "personalized_hook": prospect.social_profile_hook or "",
            "recent_topics": prospect.social_profile_topics or [],
        }

    return None


def enrich_prospect_with_social_analysis(prospect, channel=None, force=False, existing_scraped_data=None):
    try:
        logger.info("[social-analysis] started Prospect #%s", prospect.pk)
        if not force and should_reuse_social_analysis(prospect):
            logger.info("[social-analysis] reused existing analysis for Prospect #%s", prospect.pk)
            return {
                "success": True,
                "reused": True,
                "analysis": prospect.social_profile_analysis,
            }

        if existing_scraped_data and not force:
            logger.info("[social-analysis] scraping started")
            scraped_data = normalize_scraped_social_profile(prospect, channel, existing_scraped_data)
        else:
            logger.info("[social-analysis] scraping started")
            scraped_data = scrape_social_profile(prospect, channel=channel)

        if not scraped_data.get("success"):
            logger.warning("[social-analysis] scraping failed: %s", scraped_data.get("error"))
            logger.info("[social-analysis] skipped, continuing old flow")
            return {
                "success": False,
                "reason": "scraping_failed",
                "data": scraped_data,
                "analysis": None,
            }

        logger.info("[social-analysis] Gemini analysis started")
        analysis = analyze_social_profile_with_gemini(prospect=prospect, scraped_data=scraped_data)

        if analysis.get("success"):
            _save_social_analysis(prospect, analysis)
            logger.info("[social-analysis] summary saved Prospect #%s", prospect.pk)
        else:
            logger.warning("[social-analysis] gemini analysis failed: %s", analysis.get("error"))
            logger.info("[social-analysis] skipped, continuing old flow")

        return {
            "success": analysis.get("success", False),
            "scraped_data": scraped_data,
            "analysis": analysis,
        }

    except Exception as exc:
        logger.warning("[social-analysis] skipped, continuing old flow: %s", exc)
        return {
            "success": False,
            "reason": "social_analysis_exception",
            "error": str(exc),
            "analysis": None,
        }


def prepare_engagement(prospect, user, scrape=True) -> dict:
    """
    Prépare seulement :
    - scraping
    - Gemini
    - message personnalisé
    - tâche CRM
    Aucun envoi ici.
    """
    try:
        if is_already_processed(prospect):
            return {
                "success": True,
                "status": "already_processed",
                "prospect_id": prospect.pk,
                "engagement_status": prospect.engagement_status,
            }

        set_status(prospect, "preparing")

        scraped_data = {}
        social_analysis = get_existing_social_analysis(prospect)

        if scrape and not social_analysis:
            scraper = EngagementScraper()
            scraped_data = scraper.scrape_prospect_profiles(prospect , user_id=user.id,)

            facebook_block_response = _facebook_session_block_response(scraped_data, prospect)
            if facebook_block_response:
                logger.warning(
                    "[facebook] session missing before Gemini for Prospect #%s: %s",
                    prospect.pk,
                    facebook_block_response.get("message"),
                )
                set_status(
                    prospect,
                    "new",
                    error=facebook_block_response.get("message"),
                    channel="facebook",
                )
                return facebook_block_response

            if _scrape_failed(scraped_data):
                response = _scrape_failure_response(scraped_data, prospect)
                logger.warning(
                    "[social-analysis] scraping failed before message generation: %s",
                    response.get("message"),
                )
                logger.info("[social-analysis] skipped, continuing old flow")
                scraped_data = {}

        profile_data = build_profile_data(prospect, scraped_data)

        selected_channel = None

        for candidate in ["linkedin", "instagram", "facebook"]:
            data = scraped_data.get(candidate)

            if isinstance(data, dict) and data and not data.get("error") and data.get("success") is not False:
                selected_channel = candidate
                break

        if not selected_channel:
            for candidate in ["linkedin", "instagram", "facebook"]:
                if getattr(prospect, f"{candidate}_url", None):
                    selected_channel = candidate
                    break

        if social_analysis:
            logger.info("[brain] using existing social analysis")
        else:
            social_context = enrich_prospect_with_social_analysis(
                prospect=prospect,
                channel=selected_channel,
                existing_scraped_data=scraped_data.get(selected_channel) if selected_channel else None,
            )
            social_analysis = social_context.get("analysis") if social_context.get("success") else None

        result = analyze_and_generate(profile_data, social_analysis=social_analysis)

        if not result:
            set_status(prospect, "failed", error="Gemini n'a pas retourné un résultat valide.")
            return {
                "success": False,
                "status": "gemini_failed",
                "prospect_id": prospect.pk,
            }

        result.should_send_now = False

        if not result.qualified or result.action_type == "no_action":
            set_status(
                prospect,
                "not_qualified",
                error=result.reason,
                channel=result.best_channel,
            )
            return {
                "success": True,
                "status": "not_qualified",
                "prospect_id": prospect.pk,
                "result": _dump(result),
            }

        set_status(prospect, "qualified", channel=result.best_channel)

        save_prepared_message(prospect, result)

        task = create_engagement_task(prospect, result, user)
        activity = create_task_activity(task, prospect, result, user, sent=False)

        prospect.engagement_status = "message_ready"
        prospect.save(update_fields=["engagement_status"])

        return {
            "success": True,
            "status": "message_ready",
            "prospect_id": prospect.pk,
            "result": _dump(result),
            "task_id": task.pk,
            "activity_id": activity.pk,
        }

    except Exception as exc:
        logger.exception("[runner] Erreur prepare Prospect #%s", getattr(prospect, "pk", None))

        try:
            set_status(prospect, "failed", error=str(exc)[:500])
        except Exception:
            pass

        return {
            "success": False,
            "status": "prepare_error",
            "error": str(exc)[:500],
        }


def send_prepared_engagement(prospect, user) -> dict:
    """
    Envoie uniquement après clic utilisateur.
    Ne scrape pas.
    Ne rappelle jamais Gemini.
    """
    try:
        if prospect.engagement_status not in {"message_ready", "task_created"}:
            return {
                "success": False,
                "status": "message_not_ready",
                "engagement_status": prospect.engagement_status,
            }

        sender = EngagementSender()
        result = sender.send_prepared(prospect, user)

        if result.get("sent"):
            mark_contacted(prospect, prospect.last_engagement_channel)
        else:
            set_status(
                prospect,
                "failed",
                error=result.get("error") or result.get("status"),
                channel=prospect.last_engagement_channel,
            )

        return result

    except Exception as exc:
        logger.exception("[runner] Erreur send Prospect #%s", prospect.pk)
        set_status(prospect, "failed", error=str(exc)[:500])
        return {
            "success": False,
            "status": "send_error",
            "error": str(exc)[:500],
        }
