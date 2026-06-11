# sales/trigger_engine.py
# ==============================
# MOTEUR DE TRIGGERS INTELLIGENT
# Déclenché automatiquement après chaque TaskActivity de type "call"
# ==============================

from django.utils import timezone
from django.db.models import Q


# ══════════════════════════════════════════════════════
# CONFIGURATION DES TRIGGERS
# ══════════════════════════════════════════════════════

# Délais de relance selon le nombre de tentatives (en jours)
NO_ANSWER_RETRY_DELAYS = {
    1: 2,   # 1ère tentative → relance dans 2 jours
    2: 3,   # 2ème tentative → relance dans 3 jours
    3: 5,   # 3ème tentative → relance dans 5 jours
    4: None # 4ème tentative → STOP (prospect marqué injoignable)
}

MAX_CALL_ATTEMPTS = 4          # Nombre max d'appels avant escalade
MANAGER_ESCALATION_THRESHOLD = 3  # Nb appels sans réponse → notif manager
NOT_INTERESTED_EMAIL_DELAY_DAYS = 7
INTERESTED_MEETING_DELAY_DAYS = 1


def _follow_up_assignee(task, prospect, user):
    if prospect and prospect.assigned_to:
        return prospect.assigned_to
    return task.assigned_to or user


# ══════════════════════════════════════════════════════
# POINT D'ENTRÉE PRINCIPAL
# ══════════════════════════════════════════════════════

def process_call_trigger(activity, task):
    """
    Point d'entrée principal appelé après la création d'une TaskActivity de type 'call'.

    Args:
        activity: instance TaskActivity (type=call, call_result renseigné)
        task:     instance Task parente

    Returns:
        dict avec les actions effectuées (pour le frontend)
    """
    from .models import Task, TaskActivity, Prospect

    result = {
        "triggered": False,
        "action":    None,
        "follow_up_task_id": None,
        "message":   None,
        "escalated": False,
    }

    # Seuls les appels avec un résultat déclenchent quelque chose
    if activity.activity_type != "call" or not activity.call_result:
        return result

    call_result = activity.call_result
    user        = activity.performed_by
    company     = task.company
    prospect    = activity.prospect or task.prospect

    # ── Router principal ─────────────────────────────
    if call_result == "no_answer":
        result = _handle_no_answer(task, activity, user, company, prospect)

    elif call_result == "not_interested":
        result = _handle_not_interested(task, activity, user, company, prospect)

    elif call_result == "interested":
        result = _handle_interested(task, activity, user, company, prospect)

    elif call_result in ("callback", "call_later"):
        result = _handle_callback(task, activity, user, company, prospect)

    return result


# ══════════════════════════════════════════════════════
# CAS 1 — PAS DE RÉPONSE
# ══════════════════════════════════════════════════════

def _handle_no_answer(task, activity, user, company, prospect):
    """
    - Compte les tentatives d'appel sans réponse sur ce prospect/task
    - Crée une tâche de relance avec délai progressif
    - Marque le prospect injoignable au 4ème échec
    - Escalade au manager au 3ème échec
    """
    from .models import Task, TaskActivity

    result = {
        "triggered": True,
        "action":    "no_answer",
        "follow_up_task_id": None,
        "message":   None,
        "escalated": False,
        "attempt_number": 1,
    }

    # ── Compter les tentatives sans réponse ──────────
    base_qs = TaskActivity.objects.filter(
        activity_type="call",
        call_result="no_answer",
    )
    if prospect:
        attempt_count = base_qs.filter(prospect=prospect).count()
    else:
        attempt_count = base_qs.filter(task=task).count()

    result["attempt_number"] = attempt_count

    # ── 4ème tentative → STOP ────────────────────────
    if attempt_count >= MAX_CALL_ATTEMPTS:
        _mark_prospect_unreachable(prospect, user)
        result["action"]  = "prospect_unreachable"
        result["message"] = (
            f"Prospect marqué injoignable après {attempt_count} tentatives. "
            "Aucune nouvelle relance créée."
        )
        _escalate_to_manager(task, prospect, attempt_count, user, company)
        result["escalated"] = True
        _log_trigger_activity(task, activity, user, result["message"])
        return result

    # ── Escalade au manager dès 3 échecs ────────────
    if attempt_count >= MANAGER_ESCALATION_THRESHOLD:
        _escalate_to_manager(task, prospect, attempt_count, user, company)
        result["escalated"] = True

    # ── Calculer le délai de relance ─────────────────
    delay_days = NO_ANSWER_RETRY_DELAYS.get(attempt_count, 2)
    due_date   = timezone.now() + timezone.timedelta(days=delay_days)

    # ✅ Récupérer le commercial assigné au prospect
    assigned_to = prospect.assigned_to if prospect else task.assigned_to
    if not assigned_to:
        assigned_to = user

    # ── Créer la tâche de relance ────────────────────
    retry_title = f"Relance appel — {prospect.first_name} {prospect.last_name}" \
                  if prospect else f"Relance appel — {task.title}"

    follow_up = Task.objects.create(
        title=retry_title,
        description=(
            f"Relance automatique (tentative #{attempt_count + 1}).\n"
            f"L'appel précédent du {activity.created_at.strftime('%d/%m/%Y')} "
            f"n'a pas abouti."
        ),
        task_type="classic",
        status="todo",
        priority="medium",
        due_date=due_date,
        parent_task=task,
        prospect=prospect,  # ✅ Lier au prospect
        contact=activity.contact or task.contact,
        opportunity=task.opportunity,
        assigned_to=assigned_to,  # ✅ Assigner au bon commercial
        created_by=user,
        company=company,
    )

    result["follow_up_task_id"] = follow_up.id
    result["message"] = (
        f"Relance d'appel planifiée dans {delay_days} jours "
        f"(tentative #{attempt_count + 1}/{MAX_CALL_ATTEMPTS})."
    )

    _log_trigger_activity(task, activity, user, result["message"])
    return result


# ══════════════════════════════════════════════════════
# CAS 2 — PAS INTÉRESSÉ
# ══════════════════════════════════════════════════════

def _handle_not_interested(task, activity, user, company, prospect):
    """
    - Met le prospect en statut 'cold'
    - Crée une tâche email de relance dans 7 jours
    """
    from .models import Task

    result = {
        "triggered": True,
        "action":    "not_interested",
        "follow_up_task_id": None,
        "message":   None,
        "escalated": False,
    }

    # ── Changer l'évaluation du prospect ────────────
    if prospect and hasattr(prospect, "evaluation"):
        prospect.evaluation = "cold"
        prospect.save(update_fields=["evaluation", "updated_at"])

    # ── Créer tâche email de relance ─────────────────
    due_date = timezone.now() + timezone.timedelta(days=NOT_INTERESTED_EMAIL_DELAY_DAYS)

    email_title = f"Email de relance — {prospect.first_name} {prospect.last_name}" \
                  if prospect else f"Email de relance — {task.title}"

    follow_up = Task.objects.create(
        title=email_title,
        description=(
            f"Le prospect a indiqué ne pas être intéressé lors de l'appel "
            f"du {activity.created_at.strftime('%d/%m/%Y')}.\n"
            "Envoyer un email de relance personnalisé dans 7 jours."
        ),
        task_type="classic",
        status="todo",
        priority="low",
        due_date=due_date,
        parent_task=task,
        prospect=prospect,
        contact=activity.contact or task.contact,
        opportunity=task.opportunity,
        assigned_to=_follow_up_assignee(task, prospect, user),
        created_by=user,
        company=company,
    )

    result["follow_up_task_id"] = follow_up.id
    result["message"] = (
        f"Prospect marqué 'cold'. "
        f"Email de relance planifié dans {NOT_INTERESTED_EMAIL_DELAY_DAYS} jours."
    )

    _log_trigger_activity(task, activity, user, result["message"])
    return result


# ══════════════════════════════════════════════════════
# CAS 3 — INTÉRESSÉ
# ══════════════════════════════════════════════════════

def _handle_interested(task, activity, user, company, prospect):
    """
    - Met le prospect en statut 'warm'
    - Crée une tâche meeting dans 1 jour
    - Peut mettre à jour le statut du prospect → 'qualified'
    """
    from .models import Task

    result = {
        "triggered": True,
        "action":    "interested",
        "follow_up_task_id": None,
        "message":   None,
        "escalated": False,
    }

    # ── Mettre à jour l'évaluation du prospect ───────
    if prospect:
        if hasattr(prospect, "evaluation"):
            prospect.evaluation = "warm"
        if hasattr(prospect, "status"):
            prospect.status = "qualified"
        prospect.save(update_fields=["evaluation", "status", "updated_at"])

    # ── Créer tâche meeting ───────────────────────────
    due_date = timezone.now() + timezone.timedelta(days=INTERESTED_MEETING_DELAY_DAYS)

    meeting_title = f"Meeting — {prospect.first_name} {prospect.last_name}" \
                    if prospect else f"Meeting — {task.title}"

    follow_up = Task.objects.create(
        title=meeting_title,
        description=(
            f"Le prospect a manifesté son intérêt lors de l'appel "
            f"du {activity.created_at.strftime('%d/%m/%Y')}.\n"
            "Planifier un meeting de présentation rapidement."
        ),
        task_type="classic",
        status="todo",
        priority="high",
        due_date=due_date,
        parent_task=task,
        prospect=prospect,
        contact=activity.contact or task.contact,
        opportunity=task.opportunity,
        assigned_to=_follow_up_assignee(task, prospect, user),
        created_by=user,
        company=company,
    )

    result["follow_up_task_id"] = follow_up.id
    result["message"] = (
        "Prospect qualifié! Meeting planifié dans 1 jour. "
        "Statut prospect → qualified, évaluation → warm."
    )

    _log_trigger_activity(task, activity, user, result["message"])
    return result


# ══════════════════════════════════════════════════════
# CAS 4 — RAPPELER PLUS TARD
# ══════════════════════════════════════════════════════

def _handle_callback(task, activity, user, company, prospect):
    """
    - Crée une tâche de rappel à la date choisie (meeting_date de l'activité)
    - Fallback : +3 jours si pas de date spécifiée
    """
    from .models import Task

    result = {
        "triggered": True,
        "action":    "callback",
        "follow_up_task_id": None,
        "message":   None,
        "escalated": False,
    }

    # Date choisie par le commercial (stockée dans meeting_date ou fallback)
    callback_date = getattr(activity, "meeting_date", None)
    if not callback_date:
        callback_date = timezone.now() + timezone.timedelta(days=3)

    callback_title = f"Rappel — {prospect.first_name} {prospect.last_name}" \
                     if prospect else f"Rappel — {task.title}"

    follow_up = Task.objects.create(
        title=callback_title,
        description=(
            f"Rappel demandé lors de l'appel du {activity.created_at.strftime('%d/%m/%Y')}.\n"
            f"Notes: {activity.notes or '—'}"
        ),
        task_type="classic",
        status="todo",
        priority="medium",
        due_date=callback_date,
        parent_task=task,
        prospect=prospect,
        contact=activity.contact or task.contact,
        opportunity=task.opportunity,
        assigned_to=_follow_up_assignee(task, prospect, user),
        created_by=user,
        company=company,
    )

    result["follow_up_task_id"] = follow_up.id
    result["message"] = (
        f"Rappel planifié pour le {callback_date.strftime('%d/%m/%Y à %H:%M')}."
    )

    _log_trigger_activity(task, activity, user, result["message"])
    return result


# ══════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════

def _mark_prospect_unreachable(prospect, user):
    """Marque le prospect comme injoignable et crée une note explicative."""
    if not prospect:
        return
    if hasattr(prospect, "status"):
        prospect.status = "lost"
    if hasattr(prospect, "evaluation"):
        prospect.evaluation = "cold"
    prospect.save(update_fields=["status", "evaluation", "updated_at"])
    
    # ✅ Ajouter une note dans les activités du prospect
    from .models import TaskActivity
    
    TaskActivity.objects.create(
        task=None,  # Pas de tâche spécifique
        activity_type="note",
        performed_by=user,
        prospect=prospect,
        notes=f"🤖 Prospect marqué injoignable après {MAX_CALL_ATTEMPTS} tentatives d'appel sans réponse.",
    )


def _escalate_to_manager(task, prospect, attempt_count, user, company):
    """
    Crée une activité de type note sur la tâche pour alerter le manager.
    Peut être étendue pour envoyer un vrai email/notification.
    """
    from .models import TaskActivity, User

    managers = User.objects.filter(
        company=company,
        role__in=("MANAGER", "ADMIN"),
        is_active=True,
    )

    prospect_name = (
        f"{prospect.first_name} {prospect.last_name}" if prospect else "Prospect inconnu"
    )

    note_text = (
        f"⚠️ ESCALADE AUTOMATIQUE — {attempt_count} appels sans réponse.\n"
        f"Prospect : {prospect_name}\n"
        f"Commercial : {user.username}\n"
        f"Action recommandée : Contacter manuellement ou marquer comme injoignable."
    )

    # Activité visible par tous (manager inclus)
    TaskActivity.objects.create(
        task=task,
        activity_type="note",
        performed_by=None,  # système
        prospect=prospect,
        notes=note_text,
    )


def _log_trigger_activity(task, source_activity, user, message):
    """Crée une activité 'note' pour tracer le trigger déclenché."""
    from .models import TaskActivity

    TaskActivity.objects.create(
        task=task,
        activity_type="note",
        performed_by=user,
        prospect=source_activity.prospect,
        contact=source_activity.contact,
        notes=f"🤖 Trigger automatique : {message}",
    )


# ══════════════════════════════════════════════════════
# UTILITAIRE — Compte les appels sans réponse
# ══════════════════════════════════════════════════════

def get_no_answer_count(prospect=None, task=None, company=None):
    """
    Retourne le nombre d'appels sans réponse pour un prospect ou une tâche.
    Utilisé par le frontend pour afficher la progression des tentatives.
    """
    from .models import TaskActivity

    qs = TaskActivity.objects.filter(
        activity_type="call",
        call_result="no_answer",
    )
    if prospect:
        qs = qs.filter(prospect=prospect)
    elif task:
        qs = qs.filter(task=task)
    return qs.count()
