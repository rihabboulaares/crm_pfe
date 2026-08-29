CHANNEL_ALIASES = {
    "EMAIL": "EMAIL",
    "MAIL": "EMAIL",
    "GMAIL": "EMAIL",
    "MICROSOFT": "EMAIL",
    "OUTLOOK": "EMAIL",
    "PHONE": "PHONE",
    "CALL": "PHONE",
    "TEL": "PHONE",
    "TELEPHONE": "PHONE",
    "LINKEDIN": "LINKEDIN",
    "LINKEDIN_DM": "LINKEDIN",
    "FACEBOOK": "FACEBOOK",
    "MESSENGER": "FACEBOOK",
    "INSTAGRAM": "INSTAGRAM",
    "IG": "INSTAGRAM",
}

OUTBOUND_ACTIONS = {
    "EMAIL_SENT",
    "MESSAGE_SENT",
    "SOCIAL_MESSAGE_SENT",
    "message_sent",
    "email_sent",
}

INBOUND_ACTIONS = {
    "REPLY",
    "reply_received",
    "replied",
}

CALL_ACTIONS = {
    "PHONE_CALL",
    "call_done",
}

INTERNAL_NOTE_ACTIONS = {
    "commercial_note",
    "NOTE",
    "message_generated",
    "follow_up_created",
}

OUTCOME_TYPES = {
    "OBJECTION": "OBJECTION",
    "REQUEST_INFORMATION": "INFORMATION_REQUEST",
    "MEETING_REQUEST": "MEETING_REQUEST",
    "INTERESTED": "INTEREST",
    "NOT_INTERESTED": "REFUSAL",
    "WRONG_CONTACT": "REFUSAL",
    "UNSUBSCRIBE": "REFUSAL",
}


def normalize_channel(raw_channel):
    value = str(raw_channel or "").strip().upper().replace("-", "_").replace(" ", "_")
    if not value:
        return "OTHER"
    if value in CHANNEL_ALIASES:
        return CHANNEL_ALIASES[value]
    for key, normalized in CHANNEL_ALIASES.items():
        if key in value:
            return normalized
    return "OTHER"


def _clean(value):
    text = str(value or "").strip()
    return text or None


def _normalize_outcome(outcome):
    return str(outcome or "").strip().upper() or None


def normalize_interaction(
    *,
    source,
    object_id,
    action=None,
    channel=None,
    message=None,
    response=None,
    note=None,
    outcome=None,
    created_at=None,
    extra=None,
):
    action_value = str(action or "").strip()
    outcome_value = _normalize_outcome(outcome)
    response_text = _clean(response)
    message_text = _clean(message)
    note_text = _clean(note)
    normalized_channel = normalize_channel(channel)

    if response_text or action_value in INBOUND_ACTIONS:
        direction = "INBOUND"
        actor = "PROSPECT"
        interaction_type = OUTCOME_TYPES.get(outcome_value, "REPLY")
        content = response_text or message_text
        canonical_note = note_text
    elif action_value in CALL_ACTIONS:
        direction = "INTERNAL"
        actor = "CRM_USER"
        interaction_type = "CALL"
        content = None
        canonical_note = note_text or message_text
    elif action_value in OUTBOUND_ACTIONS:
        direction = "OUTBOUND"
        actor = "CRM_USER"
        interaction_type = "MESSAGE_SENT"
        content = message_text
        canonical_note = note_text
    elif action_value in INTERNAL_NOTE_ACTIONS or note_text:
        direction = "INTERNAL"
        actor = "CRM_USER"
        interaction_type = OUTCOME_TYPES.get(outcome_value, "NOTE")
        content = None
        canonical_note = note_text or message_text
    elif outcome_value in OUTCOME_TYPES:
        direction = "INTERNAL"
        actor = "CRM_USER"
        interaction_type = OUTCOME_TYPES[outcome_value]
        content = None
        canonical_note = note_text or message_text
    else:
        direction = "INTERNAL"
        actor = "SYSTEM"
        interaction_type = "OTHER"
        content = message_text
        canonical_note = note_text

    return {
        "id": f"{str(source).lower()}_{object_id}",
        "object_id": object_id,
        "source": source,
        "direction": direction,
        "actor": actor,
        "channel": normalized_channel,
        "interaction_type": interaction_type,
        "content": content,
        "outcome": outcome_value,
        "note": canonical_note,
        "created_at": created_at,
        **(extra or {}),
    }
