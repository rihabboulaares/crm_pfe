# Meta Ads Library MCP Discovery

`ads_library_search` est une source Discovery optionnelle pour `agentProspection`.
Elle passe par un serveur MCP stdio local et n'utilise ni scraping, ni cookies, ni login Facebook.

## Configuration

Variables utilisees:

```env
META_ADS_MCP_ENABLED=true
META_ADS_MCP_TRANSPORT=stdio
META_ADS_MCP_SERVER_NAME=viewise-meta-ads
META_ADS_MCP_TOOL_NAME=ads_library_search
META_ADS_MCP_TIMEOUT_SECONDS=20
META_GRAPH_API_VERSION=v26.0
META_GRAPH_API_BASE_URL=https://graph.facebook.com
META_ADS_DEFAULT_COUNTRY=TN
META_ADS_MAX_RESULTS=50
META_ADS_REQUEST_TIMEOUT_SECONDS=20
META_ACCESS_TOKEN=<meta-access-token>
```

Quand `META_ADS_MCP_COMMAND` et `META_ADS_MCP_ARGS` ne sont pas definis,
`config/settings.py` configure automatiquement:

```text
command = sys.executable
args = -m agentProspection.mcp.meta_ads_server
```

Au runtime le wrapper:

1. demarre le serveur MCP configure en stdio;
2. appelle `tools/list`;
3. trouve `ads_library_search`;
4. lit son `inputSchema` reel;
5. construit l'appel a partir de ce schema;
6. normalise les annonceurs Meta Ads Library en leads Discovery.

## Verification

```bash
python manage.py meta_ads_mcp_test --list-tools
python manage.py meta_ads_mcp_test --query "cosmetique Tunisie" --country TN --limit 5
```

La commande n'affiche pas les tokens OAuth. Les logs HTTP sortants verbeux sont
desactives dans le serveur MCP.
