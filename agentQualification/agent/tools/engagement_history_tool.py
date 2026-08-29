from agentQualification.agent.tools.interaction_normalizer import normalize_interaction


def list_engagement_logs(prospect, limit=100):
    logs = prospect.engagement_logs.select_related("user").order_by("-created_at")[:limit]
    return [
        {
            "id": log.id,
            "action": log.action,
            "channel": log.channel or "",
            "message": log.message or "",
            "status": log.status,
            "error": log.error or log.error_message or "",
            "sent_at": log.sent_at,
            "created_at": log.created_at,
            "sender_email": log.sender_email or "",
            "provider": log.provider or "",
        }
        for log in logs
    ]


def extract_engagement_interactions(activities, engagement_logs):
    interactions = []
    linked_engagement_log_ids = set()
    for activity in activities:
        metadata = activity.get("metadata") or {}
        if metadata.get("engagement_log_id"):
            linked_engagement_log_ids.add(metadata.get("engagement_log_id"))

        if metadata.get("kind") == "engagement_interaction":
            interactions.append(
                normalize_interaction(
                    source="ProspectActivity",
                    object_id=activity.get("id"),
                    action=metadata.get("action_type") or activity.get("activity_type"),
                    channel=metadata.get("channel") or activity.get("channel"),
                    message=metadata.get("generated_content_reference") or activity.get("description") or "",
                    response=metadata.get("prospect_response") or "",
                    note=metadata.get("commercial_notes") or "",
                    outcome=metadata.get("outcome") or "",
                    created_at=activity.get("created_at"),
                    extra={
                        "activity_type": activity.get("activity_type"),
                        "metadata": metadata,
                    },
                )
            )
        elif activity.get("activity_type") in {"message_sent", "email_sent", "reply_received", "call_done"}:
            interactions.append(
                normalize_interaction(
                    source="ProspectActivity",
                    object_id=activity.get("id"),
                    action=activity.get("activity_type"),
                    channel=activity.get("channel"),
                    message=activity.get("description") or "",
                    response=activity.get("description") if activity.get("activity_type") == "reply_received" else "",
                    note=activity.get("description") if activity.get("activity_type") == "call_done" else "",
                    outcome=activity.get("activity_type"),
                    created_at=activity.get("created_at"),
                    extra={
                        "activity_type": activity.get("activity_type"),
                        "metadata": metadata,
                    },
                )
            )

    for log in engagement_logs:
        if log.get("id") in linked_engagement_log_ids:
            continue
        if log.get("action") in {"message_sent", "replied", "message_generated", "follow_up_created"}:
            interactions.append(
                normalize_interaction(
                    source="EngagementLog",
                    object_id=log.get("id"),
                    action=log.get("action"),
                    channel=log.get("channel"),
                    message=log.get("message") or "",
                    response=log.get("message") if log.get("action") == "replied" else "",
                    note="",
                    outcome=log.get("status"),
                    created_at=log.get("sent_at") or log.get("created_at"),
                    extra={
                        "status": log.get("status"),
                        "provider": log.get("provider") or "",
                        "sender_email": log.get("sender_email") or "",
                    },
                )
            )

    unique = []
    seen = set()
    for item in interactions:
        signature = (
            item.get("source"),
            item.get("object_id"),
            item.get("created_at"),
            item.get("interaction_type"),
        )
        if signature in seen:
            continue
        seen.add(signature)
        unique.append(item)

    return sorted(unique, key=lambda item: str(item.get("created_at") or ""))
