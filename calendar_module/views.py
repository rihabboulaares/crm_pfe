"""
calendar_module/views.py
ViewSet enrichi avec filtres avancés, stats et endpoints dédiés.
"""
import datetime

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from sales.models import Task


class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    Endpoints principaux :
      GET  /calendar-events/                → liste filtrée
      GET  /calendar-events/{id}/           → détail
      POST /calendar-events/                → création manuelle
      PUT  /calendar-events/{id}/           → modification
      DEL  /calendar-events/{id}/           → suppression

    Endpoints dédiés :
      GET  /calendar-events/upcoming/       → N prochains jours
      GET  /calendar-events/by_pipeline/    → filtré par pipeline
      GET  /calendar-events/by_type/        → groupé par type
      GET  /calendar-events/stats/          → compteurs par type/priorité
      GET  /calendar-events/overdue_tasks/  → tâches en retard
      GET  /calendar-events/today/          → événements du jour
    """

    queryset = CalendarEvent.objects.select_related(
        "task",
        "task__opportunity",
        "task__prospect",
        "task__contact",
        "opportunity",
        "opportunity__prospect",
        "opportunity__contact",
        "pipeline_stage",
        "pipeline_stage__pipeline",
        "task_activity",
        "task_activity__prospect",
        "task_activity__contact",
        "pipeline_alert",
        "pipeline_alert__opportunity_pipeline",
        "opportunity_pipeline",
        "opportunity_pipeline__pipeline",
        "opportunity_pipeline__current_stage",
        "assigned_to",
        "company",
    )
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        "event_type", "priority", "pipeline_stage",
        "assigned_to", "company", "is_synced",
    ]
    search_fields    = ["title", "description"]
    ordering_fields  = ["start", "priority", "created_at"]
    ordering         = ["start"]

    # ── Filtrage par date + multi-valeurs ─────────────────────────────────

    def get_queryset(self):
        qs    = super().get_queryset().filter(company=self.request.user.company)
        params = self.request.query_params

        # Plage de dates (FullCalendar envoie start/end en ISO 8601)
        start = params.get("start")
        end   = params.get("end")
        if start:
            qs = qs.filter(start__gte=start)
        if end:
            qs = qs.filter(start__lte=end)

        # Filtres multi-valeurs (séparés par virgule)
        event_types = params.get("event_type")
        if event_types:
            qs = qs.filter(event_type__in=event_types.split(","))

        priorities = params.get("priority")
        if priorities:
            qs = qs.filter(priority__in=priorities.split(","))

        # Filtre par commercial assigné
        assigned_to = params.get("assigned_to")
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)

        # Filtre synced uniquement
        synced_only = params.get("synced_only")
        if synced_only == "true":
            qs = qs.filter(is_synced=True)

        return qs

    # ── Endpoint : événements des N prochains jours ───────────────────────

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """
        GET /calendar-events/upcoming/?days=7
        Retourne les événements entre maintenant et maintenant+N jours.
        """
        days = int(request.query_params.get("days", 7))
        now  = timezone.now()
        end  = now + datetime.timedelta(days=days)
        qs   = self.get_queryset().filter(start__gte=now, start__lte=end)
        return Response(self.get_serializer(qs, many=True).data)

    # ── Endpoint : événements du jour ─────────────────────────────────────

    @action(detail=False, methods=["get"])
    def today(self, request):
        """
        GET /calendar-events/today/
        Retourne les événements du jour courant.
        """
        today = timezone.localdate()
        qs = self.get_queryset().filter(
            start__date=today
        )
        return Response(self.get_serializer(qs, many=True).data)

    # ── Endpoint : filtré par pipeline ────────────────────────────────────

    @action(detail=False, methods=["get"])
    def by_pipeline(self, request):
        """
        GET /calendar-events/by_pipeline/?pipeline_id=1
        """
        pipeline_id = request.query_params.get("pipeline_id")
        if not pipeline_id:
            return Response(
                {"error": "pipeline_id requis"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = self.get_queryset().filter(
            pipeline_stage__pipeline_id=pipeline_id
        )
        return Response(self.get_serializer(qs, many=True).data)

    # ── Endpoint : groupé par type ────────────────────────────────────────

    @action(detail=False, methods=["get"])
    def by_type(self, request):
        """
        GET /calendar-events/by_type/
        Retourne un dictionnaire { event_type: [events] }
        """
        qs = self.get_queryset()
        result = {}
        for event_type, _ in CalendarEvent.EVENT_TYPES:
            events = qs.filter(event_type=event_type)
            result[event_type] = self.get_serializer(events, many=True).data
        return Response(result)

    # ── Endpoint : statistiques ───────────────────────────────────────────

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        GET /calendar-events/stats/
        Retourne des compteurs par type et priorité pour les widgets dashboard.
        """
        from django.db.models import Count

        qs = self.get_queryset()

        by_type = {
            item["event_type"]: item["count"]
            for item in qs.values("event_type").annotate(count=Count("id"))
        }
        by_priority = {
            item["priority"]: item["count"]
            for item in qs.values("priority").annotate(count=Count("id"))
        }

        # Événements en retard (start < now, tâches non-done)
        overdue_count = qs.filter(
            event_type="task",
            start__lt=timezone.now(),
            task__status__in=["todo", "in_progress"],
        ).count()

        return Response({
            "total":       qs.count(),
            "by_type":     by_type,
            "by_priority": by_priority,
            "overdue":     overdue_count,
        })

    # ── Endpoint : tâches en retard ───────────────────────────────────────

    @action(detail=False, methods=["get"])
    def overdue_tasks(self, request):
        """
        GET /calendar-events/overdue_tasks/
        Retourne les CalendarEvents de type 'task' dont la date est passée
        et la tâche CRM est encore ouverte.
        """
        qs = self.get_queryset().filter(
            event_type="task",
            start__lt=timezone.now(),
            task__status__in=["todo", "in_progress"],
        )
        return Response(self.get_serializer(qs, many=True).data)

    # ── Endpoint : résumé par commercial ─────────────────────────────────

    @action(detail=False, methods=["get"])
    def by_assignee(self, request):
        """
        GET /calendar-events/by_assignee/?start=YYYY-MM-DD&end=YYYY-MM-DD
        Retourne un résumé par commercial (utile pour vue équipe).
        """
        from django.db.models import Count
        qs = self.get_queryset()
        result = (
            qs.values(
                "assigned_to__id",
                "assigned_to__username",
            )
            .annotate(total=Count("id"))
            .order_by("-total")
        )
        return Response(list(result))


class CalendarTasksView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            Task.objects.filter(company=request.user.company, due_date__isnull=False)
            .select_related("prospect", "assigned_to")
            .order_by("due_date")
        )
        if request.user.role == "COMMERCIAL":
            qs = qs.filter(assigned_to=request.user)

        status_filter = request.query_params.get("status")
        task_type = request.query_params.get("type") or request.query_params.get("task_type")
        priority = request.query_params.get("priority")
        assigned_to = request.query_params.get("assigned_to")
        show_completed = request.query_params.get("show_completed")
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        if status_filter:
            qs = qs.filter(status__in=status_filter.split(","))
        if task_type:
            qs = qs.filter(task_type__in=task_type.split(","))
        if priority:
            qs = qs.filter(priority__in=priority.split(","))
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)
        if show_completed == "false":
            qs = qs.exclude(status__in=["done", "completed", "cancelled"])
        if start:
            qs = qs.filter(due_date__gte=start)
        if end:
            qs = qs.filter(due_date__lte=end)

        now = timezone.now()
        data = []
        for task in qs:
            prospect_name = ""
            if task.prospect:
                prospect_name = f"{task.prospect.first_name} {task.prospect.last_name}".strip()
            data.append(
                {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "start": task.due_date,
                    "end": task.due_date + datetime.timedelta(minutes=30),
                    "type": task.task_type,
                    "status": task.status,
                    "priority": task.priority,
                    "is_overdue": task.due_date < now and task.status not in ("done", "completed", "cancelled"),
                    "prospect_id": task.prospect_id,
                    "prospect_name": prospect_name,
                    "assigned_to": task.assigned_to_id,
                    "assigned_name": task.assigned_to.username if task.assigned_to else "",
                }
            )
        return Response(data)
