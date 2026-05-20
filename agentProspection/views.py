"""
Vues Django pour l'agent de prospection.

POST /agentProspection/rechercher/
POST /agentProspection/importer/
"""

import traceback

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .agent.service import ProspectionAgent

# views.py — APRÈS (thread-safe)
import threading

_agent_instance = None
_agent_lock = threading.Lock()

def _get_agent():
    global _agent_instance
    if _agent_instance is None:                  # premier check sans lock (rapide)
        with _agent_lock:
            if _agent_instance is None:          # deuxième check avec lock (sécurisé)
                _agent_instance = ProspectionAgent()
    return _agent_instance


class RechercherView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            result = _get_agent().rechercher(request.data)
            return Response(result)

        except Exception as exc:
            tb = traceback.format_exc()
            print(f"[RechercherView] ERREUR 500:\n{tb}")

            message = str(exc)

            is_config_error = any(
                kw in message for kw in ["GOOGLE_API_KEY", "GEMINI_API_KEY", "API key"]
            )

            is_import_error = any(
                kw in message for kw in ["ImportError", "ModuleNotFoundError", "No module named"]
            )

            if is_config_error:
                return Response(
                    {
                        "detail": "Clé API manquante",
                        "error": message,
                        "hint": "Vérifie GEMINI_API_KEY dans .env",
                    },
                    status=400,
                )

            if is_import_error:
                return Response(
                    {
                        "detail": "Erreur d'import Python",
                        "error": message,
                        "hint": "Vérifie agent / prompts / catalog.py",
                        "traceback": tb.splitlines()[-6:],
                    },
                    status=500,
                )

            return Response(
                {
                    "detail": "Erreur interne agent",
                    "error": message,
                    "traceback": tb.splitlines()[-8:],
                },
                status=500,
            )


class ImporterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from sales.models import Prospect, ProspectCompany

        data = request.data
        company_data = data.get("company") or data.get("entreprise") or data
        user_company = request.user.company

        # =========================
        # COMPANY FIELDS SAFE
        # =========================
        company_model_fields = {
            f.name for f in ProspectCompany._meta.get_fields()
            if hasattr(f, "column")
        }

        field_candidates = {
            "industry": company_data.get("secteur", ""),
            "phone": company_data.get("telephone") or company_data.get("phone") or "",
            "email": company_data.get("email") or "",
            "city": company_data.get("ville") or company_data.get("city") or "",
            "country": company_data.get("country") or "Tunisie",
            "website": company_data.get("site_web") or "",
            "facebook_url": company_data.get("facebook_url") or "",
            "instagram_url": company_data.get("instagram_url") or "",
            "google_place_id": company_data.get("place_id") or "",
            "score_ia": company_data.get("score_ia") or 0,
            "evaluation": company_data.get("evaluation") or "cold",
            "next_action": company_data.get("next_action") or "",
            "source": "agent_prospection",
        }

        company_defaults = {
            k: v for k, v in field_candidates.items()
            if k in company_model_fields
        }

        company_name = (
            company_data.get("prospect_company_name")
            or company_data.get("nom")
            or ""
        )

        if not company_name:
            return Response(
                {"detail": "Nom entreprise obligatoire"},
                status=400,
            )

        # =========================
        # CREATE COMPANY
        # =========================
        prospect_company, company_created = ProspectCompany.objects.get_or_create(
            name=company_name,
            company=user_company,
            defaults=company_defaults,
        )

        # =========================
        # PROSPECTS
        # =========================
        raw_prospects = data.get("prospects") or []
        if data.get("prospect"):
            raw_prospects = [data["prospect"]]

        prospect_model_fields = {
            f.name for f in Prospect._meta.get_fields()
            if hasattr(f, "column")
        }

        created = []
        skipped = []

        for raw in raw_prospects:
            first_name = raw.get("first_name", "")
            last_name = raw.get("last_name", "")

            if not first_name:
                skipped.append({"reason": "missing first_name"})
                continue

            email = raw.get("email", "")
            linkedin = raw.get("linkedin_url", "")
            instagram = raw.get("instagram_url", "")
            facebook = raw.get("facebook_url", "")

            if not (email or linkedin or instagram or facebook):
                skipped.append({"reason": "no contact"})
                continue

            prospect_obj = Prospect.objects.filter(
                email=email,
                company=user_company
            ).first() if email else None

            defaults = {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": raw.get("phone", ""),
                "city": raw.get("city", ""),
                "country": "Tunisie",
                "origin": "agent",
                "evaluation": "cold",
                "prospect_company": prospect_company,
                "linkedin_url": linkedin,
                "instagram_url": instagram,
                "facebook_url": facebook,
            }

            defaults = {
                k: v for k, v in defaults.items()
                if k in prospect_model_fields or k == "prospect_company"
            }

            if not prospect_obj:
                prospect_obj = Prospect.objects.create(
                    company=user_company,
                    **defaults
                )

            created.append({
                "id": prospect_obj.id,
                "name": prospect_obj.first_name + " " + prospect_obj.last_name
            })

        return Response({
            "company": company_name,
            "created_prospects": created,
            "skipped": skipped
        })