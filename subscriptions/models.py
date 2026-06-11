import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import models
from django.utils import timezone

from users.models import Company

logger = logging.getLogger(__name__)

FEATURE_CRM_AGENT = "crm_agent"
FEATURE_PROSPECTION_AGENT = "prospection_agent"
FEATURE_ENGAGEMENT_AGENT = "engagement_agent"
FEATURE_EXPORTS = "exports"

PLAN_FEATURES = {
    "starter": {
        FEATURE_CRM_AGENT,
    },
    "pro": {
        FEATURE_CRM_AGENT,
        FEATURE_PROSPECTION_AGENT,
        FEATURE_EXPORTS,
    },
    "enterprise": {
        FEATURE_CRM_AGENT,
        FEATURE_PROSPECTION_AGENT,
        FEATURE_ENGAGEMENT_AGENT,
        FEATURE_EXPORTS,
    },
}


class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    duration_days = models.IntegerField(default=30)
    max_users = models.IntegerField(null=True, blank=True)
    max_teams = models.IntegerField(null=True, blank=True)
    max_prospects = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    premium_features = models.JSONField(default=dict, blank=True)
    stripe_price_id = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.name


class CompanySubscription(models.Model):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True)
    start_date = models.DateField(auto_now_add=True)
    end_date = models.DateField(null=True, blank=True)
    is_trial = models.BooleanField(default=True)
    trial_end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    auto_renew = models.BooleanField(default=True)
    cancelled_at = models.DateField(null=True, blank=True)
    last_notification_sent = models.DateField(null=True, blank=True)
    reminder_7_days_sent = models.BooleanField(default=False)
    expiration_email_sent = models.BooleanField(default=False)
    trial_end_email_sent = models.BooleanField(default=False)

    stripe_customer_id = models.CharField(max_length=100, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, null=True)
    stripe_payment_intent_id = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=["end_date", "is_active"]),
            models.Index(fields=["trial_end_date", "is_trial"]),
            models.Index(fields=["stripe_subscription_id"]),
        ]

    def __str__(self):
        return f"{self.company.name} - {self.plan.name if self.plan else 'Aucun plan'}"

    @property
    def expired(self):
        if self.end_date:
            return self.end_date < timezone.now().date()
        return False

    @property
    def trial_expired(self):
        if self.is_trial and self.trial_end_date:
            return self.trial_end_date < timezone.now().date()
        return False

    def days_until_expiry(self):
        if self.end_date:
            return max((self.end_date - timezone.now().date()).days, 0)
        return None

    def can_change_plan(self):
        days = self.days_until_expiry()
        return self.expired or days is None or days <= 0

    def is_blocked(self):
        return not self.is_active or self.expired

    def get_plan_key(self):
        if not self.plan or not self.plan.name:
            return None
        return self.plan.name.lower().strip()

    def get_allowed_features(self):
        if self.is_blocked():
            return []
        plan_key = self.get_plan_key()
        return list(PLAN_FEATURES.get(plan_key, set()))

    def can_use(self, feature):
        if self.is_blocked():
            return False
        return feature in self.get_allowed_features()

    def get_admin_user(self):
        return getattr(self.company, "owner", None)

    def get_admin_email(self):
        admin = self.get_admin_user()
        if admin and admin.email:
            return admin.email
        return None

    def reset_notification_flags(self):
        self.reminder_7_days_sent = False
        self.expiration_email_sent = False
        self.trial_end_email_sent = False

    def send_expiry_reminder(self):
        admin = self.get_admin_user()
        admin_email = self.get_admin_email()
        if not admin_email:
            return False

        send_mail(
            subject="Votre abonnement CRM expire dans 7 jours",
            message=f"""Bonjour {admin.username},

Votre abonnement {self.plan.name if self.plan else ""} expire dans 7 jours.

Date de fin : {self.end_date}

Pour éviter toute interruption de service, veuillez renouveler votre abonnement avant cette date.

Cordialement,
L'équipe CRM""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=False,
        )

        self.reminder_7_days_sent = True
        self.last_notification_sent = timezone.now().date()
        self.save(update_fields=["reminder_7_days_sent", "last_notification_sent"])
        return True

    def send_expiration_email(self):
        admin = self.get_admin_user()
        admin_email = self.get_admin_email()
        if not admin_email:
            return False

        send_mail(
            subject="Votre abonnement CRM est expiré",
            message=f"""Bonjour {admin.username},

Votre abonnement CRM est arrivé à expiration aujourd'hui.

L'accès aux fonctionnalités CRM est maintenant suspendu.

Veuillez renouveler votre abonnement pour réactiver votre espace CRM.

Cordialement,
L'équipe CRM""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=False,
        )

        self.expiration_email_sent = True
        self.is_active = False
        self.last_notification_sent = timezone.now().date()
        self.save(update_fields=["expiration_email_sent", "is_active", "last_notification_sent"])
        return True

    def send_trial_ended_email(self):
        admin = self.get_admin_user()
        admin_email = self.get_admin_email()
        if not admin_email:
            return False

        send_mail(
            subject="Votre période d'essai CRM est terminée",
            message=f"""Bonjour {admin.username},

Votre période d'essai est terminée.

Pour continuer à utiliser votre CRM, veuillez choisir un abonnement.

Cordialement,
L'équipe CRM""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=False,
        )

        self.trial_end_email_sent = True
        self.last_notification_sent = timezone.now().date()
        self.save(update_fields=["trial_end_email_sent", "last_notification_sent"])
        return True

    def send_payment_success(self):
        admin = self.company.owner
        plan_name = self.plan.name.upper() if self.plan else ""
        try:
            send_mail(
                subject=f"Paiement confirmé - Abonnement {plan_name}",
                message=f"""Bonjour {admin.username},

Votre paiement a été reçu avec succès.

Détails :
- Plan    : {plan_name}
- Début   : {self.start_date}
- Fin     : {self.end_date}
- Montant : {self.plan.price if self.plan else 0} $ / mois

Merci de votre confiance !

Cordialement,
L'équipe CRM""",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"[EMAIL ERROR] send_payment_success: {e}")
