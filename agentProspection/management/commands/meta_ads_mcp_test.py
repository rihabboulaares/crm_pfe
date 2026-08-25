import asyncio
import json
import shlex

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from agentProspection.tools.meta_ads_tool import (
    _items_from_mcp_result,
    _json_dict,
    _schema_accepts_array,
    _to_plain_tool,
    build_args_from_schema,
    dedupe_meta_ads_candidates,
    meta_ads_identity_key,
    normalize_meta_ads_result,
)


def _json(data) -> str:
    text = json.dumps(data, ensure_ascii=False, indent=2, default=str)
    return _redact_sensitive_text(text)


def _redact_sensitive_text(text: str) -> str:
    return str(text).replace("META_ACCESS_TOKEN", "[REDACTED_ENV]")


def _safe_payload(result) -> dict:
    payload = getattr(result, "structuredContent", None) or getattr(result, "structured_content", None)
    if isinstance(payload, dict):
        return {key: payload.get(key) for key in ("success", "status", "error", "ads_count") if key in payload}
    for content in getattr(result, "content", []) or []:
        text = getattr(content, "text", None)
        if not text:
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return {key: parsed.get(key) for key in ("success", "status", "error", "ads_count") if key in parsed}
    return {}


class Command(BaseCommand):
    help = "Teste la connexion MCP Meta Ads sans afficher de secrets."

    def add_arguments(self, parser):
        parser.add_argument("--list-tools", action="store_true")
        parser.add_argument("--query")
        parser.add_argument("--country", default=None)
        parser.add_argument("--limit", type=int, default=5)

    async def _open_session(self):
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        if not settings.META_ADS_MCP_COMMAND:
            raise CommandError("META_ADS_MCP_COMMAND est vide. Activez META_ADS_MCP_ENABLED ou configurez la commande MCP.")

        args = shlex.split(settings.META_ADS_MCP_ARGS or "")
        env = _json_dict(getattr(settings, "META_ADS_MCP_ENV_JSON", "{}"))
        server_params = StdioServerParameters(
            command=settings.META_ADS_MCP_COMMAND,
            args=args,
            env=env or None,
        )
        return stdio_client(server_params), ClientSession

    async def _list_tools(self):
        stdio_ctx, session_class = await self._open_session()
        async with stdio_ctx as (read, write):
            async with session_class(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                return [_to_plain_tool(tool) for tool in getattr(tools_result, "tools", [])]

    async def _call_tool(self, query: str, country: str | None, limit: int):
        stdio_ctx, session_class = await self._open_session()
        async with stdio_ctx as (read, write):
            async with session_class(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                tools = [_to_plain_tool(tool) for tool in getattr(tools_result, "tools", [])]
                tool_name = settings.META_ADS_MCP_TOOL_NAME
                selected = next((tool for tool in tools if tool.get("name") == tool_name), None)
                if not selected:
                    raise CommandError(f"Tool {tool_name} introuvable dans tools/list.")
                schema = selected.get("inputSchema") or {}
                args = build_args_from_schema(schema, {"q": query, "page": 1})
                props = schema.get("properties") or {}
                if "limit" in props:
                    args["limit"] = limit
                if country:
                    for field in ("ad_reached_countries", "countries", "country"):
                        if field in props:
                            prop = props.get(field) or {}
                            args[field] = [country] if _schema_accepts_array(prop) else country
                            break
                result = await session.call_tool(tool_name, args)
                return selected, args, _items_from_mcp_result(result), result

    def handle(self, *args, **options):
        if not options["list_tools"] and not options.get("query"):
            raise CommandError("Utilisez --list-tools ou --query.")

        self.stdout.write("Connexion MCP Meta Ads")
        self.stdout.write(f"transport: {settings.META_ADS_MCP_TRANSPORT}")
        self.stdout.write(f"server: {settings.META_ADS_MCP_SERVER_NAME}")
        self.stdout.write(f"command_configured: {bool(settings.META_ADS_MCP_COMMAND)}")
        self.stdout.write(f"args_configured: {bool(settings.META_ADS_MCP_ARGS)}")
        self.stdout.write(f"tool_name: {settings.META_ADS_MCP_TOOL_NAME}")
        self.stdout.write("")

        if options["list_tools"]:
            tools = asyncio.run(self._list_tools())
            self.stdout.write("tools/list")
            self.stdout.write(_json(tools))
            return

        selected, call_args, items, raw_result = asyncio.run(
            self._call_tool(options["query"], options.get("country"), options["limit"])
        )
        self.stdout.write("Tool selectionne")
        self.stdout.write(_json(selected))
        self.stdout.write("")
        self.stdout.write("Appel reel")
        self.stdout.write(_json({"tool": selected.get("name"), "args": call_args}))
        self.stdout.write("")
        status_payload = _safe_payload(raw_result)
        if status_payload:
            self.stdout.write("Statut payload")
            self.stdout.write(_json(status_payload))
            self.stdout.write("")
        candidates = dedupe_meta_ads_candidates(items)
        unique_advertisers = {
            meta_ads_identity_key(normalize_meta_ads_result(item))
            for item in items
            if isinstance(item, dict) and meta_ads_identity_key(normalize_meta_ads_result(item)) != "name:"
        }
        ads_count = status_payload.get("ads_count") if status_payload else None
        self.stdout.write(f"Ads recues: {ads_count if ads_count is not None else len(items)}")
        self.stdout.write(f"Annonceurs uniques: {len(unique_advertisers)}")
        self.stdout.write(f"Candidats apres normalisation: {len(candidates)}")
        self.stdout.write(_json(candidates[:5]))
        if getattr(raw_result, "isError", False):
            self.stdout.write("MCP a retourne isError=true")
