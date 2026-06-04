from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("sales", "0027_prospect_engagement_subject_and_more"),
        ("users", "0008_alter_invitation_role_alter_user_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="EngagementCampaign",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, null=True)),
                ("steps", models.JSONField(blank=True, default=list)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("active", "Active"), ("paused", "Paused"), ("completed", "Completed")], default="draft", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="engagement_campaigns", to="users.company")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="engagement_campaigns", to=settings.AUTH_USER_MODEL)),
                ("prospects", models.ManyToManyField(blank=True, related_name="engagement_campaigns", to="sales.prospect")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="EngagementLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("message_generated", "Message generated"), ("message_updated", "Message updated"), ("message_sent", "Message sent"), ("send_error", "Send error"), ("replied", "Replied"), ("follow_up_created", "Follow-up created"), ("campaign_created", "Campaign created")], default="message_generated", max_length=40)),
                ("channel", models.CharField(blank=True, max_length=50, null=True)),
                ("message", models.TextField(blank=True, null=True)),
                ("status", models.CharField(max_length=40)),
                ("error", models.TextField(blank=True, null=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="engagement_logs", to="users.company")),
                ("prospect", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="engagement_logs", to="sales.prospect")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="engagement_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="engagementcampaign",
            index=models.Index(fields=["company", "status"], name="agentEngag_company_58f518_idx"),
        ),
        migrations.AddIndex(
            model_name="engagementlog",
            index=models.Index(fields=["company", "status"], name="agentEngag_company_20d0ad_idx"),
        ),
        migrations.AddIndex(
            model_name="engagementlog",
            index=models.Index(fields=["prospect", "created_at"], name="agentEngag_prospec_eb1c1f_idx"),
        ),
    ]
