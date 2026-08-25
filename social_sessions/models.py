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
    SESSION_READY = "SESSION_READY"
    SESSION_EXPIRED = "SESSION_EXPIRED"
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
    CHECKPOINT_REQUIRED = "CHECKPOINT_REQUIRED"
    CAPTCHA_REQUIRED = "CAPTCHA_REQUIRED"
    SESSION_FILE_MISSING = "SESSION_FILE_MISSING"
    SESSION_FILE_INVALID = "SESSION_FILE_INVALID"
    SESSION_HEALTHCHECK_FAILED = "SESSION_HEALTHCHECK_FAILED"

    STATUS_CHOICES = [
        (NOT_CONNECTED, "Non connecte"),
        (CONNECTED, "Connecte"),
        (EXPIRED, "Expire"),
        (VERIFICATION_REQUIRED, "Verification requise"),
        (ERROR, "Erreur"),
        (SESSION_READY, "Session prete"),
        (SESSION_EXPIRED, "Session expiree"),
        (LOGIN_REQUIRED, "Connexion requise"),
        (CHECKPOINT_REQUIRED, "Checkpoint requis"),
        (CAPTCHA_REQUIRED, "CAPTCHA requis"),
        (SESSION_FILE_MISSING, "Fichier absent"),
        (SESSION_FILE_INVALID, "Fichier invalide"),
        (SESSION_HEALTHCHECK_FAILED, "Health check echoue"),
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
