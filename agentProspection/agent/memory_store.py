import json
from datetime import datetime, timezone
from typing import Any

from langchain_core.documents import Document

from .config import AgentSettings
from .vector_store import ProspectionVectorStore


class ProspectionMemoryStore:
    """
    Memoire centrale unique de l'agent.

    On utilise ChromaDB via ProspectionVectorStore pour:
    - retrouver des entreprises deja analysees,
    - alimenter le RAG,
    - stocker l'historique utile des recherches.
    """

    def __init__(self, settings: AgentSettings):
        self.vector_store = ProspectionVectorStore(settings)

    def retrieve_context(self, criteria: dict[str, Any], companies: list[dict[str, Any]]) -> str:
        company_names = ", ".join(company.get("nom", "") for company in companies[:8])
        query = (
            f"Recherche CRM secteur={criteria.get('secteur')} ville={criteria.get('ville')} "
            f"criteres={criteria.get('criteres', [])} entreprises={company_names}"
        )
        return self.vector_store.context_for_query(query, k=5)

    def mark_known_companies(self, companies: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for company in companies:
            context = self._company_context(company)
            company["memory_status"] = "known" if context else "new"
            company["memory_context"] = context
        return companies

    def store_search_result(
        self,
        criteria: dict[str, Any],
        companies: list[dict[str, Any]],
        prospects: list[dict[str, Any]],
        stats: dict[str, Any],
    ) -> int:
        now = datetime.now(timezone.utc).isoformat()
        docs: list[Document] = [
            Document(
                page_content=(
                    f"Recherche prospection: secteur={criteria.get('secteur')} "
                    f"ville={criteria.get('ville')} stats={json.dumps(stats, ensure_ascii=False)}"
                ),
                metadata={
                    "doc_type": "search_history",
                    "source": "agent_prospection",
                    "created_at": now,
                    "secteur": criteria.get("secteur", ""),
                    "ville": criteria.get("ville", ""),
                },
            )
        ]

        for company in companies:
            docs.append(self._company_document(company, now))

        for prospect in prospects:
            docs.append(self._prospect_document(prospect, now))

        return self.vector_store.add_documents(docs)

    def _company_context(self, company: dict[str, Any]) -> str:
        place_id = company.get("place_id")
        if place_id and hasattr(self.vector_store.store, "_collection"):
            try:
                result = self.vector_store.store._collection.get(
                    where={"place_id": place_id},
                    limit=1,
                )
                docs = result.get("documents") or []
                if docs:
                    return docs[0][:800]
            except Exception:
                pass

        query = f"{company.get('nom')} {company.get('ville')} {company.get('telephone')} {company.get('site_web')}"
        return self.vector_store.context_for_query(query, k=1)

    def _company_document(self, company: dict[str, Any], created_at: str) -> Document:
        text = (
            f"Entreprise prospectee: {company.get('nom')} | "
            f"secteur={company.get('secteur')} | ville={company.get('ville')} | "
            f"telephone={company.get('telephone')} | email={company.get('email')} | "
            f"site={company.get('site_web')} | facebook={company.get('facebook_url')} | "
            f"instagram={company.get('instagram_url')} | linkedin={company.get('linkedin_url')} | "
            f"score={company.get('score_ia')} | evaluation={company.get('evaluation')} | "
            f"raison={company.get('raison_score')} | action={company.get('next_action')}"
        )
        return Document(
            page_content=text,
            metadata={
                "doc_type": "company",
                "source": company.get("source") or "agent_prospection",
                "created_at": created_at,
                "place_id": company.get("place_id") or "",
                "company_name": company.get("nom") or "",
                "secteur": company.get("secteur") or "",
                "ville": company.get("ville") or "",
                "evaluation": company.get("evaluation") or "",
            },
        )

    def _prospect_document(self, prospect: dict[str, Any], created_at: str) -> Document:
        text = (
            f"Prospect extrait: {prospect.get('first_name')} {prospect.get('last_name')} | "
            f"title={prospect.get('title')} | email={prospect.get('email')} | "
            f"phone={prospect.get('phone')} | company={prospect.get('prospect_company_name')} | "
            f"origin={prospect.get('origin')} | evidence={prospect.get('evidence')}"
        )
        return Document(
            page_content=text,
            metadata={
                "doc_type": "prospect",
                "source": prospect.get("origin") or "agent_prospection",
                "created_at": created_at,
                "place_id": prospect.get("place_id") or "",
                "company_name": prospect.get("prospect_company_name") or "",
                "email": prospect.get("email") or "",
            },
        )
