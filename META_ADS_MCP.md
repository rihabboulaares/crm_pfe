# Meta Ads MCP

Le serveur MCP Meta Ads du projet est un serveur stdio local expose par Django.

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

Quand `META_ADS_MCP_COMMAND` et `META_ADS_MCP_ARGS` ne sont pas definis, `config/settings.py`
configure automatiquement:

```text
command = sys.executable
args = -m agentProspection.mcp.meta_ads_server
```

## Verification

Lister les tools exposes:

```bash
python manage.py meta_ads_mcp_test --list-tools
```

Executer un appel reel:

```bash
python manage.py meta_ads_mcp_test --query "cosmetique Tunisie" --country TN --limit 5
```

La commande n'affiche pas les tokens OAuth. Les logs HTTP sortants verbeux sont desactives
dans le serveur MCP.
