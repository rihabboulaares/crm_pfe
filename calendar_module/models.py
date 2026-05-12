"""
calendar_module/models.py
Modèle CalendarEvent enrichi — liaisons CRM complètes
Supports : Task, Opportunity, PipelineStage, TaskActivity
"""
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class CalendarEvent(models.Model):
    EVENT_TYPES = [
        ("task",       "Tâche"),
        ("meeting",    "Réunion"),
        ("deadline",   "Échéance Opportunité"),
        ("reminder",   "Rappel"),
        ("stage",      "Étape Pipeline"),
        ("activity",   "Activité CRM"),      # ← NOUVEAU : TaskActivity
        ("pipeline_alert", "Alerte Pipeline"), # ← NOUVEAU : PipelineAlert
    ]

    PRIORITIES = [
        ("low",      "Basse"),
        ("medium",   "Moyenne"),
        ("high",     "Haute"),
        ("critical", "Critique"),
    ]

    # ── Champs principaux ──────────────────────────────────────────────────
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start       = models.DateTimeField()
    end         = models.DateTimeField(null=True, blank=True)
    all_day     = models.BooleanField(default=False)

    event_type  = models.CharField(max_length=20, choices=EVENT_TYPES, default="task")
    priority    = models.CharField(max_length=10, choices=PRIORITIES,  default="medium")

    # Couleur stockée (override possible via admin / API)
    color       = models.CharField(max_length=7, default="#1976d2")

    # ── Liaisons CRM ──────────────────────────────────────────────────────
    task = models.ForeignKey(
        "sales.Task",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    opportunity = models.ForeignKey(
        "sales.Opportunity",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    pipeline_stage = models.ForeignKey(
        "sales.PipelineStage",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="calendar_events",
    )
    # ← NOUVEAUX liens
    task_activity = models.ForeignKey(
        "sales.TaskActivity",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    pipeline_alert = models.ForeignKey(
        "sales.PipelineAlert",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    opportunity_pipeline = models.ForeignKey(
        "sales.OpportunityPipeline",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )

    assigned_to = models.ForeignKey(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="calendar_events",
    )

    # Société (multi-tenant)
    company = models.ForeignKey(
        "users.Company",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )

    reminder   = models.PositiveIntegerField(null=True, blank=True, help_text="Minutes avant")
    is_synced  = models.BooleanField(default=True, help_text="Sync automatique depuis CRM")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "calendar_module"
        ordering  = ["start"]
        indexes   = [
            models.Index(fields=["company", "start"]),
            models.Index(fields=["assigned_to", "start"]),
            models.Index(fields=["event_type", "start"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.start.date()})"

    # ── Palette de couleurs par priorité ──────────────────────────────────
    PRIORITY_COLORS = {
        "low":      "#4caf50",   # vert
        "medium":   "#1976d2",   # bleu
        "high":     "#ff9800",   # orange
        "critical": "#f44336",   # rouge
    }

    # Couleurs fixes par type d'événement (fallback si pas de priorité)
    EVENT_TYPE_COLORS = {
        "task":            "#7b1fa2",   # violet
        "meeting":         "#0288d1",   # bleu ciel
        "deadline":        "#C62828",   # rouge foncé
        "reminder":        "#f9a825",   # jaune
        "stage":           "#37474f",   # gris ardoise
        "activity":        "#00695c",   # vert teal
        "pipeline_alert":  "#bf360c",   # rouge brique
    }

    @property
    def color_resolved(self):
        """
        Couleur finale selon priorité > type.
        Utilisée par le frontend FullCalendar.
        """
        if self.priority and self.priority != "medium":
            return self.PRIORITY_COLORS.get(self.priority, self.color)
        return self.EVENT_TYPE_COLORS.get(self.event_type, self.color)

    @property
    def crm_object(self):
        """Retourne l'objet CRM lié (Task, Opportunity, etc.)"""
        return (
            self.task
            or self.opportunity
            or self.task_activity
            or self.pipeline_alert
        )