"""
Vues Django pour l'agent de prospection.

POST /agentProspection/rechercher/  → lance l'agent ReAct
POST /agentProspection/importer/    → importe un résultat dans le CRM

Fix : linkedin_url n'est pas un champ de ProspectCompany → retiré des defaults
"""

import traceback

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .tools.cache_tool import CacheTool


class RechercherView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            from .agent.service import ProspectionAgent
            result = ProspectionAgent().rechercher(request.data)
            return Response(result)

        except Exception as exc:
            tb = traceback.format_exc()
            print(f"[RechercherView] ERREUR 500:\n{tb}")

            message = str(exc)
            is_config_error = any(
                kw in message
                for kw in ["GOOGLE_API_KEY", "GEMINI_API_KEY", "manquante", "API key"]
            )
            is_import_error = any(
                kw in message
                for kw in ["No module named", "ImportError", "ModuleNotFoundError"]
            )

            if is_config_error:
                return Response(
                    {
                        "detail": "Clé API manquante",
                        "error": message,
                        "hint": "Vérifie GEMINI_API_KEY dans .env et redémarre Django.",
                    },
                    status=400,
                )

            if is_import_error:
                return Response(
                    {
                        "detail": "Dépendance Python manquante",
                        "error": message,
                        "hint": "pip install langchain-google-genai langgraph langchain-chroma",
                        "traceback": tb.splitlines()[-5:],
                    },
                    status=500,
                )

            return Response(
                {
                    "detail": "Erreur interne de l'agent",
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

        # ── Récupérer les vrais champs du modèle ProspectCompany ──────────────
        # Inspection dynamique pour éviter les FieldError si le modèle évolue
        company_model_fields = {
            f.name for f in ProspectCompany._meta.get_fields()
            if hasattr(f, "column")
        }

        # Mapping complet source → champ modèle (avec vérification)
        field_candidates = {
            "industry":        company_data.get("secteur", ""),
            "phone":           company_data.get("telephone") or company_data.get("phone") or "",
            "email":           company_data.get("email") or "",
            "city":            company_data.get("ville") or company_data.get("city") or "",
            "country":         company_data.get("country") or "Tunisie",
            "website":         company_data.get("site_web") or "",
            "facebook_url":    company_data.get("facebook_url") or "",
            "instagram_url":   company_data.get("instagram_url") or "",
            "google_place_id": company_data.get("place_id") or "",
            "score_ia":        company_data.get("score_ia") or 0,
            "evaluation":      company_data.get("evaluation") or "cold",
            "next_action":     company_data.get("next_action") or "",
            "source":          "agent_prospection",
            # linkedin_url peut ou non exister selon le modèle
            "linkedin_url":    company_data.get("linkedin_url") or "",
        }

        # Filtrer uniquement les champs qui existent dans le modèle
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
                {"detail": "Champ 'nom' ou 'prospect_company_name' obligatoire"},
                status=400,
            )

        # ── Créer ou récupérer la ProspectCompany ────────────────────────────
        try:
            prospect_company, company_created = ProspectCompany.objects.get_or_create(
                name=company_name,
                company=user_company,
                defaults=company_defaults,
            )
        except Exception as exc:
            # Log détaillé pour debug
            print(f"[ImporterView] get_or_create erreur: {exc}")
            # Retry sans les champs potentiellement problématiques
            safe_defaults = {
                k: v for k, v in company_defaults.items()
                if k in {"industry", "phone", "email", "city", "country",
                         "website", "score_ia", "evaluation", "next_action", "source"}
            }
            prospect_company, company_created = ProspectCompany.objects.get_or_create(
                name=company_name,
                company=user_company,
                defaults=safe_defaults,
            )

        if not company_created:
            updated = []
            for field, value in company_defaults.items():
                current = getattr(prospect_company, field, None)
                always_update = field in {"score_ia", "evaluation", "next_action", "source"}
                if value and (always_update or not current):
                    try:
                        setattr(prospect_company, field, value)
                        updated.append(field)
                    except AttributeError:
                        pass
            if updated:
                try:
                    prospect_company.save(update_fields=sorted(set(updated)))
                except Exception as exc:
                    print(f"[ImporterView] save update erreur: {exc}")

        # ── Prospects ────────────────────────────────────────────────────────
        raw_prospects = data.get("prospects") or []
        if data.get("prospect"):
            raw_prospects = [data["prospect"]]
        elif data.get("first_name") or data.get("last_name"):
            raw_prospects = [data]

        # Champs du modèle Prospect
        prospect_model_fields = {
            f.name for f in Prospect._meta.get_fields()
            if hasattr(f, "column")
        }

        created_prospects = []
        skipped_prospects = []

        for raw in raw_prospects:
            first_name = raw.get("first_name") or ""
            last_name  = raw.get("last_name") or ""
            email      = raw.get("email") or ""
            linkedin   = raw.get("linkedin_url") or ""
            instagram  = raw.get("instagram_url") or ""
            facebook   = raw.get("facebook_url") or ""

            if not first_name:
                skipped_prospects.append({
                    "reason": "first_name obligatoire",
                    "raw": str(raw)[:120],
                })
                continue

            # Au moins un moyen de contact
            if not (email or linkedin or instagram or facebook or raw.get("phone")):
                skipped_prospects.append({
                    "reason": "Au moins email, LinkedIn, Instagram ou téléphone requis",
                    "name": f"{first_name} {last_name}".strip(),
                })
                continue

            # Chercher un doublon existant
            prospect_obj = None
            if email:
                prospect_obj = Prospect.objects.filter(
                    email=email, company=user_company
                ).first()
            if not prospect_obj and linkedin:
                prospect_obj = Prospect.objects.filter(
                    linkedin_url=linkedin, company=user_company
                ).first() if "linkedin_url" in prospect_model_fields else None
            if not prospect_obj and instagram:
                prospect_obj = Prospect.objects.filter(
                    instagram_url=instagram, company=user_company
                ).first() if "instagram_url" in prospect_model_fields else None

            # Construire les defaults en filtrant sur les vrais champs
            prospect_candidates = {
                "first_name":       first_name,
                "last_name":        last_name,
                "title":            raw.get("title") or "",
                "phone":            raw.get("phone") or raw.get("telephone") or "",
                "city":             raw.get("city") or company_data.get("ville") or "",
                "country":          raw.get("country") or "Tunisie",
                "origin":           raw.get("origin") or "website",
                "evaluation":       raw.get("evaluation") or company_data.get("evaluation") or "cold",
                "status":           raw.get("status") or "new",
                "prospect_company": prospect_company,
                "linkedin_url":     linkedin,
                "facebook_url":     facebook,
                "instagram_url":    instagram,
                "raison_score":     raw.get("raison_score") or "",
                "next_action":      raw.get("next_action") or "",
            }

            prospect_defaults = {
                k: v for k, v in prospect_candidates.items()
                if k in prospect_model_fields or k == "prospect_company"
            }

            if not prospect_obj:
                try:
                    prospect_obj = Prospect.objects.create(
                        email=email or None,
                        company=user_company,
                        **prospect_defaults,
                    )
                    prospect_created = True
                except Exception as exc:
                    print(f"[ImporterView] Prospect.create erreur: {exc}")
                    skipped_prospects.append({
                        "reason": f"Erreur création: {str(exc)[:100]}",
                        "name": f"{first_name} {last_name}".strip(),
                    })
                    continue
            else:
                prospect_created = False
                updated_fields = []
                for field, value in prospect_defaults.items():
                    if field == "prospect_company":
                        continue
                    if value and not getattr(prospect_obj, field, None):
                        try:
                            setattr(prospect_obj, field, value)
                            updated_fields.append(field)
                        except AttributeError:
                            pass
                if updated_fields:
                    try:
                        prospect_obj.save(update_fields=sorted(set(updated_fields)))
                    except Exception as exc:
                        print(f"[ImporterView] Prospect.save erreur: {exc}")

            created_prospects.append({
                "status":       "created" if prospect_created else "existing",
                "id":           prospect_obj.id,
                "name":         f"{prospect_obj.first_name} {prospect_obj.last_name}".strip(),
                "email":        prospect_obj.email or "",
                "linkedin_url": getattr(prospect_obj, "linkedin_url", "") or "",
                "instagram_url": getattr(prospect_obj, "instagram_url", "") or "",
            })

        # Marquer comme importé dans le cache Redis
        if company_data.get("place_id"):
            try:
                CacheTool().marquer_importe(company_data["place_id"])
            except Exception:
                pass

        return Response({
            "status":                   "created" if company_created else "existing",
            "prospect_company_id":      prospect_company.id,
            "prospect_company_created": company_created,
            "company_name":             prospect_company.name,
            "prospects":                created_prospects,
            "skipped_prospects":        skipped_prospects,
        })