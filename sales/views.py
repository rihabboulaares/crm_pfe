# sales/views.py
# ✅ Version complète avec liaison bidirectionnelle Opportunity ↔ Pipeline
#
# CORRECTIONS ET AJOUTS :
#   1. _sync_pipeline_from_crm_stage() : helper CRM → Pipeline
#   2. perform_update OpportunityViewSet : détecte changement de stage et synchro pipeline
#   3. @action sync-pipeline sur OpportunityViewSet : endpoint de synchro manuelle
#   4. @action complete-task sur OpportunityPipelineViewSet : valider tâche depuis le Kanban
#   5. @action tasks sur OpportunityPipelineViewSet : récupérer tâches d'une op_pipeline
#   6. move-stage : mise à jour du stage CRM pour TOUTES les étapes (déjà présent)
#   7. Création tâches templates à chaque changement d'étape (déjà présent)

from datetime import timedelta

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from django.db.models import Q, Avg, Sum, Count
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.shortcuts import get_object_or_404
from subscriptions.utils import check_limits
from agentEngagement.permissions import get_engagement_queryset_for_user, get_task_queryset_for_user, get_team_users_for_manager
from .visibility import filter_by_visible_users, get_visible_users, user_can_access_user

from .models import (
    Account, Prospect, ProspectCompany,
    Opportunity, Contact,
    Task, TaskActivity, TaskComment,
    ProspectActivity, ProspectAgentRun, ProspectDocument,
    ProspectRecommendation, ProspectScoreHistory,
    PerformanceScore, ManagerFeedback,
    PerformanceGoal, CommercialBadge,
    Pipeline, PipelineStage, OpportunityPipeline,
    StageHistory, PipelineAlert, PipelineStageTask,
)
from .serializers import (
    AccountSerializer, ProspectSerializer, ProspectCompanySerializer,
    OpportunitySerializer, ContactSerializer,
    TaskSerializer, TaskActivitySerializer, TaskCommentSerializer,
    ProspectActivitySerializer, ProspectAgentRunSerializer,
    ProspectDocumentSerializer, ProspectRecommendationSerializer,
    ProspectScoreHistorySerializer,
    PerformanceScoreSerializer, ManagerFeedbackSerializer,
    PerformanceGoalSerializer, CommercialBadgeSerializer,
    PipelineSerializer, PipelineListSerializer,
    PipelineStageSerializer,
    OpportunityPipelineSerializer, OpportunityPipelineListSerializer,
    OpportunityPipelineDetailSerializer,
    StageHistorySerializer, PipelineAlertSerializer,
    PipelineStageTaskSerializer,
)
from .kpi_engine import (
    compute_kpi, compute_team_kpi,
    detect_inactive_users, get_performance_history,
)
from .pagination import StandardPagination
from users.models import User
from .trigger_engine import process_call_trigger
from .prospect_tracking_service import ensure_default_recommendation, record_prospect_activity
from Notifications.crm_event_service import event_from_document, record_crm_event

# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def _get_manager_team_ids(manager):
    if manager.role == "ADMIN" or manager.is_staff:
        return None
    return list(
        User.objects.filter(
            teams__in=manager.teams.all(),
            role="COMMERCIAL",
            is_active=True,
            company=manager.company,
        ).values_list("id", flat=True).distinct()
    )


def _is_company_admin(user):
    return bool(getattr(user, "is_staff", False) or getattr(user, "role", "") == "ADMIN")


def _filter_assigned_to_param(qs, user, raw_value, field="assigned_to_id"):
    if not raw_value:
        return qs
    vals = [v.strip() for v in str(raw_value).split(",") if v.strip()]
    visible_ids = set(str(pk) for pk in get_visible_users(user).values_list("id", flat=True))
    if any(v not in visible_ids for v in vals):
        return qs.none()
    return qs.filter(**{f"{field}__in": vals}) if len(vals) > 1 else qs.filter(**{field: vals[0]})


def _get_or_create_account_from_prospect_company(prospect_company, crm_company):
    if not prospect_company:
        return None
    account = Account.objects.filter(
        name__iexact=prospect_company.name,
        company=crm_company,
    ).first()
    if account:
        return account
    from users.models import Team
    team = Team.objects.filter(company=crm_company).first()
    return Account.objects.create(
        name=prospect_company.name,
        industry=prospect_company.industry or "",
        phone=prospect_company.phone or "",
        email=prospect_company.email or "",
        city=prospect_company.city or "",
        country=prospect_company.country or "",
        company=crm_company,
        team=team,
        created_by=None,
    )


def _create_stage_tasks(op_pipeline, stage, performed_by):
    """Instancie les PipelineStageTask templates en vrais Task liés à l'opportunité."""
    templates = PipelineStageTask.objects.filter(
        stage=stage,
        company=op_pipeline.company,
    ).order_by("order")

    created_tasks = []
    for tmpl in templates:
        due_date = None
        if tmpl.due_days_after_entry:
            due_date = timezone.now() + timezone.timedelta(days=tmpl.due_days_after_entry)

        task = Task.objects.create(
            title=f"[{stage.name}] {tmpl.title}",
            description=tmpl.description or "",
            task_type="classic",
            status="todo",
            priority=tmpl.priority,
            due_date=due_date,
            opportunity=op_pipeline.opportunity,
            assigned_to=op_pipeline.opportunity.assigned_to,
            created_by=performed_by,
            company=op_pipeline.company,
        )
        created_tasks.append(task)

    return created_tasks


def _generate_pipeline_alerts(op_pipeline):
    """Génère automatiquement les alertes pour une OpportunityPipeline."""
    company = op_pipeline.company
    opp     = op_pipeline.opportunity
    now     = timezone.now()
    stage   = op_pipeline.current_stage

    if not stage or stage.is_terminal:
        return

    existing = PipelineAlert.objects.filter(
        opportunity_pipeline=op_pipeline,
        is_resolved=False,
    ).values_list("alert_type", flat=True)

    alerts_to_create = []
    elapsed_days = (now - op_pipeline.stage_entered_at).days

    if elapsed_days >= stage.max_duration_days and "stage_overdue" not in existing:
        alerts_to_create.append(PipelineAlert(
            opportunity_pipeline=op_pipeline,
            alert_type="stage_overdue", severity="critical",
            message=(
                f"L'opportunité «\u00a0{opp.name}\u00a0» est dans l'étape "
                f"«\u00a0{stage.name}\u00a0» depuis {elapsed_days}\u00a0j "
                f"(max\u00a0: {stage.max_duration_days}\u00a0j)."
            ),
            assigned_to=opp.assigned_to, company=company,
        ))

    if op_pipeline.status == "at_risk" and "at_risk" not in existing:
        alerts_to_create.append(PipelineAlert(
            opportunity_pipeline=op_pipeline,
            alert_type="at_risk", severity="warning",
            message=(
                f"L'opportunité «\u00a0{opp.name}\u00a0» approche la limite "
                f"pour l'étape «\u00a0{stage.name}\u00a0»."
            ),
            assigned_to=opp.assigned_to, company=company,
        ))

    recent = StageHistory.objects.filter(
        opportunity_pipeline=op_pipeline,
        created_at__gte=now - timezone.timedelta(hours=48),
    ).exists()
    if not recent and elapsed_days >= 1 and "no_activity" not in existing:
        alerts_to_create.append(PipelineAlert(
            opportunity_pipeline=op_pipeline,
            alert_type="no_activity", severity="warning",
            message=f"Aucune activité sur «\u00a0{opp.name}\u00a0» depuis plus de 48\u00a0h.",
            assigned_to=opp.assigned_to, company=company,
        ))

    overdue_tasks = Task.objects.filter(
        opportunity=opp, company=company,
        status__in=["todo", "in_progress"],
        due_date__lt=now,
    ).count()
    if overdue_tasks > 0 and "tasks_pending" not in existing:
        alerts_to_create.append(PipelineAlert(
            opportunity_pipeline=op_pipeline,
            alert_type="tasks_pending", severity="warning",
            message=f"{overdue_tasks} tâche(s) en retard liée(s) à «\u00a0{opp.name}\u00a0».",
            assigned_to=opp.assigned_to, company=company,
        ))

    if alerts_to_create:
        PipelineAlert.objects.bulk_create(alerts_to_create)


_CRM_STAGE_ORDER = ["new", "qualified", "proposal", "negotiation"]

def _sync_pipeline_from_crm_stage(opportunity, user):
    """
    Synchronise le pipeline en cherchant l'étape dont crm_stage correspond
    au stage CRM de l'opportunité.
    Fonctionne avec n'importe quel pipeline personnalisé.
    """
    op_pipeline  = None
    just_created = False

    try:
        op_pipeline = opportunity.pipeline_data
    except Exception:
        pass

    # Si pas encore dans un pipeline, attacher au pipeline par défaut
    if op_pipeline is None:
        default_pipeline = (
            Pipeline.objects
            .filter(company=opportunity.company, is_active=True)
            .order_by("created_at")
            .first()
        )
        if not default_pipeline:
            return None

        first_stage = (
            default_pipeline.stages
            .filter(is_terminal=False)
            .order_by("order")
            .first()
        )
        op_pipeline = OpportunityPipeline.objects.create(
            opportunity=opportunity,
            pipeline=default_pipeline,
            current_stage=first_stage,
            company=opportunity.company,
            stage_entered_at=timezone.now(),
        )
        just_created = True

    if not op_pipeline.pipeline:
        return None

    pipeline  = op_pipeline.pipeline
    crm_stage = opportunity.stage

    # ✅ Chercher l'étape pipeline dont crm_stage correspond
    new_stage = None

    if crm_stage in ("won", "lost"):
        # Pour won/lost : chercher l'étape terminale correspondante
        # D'abord via crm_stage, sinon via is_won
        new_stage = (
            pipeline.stages
            .filter(crm_stage=crm_stage)
            .first()
        ) or (
            pipeline.stages
            .filter(is_terminal=True, is_won=(crm_stage == "won"))
            .first()
        )
    else:
        # Pour les autres stages : chercher par crm_stage exact
        new_stage = (
            pipeline.stages
            .filter(crm_stage=crm_stage, is_terminal=False)
            .order_by("order")
            .first()
        )

        # Fallback : si aucune étape n'a ce crm_stage configuré,
        # garder l'étape actuelle (ne pas forcer un mauvais mapping)
        if not new_stage:
            return None

    if not new_stage:
        return None

    # Déjà à la bonne étape
    if new_stage.id == op_pipeline.current_stage_id and not just_created:
        return None

    now = timezone.now()
    duration_hours = None
    if op_pipeline.stage_entered_at and not just_created:
        duration_hours = round(
            (now - op_pipeline.stage_entered_at).total_seconds() / 3600, 2
        )

    old_stage = op_pipeline.current_stage

    if new_stage.is_terminal:
        action_type = "won" if new_stage.is_won else "lost"
    elif old_stage and new_stage.order > old_stage.order:
        action_type = "moved_forward"
    elif old_stage and new_stage.order < old_stage.order:
        action_type = "moved_backward"
    else:
        action_type = "entered"

    PipelineAlert.objects.filter(
        opportunity_pipeline=op_pipeline,
        is_resolved=False,
    ).update(is_resolved=True)

    op_pipeline.current_stage    = new_stage
    op_pipeline.stage_entered_at = now
    op_pipeline.save(update_fields=["current_stage", "stage_entered_at", "updated_at"])
    op_pipeline.refresh_computed_fields()

    StageHistory.objects.create(
        opportunity_pipeline=op_pipeline,
        from_stage=old_stage,
        to_stage=new_stage,
        action=action_type,
        performed_by=user,
        notes=f"Sync automatique CRM → Pipeline : {crm_stage}",
        duration_in_stage_hours=duration_hours,
        company=op_pipeline.company,
    )

    if not new_stage.is_terminal:
        _create_stage_tasks(op_pipeline, new_stage, user)

    _generate_pipeline_alerts(op_pipeline)

    return op_pipeline


# ══════════════════════════════════════════════════════════════
# ACCOUNT
# ══════════════════════════════════════════════════════════════

class AccountViewSet(viewsets.ModelViewSet):
    serializer_class   = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Account.objects.filter(company=user.company)
        if not _is_company_admin(user):
            visible_users = get_visible_users(user)
            qs = qs.filter(Q(created_by__in=visible_users) | Q(contacts__assigned_to__in=visible_users)).distinct()
        return qs

    def perform_create(self, serializer):
        serializer.save(
            company=self.request.user.company,
            team=self.request.user.teams.first(),
            created_by=self.request.user,
        )


# ══════════════════════════════════════════════════════════════
# PROSPECT COMPANY
# ══════════════════════════════════════════════════════════════

class ProspectCompanyViewSet(viewsets.ModelViewSet):
    serializer_class   = ProspectCompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ProspectCompany.objects.filter(company=user.company)
        if not _is_company_admin(user):
            visible_users = get_visible_users(user)
            qs = qs.filter(Q(assigned_to__in=visible_users) | Q(prospects__assigned_to__in=visible_users)).distinct()

        search    = self.request.query_params.get("search")
        industry  = self.request.query_params.get("industry")
        country   = self.request.query_params.get("country")
        source    = self.request.query_params.get("source")
        date_from = self.request.query_params.get("created_at__gte")
        date_to   = self.request.query_params.get("created_at__lte")

        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(industry__icontains=search)
            )
        if industry:
            qs = qs.filter(industry=industry)
        if country:
            qs = qs.filter(country=country)
        if source:
            vals = [v.strip() for v in source.split(",") if v.strip()]
            qs = qs.filter(source__in=vals) if len(vals) > 1 else qs.filter(source=vals[0])
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        ordering = self.request.query_params.get("ordering", "-created_at")
        allowed  = ["created_at", "-created_at", "name", "-name", "industry", "-industry"]
        return qs.order_by(ordering if ordering in allowed else "-created_at")

    def perform_create(self, serializer):
        user   = self.request.user
        source = serializer.validated_data.get("source")
        if not source:
            source = "commercial" if user.role == "COMMERCIAL" else "agent_prospection"
        assigned = serializer.validated_data.get("assigned_to")
        if assigned and not user_can_access_user(user, assigned):
            raise PermissionDenied("Vous ne pouvez assigner qu'a un utilisateur visible.")
        serializer.save(company=user.company, source=source, created_by=user, assigned_to=assigned or user)


# ══════════════════════════════════════════════════════════════
# PROSPECT
# ══════════════════════════════════════════════════════════════

class ProspectViewSet(viewsets.ModelViewSet):
    serializer_class   = ProspectSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = StandardPagination

    def get_queryset(self):
        user = self.request.user
        qs = get_engagement_queryset_for_user(user).select_related("assigned_to", "prospect_company").annotate(
            _activities_count=Count("prospect_activities", distinct=True),
            _documents_count=Count("documents", distinct=True),
            _agent_runs_count=Count("agent_runs", distinct=True),
        )

        p_status         = self.request.query_params.get("status")
        assigned_to      = self.request.query_params.get("assigned_to")
        search           = self.request.query_params.get("search")
        origin           = self.request.query_params.get("origin")
        evaluation       = self.request.query_params.get("evaluation")
        prospect_company = self.request.query_params.get("prospect_company")
        source           = self.request.query_params.get("source")

        if p_status:
            vals = [v.strip() for v in p_status.split(",") if v.strip()]
            qs = qs.filter(status__in=vals) if len(vals) > 1 else qs.filter(status=vals[0])
        if assigned_to:
            qs = _filter_assigned_to_param(qs, user, assigned_to)
        if origin:
            vals = [v.strip() for v in origin.split(",") if v.strip()]
            qs = qs.filter(origin__in=vals) if len(vals) > 1 else qs.filter(origin=vals[0])
        if evaluation:
            vals = [v.strip() for v in evaluation.split(",") if v.strip()]
            qs = qs.filter(evaluation__in=vals) if len(vals) > 1 else qs.filter(evaluation=vals[0])
        if prospect_company:
            vals = [v.strip() for v in prospect_company.split(",") if v.strip()]
            qs = qs.filter(prospect_company_id__in=vals) if len(vals) > 1 else qs.filter(prospect_company_id=vals[0])
        if source:
            vals = [v.strip() for v in source.split(",") if v.strip()]
            qs = qs.filter(source__in=vals) if len(vals) > 1 else qs.filter(source=vals[0])
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) |
                Q(email__icontains=search)       | Q(phone__icontains=search)
            )
        ordering = self.request.query_params.get("ordering", "-created_at")
        allowed  = ["created_at", "-created_at", "last_name", "-last_name", "status", "-status", "evaluation", "-evaluation"]
        return qs.order_by(ordering if ordering in allowed else "-created_at")

    def _validate_assignment(self, user, assigned):
        if assigned and assigned.role != "COMMERCIAL":
            raise PermissionDenied("Un prospect ne peut être assigné qu'à un commercial.")
        if user.role in ("ADMIN",) or user.is_staff:
            if assigned and assigned.company != user.company:
                raise PermissionDenied("Ce commercial n'appartient pas à votre société.")
        elif user.role == "MANAGER":
            if assigned:
                if not user_can_access_user(user, assigned) or assigned.role != "COMMERCIAL":
                    raise PermissionDenied("Vous ne pouvez assigner qu'aux commerciaux de votre équipe.")

    def perform_create(self, serializer):
        user     = self.request.user
        assigned = serializer.validated_data.get("assigned_to")
        check_limits(user.company, "add_prospect")
        self._validate_assignment(user, assigned)
        if user.role == "COMMERCIAL":
            serializer.validated_data["assigned_to"] = user
        serializer.save()

    def perform_update(self, serializer):
        user     = self.request.user
        assigned = serializer.validated_data.get("assigned_to")
        self._validate_assignment(user, assigned)
        if user.role == "COMMERCIAL":
            serializer.validated_data.pop("assigned_to", None)
        serializer.save()

    @action(detail=True, methods=["get"], url_path="activities")
    def activities(self, request, pk=None):
        prospect = self.get_object()
        qs = TaskActivity.objects.filter(
            prospect=prospect,
        ).select_related("performed_by", "task").order_by("-created_at")
        return Response(TaskActivitySerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="tasks")
    def tasks(self, request, pk=None):
        prospect = self.get_object()
        qs = get_task_queryset_for_user(request.user).filter(
            prospect=prospect,
        ).select_related("assigned_to", "created_by").prefetch_related(
            "activities__performed_by",
        ).order_by("-created_at")
        return Response(TaskSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="details")
    def details(self, request, pk=None):
        detail_qs = self.get_queryset().select_related(
            "assigned_to", "prospect_company"
        ).prefetch_related(
            "prospect_activities__created_by",
            "documents",
            "agent_runs",
            "recommendations",
            "score_history",
            "engagement_logs",
        )
        prospect = get_object_or_404(detail_qs, pk=pk)
        ensure_default_recommendation(prospect)
        latest_activity = prospect.prospect_activities.select_related("created_by").first()
        latest_agent_run = prospect.agent_runs.first()
        next_recommendation = prospect.recommendations.filter(status="pending").first()
        next_task = get_task_queryset_for_user(request.user).filter(
            prospect=prospect,
            status__in=["pending", "ready", "in_progress", "todo"],
        ).order_by("due_date", "created_at").first()
        company = prospect.prospect_company
        score = company.score_ia if company else None
        contact_methods = sum(
            1
            for value in [
                prospect.email,
                prospect.phone,
                prospect.linkedin_url,
                prospect.facebook_url,
                prospect.instagram_url,
                prospect.website,
            ]
            if value
        )
        last_engagement = prospect.engagement_logs.first()
        summary = {
            "score": score,
            "priority": "Haute" if (score or 0) >= 70 or prospect.evaluation == "hot" else "Moyenne" if (score or 0) >= 35 else "Basse",
            "contact_methods": contact_methods,
            "activities_count": prospect.prospect_activities.count(),
            "documents_count": prospect.documents.count(),
            "agent_runs_count": prospect.agent_runs.count(),
            "engagement_count": prospect.engagement_logs.count(),
            "last_interaction_at": latest_activity.created_at if latest_activity else prospect.last_reply_at or prospect.last_message_sent_at,
            "last_interaction_title": latest_activity.title if latest_activity else (last_engagement.action if last_engagement else ""),
            "latest_agent_run": latest_agent_run.agent_type if latest_agent_run else "",
            "next_action": next_recommendation.title if next_recommendation else (next_task.title if next_task else prospect.next_recommended_action),
        }
        return Response({
            "prospect": ProspectSerializer(prospect, context={"request": request}).data,
            "summary": summary,
            "latest_activity": ProspectActivitySerializer(latest_activity, context={"request": request}).data if latest_activity else None,
            "latest_agent_run": ProspectAgentRunSerializer(latest_agent_run, context={"request": request}).data if latest_agent_run else None,
            "next_recommendation": ProspectRecommendationSerializer(next_recommendation, context={"request": request}).data if next_recommendation else None,
        })

    @action(detail=True, methods=["get", "post"], url_path="activity-stream")
    def activity_stream(self, request, pk=None):
        prospect = self.get_object()
        if request.method == "GET":
            qs = prospect.prospect_activities.select_related("created_by", "agent_run").prefetch_related("score_changes")[:100]
            return Response(ProspectActivitySerializer(qs, many=True, context={"request": request}).data)

        serializer = ProspectActivitySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        activity = record_prospect_activity(
            prospect=prospect,
            activity_type=serializer.validated_data["activity_type"],
            channel=serializer.validated_data.get("channel"),
            title=serializer.validated_data["title"],
            description=serializer.validated_data.get("description") or "",
            source="manual",
            created_by=request.user,
            metadata=serializer.validated_data.get("metadata") or {},
        )
        return Response(ProspectActivitySerializer(activity, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="documents",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def documents(self, request, pk=None):
        prospect = self.get_object()
        if request.method == "GET":
            qs = prospect.documents.select_related("uploaded_by", "agent_run")[:100]
            return Response(ProspectDocumentSerializer(qs, many=True, context={"request": request}).data)

        serializer = ProspectDocumentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        document = serializer.save(prospect=prospect, uploaded_by=request.user, source="manual")
        event_from_document(document)
        return Response(ProspectDocumentSerializer(document, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"documents/(?P<document_id>[^/.]+)")
    def delete_document(self, request, pk=None, document_id=None):
        prospect = self.get_object()
        document = get_object_or_404(ProspectDocument, pk=document_id, prospect=prospect)
        if not (_is_company_admin(request.user) or request.user.role == "MANAGER" or document.uploaded_by_id == request.user.id):
            raise PermissionDenied("Vous ne pouvez pas supprimer ce document.")
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="agent-runs")
    def agent_runs(self, request, pk=None):
        prospect = self.get_object()
        qs = prospect.agent_runs.all()[:100]
        return Response(ProspectAgentRunSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="score-history")
    def score_history(self, request, pk=None):
        prospect = self.get_object()
        qs = prospect.score_history.select_related("activity", "agent_run")[:100]
        return Response(ProspectScoreHistorySerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], url_path="recommendations")
    def recommendations(self, request, pk=None):
        prospect = self.get_object()
        ensure_default_recommendation(prospect)
        if request.method == "GET":
            qs = prospect.recommendations.all()[:100]
            return Response(ProspectRecommendationSerializer(qs, many=True, context={"request": request}).data)
        serializer = ProspectRecommendationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        recommendation = serializer.save(prospect=prospect, generated_by="manual")
        return Response(ProspectRecommendationSerializer(recommendation, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"recommendations/(?P<recommendation_id>[^/.]+)/status")
    def recommendation_status(self, request, pk=None, recommendation_id=None):
        prospect = self.get_object()
        recommendation = get_object_or_404(ProspectRecommendation, pk=recommendation_id, prospect=prospect)
        new_status = request.data.get("status")
        if new_status not in {"pending", "completed", "ignored"}:
            raise ValidationError({"status": "Statut invalide."})
        recommendation.status = new_status
        recommendation.completed_at = timezone.now() if new_status == "completed" else None
        recommendation.save(update_fields=["status", "completed_at"])
        if new_status in {"completed", "ignored"}:
            record_crm_event(
                event_type="recommendation_completed",
                category="prospect",
                title=recommendation.title,
                description=recommendation.reason or recommendation.description or "",
                severity="success" if new_status == "completed" else "info",
                source_type="manual",
                source_name="recommendation",
                source_id=f"recommendation-status-{recommendation.id}-{new_status}",
                user=request.user,
                prospect=prospect,
                related_object_type="prospect_recommendation",
                related_object_id=recommendation.id,
                status=new_status,
                metadata={"priority": recommendation.priority, "status": new_status},
            )
        return Response(ProspectRecommendationSerializer(recommendation, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="engagement")
    def engagement(self, request, pk=None):
        prospect = self.get_object()
        from agentEngagement.models import EngagementLog

        logs = EngagementLog.objects.filter(prospect=prospect).select_related("user")[:100]
        data = [
            {
                "id": log.id,
                "action": log.action,
                "channel": log.channel,
                "message": log.message,
                "status": log.status,
                "error": log.error or log.error_message,
                "agent": "Engagement Agent",
                "validated_by": (
                    f"{getattr(log.user, 'first_name', '')} {getattr(log.user, 'last_name', '')}".strip()
                    or getattr(log.user, "username", None)
                    or getattr(log.user, "email", None)
                ) if log.user else None,
                "sent_at": log.sent_at,
                "created_at": log.created_at,
                "sender": log.sender_name or log.sender_email,
            }
            for log in logs
        ]
        return Response(data)


# ══════════════════════════════════════════════════════════════
# OPPORTUNITY
# ══════════════════════════════════════════════════════════════

class OpportunityViewSet(viewsets.ModelViewSet):
    serializer_class   = OpportunitySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = StandardPagination

    def get_queryset(self):
        user = self.request.user
        # ✅ select_related pipeline_data pour pipeline_info sans N+1
        qs = Opportunity.objects.filter(
            company=user.company
        ).select_related(
            "assigned_to", "prospect", "contact",
            "pipeline_data__current_stage",
            "pipeline_data__pipeline",
        )
        if not _is_company_admin(user):
            qs = filter_by_visible_users(qs, user)

        stage       = self.request.query_params.get("stage")
        assigned_to = self.request.query_params.get("assigned_to")
        search      = self.request.query_params.get("search")

        if stage:       qs = qs.filter(stage=stage)
        if assigned_to: qs = _filter_assigned_to_param(qs, user, assigned_to)
        if search:      qs = qs.filter(Q(name__icontains=search))

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user     = self.request.user
        assigned = serializer.validated_data.get("assigned_to")

        if user.role == "COMMERCIAL":
            serializer.save(company=user.company, assigned_to=user)
        elif user.role in ("ADMIN", "MANAGER"):
            if not assigned:
                raise ValidationError({"assigned_to": "Veuillez assigner cette opportunité à un commercial."})
            if assigned.company != user.company:
                raise PermissionDenied("Ce commercial n'appartient pas à votre société.")
            if user.role == "MANAGER":
                if not user_can_access_user(user, assigned) or assigned.role != "COMMERCIAL":
                    raise PermissionDenied("Vous ne pouvez assigner qu'aux commerciaux de votre équipe.")
            serializer.save(company=user.company)
        else:
            serializer.save(company=user.company, assigned_to=user)

    def perform_update(self, serializer):
        user     = self.request.user
        assigned = serializer.validated_data.get("assigned_to")

        if user.role == "COMMERCIAL":
            serializer.validated_data.pop("assigned_to", None)
        elif user.role == "MANAGER" and assigned:
            if not user_can_access_user(user, assigned) or assigned.role != "COMMERCIAL":
                raise PermissionDenied("Vous ne pouvez assigner qu'aux commerciaux de votre équipe.")

        # ✅ FIX : capturer old_stage depuis serializer.instance (évite la 2ème requête DB)
        old_stage = serializer.instance.stage
        serializer.instance._old_stage = old_stage

        opportunity = serializer.save()

        # Poser le flag anti-boucle avant la synchro
        opportunity._pipeline_sync_in_progress = True

        if old_stage != opportunity.stage:
            try:
                _sync_pipeline_from_crm_stage(opportunity, user)
            except Exception as e:
                print(f"[WARN] Synchro pipeline après update échouée : {e}")

        opportunity._pipeline_sync_in_progress = False

        # ── Logique existante : conversion prospect → contact si won ──
        if opportunity.stage != "won":
            return

        prospect    = getattr(opportunity, "prospect", None)
        crm_company = user.company
        if not prospect or not prospect.email:
            return

        try:
            with transaction.atomic():
                account = _get_or_create_account_from_prospect_company(
                    prospect.prospect_company, crm_company
                )
                contact, created = Contact.objects.get_or_create(
                    email=prospect.email,
                    defaults={
                        "first_name":  prospect.first_name or "",
                        "last_name":   prospect.last_name  or "",
                        "title":       prospect.title      or "",
                        "phone":       prospect.phone      or "",
                        "company":     crm_company,
                        "account":     account,
                        "assigned_to": prospect.assigned_to,
                    },
                )
                if not created:
                    fields = []
                    if contact.account is None and account:
                        contact.account = account
                        fields.append("account")
                    if contact.assigned_to is None and prospect.assigned_to:
                        contact.assigned_to = prospect.assigned_to
                        fields.append("assigned_to")
                    if fields:
                        contact.save(update_fields=fields)

                Opportunity.objects.filter(prospect=prospect, company=crm_company).update(
                    prospect=None, contact=contact
                )
                if not Opportunity.objects.filter(prospect=prospect, company=crm_company).exists():
                    prospect.delete()
        except Exception as e:
            print(f"[ERROR] Conversion prospect -> contact : {e}")
            raise

    @action(detail=True, methods=["post"], url_path="sync-pipeline")
    def sync_pipeline(self, request, pk=None):
        """
        ✅ Endpoint de synchro manuelle CRM → Pipeline.
        POST /api/sales/opportunities/{id}/sync-pipeline/

        Appelé par le frontend après une mise à jour de stage CRM pour s'assurer
        que le pipeline reflète bien le nouveau stage.
        """
        opportunity = self.get_object()
        op_pipeline = _sync_pipeline_from_crm_stage(opportunity, request.user)

        if op_pipeline:
            return Response({
                "synced":          True,
                "new_stage":       op_pipeline.current_stage.name if op_pipeline.current_stage else None,
                "pipeline_status": op_pipeline.status,
                "pipeline_info": {
                    "pipeline_id":    op_pipeline.pipeline_id,
                    "pipeline_name":  op_pipeline.pipeline.name if op_pipeline.pipeline else None,
                    "stage_name":     op_pipeline.current_stage.name if op_pipeline.current_stage else None,
                    "stage_color":    op_pipeline.current_stage.color_hex if op_pipeline.current_stage else None,
                    "status":         op_pipeline.status,
                    "progression":    op_pipeline.progression,
                    "op_pipeline_id": op_pipeline.id,
                },
            })

        return Response({
            "synced": False,
            "reason": "Pas de pipeline lié ou étape déjà à jour.",
        })


# ══════════════════════════════════════════════════════════════
# CONTACT
# ══════════════════════════════════════════════════════════════

class ContactViewSet(viewsets.ModelViewSet):
    serializer_class   = ContactSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = StandardPagination

    def get_queryset(self):
        user = self.request.user
        qs   = Contact.objects.filter(company=user.company).select_related("account", "assigned_to")
        if not _is_company_admin(user):
            qs = filter_by_visible_users(qs, user)

        assigned_to = self.request.query_params.get("assigned_to")
        search      = self.request.query_params.get("search")
        account     = self.request.query_params.get("account")

        if assigned_to:
            qs = _filter_assigned_to_param(qs, user, assigned_to)
        if account:
            qs = qs.filter(account_id=account)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) |
                Q(email__icontains=search)       | Q(phone__icontains=search)
            )
        ordering = self.request.query_params.get("ordering", "-created_at")
        allowed  = ["created_at", "-created_at", "last_name", "-last_name", "email", "-email"]
        return qs.order_by(ordering if ordering in allowed else "-created_at")

    def perform_create(self, serializer):
        user     = self.request.user
        assigned = serializer.validated_data.get("assigned_to")
        if assigned and assigned.role != "COMMERCIAL":
            raise PermissionDenied("Un contact ne peut être assigné qu'à un commercial.")
        if user.role == "COMMERCIAL":
            serializer.validated_data["assigned_to"] = user
        elif assigned and not user_can_access_user(user, assigned):
            raise PermissionDenied("Vous ne pouvez assigner qu'a un utilisateur visible.")
        serializer.save(company=user.company)


# ══════════════════════════════════════════════════════════════
# TASK
# ══════════════════════════════════════════════════════════════

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class   = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = StandardPagination

    def get_queryset(self):
        user    = self.request.user
        qs = get_task_queryset_for_user(user).select_related(
            "assigned_to", "created_by", "parent_task",
            "prospect", "contact", "opportunity",
        ).prefetch_related(
            "activities__performed_by",
            "comments__author",
            "follow_up_tasks",
        )
        prospect_id = self.request.query_params.get("prospect")
        if prospect_id:
             qs = qs.filter(prospect_id=prospect_id)

        task_status = self.request.query_params.get("status")
        priority    = self.request.query_params.get("priority")
        assigned_to = self.request.query_params.get("assigned_to")
        search      = self.request.query_params.get("search")
        task_type   = self.request.query_params.get("task_type") or self.request.query_params.get("type")
        opportunity = self.request.query_params.get("opportunity")
        due_date    = self.request.query_params.get("due_date")

        if task_status: qs = qs.filter(status=task_status)
        if priority:    qs = qs.filter(priority=priority)
        if assigned_to: qs = _filter_assigned_to_param(qs, user, assigned_to)
        if task_type:   qs = qs.filter(task_type=task_type)
        if opportunity: qs = qs.filter(opportunity_id=opportunity)
        if due_date:    qs = qs.filter(due_date__date=due_date)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        assigned = serializer.validated_data.get("assigned_to")
        prospect = serializer.validated_data.get("prospect")

    # ✅ Si la tâche est pour un prospect et qu'aucun assigné n'est spécifié,
    #    prendre le commercial assigné au prospect
        if prospect and not assigned:
            if prospect.assigned_to:
                serializer.validated_data["assigned_to"] = prospect.assigned_to
            else:
                serializer.validated_data["assigned_to"] = user
        if prospect:
            if prospect.company != user.company:
                raise PermissionDenied("Ce prospect n'appartient pas a votre societe.")
            if not get_engagement_queryset_for_user(user).filter(pk=prospect.pk).exists():
                raise PermissionDenied("Ce prospect n'est pas dans votre perimetre.")
            serializer.validated_data["prospect_company"] = prospect.prospect_company

    # Si toujours pas d'assigné, utiliser l'utilisateur courant
        if not serializer.validated_data.get("assigned_to"):
            serializer.validated_data["assigned_to"] = user
        assigned = serializer.validated_data.get("assigned_to")
        if not _is_company_admin(user) and assigned and not user_can_access_user(user, assigned):
            raise PermissionDenied("Vous ne pouvez assigner qu'a un utilisateur visible.")

        if user.role == "ADMIN" or user.is_staff:
            if assigned and assigned.company != user.company:
             raise PermissionDenied("Cet utilisateur n'appartient pas à votre société.")
            serializer.save(company=user.company, created_by=user)
        elif user.role == "MANAGER":
            if assigned:
                team_ids = list(get_team_users_for_manager(user).values_list("id", flat=True))
                if assigned.id != user.id and assigned.id not in team_ids:
                    raise PermissionDenied("Vous ne pouvez assigner qu'aux membres de votre équipe.")
            serializer.save(company=user.company, created_by=user)
        else:
        # Commercial : s'assurer que la tâche est assignée à lui-même
            serializer.validated_data["assigned_to"] = user
            serializer.save(company=user.company, created_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        task = self.get_object()
        if user.role == "COMMERCIAL" and task.assigned_to != user:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres tâches.")
        instance = serializer.save()
        if instance.status in ("done", "completed") and not instance.closed_at:
            now = timezone.now()
            instance.closed_at = now
            instance.completed_at = now
            instance.save(update_fields=["closed_at", "completed_at"])

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if task.assigned_to != user and user.role not in ("ADMIN", "MANAGER"):
            return Response({"error": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        if task.status == "cancelled":
            return Response({"error": "Une tâche annulée ne peut pas être clôturée."}, status=400)
        if task.status in ("done", "completed"):
            return Response({"error": "Cette tâche est déjà clôturée."}, status=400)
        report          = request.data.get("closing_report", "")
        task.status         = "completed"
        task.closing_report = report
        now = timezone.now()
        task.closed_at      = now
        task.completed_at   = now
        task.save(update_fields=["status", "closing_report", "closed_at", "completed_at", "updated_at"])
        TaskActivity.objects.create(
            task=task, activity_type="status_change", performed_by=user,
            notes=f"Tâche clôturée.{f' Rapport : {report}' if report else ''}",
        )
        return Response(self.get_serializer(task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if task.assigned_to != user and user.role not in ("ADMIN", "MANAGER"):
            return Response({"error": "Permission refusee."}, status=status.HTTP_403_FORBIDDEN)
        if task.status in ("completed", "done", "cancelled"):
            return Response({"error": "Cette tache ne peut pas etre terminee."}, status=400)

        now = timezone.now()
        task.status = "completed"
        task.completed_at = now
        task.closed_at = now
        task.closing_report = request.data.get("closing_report", task.closing_report)
        task.save(update_fields=["status", "completed_at", "closed_at", "closing_report", "updated_at"])

        TaskActivity.objects.create(
            task=task,
            activity_type="status_change",
            performed_by=user,
            prospect=task.prospect,
            notes=request.data.get("note") or "Tache marquee comme terminee.",
        )

        if task.task_type == "call" and task.prospect:
            from .engagement_tasks import upsert_prospect_task

            name = f"{task.prospect.first_name} {task.prospect.last_name}".strip()
            if task.prospect.email:
                upsert_prospect_task(
                    task.prospect,
                    "email",
                    f"Envoyer un email a {name}",
                    "Suivi apres appel commercial.",
                    user=user,
                    status="pending",
                    due_date=timezone.now() + timedelta(days=1),
                )
            elif task.prospect.linkedin_url:
                upsert_prospect_task(
                    task.prospect,
                    "linkedin_message",
                    f"Envoyer un message LinkedIn a {name}",
                    "Suivi apres appel commercial.",
                    user=user,
                    status="pending",
                    due_date=timezone.now() + timedelta(days=1),
                )

        try:
            from .engagement_tasks import sync_task_calendar

            sync_task_calendar(task)
        except Exception:
            pass

        return Response(self.get_serializer(task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="update-quota")
    def update_quota(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if task.assigned_to != user and user.role not in ("ADMIN", "MANAGER"):
            return Response({"error": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)
        if task.task_type != "quota":
            return Response({"error": "Cette tâche n'est pas de type quota."}, status=400)
        if task.status in ("done", "cancelled"):
            return Response({"error": "Impossible de modifier une tâche terminée ou annulée."}, status=400)
        new_progress = request.data.get("quota_progress")
        if new_progress is None:
            return Response({"error": "Le champ quota_progress est requis."}, status=400)
        try:
            new_progress = int(new_progress)
            if new_progress < 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "quota_progress doit être un entier positif."}, status=400)
        old_progress        = task.quota_progress
        task.quota_progress = new_progress
        task.save(update_fields=["quota_progress", "updated_at"])
        TaskActivity.objects.create(
            task=task, activity_type="note", performed_by=user,
            notes=f"Progression : {old_progress} → {new_progress} (objectif : {task.quota_target})",
        )
        task.check_quota_completion()
        task.refresh_from_db()
        return Response(self.get_serializer(task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="create-followup")
    def create_followup(self, request, pk=None):
        parent = self.get_object()
        data   = request.data.copy()
        data["parent_task"] = parent.id
        if not data.get("prospect")    and parent.prospect_id:    data["prospect"]    = parent.prospect_id
        if not data.get("contact")     and parent.contact_id:     data["contact"]     = parent.contact_id
        if not data.get("opportunity") and parent.opportunity_id: data["opportunity"] = parent.opportunity_id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        TaskActivity.objects.create(
            task=parent, activity_type="note", performed_by=request.user,
            notes=f"Tâche de suivi créée : {serializer.validated_data.get('title', '')}",
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="activities")
    def activities(self, request, pk=None):
        task = self.get_object()
        qs   = task.activities.select_related("performed_by", "prospect", "contact").order_by("-created_at")
        return Response(TaskActivitySerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="comments")
    def comments(self, request, pk=None):
        task = self.get_object()
        qs   = task.comments.select_related("author", "parent_comment").order_by("created_at")
        return Response(TaskCommentSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="followups")
    def followups(self, request, pk=None):
        task = self.get_object()
        qs   = task.follow_up_tasks.select_related("assigned_to", "created_by").order_by("created_at")
        return Response(self.get_serializer(qs, many=True, context={"request": request}).data)


# ══════════════════════════════════════════════════════════════
# TASK ACTIVITY
# ══════════════════════════════════════════════════════════════

class TaskActivityViewSet(viewsets.ModelViewSet):
    serializer_class   = TaskActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
 
    def get_queryset(self):
        user = self.request.user
        visible_users = get_visible_users(user)
        qs = TaskActivity.objects.filter(
            Q(task__company=user.company, task__assigned_to__in=visible_users)
            | Q(task__isnull=True, prospect__company=user.company, prospect__assigned_to__in=visible_users)
        ).select_related("performed_by", "prospect", "contact", "task")
    
        task_id = self.request.query_params.get("task_id")
        if task_id:
            qs = qs.filter(task_id=task_id)

    # ← Ajouter ces 3 lignes
        prospect_id = self.request.query_params.get("prospect_id")
        if prospect_id:
            qs = qs.filter(task__prospect_id=prospect_id)

        return qs.order_by("-created_at")
 
    def perform_create(self, serializer):
        user = self.request.user
        task = serializer.validated_data.get("task")
 
        if task and task.company != user.company:
            raise PermissionDenied("Vous ne pouvez pas ajouter une activité à cette tâche.")
        if task and not user_can_access_user(user, task.assigned_to):
            raise PermissionDenied("Vous ne pouvez ajouter des activites qu'a vos taches visibles.")
 
        # ── Créer l'activité ──────────────────────────
        activity = serializer.save(performed_by=user)
 
        # ── Envoi email si type = email ──────────────
        if activity.activity_type == "email" and activity.email_sent_to and activity.email_subject:
            try:
                send_mail(
                    subject=activity.email_subject,
                    message=activity.email_body or "",
                    from_email=settings.EMAIL_HOST_USER,
                    recipient_list=[activity.email_sent_to],
                )
                TaskActivity.objects.filter(pk=activity.pk).update(email_sent=True)
            except Exception as e:
                print(f"[ERROR] Email non envoyé : {e}")
 
        # ── DÉCLENCHER LE TRIGGER INTELLIGENT ────────
        # Uniquement pour les activités de type 'call' avec un résultat
        trigger_result = None
        if activity.activity_type == "call" and activity.call_result:
            try:
                trigger_result = process_call_trigger(activity, task)
            except Exception as e:
                print(f"[WARN] Trigger engine error : {e}")
 
        # Stocker le résultat du trigger pour le retourner au frontend
        # via l'action /trigger-result/ ou directement dans la réponse
        self._last_trigger_result = trigger_result
 
    def create(self, request, *args, **kwargs):
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
 
        response_data = serializer.data
        # Enrichir la réponse avec le résultat du trigger
        trigger_result = getattr(self, "_last_trigger_result", None)
        if trigger_result:
            response_data = dict(response_data)
            response_data["trigger"] = trigger_result
 
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
 
    def perform_update(self, serializer):
        raise PermissionDenied("Les activités ne peuvent pas être modifiées après création.")
 
    def perform_destroy(self, instance):
        if self.request.user.role != "ADMIN":
            raise PermissionDenied("Seul un administrateur peut supprimer une activité.")
        instance.delete()
 
    @action(detail=False, methods=["get"], url_path="no-answer-count")
    def no_answer_count(self, request):
        
        from .trigger_engine import get_no_answer_count, MAX_CALL_ATTEMPTS
        from .models import Prospect
 
        prospect_id = request.query_params.get("prospect_id")
        task_id     = request.query_params.get("task_id")
 
        prospect = None
        task     = None
 
        if prospect_id:
            try:
                prospect = get_engagement_queryset_for_user(request.user).get(id=prospect_id)
            except Prospect.DoesNotExist:
                return Response({"error": "Prospect introuvable."}, status=404)
 
        if task_id:
            try:
                task = get_task_queryset_for_user(request.user).get(id=task_id)
            except Task.DoesNotExist:
                return Response({"error": "Tâche introuvable."}, status=404)
 
        count = get_no_answer_count(prospect=prospect, task=task)
        return Response({
            "no_answer_count":      count,
            "max_attempts":         MAX_CALL_ATTEMPTS,
            "remaining_attempts":   max(0, MAX_CALL_ATTEMPTS - count),
            "will_escalate_next":   count >= 2,
            "is_unreachable":       count >= MAX_CALL_ATTEMPTS,
        })


# ══════════════════════════════════════════════════════════════
# TASK COMMENT
# ══════════════════════════════════════════════════════════════

class TaskCommentViewSet(viewsets.ModelViewSet):
    serializer_class   = TaskCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = TaskComment.objects.filter(
            task__company=user.company,
            task__assigned_to__in=get_visible_users(user),
        ).select_related("author", "task", "parent_comment")

        task_id = self.request.query_params.get("task_id")
        if task_id:
            qs = qs.filter(task_id=task_id)

        return qs.order_by("created_at")

    def perform_create(self, serializer):
        user = self.request.user
        task = serializer.validated_data.get("task")
        if task and task.company != user.company:
            raise PermissionDenied("Vous ne pouvez pas commenter cette tâche.")
        if task and not user_can_access_user(user, task.assigned_to):
            raise PermissionDenied("Vous ne pouvez commenter que vos taches visibles.")
        serializer.save(author=user)

    def perform_update(self, serializer):
        if self.get_object().author != self.request.user:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres commentaires.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.author != user and user.role != "ADMIN":
            raise PermissionDenied("Vous ne pouvez supprimer que vos propres commentaires.")
        instance.delete()


# ══════════════════════════════════════════════════════════════
# KPI
# ══════════════════════════════════════════════════════════════

class MyKPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year  = request.query_params.get("year")
        month = request.query_params.get("month")
        return Response(compute_kpi(
            request.user,
            year=int(year)   if year  else None,
            month=int(month) if month else None,
        ))


class CommercialKPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        caller = request.user
        if caller.role not in ("ADMIN", "MANAGER") and not caller.is_staff:
            raise PermissionDenied("Accès réservé aux managers et admins.")
        if caller.role == "MANAGER" and not caller.is_staff:
            team_ids   = _get_manager_team_ids(caller)
            commercial = get_object_or_404(User, id=user_id, company=caller.company, role="COMMERCIAL")
            if commercial.id not in team_ids:
                raise PermissionDenied("Ce commercial n'est pas dans votre équipe.")
        else:
            commercial = get_object_or_404(User, id=user_id, company=caller.company)
        year  = request.query_params.get("year")
        month = request.query_params.get("month")
        return Response(compute_kpi(
            commercial,
            year=int(year)   if year  else None,
            month=int(month) if month else None,
        ))


class TeamKPIDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        caller = request.user
        if caller.role not in ("ADMIN", "MANAGER") and not caller.is_staff:
            raise PermissionDenied("Accès réservé aux managers et admins.")
        year      = request.query_params.get("year")
        month     = request.query_params.get("month")
        user_ids  = _get_manager_team_ids(caller)
        team_kpis = compute_team_kpi(
            company=caller.company,
            year=int(year)   if year  else None,
            month=int(month) if month else None,
            user_ids=user_ids,
        ) or []
        if team_kpis:
            avg_score     = round(sum(k["score"] for k in team_kpis) / len(team_kpis), 1)
            top_performer = team_kpis[0]
            in_difficulty = [k for k in team_kpis if k["score"] < 70]
        else:
            avg_score, top_performer, in_difficulty = 0, None, []
        now = timezone.now()
        return Response({
            "year":          int(year)  if year  else now.year,
            "month":         int(month) if month else now.month,
            "team_count":    len(team_kpis),
            "avg_score":     avg_score,
            "top_performer": top_performer,
            "in_difficulty": in_difficulty,
            "leaderboard":   team_kpis,
        })


class MyPerformanceHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        months = int(request.query_params.get("months", 6))
        return Response(get_performance_history(request.user, months=months))


class CommercialHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        caller = request.user
        if caller.role not in ("ADMIN", "MANAGER") and not caller.is_staff:
            raise PermissionDenied("Accès réservé aux managers et admins.")
        if caller.role == "MANAGER" and not caller.is_staff:
            commercial = get_object_or_404(User, id=user_id, company=caller.company)
            if not user_can_access_user(caller, commercial):
                raise PermissionDenied("Ce commercial n'est pas dans votre équipe.")
        else:
            commercial = get_object_or_404(User, id=user_id, company=caller.company)
        months = int(request.query_params.get("months", 6))
        return Response(get_performance_history(commercial, months=months))


class AlertsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        caller = request.user
        if caller.role not in ("ADMIN", "MANAGER") and not caller.is_staff:
            raise PermissionDenied("Accès réservé aux managers et admins.")
        now      = timezone.now()
        company  = caller.company
        in_24h   = now + timezone.timedelta(hours=24)
        visible_ids = list(get_visible_users(caller).values_list("id", flat=True))

        overdue_qs = Task.objects.filter(
            company=company, status__in=["todo", "in_progress"], due_date__lt=now,
        ).select_related("assigned_to")
        if not _is_company_admin(caller):
            overdue_qs = overdue_qs.filter(assigned_to_id__in=visible_ids)

        upcoming_qs = Task.objects.filter(
            company=company, status__in=["todo", "in_progress"],
            due_date__gte=now, due_date__lte=in_24h,
        ).select_related("assigned_to")
        if not _is_company_admin(caller):
            upcoming_qs = upcoming_qs.filter(assigned_to_id__in=visible_ids)

        inactive = detect_inactive_users(company, days_threshold=3)
        if not _is_company_admin(caller):
            inactive = [u for u in inactive if u["user_id"] in visible_ids]

        low_qs = PerformanceScore.objects.filter(
            company=company, year=now.year, month=now.month, score__lt=70,
        ).select_related("commercial")
        if not _is_company_admin(caller):
            low_qs = low_qs.filter(commercial_id__in=visible_ids)

        overdue_list   = [{"task_id": t.id, "title": t.title, "due_date": t.due_date, "commercial": t.assigned_to.username if t.assigned_to else None, "priority": t.priority} for t in overdue_qs]
        upcoming_list  = [{"task_id": t.id, "title": t.title, "due_date": t.due_date, "commercial": t.assigned_to.username if t.assigned_to else None} for t in upcoming_qs]
        low_score_list = [{"user_id": s.commercial.id, "username": s.commercial.username, "score": s.score, "penalty": s.penalty_points} for s in low_qs]

        return Response({
            "overdue_tasks": overdue_list, "upcoming_tasks": upcoming_list,
            "inactive_users": inactive,    "low_score_users": low_score_list,
            "counts": {
                "overdue":  len(overdue_list),  "upcoming": len(upcoming_list),
                "inactive": len(inactive),       "low_score": len(low_score_list),
            },
        })


class LeaderboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        caller    = request.user
        now       = timezone.now()
        year      = int(request.query_params.get("year",  now.year))
        month     = int(request.query_params.get("month", now.month))
        scores_qs = PerformanceScore.objects.filter(
            company=caller.company, year=year, month=month,
        ).select_related("commercial").order_by("-score")
        if caller.role == "MANAGER" and not caller.is_staff:
            scores_qs = scores_qs.filter(commercial_id__in=_get_manager_team_ids(caller))
        leaderboard = []
        for rank, s in enumerate(scores_qs, start=1):
            badges = CommercialBadge.objects.filter(
                commercial=s.commercial, company=caller.company, year=year, month=month,
            ).values_list("badge_type", flat=True)
            leaderboard.append({
                "rank": rank, "user_id": s.commercial.id, "username": s.commercial.username,
                "score": s.score, "tasks_done": s.tasks_done, "tasks_total": s.tasks_total,
                "opportunities_won": s.opportunities_won, "calls": s.calls_count,
                "penalty_points": s.penalty_points, "badges": list(badges),
            })
        return Response({"year": year, "month": month, "leaderboard": leaderboard})


# ══════════════════════════════════════════════════════════════
# FEEDBACK / GOALS / BADGES
# ══════════════════════════════════════════════════════════════

class ManagerFeedbackViewSet(viewsets.ModelViewSet):
    serializer_class   = ManagerFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        caller = self.request.user
        qs = ManagerFeedback.objects.filter(company=caller.company).select_related("given_by", "commercial")
        if caller.role == "MANAGER" and not caller.is_staff:
            qs = qs.filter(commercial_id__in=_get_manager_team_ids(caller))
        commercial_id = self.request.query_params.get("commercial_id")
        if commercial_id:
            qs = qs.filter(commercial_id=commercial_id)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        caller = self.request.user
        if caller.role not in ("ADMIN", "MANAGER") and not caller.is_staff:
            raise PermissionDenied("Seuls les managers et admins peuvent donner un feedback.")
        if caller.role == "MANAGER" and not caller.is_staff:
            commercial = serializer.validated_data.get("commercial")
            if commercial and commercial.id not in _get_manager_team_ids(caller):
                raise PermissionDenied("Feedback réservé aux commerciaux de votre équipe.")
        serializer.save(given_by=caller, company=caller.company)

    def perform_update(self, serializer):
        if self.get_object().given_by != self.request.user:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres feedbacks.")
        serializer.save()

    def perform_destroy(self, instance):
        caller = self.request.user
        if instance.given_by != caller and caller.role != "ADMIN":
            raise PermissionDenied("Accès refusé.")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="my_feedbacks")
    def my_feedbacks(self, request):
        qs = ManagerFeedback.objects.filter(
            commercial=request.user, company=request.user.company,
        ).select_related("given_by").order_by("-created_at")
        return Response(self.get_serializer(qs, many=True).data)


class PerformanceGoalViewSet(viewsets.ModelViewSet):
    serializer_class   = PerformanceGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        caller = self.request.user
        qs = PerformanceGoal.objects.filter(company=caller.company).select_related("commercial", "created_by")
        if caller.role == "MANAGER" and not caller.is_staff:
            qs = qs.filter(commercial_id__in=_get_manager_team_ids(caller))
        if caller.role == "COMMERCIAL":
            qs = qs.filter(commercial=caller)
        commercial_id = self.request.query_params.get("commercial_id")
        if commercial_id:
            qs = qs.filter(commercial_id=commercial_id)
        year  = self.request.query_params.get("year")
        month = self.request.query_params.get("month")
        if year:  qs = qs.filter(year=int(year))
        if month: qs = qs.filter(month=int(month))
        return qs.order_by("-year", "-month", "goal_type")

    def perform_create(self, serializer):
        caller = self.request.user
        if caller.role not in ("ADMIN", "MANAGER") and not caller.is_staff:
            raise PermissionDenied("Seuls les managers et admins peuvent créer des objectifs.")
        if caller.role == "MANAGER" and not caller.is_staff:
            commercial = serializer.validated_data.get("commercial")
            if commercial and commercial.id not in _get_manager_team_ids(caller):
                raise PermissionDenied("Objectif réservé aux commerciaux de votre équipe.")
        serializer.save(created_by=caller, company=caller.company)

    @action(detail=False, methods=["get"], url_path="my_goals")
    def my_goals(self, request):
        now   = timezone.now()
        year  = int(request.query_params.get("year",  now.year))
        month = int(request.query_params.get("month", now.month))
        qs = PerformanceGoal.objects.filter(
            commercial=request.user, company=request.user.company, year=year, month=month,
        )
        return Response(self.get_serializer(qs, many=True).data)


class CommercialBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = CommercialBadgeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        caller = self.request.user
        qs = CommercialBadge.objects.filter(company=caller.company).select_related("commercial")
        if caller.role == "MANAGER" and not caller.is_staff:
            qs = qs.filter(commercial_id__in=_get_manager_team_ids(caller))
        if caller.role == "COMMERCIAL":
            qs = qs.filter(commercial=caller)
        commercial_id = self.request.query_params.get("commercial_id")
        if commercial_id:
            qs = qs.filter(commercial_id=commercial_id)
        year  = self.request.query_params.get("year")
        month = self.request.query_params.get("month")
        if year:  qs = qs.filter(year=int(year))
        if month: qs = qs.filter(month=int(month))
        return qs.order_by("-awarded_at")

    @action(detail=False, methods=["get"], url_path="my_badges")
    def my_badges(self, request):
        qs = CommercialBadge.objects.filter(
            commercial=request.user, company=request.user.company,
        ).order_by("-awarded_at")
        return Response(self.get_serializer(qs, many=True).data)


# ══════════════════════════════════════════════════════════════
# PIPELINE STAGE TASK
# ══════════════════════════════════════════════════════════════

class PipelineStageTaskViewSet(viewsets.ModelViewSet):
    serializer_class   = PipelineStageTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = PipelineStageTask.objects.filter(company=self.request.user.company)
        stage_id = self.request.query_params.get("stage_id")
        if stage_id:
            qs = qs.filter(stage_id=stage_id)
        return qs.order_by("stage", "order")

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ("ADMIN", "MANAGER") and not user.is_staff:
            raise PermissionDenied("Seuls les admins/managers peuvent créer des templates.")
        stage = serializer.validated_data.get("stage")
        if stage and stage.company != user.company:
            raise PermissionDenied("Cette étape n'appartient pas à votre société.")
        serializer.save(company=user.company)

    def perform_update(self, serializer):
        if self.request.user.role not in ("ADMIN", "MANAGER") and not self.request.user.is_staff:
            raise PermissionDenied("Permission refusée.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ("ADMIN", "MANAGER") and not self.request.user.is_staff:
            raise PermissionDenied("Permission refusée.")
        instance.delete()

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        user = request.user
        if user.role not in ("ADMIN", "MANAGER") and not user.is_staff:
            raise PermissionDenied("Permission refusée.")
        stage_id = request.data.get("stage_id")
        tasks    = request.data.get("tasks", [])
        if not stage_id:
            return Response({"error": "stage_id requis."}, status=400)
        try:
            stage = PipelineStage.objects.get(id=stage_id, company=user.company)
        except PipelineStage.DoesNotExist:
            return Response({"error": "Étape introuvable."}, status=404)
        created = [
            PipelineStageTask.objects.create(
                stage=stage, title=t.get("title", ""), description=t.get("description", ""),
                order=t.get("order", 0), priority=t.get("priority", "medium"),
                due_days_after_entry=t.get("due_days_after_entry", 2), company=user.company,
            ) for t in tasks
        ]
        return Response(PipelineStageTaskSerializer(created, many=True).data, status=201)


# ══════════════════════════════════════════════════════════════
# PIPELINE VIEWSET
# ══════════════════════════════════════════════════════════════

class PipelineViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return PipelineListSerializer if self.action == "list" else PipelineSerializer

    def get_queryset(self):
        user = self.request.user
        qs   = Pipeline.objects.filter(company=user.company).prefetch_related("stages")
        is_active     = self.request.query_params.get("is_active")
        pipeline_type = self.request.query_params.get("pipeline_type")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        if pipeline_type:
            qs = qs.filter(pipeline_type=pipeline_type)
        return qs.order_by("name")

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ("ADMIN", "MANAGER") and not user.is_staff:
            raise PermissionDenied("Seuls les admins et managers peuvent créer un pipeline.")
        serializer.save(company=user.company, created_by=user)

    def perform_update(self, serializer):
        if self.request.user.role not in ("ADMIN", "MANAGER") and not self.request.user.is_staff:
            raise PermissionDenied("Permission refusée.")
        serializer.save()

    @action(detail=True, methods=["get"], url_path="kanban")
    def kanban(self, request, pk=None):
        pipeline = self.get_object()
        user     = request.user
        result   = []

        for stage in pipeline.stages.order_by("order"):
            op_qs = OpportunityPipeline.objects.filter(
                pipeline=pipeline, current_stage=stage, company=user.company,
            ).select_related("opportunity__assigned_to")
            if not _is_company_admin(user):
                op_qs = op_qs.filter(opportunity__assigned_to__in=get_visible_users(user))

            ops_data = []
            for op in op_qs:
                opp       = op.opportunity
                all_tasks = Task.objects.filter(
                    opportunity=opp,
                    company=user.company,
                    assigned_to__in=get_visible_users(user),
                ).exclude(status="cancelled")
                total     = all_tasks.count()
                done      = all_tasks.filter(status="done").count()
                overdue   = all_tasks.filter(status__in=["todo", "in_progress"], due_date__lt=timezone.now()).count()
                blocking  = list(all_tasks.exclude(status="done").values("id", "title", "status", "priority", "due_date"))
                ops_data.append({
                    "id":                      op.id,
                    "opportunity":             opp.id,
                    "opportunity_name":        opp.name,
                    "opportunity_amount":      str(opp.amount),
                    "opportunity_assigned_to": {"id": opp.assigned_to.id, "username": opp.assigned_to.username} if opp.assigned_to else None,
                    "status":                  op.status,
                    "progression":             op.progression,
                    "time_metrics":            op.get_time_metrics(),
                    "alerts_count":            op.alerts.filter(is_resolved=False).count(),
                    "current_stage":           stage.id,
                    "tasks_summary":           {"total": total, "done": done, "pending": total - done, "overdue": overdue, "completion_pct": round((done / total) * 100, 1) if total else 0},
                    "stage_completion":        {"can_advance": len(blocking) == 0, "blocking_tasks": blocking, "completed": done, "total": total, "completion_pct": round((done / total) * 100, 1) if total else 100},
                })
            result.append({
                "stage_id":          stage.id,
                "stage_name":        stage.name,
                "stage_color":       stage.color_hex,
                "stage_order":       stage.order,
                "max_duration_days": stage.max_duration_days,
                "is_terminal":       stage.is_terminal,
                "is_won":            stage.is_won,
                "task_templates":    PipelineStageTaskSerializer(stage.task_templates.all(), many=True).data,
                "count":             len(ops_data),
                "total_value":       sum(float(o["opportunity_amount"] or 0) for o in ops_data),
                "opportunities":     ops_data,
            })

        return Response({
            "pipeline_id":   pipeline.id,
            "pipeline_name": pipeline.name,
            "pipeline_type": pipeline.pipeline_type,
            "stages":        result,
        })

    @action(detail=True, methods=["get"], url_path="analytics")
    def analytics(self, request, pk=None):
        pipeline = self.get_object()
        user     = request.user
        op_qs    = OpportunityPipeline.objects.filter(
            pipeline=pipeline, company=user.company,
        ).select_related("current_stage", "opportunity")
        if not _is_company_admin(user):
            op_qs = op_qs.filter(opportunity__assigned_to__in=get_visible_users(user))

        total       = op_qs.count()
        total_value = op_qs.aggregate(v=Sum("opportunity__amount"))["v"] or 0
        by_stage    = []
        prev_count  = None

        for stage in pipeline.stages.order_by("order"):
            count = op_qs.filter(current_stage=stage).count()
            value = op_qs.filter(current_stage=stage).aggregate(v=Sum("opportunity__amount"))["v"] or 0
            avg_d = StageHistory.objects.filter(
                opportunity_pipeline__pipeline=pipeline, to_stage=stage,
                company=user.company, duration_in_stage_hours__isnull=False,
            ).aggregate(avg=Avg("duration_in_stage_hours"))["avg"]
            by_stage.append({
                "stage_id":             stage.id,
                "stage_name":           stage.name,
                "stage_color":          stage.color_hex,
                "stage_order":          stage.order,
                "count":                count,
                "value":                float(value),
                "conversion_from_prev": round((count / prev_count) * 100, 1) if prev_count else None,
                "avg_duration_hours":   round(avg_d, 1) if avg_d else None,
            })
            prev_count = count

        return Response({
            "pipeline_id":           pipeline.id,
            "pipeline_name":         pipeline.name,
            "total_opportunities":   total,
            "total_value":           float(total_value),
            "by_stage":              by_stage,
            "by_status":             {k: {"label": l, "count": op_qs.filter(status=k).count()} for k, l in OpportunityPipeline.STATUS_CHOICES},
            "blocked_opportunities": op_qs.filter(status="blocked").count(),
        })


# ══════════════════════════════════════════════════════════════
# PIPELINE STAGE
# ══════════════════════════════════════════════════════════════

class PipelineStageViewSet(viewsets.ModelViewSet):
    serializer_class   = PipelineStageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = PipelineStage.objects.filter(company=self.request.user.company)
        pipeline_id = self.request.query_params.get("pipeline_id")
        if pipeline_id:
            qs = qs.filter(pipeline_id=pipeline_id)
        return qs.order_by("pipeline", "order")

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in ("ADMIN", "MANAGER") and not user.is_staff:
            raise PermissionDenied("Permission refusée.")
        pipeline = serializer.validated_data.get("pipeline")
        if pipeline and pipeline.company != user.company:
            raise PermissionDenied("Ce pipeline n'appartient pas à votre société.")
        serializer.save(company=user.company)

    def perform_update(self, serializer):
        if self.request.user.role not in ("ADMIN", "MANAGER") and not self.request.user.is_staff:
            raise PermissionDenied("Permission refusée.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ("ADMIN",) and not self.request.user.is_staff:
            raise PermissionDenied("Seul un admin peut supprimer une étape.")
        if instance.pipeline_opportunities.exists():
            raise ValidationError("Impossible de supprimer une étape contenant des opportunités.")
        instance.delete()


# ══════════════════════════════════════════════════════════════
# OPPORTUNITY PIPELINE VIEWSET
# ══════════════════════════════════════════════════════════════

class OpportunityPipelineViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return OpportunityPipelineDetailSerializer
        if self.action == "list":
            return OpportunityPipelineListSerializer
        return OpportunityPipelineSerializer

    def get_queryset(self):
        user = self.request.user
        qs   = OpportunityPipeline.objects.filter(
            company=user.company
        ).select_related("opportunity__assigned_to", "pipeline", "current_stage")
        if not _is_company_admin(user):
            qs = qs.filter(opportunity__assigned_to__in=get_visible_users(user))
        for param, field in [("pipeline_id", "pipeline_id"), ("stage_id", "current_stage_id"), ("status", "status")]:
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        assigned = self.request.query_params.get("assigned_to")
        if assigned:
            qs = _filter_assigned_to_param(qs, user, assigned, field="opportunity__assigned_to_id")
        return qs.order_by("-updated_at")

    def perform_create(self, serializer):
        user        = self.request.user
        opportunity = serializer.validated_data.get("opportunity")
        pipeline    = serializer.validated_data.get("pipeline")

        if opportunity and opportunity.company != user.company:
            raise PermissionDenied("Cette opportunité n'appartient pas à votre société.")
        if pipeline and pipeline.company != user.company:
            raise PermissionDenied("Ce pipeline n'appartient pas à votre société.")

        current_stage = serializer.validated_data.get("current_stage")
        if not current_stage and pipeline:
            current_stage = pipeline.stages.order_by("order").first()
            serializer.validated_data["current_stage"] = current_stage

        if opportunity and not user_can_access_user(user, opportunity.assigned_to):
            raise PermissionDenied("Cette opportunite n'est pas dans votre perimetre.")

        op_pipeline = serializer.save(company=user.company, stage_entered_at=timezone.now())
        op_pipeline.refresh_computed_fields()

        StageHistory.objects.create(
            opportunity_pipeline=op_pipeline,
            from_stage=None,
            to_stage=op_pipeline.current_stage,
            action="entered",
            performed_by=user,
            notes="Ajout au pipeline",
            company=user.company,
        )

        # ✅ Créer les tâches templates de la première étape
        if current_stage and not current_stage.is_terminal:
            _create_stage_tasks(op_pipeline, current_stage, user)

    @action(detail=True, methods=["post"], url_path="move-stage")
    def move_stage(self, request, pk=None):
        """
        ✅ Déplace une opportunité vers une nouvelle étape pipeline (PIPELINE → CRM).
        Met à jour le stage CRM de l'opportunité en même temps.
        Crée les tâches templates de la nouvelle étape.
        Gère le blocage semi-fort (force=true pour passer malgré tâches ouvertes).
        """
        op_pipeline = self.get_object()
        user        = request.user
        opp         = op_pipeline.opportunity

        can_move = _is_company_admin(user) or user_can_access_user(user, opp.assigned_to)
        if not can_move:
            raise PermissionDenied("Vous ne pouvez pas déplacer cette opportunité.")

        stage_id = request.data.get("stage_id")
        notes    = request.data.get("notes", "")
        force    = request.data.get("force", False)

        if not stage_id:
            return Response({"error": "stage_id est requis."}, status=400)

        try:
            new_stage = PipelineStage.objects.get(
                id=stage_id, pipeline=op_pipeline.pipeline, company=user.company,
            )
        except PipelineStage.DoesNotExist:
            return Response({"error": "Étape introuvable dans ce pipeline."}, status=404)

        # ── Vérification tâches bloquantes ───────────────────
        blocking_list = list(
            Task.objects.filter(opportunity=opp, company=user.company, assigned_to__in=get_visible_users(user))
            .exclude(status__in=["done", "cancelled"])
            .values("id", "title", "status", "priority")
        )
        if blocking_list and not force:
            return Response({
                "warning":        True,
                "message":        f"{len(blocking_list)} tâche(s) non terminée(s). Passez force=true pour confirmer.",
                "blocking_tasks": blocking_list,
                "can_force":      True,
            }, status=422)

        # ── Déplacement ──────────────────────────────────────
        old_stage      = op_pipeline.current_stage
        now            = timezone.now()
        duration_hours = None
        if op_pipeline.stage_entered_at:
            duration_hours = round((now - op_pipeline.stage_entered_at).total_seconds() / 3600, 2)

        if old_stage and new_stage.order > old_stage.order:
            action_type = "moved_forward"
        elif old_stage and new_stage.order < old_stage.order:
            action_type = "moved_backward"
        else:
            action_type = "entered"
        if new_stage.is_terminal:
            action_type = "won" if new_stage.is_won else "lost"

        # ✅ Mise à jour du stage CRM selon la position pipeline
        # ✅ Lire le crm_stage directement sur l'étape pipeline
        if new_stage.is_terminal:
            new_crm_stage = "won" if new_stage.is_won else "lost"
        elif new_stage.crm_stage and new_stage.crm_stage != "none":
            new_crm_stage = new_stage.crm_stage
        else:
            # Étape personnalisée sans crm_stage défini → garder le stage actuel
            new_crm_stage = opp.stage

        # Appliquer le stage CRM si différent
        if opp.stage != new_crm_stage:
            opp.stage = new_crm_stage
            opp.save(update_fields=["stage", "updated_at"])

        # ── Résoudre les alertes existantes ──────────────────
        PipelineAlert.objects.filter(
            opportunity_pipeline=op_pipeline,
            is_resolved=False,
        ).update(is_resolved=True)

        # ── Mise à jour pipeline ──────────────────────────────
        op_pipeline.current_stage    = new_stage
        op_pipeline.stage_entered_at = now
        op_pipeline.save(update_fields=["current_stage", "stage_entered_at", "updated_at"])
        op_pipeline.refresh_computed_fields()

        history_notes = notes
        if blocking_list and force:
            history_notes = f"{notes + ' | ' if notes else ''}⚠ Forcé avec {len(blocking_list)} tâche(s) non terminée(s)."

        StageHistory.objects.create(
            opportunity_pipeline=op_pipeline,
            from_stage=old_stage,
            to_stage=new_stage,
            action=action_type,
            performed_by=user,
            notes=history_notes,
            duration_in_stage_hours=duration_hours,
            company=user.company,
        )

        # ✅ Créer les tâches templates de la nouvelle étape
        created_tasks = []
        if not new_stage.is_terminal:
            created_tasks = _create_stage_tasks(op_pipeline, new_stage, user)

        _generate_pipeline_alerts(op_pipeline)
        op_pipeline.refresh_from_db()

        return Response({
            "op_pipeline":       OpportunityPipelineDetailSerializer(op_pipeline, context={"request": request}).data,
            "tasks_created":     len(created_tasks),
            "forced":            bool(blocking_list and force),
            "warning_tasks":     blocking_list if force else [],
            "crm_stage_updated": new_crm_stage,
        }, status=200)

    @action(detail=True, methods=["post"], url_path="complete-task")
    def complete_task(self, request, pk=None):
        """
        ✅ Valide ou invalide une tâche directement depuis le Kanban pipeline.
        POST /api/sales/opportunity-pipelines/{id}/complete-task/
        Body : { task_id: int, status: "done"|"todo" }
        Retourne les nouvelles stats tâches + statut pipeline mis à jour.
        """
        op_pipeline = self.get_object()
        task_id     = request.data.get("task_id")
        new_status  = request.data.get("status", "done")

        if not task_id:
            return Response({"error": "task_id est requis."}, status=400)

        if new_status not in ("done", "todo", "in_progress", "cancelled"):
            return Response({"error": "Statut invalide."}, status=400)

        try:
            task = Task.objects.get(
                id=task_id,
                opportunity=op_pipeline.opportunity,
                company=op_pipeline.company,
                assigned_to__in=get_visible_users(user),
            )
        except Task.DoesNotExist:
            return Response({"error": "Tâche introuvable."}, status=404)

        user     = request.user
        can_edit = (
            _is_company_admin(user)
            or user_can_access_user(user, task.assigned_to)
        )
        if not can_edit:
            raise PermissionDenied("Vous ne pouvez pas modifier cette tâche.")

        old_status  = task.status
        task.status = new_status

        if new_status == "done" and not task.closed_at:
            task.closed_at = timezone.now()
        elif new_status != "done":
            task.closed_at = None

        task.save(update_fields=["status", "closed_at", "updated_at"])

        # Enregistrer l'activité
        TaskActivity.objects.create(
            task=task,
            activity_type="status_change",
            performed_by=user,
            notes=f"Statut modifié depuis le Kanban Pipeline : {old_status} → {new_status}",
        )

        # Recalculer le statut pipeline
        op_pipeline.refresh_computed_fields()
        _generate_pipeline_alerts(op_pipeline)
        op_pipeline.refresh_from_db()

        # Stats tâches mises à jour
        all_tasks = Task.objects.filter(
            opportunity=op_pipeline.opportunity,
            company=op_pipeline.company,
            assigned_to__in=get_visible_users(user),
        ).exclude(status="cancelled")
        total    = all_tasks.count()
        done_cnt = all_tasks.filter(status="done").count()
        blocking = list(all_tasks.exclude(status="done").values("id", "title", "status", "priority", "due_date"))

        return Response({
            "task_id":       task.id,
            "new_status":    task.status,
            "pipeline_status": op_pipeline.status,
            "stage_completion": {
                "can_advance":    len(blocking) == 0,
                "blocking_tasks": blocking,
                "completed":      done_cnt,
                "total":          total,
                "completion_pct": round((done_cnt / total) * 100, 1) if total > 0 else 100,
            },
            "tasks_summary": {
                "total":          total,
                "done":           done_cnt,
                "pending":        total - done_cnt,
                "completion_pct": round((done_cnt / total) * 100, 1) if total > 0 else 0,
            },
        })

    @action(detail=True, methods=["get"], url_path="tasks")
    def tasks(self, request, pk=None):
        """
        ✅ Récupère toutes les tâches liées à une OpportunityPipeline.
        GET /api/sales/opportunity-pipelines/{id}/tasks/
        Utilisé par le Kanban pour afficher et gérer les tâches inline dans chaque carte.
        """
        op_pipeline = self.get_object()
        tasks_qs    = Task.objects.filter(
            opportunity=op_pipeline.opportunity,
            company=op_pipeline.company,
            assigned_to__in=get_visible_users(request.user),
        ).select_related("assigned_to", "created_by").order_by("status", "-created_at")

        return Response(TaskSerializer(tasks_qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        op_pipeline = self.get_object()
        history = op_pipeline.history.select_related("from_stage", "to_stage", "performed_by").order_by("created_at")
        return Response(StageHistorySerializer(history, many=True).data)

    @action(detail=True, methods=["post"], url_path="refresh-status")
    def refresh_status(self, request, pk=None):
        op_pipeline = self.get_object()
        op_pipeline.refresh_computed_fields()
        _generate_pipeline_alerts(op_pipeline)
        op_pipeline.refresh_from_db()
        return Response(OpportunityPipelineDetailSerializer(op_pipeline, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="blocked")
    def blocked(self, request):
        qs = self.get_queryset().filter(status__in=["blocked", "delayed"])
        return Response(OpportunityPipelineListSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="bulk-refresh")
    def bulk_refresh(self, request):
        if request.user.role not in ("ADMIN",) and not request.user.is_staff:
            raise PermissionDenied("Réservé aux admins.")
        qs = OpportunityPipeline.objects.filter(
            company=request.user.company,
        ).exclude(current_stage__is_terminal=True)
        count = 0
        for op in qs:
            op.refresh_computed_fields()
            _generate_pipeline_alerts(op)
            count += 1
        return Response({"refreshed": count})


# ══════════════════════════════════════════════════════════════
# PIPELINE ALERT
# ══════════════════════════════════════════════════════════════

class PipelineAlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = PipelineAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs   = PipelineAlert.objects.filter(company=user.company).select_related(
            "opportunity_pipeline__opportunity", "assigned_to",
        )
        if not _is_company_admin(user):
            visible_users = get_visible_users(user)
            qs = qs.filter(
                Q(assigned_to__in=visible_users)
                | Q(opportunity_pipeline__opportunity__assigned_to__in=visible_users)
            ).distinct()
        for param, field in [("is_read", "is_read"), ("is_resolved", "is_resolved"), ("severity", "severity")]:
            val = self.request.query_params.get(param)
            if val is not None:
                qs = qs.filter(**{field: val.lower() == "true"}) if param in ("is_read", "is_resolved") else qs.filter(**{field: val})
        return qs.order_by("-created_at")

    @action(detail=True, methods=["patch"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        a = self.get_object()
        a.is_read = True
        a.save(update_fields=["is_read"])
        return Response({"status": "read"})

    @action(detail=True, methods=["patch"], url_path="resolve")
    def resolve(self, request, pk=None):
        a = self.get_object()
        a.is_resolved = True
        a.is_read     = True
        a.save(update_fields=["is_resolved", "is_read"])
        return Response({"status": "resolved"})

    @action(detail=False, methods=["patch"], url_path="mark-all-read")
    def mark_all_read(self, request):
        user = request.user
        qs   = PipelineAlert.objects.filter(company=user.company, is_read=False)
        if not _is_company_admin(user):
            visible_users = get_visible_users(user)
            qs = qs.filter(
                Q(assigned_to__in=visible_users)
                | Q(opportunity_pipeline__opportunity__assigned_to__in=visible_users)
            ).distinct()
        return Response({"marked_read": qs.update(is_read=True)})

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        user = request.user
        qs   = PipelineAlert.objects.filter(company=user.company, is_resolved=False)
        if not _is_company_admin(user):
            visible_users = get_visible_users(user)
            qs = qs.filter(
                Q(assigned_to__in=visible_users)
                | Q(opportunity_pipeline__opportunity__assigned_to__in=visible_users)
            ).distinct()
        return Response({
            "total_unread":     qs.filter(is_read=False).count(),
            "total_unresolved": qs.count(),
            "critical":         qs.filter(severity="critical").count(),
            "warning":          qs.filter(severity="warning").count(),
            "recent":           PipelineAlertSerializer(qs.order_by("-created_at")[:5], many=True).data,
        })
