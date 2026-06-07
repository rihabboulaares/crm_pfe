from django.db import models


class EngagementLog(models.Model):
    ACTION_CHOICES = [
        ("message_generated", "Message generated"),
        ("message_updated", "Message updated"),
        ("message_sent", "Message sent"),
        ("send_error", "Send error"),
        ("message_rejected", "Message rejected"),
        ("agent_launched", "Agent launched"),
        ("replied", "Replied"),
        ("follow_up_created", "Follow-up created"),
        ("campaign_created", "Campaign created"),
    ]

    prospect = models.ForeignKey(
        "sales.Prospect",
        on_delete=models.CASCADE,
        related_name="engagement_logs",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="engagement_logs",
    )
    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="engagement_logs",
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, default="message_generated")
    channel = models.CharField(max_length=50, blank=True, null=True)
    message = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=40)
    error = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["prospect", "created_at"]),
        ]

    def __str__(self):
        return f"{self.prospect} - {self.action} - {self.status}"


class EngagementCampaign(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("completed", "Completed"),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    steps = models.JSONField(default=list, blank=True)
    prospects = models.ManyToManyField(
        "sales.Prospect",
        blank=True,
        related_name="engagement_campaigns",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="engagement_campaigns",
    )
    company = models.ForeignKey(
        "users.Company",
        on_delete=models.CASCADE,
        related_name="engagement_campaigns",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "status"])]

    def __str__(self):
        return self.name
