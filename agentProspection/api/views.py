from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from asgiref.sync import async_to_sync

from agentProspection.agent.brain import local_intent_parser
from agentProspection.agent.loop_controller import run_agent
from agentProspection.tenant import get_user_company
from agentEngagement.social.session_manager import check_social_session


SUPPORTED_SOCIAL_PLATFORMS = {"linkedin", "facebook", "instagram"}


def required_platforms_from_query(query: str) -> set[str]:
    intent = local_intent_parser(query)
    return {
        source
        for source in intent.get("sources", [])
        if source in SUPPORTED_SOCIAL_PLATFORMS
    }


def missing_social_sessions(user_id: int, required: set[str]) -> tuple[list[str], dict]:
    sessions = {}
    missing = []
    for platform in sorted(required):
        result = check_social_session(user_id, platform)
        sessions[platform] = result
        if not result.get("success"):
            missing.append(platform)
    return missing, sessions

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

        required = required_platforms_from_query(query)
        missing, sessions = missing_social_sessions(user.id, required)
        if missing:
            return Response(
                {
                    "success": False,
                    "status": "social_login_required",
                    "missing": missing,
                    "sessions": sessions,
                    "message": "Connectez les reseaux sociaux requis avant de lancer l'agent.",
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


class ProspectingRequiredSessionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user

        if not user or not user.is_authenticated:
            return Response(
                {
                    "success": False,
                    "message": "Utilisateur non authentifie",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.company:
            return Response(
                {
                    "success": False,
                    "message": "Aucune societe associee a cet utilisateur",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        from sales.models import Prospect

        qs = Prospect.objects.filter(company=user.company)
        required = set()

        for prospect in qs[:500]:
            if prospect.linkedin_url:
                required.add("linkedin")
            if prospect.facebook_url:
                required.add("facebook")
            if prospect.instagram_url:
                required.add("instagram")

        results = {}
        missing = []

        for platform in sorted(required):
            result = check_social_session(user.id, platform)
            results[platform] = result
            if not result.get("success"):
                missing.append(platform)

        return Response(
            {
                "success": len(missing) == 0,
                "required": sorted(required),
                "missing": missing,
                "results": results,
            }
        )
