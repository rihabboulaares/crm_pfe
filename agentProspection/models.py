from django.conf import settings
from django.db import models
from django.utils import timezone

from users.models import Company


class DiscoveryRun(models.Model):
    STATUS_CHOICES = [
        ("success", "Success"),
        ("partial", "Partial"),
        ("failed", "Failed"),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="prospection_discovery_runs",
    )
    launched_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospection_discovery_runs",
    )
    query = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="success")
    result_data = models.JSONField(default=dict, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    duration_seconds = models.FloatField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["company", "started_at"]),
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"DiscoveryRun #{self.pk} - {self.status}"
