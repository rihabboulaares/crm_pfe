MEANINGFUL_OUTCOMES = {
    "INTERESTED",
    "CALL_LATER",
    "OBJECTION",
    "REQUEST_INFORMATION",
    "MEETING_REQUEST",
    "reply_received",
    "replied",
    "NOT_INTERESTED",
}

MEANINGFUL_TYPES = {
    "REPLY",
    "OBJECTION",
    "INFORMATION_REQUEST",
    "MEETING_REQUEST",
    "INTEREST",
    "REFUSAL",
}

LEGACY_INBOUND_ACTIONS = {
    "reply_received",
    "replied",
}

LEGACY_CALL_ACTIONS = {
    "PHONE_CALL",
    "call_done",
}

OUTBOUND_ONLY_ACTIONS = {
    "EMAIL_SENT",
    "MESSAGE_SENT",
    "SOCIAL_MESSAGE_SENT",
    "message_sent",
    "email_sent",
    "message_generated",
    "follow_up_created",
    "SENT",
}


def _has_text(value):
    return bool(str(value or "").strip())


def has_meaningful_engagement(interaction):
    direction = interaction.get("direction")
    actor = interaction.get("actor")
    interaction_type = interaction.get("interaction_type")
    action_type = interaction.get("action_type")
    outcome = interaction.get("outcome")
    note = interaction.get("note") or interaction.get("commercial_notes")

    if direction == "INBOUND" and actor == "PROSPECT":
        return True
    if interaction_type in MEANINGFUL_TYPES:
        return True
    if outcome in MEANINGFUL_OUTCOMES:
        return True
    if interaction_type == "CALL" and (_has_text(outcome) or _has_text(note)):
        return True
    if _has_text(interaction.get("prospect_response")):
        return True
    if action_type in LEGACY_INBOUND_ACTIONS:
        return True
    if action_type in LEGACY_CALL_ACTIONS and _has_text(note):
        return True
    return False


def analyze_interactions(state):
    interactions = state.get("interactions") or []
    meaningful = [item for item in interactions if has_meaningful_engagement(item)]
    state["qualification_mode"] = "POST_ENGAGEMENT" if meaningful else "INITIAL"
    state["interaction_signals"] = {
        "total_interactions": len(interactions),
        "significant_interactions": len(meaningful),
        "has_prospect_response": any(
            (item.get("direction") == "INBOUND" and item.get("actor") == "PROSPECT")
            or item.get("prospect_response")
            for item in interactions
        ),
        "has_meeting_request": any(
            item.get("interaction_type") == "MEETING_REQUEST" or item.get("outcome") == "MEETING_REQUEST"
            for item in interactions
        ),
        "has_objection": any(
            item.get("interaction_type") == "OBJECTION" or item.get("outcome") == "OBJECTION"
            for item in interactions
        ),
        "has_positive_interest": any(
            item.get("interaction_type") in {"INTEREST", "MEETING_REQUEST"}
            or item.get("outcome") in {"INTERESTED", "MEETING_REQUEST"}
            for item in interactions
        ),
    }
    return state
