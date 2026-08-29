from sales.serializers import ProspectActivitySerializer


def list_prospect_activities(prospect, request=None, limit=100):
    qs = prospect.prospect_activities.select_related("created_by", "agent_run").order_by("-created_at")[:limit]
    return ProspectActivitySerializer(qs, many=True, context={"request": request}).data

