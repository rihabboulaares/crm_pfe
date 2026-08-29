from sales.serializers import ProspectSerializer


def serialize_prospect_for_qualification(prospect, request=None):
    data = ProspectSerializer(prospect, context={"request": request}).data
    data.update(
        {
            "company_name": prospect.prospect_company.name if prospect.prospect_company else "",
            "company_sector": getattr(prospect.prospect_company, "sector", "")
            or getattr(prospect.prospect_company, "industry", ""),
            "notes": prospect.notes or "",
            "description": prospect.description or "",
            "source": prospect.source or prospect.origin or prospect.lead_origin,
            "lead_origin": prospect.lead_origin,
            "last_message_sent": prospect.last_message_sent or "",
            "last_reply_text": prospect.last_reply_text or "",
            "reply_summary": prospect.reply_summary or "",
            "reply_sentiment": prospect.reply_sentiment or "",
            "conversation_status": prospect.conversation_status,
        }
    )
    return data

