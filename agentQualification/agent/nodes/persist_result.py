from agentQualification.models import ProspectQualification


def persist_result(state, prospect, user):
    previous = prospect.qualifications.order_by("-created_at").first()
    snapshot = {
        "profile_signals": state.get("profile_signals") or {},
        "interaction_signals": state.get("interaction_signals") or {},
        "qualification_target": state.get("qualification_target") or {},
        "qualification_mode": state.get("qualification_mode"),
        "activities_count": len(state.get("activities") or []),
        "interactions_count": len(state.get("interactions") or []),
        "previous_qualification_id": previous.id if previous else None,
        "agent_trace": state.get("agent_trace") or [],
        "tool_call_count": state.get("tool_call_count") or 0,
    }
    qualification = ProspectQualification.objects.create(
        prospect=prospect,
        created_by=user,
        qualification_mode=state.get("qualification_mode") or ProspectQualification.MODE_INITIAL,
        score=state.get("final_score") or 0,
        deterministic_score=state.get("deterministic_score") or 0,
        confidence=state.get("confidence") or 0.0,
        status=state.get("status") or ProspectQualification.STATUS_INCOMPLETE,
        opportunity_ready=bool(state.get("opportunity_ready")),
        recommended_action=state.get("recommended_action") or ProspectQualification.ACTION_RETRY,
        strengths=state.get("strengths") or [],
        risks=state.get("risks") or [],
        missing_information=state.get("missing_information") or [],
        detected_needs=state.get("detected_needs") or [],
        objections=state.get("objections") or [],
        buying_signals=state.get("buying_signals") or [],
        summary=state.get("summary") or "",
        signal_details=state.get("signal_details") or {},
        source_snapshot=snapshot,
        error_code=";".join(state.get("errors") or [])[:100],
        error_message="\n".join(state.get("errors") or [])[:4000],
    )
    state["qualification_id"] = qualification.id
    return state
