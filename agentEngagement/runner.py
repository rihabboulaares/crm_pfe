import logging

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

        set_status(prospect, "analyzing")

        scraped_data = {}

        if scrape:
            scraper = EngagementScraper()
            scraped_data = scraper.scrape_prospect_profiles(prospect , user_id=user.id,)

        profile_data = build_profile_data(prospect, scraped_data)

        result = analyze_and_generate(profile_data)

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