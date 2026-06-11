from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("superadmin", "0001_initial"),
        ("users", "0008_alter_invitation_role_alter_user_role"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AIAgentRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("agent_type", models.CharField(choices=[("prospection", "Prospection"), ("engagement", "Engagement")], max_length=30)),
                ("query", models.TextField(blank=True, null=True)),
                ("status", models.CharField(choices=[("running", "Running"), ("success", "Success"), ("failed", "Failed"), ("partial", "Partial")], default="running", max_length=20)),
                ("prospects_found", models.PositiveIntegerField(default=0)),
                ("prospects_imported", models.PositiveIntegerField(default=0)),
                ("messages_generated", models.PositiveIntegerField(default=0)),
                ("messages_sent", models.PositiveIntegerField(default=0)),
                ("replies_detected", models.PositiveIntegerField(default=0)),
                ("source_google_maps", models.PositiveIntegerField(default=0)),
                ("source_linkedin", models.PositiveIntegerField(default=0)),
                ("source_facebook", models.PositiveIntegerField(default=0)),
                ("source_instagram", models.PositiveIntegerField(default=0)),
                ("source_website", models.PositiveIntegerField(default=0)),
                ("duration_seconds", models.FloatField(default=0)),
                ("error_message", models.TextField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_agent_runs", to="users.company")),
                ("launched_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_agent_runs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="SystemHealthLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("service", models.CharField(choices=[("backend", "Backend"), ("database", "Database"), ("redis", "Redis"), ("gemini", "Gemini"), ("playwright", "Playwright"), ("linkedin", "LinkedIn"), ("facebook", "Facebook"), ("instagram", "Instagram")], max_length=40)),
                ("status", models.CharField(choices=[("online", "Online"), ("offline", "Offline"), ("slow", "Slow"), ("warning", "Warning")], max_length=20)),
                ("response_time_ms", models.FloatField(blank=True, null=True)),
                ("message", models.TextField(blank=True, null=True)),
                ("checked_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-checked_at"]},
        ),
        migrations.CreateModel(
            name="SuperAdminAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("create", "Create"), ("update", "Update"), ("delete", "Delete"), ("login", "Login"), ("logout", "Logout"), ("launch_agent", "Launch agent"), ("send_message", "Send message"), ("subscription_change", "Subscription change"), ("toggle_user", "Toggle user"), ("toggle_company", "Toggle company")], max_length=40)),
                ("module", models.CharField(max_length=80)),
                ("object_id", models.CharField(blank=True, max_length=120, null=True)),
                ("object_repr", models.CharField(blank=True, max_length=255, null=True)),
                ("description", models.TextField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="superadmin_audit_logs", to=settings.AUTH_USER_MODEL)),
                ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="superadmin_audit_logs", to="users.company")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(model_name="aiagentrun", index=models.Index(fields=["company", "started_at"], name="superadmin__company_8ecb1d_idx")),
        migrations.AddIndex(model_name="aiagentrun", index=models.Index(fields=["agent_type", "started_at"], name="superadmin__agent_t_5e6ec1_idx")),
        migrations.AddIndex(model_name="aiagentrun", index=models.Index(fields=["status", "started_at"], name="superadmin__status_9bbf1a_idx")),
        migrations.AddIndex(model_name="systemhealthlog", index=models.Index(fields=["service", "checked_at"], name="superadmin__service_86240e_idx")),
        migrations.AddIndex(model_name="systemhealthlog", index=models.Index(fields=["status", "checked_at"], name="superadmin__status_d20abd_idx")),
        migrations.AddIndex(model_name="superadminauditlog", index=models.Index(fields=["company", "created_at"], name="superadmin__company_38c10b_idx")),
        migrations.AddIndex(model_name="superadminauditlog", index=models.Index(fields=["actor", "created_at"], name="superadmin__actor_i_7d0f84_idx")),
        migrations.AddIndex(model_name="superadminauditlog", index=models.Index(fields=["module", "created_at"], name="superadmin__module_b777f3_idx")),
        migrations.AddIndex(model_name="superadminauditlog", index=models.Index(fields=["action", "created_at"], name="superadmin__action_490b77_idx")),
    ]
