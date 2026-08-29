from django.conf import settings
from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


class ProspectQualification(models.Model):
    MODE_INITIAL = "INITIAL"
    MODE_POST_ENGAGEMENT = "POST_ENGAGEMENT"
    MODE_CHOICES = [
        (MODE_INITIAL, "Qualification initiale"),
        (MODE_POST_ENGAGEMENT, "Requalification après engagement"),
    ]

    STATUS_ENGAGE = "ENGAGE"
    STATUS_DEEPEN = "DEEPEN"
    STATUS_READY = "READY_FOR_OPPORTUNITY"
    STATUS_NOT_QUALIFIED = "NOT_QUALIFIED"
    STATUS_INCOMPLETE = "ANALYSIS_INCOMPLETE"
    STATUS_CHOICES = [
        (STATUS_ENGAGE, "À engager"),
        (STATUS_DEEPEN, "À approfondir"),
        (STATUS_READY, "Prêt pour une opportunité"),
        (STATUS_NOT_QUALIFIED, "Non qualifié actuellement"),
        (STATUS_INCOMPLETE, "Analyse incomplète"),
    ]

    ACTION_ENGAGE = "ENGAGE_PROSPECT"
    ACTION_DEEPEN = "DEEPEN_DISCOVERY"
    ACTION_CREATE_OPPORTUNITY = "CREATE_OPPORTUNITY"
    ACTION_DO_NOT_CONTACT = "DO_NOT_CONTACT"
    ACTION_RETRY = "RETRY_QUALIFICATION"

    prospect = models.ForeignKey(
        "sales.Prospect",
        on_delete=models.CASCADE,
        related_name="qualifications",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospect_qualifications",
    )
    qualification_mode = models.CharField(max_length=30, choices=MODE_CHOICES)
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    deterministic_score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    confidence = models.FloatField(default=0.0)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES)
    opportunity_ready = models.BooleanField(default=False)
    recommended_action = models.CharField(max_length=60)
    strengths = models.JSONField(default=list, blank=True)
    risks = models.JSONField(default=list, blank=True)
    missing_information = models.JSONField(default=list, blank=True)
    detected_needs = models.JSONField(default=list, blank=True)
    objections = models.JSONField(default=list, blank=True)
    buying_signals = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True, default="")
    signal_details = models.JSONField(default=dict, blank=True)
    source_snapshot = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=100, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["prospect", "created_at"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["qualification_mode", "created_at"]),
            models.Index(fields=["opportunity_ready", "created_at"]),
        ]

    def __str__(self):
        return f"{self.prospect_id} - {self.status} - {self.score}/100"

