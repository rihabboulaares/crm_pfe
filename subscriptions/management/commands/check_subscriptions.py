import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from subscriptions.models import CompanySubscription

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Vérifie les abonnements et envoie les emails de rappel/expiration/fin d'essai."

    def handle(self, *args, **options):
        today = timezone.now().date()
        reminder_date = today + timedelta(days=7)

        self.stdout.write(f"[{today}] Vérification des abonnements")

        reminders = CompanySubscription.objects.filter(
            end_date=reminder_date,
            is_active=True,
            reminder_7_days_sent=False,
        ).select_related("company__owner", "plan")

        reminder_count = 0
        for subscription in reminders:
            try:
                if subscription.send_expiry_reminder():
                    reminder_count += 1
            except Exception as exc:
                logger.exception("Erreur email rappel J-7 pour %s", subscription.pk)
                self.stderr.write(f"Rappel J-7 non envoyé pour {subscription.company.name}: {exc}")

        expired = CompanySubscription.objects.filter(
            end_date__lte=today,
            expiration_email_sent=False,
        ).select_related("company__owner", "plan")

        expired_count = 0
        for subscription in expired:
            try:
                if subscription.send_expiration_email():
                    expired_count += 1
                elif subscription.is_active:
                    subscription.is_active = False
                    subscription.save(update_fields=["is_active"])
            except Exception as exc:
                logger.exception("Erreur email expiration pour %s", subscription.pk)
                subscription.is_active = False
                subscription.save(update_fields=["is_active"])
                self.stderr.write(f"Expiration sans email pour {subscription.company.name}: {exc}")

        trials = CompanySubscription.objects.filter(
            is_trial=True,
            trial_end_date__lte=today,
            trial_end_email_sent=False,
        ).select_related("company__owner", "plan")

        trial_count = 0
        for subscription in trials:
            try:
                if subscription.send_trial_ended_email():
                    trial_count += 1
                subscription.is_trial = False
                subscription.is_active = False
                subscription.save(update_fields=["is_trial", "is_active"])
            except Exception as exc:
                logger.exception("Erreur email fin essai pour %s", subscription.pk)
                subscription.is_trial = False
                subscription.is_active = False
                subscription.save(update_fields=["is_trial", "is_active"])
                self.stderr.write(f"Fin d'essai sans email pour {subscription.company.name}: {exc}")

        self.stdout.write(
            self.style.SUCCESS(
                "Vérification terminée: "
                f"{reminder_count} rappels J-7, "
                f"{expired_count} expirations, "
                f"{trial_count} fins d'essai."
            )
        )
