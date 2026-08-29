# superadmin/models.py
from django.db import models
from django.utils import timezone
from users.models import User, Company


# ══════════════════════════════════════════════════════════════
# SOURCE D'ACQUISITION
# ══════════════════════════════════════════════════════════════
class UserAcquisitionSource(models.Model):
    SOURCE_CHOICES = [
        ("google",        "Google Search"),
        ("social_media",  "Réseaux sociaux"),
        ("recommendation","Recommandation d'un ami"),
        ("advertising",   "Publicité"),
        ("linkedin",      "LinkedIn"),
        ("event",         "Événement / Conférence"),
        ("other",         "Autre"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="acquisition_source"
    )
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} → {self.source}"


# ══════════════════════════════════════════════════════════════
# ÉVALUATION DE L'APPLICATION
# ══════════════════════════════════════════════════════════════
class AppRating(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="app_rating"
    )
    rating = models.PositiveSmallIntegerField(
        choices=[(i, str(i)) for i in range(1, 6)]
    )
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} → {self.rating}/5"


# ══════════════════════════════════════════════════════════════
# FEEDBACK
# ══════════════════════════════════════════════════════════════
class UserFeedback(models.Model):
    CATEGORY_CHOICES = [
        ("suggestion",   "Suggestion"),
        ("bug",          "Problème / Bug"),
        ("improvement",  "Amélioration"),
        ("general",      "Général"),
    ]

    STATUS_CHOICES = [
        ("new",          "Nouveau"),
        ("in_review",    "En cours d'examen"),
        ("done",         "Traité"),
        ("rejected",     "Rejeté"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="feedbacks"
    )
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default="general"
    )
    message = models.TextField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="new"
    )
    admin_response = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.category}"


# ══════════════════════════════════════════════════════════════
# ACTIVITÉ UTILISATEUR (pour les stats d'utilisation)
# ══════════════════════════════════════════════════════════════
class UserActivity(models.Model):
    MODULE_CHOICES = [
        ("prospects",     "Prospects"),
        ("opportunities", "Opportunités"),
        ("tasks",         "Tâches"),
        ("contacts",      "Contacts"),
        ("accounts",      "Comptes"),
        ("dashboard",     "Dashboard"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="activities"
    )
    module = models.CharField(max_length=30, choices=MODULE_CHOICES)
    action = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["module", "created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.module}"
class SuperAdminAuditLog(models.Model):
    ACTION_CHOICES = [
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
        ("login", "Login"),
        ("logout", "Logout"),
        ("launch_agent", "Launch agent"),
        ("send_message", "Send message"),
        ("subscription_change", "Subscription change"),
        ("toggle_user", "Toggle user"),
        ("toggle_company", "Toggle company"),
        ("system_error", "System error"),
    ]

    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="superadmin_audit_logs")
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="superadmin_audit_logs")
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    module = models.CharField(max_length=80)
    object_id = models.CharField(max_length=120, null=True, blank=True)
    object_repr = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["module", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"{self.module}.{self.action}"


class AIAgentRun(models.Model):
    AGENT_TYPE_CHOICES = [("prospection", "Prospection"), ("engagement", "Engagement"), ("crm", "CRM")]
    STATUS_CHOICES = [("running", "Running"), ("success", "Success"), ("failed", "Failed"), ("partial", "Partial")]

    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_agent_runs")
    launched_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="ai_agent_runs")
    agent_type = models.CharField(max_length=30, choices=AGENT_TYPE_CHOICES)
    query = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="running")
    prospects_found = models.PositiveIntegerField(default=0)
    prospects_imported = models.PositiveIntegerField(default=0)
    messages_generated = models.PositiveIntegerField(default=0)
    messages_sent = models.PositiveIntegerField(default=0)
    replies_detected = models.PositiveIntegerField(default=0)
    source_google_maps = models.PositiveIntegerField(default=0)
    source_linkedin = models.PositiveIntegerField(default=0)
    source_facebook = models.PositiveIntegerField(default=0)
    source_instagram = models.PositiveIntegerField(default=0)
    source_website = models.PositiveIntegerField(default=0)
    duration_seconds = models.FloatField(default=0)
    error_message = models.TextField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["company", "started_at"]),
            models.Index(fields=["agent_type", "started_at"]),
            models.Index(fields=["status", "started_at"]),
        ]

    def __str__(self):
        return f"{self.agent_type} - {self.status}"


class SystemHealthLog(models.Model):
    SERVICE_CHOICES = [
        ("backend", "Backend"),
        ("database", "Database"),
        ("redis", "Redis"),
        ("gemini", "Gemini"),
    ]
    STATUS_CHOICES = [("online", "Online"), ("offline", "Offline"), ("slow", "Slow"), ("warning", "Warning")]

    service = models.CharField(max_length=40, choices=SERVICE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    response_time_ms = models.FloatField(null=True, blank=True)
    message = models.TextField(null=True, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["service", "checked_at"]),
            models.Index(fields=["status", "checked_at"]),
        ]

    def __str__(self):
        return f"{self.service}: {self.status}"
