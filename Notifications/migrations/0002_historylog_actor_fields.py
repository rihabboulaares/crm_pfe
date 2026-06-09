from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("Notifications", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="historylog",
            name="actor_type",
            field=models.CharField(
                choices=[
                    ("user", "User"),
                    ("prospection_agent", "Agent de prospection"),
                    ("engagement_agent", "Agent d'engagement"),
                    ("system", "Système"),
                ],
                default="system",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="historylog",
            name="actor_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="historylog",
            name="performed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="audit_logs",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
