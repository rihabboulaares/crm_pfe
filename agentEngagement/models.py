from django.db import models

from .token_crypto import decrypt_token, encrypt_token


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
            models.UniqueConstraint(
                fields=["user", "provider", "email"],
                name="unique_user_email_provider",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "provider", "is_active"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.provider})"

    def get_access_token(self):
        return decrypt_token(self.access_token)

    def set_access_token(self, value):
        self.access_token = encrypt_token(value)

    def get_refresh_token(self):
        return decrypt_token(self.refresh_token)

    def set_refresh_token(self, value):
        self.refresh_token = encrypt_token(value)


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
    action = models.CharField(
        max_length=40,
        choices=ACTION_CHOICES,
        default="message_generated",
    )
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
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )
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
        indexes = [
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return self.name


class ProspectEngagementMemory(models.Model):
    prospect = models.OneToOneField(
        "sales.Prospect",
        on_delete=models.CASCADE,
        related_name="engagement_memory",
    )
    relationship_summary = models.TextField(blank=True, null=True)
    interest_level = models.CharField(max_length=20, default="UNKNOWN")
    current_solution = models.CharField(max_length=255, blank=True, null=True)
    known_needs = models.JSONField(default=list, blank=True)
    known_pain_points = models.JSONField(default=list, blank=True)
    known_objections = models.JSONField(default=list, blank=True)
    known_requests = models.JSONField(default=list, blank=True)
    buying_signals = models.JSONField(default=list, blank=True)
    confirmed_facts = models.JSONField(default=list, blank=True)
    inferred_signals = models.JSONField(default=list, blank=True)
    timing = models.CharField(max_length=255, blank=True, null=True)
    decision_role = models.CharField(max_length=255, blank=True, null=True)
    preferred_channel = models.CharField(max_length=40, blank=True, null=True)
    last_interaction_channel = models.CharField(max_length=40, blank=True, null=True)
    last_interaction_outcome = models.CharField(max_length=40, blank=True, null=True)
    last_strategy = models.CharField(max_length=80, blank=True, null=True)
    last_objective = models.CharField(max_length=80, blank=True, null=True)
    next_direction = models.CharField(max_length=80, blank=True, null=True)
    last_analysis_confidence = models.FloatField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["prospect", "updated_at"]),
            models.Index(fields=["interest_level"]),
            models.Index(fields=["next_direction"]),
        ]

    def __str__(self):
        return f"Engagement memory for {self.prospect}"


class EngagementAgentRun(models.Model):
    """
    Représente une exécution complète de l'agent d'engagement.

    Ce modèle conserve uniquement des informations opérationnelles et
    auditables. Il ne stocke pas la chaîne de pensée privée du modèle.
    """

    GOAL_INITIAL = "INITIAL_ENGAGEMENT"
    GOAL_CONTINUE = "CONTINUE_AFTER_INTERACTION"
    GOAL_REPLAN = "REPLAN"

    GOAL_CHOICES = [
        (GOAL_INITIAL, "Engagement initial"),
        (GOAL_CONTINUE, "Continuation après interaction"),
        (GOAL_REPLAN, "Replanification"),
    ]

    STATUS_RUNNING = "RUNNING"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_MANUAL_REVIEW = "MANUAL_REVIEW"
    STATUS_FAILED = "FAILED"

    STATUS_CHOICES = [
        (STATUS_RUNNING, "En cours"),
        (STATUS_COMPLETED, "Terminé"),
        (STATUS_MANUAL_REVIEW, "Vérification requise"),
        (STATUS_FAILED, "Échec"),
    ]

    prospect = models.ForeignKey(
        "sales.Prospect",
        on_delete=models.CASCADE,
        related_name="engagement_agent_runs",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="engagement_agent_runs",
    )

    interaction_id = models.PositiveBigIntegerField(
        null=True,
        blank=True,
    )

    goal = models.CharField(
        max_length=50,
        choices=GOAL_CHOICES,
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_RUNNING,
    )

    content_generation_allowed = models.BooleanField(
        default=True,
    )

    manual_review_required = models.BooleanField(
        default=False,
    )

    manual_review_reason = models.TextField(
        blank=True,
        null=True,
    )

    final_strategy = models.CharField(
        max_length=80,
        blank=True,
        null=True,
    )

    final_objective = models.CharField(
        max_length=80,
        blank=True,
        null=True,
    )

    final_channel = models.CharField(
        max_length=40,
        blank=True,
        null=True,
    )

    policy_status = models.CharField(
        max_length=40,
        blank=True,
        null=True,
    )

    error_code = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    error_message = models.TextField(
        blank=True,
        null=True,
    )

    started_at = models.DateTimeField(
        auto_now_add=True,
    )

    finished_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["prospect", "started_at"]),
            models.Index(fields=["user", "started_at"]),
            models.Index(fields=["status", "started_at"]),
            models.Index(fields=["goal", "started_at"]),
        ]

    def __str__(self):
        return (
            f"Agent run #{self.pk} - "
            f"prospect={self.prospect_id} - "
            f"{self.goal} - {self.status}"
        )


class EngagementAgentStep(models.Model):
    """
    Étape observable d'une exécution de l'agent.

    reason contient uniquement une justification courte et exploitable
    pour l'audit. Il ne doit jamais contenir de chaîne de pensée détaillée.
    """

    run = models.ForeignKey(
        EngagementAgentRun,
        on_delete=models.CASCADE,
        related_name="steps",
    )

    step_number = models.PositiveIntegerField()

    action = models.CharField(
        max_length=80,
    )

    reason = models.TextField(
        blank=True,
        default="",
    )

    observation = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "step_number",
            "created_at",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["run", "step_number"],
                name="unique_engagement_agent_run_step",
            ),
        ]

        indexes = [
            models.Index(fields=["run", "step_number"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return (
            f"Run #{self.run_id} - "
            f"step {self.step_number} - "
            f"{self.action}"
        )
