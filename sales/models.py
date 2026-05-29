from django.db import models
from users.models import Company, Team, User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

# ==============================
# ENTREPRISE CLIENTE
# ==============================
class Account(models.Model):
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ==============================
# ENTREPRISE PROSPECTÉE
# ==============================
class ProspectCompany(models.Model):
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    number_of_employees = models.IntegerField(blank=True, null=True)
    annual_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)  # Company du CRM
    created_at = models.DateTimeField(auto_now_add=True)
     # ── Champs ajoutés pour l'agent ──────────────────────────
    SOURCE_CHOICES = [
        ("commercial",        "Ajouté par un commercial"),
        ("agent_prospection", "Agent de prospection"),
    ]
    website         = models.URLField(blank=True, null=True)
    facebook_url    = models.URLField(blank=True, null=True)
    instagram_url   = models.URLField(blank=True, null=True)
    linkedin_url    = models.URLField(blank=True, null=True)
    google_place_id = models.CharField(max_length=150, blank=True, null=True)
    score_ia        = models.IntegerField(default=0)
    evaluation      = models.CharField(
        max_length=10,
        choices=[("hot","Hot"),("warm","Warm"),("cold","Cold")],
        blank=True, null=True
    )
    next_action     = models.CharField(max_length=50, blank=True, null=True)
    source          = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        default="commercial",
    )
    class Meta:
        unique_together = ('name', 'company')  # empêche doublons

    def __str__(self):
        return self.name


# ==============================
# PROSPECT (PERSONNE)
# ==============================
class Prospect(models.Model):
    STATUS_CHOICES = [
        ("new", "New"),
        ("contacted", "Contacted"),
        ("qualified", "Qualified"),
        ("lost", "Lost"),
        ("won", "Won"),
    ]

    ORIGIN_CHOICES = [
        ("website", "Website"),
        ("facebook", "Facebook"),
        ("linkedin", "LinkedIn"),
        ("referral", "Referral"),
    ]

    EVALUATION_CHOICES = [
        ("cold", "Cold"),
        ("warm", "Warm"),
        ("hot", "Hot"),
    ]

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    title = models.CharField(max_length=100, blank=True, null=True)

    email = models.EmailField(unique=True, blank=True, null=True)

    phone = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    origin = models.CharField(max_length=50, choices=ORIGIN_CHOICES, blank=True, null=True)
    evaluation = models.CharField(max_length=20, choices=EVALUATION_CHOICES, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")

    prospect_company = models.ForeignKey(ProspectCompany, on_delete=models.CASCADE, related_name="prospects")
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)  # company du CRM
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
     # ── Champs ajoutés pour l'agent ──────────────────────────
    SOURCE_CHOICES = [
        ("commercial",        "Ajouté par un commercial"),
        ("agent_prospection", "Agent de prospection"),
    ]
    source        = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        default="commercial",
    )
    linkedin_url  = models.URLField(blank=True, null=True)
    facebook_url  = models.URLField(blank=True, null=True)
    instagram_url = models.URLField(blank=True, null=True)
    website       = models.URLField(blank=True, null=True)
    raison_score  = models.TextField(blank=True, null=True)
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
class Opportunity(models.Model):

    STAGE_CHOICES = [
        ("new", "New"),
        ("qualified", "Qualified"),
        ("proposal", "Proposal Sent"),
        ("negotiation", "Negotiation"),
        ("won", "Won"),
        ("lost", "Lost"),
    ]

    name = models.CharField(max_length=255)
    # Prospect ou contact lié
    prospect = models.ForeignKey(
        "Prospect",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opportunities"
    )
    contact = models.ForeignKey(
        "Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opportunities"
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    stage = models.CharField(
        max_length=20,
        choices=STAGE_CHOICES,
        default="new"
    )

    expected_close_date = models.DateField(null=True, blank=True)

    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._old_stage = self.stage  # ← ajouter cette méthode

class Contact(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    title = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="contacts", null=True, blank=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    
    # ✅ NOUVEAU
    assigned_to = models.ForeignKey(
        "users.User",       # ✅ string avec app_label car User est dans une autre app
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="contacts",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    

class Task(models.Model):

    TASK_TYPE_CHOICES = [
        ("classic", "Tâche classique"),
        ("quota", "Tâche quota / objectif"),
    ]

    STATUS_CHOICES = [
        ("todo", "To Do"),
        ("in_progress", "In Progress"),
        ("done", "Done"),
        ("cancelled", "Cancelled"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    # Type de tâche : classique ou quota
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default="classic")
    
    # Pour tâches classiques
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="todo")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    due_date = models.DateTimeField(null=True, blank=True)
    
    # Pour tâches quota
    quota_target = models.PositiveIntegerField(null=True, blank=True)  # ex: 20 opportunités
    quota_progress = models.PositiveIntegerField(default=0)             # suivi automatique
     # ==============================
    # COMPTEURS D'ACTIVITÉ (mis à jour automatiquement)
    # ==============================
    calls_count = models.PositiveIntegerField(default=0)
    emails_count = models.PositiveIntegerField(default=0)
    meetings_count = models.PositiveIntegerField(default=0)
    notes_count = models.PositiveIntegerField(default=0)
    # ==============================
    # CLÔTURE
    # ==============================
    closing_report = models.TextField(blank=True, null=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    # ==============================
    # TÂCHE PARENTE (pour les tâches de suivi)
    # ==============================
    parent_task = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="follow_up_tasks"
    )
    # Assignation
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_tasks"
    )

    # Liens CRM
    prospect = models.ForeignKey(
        "Prospect",         # ✅ string → Django résout au moment du chargement
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    contact = models.ForeignKey(
        "Contact",          # ✅ fonctionne même si Contact est défini après
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    opportunity = models.ForeignKey(
        "Opportunity",
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

     # ==============================
    # SOCIÉTÉ (multi-tenant)
    # ==============================
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="tasks"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

     # ==============================
    # META
    # ==============================
    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Tâche"
        verbose_name_plural = "Tâches"
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "assigned_to"]),
            models.Index(fields=["company", "due_date"]),
        ]

    def __str__(self):
        return self.title
    def __str__(self):
        return self.title

     # ==============================
    # PROPERTIES
    # ==============================
    @property
    def is_overdue(self):
        """Vérifie si la tâche est en retard"""
        if self.due_date and self.status not in ("done", "cancelled"):
            return timezone.now() > self.due_date
        return False

    @property
    def quota_percentage(self):
        """Retourne le pourcentage de complétion du quota"""
        if self.task_type == "quota" and self.quota_target:
            return min(100, round((self.quota_progress / self.quota_target) * 100))
        return 0

    @property
    def follow_up_count(self):
        """Nombre de tâches de suivi créées depuis cette tâche"""
        return self.follow_up_tasks.count()

    @property
    def total_activities(self):
        """Nombre total d'activités enregistrées"""
        return self.calls_count + self.emails_count + self.meetings_count + self.notes_count

    # ==============================
    # MÉTHODES
    # ==============================
    def check_quota_completion(self):
        """
        Vérifie si le quota est atteint et marque la tâche Done automatiquement.
        Appelé après chaque mise à jour de quota_progress.
        """
        if self.task_type == "quota" and self.quota_target is not None:
            if self.quota_progress >= self.quota_target:
                self.status = "done"
                if not self.closed_at:
                    self.closed_at = timezone.now()
                self.save(update_fields=["status", "closed_at"])

    def close(self, report="", user=None):
        """
        Clôture la tâche avec un rapport optionnel.
        Crée automatiquement une activité de clôture.
        """
        self.status = "done"
        self.closing_report = report
        self.closed_at = timezone.now()
        self.save(update_fields=["status", "closing_report", "closed_at"])

        # Créer l'activité de clôture dans le signal ou ici directement
        TaskActivity.objects.create(
            task=self,
            activity_type="status_change",
            performed_by=user,
            notes=f"Tâche clôturée. {f'Rapport : {report}' if report else ''}".strip()
        )

    def increment_counter(self, activity_type):
        """
        Incrémente le compteur correspondant au type d'activité.
        Utilise update() pour éviter les race conditions.
        """
        field_map = {
            "call": "calls_count",
            "email": "emails_count",
            "meeting": "meetings_count",
            "note": "notes_count",
        }
        field = field_map.get(activity_type)
        if field:
            Task.objects.filter(pk=self.pk).update(
                **{field: models.F(field) + 1}
            )
            # Rafraîchir l'instance en mémoire
            self.refresh_from_db(fields=[field])

    def get_status_display_fr(self):
        """Retourne le statut en français"""
        labels = {
            "todo": "À faire",
            "in_progress": "En cours",
            "done": "Terminé",
            "cancelled": "Annulé",
        }
        return labels.get(self.status, self.status)

    def get_priority_display_fr(self):
        """Retourne la priorité en français"""
        labels = {
            "low": "Basse",
            "medium": "Moyenne",
            "high": "Haute",
        }
        return labels.get(self.priority, self.priority)

# models.py — à ajouter dans sales/models.py

class TaskActivity(models.Model):
    ACTIVITY_TYPE_CHOICES = [
        ("call", "Appel"),
        ("email", "Email"),
        ("note", "Note"),
        ("meeting", "Meeting"),
        ("status_change", "Changement de statut"),
    ]

    CALL_RESULT_CHOICES = [
        ("interested", "Intéressé"),
        ("callback", "Rappel"),
        ("not_interested", "Pas intéressé"),
        ("no_answer", "Pas de réponse"),
    ]

    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name="activities"
    )
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    
    # Qui a fait l'action
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )
    
    # Prospect ou contact lié (optionnel)
    prospect = models.ForeignKey(
        "Prospect",         # ✅ string
        on_delete=models.SET_NULL, null=True, blank=True
    )
    contact = models.ForeignKey(
        "Contact",          # ✅ string
        on_delete=models.SET_NULL, null=True, blank=True
    )

    # Contenu de l'activité
    notes = models.TextField(blank=True, null=True)
    call_result = models.CharField(
        max_length=30, choices=CALL_RESULT_CHOICES, null=True, blank=True
    )
    call_duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    # Pour les emails
    email_subject = models.CharField(max_length=255, blank=True, null=True)
    email_body = models.TextField(blank=True, null=True)
    email_sent_to = models.EmailField(blank=True, null=True)
 # Champs spécifiques aux meetings
    meeting_date = models.DateTimeField(null=True, blank=True)
    meeting_location = models.CharField(max_length=255, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Activité"
        verbose_name_plural = "Activités"

    def __str__(self):
        return f"{self.get_activity_type_display()} — {self.task.title}"

    def save(self, *args, **kwargs):
        """
        À la création d'une activité, incrémente automatiquement
        le compteur correspondant sur la tâche parente.
        """
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.task.increment_counter(self.activity_type)



class TaskComment(models.Model):

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments"
    )

    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="task_comments"
    )

    content = models.TextField()

    # Pour les réponses à un commentaire
    parent_comment = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Commentaire"
        verbose_name_plural = "Commentaires"

    def __str__(self):
        return f"Commentaire de {self.author} sur {self.task}"
    


# ==============================
# PERFORMANCE SCORE (KPI)
# Calculé en temps réel via le KPI engine
# Stocké pour l'historique mensuel
# ==============================
class PerformanceScore(models.Model):
    """
    Snapshot mensuel du score KPI d'un commercial.
    Créé/mis à jour à chaque appel à l'API KPI.
    """

    commercial = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="performance_scores"
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="performance_scores"
    )

    # Période (ex: 2025-03)
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    # ── Composantes brutes du score ──────────────────────────
    tasks_total = models.PositiveIntegerField(default=0)
    tasks_done = models.PositiveIntegerField(default=0)
    tasks_on_time = models.PositiveIntegerField(default=0)   # done avant due_date
    tasks_late = models.PositiveIntegerField(default=0)      # done après due_date ou overdue

    calls_count = models.PositiveIntegerField(default=0)
    emails_count = models.PositiveIntegerField(default=0)
    meetings_count = models.PositiveIntegerField(default=0)

    opportunities_won = models.PositiveIntegerField(default=0)
    opportunities_total = models.PositiveIntegerField(default=0)

    # ── Pénalités ────────────────────────────────────────────
    # Calculées automatiquement :
    # -10 pts par tâche en retard, -20 pts par tâche non faite
    penalty_points = models.IntegerField(default=0)  # valeur négative ou 0

    # ── Score final (0-100) ──────────────────────────────────
    score = models.FloatField(default=0.0)

    # ── Méta ─────────────────────────────────────────────────
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("commercial", "year", "month")
        ordering = ["-year", "-month"]
        verbose_name = "Score de performance"
        verbose_name_plural = "Scores de performance"
        indexes = [
            models.Index(fields=["company", "year", "month"]),
            models.Index(fields=["commercial", "year", "month"]),
        ]

    def __str__(self):
        return (
            f"{self.commercial.username} — "
            f"{self.month:02d}/{self.year} — {self.score:.1f}%"
        )


# ==============================
# MANAGER FEEDBACK
# ==============================
class ManagerFeedback(models.Model):
    """
    Feedback donné par un Manager ou Admin à un commercial.
    Lié optionnellement à un mois de performance.
    """

    given_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedbacks_given"
    )
    commercial = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedbacks_received"
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="feedbacks"
    )

    # Note 1-5
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, null=True)

    # Mois concerné (optionnel)
    year = models.PositiveIntegerField(null=True, blank=True)
    month = models.PositiveIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Feedback manager"
        verbose_name_plural = "Feedbacks manager"

    def __str__(self):
        return (
            f"Feedback de {self.given_by.username} "
            f"→ {self.commercial.username} ({self.rating}★)"
        )


# ==============================
# PERFORMANCE GOAL
# Objectif fixé par Manager/Admin à un commercial
# ==============================
class PerformanceGoal(models.Model):
    """
    Objectif mensuel fixé par un manager à un commercial.
    Le suivi (current_value) est mis à jour automatiquement
    par le KPI engine à chaque recalcul.
    """

    GOAL_TYPE_CHOICES = [
        ("prospects_contacted", "Prospects contactés"),
        ("opportunities_won", "Opportunités gagnées"),
        ("calls", "Appels effectués"),
        ("emails", "Emails envoyés"),
        ("meetings", "Meetings réalisés"),
        ("tasks_done", "Tâches terminées"),
    ]

    STATUS_CHOICES = [
        ("active", "En cours"),
        ("achieved", "Atteint"),
        ("failed", "Échoué"),
    ]

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="goals_created"
    )
    commercial = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="performance_goals"
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="performance_goals"
    )

    goal_type = models.CharField(max_length=30, choices=GOAL_TYPE_CHOICES)
    target_value = models.PositiveIntegerField()         # ex: 50
    current_value = models.PositiveIntegerField(default=0)  # mis à jour par le engine

    # Période
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="active"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month", "goal_type"]
        verbose_name = "Objectif de performance"
        verbose_name_plural = "Objectifs de performance"
        indexes = [
            models.Index(fields=["company", "year", "month"]),
            models.Index(fields=["commercial", "year", "month"]),
        ]

    def __str__(self):
        return (
            f"{self.get_goal_type_display()} — "
            f"{self.commercial.username} "
            f"{self.month:02d}/{self.year} "
            f"({self.current_value}/{self.target_value})"
        )

    @property
    def progress_pct(self):
        if self.target_value == 0:
            return 0
        return min(100, round(self.current_value / self.target_value * 100))


# ==============================
# COMMERCIAL BADGE
# ==============================
class CommercialBadge(models.Model):
    """
    Badge attribué automatiquement ou manuellement
    à un commercial selon ses performances.
    """

    BADGE_TYPE_CHOICES = [
        ("top_seller", "Top vendeur du mois"),
        ("on_time_100", "Respect des délais 100%"),
        ("best_closer", "Meilleur closing"),
        ("calls_100", "100 appels ce mois"),
        ("email_champion", "Email champion"),
        ("streak_3", "3 mois consécutifs top"),
        ("most_improved", "Plus grande progression"),
    ]

    commercial = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="badges"
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="badges"
    )

    badge_type = models.CharField(max_length=30, choices=BADGE_TYPE_CHOICES)

    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Un seul badge du même type par commercial par mois
        unique_together = ("commercial", "badge_type", "year", "month")
        ordering = ["-awarded_at"]
        verbose_name = "Badge"
        verbose_name_plural = "Badges"

    def __str__(self):
        return (
            f"{self.get_badge_type_display()} — "
            f"{self.commercial.username} "
            f"{self.month:02d}/{self.year}"
        )
# ==============================
# PIPELINE MODULE
# À ajouter à la fin de sales/models.py
# ==============================



class Pipeline(models.Model):
    """
    Définit un pipeline commercial (ex: B2B, B2C).
    Chaque company peut avoir plusieurs pipelines.
    """
    PIPELINE_TYPE_CHOICES = [
        ("b2b", "B2B"),
        ("b2c", "B2C"),
        ("custom", "Personnalisé"),
    ]

    name = models.CharField(max_length=100)
    pipeline_type = models.CharField(
        max_length=20,
        choices=PIPELINE_TYPE_CHOICES,
        default="b2b"
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="pipelines"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Pipeline"
        verbose_name_plural = "Pipelines"

    def __str__(self):
        return f"{self.name} ({self.get_pipeline_type_display()})"

    @property
    def stages_count(self):
        return self.stages.count()

    @property
    def opportunities_count(self):
        return self.opportunities.count()


class PipelineStage(models.Model):
    """
    Étape d'un pipeline.
    Chaque étape a un ordre, une durée max, et une couleur.
    """
    COLOR_CHOICES = [
        ("blue", "#3B82F6"),
        ("green", "#10B981"),
        ("yellow", "#F59E0B"),
        ("orange", "#F97316"),
        ("red", "#EF4444"),
        ("purple", "#8B5CF6"),
        ("pink", "#EC4899"),
        ("gray", "#6B7280"),
    ]
    CRM_STAGE_CHOICES = [
        ("new",         "Nouvelle"),
        ("qualified",   "Qualifiée"),
        ("proposal",    "Proposition"),
        ("negotiation", "Négociation"),
        ("won",         "Gagnée"),
        ("lost",        "Perdue"),
        ("none",        "Aucun (étape personnalisée)"),
    ]

    pipeline = models.ForeignKey(
        Pipeline,
        on_delete=models.CASCADE,
        related_name="stages"
    )
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)

    # Durée maximale recommandée pour cette étape (en jours)
    max_duration_days = models.PositiveIntegerField(
        default=7,
        help_text="Durée max en jours avant alerte"
    )

    # Seuil d'alerte (ex: 80% du temps écoulé → "at_risk")
    warning_threshold_pct = models.PositiveIntegerField(
        default=80,
        help_text="% du temps écoulé avant alerte orange"
    )

    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default="blue")
    description = models.TextField(blank=True, null=True)

    # Étape finale (won/lost)
    is_terminal = models.BooleanField(default=False)
    is_won = models.BooleanField(default=False)  # True si étape = "Gagné"
    crm_stage = models.CharField(
        max_length=20,
        choices=CRM_STAGE_CHOICES,
        default="none",
        help_text="Stage CRM correspondant à cette étape pipeline",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="pipeline_stages"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["pipeline", "order"]
        unique_together = ("pipeline", "order")
        verbose_name = "Étape du pipeline"
        verbose_name_plural = "Étapes du pipeline"

    def __str__(self):
        return f"{self.pipeline.name} → {self.name} (#{self.order})"

    @property
    def opportunities_count(self):
        return self.pipeline_opportunities.count()

    @property
    def color_hex(self):
        color_map = dict(self.COLOR_CHOICES)
        return color_map.get(self.color, "#3B82F6")


class OpportunityPipeline(models.Model):
    """
    Lie une Opportunity à un Pipeline + étape actuelle.
    Extension du modèle Opportunity existant.
    """
    STATUS_CHOICES = [
        ("on_track", "On Track"),
        ("at_risk", "At Risk"),
        ("delayed", "Delayed"),
        ("blocked", "Blocked"),
        ("won", "Won"),
        ("lost", "Lost"),
    ]

    opportunity = models.OneToOneField(
        "Opportunity",
        on_delete=models.CASCADE,
        related_name="pipeline_data"
    )
    pipeline = models.ForeignKey(
        Pipeline,
        on_delete=models.CASCADE,
        related_name="opportunities"
    )
    current_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="pipeline_opportunities"
    )

    # Quand l'opportunité est entrée dans l'étape actuelle
    stage_entered_at = models.DateTimeField(default=timezone.now)

    # Statut calculé automatiquement
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="on_track"
    )

    # Progression calculée (0-100)
    progression = models.FloatField(default=0.0)

    # Métadonnées
    notes = models.TextField(blank=True, null=True)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="opportunity_pipelines"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Opportunité Pipeline"
        verbose_name_plural = "Opportunités Pipeline"

    def __str__(self):
        return f"{self.opportunity.name} — {self.current_stage}"

    # ──────────────────────────────────────────────
    # CALCULS AUTOMATIQUES
    # ──────────────────────────────────────────────

    def compute_progression(self):
        """
        Calcule la progression en % selon l'étape actuelle.
        progression = (order de l'étape / nb total étapes) * 100
        """
        if not self.current_stage:
            return 0.0
        stages = list(
            self.pipeline.stages
            .exclude(is_terminal=True)
            .order_by("order")
            .values_list("order", flat=True)
        )
        if not stages:
            return 0.0
        total = len(stages)
        try:
            position = stages.index(self.current_stage.order) + 1
        except ValueError:
            return 0.0
        return round((position / total) * 100, 1)

    def compute_status(self):
        """
        Calcule le statut intelligent :
        - on_track  : dans les délais
        - at_risk   : proche de la limite (> warning_threshold_pct%)
        - delayed   : dépasse la durée max
        - blocked   : aucune activité ET en retard
        """
        if not self.current_stage:
            return "on_track"

        if self.current_stage.is_terminal:
            return "won" if self.current_stage.is_won else "lost"

        now = timezone.now()
        elapsed_days = (now - self.stage_entered_at).days
        max_days = self.current_stage.max_duration_days
        threshold = self.current_stage.warning_threshold_pct / 100

        if elapsed_days >= max_days:
            # Vérifier s'il y a eu une activité récente (48h)
            recent_activity = StageHistory.objects.filter(
                opportunity_pipeline=self,
                created_at__gte=now - timezone.timedelta(hours=48)
            ).exists()
            return "blocked" if not recent_activity else "delayed"

        if max_days > 0 and (elapsed_days / max_days) >= threshold:
            return "at_risk"

        return "on_track"

    def get_time_metrics(self):
        """
        Retourne les métriques de temps pour l'étape actuelle.
        """
        if not self.current_stage:
            return {}
        now = timezone.now()
        elapsed = (now - self.stage_entered_at).total_seconds() / 86400  # en jours
        max_days = self.current_stage.max_duration_days
        remaining = max(0, max_days - elapsed)
        pct_elapsed = min(100, round((elapsed / max_days) * 100, 1)) if max_days > 0 else 0

        return {
            "elapsed_days": round(elapsed, 1),
            "remaining_days": round(remaining, 1),
            "max_days": max_days,
            "pct_elapsed": pct_elapsed,
            "is_overdue": elapsed >= max_days,
        }

    def refresh_computed_fields(self):
        """Met à jour progression et status, puis sauvegarde."""
        self.progression = self.compute_progression()
        self.status = self.compute_status()
        self.save(update_fields=["progression", "status", "updated_at"])


class StageHistory(models.Model):
    """
    Historique des changements d'étapes d'une opportunité.
    Permet d'afficher la timeline et calculer la durée moyenne par étape.
    """
    ACTION_CHOICES = [
        ("entered", "Entrée dans l'étape"),
        ("exited", "Sortie de l'étape"),
        ("moved_forward", "Avancement"),
        ("moved_backward", "Retour"),
        ("won", "Gagné"),
        ("lost", "Perdu"),
        ("note", "Note ajoutée"),
        ("task_completed", "Tâche complétée"),
        ("alert", "Alerte générée"),
    ]

    opportunity_pipeline = models.ForeignKey(
        OpportunityPipeline,
        on_delete=models.CASCADE,
        related_name="history"
    )
    from_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="history_from"
    )
    to_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="history_to"
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    notes = models.TextField(blank=True, null=True)

    # Durée passée dans l'étape précédente (calculée à la sortie)
    duration_in_stage_hours = models.FloatField(null=True, blank=True)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="stage_histories"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Historique d'étape"
        verbose_name_plural = "Historiques d'étapes"

    def __str__(self):
        return (
            f"{self.opportunity_pipeline.opportunity.name} "
            f"— {self.get_action_display()} "
            f"({self.created_at.strftime('%d/%m/%Y %H:%M')})"
        )


class PipelineAlert(models.Model):
    """
    Alerte générée automatiquement pour une opportunité pipeline.
    Affichée dans NotificationBell ET dans le panneau Pipeline.
    """
    ALERT_TYPE_CHOICES = [
        ("stage_overdue", "Étape en retard"),
        ("no_activity", "Aucune activité"),
        ("tasks_pending", "Tâches en attente"),
        ("at_risk", "Opportunité à risque"),
        ("blocked", "Opportunité bloquée"),
    ]

    SEVERITY_CHOICES = [
        ("info", "Info"),
        ("warning", "Avertissement"),
        ("critical", "Critique"),
    ]

    opportunity_pipeline = models.ForeignKey(
        OpportunityPipeline,
        on_delete=models.CASCADE,
        related_name="alerts"
    )
    alert_type = models.CharField(max_length=30, choices=ALERT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="warning")
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    is_resolved = models.BooleanField(default=False)

    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="pipeline_alerts"
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="pipeline_alerts"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Alerte Pipeline"
        verbose_name_plural = "Alertes Pipeline"

    def __str__(self):
        return f"[{self.severity.upper()}] {self.get_alert_type_display()} — {self.opportunity_pipeline.opportunity.name}"


# ==============================
# PIPELINE STAGE TASK MODEL
# À ajouter à la fin de sales/models.py
# (après les modèles Pipeline, PipelineStage, OpportunityPipeline, StageHistory, PipelineAlert)
# ==============================

class PipelineStageTask(models.Model):
    ACTIVITY_TYPE_CHOICES = [
        ("call", "Appel"),
        ("email", "Email"),
        ("meeting", "Réunion"),
        ("document", "Document"),
        ("research", "Recherche"),
        ("note", "Note"),
        ("other", "Autre"),
    ]
    """
    Template de tâche défini par étape de pipeline.
    Quand une opportunité entre dans une étape, ces templates
    sont instanciés automatiquement en vrais Task liés à l'opportunité.
    """
    stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.CASCADE,
        related_name="task_templates"
    )
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order       = models.PositiveIntegerField(default=0)
    priority    = models.CharField(
        max_length=20,
        choices=[("low","Low"),("medium","Medium"),("high","High")],
        default="medium"
    )
    # Délai en jours après l'entrée dans l'étape (pour la due_date)
    due_days_after_entry = models.PositiveIntegerField(
        default=2,
        help_text="Délai en jours pour la due_date de la tâche"
    )
    activity_type = models.CharField(
        max_length=20,
        choices=ACTIVITY_TYPE_CHOICES,
        default="other",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="pipeline_stage_tasks"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["stage", "order"]
        verbose_name = "Template de tâche pipeline"
        verbose_name_plural = "Templates de tâches pipeline"

    def __str__(self):
        return f"{self.stage.name} → {self.title}"
