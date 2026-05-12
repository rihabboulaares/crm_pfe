import json
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, TypedDict
from urllib.parse import urlparse

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph

from agentProspection.tools.ddg_tool import DDGTool
from agentProspection.tools.osm_tool import OSMTool
from agentProspection.tools.scoring_tool import ScoringTool
from agentProspection.tools.social_tool import SocialTool

from .config import AgentSettings
from .json_utils import clamp_score, extract_json
from .memory_store import ProspectionMemoryStore
from .prompts import (
    PROSPECT_EXTRACTION_SYSTEM_PROMPT,
    PROSPECT_EXTRACTION_USER_PROMPT,
    QUERY_PARSER_SYSTEM_PROMPT,
    QUERY_PARSER_USER_PROMPT,
    SCORING_SYSTEM_PROMPT,
    SCORING_USER_PROMPT,
)
from .redis_memory import RedisAgentMemory
from .schemas import SearchCriteria, is_person_prospect, normalize_company, normalize_prospect


class ProspectionState(TypedDict, total=False):
    input: dict[str, Any]
    criteria: dict[str, Any]
    raw_enterprises: list[dict[str, Any]]
    entreprises: list[dict[str, Any]]
    prospects: list[dict[str, Any]]
    stats: dict[str, int]
    rag_context: str
    session_memory: list[dict[str, Any]]
    cache_hit: bool
    executed_sources: list[str]
    errors: list[str]


class ProspectionGraph:
    def __init__(self, settings: AgentSettings):
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY ou GEMINI_API_KEY manquante.")

        self.settings = settings
        self.osm = OSMTool()
        self.ddg = DDGTool()
        self.social = SocialTool()
        self.local_scorer = ScoringTool()
        self.memory = ProspectionMemoryStore(settings)
        self.redis_memory = RedisAgentMemory(settings)
        self.llm = ChatGoogleGenerativeAI(
            model=settings.chat_model,
            google_api_key=settings.google_api_key,
            temperature=0.2,
            timeout=settings.llm_timeout,
            max_retries=2,
        )
        self.graph = self._build_graph()

    def run(self, raw_input: dict[str, Any]) -> dict[str, Any]:
        state = self.graph.invoke({"input": dict(raw_input), "errors": []})
        criteria = state.get("criteria", {})
        return {
            "entreprises": state.get("entreprises", []),
            "prospects": state.get("prospects", []),
            "stats": state.get("stats", {}),
            "meta": {
                **criteria,
                "agent": "prospection_gemini_langgraph",
                "model": self.settings.chat_model,
                "memory": "chroma_rag",
                "cache": "redis",
                "vector_store": "chroma",
                "cache_hit": state.get("cache_hit", False),
                "sources": criteria.get("sources", []),
                "executed_sources": state.get("executed_sources", []),
                "errors": state.get("errors", []),
            },
        }

    def _build_graph(self):
        graph = StateGraph(ProspectionState)
        graph.add_node("understand_request", self._understand_request)
        graph.add_node("load_redis_memory", self._load_redis_memory)
        graph.add_node("search_companies", self._search_companies)
        graph.add_node("enrich_companies", self._enrich_companies)
        graph.add_node("validate_companies", self._validate_companies)
        graph.add_node("check_memory", self._check_memory)
        graph.add_node("retrieve_rag", self._retrieve_rag)
        graph.add_node("score_companies", self._score_companies)
        graph.add_node("search_target_prospects", self._search_target_prospects)
        graph.add_node("clear_prospects", self._clear_prospects)
        graph.add_node("store_memory", self._store_memory)

        graph.set_entry_point("understand_request")
        graph.add_edge("understand_request", "load_redis_memory")
        graph.add_conditional_edges(
            "load_redis_memory",
            self._route_after_redis,
            {
                "cache_hit": END,
                "continue": "search_companies",
            },
        )
        graph.add_edge("search_companies", "enrich_companies")
        graph.add_edge("enrich_companies", "validate_companies")
        graph.add_edge("validate_companies", "check_memory")
        graph.add_edge("check_memory", "retrieve_rag")
        graph.add_edge("retrieve_rag", "score_companies")
        graph.add_conditional_edges(
            "score_companies",
            self._route_after_company_scoring,
            {
                "prospect_search": "search_target_prospects",
                "company_search": "clear_prospects",
            },
        )
        graph.add_edge("search_target_prospects", "store_memory")
        graph.add_edge("clear_prospects", "store_memory")
        graph.add_edge("store_memory", END)
        return graph.compile()

    def _understand_request(self, state: ProspectionState) -> ProspectionState:
        raw_input = state.get("input", {})
        criteria = SearchCriteria.from_dict(raw_input, max_allowed_results=self.settings.max_results)

        if criteria.query:
            parsed = self._parse_natural_query(criteria.query)
            merged = criteria.to_dict()

            for key in [
                "search_type",
                "secteur",
                "ville",
                "country",
                "rayon_km",
                "max_resultats",
                "score_min",
                "employees_min",
                "employees_max",
                "activity_type",
                "job_title",
                "seniority_level",
                "target_company",
                "require_facebook",
                "require_instagram",
                "require_website",
                "require_phone",
                "require_email",
                "require_linkedin",
                "validation_min",
            ]:
                raw_has_value = key in raw_input and raw_input.get(key) not in [None, "", []]
                if not raw_has_value and parsed.get(key) not in [None, ""]:
                    merged[key] = parsed[key]

            if parsed.get("criteres"):
                merged["criteres"] = parsed["criteres"]
            if parsed.get("sources"):
                merged["sources"] = parsed["sources"]
            if parsed.get("keywords"):
                merged["keywords"] = parsed["keywords"]

            criteria = SearchCriteria.from_dict(merged, max_allowed_results=self.settings.max_results)

        state["criteria"] = criteria.to_dict()
        return state

    def _load_redis_memory(self, state: ProspectionState) -> ProspectionState:
        criteria = state.get("criteria", {})
        state["session_memory"] = self.redis_memory.get_history(criteria.get("session_id", "default"))

        cached = self.redis_memory.get_cached_result(criteria)
        if cached:
            state["entreprises"] = cached.get("entreprises", [])
            state["prospects"] = cached.get("prospects", [])
            state["stats"] = cached.get("stats", {})
            state["cache_hit"] = True
        else:
            state["cache_hit"] = False

        return state

    def _route_after_redis(self, state: ProspectionState) -> str:
        return "cache_hit" if state.get("cache_hit") else "continue"

    def _parse_natural_query(self, query: str) -> dict[str, Any]:
        try:
            response = self.llm.invoke(
                [
                    SystemMessage(content=QUERY_PARSER_SYSTEM_PROMPT),
                    HumanMessage(content=QUERY_PARSER_USER_PROMPT.format(query=query)),
                ]
            )
            parsed = extract_json(self._message_text(response.content))
            if parsed:
                return parsed
        except Exception as exc:
            print(f"[Agent] Parsing Gemini indisponible: {exc}")
        return self._parse_query_fallback(query)

    def _parse_query_fallback(self, query: str) -> dict[str, Any]:
        lower = query.lower()
        secteurs = [
            "restaurant",
            "hotel",
            "it",
            "informatique",
            "startup",
            "marketing",
            "agence",
            "clinique",
            "pharmacie",
            "garage",
            "cafe",
            "dentiste",
            "medecin",
            "supermarche",
            "banque",
            "coiffeur",
            "gym",
            "boulangerie",
        ]
        villes = [
            "tunis",
            "sfax",
            "sousse",
            "kairouan",
            "bizerte",
            "gabes",
            "ariana",
            "gafsa",
            "monastir",
            "nabeul",
            "ben arous",
            "la marsa",
            "la goulette",
        ]
        person_terms = [
            "responsable",
            "directeur",
            "directrice",
            "manager",
            "ceo",
            "fondateur",
            "founder",
            "rh",
            "recruteur",
            "talent acquisition",
            "dentiste",
            "dentistes",
            "medecin",
            "medecins",
            "docteur",
            "docteurs",
        ]
        search_type = "prospect" if any(term in lower for term in person_terms) else "company"
        job_title = ""
        if search_type == "prospect":
            title_patterns = [
                r"(responsables?\s+[a-zA-ZÀ-ÿ ]+?)\s+(?:dans|a|à|en|sur)\b",
                r"(directeurs?\s+[a-zA-ZÀ-ÿ ]+?)\s+(?:dans|a|à|en|sur)\b",
                r"(ceo|founder|fondateur|recruteur|talent acquisition|hr manager|marketing manager|dentistes?|medecins?|docteurs?)",
            ]
            for pattern in title_patterns:
                match = re.search(pattern, lower, re.IGNORECASE)
                if match:
                    job_title = match.group(1).strip()
                    break
        criteres = [
            word
            for word in ["telephone", "site", "site_web", "email", "facebook", "instagram", "linkedin"]
            if word in lower
        ]
        source_aliases = {
            "osm": ["osm", "openstreetmap", "map", "maps", "carte"],
            "website": ["website", "site", "web", "annuaire"],
            "facebook": ["facebook"],
            "instagram": ["instagram", "insta"],
            "linkedin": ["linkedin"],
        }
        sources = [
            source
            for source, aliases in source_aliases.items()
            if any(alias in lower for alias in aliases)
        ]
        return {
            "search_type": search_type,
            "secteur": next((item for item in secteurs if item in lower), "restaurant"),
            "ville": next((item for item in villes if item in lower), "tunis"),
            "job_title": job_title,
            "sources": sources or (["osm", "website", "linkedin"] if search_type == "prospect" else ["osm", "website"]),
            "criteres": criteres,
        }

    def _search_companies(self, state: ProspectionState) -> ProspectionState:
        criteria = state["criteria"]
        sources = set(criteria.get("sources") or ["osm"])
        if criteria.get("search_type") == "prospect":
            sources.update(["osm", "website"])
        source_query = self._source_query(criteria)
        social_sources = [source for source in ["facebook", "instagram", "linkedin"] if source in sources]
        raw_companies = []
        state["executed_sources"] = []

        future_sources = {}
        with ThreadPoolExecutor(max_workers=3) as executor:
            if "osm" in sources:
                future = executor.submit(
                    self.osm.rechercher,
                    secteur=criteria.get("secteur", "restaurant"),
                    ville=criteria.get("ville", "tunis"),
                    rayon_km=int(criteria.get("rayon_km", 5)),
                    max_resultats=int(criteria.get("max_resultats", self.settings.max_results)),
                )
                future_sources[future] = "osm"

            if "website" in sources:
                future = executor.submit(
                    self.ddg.rechercher_entreprises,
                    secteur=source_query,
                    ville=criteria.get("ville", "tunis"),
                    max_resultats=int(criteria.get("max_resultats", self.settings.max_results)),
                )
                future_sources[future] = "website"

            if social_sources:
                future = executor.submit(
                    self.social.rechercher_entreprises,
                    secteur=source_query,
                    ville=criteria.get("ville", "tunis"),
                    plateformes=social_sources,
                    max_resultats=int(criteria.get("max_resultats", self.settings.max_results)),
                )
                future_sources[future] = ",".join(social_sources)

            for future in as_completed(future_sources):
                source_name = future_sources[future]
                try:
                    result = future.result()
                    state["executed_sources"].append(source_name)
                    for item in result:
                        raw_companies.append(
                            self._model_to_dict(item)
                            if hasattr(item, "dict") or hasattr(item, "model_dump")
                            else item
                        )
                except Exception as exc:
                    state.setdefault("errors", []).append(f"Recherche {source_name} indisponible: {exc}")

        state["raw_enterprises"] = self._dedupe_companies(raw_companies)
        return state
    def _enrich_companies(self, state: ProspectionState) -> ProspectionState:
        criteria = state["criteria"]
        sources = set(criteria.get("sources") or ["osm", "website", "facebook", "instagram", "linkedin"])
        social_sources = [source for source in ["facebook", "instagram", "linkedin"] if source in sources]
        enriched_companies = []

        for raw_company in state.get("raw_enterprises", []):
            company = normalize_company({**raw_company, "secteur": criteria.get("secteur", "")})

            if "website" in sources:
                web = self.ddg.enrichir(
                    nom=company.get("nom", ""),
                    ville=company.get("ville") or criteria.get("ville", ""),
                )
                self._merge_if_empty(company, web, ["telephone", "site_web", "email"])
                company["texte_web"] = web.get("texte_brut", "")

            if social_sources:
                social = self.social.chercher(
                    nom=company.get("nom", ""),
                    ville=company.get("ville") or criteria.get("ville", ""),
                    plateformes=social_sources,
                )
                company.update(social)
            else:
                social = {}

            if not company.get("telephone") and social.get("facebook_tel"):
                company["telephone"] = social["facebook_tel"]
            if not company.get("email") and social.get("facebook_email"):
                company["email"] = social["facebook_email"]

            enriched_companies.append(normalize_company(company))

        state["entreprises"] = self._rank_companies(enriched_companies, criteria)
        return state

    def _validate_companies(self, state: ProspectionState) -> ProspectionState:
        criteria = state["criteria"]
        validated = []
        min_validation = int(criteria.get("validation_min") or 0)
        if min_validation <= 0:
            min_validation = 25 if criteria.get("search_type") == "company" else 15

        for company in state.get("entreprises", []):
            validation = self._validate_company(company, criteria)
            company.update(validation)
            if not self._passes_company_filters(company, criteria):
                continue
            if company["validation_score"] < min_validation:
                continue
            validated.append(company)

        state["entreprises"] = validated
        return state

    def _check_memory(self, state: ProspectionState) -> ProspectionState:
        try:
            state["entreprises"] = self.memory.mark_known_companies(state.get("entreprises", []))
        except Exception as exc:
            state.setdefault("errors", []).append(f"Memoire indisponible: {exc}")
        return state

    def _retrieve_rag(self, state: ProspectionState) -> ProspectionState:
        try:
            state["rag_context"] = self.memory.retrieve_context(
                state.get("criteria", {}),
                state.get("entreprises", []),
            )
            session_memory = json.dumps(state.get("session_memory", [])[:5], ensure_ascii=False)
            if session_memory and session_memory != "[]":
                state["rag_context"] = f"{state['rag_context']}\n\nHistorique Redis:\n{session_memory}"
        except Exception as exc:
            state.setdefault("errors", []).append(f"RAG indisponible: {exc}")
            state["rag_context"] = ""
        return state

    def _score_companies(self, state: ProspectionState) -> ProspectionState:
        score_min = int(state["criteria"].get("score_min", 0))
        if state["criteria"].get("search_type") == "prospect":
            score_min = 0
        rag_context = state.get("rag_context", "")
        scored = []

        for company in state.get("entreprises", []):
            company_context = "\n\n".join(filter(None, [company.get("memory_context", ""), rag_context]))
            scoring = self._score_one(company, company_context, state["criteria"])

            company["score_ia"] = scoring.get("score", 0)
            company["evaluation"] = scoring.get("evaluation", "cold")
            company["raison_score"] = scoring.get("raison", "")
            company["next_action"] = scoring.get("next_action", "")
            company["message_approche"] = scoring.get("message_approche", "")
            company["besoin_probable"] = scoring.get("besoin_probable", "")

            if company["score_ia"] >= score_min:
                scored.append(company)

        state["entreprises"] = scored
        state["stats"] = self._stats(scored)
        return state

    def _score_one(self, company: dict[str, Any], rag_context: str, criteria: dict[str, Any]) -> dict[str, Any]:
        prompt = SCORING_USER_PROMPT.format(
            rag_context=rag_context or "Aucun contexte RAG disponible.",
            criteres_json=json.dumps(criteria, ensure_ascii=False),
            entreprise_json=json.dumps(company, ensure_ascii=False),
        )

        try:
            response = self.llm.invoke(
                [
                    SystemMessage(content=SCORING_SYSTEM_PROMPT),
                    HumanMessage(content=prompt),
                ]
            )
            scoring = extract_json(self._message_text(response.content))
            if not scoring:
                raise ValueError("JSON Gemini vide ou invalide")
        except Exception as exc:
            print(f"[Agent] Scoring Gemini fallback local: {exc}")
            scoring = self.local_scorer.scorer(company)
            scoring.setdefault("message_approche", "")
            scoring.setdefault("besoin_probable", "")

        scoring["score"] = clamp_score(scoring.get("score"))
        scoring["evaluation"] = "hot" if scoring["score"] >= 70 else "warm" if scoring["score"] >= 50 else "cold"
        return scoring

    def _route_after_company_scoring(self, state: ProspectionState) -> str:
        return "prospect_search" if state.get("criteria", {}).get("search_type") == "prospect" else "company_search"

    def _clear_prospects(self, state: ProspectionState) -> ProspectionState:
        state["prospects"] = []
        state["stats"] = self._stats(state.get("entreprises", []), [])
        return state

    def _search_target_prospects(self, state: ProspectionState) -> ProspectionState:
        criteria = state["criteria"]
        job_title = criteria.get("job_title") or criteria.get("activity_type") or criteria.get("secteur") or "Responsable"
        max_resultats = int(criteria.get("max_resultats", self.settings.max_results))
        score_min = int(criteria.get("score_min", 0))
        prospects = []
        seen = set()

        for company in state.get("entreprises", []):
            if len(prospects) >= max_resultats:
                break
            if criteria.get("target_company") and not self._target_company_matches(company, criteria["target_company"]):
                continue

            raw_prospects = self.social.rechercher_prospects(
                company=company,
                job_title=job_title,
                ville=criteria.get("ville", ""),
                seniority_level=criteria.get("seniority_level", ""),
                max_resultats=3,
            )
            for raw in raw_prospects:
                normalized = normalize_prospect(raw, company)
                validation = self._validate_prospect(normalized, company, criteria)
                normalized.update(validation)
                scoring = self._score_prospect(normalized, company, criteria)
                normalized.update(scoring)

                key = self._prospect_key(normalized)
                if not key or key in seen:
                    continue
                if not self._passes_prospect_filters(normalized, criteria):
                    continue
                if normalized.get("score_ia", 0) < score_min:
                    continue
                if is_person_prospect(normalized):
                    seen.add(key)
                    prospects.append(normalized)
                if len(prospects) >= max_resultats:
                    break

        if len(prospects) < max_resultats:
            remaining = max_resultats - len(prospects)
            direct_profiles = self.social.rechercher_profils_publics(
                job_title=job_title,
                secteur=criteria.get("secteur", ""),
                ville=criteria.get("ville", ""),
                plateformes=sorted(set(criteria.get("sources", [])) | {"linkedin"}),
                max_resultats=remaining,
            )
            for raw in direct_profiles:
                company_stub = self._company_stub_for_direct_profile(raw, criteria)
                normalized = normalize_prospect(raw, company_stub)
                validation = self._validate_prospect(normalized, company_stub, criteria)
                normalized.update(validation)
                scoring = self._score_prospect(normalized, company_stub, criteria)
                normalized.update(scoring)
                key = self._prospect_key(normalized)
                if not key or key in seen:
                    continue
                if not self._passes_prospect_filters(normalized, criteria):
                    continue
                if normalized.get("score_ia", 0) < score_min:
                    continue
                if is_person_prospect(normalized):
                    seen.add(key)
                    prospects.append(normalized)
                if len(prospects) >= max_resultats:
                    break

        state["prospects"] = prospects
        state["stats"] = self._stats(state.get("entreprises", []), prospects)
        return state

    def _extract_prospects(self, state: ProspectionState) -> ProspectionState:
        prospects = []
        for company in state.get("entreprises", []):
            extracted = self._extract_company_prospects(company)
            for prospect in extracted:
                normalized = normalize_prospect(prospect, company)
                if is_person_prospect(normalized):
                    prospects.append(normalized)
        state["prospects"] = prospects
        return state

    def _extract_company_prospects(self, company: dict[str, Any]) -> list[dict[str, Any]]:
        public_text = " ".join(
            filter(
                None,
                [
                    company.get("texte_web"),
                    company.get("facebook_bio"),
                    company.get("instagram_bio"),
                    company.get("linkedin_bio"),
                ],
            )
        )

        try:
            response = self.llm.invoke(
                [
                    SystemMessage(content=PROSPECT_EXTRACTION_SYSTEM_PROMPT),
                    HumanMessage(
                        content=PROSPECT_EXTRACTION_USER_PROMPT.format(
                            entreprise_json=json.dumps(company, ensure_ascii=False),
                            public_text=public_text[:5000],
                        )
                    ),
                ]
            )
            payload = extract_json(self._message_text(response.content))
            prospects = payload.get("prospects", []) if payload else []
            if isinstance(prospects, list):
                return prospects
        except Exception as exc:
            print(f"[Agent] Extraction prospects Gemini indisponible: {exc}")

        return self._extract_prospects_fallback(company, public_text)

    def _extract_prospects_fallback(self, company: dict[str, Any], public_text: str) -> list[dict[str, Any]]:
        patterns = [
            r"(?:gerant|gerante|directeur|directrice|owner|manager|pdg|ceo)[:\s-]+([A-Z][A-Za-z' -]{3,60})",
            r"([A-Z][A-Za-z' -]{2,40})\s+(?:gerant|gerante|directeur|directrice|owner|manager|pdg|ceo)",
        ]
        for pattern in patterns:
            match = re.search(pattern, public_text, re.IGNORECASE)
            if not match:
                continue
            first_name, last_name = self._split_name(match.group(1).strip(" -:|"))
            if first_name and last_name:
                return [
                    {
                        "first_name": first_name,
                        "last_name": last_name,
                        "title": "Gerant",
                        "email": company.get("email") or "",
                        "phone": company.get("telephone") or "",
                        "origin": self._detect_origin(company),
                        "confidence": 0.45,
                        "evidence": "Nom detecte dans un extrait public",
                    }
                ]
        return []

    def _store_memory(self, state: ProspectionState) -> ProspectionState:
        try:
            result = {
                "entreprises": state.get("entreprises", []),
                "prospects": state.get("prospects", []),
                "stats": state.get("stats", {}),
            }
            self.redis_memory.set_cached_result(state.get("criteria", {}), result)
            self.redis_memory.append_history(
                session_id=state.get("criteria", {}).get("session_id", "default"),
                criteria=state.get("criteria", {}),
                stats=state.get("stats", {}),
            )
            self.memory.store_search_result(
                criteria=state.get("criteria", {}),
                companies=state.get("entreprises", []),
                prospects=state.get("prospects", []),
                stats=state.get("stats", {}),
            )
        except Exception as exc:
            state.setdefault("errors", []).append(f"Stockage memoire indisponible: {exc}")
        return state

    def _stats(
        self,
        companies: list[dict[str, Any]],
        prospects: list[dict[str, Any]] | None = None,
    ) -> dict[str, int]:
        prospects = prospects or []
        return {
            "total": len(companies),
            "prospects_total": len(prospects),
            "avec_tel": sum(1 for item in companies if item.get("telephone")),
            "avec_email": sum(1 for item in companies if item.get("email")),
            "avec_site": sum(1 for item in companies if item.get("site_web")),
            "avec_facebook": sum(1 for item in companies if item.get("facebook_url")),
            "avec_instagram": sum(1 for item in companies if item.get("instagram_url")),
            "avec_linkedin": sum(1 for item in companies if item.get("linkedin_url")),
            "avec_position": sum(1 for item in companies if item.get("latitude") and item.get("longitude")),
            "prospects_avec_linkedin": sum(1 for item in prospects if item.get("linkedin_url")),
            "prospects_avec_email": sum(1 for item in prospects if item.get("email")),
            "prospects_valides": sum(1 for item in prospects if item.get("validation_status") == "valid"),
            "qualite_moyenne": int(
                sum(int(item.get("data_quality") or 0) for item in companies) / len(companies)
            )
            if companies
            else 0,
            "hot": sum(1 for item in companies if item.get("evaluation") == "hot"),
            "warm": sum(1 for item in companies if item.get("evaluation") == "warm"),
            "cold": sum(1 for item in companies if item.get("evaluation") == "cold"),
        }

    def _source_query(self, criteria: dict[str, Any]) -> str:
        parts = [criteria.get("secteur", "restaurant")]
        if criteria.get("activity_type"):
            parts.append(criteria["activity_type"])
        parts.extend(criteria.get("keywords") or [])
        clean_parts = []
        for part in parts:
            text = str(part).strip().lower()
            if text and text not in clean_parts:
                clean_parts.append(text)
        return " ".join(clean_parts) or "restaurant"
    def _merge_if_empty(self, target: dict[str, Any], source: dict[str, Any], keys: list[str]) -> None:
        for key in keys:
            if not target.get(key) and source.get(key):
                target[key] = source[key]

    def _model_to_dict(self, model) -> dict[str, Any]:
        if hasattr(model, "model_dump"):
            return model.model_dump()
        return model.dict()

    def _dedupe_companies(self, companies: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: list[dict[str, Any]] = []
        key_to_index: dict[str, int] = {}

        for company in companies:
            keys = self._company_keys(company)
            if not keys:
                continue

            existing_index = next((key_to_index[key] for key in keys if key in key_to_index), None)
            if existing_index is None:
                company_copy = dict(company)
                source = company_copy.get("source") or "unknown"
                company_copy["sources_detected"] = sorted({source})
                deduped.append(company_copy)
                index = len(deduped) - 1
                for key in keys:
                    key_to_index[key] = index
                continue

            self._merge_company_data(deduped[existing_index], company)
            for key in keys:
                key_to_index[key] = existing_index

        return deduped

    def _company_keys(self, company: dict[str, Any]) -> list[str]:
        keys = []
        place_id = str(company.get("place_id") or company.get("id") or "").strip().lower()
        if place_id:
            keys.append(f"place:{place_id}")

        phone = self._normalize_phone_key(company.get("telephone") or company.get("phone"))
        if phone:
            keys.append(f"phone:{phone}")

        domain = self._domain_from_url(company.get("site_web") or company.get("website") or company.get("source_url"))
        if domain:
            keys.append(f"domain:{domain}")

        name = self._fingerprint(company.get("nom") or company.get("company_name") or company.get("name"))
        city = self._fingerprint(company.get("ville") or company.get("city"))
        address = self._fingerprint(company.get("adresse") or company.get("address"))[:18]
        if name and city:
            keys.append(f"name:{name}:{city}:{address}")
        return keys

    def _merge_company_data(self, target: dict[str, Any], source: dict[str, Any]) -> None:
        source_name = source.get("source") or "unknown"
        detected = set(target.get("sources_detected") or [])
        detected.add(source_name)
        target["sources_detected"] = sorted(detected)

        for key, value in source.items():
            if value in [None, "", []]:
                continue
            if key in {"texte_web", "facebook_bio", "instagram_bio", "linkedin_bio"}:
                current = str(target.get(key) or "")
                text = str(value)
                if text and text not in current:
                    target[key] = f"{current} {text}".strip()[:3000]
                continue
            if key == "data_quality":
                target[key] = max(int(target.get(key) or 0), int(value or 0))
                continue
            if not target.get(key):
                target[key] = value

    def _rank_companies(
        self,
        companies: list[dict[str, Any]],
        criteria: dict[str, Any],
    ) -> list[dict[str, Any]]:
        query_terms = [
            criteria.get("secteur", ""),
            criteria.get("activity_type", ""),
            *list(criteria.get("keywords") or []),
        ]
        terms = [self._fingerprint(term) for term in query_terms if self._fingerprint(term)]

        def rank(company: dict[str, Any]) -> tuple[int, float, str]:
            text = self._fingerprint(
                " ".join(
                    str(company.get(key) or "")
                    for key in ["nom", "secteur", "categorie", "cuisine", "texte_web", "facebook_bio", "instagram_bio"]
                )
            )
            match_score = sum(1 for term in terms if term in text)
            data_quality = int(company.get("data_quality") or 0)
            has_contact = int(bool(company.get("telephone") or company.get("email") or company.get("site_web")))
            distance = company.get("distance_km")
            distance_value = float(distance) if distance not in [None, ""] else 999.0
            return (-(match_score * 20 + data_quality + has_contact * 10), distance_value, company.get("nom", ""))

        return sorted(companies, key=rank)

    def _validate_company(self, company: dict[str, Any], criteria: dict[str, Any]) -> dict[str, Any]:
        score = 0
        reasons = []
        name = company.get("nom", "").strip()
        if self._is_non_crm_company(company):
            return {
                "validation_score": 0,
                "validation_status": "invalid",
                "validation_reasons": ["resultat non CRM: annuaire, cours, formation ou contenu"],
            }
        text = self._fingerprint(
            " ".join(
                str(company.get(key) or "")
                for key in ["nom", "secteur", "categorie", "adresse", "texte_web", "facebook_bio", "instagram_bio"]
            )
        )
        sector_terms = [
            self._fingerprint(criteria.get("secteur", "")),
            self._fingerprint(criteria.get("activity_type", "")),
            *[self._fingerprint(item) for item in criteria.get("keywords", [])],
        ]
        sector_terms = [term for term in sector_terms if term]

        if name and len(name) >= 2:
            score += 15
            reasons.append("nom coherent")
        if company.get("latitude") and company.get("longitude"):
            score += 20
            reasons.append("position OSM")
        elif self._fingerprint(criteria.get("ville", "")) in self._fingerprint(company.get("ville", "")):
            score += 10
            reasons.append("ville coherente")
        if company.get("data_quality"):
            score += min(15, int(company.get("data_quality") or 0) // 5)
            reasons.append("qualite OSM")
        sector_match = any(term in text for term in sector_terms)
        if sector_match:
            score += 20
            reasons.append("secteur coherent")
        elif company.get("source") not in {"openstreetmap", "osm"}:
            score -= 20
            reasons.append("secteur non confirme")
        if company.get("telephone") and self._normalize_phone_key(company.get("telephone")):
            score += 10
            reasons.append("telephone valide")
        if company.get("site_web"):
            score += 10
            reasons.append("site web")
        if company.get("email"):
            score += 10
            reasons.append("email public")
        if company.get("facebook_url") or company.get("instagram_url") or company.get("linkedin_url"):
            score += 10
            reasons.append("presence digitale")

        score = max(0, min(score, 100))
        return {
            "validation_score": score,
            "validation_status": "valid" if score >= 40 else "weak" if score >= 20 else "invalid",
            "validation_reasons": reasons,
        }

    def _passes_company_filters(self, company: dict[str, Any], criteria: dict[str, Any]) -> bool:
        if company.get("validation_status") == "invalid":
            return False
        if criteria.get("search_type") == "prospect":
            return True
        required_fields = {
            "require_facebook": "facebook_url",
            "require_instagram": "instagram_url",
            "require_website": "site_web",
            "require_phone": "telephone",
            "require_email": "email",
            "require_linkedin": "linkedin_url",
        }
        for flag, field in required_fields.items():
            if criteria.get(flag) and not company.get(field):
                return False
        return True

    def _company_stub_for_direct_profile(self, prospect: dict[str, Any], criteria: dict[str, Any]) -> dict[str, Any]:
        company_name = prospect.get("prospect_company_name") or f"Profil professionnel {criteria.get('ville', '')}".strip()
        return {
            "place_id": f"profile_{self._fingerprint(company_name)[:24]}",
            "nom": company_name,
            "secteur": criteria.get("secteur", ""),
            "ville": criteria.get("ville", ""),
            "country": criteria.get("country", "Tunisie"),
            "validation_score": 45,
            "validation_status": "weak",
            "validation_reasons": ["profil public direct"],
            "score_ia": 0,
            "evaluation": "cold",
        }

    def _is_non_crm_company(self, company: dict[str, Any]) -> bool:
        text = self._fingerprint(
            " ".join(
                str(company.get(key) or "")
                for key in [
                    "nom",
                    "source_url",
                    "site_web",
                    "texte_web",
                    "facebook_bio",
                    "instagram_bio",
                    "linkedin_bio",
                ]
            )
        )
        noise_terms = {
            "annuaire",
            "directory",
            "pages jaunes",
            "page jaune",
            "liste",
            "classement",
            "meilleur",
            "meilleurs",
            "cours",
            "formation",
            "ecole",
            "universite",
            "faculte",
            "master",
            "diplome",
            "emploi",
            "recrutement",
            "job",
            "stage",
            "article",
            "blog",
            "forum",
            "pdf",
        }
        return any(self._fingerprint(term) in text for term in noise_terms)

    def _validate_prospect(
        self,
        prospect: dict[str, Any],
        company: dict[str, Any],
        criteria: dict[str, Any],
    ) -> dict[str, Any]:
        score = 0
        reasons = []

        if prospect.get("first_name") and prospect.get("last_name"):
            score += 20
            reasons.append("nom personne")
        if prospect.get("linkedin_url") and "linkedin.com/in/" in prospect["linkedin_url"].lower():
            score += 25
            reasons.append("linkedin public")
        if self._title_matches(prospect.get("title", ""), criteria.get("job_title", "")):
            score += 25
            reasons.append("poste coherent")
        if self._target_company_matches(company, prospect.get("prospect_company_name", "")):
            score += 15
            reasons.append("entreprise liee")
        if company.get("validation_status") in {"valid", "weak"}:
            score += 10
            reasons.append("entreprise validee")
        if prospect.get("email"):
            score += 5
            reasons.append("email public")
        if criteria.get("seniority_level") and self._title_matches(
            prospect.get("title", ""),
            criteria.get("seniority_level", ""),
        ):
            score += 5
            reasons.append("niveau hierarchique")

        score = min(score, 100)
        return {
            "validation_score": score,
            "validation_status": "valid" if score >= 65 else "weak" if score >= 45 else "invalid",
            "validation_reasons": reasons,
        }

    def _score_prospect(
        self,
        prospect: dict[str, Any],
        company: dict[str, Any],
        criteria: dict[str, Any],
    ) -> dict[str, Any]:
        score = 0
        reasons = []
        if prospect.get("linkedin_url"):
            score += 30
            reasons.append("LinkedIn valide")
        if self._title_matches(prospect.get("title", ""), criteria.get("job_title", "")):
            score += 30
            reasons.append("poste correspondant")
        if company.get("validation_status") == "valid":
            score += 20
            reasons.append("entreprise valide")
        elif company.get("validation_status") == "weak":
            score += 10
            reasons.append("entreprise partiellement valide")
        if prospect.get("email"):
            score += 10
            reasons.append("email public")
        if prospect.get("facebook_url"):
            score += 10
            reasons.append("Facebook trouve")
        score = min(score, 100)
        evaluation = "hot" if score >= 70 else "warm" if score >= 50 else "cold"
        next_action = "LinkedIn" if prospect.get("linkedin_url") else "Email" if prospect.get("email") else "Ignorer"
        return {
            "score_ia": score,
            "evaluation": evaluation,
            "raison_score": ", ".join(reasons) or "Profil public insuffisant",
            "next_action": next_action,
        }

    def _passes_prospect_filters(self, prospect: dict[str, Any], criteria: dict[str, Any]) -> bool:
        if criteria.get("require_linkedin") and not prospect.get("linkedin_url"):
            return False
        if criteria.get("require_email") and not prospect.get("email"):
            return False
        if criteria.get("require_facebook") and not prospect.get("facebook_url"):
            return False
        return prospect.get("validation_status") in {"valid", "weak"}

    def _target_company_matches(self, company: dict[str, Any], target: str) -> bool:
        if not target:
            return True
        target_fp = self._fingerprint(target)
        company_text = self._fingerprint(
            " ".join(str(company.get(key) or "") for key in ["nom", "site_web", "linkedin_url", "facebook_url"])
        )
        if target_fp and target_fp in company_text:
            return True
        target_tokens = [token for token in target_fp.split() if len(token) > 2]
        return bool(target_tokens and any(token in company_text for token in target_tokens))

    def _title_matches(self, title: str, expected: str) -> bool:
        if not expected:
            return True
        title_fp = self._fingerprint(title)
        expected_fp = self._fingerprint(expected)
        aliases = {
            "rh": ["rh", "hr", "human resources", "talent acquisition", "people"],
            "marketing": ["marketing", "digital"],
            "commercial": ["commercial", "sales", "business development"],
            "achat": ["achat", "procurement", "purchasing"],
            "ceo": ["ceo", "founder", "fondateur", "directeur general"],
            "dentiste": ["dentiste", "chirurgien dentiste", "dental surgeon", "dentist"],
            "medecin": ["medecin", "docteur", "doctor", "physician"],
        }
        if expected_fp in title_fp:
            return True
        tokens = [token for token in expected_fp.split() if len(token) > 2]
        if tokens and any(token in title_fp for token in tokens):
            return True
        for key, values in aliases.items():
            if key in expected_fp and any(self._fingerprint(value) in title_fp for value in values):
                return True
        return False

    def _prospect_key(self, prospect: dict[str, Any]) -> str:
        if prospect.get("linkedin_url"):
            return f"linkedin:{prospect['linkedin_url'].lower()}"
        email = prospect.get("email")
        if email:
            return f"email:{email.lower()}"
        return self._fingerprint(
            f"{prospect.get('first_name')} {prospect.get('last_name')} {prospect.get('prospect_company_name')}"
        )

    def _normalize_phone_key(self, value: Any) -> str:
        if not value:
            return ""
        compact = re.sub(r"[^\d+]", "", str(value))
        if compact.startswith("00216"):
            compact = "+216" + compact[5:]
        elif compact.startswith("216") and len(compact) == 11:
            compact = "+" + compact
        elif len(compact) == 8 and compact[0] in "24579":
            compact = "+216" + compact
        return compact

    def _domain_from_url(self, value: Any) -> str:
        if not value:
            return ""
        url = str(value).strip()
        if url.startswith("www."):
            url = f"https://{url}"
        if not url.startswith(("http://", "https://")):
            return ""
        parsed = urlparse(url)
        domain = parsed.netloc.lower().replace("www.", "")
        if domain in {"facebook.com", "instagram.com", "linkedin.com"}:
            parts = [part for part in parsed.path.lower().split("/") if part]
            if domain == "linkedin.com" and len(parts) >= 2 and parts[0] in {"company", "in"}:
                return f"{domain}/{parts[0]}/{parts[1]}"
            return f"{domain}/{parts[0]}" if parts else ""
        return domain

    def _fingerprint(self, value: Any) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(char for char in text if not unicodedata.combining(char))
        text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
        return " ".join(text.split())

    def _split_name(self, full_name: str) -> tuple[str, str]:
        parts = full_name.strip().split()
        if len(parts) < 2:
            return "", ""
        return parts[0], " ".join(parts[1:])

    def _detect_origin(self, company: dict[str, Any]) -> str:
        if company.get("linkedin_url"):
            return "linkedin"
        if company.get("facebook_url"):
            return "facebook"
        if company.get("instagram_url"):
            return "instagram"
        return "website"

    def _message_text(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            texts = []
            for item in content:
                if isinstance(item, dict):
                    texts.append(str(item.get("text", "")))
                else:
                    texts.append(str(item))
            return "\n".join(texts)
        return str(content)
