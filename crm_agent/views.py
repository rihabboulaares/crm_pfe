"""
views.py — Endpoints Django REST Framework pour l'agent CRM MCP.
"""
import asyncio
import traceback
import base64

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .agent import chat_with_memory, reset_memory
from .memory import REDIS_AVAILABLE


class AgentChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            message = request.data.get("message", "").strip()
            if not message:
                return Response({"error": "Message requis."}, status=400)

            user = request.user
            user_id = f"user_{user.id}"
            username = user.username
            company_id = getattr(user, "company_id", 1) or 1

            print(f"[AGENT] user={username} | company={company_id} | msg={message}")

            response = asyncio.run(
                chat_with_memory(
                    user_id=user_id,
                    user_message=message,
                    username=username,
                    company_id=company_id,
                )
            )

            print(f"[AGENT] réponse OK")
            return Response({
                "response": response,
                "user": username,
                "user_id": user_id,
            })

        except Exception as e:
            print(f"[AGENT ERROR] {traceback.format_exc()}")
            return Response({"error": str(e)}, status=500)


class AgentFileView(APIView):
    """
    Reçoit un fichier (Excel, PDF, Word) + un message utilisateur.
    Extrait le contenu du fichier et l'envoie à l'agent avec le message.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        try:
            file = request.FILES.get("file")
            message = request.data.get("message", "").strip()

            if not file:
                return Response({"error": "Fichier requis."}, status=400)

            filename = file.name.lower()
            content = file.read()

            # ── Extraction du contenu selon le type de fichier ──
            extracted = self._extract(filename, content)

            if extracted.startswith("❌"):
                return Response({"error": extracted}, status=400)

            # ── Construction du message enrichi ──
            user_message = (
                f"{message}\n\n"
                f"=== FICHIER JOINT : {file.name} ===\n"
                f"{extracted}"
            ) if message else (
                f"Analyse ce fichier et effectue les actions nécessaires.\n\n"
                f"=== FICHIER JOINT : {file.name} ===\n"
                f"{extracted}"
            )

            user = request.user
            user_id = f"user_{user.id}"
            username = user.username
            company_id = getattr(user, "company_id", 1) or 1

            print(f"[AGENT FILE] user={username} | fichier={file.name} | taille={len(content)} bytes")

            response = asyncio.run(
                chat_with_memory(
                    user_id=user_id,
                    user_message=user_message,
                    username=username,
                    company_id=company_id,
                )
            )

            return Response({
                "response": response,
                "file": file.name,
                "user": username,
            })

        except Exception as e:
            print(f"[AGENT FILE ERROR] {traceback.format_exc()}")
            return Response({"error": str(e)}, status=500)

    def _extract(self, filename: str, content: bytes) -> str:
        """Extrait le texte selon l'extension du fichier."""

        # ── Excel ──────────────────────────────────────────────
        if filename.endswith((".xlsx", ".xls")):
            return self._extract_excel(content, filename)

        # ── PDF ────────────────────────────────────────────────
        elif filename.endswith(".pdf"):
            return self._extract_pdf(content)

        # ── Word ───────────────────────────────────────────────
        elif filename.endswith((".docx", ".doc")):
            return self._extract_word(content)

        # ── CSV ────────────────────────────────────────────────
        elif filename.endswith(".csv"):
            return self._extract_csv(content)

        # ── Texte brut ─────────────────────────────────────────
        elif filename.endswith(".txt"):
            return content.decode("utf-8", errors="ignore")

        else:
            return f"❌ Format non supporté : {filename}. Formats acceptés : xlsx, xls, csv, pdf, docx, doc, txt"

    def _extract_excel(self, content: bytes, filename: str) -> str:
        try:
            import openpyxl
            from io import BytesIO
            wb = openpyxl.load_workbook(BytesIO(content), data_only=True)
            result = []
            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                result.append(f"--- Feuille : {sheet_name} ---")
                rows = list(ws.iter_rows(values_only=True))
                if not rows:
                    result.append("(feuille vide)")
                    continue
                # Headers
                headers = [str(h).strip() if h is not None else f"Col{i}" for i, h in enumerate(rows[0])]
                result.append(" | ".join(headers))
                result.append("-" * 60)
                # Data rows
                for row in rows[1:]:
                    if all(v is None for v in row):
                        continue
                    values = [str(v).strip() if v is not None else "" for v in row]
                    result.append(" | ".join(values))
            return "\n".join(result)
        except ImportError:
            return "❌ Module openpyxl manquant. Installe-le : pip install openpyxl"
        except Exception as e:
            return f"❌ Erreur lecture Excel : {str(e)}"

    def _extract_pdf(self, content: bytes) -> str:
        try:
            import pdfplumber
            from io import BytesIO
            result = []
            with pdfplumber.open(BytesIO(content)) as pdf:
                for i, page in enumerate(pdf.pages):
                    result.append(f"--- Page {i + 1} ---")
                    # Tables
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            for row in table:
                                cleaned = [str(cell).strip() if cell else "" for cell in row]
                                result.append(" | ".join(cleaned))
                    else:
                        text = page.extract_text()
                        if text:
                            result.append(text)
            return "\n".join(result) if result else "❌ PDF vide ou illisible"
        except ImportError:
            return "❌ Module pdfplumber manquant. Installe-le : pip install pdfplumber"
        except Exception as e:
            return f"❌ Erreur lecture PDF : {str(e)}"

    def _extract_word(self, content: bytes) -> str:
        try:
            import docx
            from io import BytesIO
            doc = docx.Document(BytesIO(content))
            result = []
            # Paragraphes
            for para in doc.paragraphs:
                if para.text.strip():
                    result.append(para.text.strip())
            # Tables
            for table in doc.tables:
                result.append("--- Tableau ---")
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    result.append(" | ".join(cells))
            return "\n".join(result) if result else "❌ Document vide"
        except ImportError:
            return "❌ Module python-docx manquant. Installe-le : pip install python-docx"
        except Exception as e:
            return f"❌ Erreur lecture Word : {str(e)}"

    def _extract_csv(self, content: bytes) -> str:
        try:
            import csv
            from io import StringIO
            text = content.decode("utf-8", errors="ignore")
            reader = csv.reader(StringIO(text))
            rows = list(reader)
            if not rows:
                return "❌ CSV vide"
            result = []
            headers = rows[0]
            result.append(" | ".join(headers))
            result.append("-" * 60)
            for row in rows[1:]:
                if any(cell.strip() for cell in row):
                    result.append(" | ".join(row))
            return "\n".join(result)
        except Exception as e:
            return f"❌ Erreur lecture CSV : {str(e)}"


class AgentResetView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = f"user_{request.user.id}"
        result = reset_memory(user_id)
        return Response({"message": result})


class AgentStatusView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({
            "status": "ok",
            "redis": REDIS_AVAILABLE,
            "mode": "MCP",
        })