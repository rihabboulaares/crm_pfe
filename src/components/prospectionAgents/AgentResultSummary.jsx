import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import Icon from "@mui/material/Icon";
import { useMemo, useState } from "react";

const CONTACT_FIELDS = [
  ["email", "alternate_email", "Email"],
  ["phone", "call", "Telephone"],
  ["website", "language", "Site"],
  ["facebook", "facebook", "Facebook"],
  ["instagram", "photo_camera", "Instagram"],
  ["linkedin", "business_center", "LinkedIn"],
  ["contact_form", "dynamic_form", "Formulaire"],
];

const STATUS_COLORS = {
  qualified: "success",
  validated: "success",
  enriched: "info",
  raw: "default",
  needs_enrichment: "warning",
  rejected: "error",
};

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickLeads(data) {
  return (
    asArray(data.qualified_leads).concat(
      asArray(data.validated_leads),
      asArray(data.leads),
      data.lead ? [data.lead] : [],
      asArray(data.enriched_leads),
      asArray(data.raw_leads)
    ) || []
  ).filter(Boolean);
}

function countContacts(lead) {
  return CONTACT_FIELDS.filter(([field]) => lead?.[field]).length;
}

function scoreColor(score) {
  if (score >= 80) return "success";
  if (score >= 60) return "info";
  if (score >= 40) return "warning";
  return "default";
}

function contactHref(field, value) {
  if (!value) return "";
  if (field === "email") return `mailto:${value}`;
  if (field === "phone") return `tel:${value}`;
  if (String(value).startsWith("http")) return value;
  return "";
}

function LeadNameCell({ lead }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" fontWeight={700}>
        {lead.name || lead.company_name || "Prospect"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {[lead.industry || lead.category, lead.city, lead.country].filter(Boolean).join(" · ") ||
          "Informations a completer"}
      </Typography>
    </Stack>
  );
}

LeadNameCell.propTypes = {
  lead: PropTypes.object.isRequired,
};

function ContactChips({ lead }) {
  const contacts = CONTACT_FIELDS.filter(([field]) => lead?.[field]);
  if (contacts.length === 0) {
    return <Chip size="small" color="warning" label="Aucun contact" variant="outlined" />;
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {contacts.map(([field, icon, label]) => {
        const href = contactHref(field, lead[field]);
        const chip = (
          <Chip
            size="small"
            icon={<Icon>{icon}</Icon>}
            label={label}
            color={field === "email" || field === "phone" ? "success" : "default"}
            variant={field === "email" || field === "phone" ? "filled" : "outlined"}
          />
        );
        return href ? (
          <Tooltip key={field} title={lead[field]}>
            <Link
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              underline="none"
            >
              {chip}
            </Link>
          </Tooltip>
        ) : (
          <Tooltip key={field} title={lead[field]}>
            {chip}
          </Tooltip>
        );
      })}
    </Box>
  );
}

ContactChips.propTypes = {
  lead: PropTypes.object.isRequired,
};

function MetricCard({ icon, label, value, tone }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        height: "100%",
        bgcolor:
          tone === "success" ? "#f0fdf4" : tone === "warning" ? "#fffbeb" : "background.paper",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(17, 24, 39, 0.06)",
          }}
        >
          <Icon>{icon}</Icon>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {value ?? 0}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

MetricCard.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tone: PropTypes.string,
};

MetricCard.defaultProps = {
  value: 0,
  tone: "default",
};

export default function AgentResultSummary({ result }) {
  const [showDetails, setShowDetails] = useState(false);

  const data = useMemo(() => result?.results || {}, [result]);
  const leads = useMemo(() => pickLeads(data), [data]);
  const uniqueLeads = useMemo(() => {
    const seen = new Set();
    return leads.filter((lead) => {
      const key = lead.id || lead.website || lead.email || lead.phone || lead.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [leads]);

  if (!result) return null;

  const counts = data.counts || {};
  const totalContacts = uniqueLeads.reduce((total, lead) => total + countContacts(lead), 0);
  const topScore = uniqueLeads.reduce((max, lead) => Math.max(max, Number(lead.score || 0)), 0);
  const rejectedCount = counts.rejected ?? data.rejected_leads?.length ?? 0;
  const importedCount = data.import_result?.imported?.length ?? data.imported?.length ?? 0;
  const pendingImport =
    data.import_result?.pending_import?.length ?? data.pending_import?.length ?? 0;

  return (
    <Stack spacing={2.5} mt={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
              <Icon color={result.success ? "success" : "warning"}>
                {result.success ? "check_circle" : "error"}
              </Icon>
              <Typography variant="h5" fontWeight={800}>
                Resultats de l&apos;agent
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Execution #{result.execution_id || "-"} · Statut {result.status || "termine"} ·{" "}
              {result.metrics?.duration_seconds ?? 0}s
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`${uniqueLeads.length} prospect${uniqueLeads.length > 1 ? "s" : ""}`}
              color="primary"
            />
            {pendingImport > 0 && (
              <Chip label={`${pendingImport} en attente d'import`} color="warning" />
            )}
            {importedCount > 0 && <Chip label={`${importedCount} importe(s)`} color="success" />}
          </Stack>
        </Stack>
      </Paper>

      {result.errors?.length > 0 && (
        <Alert severity="warning">{result.errors.filter(Boolean).join(" | ")}</Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <MetricCard icon="travel_explore" label="Bruts" value={counts.raw ?? data.raw_count} />
        </Grid>
        <Grid item xs={6} md={3}>
          <MetricCard
            icon="verified"
            label="Valides"
            value={counts.validated ?? data.validated_leads?.length}
            tone="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <MetricCard icon="leaderboard" label="Meilleur score" value={topScore} tone="success" />
        </Grid>
        <Grid item xs={6} md={3}>
          <MetricCard icon="person_off" label="Rejetes" value={rejectedCount} tone="warning" />
        </Grid>
      </Grid>

      {data.intent && (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={800} mb={1.5}>
            Cible detectee
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<Icon>business</Icon>}
              label={data.intent.industry || "Secteur non precise"}
            />
            <Chip
              icon={<Icon>place</Icon>}
              label={data.intent.location || data.intent.country || "Lieu non precise"}
            />
            <Chip
              icon={<Icon>groups</Icon>}
              label={`${data.intent.max_leads || "-"} prospects demandes`}
            />
            {(data.intent.preferred_sources || []).map((source) => (
              <Chip key={source} label={source} variant="outlined" />
            ))}
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                Prospects a exploiter
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {totalContacts} moyen(s) de contact detecte(s). Les prospects sans contact restent a
                enrichir.
              </Typography>
            </Box>
            <Tooltip title="Afficher les details techniques">
              <IconButton onClick={() => setShowDetails((open) => !open)}>
                <Icon>{showDetails ? "expand_less" : "data_object"}</Icon>
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Divider />
        {uniqueLeads.length > 0 ? (
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Prospect</TableCell>
                  <TableCell>Contacts</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Sources</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uniqueLeads.map((lead, index) => (
                  <TableRow
                    hover
                    key={lead.id || lead.website || lead.email || `${lead.name}-${index}`}
                  >
                    <TableCell sx={{ minWidth: 240 }}>
                      <LeadNameCell lead={lead} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 260 }}>
                      <ContactChips lead={lead} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={lead.score ? `${lead.score}/100` : "-"}
                        color={scoreColor(Number(lead.score || 0))}
                        variant={lead.score ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={lead.status || "raw"}
                        color={STATUS_COLORS[lead.status] || "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {asArray(lead.sources)
                          .slice(0, 4)
                          .map((source) => (
                            <Chip key={source} size="small" label={source} variant="outlined" />
                          ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ p: 3 }}>
            <Alert severity="info">Aucun prospect presentable dans ce resultat.</Alert>
          </Box>
        )}
      </Paper>

      <Collapse in={showDetails}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, maxHeight: 520, overflow: "auto" }}>
          <Typography variant="subtitle2" fontWeight={800} mb={1}>
            Details techniques
          </Typography>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </Paper>
      </Collapse>
    </Stack>
  );
}

AgentResultSummary.propTypes = {
  result: PropTypes.object,
};

AgentResultSummary.defaultProps = {
  result: null,
};
