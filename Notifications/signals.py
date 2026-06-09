# notifications/signals.py
"""
Signals Django — créent automatiquement un HistoryLog + Notifications
à chaque création / modification / suppression.

CORRECTION PRINCIPALE :
  L'acteur est résolu par ordre de priorité :
    1. instance._actor  (posé explicitement par une view)
    2. get_current_user() depuis le middleware CurrentUserMiddleware
    3. None → affiché comme "Système" seulement si vraiment aucun user

Visibilité :
  ADMIN      → tout son entreprise
  MANAGER    → actions de son équipe
  COMMERCIAL → seulement ce qui le concerne directement
"""
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver, Signal
from django.contrib.auth import get_user_model

from .models import HistoryLog, Notification
from .utils import get_user_display_name
from .middleware import get_current_user   # ✅ Import du middleware

User = get_user_model()

entity_assigned = Signal()


# ─── HELPERS ──────────────────────────────────────────────────────

def resolve_actor(instance):
    """
    ✅ CORRECTION : Résout l'acteur dans l'ordre de priorité.
    Évite que l'acteur soit None quand la view ne pose pas _actor.
    """
    # 1. Posé explicitement par la view (priorité absolue)
    explicit = getattr(instance, "_history_actor", None) or getattr(instance, "_actor", None)
    if explicit is not None:
        return explicit
    # 2. Depuis le middleware (thread-local de la requête HTTP courante)
    from_middleware = get_current_user()
    if from_middleware and from_middleware.is_authenticated:
        return from_middleware
    # 3. Vraiment aucun user (tâche Celery, commande manage.py, etc.)
    return None


def user_display_name(user):
    return get_user_display_name(user)


def resolve_actor_metadata(instance, actor):
    actor_type = getattr(instance, "_history_actor_type", None) or ("user" if actor else "system")
    actor_name = getattr(instance, "_history_actor_name", None)
    performed_by = getattr(instance, "_history_performed_by", None) or actor

    if actor_type == "user" and performed_by:
        actor_name = get_user_display_name(performed_by)
    elif actor_type == "prospection_agent":
        actor_name = "Agent de prospection"
    elif actor_type == "engagement_agent":
        actor_name = "Agent d'engagement"
    elif not actor_name:
        actor_name = "Système"

    return actor_type, actor_name, performed_by


def get_company_from_instance(instance):
    if hasattr(instance, "company"):
        return instance.company
    if hasattr(instance, "assigned_to") and instance.assigned_to:
        return getattr(instance.assigned_to, "company", None)
    return None


def get_affected_users(instance, actor, entity_type):
    """
    Retourne le set des utilisateurs à notifier / à lier au log.
    Règles de visibilité :
      - Tous les ADMIN de la company voient tout
      - Les MANAGER voient les actions de leur équipe
      - Le COMMERCIAL assigné est toujours inclus
    """
    affected = set()
    company = get_company_from_instance(instance)
    if not company:
        return affected

    # Tous les admins de la company
    admins = User.objects.filter(company=company, role="ADMIN", is_active=True)
    affected.update(admins)

    # L'utilisateur assigné + ses managers
    assigned_user = getattr(instance, "assigned_to", None)
    if assigned_user:
        affected.add(assigned_user)
        for team in assigned_user.teams.all():
            managers = team.members.filter(role="MANAGER", is_active=True)
            affected.update(managers)

    # Si l'acteur est un manager/admin, l'ajouter aussi
    if actor and getattr(actor, "role", None) in ("MANAGER", "ADMIN"):
        affected.add(actor)

    # On n'envoie pas de notif à l'acteur lui-même (il sait ce qu'il fait)
    if actor:
        affected.discard(actor)

    return affected


def get_notif_type(action):
    return {
        "create":  "success",
        "update":  "info",
        "delete":  "error",
        "assign":  "info",
        "unassign":"warning",
        "status":  "info",
        "stage":   "info",
        "comment": "info",
        "invite":  "success",
    }.get(action, "info")


def create_history_and_notifications(
    actor, action, entity_type, entity_id, entity_name,
    description, old_value=None, new_value=None,
    affected_users=None, company=None,
    actor_type=None, actor_name=None, performed_by=None
):
    """Fonction centrale — crée le HistoryLog + toutes les Notifications."""
    actor_type = actor_type or ("user" if actor else "system")
    performed_by = performed_by or actor

    if actor_type == "user" and performed_by:
        actor_name = get_user_display_name(performed_by)
    elif actor_type == "engagement_agent":
        actor_name = "Agent d'engagement"
    elif actor_type == "prospection_agent":
        actor_name = "Agent de prospection"
    elif not actor_name:
        actor_name = "Système"

    log = HistoryLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        description=description,
        old_value=old_value,
        new_value=new_value,
        company=company,
        actor_type=actor_type,
        actor_name=actor_name,
        performed_by=performed_by,
    )
    if affected_users:
        log.affected_users.set(affected_users)

    actor_name = log.actor_name or "Système"
    notif_type = get_notif_type(action)

    action_labels = {
        "create":"créé(e)", "update":"modifié(e)", "delete":"supprimé(e)",
        "assign":"assigné(e)", "unassign":"désassigné(e)", "status":"statut changé",
        "stage":"étape changée", "comment":"commenté(e)", "invite":"invité(e)",
    }
    entity_labels = {
        "prospect":"Prospect", "contact":"Contact", "opportunity":"Opportunité",
        "task":"Tâche", "activity":"Activité", "user":"Utilisateur",
        "team":"Équipe", "company":"Entreprise",
    }
    entity_label = entity_labels.get(entity_type, entity_type)
    verb         = action_labels.get(action, action)

    notifications = [
        Notification(
            recipient=u,
            history_log=log,
            title=f"{entity_label} {verb}",
            message=description or f"« {entity_name} » {verb} par {actor_name}",
            notif_type=notif_type,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
        )
        for u in (affected_users or [])
    ]
    if notifications:
        Notification.objects.bulk_create(notifications)
    return log


# ─── PROSPECT ─────────────────────────────────────────────────────

@receiver(pre_save, sender="sales.Prospect")
def prospect_pre_save(sender, instance, **kwargs):
    instance._pre_save_state = sender.objects.get(pk=instance.pk) if instance.pk else None


@receiver(post_save, sender="sales.Prospect")
def prospect_post_save(sender, instance, created, **kwargs):
    actor    = resolve_actor(instance)          # ✅ résolution fiable
    actor_type, actor_name, performed_by = resolve_actor_metadata(instance, actor)
    company  = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "prospect")
    name     = f"{instance.first_name} {instance.last_name}"

    if created:
        create_history_and_notifications(
            actor=actor, action="create", entity_type="prospect",
            entity_id=instance.pk, entity_name=name,
            description=(
                f"Prospect « {name} » créé"
                + (f", assigné à {instance.assigned_to.username}" if instance.assigned_to else "")
            ),
            new_value={"email": instance.email, "status": instance.status},
            affected_users=affected, company=company,
            actor_type=actor_type, actor_name=actor_name, performed_by=performed_by,
        )
    else:
        old = getattr(instance, "_pre_save_state", None)
        if not old:
            return
        watch = ["first_name","last_name","email","status","phone","assigned_to_id"]
        changes = {
            f: {"from": str(getattr(old, f, None)), "to": str(getattr(instance, f, None))}
            for f in watch if getattr(old, f, None) != getattr(instance, f, None)
        }
        if not changes:
            return
        action = "assign" if "assigned_to_id" in changes else ("status" if "status" in changes else "update")
        readable = {"first_name":"Prénom","last_name":"Nom","email":"Email",
                    "status":"Statut","phone":"Téléphone","assigned_to_id":"Assigné à"}
        desc = "Prospect modifié — " + ", ".join(
            f"{readable.get(k,k)} : « {v['from']} » → « {v['to']} »" for k,v in changes.items()
        )
        create_history_and_notifications(
            actor=actor, action=action, entity_type="prospect",
            entity_id=instance.pk, entity_name=name, description=desc,
            old_value={k:v["from"] for k,v in changes.items()},
            new_value={k:v["to"]   for k,v in changes.items()},
            affected_users=affected, company=company,
            actor_type=actor_type, actor_name=actor_name, performed_by=performed_by,
        )


@receiver(post_delete, sender="sales.Prospect")
def prospect_post_delete(sender, instance, **kwargs):
    actor   = resolve_actor(instance)
    actor_type, actor_name, performed_by = resolve_actor_metadata(instance, actor)
    company = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "prospect")
    create_history_and_notifications(
        actor=actor, action="delete", entity_type="prospect",
        entity_id=instance.pk,
        entity_name=f"{instance.first_name} {instance.last_name}",
        affected_users=affected, company=company,
        description=f"Prospect « {instance.first_name} {instance.last_name} » supprimé",
        actor_type=actor_type, actor_name=actor_name, performed_by=performed_by,
    )


# ─── CONTACT ──────────────────────────────────────────────────────

@receiver(pre_save, sender="sales.Contact")
def contact_pre_save(sender, instance, **kwargs):
    instance._pre_save_state = sender.objects.get(pk=instance.pk) if instance.pk else None


@receiver(post_save, sender="sales.Contact")
def contact_post_save(sender, instance, created, **kwargs):
    actor    = resolve_actor(instance)
    company  = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "contact")
    name     = f"{instance.first_name} {instance.last_name}"

    if created:
        create_history_and_notifications(
            actor=actor, action="create", entity_type="contact",
            entity_id=instance.pk, entity_name=name,
            description=f"Contact « {name} » créé",
            new_value={"email": getattr(instance,"email",""), "phone": getattr(instance,"phone","")},
            affected_users=affected, company=company,
        )
    else:
        old = getattr(instance, "_pre_save_state", None)
        if not old:
            return
        fields = ["first_name","last_name","email","phone","assigned_to_id"]
        changes = {
            f: {"from": str(getattr(old,f,None)), "to": str(getattr(instance,f,None))}
            for f in fields if getattr(old,f,None) != getattr(instance,f,None)
        }
        if not changes:
            return
        readable = {"first_name":"Prénom","last_name":"Nom","email":"Email",
                    "phone":"Téléphone","assigned_to_id":"Assigné à"}
        desc = "Contact modifié — " + ", ".join(
            f"{readable.get(k,k)} : « {v['from']} » → « {v['to']} »" for k,v in changes.items()
        )
        create_history_and_notifications(
            actor=actor, action="update", entity_type="contact",
            entity_id=instance.pk, entity_name=name, description=desc,
            old_value={k:v["from"] for k,v in changes.items()},
            new_value={k:v["to"]   for k,v in changes.items()},
            affected_users=affected, company=company,
        )


@receiver(post_delete, sender="sales.Contact")
def contact_post_delete(sender, instance, **kwargs):
    actor   = resolve_actor(instance)
    company = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "contact")
    name = f"{instance.first_name} {instance.last_name}"
    create_history_and_notifications(
        actor=actor, action="delete", entity_type="contact",
        entity_id=instance.pk, entity_name=name,
        description=f"Contact « {name} » supprimé",
        affected_users=affected, company=company,
    )


# ─── OPPORTUNITY ──────────────────────────────────────────────────

@receiver(pre_save, sender="sales.Opportunity")
def opportunity_pre_save(sender, instance, **kwargs):
    instance._pre_save_state = sender.objects.get(pk=instance.pk) if instance.pk else None


@receiver(post_save, sender="sales.Opportunity")
def opportunity_post_save(sender, instance, created, **kwargs):
    actor    = resolve_actor(instance)
    company  = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "opportunity")
    name     = instance.name

    if created:
        create_history_and_notifications(
            actor=actor, action="create", entity_type="opportunity",
            entity_id=instance.pk, entity_name=name,
            description=f"Opportunité « {name} » créée (étape : {instance.stage})",
            new_value={"stage": instance.stage, "amount": str(getattr(instance,"amount",0))},
            affected_users=affected, company=company,
        )
    else:
        old = getattr(instance, "_pre_save_state", None)
        if not old:
            return
        fields = ["name","stage","amount","assigned_to_id","expected_close_date"]
        changes = {
            f: {"from": str(getattr(old,f,None)), "to": str(getattr(instance,f,None))}
            for f in fields if getattr(old,f,None) != getattr(instance,f,None)
        }
        if not changes:
            return
        action = "stage" if "stage" in changes else ("assign" if "assigned_to_id" in changes else "update")
        readable = {"name":"Nom","stage":"Étape","amount":"Montant",
                    "assigned_to_id":"Assigné à","expected_close_date":"Date clôture"}
        desc = f"Opportunité « {name} » modifiée — " + ", ".join(
            f"{readable.get(k,k)} : « {v['from']} » → « {v['to']} »" for k,v in changes.items()
        )
        create_history_and_notifications(
            actor=actor, action=action, entity_type="opportunity",
            entity_id=instance.pk, entity_name=name, description=desc,
            old_value={k:v["from"] for k,v in changes.items()},
            new_value={k:v["to"]   for k,v in changes.items()},
            affected_users=affected, company=company,
        )


@receiver(post_delete, sender="sales.Opportunity")
def opportunity_post_delete(sender, instance, **kwargs):
    actor   = resolve_actor(instance)
    company = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "opportunity")
    create_history_and_notifications(
        actor=actor, action="delete", entity_type="opportunity",
        entity_id=instance.pk, entity_name=instance.name,
        description=f"Opportunité « {instance.name} » supprimée",
        affected_users=affected, company=company,
    )


# ─── TASK ─────────────────────────────────────────────────────────

@receiver(pre_save, sender="sales.Task")
def task_pre_save(sender, instance, **kwargs):
    instance._pre_save_state = sender.objects.get(pk=instance.pk) if instance.pk else None


@receiver(post_save, sender="sales.Task")
def task_post_save(sender, instance, created, **kwargs):
    actor    = resolve_actor(instance)
    actor_type, actor_name, performed_by = resolve_actor_metadata(instance, actor)
    company  = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "task")

    if created:
        create_history_and_notifications(
            actor=actor, action="create", entity_type="task",
            entity_id=instance.pk, entity_name=instance.title,
            description=(
                f"Tâche « {instance.title} » créée"
                + (f", assignée à {instance.assigned_to.username}" if instance.assigned_to else "")
            ),
            new_value={"status": instance.status, "priority": instance.priority},
            affected_users=affected, company=company,
            actor_type=actor_type, actor_name=actor_name, performed_by=performed_by,
        )
    else:
        old = getattr(instance, "_pre_save_state", None)
        if not old:
            return
        fields = ["title","status","due_date","assigned_to_id","priority"]
        changes = {
            f: {"from": str(getattr(old,f,None)), "to": str(getattr(instance,f,None))}
            for f in fields if getattr(old,f,None) != getattr(instance,f,None)
        }
        if not changes:
            return
        action = "status" if "status" in changes else ("assign" if "assigned_to_id" in changes else "update")
        readable = {"title":"Titre","status":"Statut","due_date":"Échéance",
                    "assigned_to_id":"Assigné à","priority":"Priorité"}
        desc = f"Tâche « {instance.title} » modifiée — " + ", ".join(
            f"{readable.get(k,k)} : « {v['from']} » → « {v['to']} »" for k,v in changes.items()
        )
        create_history_and_notifications(
            actor=actor, action=action, entity_type="task",
            entity_id=instance.pk, entity_name=instance.title, description=desc,
            old_value={k:v["from"] for k,v in changes.items()},
            new_value={k:v["to"]   for k,v in changes.items()},
            affected_users=affected, company=company,
            actor_type=actor_type, actor_name=actor_name, performed_by=performed_by,
        )


@receiver(post_delete, sender="sales.Task")
def task_post_delete(sender, instance, **kwargs):
    actor   = resolve_actor(instance)
    actor_type, actor_name, performed_by = resolve_actor_metadata(instance, actor)
    company = get_company_from_instance(instance)
    affected = get_affected_users(instance, actor, "task")
    create_history_and_notifications(
        actor=actor, action="delete", entity_type="task",
        entity_id=instance.pk, entity_name=instance.title,
        affected_users=affected, company=company,
        description=f"Tâche « {instance.title} » supprimée",
        actor_type=actor_type, actor_name=actor_name, performed_by=performed_by,
    )


# ─── SIGNAL ASSIGNATION MANUELLE ──────────────────────────────────

@receiver(entity_assigned)
def on_entity_assigned(sender, entity, entity_type, assigned_to, actor, description, **kwargs):
    company  = get_company_from_instance(entity)
    affected = get_affected_users(entity, actor, entity_type)
    affected.add(assigned_to)
    if actor:
        affected.discard(actor)

    name = (
        getattr(entity, "name", None)
        or f"{getattr(entity,'first_name','')} {getattr(entity,'last_name','')}".strip()
        or getattr(entity, "title", None)
        or f"#{entity.pk}"
    )
    create_history_and_notifications(
        actor=actor, action="assign", entity_type=entity_type,
        entity_id=entity.pk, entity_name=name,
        description=description or f"« {name} » assigné à {assigned_to.username}",
        new_value={"assigned_to": assigned_to.username},
        affected_users=affected, company=company,
    )
