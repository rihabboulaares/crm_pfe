from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from .models import CompanySubscription
import logging

logger = logging.getLogger(__name__)

def check_expired_subscriptions():
    """
    Vérifie les abonnements expirés et envoie des notifications
    À exécuter quotidiennement via cron ou Celery
    """
    today = timezone.now().date()
    
    # 1. Désactiver les abonnements expirés
    expired_subs = CompanySubscription.objects.filter(
        end_date__lt=today,
        is_active=True
    )
    
    for sub in expired_subs:
        sub.is_active = False
        sub.save(update_fields=['is_active'])
        logger.info(f"Abonnement {sub.id} désactivé (expiré le {sub.end_date})")
        
        # Envoyer notification d'expiration
        sub.send_expiry_notification()
    
    # 2. Notifier les abonnements qui expirent dans 7 jours
    expiring_soon = CompanySubscription.objects.filter(
        end_date=today + timedelta(days=7),
        is_active=True
    )
    
    for sub in expiring_soon:
        sub.send_expiry_notification()
    
    # 3. Gérer la fin des périodes d'essai
    trial_expired = CompanySubscription.objects.filter(
        is_trial=True,
        trial_end_date__lt=today,
        is_active=True
    )
    
    for sub in trial_expired:
        # Passer en mode payant
        sub.is_trial = False
        sub.save(update_fields=['is_trial'])
        logger.info(f"Période d'essai terminée pour {sub.id}")
        
        # Notifier l'admin
        subject = "Fin de votre période d'essai"
        message = f"""
        Bonjour {sub.company.owner.username},
        
        Votre période d'essai de 15 jours est terminée.
        Pour continuer à utiliser nos services, vous devez souscrire à un abonnement.
        
        Cordialement,
        L'équipe
        """
        # Envoyer l'email...