"""
Mémoire vectorielle de l'agent. ChromaDB via LangChain.
Fonctionne en mode dégradé si chromadb n'est pas installé.
"""

from typing import Iterable

from .config import AgentSettings, ensure_local_dirs


class ProspectionVectorStore:

    def __init__(self, settings: AgentSettings):
        self.settings = settings
        self._available = False
        self.store = None

        if not settings.google_api_key:
            print("[VectorStore] Clé API manquante — RAG désactivé.")
            return

        try:
            ensure_local_dirs(settings)
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=settings.embedding_model,
                google_api_key=settings.google_api_key,
            )
            self.store = self._load_store()
            self._available = True
        except ImportError as exc:
            print(f"[VectorStore] Dépendance manquante — RAG désactivé: {exc}")
        except Exception as exc:
            print(f"[VectorStore] Erreur init — RAG désactivé: {exc}")

    @property
    def available(self) -> bool:
        return self._available

    def _load_store(self):
        from langchain_chroma import Chroma
        return Chroma(
            collection_name="prospection_knowledge",
            persist_directory=self.settings.chroma_dir,
            embedding_function=self.embeddings,
        )

    def add_documents(self, documents) -> int:
        if not self._available or not self.store:
            return 0
        try:
            from langchain_core.documents import Document
            docs = [doc for doc in documents if doc.page_content.strip()]
            if not docs:
                return 0
            self.store.add_documents(docs)
            return len(docs)
        except Exception as exc:
            print(f"[VectorStore] add_documents erreur: {exc}")
            return 0

    def similarity_search(self, query: str, k: int = 4) -> list:
        if not self._available or not self.store or not query.strip():
            return []
        try:
            return self.store.similarity_search(query, k=k)
        except Exception as exc:
            print(f"[VectorStore] similarity_search erreur: {exc}")
            return []

    def context_for_query(self, query: str, k: int = 4) -> str:
        docs = self.similarity_search(query, k=k)
        chunks = []
        for index, doc in enumerate(docs, start=1):
            source = doc.metadata.get("source", "source inconnue")
            chunks.append(f"[{index}] Source: {source}\n{doc.page_content}")
        return "\n\n".join(chunks)