from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from asgiref.sync import async_to_sync
from django.utils import timezone
from time import perf_counter

from agentProspection.agent.brain import local_intent_parser
from agentProspection.agent.loop_controller import run_agent
from agentProspection.tenant import get_user_company
from agentEngagement.social.session_manager import check_social_session
from superadmin.audit import create_ai_agent_run, create_audit_log, finish_ai_agent_run


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

        started_at = timezone.now()
        started_timer = perf_counter()
        run_log = create_ai_agent_run(
            agent_type="prospection",
            company=company,
            launched_by=user,
            query=query,
            status="running",
            started_at=started_at,
        )
        create_audit_log(
            actor=user,
            company=company,
            action="launch_agent",
            module="ai_agents",
            object_id=getattr(run_log, "id", None),
            object_repr="Agent prospection",
            description="Lancement agent IA de prospection",
            metadata={"query": query},
        )

        try:
            result = async_to_sync(run_agent)(
                query=query,
                tenant_company_id=company.id,
                user_id=user.id,
            )
        except Exception as exc:
            finish_ai_agent_run(
                run_log,
                status="failed",
                error_message=str(exc)[:500],
                duration_seconds=round(perf_counter() - started_timer, 2),
            )
            create_audit_log(
                actor=user,
                company=company,
                action="system_error",
                module="ai_agents",
                object_id=getattr(run_log, "id", None),
                object_repr="Agent prospection",
                description="Erreur pendant la prospection IA",
                metadata={"error": str(exc)[:500]},
            )
            return Response(
                {
                    "success": False,
                    "message": "Erreur pendant la prospection",
                    "error": "agent_execution_failed",
                    "details": str(exc)[:500],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        companies_found = int(result.get("companies_found") or 0)
        persons_found = int(result.get("persons_found") or 0)
        import_stats = result.get("import_stats") or {}
        source_counts = {
            "source_google_maps": 0,
            "source_linkedin": 0,
            "source_facebook": 0,
            "source_instagram": 0,
            "source_website": 0,
        }
        for item in (result.get("prospect_companies") or []) + (result.get("prospect_persons") or []):
            source = str(item.get("source") or item.get("source_label") or "").lower()
            if "map" in source or "google" in source:
                source_counts["source_google_maps"] += 1
            elif "linkedin" in source:
                source_counts["source_linkedin"] += 1
            elif "facebook" in source:
                source_counts["source_facebook"] += 1
            elif "instagram" in source:
                source_counts["source_instagram"] += 1
            elif "web" in source or item.get("website"):
                source_counts["source_website"] += 1

        errors = result.get("errors") or []
        run_status = "partial" if errors else "success"
        finish_ai_agent_run(
            run_log,
            status=run_status,
            prospects_found=companies_found + persons_found,
            prospects_imported=int(import_stats.get("persons_created") or 0)
            + int(import_stats.get("persons_updated") or 0),
            duration_seconds=round(perf_counter() - started_timer, 2),
            error_message="; ".join(map(str, errors[:3])) if errors else None,
            metadata={
                "stop_reason": result.get("stop_reason"),
                "iterations": result.get("iterations"),
                "import_stats": import_stats,
            },
            **source_counts,
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
