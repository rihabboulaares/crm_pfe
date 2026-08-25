from django.db import models


class UserEmailConnection(models.Model):
    PROVIDER_GMAIL = "gmail"
    PROVIDER_MICROSOFT = "microsoft"
    PROVIDER_CHOICES = [
        (PROVIDER_GMAIL, "Gmail"),
        (PROVIDER_MICROSOFT, "Microsoft"),
    ]

    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="email_connections",
    )
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES)
    email = models.EmailField()
    display_name = models.CharField(max_length=255, blank=True, null=True)
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    last_verified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "provider", "email"], name="unique_user_email_provider"),
        ]
        indexes = [
            models.Index(fields=["user", "provider", "is_active"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.provider})"

    def get_access_token(self):
        return self.access_token

    def set_access_token(self, value):
        # Centralized hook for future token encryption/decryption.
        self.access_token = value or ""

    def get_refresh_token(self):
        return self.refresh_token

    def set_refresh_token(self, value):
        # Centralized hook for future token encryption/decryption.
        self.refresh_token = value or ""


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
    sender_name = models.CharField(max_length=255, blank=True, null=True)
    sender_email = models.EmailField(blank=True, null=True)
    provider = models.CharField(max_length=30, blank=True, null=True)
    provider_message_id = models.CharField(max_length=255, blank=True, null=True)
    error_code = models.CharField(max_length=80, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
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
