def detect_reply_from_conversation(messages):
    clean_messages = [
        message
        for message in messages or []
        if message.get("sender") in {"me", "prospect"} and (message.get("text") or "").strip()
    ]

    if not clean_messages:
        return {
            "has_reply": False,
            "reply_text": "",
            "conversation_history": [],
        }

    last_me_index = None
    for index, message in enumerate(clean_messages):
        if message.get("sender") == "me":
            last_me_index = index

    if last_me_index is None:
        return {
            "has_reply": False,
            "reply_text": "",
            "conversation_history": clean_messages,
        }

    prospect_replies = [
        message
        for message in clean_messages[last_me_index + 1 :]
        if message.get("sender") == "prospect" and (message.get("text") or "").strip()
    ]

    if not prospect_replies:
        return {
            "has_reply": False,
            "reply_text": "",
            "conversation_history": clean_messages,
        }

    latest_reply = prospect_replies[-1]
    return {
        "has_reply": True,
        "reply_text": latest_reply.get("text", ""),
        "conversation_history": clean_messages,
    }
