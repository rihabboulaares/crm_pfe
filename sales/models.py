from django.db import models
from users.models import Company, Team, User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.validators import FileExtensionValidator
from django.utils import timezone


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
    SOURCE_CHOICES = [
        ("commercial", "Ajouté par un commercial"),
        ("agent_prospection", "Agent de prospection"),
        ("google_maps", "Google Maps"),
        ("linkedin", "LinkedIn"),
        ("instagram", "Instagram"),
        ("facebook", "Facebook"),
        ("web", "Web"),
        ("other", "Autre"),
    ]

    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=150, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    number_of_employees = models.IntegerField(blank=True, null=True)
    annual_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_prospect_companies",
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospect_companies",
    )

    website = models.URLField(blank=True, null=True)
    facebook_url = models.URLField(blank=True, null=True)
    instagram_url = models.URLField(blank=True, null=True)
    linkedin_url = models.URLField(blank=True, null=True)
    google_place_id = models.CharField(max_length=150, blank=True, null=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    google_maps_url = models.URLField(max_length=500, null=True, blank=True)
    score_ia = models.IntegerField(default=0)
    evaluation = models.CharField(
        max_length=10,
        choices=[("hot", "Hot"), ("warm", "Warm"), ("cold", "Cold")],
        blank=True, null=True,
    )
    next_action = models.CharField(max_length=50, blank=True, null=True)
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        default="commercial",
    )
    discovery_sources = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("name", "company")

    def __str__(self):
        return self.name


# ==============================
# PROSPECT (PERSONNE)
# ==============================
class Prospect(models.Model):
    STATUS_CHOICES = [
        ("new", "New"),
        ("review_needed", "Review Needed"),
        ("contacted", "Contacted"),
        ("qualified", "Qualified"),
        ("lost", "Lost"),
        ("won", "Won"),
    ]

    ORIGIN_CHOICES = [
        ("agent_prospection", "Agent de prospection"),
        ("website", "Website"),
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("linkedin", "LinkedIn"),
        ("google_maps", "Google Maps"),
        ("referral", "Referral"),
    ]

    EVALUATION_CHOICES = [
        ("cold", "Cold"),
        ("warm", "Warm"),
        ("hot", "Hot"),
    ]

    ENGAGEMENT_STATUS_CHOICES = [
        ("new", "New"),
        ("preparing", "Preparing"),
        ("pending_validation", "Pending Validation"),
        ("message_ready", "Message Ready"),
        ("sending", "Sending"),
        ("message_sent", "Message Sent"),
        ("reply_detected", "Reply Detected"),
        ("followup_generated", "Follow-up Generated"),
        ("opportunity_ready", "Opportunity Ready"),
        ("message_failed", "Message Failed"),
        ("replied", "Replied"),
        ("follow_up_required", "Follow-up Required"),
        ("closed", "Closed"),
        ("rejected", "Rejected"),
        # Legacy agent statuses kept readable for existing rows.
        ("queued", "Queued"),
        ("analyzing", "Analyzing"),
        ("qualified", "Qualified"),
        ("not_qualified", "Not Qualified"),
        ("task_created", "Task Created"),
        ("contacted", "Contacted"),
        ("waiting_reply", "Waiting Reply"),
        ("failed", "Failed"),
    ]

    SOURCE_CHOICES = [
        ("commercial", "Ajouté par un commercial"),
        ("agent_prospection", "Agent de prospection"),
        ("google_maps", "Google Maps"),
        ("linkedin", "LinkedIn"),
        ("instagram", "Instagram"),
        ("facebook", "Facebook"),
        ("web", "Web"),
        ("other", "Autre"),
    ]

    LEAD_ORIGIN_CHOICES = [
        ("manual", "Manual"),
        ("prospection_agent", "Prospection Agent"),
        ("google_maps", "Google Maps"),
        ("linkedin", "LinkedIn"),
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("website", "Website"),
    ]

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    title = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    origin = models.CharField(max_length=50, choices=ORIGIN_CHOICES, blank=True, null=True)
    evaluation = models.CharField(max_length=20, choices=EVALUATION_CHOICES, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")

    engagement_status = models.CharField(
        max_length=30,
        choices=ENGAGEMENT_STATUS_CHOICES,
        default="new",
    )
    last_engagement_at = models.DateTimeField(null=True, blank=True)
    last_engagement_channel = models.CharField(max_length=50, blank=True, null=True)
    generated_message = models.TextField(blank=True, null=True)
    engagement_error = models.TextField(blank=True, null=True)
    engagement_subject = models.CharField(max_length=255, blank=True, null=True)
    last_message_sent = models.TextField(blank=True, null=True)
    last_message_sent_at = models.DateTimeField(blank=True, null=True)
    last_reply_checked_at = models.DateTimeField(blank=True, null=True)
    last_reply_text = models.TextField(blank=True, null=True)
    last_reply_at = models.DateTimeField(blank=True, null=True)
    reply_summary = models.TextField(blank=True, null=True)
    reply_sentiment = models.CharField(max_length=50, blank=True, null=True)
    next_recommended_action = models.CharField(max_length=50, blank=True, null=True)
    generated_followup_message = models.TextField(blank=True, null=True)
    conversation_status = models.CharField(max_length=40, default="not_contacted")
    social_profile_summary = models.TextField(blank=True, null=True)
    social_profile_description = models.TextField(blank=True, null=True)
    social_profile_interests = models.JSONField(default=list, blank=True)
    social_profile_activity_level = models.CharField(max_length=50, blank=True, null=True)
    social_profile_tone = models.CharField(max_length=50, blank=True, null=True)
    social_profile_relevance = models.CharField(max_length=50, blank=True, null=True)
    social_profile_hook = models.TextField(blank=True, null=True)
    social_profile_topics = models.JSONField(default=list, blank=True)
    social_profile_analysis = models.JSONField(default=dict, blank=True)
    social_profile_last_analyzed_at = models.DateTimeField(blank=True, null=True)
    profile_summary = models.TextField(blank=True, null=True)
    profile_analysis_status = models.CharField(max_length=40, blank=True, null=True)
    last_analyzed_at = models.DateTimeField(blank=True, null=True)
    analysis_error_message = models.TextField(blank=True, null=True)
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        default="commercial",
    )
    lead_origin = models.CharField(
        max_length=50,
        choices=LEAD_ORIGIN_CHOICES,
        default="manual",
    )
    linkedin_url = models.URLField(blank=True, null=True)
    facebook_url = models.URLField(blank=True, null=True)
    instagram_url = models.URLField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    source_url = models.URLField(blank=True, null=True)
    discovery_sources = models.JSONField(default=list, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    google_maps_url = models.URLField(max_length=500, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    raison_score = models.TextField(blank=True, null=True)

    prospect_company = models.ForeignKey(
        ProspectCompany, on_delete=models.SET_NULL, null=True, blank=True, related_name="prospects"
    )
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ==============================
# DOSSIER PROSPECT 360
# ==============================
class ProspectAgentRun(models.Model):
    AGENT_TYPE_CHOICES = [
        ("discovery", "Discovery Agent"),
        ("enrichment", "Enrichment Agent"),
        ("qualification", "Qualification Agent"),
        ("engagement", "Engagement Agent"),
        ("crm", "CRM Agent"),
        ("other", "Autre"),
    ]
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name="agent_runs")
    agent_type = models.CharField(max_length=30, choices=AGENT_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    input_summary = models.TextField(blank=True, null=True)
    output_summary = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    audit_run = models.ForeignKey(
        "superadmin.AIAgentRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prospect_360_runs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["prospect", "started_at"]),
            models.Index(fields=["agent_type", "status"]),
        ]

    def __str__(self):
        return f"{self.prospect} - {self.agent_type} - {self.status}"


class ProspectActivity(models.Model):
    ACTIVITY_TYPE_CHOICES = [
        ("call_done", "Appel effectué"),
        ("email_sent", "Email envoyé"),
        ("message_sent", "Message envoyé"),
        ("reply_received", "Réponse reçue"),
        ("interaction_detected", "Interaction détectée"),
        ("interested", "Prospect intéressé"),
        ("not_interested", "Prospect non intéressé"),
        ("info_requested", "Demande d'informations"),
        ("meeting_scheduled", "Réunion planifiée"),
        ("meeting_done", "Réunion réalisée"),
        ("follow_up", "Relance"),
        ("no_response", "Aucun retour"),
        ("commercial_note", "Note commerciale"),
        ("other", "Autre"),
    ]
    CHANNEL_CHOICES = [
        ("phone", "Téléphone"),
        ("email", "Email"),
        ("linkedin", "LinkedIn"),
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("meeting", "Réunion"),
        ("website", "Site web"),
        ("other", "Autre"),
    ]
    SOURCE_CHOICES = [("manual", "Manual"), ("agent", "Agent"), ("system", "System")]

    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name="prospect_activities")
    activity_type = models.CharField(max_length=40, choices=ACTIVITY_TYPE_CHOICES)
    channel = models.CharField(max_length=30, choices=CHANNEL_CHOICES, blank=True, null=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="manual")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="prospect_activities")
    agent_run = models.ForeignKey(ProspectAgentRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="activities")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["prospect", "created_at"]),
            models.Index(fields=["activity_type", "source"]),
        ]

    def __str__(self):
        return f"{self.prospect} - {self.activity_type}"


class ProspectScoreHistory(models.Model):
    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name="score_history")
    previous_score = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    new_score = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    reason = models.TextField(blank=True, null=True)
    activity = models.ForeignKey(ProspectActivity, on_delete=models.SET_NULL, null=True, blank=True, related_name="score_changes")
    agent_run = models.ForeignKey(ProspectAgentRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="score_changes")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["prospect", "created_at"])]

    def __str__(self):
        return f"{self.prospect}: {self.previous_score} -> {self.new_score}"


class ProspectDocument(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ("presentation", "Présentation"),
        ("quote", "Devis"),
        ("contract", "Contrat"),
        ("proposal", "Proposition commerciale"),
        ("specifications", "Cahier des charges"),
        ("report", "Rapport"),
        ("attachment", "Pièce jointe"),
        ("other", "Autre"),
    ]
    SOURCE_CHOICES = [("manual", "Manual"), ("agent", "Agent"), ("system", "System")]

    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name="documents")
    name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES, default="attachment")
    file = models.FileField(
        upload_to="prospect_documents/%Y/%m/",
        validators=[FileExtensionValidator(allowed_extensions=["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt"])],
    )
    description = models.TextField(blank=True, null=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="manual")
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="prospect_documents")
    agent_run = models.ForeignKey(ProspectAgentRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="documents")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["prospect", "created_at"])]

    def __str__(self):
        return self.name


class ProspectRecommendation(models.Model):
    TYPE_CHOICES = [
        ("send_presentation", "Envoyer une présentation"),
        ("follow_up", "Relancer"),
        ("schedule_meeting", "Planifier une réunion"),
        ("create_opportunity", "Créer une opportunité"),
        ("qualify", "Qualifier"),
        ("other", "Autre"),
    ]
    PRIORITY_CHOICES = [("low", "Basse"), ("medium", "Moyenne"), ("high", "Haute"), ("critical", "Critique")]
    STATUS_CHOICES = [("pending", "Pending"), ("completed", "Completed"), ("ignored", "Ignored")]
    GENERATED_BY_CHOICES = [("manual", "Manual"), ("agent", "Agent"), ("system", "System")]

    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name="recommendations")
    recommendation_type = models.CharField(max_length=40, choices=TYPE_CHOICES, default="follow_up")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    generated_by = models.CharField(max_length=20, choices=GENERATED_BY_CHOICES, default="system")
    agent_run = models.ForeignKey(ProspectAgentRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="recommendations")
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "-created_at"]
        indexes = [
            models.Index(fields=["prospect", "status"]),
            models.Index(fields=["priority", "created_at"]),
        ]

    def __str__(self):
        return self.title


# ==============================
# OPPORTUNITY
# ==============================
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
    prospect = models.ForeignKey(
        "Prospect",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="opportunities",
    )
    contact = models.ForeignKey(
        "Contact",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="opportunities",
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="new")
    expected_close_date = models.DateField(null=True, blank=True)

    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._old_stage = self.stage

    def __str__(self):
        return self.name


# ==============================
# CONTACT
# ==============================
class Contact(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    title = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)

    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="contacts", null=True, blank=True
    )
    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="contacts",
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


# ==============================
# TASK
# ==============================
class Task(models.Model):
    TASK_TYPE_CHOICES = [
        ("classic", "Tache classique"),
        ("quota", "Tache quota / objectif"),
        ("call", "Appel"),
        ("linkedin_message", "Message LinkedIn"),
        ("email", "Email"),
        ("facebook_message", "Message Facebook"),
        ("instagram_message", "Message Instagram"),
        ("follow_up", "Relance"),
        ("meeting", "RDV"),
        ("note", "Note"),
        ("other", "Autre"),
    ]

    STATUS_CHOICES = [
        ("todo", "To Do"),
        ("pending", "Pending"),
        ("ready", "Ready"),
        ("in_progress", "In Progress"),
        ("done", "Done"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("failed", "Failed"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default="classic")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="todo")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    due_date = models.DateTimeField(null=True, blank=True)

    quota_target = models.PositiveIntegerField(null=True, blank=True)
    quota_progress = models.PositiveIntegerField(default=0)

    # ==============================
    # COMPTEURS D'ACTIVITÉ
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
    completed_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=60, blank=True, null=True)
    linked_engagement_message = models.TextField(blank=True, null=True)
    engagement_log = models.ForeignKey(
        "agentEngagement.EngagementLog",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )

    # ==============================
    # TÂCHE PARENTE
    # ==============================
    parent_task = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="follow_up_tasks",
    )

    # Assignation
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="tasks",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_tasks",
    )

    # Liens CRM
    prospect = models.ForeignKey(
        "Prospect", on_delete=models.SET_NULL, null=True, blank=True
    )
    prospect_company = models.ForeignKey(
        "ProspectCompany",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
    )
    contact = models.ForeignKey(
        "Contact", on_delete=models.SET_NULL, null=True, blank=True
    )
    opportunity = models.ForeignKey(
        "Opportunity", on_delete=models.SET_NULL, null=True, blank=True
    )

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="tasks"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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

    # ==============================
    # PROPERTIES
    # ==============================
    @property
    def is_overdue(self):
        if self.due_date and self.status not in ("done", "completed", "cancelled"):
            return timezone.now() > self.due_date
        return False

    @property
    def quota_percentage(self):
        if self.task_type == "quota" and self.quota_target:
            return min(100, round((self.quota_progress / self.quota_target) * 100))
        return 0

    @property
    def follow_up_count(self):
        return self.follow_up_tasks.count()

    @property
    def total_activities(self):
        return self.calls_count + self.emails_count + self.meetings_count + self.notes_count

    # ==============================
    # MÉTHODES
    # ==============================
    def check_quota_completion(self):
        if self.task_type == "quota" and self.quota_target is not None:
            if self.quota_progress >= self.quota_target:
                self.status = "completed"
                now = timezone.now()
                if not self.closed_at:
                    self.closed_at = now
                if not self.completed_at:
                    self.completed_at = now
                self.save(update_fields=["status", "closed_at", "completed_at"])

    def close(self, report="", user=None):
        self.status = "completed"
        self.closing_report = report
        now = timezone.now()
        self.closed_at = now
        self.completed_at = now
        self.save(update_fields=["status", "closing_report", "closed_at", "completed_at"])
        TaskActivity.objects.create(
            task=self,
            activity_type="status_change",
            performed_by=user,
            notes=f"Tâche clôturée. {f'Rapport : {report}' if report else ''}".strip(),
        )

    def increment_counter(self, activity_type):
        field_map = {
            "call": "calls_count",
            "email": "emails_count",
            "meeting": "meetings_count",
            "note": "notes_count",
        }
        field = field_map.get(activity_type)
        if field:
            Task.objects.filter(pk=self.pk).update(**{field: models.F(field) + 1})
            self.refresh_from_db(fields=[field])

    def get_status_display_fr(self):
        labels = {
            "todo": "À faire",
            "in_progress": "En cours",
            "done": "Terminé",
            "cancelled": "Annulé",
        }
        return labels.get(self.status, self.status)

    def get_priority_display_fr(self):
        labels = {
            "low": "Basse",
            "medium": "Moyenne",
            "high": "Haute",
        }
        return labels.get(self.priority, self.priority)


# ==============================
# TASK ACTIVITY
# ==============================
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

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    prospect = models.ForeignKey(
        "Prospect", on_delete=models.SET_NULL, null=True, blank=True
    )
    contact = models.ForeignKey(
        "Contact", on_delete=models.SET_NULL, null=True, blank=True
    )

    notes = models.TextField(blank=True, null=True)
    call_result = models.CharField(
        max_length=30, choices=CALL_RESULT_CHOICES, null=True, blank=True
    )
    call_duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    email_subject = models.CharField(max_length=255, blank=True, null=True)
    email_body = models.TextField(blank=True, null=True)
    email_sent_to = models.EmailField(blank=True, null=True)

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
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.task.increment_counter(self.activity_type)


# ==============================
# TASK COMMENT
# ==============================
class TaskComment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="task_comments"
    )
    content = models.TextField()
    parent_comment = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="replies",
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
# ==============================
class PerformanceScore(models.Model):
    commercial = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="performance_scores"
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="performance_scores"
    )

    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    tasks_total = models.PositiveIntegerField(default=0)
    tasks_done = models.PositiveIntegerField(default=0)
    tasks_on_time = models.PositiveIntegerField(default=0)
    tasks_late = models.PositiveIntegerField(default=0)

    calls_count = models.PositiveIntegerField(default=0)
    emails_count = models.PositiveIntegerField(default=0)
    meetings_count = models.PositiveIntegerField(default=0)

    opportunities_won = models.PositiveIntegerField(default=0)
    opportunities_total = models.PositiveIntegerField(default=0)

    penalty_points = models.IntegerField(default=0)
    score = models.FloatField(default=0.0)

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
    given_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="feedbacks_given"
    )
    commercial = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="feedbacks_received"
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="feedbacks"
    )

    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, null=True)

    year = models.PositiveIntegerField(null=True, blank=True)
    month = models.PositiveIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
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
# ==============================
class PerformanceGoal(models.Model):
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
        User, on_delete=models.CASCADE, related_name="goals_created"
    )
    commercial = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="performance_goals"
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="performance_goals"
    )

    goal_type = models.CharField(max_length=30, choices=GOAL_TYPE_CHOICES)
    target_value = models.PositiveIntegerField()
    current_value = models.PositiveIntegerField(default=0)

    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

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
        User, on_delete=models.CASCADE, related_name="badges"
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="badges"
    )

    badge_type = models.CharField(max_length=30, choices=BADGE_TYPE_CHOICES)
    year = models.PositiveIntegerField()
    month = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)]
    )

    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
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
# PIPELINE
# ==============================
class Pipeline(models.Model):
    PIPELINE_TYPE_CHOICES = [
        ("b2b", "B2B"),
        ("b2c", "B2C"),
        ("custom", "Personnalisé"),
    ]

    name = models.CharField(max_length=100)
    pipeline_type = models.CharField(
        max_length=20, choices=PIPELINE_TYPE_CHOICES, default="b2b"
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="pipelines"
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
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


# ==============================
# PIPELINE STAGE
# ==============================
class PipelineStage(models.Model):
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
        ("new", "Nouvelle"),
        ("qualified", "Qualifiée"),
        ("proposal", "Proposition"),
        ("negotiation", "Négociation"),
        ("won", "Gagnée"),
        ("lost", "Perdue"),
        ("none", "Aucun (étape personnalisée)"),
    ]

    pipeline = models.ForeignKey(
        Pipeline, on_delete=models.CASCADE, related_name="stages"
    )
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField(default=0)
    max_duration_days = models.PositiveIntegerField(
        default=7, help_text="Durée max en jours avant alerte"
    )
    warning_threshold_pct = models.PositiveIntegerField(
        default=80, help_text="% du temps écoulé avant alerte orange"
    )
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default="blue")
    description = models.TextField(blank=True, null=True)
    is_terminal = models.BooleanField(default=False)
    is_won = models.BooleanField(default=False)
    crm_stage = models.CharField(
        max_length=20,
        choices=CRM_STAGE_CHOICES,
        default="none",
        help_text="Stage CRM correspondant à cette étape pipeline",
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="pipeline_stages"
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


# ==============================
# OPPORTUNITY PIPELINE
# ==============================
class OpportunityPipeline(models.Model):
    STATUS_CHOICES = [
        ("on_track", "On Track"),
        ("at_risk", "At Risk"),
        ("delayed", "Delayed"),
        ("blocked", "Blocked"),
        ("won", "Won"),
        ("lost", "Lost"),
    ]

    opportunity = models.OneToOneField(
        "Opportunity", on_delete=models.CASCADE, related_name="pipeline_data"
    )
    pipeline = models.ForeignKey(
        Pipeline, on_delete=models.CASCADE, related_name="opportunities"
    )
    current_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="pipeline_opportunities",
    )
    stage_entered_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="on_track")
    progression = models.FloatField(default=0.0)
    notes = models.TextField(blank=True, null=True)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="opportunity_pipelines"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Opportunité Pipeline"
        verbose_name_plural = "Opportunités Pipeline"

    def __str__(self):
        return f"{self.opportunity.name} — {self.current_stage}"

    def compute_progression(self):
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
        if not self.current_stage:
            return "on_track"
        if self.current_stage.is_terminal:
            return "won" if self.current_stage.is_won else "lost"

        now = timezone.now()
        elapsed_days = (now - self.stage_entered_at).days
        max_days = self.current_stage.max_duration_days
        threshold = self.current_stage.warning_threshold_pct / 100

        if elapsed_days >= max_days:
            recent_activity = StageHistory.objects.filter(
                opportunity_pipeline=self,
                created_at__gte=now - timezone.timedelta(hours=48),
            ).exists()
            return "blocked" if not recent_activity else "delayed"

        if max_days > 0 and (elapsed_days / max_days) >= threshold:
            return "at_risk"

        return "on_track"

    def get_time_metrics(self):
        if not self.current_stage:
            return {}
        now = timezone.now()
        elapsed = (now - self.stage_entered_at).total_seconds() / 86400
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
        self.progression = self.compute_progression()
        self.status = self.compute_status()
        self.save(update_fields=["progression", "status", "updated_at"])


# ==============================
# STAGE HISTORY
# ==============================
class StageHistory(models.Model):
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
        OpportunityPipeline, on_delete=models.CASCADE, related_name="history"
    )
    from_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="history_from",
    )
    to_stage = models.ForeignKey(
        PipelineStage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="history_to",
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    notes = models.TextField(blank=True, null=True)
    duration_in_stage_hours = models.FloatField(null=True, blank=True)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="stage_histories"
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


# ==============================
# PIPELINE ALERT
# ==============================
class PipelineAlert(models.Model):
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
        OpportunityPipeline, on_delete=models.CASCADE, related_name="alerts"
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
        related_name="pipeline_alerts",
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="pipeline_alerts"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Alerte Pipeline"
        verbose_name_plural = "Alertes Pipeline"

    def __str__(self):
        return (
            f"[{self.severity.upper()}] {self.get_alert_type_display()} "
            f"— {self.opportunity_pipeline.opportunity.name}"
        )


# ==============================
# PIPELINE STAGE TASK (TEMPLATE)
# ==============================
class PipelineStageTask(models.Model):
    """
    Template de tâche défini par étape de pipeline.
    Quand une opportunité entre dans une étape, ces templates
    sont instanciés automatiquement en vrais Task liés à l'opportunité.
    """

    ACTIVITY_TYPE_CHOICES = [
        ("call", "Appel"),
        ("email", "Email"),
        ("meeting", "Réunion"),
        ("document", "Document"),
        ("research", "Recherche"),
        ("note", "Note"),
        ("other", "Autre"),
    ]

    stage = models.ForeignKey(
        PipelineStage, on_delete=models.CASCADE, related_name="task_templates"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    priority = models.CharField(
        max_length=20,
        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")],
        default="medium",
    )
    due_days_after_entry = models.PositiveIntegerField(
        default=2, help_text="Délai en jours pour la due_date de la tâche"
    )
    activity_type = models.CharField(
        max_length=20, choices=ACTIVITY_TYPE_CHOICES, default="other"
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="pipeline_stage_tasks"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["stage", "order"]
        verbose_name = "Template de tâche pipeline"
        verbose_name_plural = "Templates de tâches pipeline"

    def __str__(self):
        return f"{self.stage.name} → {self.title}"
