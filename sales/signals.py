import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import (
    Opportunity, OpportunityPipeline, Pipeline,
    StageHistory, PipelineAlert,
)

logger = logging.getLogger(__name__)

_SYNC_IN_PROGRESS_ATTR = "_pipeline_sync_in_progress"
_CRM_STAGE_ORDER = ["new", "qualified", "proposal", "negotiation"]


def _get_pipeline_stage_for_crm(crm_stage, pipeline):
    """
    Trouve l'étape pipeline dont crm_stage correspond.
    Retourne None si aucune étape n'est configurée pour ce stage CRM.
    """
    if crm_stage in ("won", "lost"):
        return (
            pipeline.stages.filter(crm_stage=crm_stage).first()
            or pipeline.stages.filter(is_terminal=True, is_won=(crm_stage == "won")).first()
        )

    return (
        pipeline.stages
        .filter(crm_stage=crm_stage, is_terminal=False)
        .order_by("order")
        .first()
    )


@receiver(post_save, sender=Opportunity)
def sync_opportunity_stage_to_pipeline(sender, instance, created, update_fields, **kwargs):
    if getattr(instance, _SYNC_IN_PROGRESS_ATTR, False):
        return
    if update_fields is not None and "stage" not in update_fields:
        return
    if created:
        return

    old_stage = getattr(instance, "_old_stage", None)
    new_stage = instance.stage
    if old_stage is not None and old_stage == new_stage:
        return

    try:
        op_pipeline = instance.pipeline_data
    except Exception:
        return

    if not op_pipeline or not op_pipeline.pipeline:
        return

    pipeline  = op_pipeline.pipeline
    new_ps = _get_pipeline_stage_for_crm(new_stage, pipeline)

    if not new_ps or new_ps.id == op_pipeline.current_stage_id:
        return

    now = timezone.now()
    duration_hours = None
    if op_pipeline.stage_entered_at:
        duration_hours = round(
            (now - op_pipeline.stage_entered_at).total_seconds() / 3600, 2
        )

    old_ps = op_pipeline.current_stage

    if new_ps.is_terminal:
        action = "won" if new_ps.is_won else "lost"
    elif old_ps and new_ps.order > old_ps.order:
        action = "moved_forward"
    elif old_ps and new_ps.order < old_ps.order:
        action = "moved_backward"
    else:
        action = "entered"

    PipelineAlert.objects.filter(
        opportunity_pipeline=op_pipeline, is_resolved=False
    ).update(is_resolved=True)

    op_pipeline.current_stage    = new_ps
    op_pipeline.stage_entered_at = now
    op_pipeline.save(update_fields=["current_stage", "stage_entered_at", "updated_at"])
    op_pipeline.refresh_computed_fields()

    StageHistory.objects.create(
        opportunity_pipeline=op_pipeline,
        from_stage=old_ps,
        to_stage=new_ps,
        action=action,
        performed_by=None,
        notes=f"Signal post_save : {old_stage} → {new_stage}",
        duration_in_stage_hours=duration_hours,
        company=op_pipeline.company,
    )

    logger.info("[SIGNAL] Synchro pipeline : opp=%s %s→%s", instance.id, old_stage, new_stage)