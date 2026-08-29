from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("sales", "0043_prospectagentrun_prospectactivity_prospectdocument_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProspectQualification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "qualification_mode",
                    models.CharField(
                        choices=[
                            ("INITIAL", "Qualification initiale"),
                            ("POST_ENGAGEMENT", "Requalification après engagement"),
                        ],
                        max_length=30,
                    ),
                ),
                ("score", models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])),
                (
                    "deterministic_score",
                    models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)]),
                ),
                ("confidence", models.FloatField(default=0.0)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("ENGAGE", "À engager"),
                            ("DEEPEN", "À approfondir"),
                            ("READY_FOR_OPPORTUNITY", "Prêt pour une opportunité"),
                            ("NOT_QUALIFIED", "Non qualifié actuellement"),
                            ("ANALYSIS_INCOMPLETE", "Analyse incomplète"),
                        ],
                        max_length=40,
                    ),
                ),
                ("opportunity_ready", models.BooleanField(default=False)),
                ("recommended_action", models.CharField(max_length=60)),
                ("strengths", models.JSONField(blank=True, default=list)),
                ("risks", models.JSONField(blank=True, default=list)),
                ("missing_information", models.JSONField(blank=True, default=list)),
                ("detected_needs", models.JSONField(blank=True, default=list)),
                ("objections", models.JSONField(blank=True, default=list)),
                ("buying_signals", models.JSONField(blank=True, default=list)),
                ("summary", models.TextField(blank=True, default="")),
                ("signal_details", models.JSONField(blank=True, default=dict)),
                ("source_snapshot", models.JSONField(blank=True, default=dict)),
                ("error_code", models.CharField(blank=True, default="", max_length=100)),
                ("error_message", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="prospect_qualifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "prospect",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="qualifications",
                        to="sales.prospect",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["prospect", "created_at"], name="agentQuali_prospec_1b36f4_idx"),
                    models.Index(fields=["status", "created_at"], name="agentQuali_status_9edc03_idx"),
                    models.Index(fields=["qualification_mode", "created_at"], name="agentQuali_qualifi_0ded65_idx"),
                    models.Index(fields=["opportunity_ready", "created_at"], name="agentQuali_opportu_f19d27_idx"),
                ],
            },
        ),
    ]

