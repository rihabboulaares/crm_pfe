# subscriptions/models.py
from django.db import models
from users.models import Company
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


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

    # Stripe
    stripe_customer_id = models.CharField(max_length=100, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, null=True)
    stripe_payment_intent_id = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['end_date', 'is_active']),
            models.Index(fields=['trial_end_date', 'is_trial']),
            models.Index(fields=['stripe_subscription_id']),
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
        return self.expired or self.days_until_expiry() <= 0

    def is_blocked(self):
        return not self.is_active or self.expired

    # ── Emails ─────────────────────────────────────────────────
    def send_payment_success(self):
        admin = self.company.owner
        plan_name = self.plan.name.upper() if self.plan else ""
        try:
            send_mail(
                subject=f"✅ Paiement confirmé — Abonnement {plan_name}",
                message=f"""Bonjour {admin.username},

Votre paiement a été reçu avec succès.

📋 Détails :
- Plan    : {plan_name}
- Début   : {self.start_date}
- Fin     : {self.end_date}
- Montant : {self.plan.price} $ / mois

Merci de votre confiance !

Cordialement,
L'équipe CRM""",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin.email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"[EMAIL ERROR] send_payment_success: {e}")