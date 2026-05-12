from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .tools.cache_tool import CacheTool


class RechercherView(APIView):
    """
    Pipeline agent:
    1. OpenStreetMap / Overpass pour trouver les entreprises.
    2. DuckDuckGo pour enrichir contact/site.
    3. DuckDuckGo pour decouvrir des liens publics sociaux.
    4. Redis pour cache/memoire de session.
    5. ChromaDB pour RAG et similarite.
    6. Gemini via Google AI Studio pour planning, scoring et extraction.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        try:
            from .agent.service import ProspectionAgent

            result = ProspectionAgent().rechercher(request.data)
            return Response(result)
        except Exception as exc:
            message = str(exc)
            http_status = 400 if "GOOGLE_API_KEY" in message or "GEMINI_API_KEY" in message else 500
            return Response(
                {
                    "detail": "Agent de prospection indisponible",
                    "error": message,
                    "hint": (
                        "Verifie GOOGLE_API_KEY, installe requirements-agent.txt, "
                        "puis redemarre Django."
                    ),
                },
                status=http_status,
            )


class ImporterView(APIView):
    """
    Import CRM.

    Garde IsAuthenticated si ton CRM a une connexion utilisateur.
    Si tu veux juste tester en local sans login, remplace temporairement par AllowAny.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from sales.models import Prospect, ProspectCompany

        data = request.data
        company_data = data.get("company") or data.get("entreprise") or data
        company = request.user.company
        company_defaults = {
            "industry": company_data.get("secteur", ""),
            "phone": company_data.get("telephone") or company_data.get("phone") or "",
            "email": company_data.get("email") or "",
            "city": company_data.get("ville") or company_data.get("city") or "",
            "country": company_data.get("country") or "Tunisie",
            "website": company_data.get("site_web") or "",
            "facebook_url": company_data.get("facebook_url") or "",
            "instagram_url": company_data.get("instagram_url") or "",
            "osm_place_id": company_data.get("place_id") or "",
            "score_ia": company_data.get("score_ia") or 0,
            "evaluation": company_data.get("evaluation") or "cold",
            "next_action": company_data.get("next_action") or "",
            "source": "agent_prospection",
        }

        prospect_company, company_created = ProspectCompany.objects.get_or_create(
            name=company_data.get("prospect_company_name") or company_data.get("nom", ""),
            company=company,
            defaults=company_defaults,
        )
        if not company_created:
            updated_fields = []
            for field, value in company_defaults.items():
                current = getattr(prospect_company, field, None)
                should_refresh = field in {"score_ia", "evaluation", "next_action", "source"}
                if value and (should_refresh or not current):
                    setattr(prospect_company, field, value)
                    updated_fields.append(field)
            if updated_fields:
                prospect_company.save(update_fields=sorted(set(updated_fields)))

        raw_prospects = data.get("prospects") or []
        if data.get("prospect"):
            raw_prospects = [data["prospect"]]
        elif data.get("first_name") or data.get("last_name"):
            raw_prospects = [data]

        created_prospects = []
        skipped_prospects = []

        for raw in raw_prospects:
            email = raw.get("email") or ""
            linkedin_url = raw.get("linkedin_url") or ""
            first_name = raw.get("first_name") or ""
            last_name = raw.get("last_name") or ""

            if not first_name or not last_name or not (email or linkedin_url or raw.get("phone")):
                skipped_prospects.append(
                    {
                        "reason": "prospect incomplet: nom et au moins email, LinkedIn ou telephone sont requis",
                        "prospect_company_name": prospect_company.name,
                    }
                )
                continue

            prospect = None
            if email:
                prospect = Prospect.objects.filter(email=email, company=company).first()
            if prospect is None and linkedin_url:
                prospect = Prospect.objects.filter(linkedin_url=linkedin_url, company=company).first()

            defaults = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "title": raw.get("title") or "",
                    "phone": raw.get("phone") or raw.get("telephone") or "",
                    "city": raw.get("city") or company_data.get("ville") or "",
                    "country": raw.get("country") or "Tunisie",
                    "origin": raw.get("origin") or "website",
                    "evaluation": raw.get("evaluation") or company_data.get("evaluation") or "cold",
                    "status": raw.get("status") or "new",
                    "prospect_company": prospect_company,
                    "linkedin_url": linkedin_url,
                    "facebook_url": raw.get("facebook_url") or "",
                    "raison_score": raw.get("raison_score") or company_data.get("raison_score") or "",
                }

            if prospect is None:
                prospect = Prospect.objects.create(
                    email=email or None,
                    company=company,
                    **defaults,
                )
                prospect_created = True
            else:
                prospect_created = False
                updated_fields = []
                for field, value in defaults.items():
                    current = getattr(prospect, field, None)
                    if value and not current:
                        setattr(prospect, field, value)
                        updated_fields.append(field)
                if updated_fields:
                    prospect.save(update_fields=sorted(set(updated_fields)))

            created_prospects.append(
                {
                    "status": "created" if prospect_created else "existing",
                    "id": prospect.id,
                    "name": f"{prospect.first_name} {prospect.last_name}",
                    "email": prospect.email or "",
                    "linkedin_url": prospect.linkedin_url or "",
                }
            )

        cache = CacheTool()
        if company_data.get("place_id"):
            cache.marquer_importe(company_data.get("place_id"))

        return Response(
            {
                "status": "created" if company_created else "existing",
                "prospect_company_id": prospect_company.id,
                "prospect_company_created": company_created,
                "company_name": prospect_company.name,
                "prospects": created_prospects,
                "skipped_prospects": skipped_prospects,
            }
        )
