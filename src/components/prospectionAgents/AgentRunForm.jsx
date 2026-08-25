import PropTypes from "prop-types";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

const SOURCES = [
  "google_maps",
  "serper",
  "website",
  "facebook",
  "instagram",
  "linkedin",
  "meta_ads",
];

export default function AgentRunForm({ agentType, loading, onRun }) {
  const [query, setQuery] = useState("Trouver 20 restaurants a Tunis");
  const [url, setUrl] = useState("");
  const [maxLeads, setMaxLeads] = useState(20);
  const [sources, setSources] = useState([
    "google_maps",
    "serper",
    "website",
    "facebook",
    "instagram",
  ]);
  const [autoImport, setAutoImport] = useState(false);
  const [leadJson, setLeadJson] = useState("");

  const toggleSource = (source) => {
    setSources((current) =>
      current.includes(source) ? current.filter((item) => item !== source) : [...current, source]
    );
  };

  const buildPayload = () => {
    let leads = [];
    if (leadJson.trim()) {
      try {
        const parsed = JSON.parse(leadJson);
        leads = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        leads = [];
      }
    }
    if (agentType === "scraping") return { url };
    if (["enrichment", "validation", "qualification", "crm_import"].includes(agentType)) {
      return { leads, auto_import: autoImport };
    }
    if (agentType === "search") {
      return {
        plan: {
          queries: sources.map((source) => ({ tool: source, query, limit: maxLeads })),
          target_count: maxLeads,
          max_iterations: 10,
        },
      };
    }
    return { query, max_leads: maxLeads, sources, auto_import: autoImport };
  };

  return (
    <Stack spacing={2}>
      {["orchestrator", "intent", "planning", "search"].includes(agentType) && (
        <TextField
          label="Que recherchez-vous ?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          multiline
          minRows={3}
          fullWidth
        />
      )}

      {agentType === "scraping" && (
        <TextField
          label="URL a analyser"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          fullWidth
        />
      )}

      {["enrichment", "validation", "qualification", "crm_import"].includes(agentType) && (
        <TextField
          label="Prospects JSON"
          value={leadJson}
          onChange={(event) => setLeadJson(event.target.value)}
          multiline
          minRows={6}
          placeholder='[{"name":"Restaurant Exemple","city":"Tunis","website":"https://example.com"}]'
          fullWidth
        />
      )}

      {["orchestrator", "search"].includes(agentType) && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Nombre maximal"
              value={maxLeads}
              onChange={(event) => setMaxLeads(Number(event.target.value))}
            >
              {[10, 20, 30, 40, 50].map((count) => (
                <MenuItem key={count} value={count}>
                  {count}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={8}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {SOURCES.map((source) => (
                <FormControlLabel
                  key={source}
                  control={
                    <Checkbox
                      checked={sources.includes(source)}
                      onChange={() => toggleSource(source)}
                    />
                  }
                  label={source}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      )}

      {["orchestrator", "crm_import"].includes(agentType) && (
        <FormControlLabel
          control={
            <Checkbox
              checked={autoImport}
              onChange={(event) => setAutoImport(event.target.checked)}
            />
          }
          label="Import automatique dans le CRM"
        />
      )}

      {["enrichment", "validation", "qualification", "crm_import"].includes(agentType) &&
        !leadJson.trim() && (
          <Alert severity="info">
            Collez des prospects JSON depuis un resultat de recherche ou d&apos;orchestrateur.
          </Alert>
        )}

      <Button
        variant="contained"
        color="dark"
        disabled={loading}
        onClick={() => onRun(buildPayload())}
      >
        {loading ? "Execution..." : "Lancer"}
      </Button>
    </Stack>
  );
}

AgentRunForm.propTypes = {
  agentType: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  onRun: PropTypes.func.isRequired,
};
