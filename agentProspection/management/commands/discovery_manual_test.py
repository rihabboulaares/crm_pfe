from asgiref.sync import async_to_sync
from django.core.management.base import BaseCommand, CommandError

from agentProspection.agent.loop_controller import run_agent
from users.models import User


def _safe_console(value) -> str:
    return str(value).encode("cp1252", errors="replace").decode("cp1252")


class Command(BaseCommand):
    help = "Lance un test manuel du Discovery Agent sans scraping ni scoring automatique."

    def add_arguments(self, parser):
        parser.add_argument("--query", required=True)
        parser.add_argument("--max-results", type=int, default=5)
        parser.add_argument("--tenant-company-id", type=int)
        parser.add_argument("--user-id", type=int)
        parser.add_argument("--force-local-fallback", action="store_true")

    def handle(self, *args, **options):
        query = options["query"]
        max_results = options["max_results"]
        tenant_company_id = options.get("tenant_company_id")
        user_id = options.get("user_id")

        if max_results <= 0:
            raise CommandError("--max-results doit etre positif.")

        if not tenant_company_id or not user_id:
            user = User.objects.filter(company__isnull=False).select_related("company").first()
            if not user:
                raise CommandError("Aucun utilisateur avec societe trouve. Passez --tenant-company-id et --user-id.")
            tenant_company_id = tenant_company_id or user.company_id
            user_id = user_id or user.id

        result = async_to_sync(run_agent)(
            query,
            tenant_company_id,
            user_id,
            max_results=max_results,
            force_local_fallback=options.get("force_local_fallback"),
        )
        intent = result.get("intent") or {}
        companies = (result.get("prospect_companies") or [])[:max_results]
        persons = (result.get("prospect_persons") or [])[:max_results]
        logs = result.get("logs") or []
        observe_logs = [item for item in logs if item.get("step") == "observe"]
        plan = result.get("plan") or {}
        planned_tools = list(dict.fromkeys(item.get("tool") for item in plan.get("searches") or [] if item.get("tool")))
        required_tools = result.get("required_sources") or []
        attempted_required_tools = result.get("required_sources_attempted") or []
        remaining_required_tools = result.get("required_sources_remaining") or []
        called_tools = list(dict.fromkeys(item.get("tool") for item in result.get("tool_history") or [] if item.get("tool")))
        raw_results = result.get("raw_results") or []
        successful_tools = list(dict.fromkeys(
            item.get("tool")
            for item in raw_results
            if item.get("tool") and item.get("status") != "unavailable" and item.get("success") is not False
        ))
        unavailable = list(dict.fromkeys(
            f"{item.get('tool')}: {', '.join(item.get('errors') or ['unavailable'])}"
            for item in raw_results
            if item.get("status") == "unavailable"
        ))
        meta_attempts = []
        for item in raw_results:
            if item.get("tool") != "ads_library_search":
                continue
            query_data = (item.get("metadata") or {}).get("query") or {}
            if isinstance(query_data, dict):
                meta_query = query_data.get("q") or query_data.get("query") or ""
                meta_countries = query_data.get("ad_reached_countries") or query_data.get("countries") or []
            else:
                meta_query = str(query_data or "")
                meta_countries = []
            meta_attempts.append({
                "query": meta_query,
                "countries": meta_countries,
                "count": len(item.get("results") or []),
            })

        self.stdout.write(f"Brain mode: {result.get('brain_mode', 'gemini')}")
        self.stdout.write(f"Gemini status: {result.get('gemini_status', 'unavailable')}")
        self.stdout.write(f"Fallback used: {'yes' if result.get('gemini_fallback_used') else 'no'}")
        self.stdout.write("")
        self.stdout.write("Intent")
        self.stdout.write(str(intent))
        self.stdout.write("")
        if result.get("brain_mode") == "local_fallback":
            self.stdout.write("Fallback intent")
            self.stdout.write(str(intent))
            self.stdout.write("")
        self.stdout.write("Search plan")
        self.stdout.write(str((result.get("intent") or {}).get("sources") or []))
        self.stdout.write("")
        if result.get("brain_mode") == "local_fallback":
            self.stdout.write("Fallback plan")
            self.stdout.write(str(plan.get("source_plan") or {}))
            self.stdout.write("")
        self.stdout.write(f"Sources planifiees: {planned_tools}")
        self.stdout.write(f"Sources obligatoires: {required_tools or ['aucune']}")
        self.stdout.write(f"Sources obligatoires tentees: {attempted_required_tools or ['aucune']}")
        self.stdout.write(f"Sources obligatoires restantes: {remaining_required_tools or ['aucune']}")
        self.stdout.write(f"Sources appelees: {called_tools}")
        self.stdout.write(f"Sources reussies: {successful_tools}")
        self.stdout.write(f"Sources indisponibles: {unavailable}")
        if meta_attempts:
            first_meta = meta_attempts[0]
            self.stdout.write(f"Meta Ads query: \"{first_meta['query']}\"")
            self.stdout.write(f"Meta Ads countries: {first_meta['countries']}")
            self.stdout.write("Meta Ads query attempts:")
            for index, attempt in enumerate(meta_attempts, start=1):
                self.stdout.write(f"{index}. {attempt['query']} -> {attempt['count']} candidats")
        self.stdout.write(f"Gemini calls: {result.get('gemini_calls', 0)}")
        self.stdout.write(f"stop_reason: {result.get('stop_reason')}")
        self.stdout.write(f"Raw candidates: {result.get('raw_results_count', 0)}")
        self.stdout.write(f"Unique entities: {result.get('unique_entities_count', len(companies) + len(persons) + result.get('rejected_results', 0))}")
        self.stdout.write(f"Raw results: {result.get('raw_results_count', 0)}")
        self.stdout.write(f"Merged results: {len(companies) + len(persons)}")
        self.stdout.write(f"Target valid prospects: {result.get('target_valid_prospects', max_results)}")
        self.stdout.write(f"Current valid prospects: {result.get('current_valid_prospects', len(companies) + len(persons))}")
        self.stdout.write(f"Missing: {result.get('missing_valid_prospects', 0)}")
        for item in result.get("additional_searches") or []:
            query = item.get("query") or {}
            query_text = query.get("q") if isinstance(query, dict) else query
            self.stdout.write(f"Additional search: {item.get('tool')} \"{query_text}\"")
        if not result.get("additional_searches") and len(meta_attempts) > 1:
            for attempt in meta_attempts[1:]:
                self.stdout.write(f"Additional search: ads_library_search \"{attempt['query']}\"")
        self.stdout.write(f"Target reached: {'yes' if result.get('target_reached') else 'no'}")
        self.stdout.write(f"Search space exhausted: {'yes' if result.get('search_space_exhausted') else 'no'}")
        self.stdout.write(f"Accepted: {result.get('companies_found', 0) + result.get('persons_found', 0)}")
        self.stdout.write(f"Rejected: {result.get('rejected_results', 0)}")
        self.stdout.write(f"Imported: {result.get('import_stats') or {}}")
        self.stdout.write("")

        for log in observe_logs:
            self.stdout.write(log.get("message") or "")

        rejected = result.get("rejected_details") or []
        if rejected:
            self.stdout.write("")
            self.stdout.write("REJECTED")
            for item in rejected[: max(max_results, 15)]:
                name = item.get("company_name") or item.get("full_name") or item.get("name") or item.get("title")
                reason = item.get("rejected_reason") or item.get("rejection_reason") or item.get("reason")
                self.stdout.write(_safe_console(f"- {name} | {item.get('source')} -> {reason}"))

        self.stdout.write("")
        self.stdout.write("Prospects")
        for prospect in companies + persons:
            name = prospect.get("company_name") or prospect.get("full_name")
            source = prospect.get("source")
            url = (
                prospect.get("linkedin_url")
                or prospect.get("facebook_url")
                or prospect.get("instagram_url")
                or prospect.get("website")
                or prospect.get("google_maps_url")
            )
            self.stdout.write(_safe_console(f"- {name} | {source} | {url}"))
