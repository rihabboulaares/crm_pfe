from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from sales.models import Prospect
from .runner import prepare_engagement, send_prepared_engagement


class PrepareEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        try:
            prospect = Prospect.objects.get(
                pk=prospect_id,
                company=request.user.company,
            )
        except Prospect.DoesNotExist:
            return Response(
                {"success": False, "error": "Prospect introuvable"},
                status=status.HTTP_404_NOT_FOUND,
            )

        scrape = bool(request.data.get("scrape", True))

        result = prepare_engagement(
            prospect=prospect,
            user=request.user,
            scrape=scrape,
        )

        return Response(result)


class SendPreparedEngagementView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prospect_id):
        try:
            prospect = Prospect.objects.get(
                pk=prospect_id,
                company=request.user.company,
            )
        except Prospect.DoesNotExist:
            return Response(
                {"success": False, "error": "Prospect introuvable"},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = send_prepared_engagement(
            prospect=prospect,
            user=request.user,
        )

        return Response(result)