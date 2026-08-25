/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { styled } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TimelineIcon from "@mui/icons-material/Timeline";
import WarningIcon from "@mui/icons-material/Warning";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import MessageIcon from "@mui/icons-material/Message";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import DescriptionIcon from "@mui/icons-material/Description";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import PaginationBar from "../../components/PaginationBar";

const API = "/api/notifications";
const C = {
  red: "#dc2626",
  ink: "var(--crm-text)",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n500: "var(--crm-muted)",
  n700: "var(--crm-text)",
  surface: "var(--crm-surface)",
  raised: "var(--crm-surface-raised)",
  border: "var(--crm-border)",
  text: "var(--crm-text)",
  muted: "var(--crm-muted)",
  green: "#059669",
  blue: "#2563eb",
  amber: "#d97706",
  purple: "#7c3aed",
};

const categories = [
  ["", "Tout"],
  ["commercial", "Commercial"],
  ["prospect", "Prospects"],
  ["agent", "Agents IA"],
  ["engagement", "Engagement"],
  ["scoring", "Scoring"],
  ["document", "Documents"],
  ["opportunity", "Opportunités"],
  ["system", "Système"],
  ["audit", "Audit"],
];

const severityCfg = {
  info: { label: "Info", color: C.blue },
  success: { label: "Succès", color: C.green },
  warning: { label: "Warning", color: C.amber },
  critical: { label: "Critique", color: C.red },
};

const auditSeverity = {
  create: "success",
  update: "info",
  assign: "info",
  unassign: "warning",
  status: "info",
  stage: "info",
  comment: "info",
  invite: "success",
  delete: "critical",
};

const categoryIcon = {
  agent: <SmartToyIcon />,
  engagement: <MessageIcon />,
  scoring: <TrendingUpIcon />,
  document: <DescriptionIcon />,
  opportunity: <BusinessIcon />,
};

const StyledTableContainer = styled(TableContainer)(() => ({
  borderRadius: 16,
  boxShadow: "var(--crm-shadow-sm)",
  border: `1px solid ${C.border}`,
  background: C.surface,
  overflowX: "auto",
  "& .MuiTable-root": { minWidth: 1180, borderCollapse: "collapse", tableLayout: "fixed" },
}));

const StyledTableHead = styled(TableHead)(() => ({
  "& .MuiTableCell-head": {
    fontWeight: 700,
    color: C.red,
    fontSize: "0.85rem",
    padding: "16px 8px",
    backgroundColor: alpha(C.red, 0.04),
    borderBottom: `2px solid ${C.red}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  "&:hover": { backgroundColor: alpha(C.red, 0.02), cursor: "pointer" },
  "& td": {
    padding: "12px 8px",
    borderBottom: `1px solid ${C.border}`,
    color: C.text,
  },
}));

const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
const fmtDateTime = (value) => (value ? new Date(value).toLocaleString("fr-FR") : "-");
const fmtShortDate = (value) =>
  value ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "-";
const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const rowMinute = (value) => Math.floor(new Date(value || 0).getTime() / 60000);
const rowTime = (value) => new Date(value || 0).getTime();
const rowDedupKey = (event) =>
  [
    normalizeText(event.description || event.title || event.event_type_display),
    normalizeText(
      event.prospect_display ||
        event.company_display ||
        event.related_object_type ||
        event.related_object_id ||
        event.source_id
    ),
    rowMinute(event.created_at),
  ].join("|");
const rowTargetText = (event) =>
  normalizeText(
    event.prospect_display ||
      event.company_display ||
      event.entity_name ||
      event.description ||
      event.title ||
      event.related_object_type
  );
const quotedText = (value) => {
  const match = String(value || "").match(/[«"]([^»"]+)[»"]/);
  return normalizeText(match?.[1] || "");
};
const rowComparableTargets = (event) =>
  [
    rowTargetText(event),
    quotedText(event.description),
    quotedText(event.title),
    normalizeText(event.related_object_type),
  ].filter(Boolean);
const normalizeEntityType = (value) =>
  normalizeText(value)
    .replace(/^sales\./, "")
    .replace("prospect activity", "prospect_activity")
    .replace("prospect document", "prospect_document")
    .replace("score history", "score_history");
const sameBusinessEntity = (audit, activity) => {
  const auditEntityType = normalizeEntityType(audit.related_object_type || audit.entity_type);
  const activityEntityType = normalizeEntityType(activity.related_object_type || activity.category);
  const auditEntityId = String(audit.related_object_id || audit.entity_id || "");
  const activityEntityId = String(
    activity.related_object_id ||
      activity.prospect ||
      activity.metadata?.entity_id ||
      activity.metadata?.prospect_id ||
      ""
  );

  if (auditEntityType === "prospect" && activity.event_type === "prospect_created") {
    return (
      auditEntityId && String(activity.prospect || activity.related_object_id) === auditEntityId
    );
  }

  return Boolean(
    auditEntityType &&
      activityEntityType &&
      auditEntityId &&
      activityEntityId &&
      auditEntityType === activityEntityType &&
      auditEntityId === activityEntityId
  );
};
const isNearSameAction = (activity, audit) =>
  Math.abs(rowTime(activity.created_at) - rowTime(audit.created_at)) <= 5 * 60 * 1000;
const auditLooksCoveredByActivity = (audit, activityRows) => {
  const auditTargets = rowComparableTargets(audit);
  const auditSource = normalizeText(audit.source_name || audit.user_display);
  return activityRows.some((activity) => {
    if (sameBusinessEntity(audit, activity) && isNearSameAction(activity, audit)) {
      return true;
    }

    const activityTargets = rowComparableTargets(activity);
    const activitySource = normalizeText(activity.source_name || activity.user_display);
    const sameTarget = auditTargets.some((auditTarget) =>
      activityTargets.some(
        (activityTarget) =>
          activityTarget.includes(auditTarget) || auditTarget.includes(activityTarget)
      )
    );
    const sameSource =
      !auditSource ||
      !activitySource ||
      activitySource.includes(auditSource) ||
      auditSource.includes(activitySource);
    return sameTarget && sameSource && isNearSameAction(activity, audit);
  });
};
const metadataLabel = (key) =>
  ({
    activity_type: "Type d'activité",
    agent_type: "Agent",
    channel: "Canal",
    source: "Source",
    status: "Statut",
    previous_score: "Ancien score",
    new_score: "Nouveau score",
    variation: "Variation",
    reason: "Raison",
    document_type: "Type de document",
    name: "Nom",
  }[key] || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()));
const hiddenMetadataKeys = new Set([
  "entity_id",
  "entity_type",
  "activity_id",
  "agent_run_id",
  "document_id",
]);
const formatMetadataValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(formatMetadataValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, item]) => item !== null && item !== undefined && item !== ""
    );
    if (!entries.length) return "";
    return entries
      .slice(0, 6)
      .map(([key, item]) => `${metadataLabel(key)}: ${formatMetadataValue(item)}`)
      .join(" | ");
  }
  return String(value);
};
const formatAuditChanges = (metadata) => {
  const oldValue = metadata.old_value || {};
  const newValue = metadata.new_value || {};
  const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));
  return keys
    .map((key) => {
      const before = formatMetadataValue(oldValue[key]);
      const after = formatMetadataValue(newValue[key]);
      if (!before && !after) return "";
      if (before === after) return `${metadataLabel(key)}: ${after}`;
      return `${metadataLabel(key)}: ${before || "-"} → ${after || "-"}`;
    })
    .filter(Boolean)
    .join("\n");
};
const displayMetadataEntries = (metadata) => {
  const changes = formatAuditChanges(metadata);
  const entries = Object.entries(metadata)
    .filter(([key]) => !hiddenMetadataKeys.has(key) && key !== "old_value" && key !== "new_value")
    .map(([key, value]) => [metadataLabel(key), formatMetadataValue(value)])
    .filter(([, value]) => value);

  return changes ? [["Changements", changes], ...entries] : entries;
};

function StatCard({ title, value, helper, icon, color }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${alpha(color, 0.18)}`,
        borderTop: `3px solid ${color}`,
        bgcolor: C.surface,
        color: C.text,
        boxShadow: "var(--crm-shadow-sm)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography sx={{ fontSize: 10, fontWeight: 900, color: C.n500 }}>{title}</Typography>
          <Typography sx={{ fontSize: 27, fontWeight: 950, color: C.ink, lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography sx={{ fontSize: 11, color: C.n500, mt: 0.4 }}>{helper}</Typography>
        </Box>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor: alpha(color, 0.1),
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& svg": { fontSize: 22 },
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  );
}

function EventBadge({ event }) {
  const cfg = severityCfg[event.severity] || severityCfg.info;
  return (
    <Chip
      size="small"
      label={cfg.label}
      sx={{ bgcolor: alpha(cfg.color, 0.1), color: cfg.color, fontWeight: 800, borderRadius: 1 }}
    />
  );
}

function EventDrawer({ event, onClose }) {
  const metadata = event?.metadata || {};
  const metadataEntries = displayMetadataEntries(metadata);
  return (
    <Drawer
      anchor="right"
      open={Boolean(event)}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 460 }, p: 3 } }}
    >
      {!event ? null : (
        <Stack spacing={2.2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography sx={{ fontSize: 11, color: C.n500, fontWeight: 900 }}>
                {event.category_display}
              </Typography>
              <Typography sx={{ fontSize: 22, color: C.ink, fontWeight: 950 }}>
                {event.title}
              </Typography>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <EventBadge event={event} />
          <Info label="Date" value={fmtDateTime(event.created_at)} />
          <Info label="Type" value={event.row_type || "Activité CRM"} />
          <Info label="Source" value={event.source_name || event.source_type} />
          <Info label="Prospect" value={event.prospect_display || "-"} />
          <Info label="Utilisateur" value={event.user_display || "-"} />
          <Info label="Canal" value={event.channel || metadata.channel || "-"} />
          <Info label="Statut" value={event.status || "-"} />
          <Info label="Description" value={event.description || "-"} multiline />
          {metadataEntries.length > 0 && (
            <Paper
              elevation={0}
              sx={{ p: 2, borderRadius: 2, bgcolor: C.raised, border: `1px solid ${C.border}` }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 900, color: C.n700, mb: 1 }}>
                Métadonnées
              </Typography>
              {metadataEntries.slice(0, 12).map(([key, value]) => (
                <Info
                  key={key}
                  label={key}
                  value={value}
                  multiline={String(value).includes("\n")}
                />
              ))}
            </Paper>
          )}
          {event.prospect && (
            <Button
              variant="contained"
              href={`/prospects/${event.prospect}`}
              sx={{ bgcolor: C.red, textTransform: "none", fontWeight: 800 }}
            >
              Voir prospect
            </Button>
          )}
        </Stack>
      )}
    </Drawer>
  );
}

function Info({ label, value, multiline }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 900, color: C.n500 }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 13,
          fontWeight: 700,
          color: C.n700,
          whiteSpace: multiline ? "pre-wrap" : "normal",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function ActivityCenter() {
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState([]);
  const [attention, setAttention] = useState([]);
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ period: "", severity: "", event_type: "" });
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const p = new URLSearchParams({ page, page_size: 25 });
    if (category) p.set("category", category);
    if (search) p.set("search", search);
    Object.entries(filters).forEach(([key, value]) => value && p.set(key, value));
    return p;
  }, [category, filters, page, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      axios.get(`${API}/activity/?${params}`, authHeader()),
      axios.get(
        `${API}/history/?page=${page}&search=${encodeURIComponent(search || "")}`,
        authHeader()
      ),
      axios.get(`${API}/activity/stats/?${params}`, authHeader()),
      axios.get(`${API}/activity/summary/`, authHeader()),
      axios.get(`${API}/activity/attention/`, authHeader()),
    ])
      .then(([activityRes, auditRes, statsRes, summaryRes, attentionRes]) => {
        if (cancelled) return;
        const activityTotal = activityRes.data.total || 0;
        const visibleAuditTotal = category && category !== "audit" ? 0 : auditRes.data.total || 0;
        setEvents(activityRes.data.results || []);
        setAuditLogs(category && category !== "audit" ? [] : auditRes.data.results || []);
        setTotal(activityTotal + visibleAuditTotal);
        setPages(
          category && category !== "audit"
            ? activityRes.data.pages || 1
            : Math.max(activityRes.data.pages || 1, auditRes.data.pages || 1)
        );
        setStats(statsRes.data || {});
        setSummary(summaryRes.data.items || []);
        setAttention(attentionRes.data.alerts || []);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger le centre d'activité.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, page, params, search]);

  const unifiedRows = useMemo(() => {
    const activityRows = events.map((event) => ({
      ...event,
      row_key: `activity-${event.id}`,
      row_type: "Activité CRM",
      row_color: severityCfg[event.severity]?.color || C.blue,
    }));
    const auditRows = auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      raw_id: log.id,
      row_key: `audit-${log.id}`,
      row_type: "Journal d'audit",
      row_color: severityCfg[auditSeverity[log.action] || "info"]?.color || C.blue,
      event_type_display: log.action_display || log.action,
      category_display: log.entity_display || log.entity_type,
      category: "audit",
      title: log.description || `${log.action_display || log.action} ${log.entity_name || ""}`,
      description: log.description || "",
      severity: auditSeverity[log.action] || "info",
      source_type: "audit",
      source_name: log.performed_by_display || log.actor_name || log.actor?.username || "Système",
      source_id: log.id,
      user_display: log.performed_by_display || log.actor_name || log.actor?.username || "Système",
      prospect_display: log.entity_name || "",
      company_display: "",
      related_object_type: log.entity_type,
      related_object_id: log.entity_id,
      status: log.action,
      channel: "",
      metadata: {
        old_value: log.old_value || {},
        new_value: log.new_value || {},
        entity_type: log.entity_type,
        entity_id: log.entity_id,
      },
      created_at: log.created_at,
      is_audit: true,
    }));
    const coveredAuditRows = auditRows.filter(
      (audit) => !auditLooksCoveredByActivity(audit, activityRows)
    );
    const seen = new Set();
    return [...activityRows, ...coveredAuditRows]
      .filter((event) => {
        const key = rowDedupKey(event);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [auditLogs, events]);

  const exportVisibleRows = () => {
    try {
      const headers = [
        "Type",
        "Date",
        "Source",
        "Événement",
        "Élément concerné",
        "Détails",
        "Statut",
      ];
      const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = unifiedRows.map((event) =>
        [
          event.row_type,
          fmtDateTime(event.created_at),
          event.source_name || event.source_type,
          event.event_type_display,
          event.prospect_display || event.company_display || event.related_object_type || "",
          event.description || event.title,
          severityCfg[event.severity]?.label || event.status || "",
        ].map(escapeCsv)
      );
      const csv = [headers.map(escapeCsv), ...rows].map((row) => row.join(";")).join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `crm_historique_activite_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Impossible d'exporter le tableau.");
    }
  };

  return (
    <Box>
      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="TOTAL ÉVÉNEMENTS"
            value={loading ? "-" : total}
            helper="Activités CRM + audit"
            icon={<TimelineIcon />}
            color={C.red}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="ACTIVITÉS COMMERCIALES"
            value={stats?.commercial ?? "-"}
            helper={`Semaine : ${stats?.week ?? 0}`}
            icon={<BusinessIcon />}
            color={C.blue}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="ACTIONS IA"
            value={stats?.agents ?? "-"}
            helper="Agents suivis"
            icon={<SmartToyIcon />}
            color={C.purple}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="À SURVEILLER"
            value={stats?.attention ?? "-"}
            helper="Warning + critique"
            icon={<WarningIcon />}
            color={C.amber}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.border}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 950, color: C.ink }}>
              Résumé unifié
            </Typography>
            {summary.length ? (
              <Stack direction="row" flexWrap="wrap" gap={1} mt={1.5}>
                {summary.map((item) => (
                  <Chip
                    key={item.label}
                    label={`${item.count} ${item.label}`}
                    sx={{ fontWeight: 800, borderRadius: 1 }}
                  />
                ))}
              </Stack>
            ) : (
              <Typography sx={{ fontSize: 13, color: C.n500, mt: 1 }}>
                Aucun événement aujourd&apos;hui.
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.border}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 950, color: C.ink }}>
              À surveiller
            </Typography>
            {attention.length ? (
              <Stack spacing={1} mt={1.2}>
                {attention.slice(0, 4).map((item) => (
                  <Button
                    key={item.label}
                    size="small"
                    onClick={() => setFilters((prev) => ({ ...prev, ...item.filter }))}
                    sx={{ justifyContent: "space-between", textTransform: "none", color: C.n700 }}
                  >
                    <span>{item.label}</span>
                    <Chip size="small" label={item.count} />
                  </Button>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ fontSize: 13, color: C.n500, mt: 1 }}>
                Aucun événement critique.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.border}`, mb: 2.5 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.3}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <TextField
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher prospect, entreprise, agent, document..."
            sx={{ minWidth: { md: 360 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchInput("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              startIcon={<FilterListIcon />}
              onClick={() => setFiltersOpen(true)}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              Filtres
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={exportVisibleRows}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              Exporter tableau
            </Button>
          </Stack>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={0.8} mt={2}>
          {categories.map(([value, label]) => (
            <Chip
              key={label}
              label={label}
              onClick={() => {
                setCategory(value);
                setPage(1);
              }}
              sx={{
                borderRadius: 1,
                fontWeight: 800,
                bgcolor: category === value ? alpha(C.red, 0.12) : C.raised,
                color: category === value ? C.red : C.n700,
                border: `1px solid ${category === value ? alpha(C.red, 0.26) : C.border}`,
              }}
            />
          ))}
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack spacing={1}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={58} />
          ))}
        </Stack>
      ) : !unifiedRows.length ? (
        <Paper
          elevation={0}
          sx={{ p: 5, textAlign: "center", borderRadius: 2, border: `1px solid ${C.border}` }}
        >
          <TimelineIcon sx={{ color: alpha(C.red, 0.35), fontSize: 46, mb: 1 }} />
          <Typography sx={{ fontWeight: 900, color: C.ink }}>
            Aucune entrée correspondant aux filtres.
          </Typography>
          <Typography sx={{ fontSize: 13, color: C.n500 }}>
            Les événements métier et le journal d&apos;audit apparaîtront ici automatiquement.
          </Typography>
        </Paper>
      ) : (
        <StyledTableContainer>
          <Table size="small">
            <StyledTableHead>
              <TableRow>
                <TableCell sx={{ width: 150 }}>Type</TableCell>
                <TableCell sx={{ width: 110 }}>Date</TableCell>
                <TableCell sx={{ width: 170 }}>Source</TableCell>
                <TableCell sx={{ width: 190 }}>Événement</TableCell>
                <TableCell sx={{ width: 190 }}>Élément concerné</TableCell>
                <TableCell>Détails</TableCell>
                <TableCell sx={{ width: 120 }}>Statut</TableCell>
                <TableCell sx={{ width: 80, textAlign: "center" }}>Action</TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {unifiedRows.map((event) => (
                <StyledTableRow key={event.row_key} hover>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={event.is_audit ? <HistoryIcon /> : <TimelineIcon />}
                      label={event.row_type}
                      sx={{
                        borderRadius: 1,
                        fontWeight: 800,
                        bgcolor: alpha(event.row_color, 0.1),
                        color: event.row_color,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color={C.ink}>
                      {fmtShortDate(event.created_at)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {event.source_name || event.source_type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {event.source_type || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {event.is_audit ? (
                        <HistoryIcon />
                      ) : (
                        categoryIcon[event.category] || <TimelineIcon />
                      )}
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {event.event_type_display}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {event.prospect_display ||
                        event.company_display ||
                        event.related_object_type ||
                        "-"}
                    </Typography>
                    {event.related_object_type && (
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {event.related_object_type}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {event.description || event.title || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <EventBadge event={event} />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => setSelected(event)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}

      <Box display="flex" justifyContent="center" mt={2}>
        <PaginationBar
          page={page}
          pages={pages}
          total={total}
          pageSize={25}
          onPageChange={setPage}
          loading={loading}
        />
      </Box>

      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 3 } }}
      >
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 18, fontWeight: 950 }}>Filtres avancés</Typography>
            <IconButton onClick={() => setFiltersOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel>Période</InputLabel>
            <Select
              label="Période"
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value })}
            >
              <MenuItem value="">Toutes</MenuItem>
              <MenuItem value="today">Aujourd&apos;hui</MenuItem>
              <MenuItem value="7d">7 derniers jours</MenuItem>
              <MenuItem value="30d">30 derniers jours</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Sévérité</InputLabel>
            <Select
              label="Sévérité"
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            >
              <MenuItem value="">Toutes</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="success">Succès</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="critical">Critique</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Type d'événement"
            value={filters.event_type}
            onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
          />
          <Button
            onClick={() => setFilters({ period: "", severity: "", event_type: "" })}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Réinitialiser
          </Button>
        </Stack>
      </Drawer>

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
