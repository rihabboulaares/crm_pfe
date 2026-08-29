from datetime import date, datetime
from decimal import Decimal
from time import perf_counter

from asgiref.sync import async_to_sync

from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from agentProspection.agent.loop_controller import run_agent
from agentProspection.models import DiscoveryRun
from agentProspection.services.discovery_report_service import (
    build_report_stats,
    generate_discovery_report,
    sanitize_report_filename,
)
from agentProspection.tenant import get_user_company

from superadmin.audit import (
    create_ai_agent_run,
    create_audit_log,
    finish_ai_agent_run,
)


# ============================================================
# SOURCES
# ============================================================

SOURCE_LABELS = {
    # Meta Ads
    "ads_library_search": "Meta Ads Library",
    "meta_ads_library": "Meta Ads Library",
    "meta_ads": "Meta Ads Library",

    # LinkedIn
    "serper_linkedin": "Serper LinkedIn",
    "linkedin": "Serper LinkedIn",

    # Facebook
    "serper_facebook": "Serper Facebook",
    "facebook": "Serper Facebook",

    # Instagram
    "serper_instagram": "Serper Instagram",
    "instagram": "Serper Instagram",

    # General
    "serper_general": "Serper General",
    "general": "Serper General",

    # Maps
    "google_maps": "Google Maps",
    "maps_search": "Google Maps",
    "maps": "Google Maps",
}


# ============================================================
# HELPERS
# ============================================================

def discovery_source_label(
    value: str | None,
) -> str | None:
    text = str(value or "").strip()

    if not text:
        return None

    key = (
        text
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

    return SOURCE_LABELS.get(
        key,
        text,
    )


def sources_used_from_result(
    result: dict,
) -> list[str]:
    """
    Construit la liste des sources réellement utilisées.

    Exemple :
    [
        "Meta Ads Library",
        "Serper Facebook"
    ]
    """

    labels = []

    # Sources réellement appelées.
    for item in (
        result.get("tool_history")
        or []
    ):
        label = discovery_source_label(
            item.get("tool")
        )

        if (
            label
            and label not in labels
        ):
            labels.append(label)

    # Sources conservées dans les prospects.
    entities = (
        (result.get("prospect_companies") or [])
        +
        (result.get("prospect_persons") or [])
    )

    for item in entities:
        raw_sources = (
            item.get("discovery_sources")
            or item.get("sources")
            or []
        )

        if isinstance(
            raw_sources,
            str,
        ):
            raw_sources = [
                raw_sources
            ]

        values = [
            *raw_sources,
            item.get("source_label"),
            item.get("source"),
        ]

        for source in values:
            label = discovery_source_label(
                source
            )

            if (
                label
                and label not in labels
            ):
                labels.append(
                    label
                )

    return labels


def make_json_safe(value):
    """
    Rend le résultat Discovery sérialisable en JSON.
    """

    if isinstance(
        value,
        dict,
    ):
        return {
            str(key):
                make_json_safe(item)

            for key, item
            in value.items()
        }

    if isinstance(
        value,
        (list, tuple),
    ):
        return [
            make_json_safe(item)
            for item in value
        ]

    if isinstance(
        value,
        set,
    ):
        return [
            make_json_safe(item)
            for item
            in sorted(
                value,
                key=str,
            )
        ]

    if isinstance(
        value,
        (datetime, date),
    ):
        return value.isoformat()

    if isinstance(
        value,
        Decimal,
    ):
        return float(value)

    return value


def safe_count(value) -> int:
    if isinstance(
        value,
        (list, tuple, set, dict),
    ):
        return len(value)

    try:
        return int(value or 0)
    except (
        TypeError,
        ValueError,
    ):
        return 0


def import_stat_count(
    import_stats: dict | None,
    *keys,
) -> int:
    stats = import_stats or {}
    return sum(
        safe_count(
            stats.get(key)
        )
        for key in keys
    )


def calculate_imported_count(
    import_stats: dict | None,
) -> int:
    """
    Nombre total de prospects créés ou mis à jour.

    Companies + Persons.
    """

    return import_stat_count(
        import_stats,
        "companies_created",
        "companies_updated",
        "persons_created",
        "persons_updated",
    )


def format_agent_errors(
    errors,
) -> str:
    """
    Produit un message compact pour les logs d'audit.
    """

    messages = []

    for item in errors or []:
        if isinstance(
            item,
            dict,
        ):
            message = (
                item.get("message")
                or item.get("error")
                or item.get("step")
                or ""
            )
        else:
            message = str(item)

        if message:
            messages.append(
                str(message)[:200]
            )

    return "; ".join(
        messages[:3]
    )


def build_source_counts(
    result: dict,
) -> dict:
    """
    Compteurs compatibles avec les champs actuels
    du système d'audit.
    """

    counters = {
        "source_google_maps": 0,
        "source_linkedin": 0,
        "source_facebook": 0,
        "source_instagram": 0,
        "source_website": 0,
    }

    entities = (
        (result.get("prospect_companies") or [])
        +
        (result.get("prospect_persons") or [])
    )

    for item in entities:
        source = str(
            item.get("source")
            or item.get("source_label")
            or ""
        ).lower()

        if (
            "map" in source
            or "google" in source
        ):
            counters[
                "source_google_maps"
            ] += 1

        elif "linkedin" in source:
            counters[
                "source_linkedin"
            ] += 1

        elif "facebook" in source:
            counters[
                "source_facebook"
            ] += 1

        elif "instagram" in source:
            counters[
                "source_instagram"
            ] += 1

        elif (
            "general" in source
            or "web" in source
            or item.get("website")
        ):
            counters[
                "source_website"
            ] += 1

    return counters


def gemini_failure_http_status(
    result: dict,
) -> int:
    """
    Gemini n'a plus de fallback local.

    Si l'unique appel Gemini échoue :
    - quota -> HTTP 429
    - indisponible -> HTTP 503
    """

    gemini_status = str(
        result.get("gemini_status")
        or result.get("stop_reason")
        or ""
    ).lower()

    if (
        "rate_limit" in gemini_status
        or "429" in gemini_status
        or "quota" in gemini_status
    ):
        return status.HTTP_429_TOO_MANY_REQUESTS

    return status.HTTP_503_SERVICE_UNAVAILABLE


# ============================================================
# DISCOVERY
# ============================================================

class ProspectAgentView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
    ):
        user = request.user

        # ====================================================
        # QUERY
        # ====================================================

        query = str(
            request.data.get(
                "query",
                "",
            )
        ).strip()

        if not query:
            return Response(
                {
                    "success": False,
                    "message":
                        "La requête est obligatoire.",
                    "error":
                        "query_required",
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )

        # ====================================================
        # TENANT
        # ====================================================

        company = get_user_company(
            user
        )

        if not company:
            return Response(
                {
                    "success": False,
                    "message":
                        "Aucune société associée à cet utilisateur.",
                    "error":
                        "company_not_found",
                },
                status=
                    status.HTTP_403_FORBIDDEN,
            )

        # ====================================================
        # OPTIONAL LIMIT
        # ====================================================

        max_results = (
            request.data.get(
                "max_results"
            )
        )

        if max_results is not None:
            try:
                max_results = int(
                    max_results
                )

                max_results = max(
                    1,
                    min(
                        max_results,
                        50,
                    ),
                )

            except (
                TypeError,
                ValueError,
            ):
                return Response(
                    {
                        "success": False,
                        "message":
                            "max_results doit être un entier entre 1 et 50.",
                        "error":
                            "invalid_max_results",
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )

        # ====================================================
        # AUDIT START
        # ====================================================

        started_at = (
            timezone.now()
        )

        started_timer = (
            perf_counter()
        )

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
            object_id=getattr(
                run_log,
                "id",
                None,
            ),
            object_repr=
                "Agent prospection",
            description=
                "Lancement agent IA de prospection",
            metadata={
                "query": query,
                "max_results": max_results,
            },
        )

        # ====================================================
        # RUN AGENT
        # ====================================================

        try:
            result = async_to_sync(
                run_agent
            )(
                query=query,
                tenant_company_id=
                    company.id,
                user_id=user.id,
                max_results=max_results,
            )

        except Exception as exc:
            duration_seconds = round(
                perf_counter()
                - started_timer,
                2,
            )

            finish_ai_agent_run(
                run_log,
                status="failed",
                error_message=
                    str(exc)[:500],
                duration_seconds=
                    duration_seconds,
            )

            create_audit_log(
                actor=user,
                company=company,
                action="system_error",
                module="ai_agents",
                object_id=getattr(
                    run_log,
                    "id",
                    None,
                ),
                object_repr=
                    "Agent prospection",
                description=
                    "Erreur pendant la prospection IA",
                metadata={
                    "error":
                        str(exc)[:500],
                },
            )

            return Response(
                {
                    "success": False,
                    "message":
                        "Erreur interne pendant la prospection.",
                    "error":
                        "agent_execution_failed",
                },
                status=
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        result = make_json_safe(
            result
        )

        # ====================================================
        # GEMINI FAILURE
        # ====================================================

        if not result.get(
            "success",
            True,
        ):
            duration_seconds = round(
                perf_counter()
                - started_timer,
                2,
            )

            error_message = (
                format_agent_errors(
                    result.get(
                        "errors"
                    )
                )
                or str(
                    result.get(
                        "stop_reason"
                    )
                    or "Gemini indisponible"
                )
            )

            finish_ai_agent_run(
                run_log,
                status="failed",
                prospects_found=0,
                prospects_imported=0,
                duration_seconds=
                    duration_seconds,
                error_message=
                    error_message[:500],
                metadata={
                    "stop_reason":
                        result.get(
                            "stop_reason"
                        ),

                    "gemini_status":
                        result.get(
                            "gemini_status"
                        ),

                    "gemini_calls":
                        result.get(
                            "gemini_calls"
                        ),
                },
            )

            http_status = (
                gemini_failure_http_status(
                    result
                )
            )

            if (
                http_status
                == status.HTTP_429_TOO_MANY_REQUESTS
            ):
                message = (
                    "Le quota Gemini est actuellement atteint. "
                    "La recherche n'a pas été lancée afin d'éviter "
                    "des résultats non fiables."
                )
            else:
                message = (
                    "Gemini est actuellement indisponible. "
                    "La recherche n'a pas été lancée."
                )

            return Response(
                {
                    "success": False,
                    "message": message,

                    "error":
                        result.get(
                            "stop_reason"
                        )
                        or "gemini_unavailable",

                    "gemini_status":
                        result.get(
                            "gemini_status"
                        ),

                    "gemini_calls":
                        result.get(
                            "gemini_calls",
                            0,
                        ),

                    # Toujours false :
                    # fallback local supprimé.
                    "gemini_fallback_used":
                        False,
                },
                status=http_status,
            )

        # ====================================================
        # RESULT STATS
        # ====================================================

        raw_results_count = safe_count(
            result.get(
                "raw_results_count",
                0,
            )
        )

        companies_found = safe_count(
            result.get(
                "companies_found"
            )
        )

        persons_found = safe_count(
            result.get(
                "persons_found"
            )
        )

        fallback_valid_count = (
            len(
                result.get(
                    "prospect_companies"
                )
                or []
            )
            +
            len(
                result.get(
                    "prospect_persons"
                )
                or []
            )
        )

        accepted_count = safe_count(
            result.get(
                "current_valid_prospects"
            )
            or (
                companies_found
                + persons_found
            )
            or fallback_valid_count
        )

        rejected_count = safe_count(
            result.get(
                "rejected_results"
            )
        )

        import_stats = (
            result.get(
                "import_stats"
            )
            or {}
        )

        new_count = import_stat_count(
            import_stats,
            "companies_created",
            "persons_created",
        )

        updated_count = import_stat_count(
            import_stats,
            "companies_updated",
            "persons_updated",
        )

        existing_count = import_stat_count(
            import_stats,
            "companies_existing",
            "persons_existing",
            "existing_count",
            "skipped_existing",
        )

        import_failed_count = import_stat_count(
            import_stats,
            "companies_failed",
            "persons_failed",
        )

        imported_count = (
            new_count
            + updated_count
        )

        errors = (
            result.get(
                "errors"
            )
            or []
        )

        sources_used = (
            sources_used_from_result(
                result
            )
        )

        duration_seconds = round(
            perf_counter()
            - started_timer,
            2,
        )

        # ====================================================
        # STATUS
        # ====================================================

        if errors:
            run_status = "partial"
        else:
            run_status = "success"

        # ====================================================
        # REPORT DATA
        # ====================================================

        report_stats = (
            build_report_stats(
                result,
                duration_seconds,
            )
        )

        # ====================================================
        # SAVE DISCOVERY RUN
        # ====================================================

        discovery_run = (
            DiscoveryRun.objects.create(
                company=company,
                launched_by=user,
                query=query,
                status=run_status,
                result_data=result,
                stats=report_stats,
                duration_seconds=
                    duration_seconds,
                started_at=started_at,
                finished_at=
                    timezone.now(),
            )
        )

        # ====================================================
        # AUDIT FINISH
        # ====================================================

        source_counts = (
            build_source_counts(
                result
            )
        )

        finish_ai_agent_run(
            run_log,
            status=run_status,

            prospects_found=
                accepted_count,

            # Correction :
            # entreprises + personnes.
            prospects_imported=
                imported_count,

            duration_seconds=
                duration_seconds,

            error_message=(
                format_agent_errors(
                    errors
                )
                or None
            ),

            metadata={
                "stop_reason":
                    result.get(
                        "stop_reason"
                    ),

                "iterations":
                    result.get(
                        "iterations"
                    ),

                "gemini_status":
                    result.get(
                        "gemini_status"
                    ),

                "gemini_calls":
                    result.get(
                        "gemini_calls"
                    ),

                "import_stats":
                    import_stats,

                "discovery_run_id":
                    discovery_run.id,
            },

            **source_counts,
        )

        # ====================================================
        # RESPONSE FRONTEND
        # ====================================================

        response_payload = {
            "success": True,

            "message":
                "Prospection terminée.",

            "company_id":
                company.id,

            "run_id":
                discovery_run.id,

            "found":
                accepted_count,

            "found_count":
                accepted_count,

            "accepted_count":
                accepted_count,

            "rejected_count":
                rejected_count,

            "imported":
                imported_count,

            "imported_count":
                imported_count,

            "sources_used":
                sources_used,

            "brain_mode":
                "gemini",

            "gemini_status":
                result.get(
                    "gemini_status"
                ),

            "gemini_calls":
                result.get(
                    "gemini_calls",
                    0,
                ),

            "gemini_fallback_used":
                False,

            "stop_reason":
                result.get(
                    "stop_reason"
                ),

            "target_valid_prospects":
                result.get(
                    "target_valid_prospects"
                ),

            "current_valid_prospects":
                result.get(
                    "current_valid_prospects"
                ),

            "target_reached":
                result.get(
                    "target_reached"
                ),

            "prospect_companies":
                result.get(
                    "prospect_companies"
                )
                or [],

            "prospect_persons":
                result.get(
                    "prospect_persons"
                )
                or [],

            "map_prospects":
                result.get(
                    "map_prospects"
                )
                or [],

            "errors":
                errors,

            "report_available":
                True,

            "report_url":
                (
                    f"/api/agent/prospect/"
                    f"{discovery_run.id}/report/"
                ),
        }

        response_payload.update(
            {
                "message": (
                    "Recherche terminee. "
                    f"{accepted_count} prospect(s) valide(s), "
                    f"{imported_count} ajoute(s) ou mis a jour dans le CRM."
                ),
                "raw_results_count": raw_results_count,
                "new_count": new_count,
                "updated_count": updated_count,
                "existing_count": existing_count,
                "import_failed_count": import_failed_count,
            }
        )

        return Response(
            response_payload,
            status=status.HTTP_200_OK,
        )


# ============================================================
# DISCOVERY PDF REPORT
# ============================================================

class ProspectDiscoveryReportView(
    APIView
):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        run_id: int,
    ):
        user = request.user

        company = get_user_company(
            user
        )

        if not company:
            return Response(
                {
                    "success": False,
                    "message":
                        "Aucune société associée à cet utilisateur.",
                },
                status=
                    status.HTTP_403_FORBIDDEN,
            )

        run = (
            DiscoveryRun.objects
            .filter(
                id=run_id,
                company=company,
            )
            .select_related(
                "company",
                "launched_by",
            )
            .first()
        )

        if not run:
            return Response(
                {
                    "success": False,
                    "message":
                        "Rapport introuvable.",
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )

        pdf = (
            generate_discovery_report(
                run
            )
        )

        filename = (
            sanitize_report_filename(
                run.query,
                run.started_at,
            )
        )

        response = HttpResponse(
            pdf,
            content_type=
                "application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'attachment; '
            f'filename="{filename}"'
        )

        return response


# ============================================================
# LEGACY REQUIRED SESSIONS
# ============================================================

class ProspectingRequiredSessionsView(
    APIView
):
    """
    Conservé uniquement pour compatibilité avec
    un éventuel ancien frontend.

    Discovery n'utilise plus Playwright ou sessions sociales.
    """

    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
    ):
        company = get_user_company(
            request.user
        )

        if not company:
            return Response(
                {
                    "success": False,
                    "message":
                        "Aucune société associée à cet utilisateur.",
                },
                status=
                    status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {
                "success": True,
                "required": [],
                "missing": [],
                "results": {},
                "message":
                    "La Discovery utilise Serper, Google Maps "
                    "et Meta Ads Library sans session navigateur.",
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# PROSPECT SOURCES
# ============================================================

class ProspectSourcesView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
        prospect_id: int,
    ):
        user = request.user

        company = get_user_company(
            user
        )

        if not company:
            return Response(
                {
                    "success": False,
                    "message":
                        "Aucune société associée à cet utilisateur.",
                },
                status=
                    status.HTTP_403_FORBIDDEN,
            )

        from sales.models import Prospect

        prospect = (
            Prospect.objects
            .filter(
                id=prospect_id,
                company=company,
            )
            .first()
        )

        if not prospect:
            return Response(
                {
                    "success": False,
                    "message":
                        "Prospect introuvable.",
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "success": True,

                "prospect_id":
                    prospect.id,

                "sources": {
                    "origin":
                        getattr(
                            prospect,
                            "origin",
                            None,
                        ),

                    "lead_origin":
                        getattr(
                            prospect,
                            "lead_origin",
                            None,
                        ),

                    "source":
                        getattr(
                            prospect,
                            "source",
                            None,
                        ),

                    "discovery_sources":
                        getattr(
                            prospect,
                            "discovery_sources",
                            [],
                        )
                        or [],

                    "website":
                        getattr(
                            prospect,
                            "website",
                            None,
                        ),

                    "linkedin_url":
                        getattr(
                            prospect,
                            "linkedin_url",
                            None,
                        ),

                    "facebook_url":
                        getattr(
                            prospect,
                            "facebook_url",
                            None,
                        ),

                    "instagram_url":
                        getattr(
                            prospect,
                            "instagram_url",
                            None,
                        ),

                    "google_maps_url":
                        getattr(
                            prospect,
                            "google_maps_url",
                            None,
                        ),
                },
            },
            status=status.HTTP_200_OK,
        )
