from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from asgiref.sync import async_to_sync

from agentProspection.agent.loop_controller import run_agent
from agentProspection.tenant import get_user_company

class ProspectAgentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user = request.user

        if not user or not user.is_authenticated:
            return Response(
                {
                    "success": False,
                    "message": "Utilisateur non authentifie",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        query = str(request.data.get("query", "")).strip()

        if not query:
            return Response(
                {
                    "success": False,
                    "message": "La requete est obligatoire",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = get_user_company(user)
        if not company:
            return Response(
                {
                    "success": False,
                    "message": "Aucune societe associee a cet utilisateur",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            result = async_to_sync(run_agent)(
                query=query,
                tenant_company_id=company.id,
                user_id=user.id,
            )
        except Exception as exc:
            return Response(
                {
                    "success": False,
                    "message": "Erreur pendant la prospection",
                    "error": "agent_execution_failed",
                    "details": str(exc)[:500],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "message": "Prospection terminee",
                "company_id": company.id,
                **result,
            }
        )
