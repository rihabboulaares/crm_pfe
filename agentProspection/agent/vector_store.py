from typing import Iterable

from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from .config import AgentSettings, ensure_local_dirs


class ProspectionVectorStore:
    """
    Memoire vectorielle unique de l'agent.

    ChromaDB est le seul vector store utilise pour le RAG. Redis reste reserve
    au cache court terme et aux sessions.
    """

    def __init__(self, settings: AgentSettings):
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY ou GEMINI_API_KEY manquante pour les embeddings RAG.")

        self.settings = settings
        ensure_local_dirs(settings)
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.embedding_model,
            google_api_key=settings.google_api_key,
        )
        self.store = self._load_store()

    def _load_store(self):
        from langchain_chroma import Chroma

        return Chroma(
            collection_name="prospection_knowledge",
            persist_directory=self.settings.chroma_dir,
            embedding_function=self.embeddings,
        )

    def add_documents(self, documents: Iterable[Document]) -> int:
        docs = [doc for doc in documents if doc.page_content.strip()]
        if not docs:
            return 0

        self.store.add_documents(docs)
        return len(docs)

    def similarity_search(self, query: str, k: int = 4) -> list[Document]:
        if not query.strip():
            return []
        return self.store.similarity_search(query, k=k)

    def context_for_query(self, query: str, k: int = 4) -> str:
        docs = self.similarity_search(query, k=k)
        chunks = []
        for index, doc in enumerate(docs, start=1):
            source = doc.metadata.get("source", "source inconnue")
            chunks.append(f"[{index}] Source: {source}\n{doc.page_content}")
        return "\n\n".join(chunks)