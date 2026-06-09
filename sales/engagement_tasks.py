from datetime import timedelta

from django.utils import timezone

from .models import Task, TaskActivity


TASK_STATUS_OPEN = ["pending", "ready", "in_progress", "todo"]

CHANNEL_TASK_TYPE = {
    "linkedin": "linkedin_message",
    "email": "email",
    "facebook": "facebook_message",
    "instagram": "instagram_message",
}


def prospect_name(prospect):
    return f"{prospect.first_name} {prospect.last_name}".strip()


def default_assignee(prospect, user=None):
    return prospect.assigned_to or user


def sync_task_calendar(task):
    if not task.due_date:
        return None
    try:
        from calendar_module.models import CalendarEvent
    except Exception:
        return None

    event, _ = CalendarEvent.objects.update_or_create(
        task=task,
        company=task.company,
        defaults={
            "title": task.title,
            "description": task.description or "",
            "start": task.due_date,
            "end": task.due_date + timedelta(minutes=30),
            "event_type": "task",
            "priority": task.priority or "medium",
            "assigned_to": task.assigned_to,
            "is_synced": True,
            "color": "#C8102E",
        },
    )
    return event


def mark_engagement_task_actor(task, user=None):
    task._history_actor_type = "engagement_agent"
    task._history_actor_name = "Agent d'engagement"
    if user:
        task._history_performed_by = user
        task._actor = user


def upsert_prospect_task(
    prospect,
    task_type,
    title,
    description,
    user=None,
    status="pending",
    priority="medium",
    due_date=None,
    source="engagement_agent",
    engagement_log=None,
    linked_engagement_message=None,
):
    assignee = default_assignee(prospect, user)
    due_date = due_date or timezone.now()

    task = (
        Task.objects.filter(
            prospect=prospect,
            company=prospect.company,
            task_type=task_type,
            status__in=TASK_STATUS_OPEN,
        )
        .order_by("due_date", "created_at")
        .first()
    )

    defaults = {
        "title": title,
        "description": description,
        "status": status,
        "priority": priority,
        "due_date": due_date,
        "assigned_to": assignee,
        "created_by": user or assignee,
        "company": prospect.company,
        "prospect_company": prospect.prospect_company,
        "source": source,
        "engagement_log": engagement_log,
        "linked_engagement_message": linked_engagement_message,
    }

    if task:
        changed = []
        for field, value in defaults.items():
            if value is not None and getattr(task, field) != value:
                setattr(task, field, value)
                changed.append(field)
        if changed:
            changed.append("updated_at")
            mark_engagement_task_actor(task, user)
            task.save(update_fields=list(set(changed)))
    else:
        task = Task(prospect=prospect, task_type=task_type, **defaults)
        mark_engagement_task_actor(task, user)
        task.save()

    sync_task_calendar(task)
    return task


def create_initial_engagement_tasks(prospect, user=None):
    created_or_updated = []
    name = prospect_name(prospect)
    tomorrow = timezone.now() + timedelta(days=1)

    if prospect.phone:
        created_or_updated.append(
            upsert_prospect_task(
                prospect,
                "call",
                f"Appeler {name}",
                f"Appel commercial initial pour le prospect {name}",
                user=user,
                status="pending",
                priority="high",
                due_date=tomorrow,
            )
        )

    if prospect.linkedin_url:
        created_or_updated.append(
            upsert_prospect_task(
                prospect,
                "linkedin_message",
                f"Envoyer un message LinkedIn a {name}",
                f"Premier message LinkedIn pour {name}",
                user=user,
                status="pending",
                due_date=tomorrow,
            )
        )

    if prospect.email:
        created_or_updated.append(
            upsert_prospect_task(
                prospect,
                "email",
                f"Envoyer un email a {name}",
                f"Premier email commercial pour {name}",
                user=user,
                status="pending",
                due_date=tomorrow,
            )
        )

    if prospect.facebook_url:
        created_or_updated.append(
            upsert_prospect_task(
                prospect,
                "facebook_message",
                f"Envoyer un message Facebook a {name}",
                f"Premier message Facebook pour {name}",
                user=user,
                status="pending",
                due_date=tomorrow,
            )
        )

    if prospect.instagram_url:
        created_or_updated.append(
            upsert_prospect_task(
                prospect,
                "instagram_message",
                f"Envoyer un message Instagram a {name}",
                f"Premier message Instagram pour {name}",
                user=user,
                status="pending",
                due_date=tomorrow,
            )
        )

    return created_or_updated


def mark_channel_task_ready(prospect, channel, message, user=None, engagement_log=None):
    task_type = CHANNEL_TASK_TYPE.get((channel or "").lower())
    if not task_type:
        return None
    name = prospect_name(prospect)
    channel_label = {
        "linkedin": "LinkedIn",
        "email": "email",
        "facebook": "Facebook",
        "instagram": "Instagram",
    }.get(channel, channel)
    return upsert_prospect_task(
        prospect,
        task_type,
        f"Envoyer le message {channel_label} prepare a {name}",
        message or "",
        user=user,
        status="ready",
        priority="high",
        due_date=timezone.now(),
        engagement_log=engagement_log,
        linked_engagement_message=message,
    )


def complete_channel_task_and_follow_up(prospect, channel, user=None, engagement_log=None):
    task_type = CHANNEL_TASK_TYPE.get((channel or "").lower())
    completed_task = None
    if task_type:
        completed_task = (
            Task.objects.filter(
                prospect=prospect,
                company=prospect.company,
                task_type=task_type,
                status__in=TASK_STATUS_OPEN,
            )
            .order_by("due_date", "created_at")
            .first()
        )
        if completed_task:
            now = timezone.now()
            completed_task.status = "completed"
            completed_task.completed_at = now
            completed_task.closed_at = now
            completed_task.engagement_log = engagement_log or completed_task.engagement_log
            completed_task.save(update_fields=["status", "completed_at", "closed_at", "engagement_log", "updated_at"])
            TaskActivity.objects.create(
                task=completed_task,
                activity_type="status_change",
                performed_by=user,
                prospect=prospect,
                notes="Tache d'engagement terminee apres envoi du message.",
            )
            sync_task_calendar(completed_task)

    name = prospect_name(prospect)
    follow_up = upsert_prospect_task(
        prospect,
        "follow_up",
        f"Relancer {name}",
        "Relance apres premier message envoye",
        user=user,
        status="pending",
        priority="medium",
        due_date=timezone.now() + timedelta(days=3),
        engagement_log=engagement_log,
    )
    return completed_task, follow_up
