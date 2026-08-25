# notifications/views.py

import csv
from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q, Count
from .models import CRMEvent, HistoryLog, Notification
from .serializers import CRMEventSerializer, HistoryLogSerializer, NotificationSerializer
from .utils import get_user_display_name


def _team_member_ids(user):
    ids = set()
    for team in user.teams.all():
        ids.update(team.members.values_list("id", flat=True))
    return ids


def get_visible_crm_events(user):
    role = getattr(user, "role", None)
    company = getattr(user, "company", None)

    qs = CRMEvent.objects.select_related(
        "user", "prospect", "prospect__assigned_to", "prospect__prospect_company", "company", "agent_run"
    )

    if role == "ADMIN":
        return qs.filter(company=company)

    if role == "MANAGER":
        member_ids = _team_member_ids(user)
        return qs.filter(
            Q(company=company)
            & (
                Q(user_id__in=member_ids)
                | Q(prospect__assigned_to_id__in=member_ids)
                | Q(user=user)
            )
        ).distinct()

    return qs.filter(Q(user=user) | Q(prospect__assigned_to=user)).distinct()


def filter_crm_events(qs, params):
    category = params.get("category")
    event_type = params.get("event_type")
    severity = params.get("severity")
    source_type = params.get("source_type")
    user_id = params.get("user")
    prospect_id = params.get("prospect")
    company_id = params.get("company")
    channel = params.get("channel")
    status_value = params.get("status")
    period = params.get("period")
    date_from = params.get("date_from")
    date_to = params.get("date_to")
    search = params.get("search")

    if category:
        qs = qs.filter(category__in=[v for v in category.split(",") if v])
    if event_type:
        qs = qs.filter(event_type__in=[v for v in event_type.split(",") if v])
    if severity:
        qs = qs.filter(severity__in=[v for v in severity.split(",") if v])
    if source_type:
        qs = qs.filter(source_type__in=[v for v in source_type.split(",") if v])
    if user_id:
        qs = qs.filter(user_id=user_id)
    if prospect_id:
        qs = qs.filter(prospect_id=prospect_id)
    if company_id:
        qs = qs.filter(company_id=company_id)
    if channel:
        qs = qs.filter(Q(channel__iexact=channel) | Q(metadata__channel__iexact=channel))
    if status_value:
        qs = qs.filter(status__iexact=status_value)

    now = timezone.now()
    if period == "today":
        qs = qs.filter(created_at__date=now.date())
    elif period == "7d":
        qs = qs.filter(created_at__gte=now - timedelta(days=7))
    elif period == "30d":
        qs = qs.filter(created_at__gte=now - timedelta(days=30))
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    if search:
        qs = qs.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(source_name__icontains=search)
            | Q(user__username__icontains=search)
            | Q(user__email__icontains=search)
            | Q(prospect__first_name__icontains=search)
            | Q(prospect__last_name__icontains=search)
            | Q(prospect__email__icontains=search)
            | Q(prospect__prospect_company__name__icontains=search)
            | Q(metadata__icontains=search)
        )
    return qs


class CRMEventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = filter_crm_events(get_visible_crm_events(request.user), request.query_params)
        page = max(int(request.query_params.get("page", 1) or 1), 1)
        per_page = min(max(int(request.query_params.get("page_size", 25) or 25), 1), 100)
        total = qs.count()
        qs_page = qs[(page - 1) * per_page : page * per_page]
        return Response({
            "results": CRMEventSerializer(qs_page, many=True).data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        })


class CRMEventDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            event = get_visible_crm_events(request.user).get(pk=pk)
        except CRMEvent.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CRMEventSerializer(event).data)


class CRMEventStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = filter_crm_events(get_visible_crm_events(request.user), request.query_params)
        today = timezone.now().date()
        week_start = timezone.now() - timedelta(days=7)
        return Response({
            "total": qs.count(),
            "today": qs.filter(created_at__date=today).count(),
            "week": qs.filter(created_at__gte=week_start).count(),
            "commercial": qs.filter(category="commercial").count(),
            "agents": qs.filter(category="agent").count(),
            "engagement": qs.filter(category="engagement").count(),
            "scoring": qs.filter(category="scoring").count(),
            "documents": qs.filter(category="document").count(),
            "opportunities": qs.filter(category="opportunity").count(),
            "attention": qs.filter(severity__in=["warning", "critical"]).count(),
            "by_category": list(qs.values("category").annotate(count=Count("id")).order_by("-count")),
            "by_severity": list(qs.values("severity").annotate(count=Count("id")).order_by("-count")),
        })


class CRMEventSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = get_visible_crm_events(request.user).filter(created_at__date=timezone.now().date())
        items = []
        mapping = [
            ("prospect_created", "prospects créés"),
            ("prospect_enriched", "prospects enrichis"),
            ("prospect_qualified", "prospects qualifiés"),
            ("message_sent", "messages envoyés"),
            ("reply_received", "réponses reçues"),
            ("score_changed", "scores recalculés"),
            ("document_uploaded", "documents ajoutés"),
            ("agent_completed", "agents terminés"),
        ]
        counts = {
            row["event_type"]: row["count"]
            for row in qs.values("event_type").annotate(count=Count("id"))
        }
        for event_type, label in mapping:
            count = counts.get(event_type, 0)
            if count:
                items.append({"label": label, "count": count})
        return Response({"date": timezone.now().date(), "items": items})


class CRMEventAttentionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = get_visible_crm_events(request.user)
        alerts = []
        failed_agents = qs.filter(event_type="agent_failed").count()
        failed_messages = qs.filter(category="engagement", severity__in=["warning", "critical"]).count()
        replies = qs.filter(event_type="reply_received").count()
        hot_scores = qs.filter(event_type="score_changed", metadata__new_score__gte=80).count()
        if failed_agents:
            alerts.append({"label": "Agents en erreur", "count": failed_agents, "filter": {"event_type": "agent_failed"}})
        if failed_messages:
            alerts.append({"label": "Engagement à surveiller", "count": failed_messages, "filter": {"category": "engagement", "severity": "warning,critical"}})
        if replies:
            alerts.append({"label": "Réponses reçues", "count": replies, "filter": {"event_type": "reply_received"}})
        if hot_scores:
            alerts.append({"label": "Scores supérieurs à 80", "count": hot_scores, "filter": {"event_type": "score_changed"}})
        return Response({"alerts": alerts})


class CRMEventExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = filter_crm_events(get_visible_crm_events(request.user), request.query_params)[:5000]
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="crm_activity.csv"'
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Date", "Catégorie", "Événement", "Source", "Prospect", "Utilisateur", "Sévérité", "Description"])
        for event in qs:
            prospect = ""
            if event.prospect:
                prospect = f"{event.prospect.first_name or ''} {event.prospect.last_name or ''}".strip() or event.prospect.email
            writer.writerow([
                event.created_at.strftime("%d/%m/%Y %H:%M"),
                event.get_category_display(),
                event.get_event_type_display(),
                event.source_name or event.source_type,
                prospect,
                get_user_display_name(event.user) if event.user else "",
                event.get_severity_display(),
                event.description or event.title,
            ])
        return response


class HistoryLogListView(APIView):
    """
    GET /api/notifications/history/
    Retourne les logs filtrés selon le rôle :
      ADMIN      → tout son entreprise
      MANAGER    → son équipe (membres de ses équipes)
      COMMERCIAL → seulement les logs où il est acteur ou affecté
    Query params :
      entity_type  = prospect | contact | opportunity | task | activity ...
      action       = create | update | delete | assign | status | stage
      search       = texte libre (entity_name, description)
      page         = numéro de page (25 items / page)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user    = request.user
        role    = getattr(user, "role", None)
        company = getattr(user, "company", None)

        # ── Base queryset selon le rôle ──────────────────────────
        if role == "ADMIN":
            qs = HistoryLog.objects.filter(company=company)

        elif role == "MANAGER":
            # Membres de toutes ses équipes
            team_member_ids = set()
            for team in user.teams.all():
                team_member_ids.update(team.members.values_list("id", flat=True))
            qs = HistoryLog.objects.filter(
                Q(company=company) &
                (Q(actor_id__in=team_member_ids) |
                 Q(affected_users__in=team_member_ids) |
                 Q(actor=user))
            ).distinct()

        else:  # COMMERCIAL
            qs = HistoryLog.objects.filter(
                Q(actor=user) | Q(affected_users=user)
            ).distinct()

        # ── Filtres ──────────────────────────────────────────────
        entity_type = request.query_params.get("entity_type")
        action      = request.query_params.get("action")
        search      = request.query_params.get("search")

        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        if action:
            qs = qs.filter(action=action)
        if search:
            qs = qs.filter(
                Q(entity_name__icontains=search) |
                Q(description__icontains=search) |
                Q(actor__username__icontains=search)
            )

        # ── Pagination manuelle (25 / page) ──────────────────────
        page     = int(request.query_params.get("page", 1))
        per_page = 25
        total    = qs.count()
        qs_page  = qs.select_related("actor").prefetch_related("affected_users")[
            (page - 1) * per_page : page * per_page
        ]

        serializer = HistoryLogSerializer(qs_page, many=True)
        return Response({
            "results":  serializer.data,
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "pages":    (total + per_page - 1) // per_page,
        })


class NotificationListView(APIView):
    """
    GET  /api/notifications/           → liste des notifs de l'utilisateur
    GET  /api/notifications/?unread=1  → uniquement non lues
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)
        if request.query_params.get("unread") == "1":
            qs = qs.filter(is_read=False)
        qs = qs.select_related("history_log", "history_log__actor")[:50]
        serializer = NotificationSerializer(qs, many=True)
        return Response(serializer.data)


class NotificationMarkReadView(APIView):
    """
    POST /api/notifications/mark-read/
    Body: { "ids": [1, 2, 3] }  OR  {} pour tout marquer lu
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get("ids")
        qs  = Notification.objects.filter(recipient=request.user)
        if ids:
            qs = qs.filter(id__in=ids)
        updated = qs.update(is_read=True)
        return Response({"marked_read": updated})


class NotificationCountView(APIView):
    """GET /api/notifications/count/ → { "unread": 5 }"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"unread": count})


class NotificationDeleteView(APIView):
    """DELETE /api/notifications/<id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
            notif.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
