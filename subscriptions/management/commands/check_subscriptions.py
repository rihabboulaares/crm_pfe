# subscriptions/management/commands/check_subscriptions.py
#
# ══════════════════════════════════════════════════════════════
# STRUCTURE DE DOSSIERS À CRÉER :
#
# subscriptions/
# ├── __init__.py          ← déjà là
# ├── admin.py             ← déjà là
# ├── apps.py              ← déjà là
# ├── middleware.py        ← déjà là
# ├── models.py            ← déjà là
# ├── serializers.py       ← déjà là
# ├── signals.py           ← déjà là
# ├── urls.py              ← déjà là
# ├── utils.py             ← déjà là
# ├── views.py             ← déjà là
# │
# └── management/                       ← CRÉER CE DOSSIER
#     ├── __init__.py                   ← CRÉER CE FICHIER (vide)
#     └── commands/                     ← CRÉER CE DOSSIER
#         ├── __init__.py               ← CRÉER CE FICHIER (vide)
#         └── check_subscriptions.py   ← CE FICHIER ICI
#
# Commandes terminal pour créer la structure :
#   mkdir -p subscriptions/management/commands
#   touch subscriptions/management/__init__.py
#   touch subscriptions/management/commands/__init__.py
#
# Puis pour exécuter :
#   python manage.py check_subscriptions
#
# Pour automatiser (cron Linux — tous les jours à 8h) :
#   crontab -e
#   0 8 * * * /chemin/vers/venv/bin/python /chemin/vers/manage.py check_subscriptions
# ══════════════════════════════════════════════════════════════

from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from subscriptions.models import CompanySubscription
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Vérifie les abonnements — emails 7j avant + blocage le jour J"

    def handle(self, *args, **options):
        today = timezone.now().date()
        self.stdout.write(f"\n[{today}] ── Vérification des abonnements ──")

        # ── 1. Avertissement 7 jours avant expiration ────────
        expiring_soon = CompanySubscription.objects.filter(
            end_date=today + timedelta(days=7),
            is_active=True,
        ).select_related("company__owner", "plan")

        for sub in expiring_soon:
            sub.send_expiry_warning()
            self.stdout.write(
                self.style.WARNING(
                    f"  ⚠️  7j warning → {sub.company.name} (expire le {sub.end_date})"
                )
            )

        # ── 2. Expiration aujourd'hui → désactiver + email ───
        expired_today = CompanySubscription.objects.filter(
            end_date=today,
            is_active=True,
        ).select_related("company__owner", "plan")

        for sub in expired_today:
            sub.is_active = False
            sub.save(update_fields=["is_active"])
            sub.send_expired_notification()
            self.stdout.write(
                self.style.ERROR(f"  ❌ Expiré aujourd'hui → {sub.company.name}")
            )

        # ── 3. Déjà expirés mais encore actifs (sécurité) ───
        already_expired = CompanySubscription.objects.filter(
            end_date__lt=today,
            is_active=True,
        ).select_related("company__owner", "plan")

        for sub in already_expired:
            sub.is_active = False
            sub.save(update_fields=["is_active"])
            logger.warning(f"Corrigé (expiré depuis {sub.end_date}) : {sub.company.name}")
            self.stdout.write(
                self.style.WARNING(
                    f"  🔧 Corrigé → {sub.company.name} (expiré le {sub.end_date})"
                )
            )

        # ── 4. Fin de période d'essai ────────────────────────
        trial_expired = CompanySubscription.objects.filter(
            is_trial=True,
            trial_end_date__lte=today,
            is_active=True,
        ).select_related("company__owner", "plan")

        for sub in trial_expired:
            sub.is_trial = False
            sub.is_active = False
            sub.save(update_fields=["is_trial", "is_active"])

            admin = sub.company.owner
            try:
                send_mail(
                    subject="⏰ Votre période d'essai est terminée",
                    message=f"""Bonjour {admin.username},

Votre période d'essai est terminée.
Pour continuer à utiliser le CRM, souscrivez à un abonnement.

👉 http://localhost:3000/subscriptions

Cordialement,
L'équipe CRM""",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[admin.email],
                    fail_silently=False,
                )
                logger.info(f"[EMAIL] Fin essai → {admin.email}")
            except Exception as e:
                logger.error(f"[EMAIL ERROR] fin essai: {e}")

            self.stdout.write(
                self.style.WARNING(f"  ⏰ Essai terminé → {sub.company.name}")
            )

        self.stdout.write(self.style.SUCCESS("\n✅ Vérification terminée.\n"))