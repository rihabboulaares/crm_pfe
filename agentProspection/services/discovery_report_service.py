from __future__ import annotations

import re
from datetime import datetime
from io import BytesIO
from textwrap import wrap

from django.utils import timezone


def sanitize_report_filename(query: str, when: datetime | None = None) -> str:
    when = when or timezone.now()
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", query or "prospection").strip("-").lower()
    slug = slug[:70] or "prospection"
    return f"rapport-prospection-{slug}-{when:%Y-%m-%d}.pdf"


def _value(value, default="-"):
    if value is None or value == "":
        return default
    if isinstance(value, (list, tuple)):
        return ", ".join(str(item) for item in value if item) or default
    return str(value)


SOURCE_LABELS = {
    "ads_library_search": "Meta Ads Library",
    "meta_ads_library": "Meta Ads Library",
    "serper_linkedin": "Serper LinkedIn",
    "serper_facebook": "Serper Facebook",
    "serper_instagram": "Serper Instagram",
    "serper_general": "Serper General",
    "maps_search": "Google Maps",
    "google_maps": "Google Maps",
}


def source_label(source: str | None) -> str:
    return SOURCE_LABELS.get(str(source or ""), str(source or "Source inconnue"))


def source_result_counts(result_data: dict) -> dict[str, int]:
    counts = {}
    for item in result_data.get("raw_results") or []:
        source = item.get("tool") or item.get("source")
        if not source:
            continue
        counts[source] = counts.get(source, 0) + len(item.get("results") or [])
    return counts


def build_report_stats(result_data: dict, duration_seconds: float = 0) -> dict:
    import_stats = result_data.get("import_stats") or {}
    accepted = (result_data.get("prospect_companies") or []) + (result_data.get("prospect_persons") or [])
    raw_count = int(result_data.get("raw_results_count") or 0)
    rejected_count = int(result_data.get("rejected_results") or len(result_data.get("rejected_details") or []))
    imported = (
        int(import_stats.get("companies_created") or 0)
        + int(import_stats.get("companies_updated") or 0)
        + int(import_stats.get("persons_created") or 0)
        + int(import_stats.get("persons_updated") or 0)
    )
    return {
        "requested": int((result_data.get("intent") or {}).get("max_leads") or len(accepted) or 0),
        "raw_results": raw_count,
        "after_fusion": int(result_data.get("after_fusion_count") or len(accepted)),
        "after_deduplication": int(result_data.get("after_deduplication_count") or len(accepted)),
        "valid": len(accepted),
        "rejected": rejected_count,
        "imported": imported,
        "sources_executed": len({item.get("tool") for item in result_data.get("gemini_decisions") or [] if item.get("tool")}),
        "source_result_counts": source_result_counts(result_data),
        "duration_seconds": round(float(duration_seconds or 0), 2),
    }


class SimplePDF:
    def __init__(self):
        self.pages: list[list[str]] = [[]]

    def add_line(self, text: str = ""):
        if len(self.pages[-1]) >= 46:
            self.pages.append([])
        self.pages[-1].append(str(text))

    def add_wrapped(self, text: str, width: int = 92):
        for line in wrap(str(text or ""), width=width) or [""]:
            self.add_line(line)

    @staticmethod
    def _escape(text: str) -> str:
        return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def render(self) -> bytes:
        objects: list[bytes] = []
        page_refs = []
        font_obj_id = 3

        for page in self.pages:
            content = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL"]
            for index, line in enumerate(page):
                if index:
                    content.append("T*")
                content.append(f"({self._escape(line)}) Tj")
            content.append("ET")
            stream = "\n".join(content).encode("latin-1", errors="replace")
            content_obj_id = len(objects) + 4
            page_obj_id = len(objects) + 5
            objects.append(
                f"{content_obj_id} 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode()
                + stream
                + b"\nendstream\nendobj\n"
            )
            objects.append(
                f"{page_obj_id} 0 obj\n"
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                f"/Resources << /Font << /F1 {font_obj_id} 0 R >> >> "
                f"/Contents {content_obj_id} 0 R >>\nendobj\n".encode()
            )
            page_refs.append(f"{page_obj_id} 0 R")

        catalog = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        pages = f"2 0 obj\n<< /Type /Pages /Kids [{' '.join(page_refs)}] /Count {len(page_refs)} >>\nendobj\n".encode()
        font = b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        all_objects = [catalog, pages, font, *objects]

        buffer = BytesIO()
        buffer.write(b"%PDF-1.4\n")
        offsets = [0]
        for obj in all_objects:
            offsets.append(buffer.tell())
            buffer.write(obj)
        xref_at = buffer.tell()
        buffer.write(f"xref\n0 {len(all_objects) + 1}\n".encode())
        buffer.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            buffer.write(f"{offset:010d} 00000 n \n".encode())
        buffer.write(
            f"trailer\n<< /Size {len(all_objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_at}\n%%EOF\n".encode()
        )
        return buffer.getvalue()


def generate_discovery_report(run) -> bytes:
    data = run.result_data or {}
    stats = run.stats or build_report_stats(data, run.duration_seconds)
    intent = data.get("intent") or {}
    companies = data.get("prospect_companies") or []
    persons = data.get("prospect_persons") or []
    accepted = companies + persons
    rejected = data.get("rejected_details") or data.get("rejected_preview") or []
    errors = data.get("errors") or []
    decisions = data.get("gemini_decisions") or []
    queries = [item.get("query") for item in decisions if item.get("query")]
    sources = [item.get("tool") or item.get("source") for item in decisions if item.get("tool") or item.get("source")]
    source_counts = stats.get("source_result_counts") or source_result_counts(data)

    pdf = SimplePDF()
    pdf.add_line("Rapport de prospection IA")
    pdf.add_line("=" * 34)
    pdf.add_wrapped(f"Requete: {run.query}")
    pdf.add_line(f"Date: {timezone.localtime(run.started_at):%d/%m/%Y %H:%M}")
    pdf.add_line(f"Utilisateur: {_value(getattr(run.launched_by, 'email', None) or getattr(run.launched_by, 'username', None))}")
    pdf.add_line(f"Entreprise: {_value(getattr(run.company, 'name', None))}")
    pdf.add_line(f"Nombre demande: {_value(stats.get('requested'))}")
    pdf.add_line(f"Duree: {_value(stats.get('duration_seconds'))} s")
    pdf.add_line()

    pdf.add_line("Resume executif")
    pdf.add_line("-" * 18)
    for label, key in [
        ("Prospects demandes", "requested"),
        ("Resultats bruts", "raw_results"),
        ("Apres fusion", "after_fusion"),
        ("Apres deduplication", "after_deduplication"),
        ("Prospects valides", "valid"),
        ("Resultats rejetes", "rejected"),
        ("Prospects importes", "imported"),
        ("Sources executees", "sources_executed"),
    ]:
        pdf.add_line(f"{label}: {_value(stats.get(key))}")
    pdf.add_line()

    pdf.add_line("Intention interpretee")
    pdf.add_line("-" * 22)
    for label, key in [
        ("Type", "lead_types"),
        ("Roles", "target_roles"),
        ("Secteur", "industries"),
        ("Localisation", "locations"),
        ("Plateformes", "sources"),
        ("Quantite", "max_leads"),
    ]:
        pdf.add_line(f"{label}: {_value(intent.get(key))}")
    pdf.add_line()

    pdf.add_line("Strategie de recherche")
    pdf.add_line("-" * 23)
    for source in sorted({source for source in sources if source}):
        count_text = f" ({source_counts[source]} resultats)" if source in source_counts else ""
        pdf.add_line(f"- {source_label(source)}{count_text}")
    for source, count in sorted(source_counts.items()):
        if source not in sources:
            pdf.add_line(f"- {source_label(source)} ({count} resultats)")
    if queries:
        pdf.add_line("Requetes executees:")
        for query in queries[:12]:
            pdf.add_wrapped(f'- "{query}"')
    pdf.add_line()

    pdf.add_line("Prospects retenus")
    pdf.add_line("-" * 17)
    if accepted:
        for item in accepted[:80]:
            name = item.get("company_name") or item.get("full_name") or item.get("name")
            pdf.add_wrapped(
                " | ".join(
                    part
                    for part in [
                        _value(name),
                        _value(item.get("lead_type")),
                        _value(item.get("city") or item.get("country")),
                        _value(item.get("source_label") or item.get("source")),
                        _value(item.get("website")),
                        _value(item.get("linkedin_url")),
                        _value(item.get("phone")),
                        _value(item.get("email")),
                    ]
                    if part != "-"
                )
            )
    else:
        pdf.add_line("Aucun prospect retenu.")
    pdf.add_line()

    pdf.add_line("Resultats rejetes")
    pdf.add_line("-" * 18)
    if rejected:
        for item in rejected[:80]:
            pdf.add_wrapped(
                f"{_value(item.get('name') or item.get('title'))} | "
                f"{_value(item.get('source'))} | {_value(item.get('reason'))}"
            )
    else:
        pdf.add_line("Aucun rejet detaille enregistre.")
    pdf.add_line()

    pdf.add_line("Incidents et limites")
    pdf.add_line("-" * 21)
    if errors:
        for error in errors[:20]:
            pdf.add_wrapped(f"- {error}")
    else:
        pdf.add_line("Aucune erreur critique.")
    pdf.add_line()

    pdf.add_line("Conclusion")
    pdf.add_line("-" * 10)
    pdf.add_wrapped(
        f"La recherche a permis d'identifier {_value(stats.get('valid'))} prospects pertinents "
        f"a partir de {_value(stats.get('raw_results'))} resultats bruts."
    )
    pdf.add_wrapped(
        f"{_value(stats.get('rejected'))} resultats ont ete rejetes et "
        f"{_value(stats.get('imported'))} prospects ont ete ajoutes ou mis a jour dans le CRM."
    )
    return pdf.render()
