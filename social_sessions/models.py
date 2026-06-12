from django.conf import settings
from django.db import models


class SocialSession(models.Model):
    LINKEDIN = "linkedin"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"

    PLATFORM_CHOICES = [
        (LINKEDIN, "LinkedIn"),
        (FACEBOOK, "Facebook"),
        (INSTAGRAM, "Instagram"),
    ]

    NOT_CONNECTED = "not_connected"
    CONNECTED = "connected"
    EXPIRED = "expired"
    VERIFICATION_REQUIRED = "verification_required"
    ERROR = "error"

    STATUS_CHOICES = [
        (NOT_CONNECTED, "Non connecte"),
        (CONNECTED, "Connecte"),
        (EXPIRED, "Expire"),
        (VERIFICATION_REQUIRED, "Verification requise"),
        (ERROR, "Erreur"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=NOT_CONNECTED)
    session_path = models.CharField(max_length=500, blank=True, null=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "platform")
        indexes = [
            models.Index(fields=["user", "platform"]),
            models.Index(fields=["status", "updated_at"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.platform} - {self.status}"
