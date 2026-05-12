# ============================================================
# sales/kpi_engine.py
# ============================================================
from django.utils import timezone
from django.db.models import Q, Sum, F
from datetime import datetime, timezone as dt_timezone

from .models import (
    Task, TaskActivity, Opportunity,
    PerformanceScore, PerformanceGoal, CommercialBadge,
)
from users.models import User


WEIGHTS = {
    "tasks_completion": 35,
    "deadline_respect": 30,
    "activities":       20,
    "opportunities":    15,
}

PENALTY_LATE_TASK = -10
PENALTY_NOT_DONE  = -20


def _get_period_bounds(year: int, month: int):
    start = datetime(year, month, 1, tzinfo=dt_timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=dt_timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=dt_timezone.utc)
    return start, end


def _pct(numerator, denominator, default=0.0):
    """Retourne 0 par defaut si pas de donnees (evite les 100% trompeurs)."""
    if denominator == 0:
        return default
    return min(100.0, round(numerator / denominator * 100, 1))


def _final_score(s_tasks, s_deadlines, s_activities, s_opps, penalty):
    raw = (
        s_tasks        * WEIGHTS["tasks_completion"] / 100
        + s_deadlines  * WEIGHTS["deadline_respect"] / 100
        + s_activities * WEIGHTS["activities"]        / 100
        + s_opps       * WEIGHTS["opportunities"]     / 100
    )
    return max(0.0, min(100.0, round(raw + penalty / 5, 1)))


def compute_kpi(user: User, year: int = None, month: int = None) -> dict:
    now   = timezone.now()
    year  = year  or now.year
    month = month or now.month
    start_dt, end_dt = _get_period_bounds(year, month)
    company = user.company

    # ── TACHES ──────────────────────────────────────────────
    tasks_qs = Task.objects.filter(
        company=company,
        assigned_to=user,
    ).exclude(status="cancelled")

    tasks_total = tasks_qs.count()

    # Taches terminees ce mois.
    # On inclut celles sans closed_at (fermees via PATCH direct sans /close/)
    done_qs = tasks_qs.filter(status="done").filter(
        Q(closed_at__gte=start_dt, closed_at__lt=end_dt)
        | Q(closed_at__isnull=True)
    )
    tasks_done = done_qs.count()

    # Terminees dans les temps :
    # - closed_at renseignee et <= due_date
    # - OU closed_at NULL et due_date pas encore depassee
    tasks_on_time = done_qs.filter(
        due_date__isnull=False,
    ).filter(
        Q(closed_at__isnull=False, closed_at__lte=F("due_date"))
        | Q(closed_at__isnull=True, due_date__gte=now)
    ).count()

    tasks_late     = max(0, tasks_done - tasks_on_time)
    tasks_not_done = tasks_qs.filter(
        status__in=["todo", "in_progress"],
        due_date__isnull=False,
        due_date__lt=now,
    ).count()

    # ── ACTIVITES ────────────────────────────────────────────
    act_qs = TaskActivity.objects.filter(
        task__company=company,
        performed_by=user,
        created_at__gte=start_dt,
        created_at__lt=end_dt,
    )
    calls    = act_qs.filter(activity_type="call").count()
    emails   = act_qs.filter(activity_type="email").count()
    meetings = act_qs.filter(activity_type="meeting").count()

    # Fallback sur compteurs agrégés
    if calls == 0 and emails == 0 and meetings == 0:
        agg = Task.objects.filter(
            company=company,
            assigned_to=user,
            updated_at__gte=start_dt,
            updated_at__lt=end_dt,
        ).aggregate(
            c=Sum("calls_count"),
            e=Sum("emails_count"),
            m=Sum("meetings_count"),
        )
        calls    = agg["c"] or 0
        emails   = agg["e"] or 0
        meetings = agg["m"] or 0

    # ── OPPORTUNITES ─────────────────────────────────────────
    opps_qs    = Opportunity.objects.filter(
        company=company,
        assigned_to=user,
        updated_at__gte=start_dt,
        updated_at__lt=end_dt,
    )
    opps_total = opps_qs.count()
    opps_won   = opps_qs.filter(stage="won").count()

    # ── SCORES PARTIELS ──────────────────────────────────────
    ACTIVITY_REF = 50
    s_tasks      = _pct(tasks_done,   tasks_total,  default=0.0)
    s_deadlines  = _pct(tasks_on_time, tasks_done,  default=0.0)
    s_activities = min(100.0, round((calls + emails + meetings) / ACTIVITY_REF * 100, 1))
    s_opps       = _pct(opps_won, opps_total,       default=0.0)
    penalty      = (tasks_late * PENALTY_LATE_TASK) + (tasks_not_done * PENALTY_NOT_DONE)
    score        = _final_score(s_tasks, s_deadlines, s_activities, s_opps, penalty)

    # ── SAUVEGARDER ──────────────────────────────────────────
    perf, _ = PerformanceScore.objects.update_or_create(
        commercial=user,
        year=year,
        month=month,
        defaults=dict(
            company=company,
            tasks_total=tasks_total,
            tasks_done=tasks_done,
            tasks_on_time=tasks_on_time,
            tasks_late=tasks_late,
            calls_count=calls,
            emails_count=emails,
            meetings_count=meetings,
            opportunities_won=opps_won,
            opportunities_total=opps_total,
            penalty_points=penalty,
            score=score,
        ),
    )

    _sync_goals(user, company, year, month,
                calls=calls, emails=emails, meetings=meetings,
                opps_won=opps_won, tasks_done=tasks_done)

    badges = _award_badges(user, company, year, month, perf)

    return {
        "user_id":               user.id,
        "username":              user.username,
        "year":                  year,
        "month":                 month,
        "tasks_total":           tasks_total,
        "tasks_done":            tasks_done,
        "tasks_on_time":         tasks_on_time,
        "tasks_late":            tasks_late,
        "tasks_not_done":        tasks_not_done,
        "calls":                 calls,
        "emails":                emails,
        "meetings":              meetings,
        "opportunities_won":     opps_won,
        "opportunities_total":   opps_total,
        "score_tasks":           s_tasks,
        "score_deadlines":       s_deadlines,
        "score_activities":      s_activities,
        "score_opportunities":   s_opps,
        "penalty_points":        penalty,
        "score":                 score,
        "badges_awarded":        badges,
    }


def _sync_goals(user, company, year, month,
                calls, emails, meetings, opps_won, tasks_done):
    value_map = {
        "calls":             calls,
        "emails":            emails,
        "meetings":          meetings,
        "opportunities_won": opps_won,
        "tasks_done":        tasks_done,
    }
    for goal in PerformanceGoal.objects.filter(
        commercial=user, company=company,
        year=year, month=month, status="active",
    ):
        new_val = value_map.get(goal.goal_type, goal.current_value)
        goal.current_value = new_val
        if new_val >= goal.target_value:
            goal.status = "achieved"
        goal.save(update_fields=["current_value", "status", "updated_at"])


def _award_badges(user, company, year, month, perf) -> list:
    awarded = []

    def give(badge_type):
        _, created = CommercialBadge.objects.get_or_create(
            commercial=user, company=company,
            badge_type=badge_type, year=year, month=month,
        )
        if created:
            awarded.append(badge_type)

    if perf.tasks_done > 0 and perf.tasks_on_time == perf.tasks_done:
        give("on_time_100")
    if perf.calls_count >= 100:
        give("calls_100")
    if perf.emails_count >= 60:
        give("email_champion")

    best = (
        PerformanceScore.objects
        .filter(company=company, year=year, month=month)
        .order_by("-score").first()
    )
    if best and best.commercial_id == user.id and perf.score >= 80:
        give("top_seller")

    recent = list(
        PerformanceScore.objects
        .filter(commercial=user, company=company)
        .order_by("-year", "-month")
        .values_list("score", flat=True)[:3]
    )
    if len(recent) == 3 and all(s >= 80 for s in recent):
        give("streak_3")

    top_closer = (
        PerformanceScore.objects
        .filter(company=company, year=year, month=month)
        .order_by("-opportunities_won").first()
    )
    if (top_closer and top_closer.commercial_id == user.id
            and perf.opportunities_won > 0):
        give("best_closer")

    return awarded


def compute_team_kpi(company, year: int = None, month: int = None,
                     user_ids=None) -> list:
    now   = timezone.now()
    year  = year  or now.year
    month = month or now.month

    qs = User.objects.filter(
        company=company, role="COMMERCIAL", is_active=True,
    )
    if user_ids is not None:
        qs = qs.filter(id__in=user_ids)

    results = []
    for user in qs:
        try:
            kpi = compute_kpi(user, year, month)
            results.append(kpi)
        except Exception as e:
            print(f"[KPI ERROR] {user.username}: {e}")
            continue

    return sorted(results, key=lambda x: x["score"], reverse=True)


def detect_inactive_users(company, days_threshold: int = 3) -> list:
    cutoff = timezone.now() - timezone.timedelta(days=days_threshold)

    active_ids = set(
        TaskActivity.objects
        .filter(task__company=company, created_at__gte=cutoff)
        .values_list("performed_by_id", flat=True)
    ) | set(
        Task.objects
        .filter(company=company, updated_at__gte=cutoff)
        .values_list("assigned_to_id", flat=True)
    )

    inactive = User.objects.filter(
        company=company, role="COMMERCIAL", is_active=True,
    ).exclude(id__in=active_ids)

    return [
        {
            "user_id":    u.id,
            "username":   u.username,
            "email":      u.email,
            "last_login": u.last_login,
        }
        for u in inactive
    ]


def get_performance_history(user: User, months: int = 6) -> list:
    scores = (
        PerformanceScore.objects
        .filter(commercial=user)
        .order_by("-year", "-month")[:months]
    )
    return [
        {
            "label":             f"{s.month:02d}/{s.year}",
            "year":              s.year,
            "month":             s.month,
            "score":             s.score,
            "tasks_done":        s.tasks_done,
            "tasks_total":       s.tasks_total,
            "tasks_on_time":     s.tasks_on_time,
            "calls":             s.calls_count,
            "emails":            s.emails_count,
            "meetings":          s.meetings_count,
            "opportunities_won": s.opportunities_won,
            "penalty_points":    s.penalty_points,
        }
        for s in reversed(list(scores))
    ]