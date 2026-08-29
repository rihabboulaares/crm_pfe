import logging
from itertools import chain

from django.utils import timezone

logger = logging.getLogger("agentEngagement.context")


MAX_RECENT_INTERACTIONS = 20
MAX_RECENT_ACTIVITIES = 20
MAX_RECENT_TASKS = 20


def _iso(value):
    if not value:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return value.isoformat()


def _clean(value):
    if value == "":
        return None
    return value


def _full_name(prospect):
    return " ".join(
        part for part in [getattr(prospect, "first_name", None), getattr(prospect, "last_name", None)] if part
    ) or None


class ProspectEngagementContextBuilder:
    """
    Build a JSON-serializable CRM context for a prospect.

    This class only reads, normalizes and structures CRM data. It does not choose
    a strategy, choose a channel, generate content, call Gemini or infer intent.
    """

    def __init__(
        self,
        max_history=MAX_RECENT_INTERACTIONS,
        max_activities=MAX_RECENT_ACTIVITIES,
        max_tasks=MAX_RECENT_TASKS,
    ):
        self.max_history = max_history
        self.max_activities = max_activities
        self.max_tasks = max_tasks

    def build(self, prospect):
        prospect = self._load_prospect(prospect)
        context = {
            "prospect": self._build_prospect(prospect),
            "contact": self._build_contact(prospect),
            "company": self._build_company(getattr(prospect, "prospect_company", None)),
            "crm": self._build_crm(prospect),
            "engagement_memory": self._build_engagement_memory(prospect),
            "history": self._build_history(prospect),
            "activities": self._build_activities(prospect),
            "tasks": self._build_tasks(prospect),
        }
        logger.info("[ENGAGEMENT][CONTEXT] prospect=%s context_built", prospect.pk)
        return context

    def _load_prospect(self, prospect):
        if not getattr(prospect, "pk", None):
            return prospect

        from sales.models import Prospect

        return (
            Prospect.objects.select_related("prospect_company", "assigned_to", "company")
            .filter(pk=prospect.pk)
            .first()
            or prospect
        )

    def _build_prospect(self, prospect):
        return {
            "id": prospect.pk,
            "first_name": _clean(getattr(prospect, "first_name", None)),
            "last_name": _clean(getattr(prospect, "last_name", None)),
            "full_name": _full_name(prospect),
            "job_title": _clean(getattr(prospect, "title", None)),
            "location": self._location(getattr(prospect, "city", None), getattr(prospect, "country", None)),
            "source": _clean(getattr(prospect, "source", None)),
            "origin": _clean(getattr(prospect, "origin", None)),
            "lead_origin": _clean(getattr(prospect, "lead_origin", None)),
            "status": _clean(getattr(prospect, "status", None)),
            "evaluation": _clean(getattr(prospect, "evaluation", None)),
            "description": _clean(getattr(prospect, "description", None)),
            "created_at": _iso(getattr(prospect, "created_at", None)),
            "updated_at": _iso(getattr(prospect, "updated_at", None)),
        }

    def _build_contact(self, prospect):
        return {
            "email": _clean(getattr(prospect, "email", None)),
            "phone": _clean(getattr(prospect, "phone", None)),
            "linkedin_url": _clean(getattr(prospect, "linkedin_url", None)),
            "facebook_url": _clean(getattr(prospect, "facebook_url", None)),
            "instagram_url": _clean(getattr(prospect, "instagram_url", None)),
            "website": _clean(getattr(prospect, "website", None)),
        }

    def _build_company(self, company):
        if not company:
            return None

        return {
            "id": company.pk,
            "name": _clean(getattr(company, "name", None)),
            "industry": _clean(getattr(company, "industry", None)),
            "description": None,
            "location": self._location(getattr(company, "city", None), getattr(company, "country", None)),
            "website": _clean(getattr(company, "website", None)),
            "size": getattr(company, "number_of_employees", None),
            "source": _clean(getattr(company, "source", None)),
            "created_at": _iso(getattr(company, "created_at", None)),
        }

    def _build_crm(self, prospect):
        return {
            "engagement_status": _clean(getattr(prospect, "engagement_status", None)),
            "last_engagement_at": _iso(getattr(prospect, "last_engagement_at", None)),
            "last_engagement_channel": _clean(getattr(prospect, "last_engagement_channel", None)),
            "conversation_status": _clean(getattr(prospect, "conversation_status", None)),
            "last_message_sent_at": _iso(getattr(prospect, "last_message_sent_at", None)),
            "last_reply_checked_at": _iso(getattr(prospect, "last_reply_checked_at", None)),
            "last_reply_at": _iso(getattr(prospect, "last_reply_at", None)),
            "reply_sentiment": _clean(getattr(prospect, "reply_sentiment", None)),
        }

    def _build_engagement_memory(self, prospect):
        try:
            memory = prospect.engagement_memory
        except Exception:
            return None

        from .memory_manager import serialize_memory

        return serialize_memory(memory)

    def _build_history(self, prospect):
        history_logs = self._history_logs(prospect)
        crm_events = self._crm_events(prospect)
        engagement_logs = self._engagement_logs(prospect)

        rows = sorted(
            chain(history_logs, crm_events, engagement_logs),
            key=lambda item: item.get("created_at") or "",
        )
        return rows[-self.max_history :]

    def _history_logs(self, prospect):
        from Notifications.models import HistoryLog

        rows = (
            HistoryLog.objects.filter(entity_type="prospect", entity_id=prospect.pk)
            .select_related("actor", "performed_by")
            .order_by("-created_at")[: self.max_history]
        )
        return [
            {
                "source": "history_log",
                "id": row.pk,
                "type": _clean(row.action),
                "status": None,
                "summary": _clean(row.description),
                "actor_type": _clean(row.actor_type),
                "actor_name": _clean(row.actor_name),
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ]

    def _crm_events(self, prospect):
        from Notifications.models import CRMEvent

        rows = (
            CRMEvent.objects.filter(prospect=prospect)
            .select_related("user")
            .order_by("-created_at")[: self.max_history]
        )
        return [
            {
                "source": "crm_event",
                "id": row.pk,
                "type": _clean(row.event_type),
                "status": _clean(row.status),
                "summary": _clean(row.title or row.description),
                "category": _clean(row.category),
                "channel": _clean(row.channel),
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ]

    def _engagement_logs(self, prospect):
        rows = prospect.engagement_logs.order_by("-created_at")[: self.max_history]
        return [
            {
                "source": "engagement_log",
                "id": row.pk,
                "type": _clean(row.action),
                "status": _clean(row.status),
                "summary": _clean(row.error or row.message),
                "channel": _clean(row.channel),
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ]

    def _build_activities(self, prospect):
        prospect_activities = self._prospect_activities(prospect)
        task_activities = self._task_activities(prospect)

        rows = sorted(
            chain(prospect_activities, task_activities),
            key=lambda item: item.get("date") or "",
        )
        return rows[-self.max_activities :]

    def _prospect_activities(self, prospect):
        rows = (
            prospect.prospect_activities.select_related("created_by", "agent_run")
            .order_by("-created_at")[: self.max_activities]
        )
        return [
            {
                "source": "prospect_activity",
                "id": row.pk,
                "type": _clean(row.activity_type),
                "channel": _clean(row.channel),
                "status": None,
                "summary": _clean(row.title or row.description),
                "date": _iso(row.created_at),
                "metadata": self._activity_metadata(row),
            }
            for row in rows
        ]

    def _activity_metadata(self, activity):
        metadata = getattr(activity, "metadata", None) or {}
        if metadata.get("kind") != "engagement_interaction":
            return None

        allowed_keys = {
            "kind",
            "channel",
            "action_type",
            "outcome",
            "prospect_response",
            "commercial_notes",
            "generated_content_reference",
            "strategy_reference",
            "status",
            "performed_at",
        }
        return {key: metadata.get(key) for key in allowed_keys if key in metadata}

    def _task_activities(self, prospect):
        from sales.models import TaskActivity

        rows = (
            TaskActivity.objects.filter(prospect=prospect)
            .select_related("task", "performed_by")
            .order_by("-created_at")[: self.max_activities]
        )
        return [
            {
                "source": "task_activity",
                "id": row.pk,
                "type": _clean(row.activity_type),
                "channel": None,
                "status": _clean(row.call_result),
                "summary": _clean(row.notes or row.email_subject),
                "date": _iso(row.created_at),
                "task_id": getattr(row.task, "pk", None),
            }
            for row in rows
        ]

    def _build_tasks(self, prospect):
        from sales.models import Task

        rows = (
            Task.objects.filter(prospect=prospect)
            .select_related("assigned_to", "created_by", "engagement_log")
            .order_by("-created_at")[: self.max_tasks]
        )
        tasks = [
            {
                "id": row.pk,
                "title": _clean(row.title),
                "type": _clean(row.task_type),
                "status": _clean(row.status),
                "priority": _clean(row.priority),
                "due_date": _iso(row.due_date),
                "created_at": _iso(row.created_at),
                "completed_at": _iso(row.completed_at),
                "source": _clean(row.source),
            }
            for row in rows
        ]
        return sorted(tasks, key=lambda item: item.get("created_at") or "")

    def _location(self, city, country):
        city = _clean(city)
        country = _clean(country)
        if not city and not country:
            return None
        return {
            "city": city,
            "country": country,
        }
