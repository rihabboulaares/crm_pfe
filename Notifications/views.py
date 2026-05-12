# notifications/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
from .models import HistoryLog, Notification
from .serializers import HistoryLogSerializer, NotificationSerializer


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