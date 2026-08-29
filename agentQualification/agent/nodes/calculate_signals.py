from agentQualification.agent.scoring import calculate_final_score


def calculate_signals(state):
    ai_result = state.get("ai_result") or {}
    score, breakdown = calculate_final_score(
        state.get("qualification_mode") or "INITIAL",
        state.get("profile_signals") or {},
        ai_result,
    )
    deterministic_score, deterministic_breakdown = calculate_final_score(
        state.get("qualification_mode") or "INITIAL",
        state.get("profile_signals") or {},
        {},
    )
    state["final_score"] = score
    state["deterministic_score"] = deterministic_score
    state["detected_needs"] = ai_result.get("detected_needs") or []
    state["objections"] = ai_result.get("objections") or []
    state["buying_signals"] = ai_result.get("buying_signals") or []
    state["missing_information"] = sorted(
        set((state.get("missing_information") or []) + (ai_result.get("missing_information") or []))
    )
    state["summary"] = ai_result.get("summary") or ""
    state["signal_details"] = {
        "score_breakdown": breakdown,
        "deterministic_breakdown": deterministic_breakdown,
        "profile_signals": state.get("profile_signals") or {},
        "interaction_signals": state.get("interaction_signals") or {},
        "ai_signals": ai_result,
    }
    return state

