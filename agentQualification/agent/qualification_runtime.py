from agentEngagement.permissions import get_engagement_queryset_for_user
from agentQualification.agent.qualification_graph import QualificationGraph
from agentQualification.agent.qualification_state import QualificationState
from agentQualification.models import ProspectQualification
from agentQualification.schemas import QualificationRunResult


class QualificationRuntime:
    def __init__(self, graph=None):
        self.graph = graph or QualificationGraph()

    def _authorize_prospect(self, prospect, user):
        if not prospect or not user:
            raise PermissionError("qualification_prospect_unauthorized")
        allowed = (
            get_engagement_queryset_for_user(user)
            .filter(pk=prospect.id)
            .exists()
        )
        if not allowed:
            raise PermissionError("qualification_prospect_unauthorized")

    def run_by_id(self, prospect_id, user, request=None):
        prospect = get_engagement_queryset_for_user(user).filter(pk=prospect_id).first()
        if not prospect:
            raise PermissionError("qualification_prospect_unauthorized")
        return self.run(prospect, user, request=request)

    def run(self, prospect, user, request=None):
        self._authorize_prospect(prospect, user)
        previous = prospect.qualifications.order_by("-created_at").first()
        state = QualificationState(
            prospect_id=prospect.id,
            user_id=getattr(user, "id", None),
            missing_information=[],
            strengths=[],
            risks=[],
            errors=[],
        )
        state = self.graph.run(state, prospect, user, request=request)
        qualification = ProspectQualification.objects.get(pk=state["qualification_id"])
        previous_score = previous.score if previous else None
        score_delta = qualification.score - previous_score if previous_score is not None else None
        payload = QualificationRunResult(
            qualification_id=qualification.id,
            prospect_id=prospect.id,
            mode=qualification.qualification_mode,
            score=qualification.score,
            previous_score=previous_score,
            score_delta=score_delta,
            deterministic_score=qualification.deterministic_score,
            confidence=qualification.confidence,
            status=qualification.status,
            opportunity_ready=qualification.opportunity_ready,
            recommended_action=qualification.recommended_action,
            strengths=qualification.strengths,
            risks=qualification.risks,
            missing_information=qualification.missing_information,
            detected_needs=qualification.detected_needs,
            objections=qualification.objections,
            buying_signals=qualification.buying_signals,
            summary=qualification.summary,
            signal_details=qualification.signal_details,
        )
        return payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
