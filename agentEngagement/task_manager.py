import logging
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger("agentEngagement.task_manager")


PRIORITY_DUE_DAYS = {
    "high": 1,
    "medium": 2,
    "low": 4,
}

CHANNEL_ACTIVITY_TYPE = {
    "email": "email",
    "phone": "call",
    "linkedin": "note",
    "facebook": "note",
    "instagram": "note",
    "manual": "note",
}


def _get_models():
    from sales.models import Task, TaskActivity
    return Task, TaskActivity


def create_engagement_task(prospect, result, user):
    Task, TaskActivity = _get_models()

    existing_task = Task.objects.filter(
        prospect=prospect,
        status__in=["todo", "in_progress"],
        company=prospect.company,
    ).first()

    if existing_task:
        return existing_task

    title = result.task_title or f"Contacter {prospect.first_name} via {result.best_channel}"

    description_parts = [
        f"🤖 Agent Engagement",
        f"📡 Canal : {result.best_channel}",
        f"⭐ Priorité : {result.priority}",
        f"🎯 Action : {result.action_type}",
        f"💡 Raison : {result.reason}",
    ]

    if result.subject:
        description_parts.append(f"📧 Objet : {result.subject}")

    if result.message:
        description_parts.append(f"✉️ Message préparé :\n{result.message}")

    if result.call_script:
        description_parts.append(f"📞 Script d'appel :\n{result.call_script}")

    if result.task_description:
        description_parts.append(f"📋 Contexte : {result.task_description}")

    priority = result.priority or "medium"
    due_date = timezone.now() + timedelta(days=PRIORITY_DUE_DAYS.get(priority, 2))

    task = Task.objects.create(
        title=title,
        description="\n\n".join(description_parts),
        task_type="classic",
        status="todo",
        priority=priority,
        due_date=due_date,
        prospect=prospect,
        assigned_to=prospect.assigned_to or user,
        created_by=user,
        company=prospect.company,
    )

    logger.info("[task_manager] Tâche #%s créée pour Prospect #%s", task.pk, prospect.pk)

    return task


def create_task_activity(task, prospect, result, user, sent: bool = False):
    Task, TaskActivity = _get_models()

    channel = result.best_channel
    activity_type = CHANNEL_ACTIVITY_TYPE.get(channel, "note")

    notes = [
        "🤖 Agent Engagement",
        "✅ Envoyé" if sent else "📝 Message préparé - validation commerciale requise",
        f"📡 Canal : {channel}",
        f"🎯 Action : {result.action_type}",
        f"💡 Raison : {result.reason}",
    ]

    if result.message:
        notes.append(f"✉️ Message :\n{result.message}")

    if result.call_script:
        notes.append(f"📞 Script :\n{result.call_script}")

    kwargs = {
        "task": task,
        "activity_type": activity_type,
        "performed_by": user,
        "prospect": prospect,
        "notes": "\n\n".join(notes),
    }

    if channel == "email":
        kwargs["email_subject"] = result.subject or ""
        kwargs["email_body"] = result.message or ""
        kwargs["email_sent_to"] = prospect.email or None

    return TaskActivity.objects.create(**kwargs)