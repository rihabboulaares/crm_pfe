# notifications/models.py

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# ─── TYPES D'ACTIONS ──────────────────────────────────────────
ACTION_CHOICES = [
    ("create",  "Création"),
    ("update",  "Modification"),
    ("delete",  "Suppression"),
    ("assign",  "Assignation"),
    ("unassign","Désassignation"),
    ("status",  "Changement de statut"),
    ("stage",   "Changement d'étape"),
    ("comment", "Commentaire"),
    ("invite",  "Invitation"),
]

ENTITY_CHOICES = [
    ("prospect",    "Prospect"),
    ("contact",     "Contact"),
    ("opportunity", "Opportunité"),
    ("task",        "Tâche"),
    ("activity",    "Activité"),
    ("user",        "Utilisateur"),
    ("team",        "Équipe"),
    ("company",     "Entreprise"),
]

NOTIF_TYPE_CHOICES = [
    ("info",    "Info"),
    ("success", "Succès"),
    ("warning", "Avertissement"),
    ("error",   "Erreur"),
]


class HistoryLog(models.Model):
    """
    Enregistrement global de toute action sur n'importe quelle entité.
    Visible selon le rôle :
      - ADMIN    : tout
      - MANAGER  : son équipe
      - COMMERCIAL : ses propres entités
    """
    actor       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                    related_name="actions_performed",
                                    verbose_name="Auteur de l'action")
    actor_type = models.CharField(
        max_length=30,
        choices=[
            ("user", "User"),
            ("prospection_agent", "Agent de prospection"),
            ("engagement_agent", "Agent d'engagement"),
            ("system", "Système"),
        ],
        default="system",
    )
    actor_name = models.CharField(max_length=255, blank=True, null=True)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=30, choices=ENTITY_CHOICES)
    entity_id   = models.PositiveIntegerField(null=True, blank=True)
    entity_name = models.CharField(max_length=255, blank=True,
                                   help_text="Nom lisible de l'entité au moment de l'action")
    description = models.TextField(blank=True,
                                   help_text="Détail humain de ce qui a changé")
    old_value   = models.JSONField(null=True, blank=True,
                                   help_text="Valeurs avant modification")
    new_value   = models.JSONField(null=True, blank=True,
                                   help_text="Valeurs après modification")
    # Qui est concerné (pour le filtrage MANAGER/COMMERCIAL)
    affected_users = models.ManyToManyField(User, blank=True,
                                            related_name="history_concerned",
                                            verbose_name="Utilisateurs concernés")
    company     = models.ForeignKey("users.Company", on_delete=models.CASCADE,
                                    null=True, blank=True,
                                    related_name="history_logs")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Historique"
        verbose_name_plural = "Historiques"

    def __str__(self):
        actor_name = self.actor_name or (self.actor.username if self.actor else "Système")
        return f"[{self.get_action_display()}] {self.entity_type} #{self.entity_id} par {actor_name}"


class Notification(models.Model):
    """
    Notification personnelle pour chaque utilisateur.
    Générée automatiquement depuis les signals Django.
    """
    recipient   = models.ForeignKey(User, on_delete=models.CASCADE,
                                    related_name="notifications")
    history_log = models.ForeignKey(HistoryLog, on_delete=models.CASCADE,
                                    null=True, blank=True,
                                    related_name="notifications")
    title       = models.CharField(max_length=255)
    message     = models.TextField(blank=True)
    notif_type  = models.CharField(max_length=20, choices=NOTIF_TYPE_CHOICES,
                                   default="info")
    entity_type = models.CharField(max_length=30, choices=ENTITY_CHOICES,
                                   blank=True)
    entity_id   = models.PositiveIntegerField(null=True, blank=True)
    entity_name = models.CharField(max_length=255, blank=True)
    is_read     = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"[{self.recipient.username}] {self.title}"
