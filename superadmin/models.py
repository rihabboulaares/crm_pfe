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