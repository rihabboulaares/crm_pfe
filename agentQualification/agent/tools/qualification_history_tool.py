from agentQualification.serializers import ProspectQualificationSerializer


def latest_qualification(prospect):
    return prospect.qualifications.order_by("-created_at").first()


def serialize_latest_qualification(prospect):
    item = latest_qualification(prospect)
    if not item:
        return None
    return ProspectQualificationSerializer(item).data

