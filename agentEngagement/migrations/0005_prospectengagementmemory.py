from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("agentEngagement", "0004_email_connections_and_log_sender_snapshot"),
        ("sales", "0043_prospectagentrun_prospectactivity_prospectdocument_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProspectEngagementMemory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("relationship_summary", models.TextField(blank=True, null=True)),
                ("interest_level", models.CharField(default="UNKNOWN", max_length=20)),
                ("current_solution", models.CharField(blank=True, max_length=255, null=True)),
                ("known_needs", models.JSONField(blank=True, default=list)),
                ("known_pain_points", models.JSONField(blank=True, default=list)),
                ("known_objections", models.JSONField(blank=True, default=list)),
                ("known_requests", models.JSONField(blank=True, default=list)),
                ("buying_signals", models.JSONField(blank=True, default=list)),
                ("confirmed_facts", models.JSONField(blank=True, default=list)),
                ("inferred_signals", models.JSONField(blank=True, default=list)),
                ("timing", models.CharField(blank=True, max_length=255, null=True)),
                ("decision_role", models.CharField(blank=True, max_length=255, null=True)),
                ("preferred_channel", models.CharField(blank=True, max_length=40, null=True)),
                ("last_interaction_channel", models.CharField(blank=True, max_length=40, null=True)),
                ("last_interaction_outcome", models.CharField(blank=True, max_length=40, null=True)),
                ("last_strategy", models.CharField(blank=True, max_length=80, null=True)),
                ("last_objective", models.CharField(blank=True, max_length=80, null=True)),
                ("next_direction", models.CharField(blank=True, max_length=80, null=True)),
                ("last_analysis_confidence", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "prospect",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="engagement_memory",
                        to="sales.prospect",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddIndex(
            model_name="prospectengagementmemory",
            index=models.Index(fields=["prospect", "updated_at"], name="agentEngag_prospec_071b74_idx"),
        ),
        migrations.AddIndex(
            model_name="prospectengagementmemory",
            index=models.Index(fields=["interest_level"], name="agentEngag_interes_2ea99b_idx"),
        ),
        migrations.AddIndex(
            model_name="prospectengagementmemory",
            index=models.Index(fields=["next_direction"], name="agentEngag_next_di_f168f8_idx"),
        ),
    ]
