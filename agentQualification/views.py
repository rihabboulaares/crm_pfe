import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from agentEngagement.permissions import get_engagement_queryset_for_user

from .agent.qualification_runtime import QualificationRuntime
from .models import ProspectQualification
from .serializers import ProspectQualificationSerializer

logger = logging.getLogger("agentQualification.views")


def get_allowed_prospect(user, prospect_id):
    return get_engagement_queryset_for_user(user).filter(pk=prospect_id).first()


def unauthorized_response():
    return Response({"detail": "Vous n'avez pas accès à ce prospect."}, status=status.HTTP_403_FORBIDDEN)


class ProspectQualificationRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_response()
        try:
            result = QualificationRuntime().run(prospect=prospect, user=request.user, request=request)
        except Exception:
            logger.exception("Qualification run failed prospect=%s user=%s", prospect_id, request.user.id)
            return Response(
                {"message": "La qualification n'a pas pu être terminée pour le moment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(result, status=status.HTTP_201_CREATED)


class ProspectQualificationLatestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_response()
        qualification = prospect.qualifications.order_by("-created_at").first()
        if not qualification:
            return Response({"detail": "Aucune qualification enregistrée."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProspectQualificationSerializer(qualification).data)


class ProspectQualificationHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, prospect_id):
        prospect = get_allowed_prospect(request.user, prospect_id)
        if not prospect:
            return unauthorized_response()
        qs = prospect.qualifications.order_by("-created_at")[:100]
        return Response({"results": ProspectQualificationSerializer(qs, many=True).data})


class QualificationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, qualification_id):
        qualification = ProspectQualification.objects.select_related("prospect", "created_by").filter(
            pk=qualification_id
        ).first()
        if not qualification:
            return Response({"detail": "Qualification introuvable."}, status=status.HTTP_404_NOT_FOUND)
        if not get_allowed_prospect(request.user, qualification.prospect_id):
            return unauthorized_response()
        return Response(ProspectQualificationSerializer(qualification).data)

