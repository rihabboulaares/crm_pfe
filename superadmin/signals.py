from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from users.models import Company, User
from subscriptions.models import CompanySubscription

from .audit import create_audit_log


@receiver(post_save, sender=User)
def audit_user_created(sender, instance, created, **kwargs):
    if created and not instance.is_superuser and getattr(instance, "role", "") != "SUPERADMIN":
        create_audit_log(
            actor=None,
            company=getattr(instance, "company", None),
            action="create",
            module="users",
            object_id=instance.pk,
            object_repr=instance.email,
            description="Utilisateur cree",
            metadata={"role": getattr(instance, "role", None)},
        )


@receiver(pre_delete, sender=User)
def audit_user_deleted(sender, instance, **kwargs):
    if not instance.is_superuser and getattr(instance, "role", "") != "SUPERADMIN":
        create_audit_log(
            actor=None,
            company=getattr(instance, "company", None),
            action="delete",
            module="users",
            object_id=instance.pk,
            object_repr=instance.email,
            description="Utilisateur supprime",
        )


@receiver(post_save, sender=Company)
def audit_company_created(sender, instance, created, **kwargs):
    if created:
        create_audit_log(
            actor=None,
            company=instance,
            action="create",
            module="companies",
            object_id=instance.pk,
            object_repr=instance.name,
            description="Entreprise creee",
        )


@receiver(pre_delete, sender=Company)
def audit_company_deleted(sender, instance, **kwargs):
    create_audit_log(
        actor=None,
        company=instance,
        action="delete",
        module="companies",
        object_id=instance.pk,
        object_repr=instance.name,
        description="Entreprise supprimee",
    )


@receiver(post_save, sender=CompanySubscription)
def audit_subscription_saved(sender, instance, created, **kwargs):
    plan = getattr(instance, "plan", None)
    create_audit_log(
        actor=None,
        company=getattr(instance, "company", None),
        action="subscription_change",
        module="subscriptions",
        object_id=instance.pk,
        object_repr=plan.name if plan else "Subscription",
        description="Abonnement cree" if created else "Abonnement modifie",
        metadata={
            "created": created,
            "plan": plan.name if plan else None,
            "is_active": instance.is_active,
            "is_trial": instance.is_trial,
            "start_date": str(instance.start_date) if instance.start_date else None,
            "end_date": str(instance.end_date) if instance.end_date else None,
        },
    )
