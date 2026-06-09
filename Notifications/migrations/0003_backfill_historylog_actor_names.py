from django.db import migrations


def get_user_display_name(user):
    if not user:
        return "Système"

    first_name = (getattr(user, "first_name", "") or "").strip()
    last_name = (getattr(user, "last_name", "") or "").strip()
    full_name = f"{first_name} {last_name}".strip()

    if full_name:
        return full_name

    if first_name:
        return first_name

    username = getattr(user, "username", None)
    if username:
        return username

    email = getattr(user, "email", None)
    if email:
        return email

    return str(user)


def backfill_actor_names(apps, schema_editor):
    HistoryLog = apps.get_model("Notifications", "HistoryLog")

    for log in HistoryLog.objects.exclude(actor=None).iterator():
        display_name = get_user_display_name(log.actor)
        if display_name and log.actor_name != display_name:
            log.actor_type = "user"
            log.actor_name = display_name
            log.performed_by_id = log.performed_by_id or log.actor_id
            log.save(update_fields=["actor_type", "actor_name", "performed_by"])


class Migration(migrations.Migration):
    dependencies = [
        ("Notifications", "0002_historylog_actor_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_actor_names, migrations.RunPython.noop),
    ]
