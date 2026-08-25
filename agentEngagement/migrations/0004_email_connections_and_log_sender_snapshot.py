from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("agentEngagement", "0003_update_engagementlog_actions"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserEmailConnection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("gmail", "Gmail"), ("microsoft", "Microsoft")], max_length=30)),
                ("email", models.EmailField(max_length=254)),
                ("display_name", models.CharField(blank=True, max_length=255, null=True)),
                ("access_token", models.TextField()),
                ("refresh_token", models.TextField(blank=True, null=True)),
                ("token_expires_at", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("last_verified_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="email_connections",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddField(
            model_name="engagementlog",
            name="error_code",
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name="engagementlog",
            name="error_message",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="engagementlog",
            name="provider",
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name="engagementlog",
            name="provider_message_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="engagementlog",
            name="sender_email",
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name="engagementlog",
            name="sender_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddIndex(
            model_name="useremailconnection",
            index=models.Index(fields=["user", "provider", "is_active"], name="agentEngage_user_id_ffa0b7_idx"),
        ),
        migrations.AddIndex(
            model_name="useremailconnection",
            index=models.Index(fields=["user", "is_active"], name="agentEngage_user_id_419d40_idx"),
        ),
        migrations.AddConstraint(
            model_name="useremailconnection",
            constraint=models.UniqueConstraint(fields=("user", "provider", "email"), name="unique_user_email_provider"),
        ),
    ]
