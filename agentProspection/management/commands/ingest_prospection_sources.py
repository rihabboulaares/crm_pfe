from pathlib import Path

from django.core.management.base import BaseCommand
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from agentProspection.agent.config import get_agent_settings
from agentProspection.agent.vector_store import ProspectionVectorStore


class Command(BaseCommand):
    help = "Indexe les sources RAG de prospection dans ChromaDB."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-dir",
            default="data/prospection_knowledge",
            help="Dossier contenant les fichiers .txt, .md, .csv, .json.",
        )

    def handle(self, *args, **options):
        source_dir = Path(options["source_dir"])
        if not source_dir.exists():
            self.stderr.write(f"Dossier introuvable: {source_dir}")
            return

        documents = self._load_documents(source_dir)
        if not documents:
            self.stdout.write("Aucun document a indexer.")
            return

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=900,
            chunk_overlap=120,
        )
        chunks = splitter.split_documents(documents)

        store = ProspectionVectorStore(get_agent_settings())
        count = store.add_documents(chunks)
        self.stdout.write(self.style.SUCCESS(f"{count} chunks indexes dans le RAG."))

    def _load_documents(self, source_dir: Path) -> list[Document]:
        allowed = {".txt", ".md", ".csv", ".json"}
        documents = []

        for path in source_dir.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in allowed:
                continue

            text = path.read_text(encoding="utf-8", errors="ignore").strip()
            if not text:
                continue

            documents.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": str(path),
                        "file_name": path.name,
                        "file_type": path.suffix.lower(),
                    },
                )
            )

        return documents
