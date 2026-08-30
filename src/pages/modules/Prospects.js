/* eslint-disable prettier/prettier */
// src/pages/modules/Prospects.jsx — pagination BACKEND
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// LIGNE 7 - Modifier le chemin d'import
import { syncTaskToCalendar } from "../../components/calendarSyncService";
import axios from "axios";

let XLSX = null;
try {
  XLSX = require("xlsx");
} catch (e) {
  console.warn("Module xlsx non installé.");
}

import {
  Grid,
  Box,
  Stack,
  Paper,
  Card,
  CardContent,
  Drawer,
  TextField,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  ButtonGroup,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Avatar,
  Chip,
  Badge,
  Divider,
  Alert,
  Backdrop,
  CircularProgress,
  Snackbar,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Tooltip,
  Collapse,
  alpha,
  styled,
  LinearProgress,
  TextareaAutosize,
} from "@mui/material";

import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Restore as RestoreIcon,
  Visibility as VisibilityIcon,
  Sort as SortIcon,
  ViewColumn as ViewColumnIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  CalendarToday as CalendarIcon,
  LinkedIn as LinkedInIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Language as LanguageIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  PersonOutline as PersonOutlineIcon,
  Note as NoteIcon,
  Groups as MeetingIcon,
  Send as SendIcon,
  AutoFixHigh as TriggerIcon,
  Assignment as TaskIcon,
  AccessTime as ClockIcon,
  EscalatorWarning as EscalateIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  LocationOn as LocationOnIcon,
  OpenInNew as OpenInNewIcon,
  MoreVert as MoreVertIcon,
} from "@mui/icons-material";

import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../superadmin/Marketingwidgets";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import PaginationBar from "../../components/PaginationBar";
import api from "../../services/salesApi";
import { getDiscoveryReportBlob, runDiscovery } from "../../services/prospectAgentApi";
import {
  discoveryFailedCount,
  discoveryImportedCount,
  discoveryResultMessage,
  discoverySummarySources,
  normalizeProspectSources,
} from "../../utils/prospectSources";
import {
  PROSPECT_SOURCE_OPTIONS,
  SOURCE_CONFIG,
  TASK_TYPE_OPTIONS,
  getProfileStatus,
  getProspectDisplayName,
  getProspectInitials,
} from "./prospects/prospectDisplay";

const SourceBadge = ({ source }) => {
  const cfg =
    typeof source === "object"
      ? { label: source.shortLabel || source.fullLabel, color: source.color || "#9e9e9e" }
      : SOURCE_CONFIG[source] || { label: source, color: "#9e9e9e" };
  return (
    <Chip
      size="small"
      label={cfg.label}
      sx={{
        bgcolor: alpha(cfg.color, 0.1),
        color: cfg.color,
        border: `1px solid ${alpha(cfg.color, 0.4)}`,
        fontWeight: 600,
        fontSize: "0.72rem",
        borderRadius: 1,
      }}
    />
  );
};

SourceBadge.propTypes = {
  source: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};

const ProspectSourceBadges = ({ prospect, maxVisible = 1 }) => {
  const sources = normalizeProspectSources(prospect);
  const visible = sources.slice(0, maxVisible);
  const hiddenCount = Math.max(0, sources.length - visible.length);
  const tooltip = sources.map((source) => source.fullLabel).join("\n");

  return (
    <Tooltip title={<span style={{ whiteSpace: "pre-line" }}>{tooltip}</span>} arrow>
      <Box
        display="flex"
        gap={0.5}
        alignItems="center"
        flexWrap="nowrap"
        data-testid="prospect-source-badges"
      >
        {visible.map((source) => (
          <SourceBadge key={source.fullLabel} source={source} />
        ))}
        {hiddenCount > 0 && (
          <Typography variant="caption" fontWeight={800} color="textSecondary" noWrap>
            +{hiddenCount}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

ProspectSourceBadges.propTypes = {
  prospect: PropTypes.object.isRequired,
  maxVisible: PropTypes.number,
};

const ContactIconLink = ({ href, label, icon: Icon, color, copyText }) => {
  if (!href && !copyText) return null;
  const linkProps = href
    ? {
        component: "a",
        href,
        target: href.startsWith("mailto:") || href.startsWith("tel:") ? undefined : "_blank",
        rel: "noopener noreferrer",
      }
    : {};
  return (
    <Tooltip title={copyText || label}>
      <IconButton
        size="small"
        aria-label={label}
        {...linkProps}
        onClick={(event) => event.stopPropagation()}
        sx={{
          width: 24,
          height: 24,
          borderRadius: 1,
          color,
          bgcolor: alpha(color, 0.08),
          border: `1px solid ${alpha(color, 0.18)}`,
        }}
      >
        <Icon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
};
ContactIconLink.propTypes = {
  href: PropTypes.string,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  copyText: PropTypes.string,
};

const SocialLink = ({ href, icon: Icon, label, color }) => {
  if (!href) return null;
  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      display="flex"
      alignItems="center"
      gap={1}
      sx={{
        textDecoration: "none",
        p: 1,
        borderRadius: 2,
        border: `1px solid ${alpha(color, 0.3)}`,
        bgcolor: alpha(color, 0.05),
        color,
        transition: "all .15s",
        "&:hover": { bgcolor: alpha(color, 0.12), borderColor: color },
      }}
    >
      <Icon sx={{ fontSize: 18 }} />
      <Typography variant="caption" fontWeight={600} sx={{ color }}>
        {label}
      </Typography>
    </Box>
  );
};

SocialLink.propTypes = {
  href: PropTypes.string,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};

const prospectMapIcon = L.divIcon({
  className: "prospects-map-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const agentCompanies = (result) =>
  result?.discovery?.candidates?.filter((item) => item.lead_type === "company") ||
  result?.prospect_companies ||
  result?.companies ||
  [];
const agentPersons = (result) =>
  result?.discovery?.candidates?.filter((item) => item.lead_type === "person") ||
  result?.prospect_persons ||
  result?.prospects ||
  [];
const agentMapProspects = (result) => result?.map_prospects || [];
const agentLeadName = (item) =>
  item?.name ||
  item?.company_name ||
  item?.full_name ||
  [item?.first_name, item?.last_name].filter(Boolean).join(" ").trim() ||
  "Prospect";
const agentLeadSourceLabel = (item) =>
  item?.source_label || SOURCE_CONFIG[item?.source]?.label || item?.source || "Source inconnue";
const hasCoordinates = (item) => item?.latitude && item?.longitude;
const discoveryStats = (result = {}) => {
  const acceptedCount = Number(result.accepted_count ?? result.found_count ?? 0);
  const importedCount = Number(result.imported_count ?? 0);

  return {
    rawResultsCount: Number(result.raw_results_count ?? 0),
    acceptedCount,
    newCount: Number(result.new_count ?? 0),
    existingCount: Number(result.existing_count ?? 0),
    rejectedCount: Number(result.rejected_count ?? 0),
    importedCount,
    importFailedCount: Number(result.import_failed_count ?? 0),
    hasProspects: acceptedCount > 0 || importedCount > 0,
  };
};

const PROSPECTION_AGENT_STEPS = [
  "Analyse de la cible",
  "Recherche multi-sources",
  "Vérification des données",
  "Synchronisation CRM",
];

const PROSPECTION_AGENT_SUGGESTIONS = [
  "trouver 10 ingenieurs electrotechnique sur linkedin",
  "trouver 8 responsables RH a Tunis sur LinkedIn",
  "trouver des hotels a Sousse avec email et site web",
];

const ProspectLocationsMap = ({ prospects }) => {
  const validProspects = (prospects || []).filter(hasCoordinates);
  if (!validProspects.length) return null;

  const center = [
    Number(validProspects[0].latitude) || 36.8065,
    Number(validProspects[0].longitude) || 10.1815,
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 2,
        overflow: "hidden",
        borderRadius: 2,
        "& .leaflet-container": { height: 300, width: "100%" },
        "& .prospects-map-marker span": {
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          bgcolor: THEME.primary,
          border: "3px solid #fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
        },
      }}
    >
      <MapContainer center={center} zoom={7} scrollWheelZoom={false}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validProspects.map((prospect, index) => (
          <Marker
            key={prospect.id || `${agentLeadName(prospect)}-${index}`}
            position={[Number(prospect.latitude), Number(prospect.longitude)]}
            icon={prospectMapIcon}
          >
            <Popup>
              <strong>{agentLeadName(prospect)}</strong>
              <br />
              Source : {agentLeadSourceLabel(prospect)}
              {prospect.address && (
                <>
                  <br />
                  {prospect.address}
                </>
              )}
              {prospect.phone && (
                <>
                  <br />
                  Tel : {prospect.phone}
                </>
              )}
              {prospect.google_maps_url && (
                <>
                  <br />
                  <a href={prospect.google_maps_url} target="_blank" rel="noreferrer">
                    Ouvrir dans Google Maps
                  </a>
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Paper>
  );
};

ProspectLocationsMap.propTypes = {
  prospects: PropTypes.arrayOf(PropTypes.object),
};
ProspectLocationsMap.defaultProps = { prospects: [] };

const AgentLeadCard = ({ item, leadType }) => {
  const googleMapsUrl = item.google_maps_url || item.maps_url;
  const website = item.website || item.site_web;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: "100%" }}>
      <Stack spacing={1}>
        <Box display="flex" justifyContent="space-between" gap={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {agentLeadName(item)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {item.industry || item.title || (leadType === "company" ? "Entreprise" : "Prospect")}
            </Typography>
          </Box>
          {item.source === "google_maps" ? (
            <Chip size="small" color="success" label="Google Maps" sx={{ borderRadius: 1 }} />
          ) : item.source ? (
            <SourceBadge source={item.source} />
          ) : (
            <Chip size="small" label="Source inconnue" sx={{ borderRadius: 1 }} />
          )}
        </Box>

        {(item.address || item.city || item.country) && (
          <Box display="flex" gap={0.75} alignItems="flex-start">
            <LocationOnIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.65), mt: 0.1 }} />
            <Typography variant="caption" color="text.secondary">
              {[item.address, item.city, item.country].filter(Boolean).join(", ")}
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {item.phone && (
            <Chip size="small" icon={<PhoneIcon />} label={item.phone} sx={{ borderRadius: 1 }} />
          )}
          {item.email && (
            <Chip size="small" icon={<EmailIcon />} label={item.email} sx={{ borderRadius: 1 }} />
          )}
          {website && (
            <Button
              size="small"
              component="a"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<LanguageIcon />}
            >
              Site web
            </Button>
          )}
          {googleMapsUrl && (
            <Button
              size="small"
              component="a"
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<LocationOnIcon />}
            >
              Google Maps
            </Button>
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Résultat collecté par l&apos;agent de prospection. L&apos;analyse avancée sera traitée
          dans un agent dédié.
        </Typography>

        {(item.reason || item.notes) && (
          <Typography variant="caption" color="text.secondary">
            Note : {item.reason || item.notes}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

AgentLeadCard.propTypes = {
  item: PropTypes.object.isRequired,
  leadType: PropTypes.oneOf(["company", "person"]).isRequired,
};

const AgentResultsPreview = ({ result }) => {
  const companies = agentCompanies(result);
  const persons = agentPersons(result);
  const mapItems = agentMapProspects(result);
  const hasResults = companies.length || persons.length || mapItems.length;

  if (!hasResults) return null;

  return (
    <Box mt={2}>
      <ProspectLocationsMap prospects={mapItems} />

      <Grid container spacing={1.25} sx={{ mt: 0.75 }}>
        {companies.slice(0, 6).map((company, index) => (
          <Grid item xs={12} key={company.google_place_id || company.company_name || index}>
            <AgentLeadCard item={company} leadType="company" />
          </Grid>
        ))}
        {persons.slice(0, 6).map((person, index) => (
          <Grid item xs={12} key={person.linkedin_url || person.email || person.full_name || index}>
            <AgentLeadCard item={person} leadType="person" />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

AgentResultsPreview.propTypes = {
  result: PropTypes.object,
};
AgentResultsPreview.defaultProps = { result: null };

// ==============================
// CONFIG
// ==============================
const API_USER_ME = "/api/users/me/";
const API_ASSIGNABLE = "/api/users/assignable-users/";

// ==============================
// THEME
// ==============================
const THEME = {
  primary: "#d32f2f",
  primaryLight: "#ff6659",
  primaryDark: "#9a0007",
  gradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  success: "#4caf50",
  warning: "#ff9800",
  info: "#2196f3",
  error: "#f44336",
};

// ==============================
// STYLES
// ==============================
const StyledCard = styled(Card)(() => ({
  borderRadius: 16,
  boxShadow: `0 8px 16px ${alpha(THEME.primary, 0.1)}`,
  transition: "transform 0.2s, box-shadow 0.2s",
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  background: "var(--crm-surface)",
  color: "var(--crm-text)",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: `0 12px 24px ${alpha(THEME.primary, 0.2)}`,
    borderColor: THEME.primary,
  },
}));

const StyledTableContainer = styled(TableContainer)(() => ({
  borderRadius: 16,
  boxShadow: "var(--crm-shadow-sm)",
  border: "1px solid var(--crm-border)",
  background: "var(--crm-surface)",
  overflowX: "auto",
  overflowY: "hidden",
  "& .MuiTable-root": {
    width: "100%",
    minWidth: 1040,
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
}));

const StyledTableHead = styled(TableHead)(() => ({
  "& .MuiTableCell-head": {
    height: 58,
    fontWeight: 900,
    color: THEME.primary,
    fontSize: "0.76rem",
    lineHeight: 1.2,
    padding: "0 18px",
    backgroundColor: alpha(THEME.primary, 0.04),
    borderBottom: `2px solid ${THEME.primary}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0,
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  "&:hover": { backgroundColor: alpha(THEME.primary, 0.02), cursor: "pointer" },
  "& td": {
    height: 78,
    padding: "12px 16px",
    borderBottom: "1px solid var(--crm-border)",
    color: "var(--crm-text)",
    verticalAlign: "middle",
  },
}));

const GradientButton = styled(Button)(() => ({
  background: THEME.gradient,
  color: "white",
  borderRadius: 12,
  padding: "10px 24px",
  fontWeight: 600,
  textTransform: "none",
  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
  "&:hover": { background: THEME.gradient, boxShadow: `0 6px 16px ${alpha(THEME.primary, 0.4)}` },
  "&:disabled": { opacity: 0.6 },
}));

const StatsCard = styled(Card)(() => ({
  borderRadius: 20,
  padding: 8,
  background: "var(--crm-surface)",
  color: "var(--crm-text)",
  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.08)}`,
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  transition: "all 0.3s",
  cursor: "pointer",
  "&:hover": { borderColor: THEME.primary, boxShadow: `0 8px 24px ${alpha(THEME.primary, 0.15)}` },
}));

const StyledChip = styled(Chip)(({ evaluation }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(evaluation === "hot" && {
    background: alpha(THEME.error, 0.1),
    color: THEME.error,
    border: `1px solid ${THEME.error}`,
  }),
  ...(evaluation === "warm" && {
    background: alpha(THEME.warning, 0.1),
    color: THEME.warning,
    border: `1px solid ${THEME.warning}`,
  }),
  ...(evaluation === "cold" && {
    background: alpha(THEME.info, 0.1),
    color: THEME.info,
    border: `1px solid ${THEME.info}`,
  }),
}));

// ==============================
// CONSTANTES
// ==============================
const STATUS_LABELS = {
  new: "Nouveau",
  review_needed: "A revoir",
  contacted: "Contacté",
  qualified: "Qualifié",
  lost: "Perdu",
  won: "Gagné",
};
const EVALUATION_LABELS = { hot: "Chaud", warm: "Tiède", cold: "Froid" };
const ORIGIN_LABELS = {
  website: "Site web",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  referral: "Recommandation",
};
const STATUS_COLORS = {
  new: THEME.info,
  review_needed: THEME.warning,
  contacted: THEME.warning,
  qualified: THEME.success,
  lost: THEME.error,
  won: THEME.success,
};

const CALL_RESULT_LABELS = {
  no_answer: "Pas de réponse",
  interested: "Intéressé",
  not_interested: "Pas intéressé",
  callback: "Rappeler plus tard",
};
const TASK_STATUS_COLORS = {
  todo: THEME.info,
  in_progress: THEME.warning,
  done: THEME.success,
  cancelled: "#9e9e9e",
};
const TASK_STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};
const ACTIVITY_COLORS = {
  call: "#2196f3",
  email: "#9c27b0",
  note: "#ff9800",
  meeting: "#009688",
  status_change: "#4caf50",
};
const ACTIVITY_LABELS = {
  call: "Appel",
  email: "Email",
  note: "Note",
  meeting: "Meeting",
  status_change: "Statut",
};

const getStatusLabel = (s) => STATUS_LABELS[s] || s;
const getEvaluationLabel = (e) => EVALUATION_LABELS[e] || "-";
const getEvaluationColor = (e) =>
  ({ hot: THEME.error, warm: THEME.warning, cold: THEME.info }[e] || "#9e9e9e");
const getOriginLabel = (o) => ORIGIN_LABELS[o] || "-";
const getStatusColor = (s) => STATUS_COLORS[s] || "#9e9e9e";
const getStatusIcon = (status) =>
  ({
    new: <ScheduleIcon sx={{ fontSize: 16 }} />,
    review_needed: <ScheduleIcon sx={{ fontSize: 16 }} />,
    contacted: <PhoneIcon sx={{ fontSize: 16 }} />,
    qualified: <CheckCircleIcon sx={{ fontSize: 16 }} />,
    lost: <CancelIcon sx={{ fontSize: 16 }} />,
    won: <StarIcon sx={{ fontSize: 16 }} />,
  }[status] || null);
const getOriginIcon = (origin, props = {}) =>
  ({
    website: <LanguageIcon {...props} />,
    facebook: <FacebookIcon {...props} />,
    linkedin: <LinkedInIcon {...props} />,
    referral: <PeopleIcon {...props} />,
  }[origin] || <BusinessIcon {...props} />);
const formatDate = (date, format = "short") => {
  if (!date) return "-";
  const d = new Date(date);
  if (format === "short")
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
const formatDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const getActivityIcon = (type) =>
  ({
    call: <PhoneIcon sx={{ fontSize: 16 }} />,
    email: <EmailIcon sx={{ fontSize: 16 }} />,
    note: <NoteIcon sx={{ fontSize: 16 }} />,
    meeting: <MeetingIcon sx={{ fontSize: 16 }} />,
    status_change: <CheckCircleIcon sx={{ fontSize: 16 }} />,
  }[type] || <NoteIcon sx={{ fontSize: 16 }} />);

// ==============================
// StatsCardItem
// ==============================
const StatsCardItem = ({ title, value, icon, color, children, onClick }) => (
  <StatsCard onClick={onClick}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="caption" color="textSecondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ color, fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(color, 0.1), color, width: 48, height: 48 }}>{icon}</Avatar>
      </Box>
      {children && (
        <Box mt={2} display="flex" gap={1}>
          {children}
        </Box>
      )}
    </CardContent>
  </StatsCard>
);
StatsCardItem.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node.isRequired,
  color: PropTypes.string.isRequired,
  children: PropTypes.node,
  onClick: PropTypes.func,
};

// ==============================
// ProspectTableRow
// ==============================
const ProspectTableRow = ({
  prospect,
  companyName,
  onView,
  onEdit,
  onDelete,
  onContextMenu,
  onOpenDossier,
}) => {
  const displayName = getProspectDisplayName(prospect);
  const linkedCompanyName = companyName || prospect.prospect_company_detail?.name;

  return (
    <StyledTableRow
      onDoubleClick={() => onView(prospect)}
      onContextMenu={(e) => onContextMenu(e, prospect.id)}
    >
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.1, minWidth: 0 }}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: alpha(THEME.primary, 0.1),
              color: THEME.primary,
              fontSize: "0.75rem",
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {getProspectInitials(prospect)}
          </Avatar>
          <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
            <Typography variant="body2" fontWeight={800} noWrap>
              {displayName}
            </Typography>
            {prospect.title && (
              <Typography variant="caption" color="textSecondary" noWrap display="block">
                {prospect.title}
              </Typography>
            )}
          </Box>
        </Box>
      </TableCell>

      <TableCell>
        <Stack spacing={0.55} sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {linkedCompanyName || "Sans société"}
          </Typography>
          <Box display="flex" gap={0.5} flexWrap="wrap">
            <ContactIconLink
              href={prospect.email ? `mailto:${prospect.email}` : ""}
              label="Email"
              copyText={prospect.email}
              icon={EmailIcon}
              color={THEME.primary}
            />
            <ContactIconLink
              href={prospect.phone ? `tel:${prospect.phone}` : ""}
              label="Téléphone"
              copyText={prospect.phone}
              icon={PhoneIcon}
              color="#455a64"
            />
            <ContactIconLink
              href={prospect.linkedin_url}
              label="LinkedIn"
              icon={LinkedInIcon}
              color="#0077b5"
            />
            <ContactIconLink
              href={prospect.facebook_url}
              label="Facebook"
              icon={FacebookIcon}
              color="#1877f2"
            />
            <ContactIconLink
              href={prospect.instagram_url}
              label="Instagram"
              icon={InstagramIcon}
              color="#e1306c"
            />
            <ContactIconLink
              href={prospect.website}
              label="Site web"
              icon={LanguageIcon}
              color="#1976d2"
            />
          </Box>
        </Stack>
      </TableCell>

      <TableCell align="center">
        <Chip
          label={getStatusLabel(prospect.status)}
          size="small"
          icon={getStatusIcon(prospect.status)}
          sx={{
            bgcolor: alpha(getStatusColor(prospect.status), 0.1),
            color: getStatusColor(prospect.status),
            borderRadius: 1,
            fontWeight: 700,
            "& .MuiChip-icon": { fontSize: 14 },
          }}
        />
      </TableCell>

      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: prospect.assigned_to_name ? alpha("#0f766e", 0.12) : alpha("#64748b", 0.12),
              color: prospect.assigned_to_name ? "#0f766e" : "#64748b",
              fontSize: "0.72rem",
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {(prospect.assigned_to_name || "?").slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={800}
              noWrap
              sx={{ color: prospect.assigned_to_name ? "text.primary" : "text.secondary" }}
            >
              {prospect.assigned_to_name || "Non assigné"}
            </Typography>
            <Typography variant="caption" color="textSecondary" noWrap display="block">
              Responsable
            </Typography>
          </Box>
        </Box>
      </TableCell>

      <TableCell>
        <ProspectSourceBadges prospect={prospect} />
      </TableCell>

      <TableCell align="center">
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5, flexWrap: "nowrap" }}>
          {[
            {
              title: "Voir dossier 360",
              color: "#0f766e",
              icon: <OpenInNewIcon sx={{ fontSize: 16 }} />,
              onClick: () => onOpenDossier(prospect.id),
            },
            {
              title: "Voir les détails",
              color: "#0288d1",
              icon: <VisibilityIcon sx={{ fontSize: 16 }} />,
              onClick: () => onView(prospect),
            },
            {
              title: "Modifier",
              color: "#1976d2",
              icon: <EditIcon sx={{ fontSize: 16 }} />,
              onClick: () => onEdit(prospect),
            },
            {
              title: "Supprimer",
              color: THEME.primary,
              icon: <DeleteIcon sx={{ fontSize: 16 }} />,
              onClick: () => onDelete(prospect.id),
            },
          ].map((btn) => (
            <Tooltip key={btn.title} title={btn.title}>
              <IconButton
                size="small"
                aria-label={btn.title}
                onClick={btn.onClick}
                sx={{ color: btn.color, bgcolor: alpha(btn.color, 0.1), width: 30, height: 30 }}
              >
                {btn.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </TableCell>
    </StyledTableRow>
  );
};
ProspectTableRow.propTypes = {
  prospect: PropTypes.object.isRequired,
  companyName: PropTypes.string,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onContextMenu: PropTypes.func.isRequired,
  onOpenDossier: PropTypes.func.isRequired,
};
// ==============================
// ProspectCard
// ==============================
const ProspectCard = ({
  prospect,
  companyName,
  currentUser,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}) => {
  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);
  const googleMapsUrl = prospect.google_maps_url;
  return (
    <StyledCard onDoubleClick={() => onView(prospect)}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              background: THEME.gradient,
              fontSize: "1.5rem",
              fontWeight: 600,
            }}
          >
            {prospect.first_name?.[0]}
            {prospect.last_name?.[0]}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" fontWeight={600} noWrap>
              {prospect.first_name} {prospect.last_name}
            </Typography>
            <Typography variant="caption" color="textSecondary" noWrap>
              {prospect.title || "Sans titre"}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <StyledChip
            label={getEvaluationLabel(prospect.evaluation)}
            evaluation={prospect.evaluation}
            size="small"
          />
          <Chip
            label={getStatusLabel(prospect.status)}
            size="small"
            icon={getStatusIcon(prospect.status)}
            sx={{
              bgcolor: alpha(getStatusColor(prospect.status), 0.1),
              color: getStatusColor(prospect.status),
              borderRadius: 1,
            }}
          />
          <ProspectSourceBadges prospect={prospect} maxVisible={2} />
        </Box>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.5}>
          {prospect.email && (
            <Box display="flex" alignItems="center" gap={1}>
              <EmailIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
              <Typography variant="body2" noWrap>
                {prospect.email}
              </Typography>
            </Box>
          )}
          {prospect.phone && (
            <Box display="flex" alignItems="center" gap={1}>
              <PhoneIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
              <Typography variant="body2">{prospect.phone}</Typography>
            </Box>
          )}
          {(prospect.city || prospect.country) && (
            <Box display="flex" alignItems="center" gap={1}>
              <LocationOnIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
              <Typography variant="body2">
                {[prospect.city, prospect.country].filter(Boolean).join(", ")}
              </Typography>
            </Box>
          )}
          {prospect.address && (
            <Box display="flex" alignItems="flex-start" gap={1}>
              <LocationOnIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6), mt: 0.25 }} />
              <Typography variant="body2">{prospect.address}</Typography>
            </Box>
          )}
          <Box display="flex" alignItems="center" gap={1}>
            <BusinessIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
            <Typography variant="body2" noWrap>
              {companyName || "Indépendant"}
            </Typography>
          </Box>
          {isAdminOrManager && (
            <Box display="flex" alignItems="center" gap={1}>
              <PersonOutlineIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
              <Typography
                variant="body2"
                color={prospect.assigned_to_name ? "textPrimary" : "textSecondary"}
              >
                {prospect.assigned_to_name
                  ? `Assigné à : ${prospect.assigned_to_name}`
                  : "Non assigné"}
              </Typography>
            </Box>
          )}
          <Box display="flex" alignItems="center" gap={1}>
            {getOriginIcon(prospect.origin, {
              sx: { fontSize: 18, color: alpha(THEME.primary, 0.6) },
            })}
            <Typography variant="body2">{getOriginLabel(prospect.origin)}</Typography>
          </Box>
          {googleMapsUrl && (
            <Button
              component="a"
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              startIcon={<LocationOnIcon />}
              onClick={(e) => e.stopPropagation()}
              sx={{ alignSelf: "flex-start" }}
            >
              Ouvrir dans Google Maps
            </Button>
          )}
          <Box display="flex" alignItems="center" gap={1}>
            <CalendarIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
            <Typography variant="body2">{formatDate(prospect.created_at)}</Typography>
          </Box>
        </Stack>
        <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
          {[
            {
              title: "Voir",
              color: "#0288d1",
              icon: <VisibilityIcon fontSize="small" />,
              fn: () => onView(prospect),
            },
            {
              title: "Modifier",
              color: "#1976d2",
              icon: <EditIcon fontSize="small" />,
              fn: () => onEdit(prospect),
            },
            {
              title: "Archiver",
              color: "#ff9800",
              icon: <ArchiveIcon fontSize="small" />,
              fn: () => onArchive(prospect.id),
            },
            {
              title: "Restaurer",
              color: "#4caf50",
              icon: <RestoreIcon fontSize="small" />,
              fn: () => onRestore(prospect.id),
            },
            {
              title: "Supprimer",
              color: THEME.primary,
              icon: <DeleteIcon fontSize="small" />,
              fn: () => onDelete(prospect.id),
            },
          ].map((b) => (
            <Tooltip key={b.title} title={b.title}>
              <IconButton
                size="small"
                onClick={b.fn}
                disabled={b.disabled}
                sx={{ color: b.color, bgcolor: alpha(b.color, 0.1) }}
              >
                {b.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </CardContent>
    </StyledCard>
  );
};
ProspectCard.propTypes = {
  prospect: PropTypes.object.isRequired,
  companyName: PropTypes.string,
  currentUser: PropTypes.object,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onArchive: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// ==============================
// TriggerNotification
// ==============================
const TriggerNotification = ({ trigger, onDismiss }) => {
  if (!trigger?.triggered) return null;

  const cfg = {
    no_answer: {
      color: THEME.warning,
      label: "Relance planifiée",
      icon: <ScheduleIcon sx={{ fontSize: 18 }} />,
    },
    prospect_unreachable: {
      color: THEME.error,
      label: "Prospect injoignable",
      icon: <ErrorIcon sx={{ fontSize: 18 }} />,
    },
    not_interested: {
      color: THEME.info,
      label: "Email de relance planifié",
      icon: <InfoIcon sx={{ fontSize: 18 }} />,
    },
    interested: {
      color: THEME.success,
      label: "Meeting planifié !",
      icon: <CheckCircleIcon sx={{ fontSize: 18 }} />,
    },
    callback: {
      color: THEME.primary,
      label: "Rappel planifié",
      icon: <PhoneIcon sx={{ fontSize: 18 }} />,
    },
  }[trigger.action] || {
    color: THEME.info,
    label: "Trigger déclenché",
    icon: <TriggerIcon sx={{ fontSize: 18 }} />,
  };

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: `1.5px solid ${cfg.color}`,
        bgcolor: alpha(cfg.color, 0.06),
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        <TriggerIcon sx={{ fontSize: 16, color: cfg.color }} />
        <Typography variant="caption" fontWeight={600} sx={{ color: cfg.color }}>
          Trigger automatique
        </Typography>
      </Box>
      <Chip
        icon={cfg.icon}
        label={cfg.label}
        size="small"
        sx={{
          mb: 0.5,
          bgcolor: alpha(cfg.color, 0.1),
          color: cfg.color,
          border: `1px solid ${cfg.color}`,
          fontWeight: 600,
          fontSize: "0.7rem",
        }}
      />
      <Typography variant="caption" color="textSecondary" display="block">
        {trigger.message}
      </Typography>
      {trigger.attempt_number && (
        <Box mt={0.5}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption" color="textSecondary">
              Tentatives
            </Typography>
            <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600 }}>
              {trigger.attempt_number} / 4
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(trigger.attempt_number / 4) * 100}
            sx={{
              height: 4,
              borderRadius: 2,
              mt: 0.5,
              bgcolor: alpha(cfg.color, 0.1),
              "& .MuiLinearProgress-bar": { bgcolor: cfg.color },
            }}
          />
        </Box>
      )}
      {trigger.escalated && (
        <Box
          display="flex"
          alignItems="center"
          gap={0.5}
          mt={0.5}
          sx={{
            p: 0.75,
            borderRadius: 1,
            bgcolor: alpha(THEME.error, 0.08),
            border: `1px solid ${alpha(THEME.error, 0.2)}`,
          }}
        >
          <EscalateIcon sx={{ fontSize: 14, color: THEME.error }} />
          <Typography variant="caption" sx={{ color: THEME.error, fontWeight: 600 }}>
            Manager notifié automatiquement
          </Typography>
        </Box>
      )}
      <Box display="flex" justifyContent="flex-end" mt={0.5}>
        <Button
          size="small"
          onClick={onDismiss}
          sx={{ fontSize: "0.7rem", color: "text.secondary" }}
        >
          Ignorer
        </Button>
      </Box>
    </Box>
  );
};
TriggerNotification.propTypes = { trigger: PropTypes.object, onDismiss: PropTypes.func.isRequired };

// ==============================
// PlanCallForm
// ==============================
const PlanCallForm = ({ prospect, onCreated, onCancel }) => {
  const prospectName = getProspectDisplayName(prospect);
  const [form, setForm] = useState({
    title: `Tache - ${prospectName}`,
    task_type: "follow_up",
    due_date: "",
    priority: "medium",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.due_date) return;
    setLoading(true);
    try {
      // 1. Créer la tâche
      const taskRes = await api.post("/tasks/", {
        title: form.title,
        description: form.description || "",
        task_type: form.task_type,
        status: "todo",
        priority: form.priority,
        due_date: form.due_date,
        prospect: prospect.id,
      });

      // 2. Créer l'événement dans le calendrier
      await syncTaskToCalendar(taskRes.data, prospect);

      // 3. Notifier le parent
      onCreated(taskRes.data);
    } catch (err) {
      console.error("Erreur creation tache prospect:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ border: `1px solid ${alpha(THEME.primary, 0.2)}`, borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ color: THEME.primary, mb: 1.5 }}>
        Planifier une tache
      </Typography>
      <Stack spacing={1.5}>
        <TextField
          fullWidth
          size="small"
          label="Titre"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <FormControl fullWidth size="small">
          <InputLabel>Type</InputLabel>
          <Select
            value={form.task_type}
            label="Type"
            onChange={(e) => setForm({ ...form, task_type: e.target.value })}
          >
            {TASK_TYPE_OPTIONS.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          size="small"
          label="Date et heure *"
          type="datetime-local"
          InputLabelProps={{ shrink: true }}
          required
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
        />
        <FormControl fullWidth size="small">
          <InputLabel>Priorité</InputLabel>
          <Select
            value={form.priority}
            label="Priorité"
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <MenuItem value="low">Basse</MenuItem>
            <MenuItem value="medium">Moyenne</MenuItem>
            <MenuItem value="high">Haute</MenuItem>
          </Select>
        </FormControl>
        <TextareaAutosize
          minRows={2}
          placeholder="Notes (optionnel)..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            fontFamily: "inherit",
            fontSize: "0.875rem",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <Box display="flex" gap={1} justifyContent="flex-end">
          <Button size="small" onClick={onCancel} sx={{ borderRadius: 2, color: "text.secondary" }}>
            Annuler
          </Button>
          <GradientButton
            size="small"
            onClick={handleSubmit}
            disabled={loading || !form.due_date}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <TaskIcon />}
          >
            Planifier
          </GradientButton>
        </Box>
      </Stack>
    </Box>
  );
};
PlanCallForm.propTypes = {
  prospect: PropTypes.object.isRequired,
  onCreated: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// ==============================
// CallResultForm
// ==============================
const CALL_RESULT_OPTIONS = [
  {
    value: "no_answer",
    label: "Pas de réponse",
    desc: "Personne n'a décroché",
    color: THEME.warning,
    icon: <PhoneIcon sx={{ fontSize: 16 }} />,
    triggerLabel: "→ Relance +2j",
  },
  {
    value: "interested",
    label: "Intéressé",
    desc: "Le prospect veut en savoir plus",
    color: THEME.success,
    icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
    triggerLabel: "→ Meeting +1j",
  },
  {
    value: "not_interested",
    label: "Pas intéressé",
    desc: "Il décline pour le moment",
    color: THEME.error,
    icon: <CancelIcon sx={{ fontSize: 16 }} />,
    triggerLabel: "→ Email +7j",
  },
  {
    value: "callback",
    label: "Rappeler plus tard",
    desc: "Il demande un rappel",
    color: THEME.info,
    icon: <ScheduleIcon sx={{ fontSize: 16 }} />,
    triggerLabel: "→ Tâche rappel",
  },
];

const CallResultForm = ({ task, prospect, onDone, onCancel }) => {
  const [callResult, setCallResult] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);

  const handleSubmit = async () => {
    if (!callResult) return;
    setLoading(true);
    try {
      const payload = {
        task: task.id,
        activity_type: "call",
        call_result: callResult,
        notes: notes || "",
        prospect: prospect.id,
      };
      if (duration) payload.call_duration_minutes = parseInt(duration);
      if (callResult === "callback" && callbackDate) payload.meeting_date = callbackDate;

      const res = await api.post("/task-activities/", payload);
      const data = res.data;

      if (data.trigger?.triggered) {
        setTriggerResult(data.trigger);
      } else {
        onDone(data);
      }
    } catch (err) {
      console.error("Erreur enregistrement résultat:", err);
    } finally {
      setLoading(false);
    }
  };

  if (triggerResult) {
    return (
      <Box sx={{ border: `1px solid ${alpha(THEME.success, 0.3)}`, borderRadius: 2, p: 2 }}>
        <TriggerNotification trigger={triggerResult} onDismiss={() => onDone(null)} />
        <Box display="flex" justifyContent="flex-end" mt={1}>
          <GradientButton size="small" onClick={() => onDone(null)}>
            Fermer
          </GradientButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ border: `1px solid ${alpha(THEME.primary, 0.2)}`, borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ color: THEME.primary, mb: 1.5 }}>
        Résultat de l&apos;appel — <span style={{ fontWeight: 400 }}>{task.title}</span>
      </Typography>

      <Typography variant="caption" color="textSecondary" display="block" mb={0.75}>
        Que s&apos;est-il passé ?
      </Typography>
      <Stack spacing={0.75} mb={1.5}>
        {CALL_RESULT_OPTIONS.map((opt) => {
          const selected = callResult === opt.value;
          return (
            <Box
              key={opt.value}
              onClick={() => setCallResult(opt.value)}
              sx={{
                p: 1.25,
                borderRadius: 2,
                border: `1.5px solid ${selected ? opt.color : alpha("#000", 0.1)}`,
                bgcolor: selected ? alpha(opt.color, 0.06) : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                transition: "all .15s",
                "&:hover": { borderColor: opt.color, bgcolor: alpha(opt.color, 0.04) },
              }}
            >
              <Avatar
                sx={{ width: 30, height: 30, bgcolor: alpha(opt.color, 0.12), color: opt.color }}
              >
                {opt.icon}
              </Avatar>
              <Box flex={1}>
                <Typography variant="body2" fontWeight={selected ? 600 : 400}>
                  {opt.label}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {opt.desc}
                </Typography>
              </Box>
              {selected && (
                <Chip
                  label={opt.triggerLabel}
                  size="small"
                  sx={{
                    fontSize: "0.65rem",
                    height: 18,
                    bgcolor: alpha(opt.color, 0.1),
                    color: opt.color,
                    border: `1px solid ${alpha(opt.color, 0.3)}`,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Stack>

      <Stack spacing={1.25}>
        <TextField
          fullWidth
          size="small"
          label="Durée (minutes)"
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          inputProps={{ min: 1 }}
        />
        {callResult === "callback" && (
          <TextField
            fullWidth
            size="small"
            label="Date du rappel"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={callbackDate}
            onChange={(e) => setCallbackDate(e.target.value)}
          />
        )}
        <TextareaAutosize
          minRows={2}
          placeholder="Notes sur l'appel..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            fontFamily: "inherit",
            fontSize: "0.875rem",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <Box display="flex" gap={1} justifyContent="flex-end">
          <Button size="small" onClick={onCancel} sx={{ borderRadius: 2, color: "text.secondary" }}>
            Annuler
          </Button>
          <GradientButton
            size="small"
            onClick={handleSubmit}
            disabled={loading || !callResult}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
          >
            Enregistrer
          </GradientButton>
        </Box>
      </Stack>
    </Box>
  );
};
CallResultForm.propTypes = {
  task: PropTypes.object.isRequired,
  prospect: PropTypes.object.isRequired,
  onDone: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// ==============================
// ProspectTasksList
// ==============================
const ProspectTasksList = ({ prospect, onRecordResult }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/?prospect=${prospect.id}&ordering=-created_at`);
      const data = res.data;
      setTasks(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Erreur chargement tâches:", err);
    } finally {
      setLoading(false);
    }
  }, [prospect.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (loading)
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} sx={{ color: THEME.primary }} />
      </Box>
    );

  if (tasks.length === 0)
    return (
      <Box textAlign="center" py={3}>
        <TaskIcon sx={{ fontSize: 36, color: alpha(THEME.primary, 0.3), mb: 1 }} />
        <Typography variant="body2" color="textSecondary">
          Aucune tâche planifiée
        </Typography>
      </Box>
    );

  return (
    <Stack spacing={1}>
      {tasks.map((task) => {
        const statusColor = TASK_STATUS_COLORS[task.status] || "#9e9e9e";
        const isPending = task.status === "todo" || task.status === "in_progress";
        return (
          <Box
            key={task.id}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: `1px solid ${alpha(statusColor, 0.3)}`,
              bgcolor: alpha(statusColor, 0.03),
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1, mr: 1 }}>
                {task.title}
              </Typography>
              <Chip
                label={TASK_STATUS_LABELS[task.status] || task.status}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  bgcolor: alpha(statusColor, 0.12),
                  color: statusColor,
                  fontWeight: 600,
                }}
              />
            </Box>
            {task.due_date && (
              <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                <ClockIcon
                  sx={{ fontSize: 13, color: task.is_overdue ? THEME.error : "text.secondary" }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: task.is_overdue ? THEME.error : "text.secondary" }}
                >
                  {formatDateTime(task.due_date)}
                  {task.is_overdue ? " — En retard" : ""}
                </Typography>
              </Box>
            )}
            {isPending && task.title.toLowerCase().includes("appel") && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                onClick={() => onRecordResult(task)}
                sx={{
                  mt: 0.5,
                  borderRadius: 2,
                  borderColor: alpha(THEME.primary, 0.4),
                  color: THEME.primary,
                  fontSize: "0.72rem",
                  textTransform: "none",
                }}
              >
                Enregistrer le résultat
              </Button>
            )}
          </Box>
        );
      })}
    </Stack>
  );
};
ProspectTasksList.propTypes = {
  prospect: PropTypes.object.isRequired,
  onRecordResult: PropTypes.func.isRequired,
};

// ==============================
// ActivityTimeline
// ==============================
const ActivityTimeline = ({ prospect }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/task-activities/?prospect_id=${prospect.id}`);
      const data = res.data;
      setActivities(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Erreur chargement activités:", err);
    } finally {
      setLoading(false);
    }
  }, [prospect.id]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading)
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} sx={{ color: THEME.primary }} />
      </Box>
    );

  if (activities.length === 0)
    return (
      <Box textAlign="center" py={3}>
        <NoteIcon sx={{ fontSize: 36, color: alpha(THEME.primary, 0.3), mb: 1 }} />
        <Typography variant="body2" color="textSecondary">
          Aucune activité enregistrée
        </Typography>
      </Box>
    );

  return (
    <Stack spacing={0}>
      {activities.map((activity, idx) => {
        const color = ACTIVITY_COLORS[activity.activity_type] || "#9e9e9e";
        const isLast = idx === activities.length - 1;
        return (
          <Box
            key={activity.id}
            sx={{ display: "flex", gap: 1.5, pb: isLast ? 0 : 2, position: "relative" }}
          >
            {!isLast && (
              <Box
                sx={{
                  position: "absolute",
                  left: 16,
                  top: 36,
                  bottom: 0,
                  width: 2,
                  bgcolor: alpha(color, 0.2),
                }}
              />
            )}
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: alpha(color, 0.12),
                color,
                flexShrink: 0,
                mt: 0.5,
              }}
            >
              {getActivityIcon(activity.activity_type)}
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                <Typography variant="body2" fontWeight={600}>
                  {ACTIVITY_LABELS[activity.activity_type] || activity.activity_type}
                  {activity.call_result && (
                    <Chip
                      label={CALL_RESULT_LABELS[activity.call_result] || activity.call_result}
                      size="small"
                      sx={{
                        ml: 0.75,
                        height: 18,
                        fontSize: "0.65rem",
                        bgcolor: alpha(color, 0.1),
                        color,
                      }}
                    />
                  )}
                </Typography>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ whiteSpace: "nowrap", ml: 1 }}
                >
                  {formatDateTime(activity.created_at)}
                </Typography>
              </Box>
              {activity.performed_by_detail && (
                <Typography variant="caption" color="textSecondary" display="block">
                  Par {activity.performed_by_detail.username}
                </Typography>
              )}
              {activity.notes && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{
                    mt: 0.25,
                    p: 0.75,
                    bgcolor: alpha("#000", 0.03),
                    borderRadius: 1,
                    fontSize: "0.8rem",
                  }}
                >
                  {activity.notes}
                </Typography>
              )}
              {activity.notes?.startsWith("🤖") && (
                <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                  <TriggerIcon sx={{ fontSize: 13, color: THEME.primary }} />
                  <Typography variant="caption" sx={{ color: THEME.primary, fontWeight: 600 }}>
                    Action automatique
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
};
ActivityTimeline.propTypes = { prospect: PropTypes.object.isRequired };

// ==============================
// ProspectDetailsDrawer (COMPOSANT PRINCIPAL)
const ProspectDrawerSection = ({ title, children, action }) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      borderRadius: 1.5,
      bgcolor: "#fff",
      border: `1px solid ${alpha("#000", 0.08)}`,
      boxShadow: `0 4px 14px ${alpha("#000", 0.035)}`,
    }}
  >
    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
      <Typography variant="subtitle2" sx={{ fontSize: "0.78rem", fontWeight: 800 }}>
        {title}
      </Typography>
      {action}
    </Box>
    {children}
  </Paper>
);
ProspectDrawerSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  action: PropTypes.node,
};

const CompactInfoRow = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <Box display="flex" alignItems="center" gap={1} minWidth={0}>
      {icon}
      <Box minWidth={0}>
        <Typography variant="caption" color="textSecondary" display="block" lineHeight={1.1}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
};
CompactInfoRow.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
};

const OnlineLinkChip = ({ href, icon: Icon, label, color }) => {
  if (!href) return null;
  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      startIcon={<Icon sx={{ fontSize: 15 }} />}
      aria-label={`Ouvrir ${label}`}
      sx={{
        minHeight: 30,
        px: 1.1,
        borderRadius: 1,
        textTransform: "none",
        fontSize: "0.74rem",
        fontWeight: 700,
        color,
        bgcolor: alpha(color, 0.08),
        border: `1px solid ${alpha(color, 0.22)}`,
        "&:hover": { bgcolor: alpha(color, 0.13), borderColor: alpha(color, 0.4) },
      }}
    >
      {label}
    </Button>
  );
};
OnlineLinkChip.propTypes = {
  href: PropTypes.string,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};

const ProspectInfoTab = ({ prospect, companyName }) => {
  const onlineLinks = [
    { href: prospect.linkedin_url, icon: LinkedInIcon, label: "LinkedIn", color: "#0077b5" },
    { href: prospect.facebook_url, icon: FacebookIcon, label: "Facebook", color: "#1877f2" },
    { href: prospect.instagram_url, icon: InstagramIcon, label: "Instagram", color: "#e1306c" },
    { href: prospect.website, icon: LanguageIcon, label: "Site web", color: "#1976d2" },
    { href: prospect.google_maps_url, icon: LocationOnIcon, label: "Maps", color: "#d32f2f" },
    { href: prospect.source_url, icon: OpenInNewIcon, label: "Source", color: THEME.primary },
  ].filter((item) => item.href);
  const crmRows = [
    ["Statut", STATUS_LABELS[prospect.status] || prospect.status],
    ["Assigné à", prospect.assigned_to_name || "Non assigné"],
    ["Créé le", formatDate(prospect.created_at)],
    ["Source", prospect.source ? SOURCE_CONFIG[prospect.source]?.label || prospect.source : null],
    ["Modifié le", formatDate(prospect.updated_at)],
    ["Origine", prospect.origin ? getOriginLabel(prospect.origin) : null],
  ].filter(([, value]) => value);

  return (
    <Stack spacing={1.5} pt={1}>
      <ProspectDrawerSection title="Coordonnées">
        <Grid container spacing={1.25}>
          <Grid item xs={12} sm={6}>
            <CompactInfoRow
              icon={<EmailIcon sx={{ fontSize: 17, color: alpha(THEME.primary, 0.7) }} />}
              label="Email"
              value={prospect.email}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <CompactInfoRow
              icon={<PhoneIcon sx={{ fontSize: 17, color: alpha(THEME.primary, 0.7) }} />}
              label="Téléphone"
              value={prospect.phone}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <CompactInfoRow
              icon={<LocationOnIcon sx={{ fontSize: 17, color: alpha(THEME.primary, 0.7) }} />}
              label="Localisation"
              value={[prospect.city, prospect.country].filter(Boolean).join(", ")}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <CompactInfoRow
              icon={<BusinessIcon sx={{ fontSize: 17, color: alpha(THEME.primary, 0.7) }} />}
              label="Société"
              value={companyName || "Prospect sans entreprise"}
            />
          </Grid>
          {prospect.address && (
            <Grid item xs={12}>
              <CompactInfoRow
                icon={<LocationOnIcon sx={{ fontSize: 17, color: alpha(THEME.primary, 0.7) }} />}
                label="Adresse"
                value={prospect.address}
              />
            </Grid>
          )}
        </Grid>
      </ProspectDrawerSection>

      {onlineLinks.length > 0 && (
        <ProspectDrawerSection title="Présence en ligne">
          <Box display="flex" gap={0.75} flexWrap="wrap">
            {onlineLinks.map((link) => (
              <OnlineLinkChip key={`${link.label}-${link.href}`} {...link} />
            ))}
          </Box>
        </ProspectDrawerSection>
      )}

      {prospect.description && (
        <ProspectDrawerSection title="Description">
          <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-wrap" }}>
            {prospect.description}
          </Typography>
        </ProspectDrawerSection>
      )}

      {prospect.notes && (
        <ProspectDrawerSection title="Notes internes">
          <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-wrap" }}>
            {prospect.notes}
          </Typography>
        </ProspectDrawerSection>
      )}

      <ProspectDrawerSection title="Informations CRM">
        <Grid container spacing={1}>
          {crmRows.map(([label, value]) => (
            <Grid item xs={12} sm={6} key={label}>
              <Typography variant="caption" color="textSecondary" display="block">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {value}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </ProspectDrawerSection>
    </Stack>
  );
};
ProspectInfoTab.propTypes = {
  prospect: PropTypes.object.isRequired,
  companyName: PropTypes.string,
};

const ProspectDetailsDrawer = ({ open, onClose, prospect, companies, onEdit, onDelete }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showPlanCall, setShowPlanCall] = useState(false);
  const [taskToRecord, setTaskToRecord] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionsAnchor, setActionsAnchor] = useState(null);

  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setShowPlanCall(false);
      setTaskToRecord(null);
      setActionsAnchor(null);
    }
  }, [open, prospect?.id]);

  const getCompanyName = useCallback(
    (id) => {
      if (!id || !companies) return null;
      return companies.find((c) => c.id === id)?.name || null;
    },
    [companies]
  );

  if (!prospect) return null;

  const companyName =
    getCompanyName(prospect.prospect_company) ||
    prospect.prospect_company_detail?.name ||
    "Prospect sans entreprise";
  const statColor = STATUS_COLORS[prospect.status] || "#9e9e9e";
  const tabs = ["Informations", "Activités"];

  const handleCallCreated = () => {
    setShowPlanCall(false);
    setRefreshKey((k) => k + 1);
    setActiveTab(1);
  };

  const handleResultDone = () => {
    setTaskToRecord(null);
    setRefreshKey((k) => k + 1);
    setActiveTab(1);
  };

  const closeActions = () => setActionsAnchor(null);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 560, md: 620 },
          maxWidth: "100vw",
          overflow: "hidden",
          borderTopLeftRadius: { xs: 0, sm: 18 },
          borderBottomLeftRadius: { xs: 0, sm: 18 },
          bgcolor: "#fafafa",
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            pt: 2,
            pb: 1.25,
            flexShrink: 0,
            bgcolor: "#fff",
            borderBottom: `1px solid ${alpha("#000", 0.08)}`,
          }}
        >
          <Box display="flex" justifyContent="flex-end" gap={0.5} mb={0.75}>
            <Tooltip title="Actions">
              <IconButton
                size="small"
                aria-label="Actions prospect"
                onClick={(event) => setActionsAnchor(event.currentTarget)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fermer">
              <IconButton size="small" aria-label="Fermer la fiche prospect" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box display="flex" gap={1.5} alignItems="flex-start">
            <Avatar
              sx={{
                width: 48,
                height: 48,
                background: THEME.gradient,
                fontSize: "1rem",
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {getProspectInitials(prospect)}
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography variant="h6" fontWeight={800} lineHeight={1.15} noWrap>
                {getProspectDisplayName(prospect)}
              </Typography>
              <Typography variant="body2" color="textSecondary" noWrap>
                {prospect.title || "Sans titre"}
              </Typography>
              <Typography variant="body2" color="textSecondary" noWrap>
                {companyName}
              </Typography>
              <Box display="flex" gap={0.75} flexWrap="wrap" mt={0.9}>
                <Chip
                  label={STATUS_LABELS[prospect.status] || prospect.status}
                  size="small"
                  sx={{
                    height: 22,
                    borderRadius: 1,
                    fontSize: "0.68rem",
                    bgcolor: alpha(statColor, 0.1),
                    color: statColor,
                    border: `1px solid ${alpha(statColor, 0.35)}`,
                    fontWeight: 700,
                  }}
                />
              </Box>
            </Box>
          </Box>

          {!showPlanCall && !taskToRecord && (
            <Box display="flex" alignItems="center" gap={1} mt={1.5}>
              <GradientButton
                size="small"
                startIcon={<TaskIcon />}
                onClick={() => setShowPlanCall(true)}
                sx={{ minHeight: 34, px: 1.75, borderRadius: 1.2, textTransform: "none" }}
              >
                Planifier une tâche
              </GradientButton>
              <Tooltip title="Plus d'actions">
                <IconButton
                  size="small"
                  aria-label="Plus d'actions prospect"
                  onClick={(event) => setActionsAnchor(event.currentTarget)}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.2,
                    border: `1px solid ${alpha(THEME.primary, 0.22)}`,
                    color: THEME.primary,
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {showPlanCall && (
            <Box mt={1.5}>
              <PlanCallForm
                prospect={prospect}
                onCreated={handleCallCreated}
                onCancel={() => setShowPlanCall(false)}
              />
            </Box>
          )}

          {taskToRecord && (
            <Box mt={1.5}>
              <CallResultForm
                task={taskToRecord}
                prospect={prospect}
                onDone={handleResultDone}
                onCancel={() => setTaskToRecord(null)}
              />
            </Box>
          )}

          <Box
            role="tablist"
            aria-label="Sections de la fiche prospect"
            display="flex"
            gap={0.25}
            mt={1.5}
            sx={{ overflowX: "auto", borderBottom: `1px solid ${alpha("#000", 0.08)}` }}
          >
            {tabs.map((tab, index) => (
              <Button
                key={tab}
                role="tab"
                aria-selected={activeTab === index}
                onClick={() => setActiveTab(index)}
                size="small"
                sx={{
                  minHeight: 34,
                  px: 1.1,
                  whiteSpace: "nowrap",
                  textTransform: "none",
                  fontWeight: activeTab === index ? 800 : 600,
                  fontSize: "0.76rem",
                  color: activeTab === index ? THEME.primary : "text.secondary",
                  borderRadius: 0,
                  borderBottom:
                    activeTab === index ? `2px solid ${THEME.primary}` : "2px solid transparent",
                }}
              >
                {tab}
              </Button>
            ))}
          </Box>
        </Box>

        <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={closeActions}>
          <MenuItem
            onClick={() => {
              closeActions();
              onEdit?.(prospect);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Modifier</ListItemText>
          </MenuItem>
          <MenuItem
            component={prospect.email ? "a" : "li"}
            href={prospect.email ? `mailto:${prospect.email}` : undefined}
            disabled={!prospect.email}
            onClick={closeActions}
          >
            <ListItemIcon>
              <SendIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Envoyer un message</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeActions();
              onDelete?.(prospect.id);
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: THEME.error }} />
            </ListItemIcon>
            <ListItemText>Supprimer</ListItemText>
          </MenuItem>
        </Menu>

        <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 2, sm: 2.5 }, pb: 2.5 }}>
          {activeTab === 0 && <ProspectInfoTab prospect={prospect} companyName={companyName} />}

          {activeTab === 1 && (
            <Stack spacing={1.5} pt={1}>
              {prospect.next_task && (
                <ProspectDrawerSection title="Prochaine tâche">
                  <Box display="flex" alignItems="center" gap={1}>
                    <TaskIcon sx={{ fontSize: 17, color: THEME.primary }} />
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={800}>
                        {prospect.next_task.title}
                      </Typography>
                      {prospect.next_task.due_date && (
                        <Typography variant="caption" color="textSecondary">
                          {formatDateTime(prospect.next_task.due_date)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </ProspectDrawerSection>
              )}
              <ProspectDrawerSection title="Tâches et appels">
                <ProspectTasksList
                  key={`tasks-${refreshKey}`}
                  prospect={prospect}
                  onRecordResult={(task) => {
                    setTaskToRecord(task);
                    setActiveTab(1);
                  }}
                />
              </ProspectDrawerSection>
              <ProspectDrawerSection title="Historique">
                <ActivityTimeline key={`timeline-${refreshKey}`} prospect={prospect} />
              </ProspectDrawerSection>
            </Stack>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

ProspectDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  prospect: PropTypes.object,
  companies: PropTypes.array.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};

// ==============================
// FiltersDrawer
// ==============================
const FiltersDrawer = ({ open, onClose, filters, onApply, onReset, companies, commercials }) => {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters, open]);

  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeCommercials = Array.isArray(commercials) ? commercials : [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 420 },
          p: 3,
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
        },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            background: THEME.gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Filtres avancés
        </Typography>
        <IconButton onClick={onClose} sx={{ bgcolor: alpha(THEME.primary, 0.1) }}>
          <CloseIcon sx={{ color: THEME.primary }} />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Statut</InputLabel>
            <Select
              multiple
              value={local.status || []}
              label="Statut"
              onChange={(e) => setLocal({ ...local, status: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => (
                    <Chip key={v} label={getStatusLabel(v)} size="small" sx={{ borderRadius: 1 }} />
                  ))}
                </Box>
              )}
            >
              {[
                ["new", "Nouveau"],
                ["review_needed", "A revoir"],
                ["contacted", "Contacté"],
                ["qualified", "Qualifié"],
                ["lost", "Perdu"],
                ["won", "Gagné"],
              ].map(([val, lbl]) => (
                <MenuItem key={val} value={val}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getStatusIcon(val)}
                    {lbl}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Évaluation</InputLabel>
            <Select
              multiple
              value={local.evaluation || []}
              label="Évaluation"
              onChange={(e) => setLocal({ ...local, evaluation: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => (
                    <Chip
                      key={v}
                      label={getEvaluationLabel(v)}
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  ))}
                </Box>
              )}
            >
              {[
                ["cold", "Froid"],
                ["warm", "Tiède"],
                ["hot", "Chaud"],
              ].map(([val, lbl]) => (
                <MenuItem key={val} value={val}>
                  {lbl}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Origine</InputLabel>
            <Select
              multiple
              value={local.origin || []}
              label="Origine"
              onChange={(e) => setLocal({ ...local, origin: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => (
                    <Chip key={v} label={getOriginLabel(v)} size="small" sx={{ borderRadius: 1 }} />
                  ))}
                </Box>
              )}
            >
              {[
                ["website", "Site web"],
                ["facebook", "Facebook"],
                ["linkedin", "LinkedIn"],
                ["referral", "Recommandation"],
              ].map(([val, lbl]) => (
                <MenuItem key={val} value={val}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getOriginIcon(val, { sx: { fontSize: 16, color: alpha(THEME.primary, 0.6) } })}
                    {lbl}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Source</InputLabel>
            <Select
              multiple
              value={local.source || []}
              label="Source"
              onChange={(e) => setLocal({ ...local, source: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => (
                    <Chip
                      key={v}
                      label={SOURCE_CONFIG[v]?.label || v}
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  ))}
                </Box>
              )}
            >
              {Object.entries(SOURCE_CONFIG).map(([value, cfg]) => (
                <MenuItem key={value} value={value}>
                  {cfg.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Société</InputLabel>
            <Select
              multiple
              value={local.prospect_company || []}
              label="Société"
              onChange={(e) => setLocal({ ...local, prospect_company: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => {
                    const company = safeCompanies.find((c) => String(c.id) === String(v));
                    return (
                      <Chip
                        key={v}
                        label={company?.name || v}
                        size="small"
                        icon={
                          <BusinessIcon
                            sx={{
                              fontSize: "14px !important",
                              color: `${alpha(THEME.primary, 0.7)} !important`,
                            }}
                          />
                        }
                        sx={{
                          borderRadius: 1,
                          bgcolor: alpha(THEME.primary, 0.08),
                          color: THEME.primaryDark,
                          border: `1px solid ${alpha(THEME.primary, 0.2)}`,
                        }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {safeCompanies.length === 0 ? (
                <MenuItem disabled>
                  <Typography variant="caption" color="textSecondary">
                    Aucune société disponible
                  </Typography>
                </MenuItem>
              ) : (
                safeCompanies.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: alpha(THEME.primary, 0.1),
                          color: THEME.primary,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        {c.name?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {c.name}
                        </Typography>
                        {c.industry && (
                          <Typography variant="caption" color="textSecondary">
                            {c.industry}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Grid>

        {safeCommercials.length > 0 && (
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Assigné à</InputLabel>
              <Select
                multiple
                value={local.assigned_to || []}
                label="Assigné à"
                onChange={(e) => setLocal({ ...local, assigned_to: e.target.value })}
                renderValue={(sel) => (
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {sel.map((v) => {
                      const user = safeCommercials.find((c) => String(c.id) === String(v));
                      return (
                        <Chip
                          key={v}
                          label={user?.username || v}
                          size="small"
                          avatar={
                            <Avatar
                              sx={{
                                bgcolor: `${alpha(THEME.primary, 0.15)} !important`,
                                color: `${THEME.primary} !important`,
                                fontSize: "0.65rem !important",
                              }}
                            >
                              {(user?.username?.[0] || "?").toUpperCase()}
                            </Avatar>
                          }
                          sx={{
                            borderRadius: 1,
                            bgcolor: alpha(THEME.primary, 0.08),
                            color: THEME.primaryDark,
                            border: `1px solid ${alpha(THEME.primary, 0.2)}`,
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {safeCommercials.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: alpha(THEME.primary, 0.1),
                          color: THEME.primary,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                        }}
                      >
                        {c.username?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {c.username}
                        </Typography>
                        {c.email && (
                          <Typography variant="caption" color="textSecondary">
                            {c.email}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Date début"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={local.date_from || ""}
            onChange={(e) => setLocal({ ...local, date_from: e.target.value })}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Date fin"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={local.date_to || ""}
            onChange={(e) => setLocal({ ...local, date_to: e.target.value })}
          />
        </Grid>
      </Grid>

      {Object.values(local).some((v) => (Array.isArray(v) ? v.length > 0 : !!v)) && (
        <Box
          mt={3}
          p={2}
          sx={{
            bgcolor: alpha(THEME.primary, 0.03),
            borderRadius: 3,
            border: `1px dashed ${alpha(THEME.primary, 0.2)}`,
          }}
        >
          <Typography
            variant="caption"
            color="textSecondary"
            fontWeight={600}
            display="block"
            mb={1}
          >
            Filtres actifs :
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={0.5}>
            {local.status?.map((v) => (
              <Chip
                key={`s-${v}`}
                label={`Statut: ${getStatusLabel(v)}`}
                size="small"
                onDelete={() => setLocal({ ...local, status: local.status.filter((x) => x !== v) })}
                sx={{
                  borderRadius: 1,
                  bgcolor: alpha(THEME.info, 0.1),
                  color: THEME.info,
                  fontSize: "0.7rem",
                }}
              />
            ))}
            {local.evaluation?.map((v) => (
              <Chip
                key={`e-${v}`}
                label={`Eval: ${getEvaluationLabel(v)}`}
                size="small"
                onDelete={() =>
                  setLocal({ ...local, evaluation: local.evaluation.filter((x) => x !== v) })
                }
                sx={{
                  borderRadius: 1,
                  bgcolor: alpha(THEME.warning, 0.1),
                  color: THEME.warning,
                  fontSize: "0.7rem",
                }}
              />
            ))}
            {local.origin?.map((v) => (
              <Chip
                key={`o-${v}`}
                label={`Origine: ${getOriginLabel(v)}`}
                size="small"
                onDelete={() => setLocal({ ...local, origin: local.origin.filter((x) => x !== v) })}
                sx={{
                  borderRadius: 1,
                  bgcolor: alpha(THEME.success, 0.1),
                  color: THEME.success,
                  fontSize: "0.7rem",
                }}
              />
            ))}
            {local.source?.map((v) => (
              <Chip
                key={`src-${v}`}
                label={`Source: ${SOURCE_CONFIG[v]?.label || v}`}
                size="small"
                onDelete={() => setLocal({ ...local, source: local.source.filter((x) => x !== v) })}
                sx={{
                  borderRadius: 1,
                  bgcolor: alpha(THEME.primary, 0.1),
                  color: THEME.primary,
                  fontSize: "0.7rem",
                }}
              />
            ))}
            {local.prospect_company?.map((v) => {
              const company = safeCompanies.find((c) => String(c.id) === String(v));
              return (
                <Chip
                  key={`c-${v}`}
                  label={`Société: ${company?.name || v}`}
                  size="small"
                  onDelete={() =>
                    setLocal({
                      ...local,
                      prospect_company: local.prospect_company.filter((x) => x !== v),
                    })
                  }
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha(THEME.primary, 0.08),
                    color: THEME.primaryDark,
                    fontSize: "0.7rem",
                  }}
                />
              );
            })}
            {local.assigned_to?.map((v) => {
              const user = safeCommercials.find((c) => String(c.id) === String(v));
              return (
                <Chip
                  key={`a-${v}`}
                  label={`Assigné: ${user?.username || v}`}
                  size="small"
                  onDelete={() =>
                    setLocal({
                      ...local,
                      assigned_to: local.assigned_to.filter((x) => x !== v),
                    })
                  }
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha(THEME.primary, 0.08),
                    color: THEME.primaryDark,
                    fontSize: "0.7rem",
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      <Box mt={4} display="flex" gap={2} justifyContent="space-between">
        <Button
          onClick={() => {
            setLocal({});
            onReset();
            onClose();
          }}
          variant="outlined"
          sx={{ borderRadius: 3, borderColor: alpha(THEME.primary, 0.3), color: THEME.primary }}
        >
          Réinitialiser
        </Button>
        <Box display="flex" gap={1}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ borderRadius: 3, borderColor: alpha(THEME.primary, 0.3), color: THEME.primary }}
          >
            Annuler
          </Button>
          <GradientButton
            onClick={() => {
              onApply(local);
              onClose();
            }}
            sx={{ borderRadius: 3 }}
          >
            Appliquer
          </GradientButton>
        </Box>
      </Box>
    </Drawer>
  );
};
FiltersDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  filters: PropTypes.object.isRequired,
  onApply: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  companies: PropTypes.array,
  commercials: PropTypes.array,
};
FiltersDrawer.defaultProps = {
  companies: [],
  commercials: [],
};

// ==============================
// ProspectFormDrawer
// ==============================
const ProspectFormDrawer = ({
  open,
  onClose,
  isEditing,
  companies,
  commercials,
  currentUser,
  prospectData,
  companyData,
  selectedCompany,
  onProspectDataChange,
  onCompanyDataChange,
  onCompanySelect,
  onSubmit,
}) => {
  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);
  const safeCommercials = Array.isArray(commercials) ? commercials : [];
  const isCompanyStepValid = true;
  const isContactStepValid = Boolean(
    [prospectData.first_name, prospectData.last_name].filter(Boolean).join(" ").trim()
  );
  const canSubmit = isCompanyStepValid && isContactStepValid;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 700 },
          background: "#ffffff",
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
        },
      }}
    >
      <Box sx={{ p: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              background: THEME.gradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {isEditing ? "Modifier le prospect" : "Nouveau prospect"}
          </Typography>
          <IconButton onClick={onClose} sx={{ bgcolor: alpha(THEME.primary, 0.1) }}>
            <CloseIcon sx={{ color: THEME.primary }} />
          </IconButton>
        </Box>
        <form onSubmit={onSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 3,
                  borderColor: isCompanyStepValid ? THEME.primary : alpha(THEME.primary, 0.2),
                }}
              >
                <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                  Societe (optionnelle)
                </Typography>
                <Autocomplete
                  options={companies}
                  getOptionLabel={(o) => o.name || ""}
                  value={selectedCompany}
                  onChange={(e, val) => onCompanySelect(val)}
                  size="small"
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Rechercher une societe..." sx={{ mb: 2 }} />
                  )}
                />
                <Divider sx={{ my: 2 }}>OU</Divider>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Creer une nouvelle societe"
                  value={companyData.name}
                  onChange={(e) => onCompanyDataChange({ ...companyData, name: e.target.value })}
                  sx={{ mb: 2 }}
                />
                <Collapse in={!!companyData.name}>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Secteur"
                        value={companyData.industry}
                        onChange={(e) =>
                          onCompanyDataChange({ ...companyData, industry: e.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Téléphone"
                        value={companyData.phone}
                        onChange={(e) =>
                          onCompanyDataChange({ ...companyData, phone: e.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Email"
                        type="email"
                        value={companyData.email}
                        onChange={(e) =>
                          onCompanyDataChange({ ...companyData, email: e.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Ville"
                        value={companyData.city}
                        onChange={(e) =>
                          onCompanyDataChange({ ...companyData, city: e.target.value })
                        }
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Pays"
                        value={companyData.country}
                        onChange={(e) =>
                          onCompanyDataChange({ ...companyData, country: e.target.value })
                        }
                      />
                    </Grid>
                  </Grid>
                </Collapse>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card
                variant="outlined"
                sx={{ p: 3, borderRadius: 3, opacity: isCompanyStepValid ? 1 : 0.7 }}
              >
                <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                  Contact
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Nom du prospect"
                      value={prospectData.first_name}
                      required
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, first_name: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Nom complementaire"
                      value={prospectData.last_name}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, last_name: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Titre / Fonction"
                      value={prospectData.title}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, title: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Email"
                      type="email"
                      value={prospectData.email}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, email: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Téléphone"
                      value={prospectData.phone}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, phone: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Ville"
                      value={prospectData.city || ""}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, city: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Pays"
                      value={prospectData.country || ""}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, country: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Adresse"
                      value={prospectData.address || ""}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, address: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Latitude"
                      type="number"
                      value={prospectData.latitude || ""}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, latitude: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Longitude"
                      type="number"
                      value={prospectData.longitude || ""}
                      disabled={!isCompanyStepValid}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, longitude: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small" disabled={!isCompanyStepValid}>
                      <Select
                        value={prospectData.origin}
                        onChange={(e) =>
                          onProspectDataChange({ ...prospectData, origin: e.target.value })
                        }
                        displayEmpty
                        renderValue={(v) => (v ? getOriginLabel(v) : "Origine")}
                      >
                        <MenuItem value="website">Site web</MenuItem>
                        <MenuItem value="facebook">Facebook</MenuItem>
                        <MenuItem value="linkedin">LinkedIn</MenuItem>
                        <MenuItem value="referral">Recommandation</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small" disabled={!isCompanyStepValid}>
                      <Select
                        value={prospectData.evaluation}
                        onChange={(e) =>
                          onProspectDataChange({ ...prospectData, evaluation: e.target.value })
                        }
                        displayEmpty
                        renderValue={(v) => (v ? getEvaluationLabel(v) : "Évaluation")}
                      >
                        <MenuItem value="cold">Froid</MenuItem>
                        <MenuItem value="warm">Tiède</MenuItem>
                        <MenuItem value="hot">Chaud</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small" disabled={!isCompanyStepValid}>
                      <Select
                        value={prospectData.status}
                        onChange={(e) =>
                          onProspectDataChange({ ...prospectData, status: e.target.value })
                        }
                        displayEmpty
                        renderValue={(v) => (v ? getStatusLabel(v) : "Statut")}
                      >
                        <MenuItem value="new">Nouveau</MenuItem>
                        <MenuItem value="review_needed">A revoir</MenuItem>
                        <MenuItem value="contacted">Contacté</MenuItem>
                        <MenuItem value="qualified">Qualifié</MenuItem>
                        <MenuItem value="lost">Perdu</MenuItem>
                        <MenuItem value="won">Gagné</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {isAdminOrManager && (
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small" disabled={!isCompanyStepValid}>
                        <InputLabel>Assigner à un commercial</InputLabel>
                        <Select
                          value={prospectData.assigned_to || ""}
                          label="Assigner à un commercial"
                          onChange={(e) =>
                            onProspectDataChange({ ...prospectData, assigned_to: e.target.value })
                          }
                        >
                          <MenuItem value="">
                            <em>— Sans assignation spécifique —</em>
                          </MenuItem>
                          {safeCommercials.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    bgcolor: alpha(THEME.primary, 0.1),
                                    color: THEME.primary,
                                    fontSize: "0.7rem",
                                  }}
                                >
                                  {c.username?.[0]?.toUpperCase()}
                                </Avatar>
                                {c.username}
                                {c.email ? ` (${c.email})` : ""}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {safeCommercials.length === 0 && (
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          sx={{ mt: 0.5, display: "block" }}
                        >
                          Aucun commercial disponible
                        </Typography>
                      )}
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }}>Source et liens</Divider>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={prospectData.source || ""}
                        onChange={(e) =>
                          onProspectDataChange({ ...prospectData, source: e.target.value })
                        }
                        displayEmpty
                        renderValue={(v) => (v ? SOURCE_CONFIG[v]?.label || v : "Source")}
                      >
                        <MenuItem value="">
                          <em>Non renseignee</em>
                        </MenuItem>
                        {PROSPECT_SOURCE_OPTIONS.map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Lien source"
                      value={prospectData.source_url || ""}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, source_url: e.target.value })
                      }
                    />
                  </Grid>
                  {[
                    ["google_maps_url", "Lien Google Maps"],
                    ["linkedin_url", "LinkedIn"],
                    ["facebook_url", "Facebook"],
                    ["instagram_url", "Instagram"],
                    ["website", "Site web"],
                  ].map(([field, label]) => (
                    <Grid item xs={12} sm={6} key={field}>
                      <TextField
                        fullWidth
                        size="small"
                        label={label}
                        value={prospectData[field] || ""}
                        onChange={(e) =>
                          onProspectDataChange({ ...prospectData, [field]: e.target.value })
                        }
                      />
                    </Grid>
                  ))}
                  <Grid item xs={12}>
                    <TextareaAutosize
                      minRows={3}
                      placeholder="Description du prospect (profil, besoin, contexte commercial)..."
                      value={prospectData.description || ""}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, description: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                        resize: "vertical",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextareaAutosize
                      minRows={3}
                      placeholder="Notes internes (optionnel)..."
                      value={prospectData.notes || ""}
                      onChange={(e) =>
                        onProspectDataChange({ ...prospectData, notes: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                        resize: "vertical",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </Grid>
                </Grid>
              </Card>
            </Grid>
          </Grid>
          <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button
              onClick={onClose}
              variant="outlined"
              sx={{
                borderRadius: 3,
                borderColor: alpha(THEME.primary, 0.3),
                color: THEME.primary,
                px: 4,
                py: 1.5,
              }}
            >
              Annuler
            </Button>
            <GradientButton type="submit" disabled={!canSubmit} sx={{ px: 4, py: 1.5 }}>
              {isEditing ? "Mettre à jour" : "Créer le prospect"}
            </GradientButton>
          </Box>
        </form>
      </Box>
    </Drawer>
  );
};
ProspectFormDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isEditing: PropTypes.bool.isRequired,
  companies: PropTypes.array.isRequired,
  commercials: PropTypes.array.isRequired,
  currentUser: PropTypes.object,
  prospectData: PropTypes.object.isRequired,
  companyData: PropTypes.object.isRequired,
  selectedCompany: PropTypes.object,
  onProspectDataChange: PropTypes.func.isRequired,
  onCompanyDataChange: PropTypes.func.isRequired,
  onCompanySelect: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

// ==============================
// ExportMenu
// ==============================
const ExportMenu = ({ onExportCSV, onExportExcel, onExportPDF }) => {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Tooltip title="Exporter">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          sx={{
            color: THEME.primary,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            borderRadius: 2,
          }}
        >
          <FileDownloadIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onExportCSV();
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" sx={{ color: THEME.primary }} />
          </ListItemIcon>
          <ListItemText>CSV</ListItemText>
        </MenuItem>
        {XLSX && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onExportExcel();
            }}
          >
            <ListItemIcon>
              <AssessmentIcon fontSize="small" sx={{ color: THEME.success }} />
            </ListItemIcon>
            <ListItemText>Excel</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onExportPDF();
          }}
        >
          <ListItemIcon>
            <PdfIcon fontSize="small" sx={{ color: THEME.error }} />
          </ListItemIcon>
          <ListItemText>PDF</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
ExportMenu.propTypes = {
  onExportCSV: PropTypes.func.isRequired,
  onExportExcel: PropTypes.func.isRequired,
  onExportPDF: PropTypes.func.isRequired,
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function Prospects() {
  const navigate = useNavigate();
  useTrackActivity("prospects");

  const [currentUser, setCurrentUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [commercials, setCommercials] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [viewMode, setViewMode] = useState("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [apiFilters, setApiFilters] = useState({});
  const [sortBy, setSortBy] = useState("-created_at");
  const [agentQuery, setAgentQuery] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  const [agentError, setAgentError] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentProgressStep, setAgentProgressStep] = useState(0);
  const [lastDiscoveryRun, setLastDiscoveryRun] = useState(null);
  const [reportDownloading, setReportDownloading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const emptyProspectData = {
    first_name: "",
    last_name: "",
    title: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    description: "",
    origin: "",
    evaluation: "",
    status: "new",
    source: "",
    source_url: "",
    google_maps_url: "",
    latitude: "",
    longitude: "",
    address: "",
    website: "",
    linkedin_url: "",
    facebook_url: "",
    instagram_url: "",
    notes: "",
    assigned_to: "",
  };
  const emptyCompanyData = { name: "", industry: "", phone: "", email: "", city: "", country: "" };
  const [prospectData, setProspectData] = useState(emptyProspectData);
  const [companyData, setCompanyData] = useState(emptyCompanyData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [prospectToDelete, setProspectToDelete] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    mouseX: null,
    mouseY: null,
    prospectId: null,
  });

  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);

  // ── Pagination backend ──
  const hookFilters = useMemo(() => {
    const f = { ...apiFilters, ordering: sortBy };
    if (searchTerm) f.search = searchTerm;
    if (apiFilters.status?.length) f.status = apiFilters.status.join(",");
    if (apiFilters.evaluation?.length) f.evaluation = apiFilters.evaluation.join(",");
    if (apiFilters.origin?.length) f.origin = apiFilters.origin.join(",");
    if (apiFilters.source?.length) f.source = apiFilters.source.join(",");
    if (apiFilters.prospect_company?.length)
      f.prospect_company = apiFilters.prospect_company.join(",");
    if (apiFilters.assigned_to?.length) f.assigned_to = apiFilters.assigned_to.join(",");
    return f;
  }, [apiFilters, searchTerm, sortBy]);

  const {
    data: prospectsList,
    loading,
    total,
    pages,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: setHookFilters,
    refresh,
  } = usePaginatedList("/prospects/", 10);

  useEffect(() => {
    setHookFilters(hookFilters);
  }, [hookFilters, setHookFilters]);

  useEffect(() => {
    if (!agentLoading) {
      setAgentProgressStep(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setAgentProgressStep((current) => Math.min(current + 1, PROSPECTION_AGENT_STEPS.length - 1));
    }, 1700);

    return () => clearInterval(timer);
  }, [agentLoading]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get("/prospect-companies/");
      setCompanies(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {}
  }, []);

  const fetchCommercials = useCallback(async (tok) => {
    try {
      const res = await axios.get(API_ASSIGNABLE, { headers: { Authorization: `Bearer ${tok}` } });
      const data = res.data;
      setCommercials(Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []);
    } catch {
      setCommercials([]);
    }
  }, []);

  const fetchCurrentUser = useCallback(
    async (tok) => {
      try {
        const res = await axios.get(API_USER_ME, { headers: { Authorization: `Bearer ${tok}` } });
        setCurrentUser(res.data);
        fetchCompanies();
        if (["ADMIN", "MANAGER"].includes(res.data.role)) fetchCommercials(tok);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/sign-in");
        }
      }
    },
    [fetchCommercials, fetchCompanies, navigate]
  );

  // ── Init ──
  useEffect(() => {
    const tok = localStorage.getItem("token");
    if (!tok) {
      navigate("/sign-in");
      return;
    }
    fetchCurrentUser(tok);
  }, [fetchCurrentUser, navigate]);

  const getCompanyNameById = useCallback(
    (id) => {
      if (!id) return null;
      return companies.find((c) => c.id === id)?.name || null;
    },
    [companies]
  );

  const crmMapProspects = useMemo(
    () =>
      prospectsList
        .filter((prospect) => prospect.latitude && prospect.longitude)
        .map((prospect) => ({
          id: prospect.id,
          name: getProspectDisplayName(prospect),
          source: prospect.source,
          source_label: prospect.source_display || SOURCE_CONFIG[prospect.source]?.label,
          latitude: prospect.latitude,
          longitude: prospect.longitude,
          address: prospect.address,
          city: prospect.city,
          country: prospect.country,
          phone: prospect.phone,
          website: prospect.website,
          google_maps_url: prospect.google_maps_url,
        })),
    [prospectsList]
  );

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };
  const showSnackbar = (msg, sev = "success") =>
    setSnackbar({ open: true, message: msg, severity: sev });

  const getProspectionErrorMessage = (
    err,
    fallback = "La recherche n'a pas pu être finalisée."
  ) => {
    if (err.response?.status === 401) {
      return "Votre session a expiré. Veuillez vous reconnecter.";
    }
    return `${fallback} Réessayez avec une cible plus précise ou relancez la recherche dans quelques instants.`;
  };

  const runAgentFromProspects = async () => {
    const query = agentQuery.trim();
    if (!query) {
      setAgentError("Veuillez saisir une requete");
      return;
    }

    setAgentLoading(true);
    setAgentError("");
    setAgentResult(null);

    try {
      const data = await runDiscovery({ query });
      setAgentResult(data);
      setLastDiscoveryRun(data.report_available ? data : null);
      await refresh();
      await fetchCompanies();
      const imported = discoveryImportedCount(data);
      showSnackbar(
        data.message ||
          `${
            imported || Number(data.companies_found || 0) + Number(data.persons_found || 0)
          } prospect(s) trouve(s).`,
        "success"
      );
    } catch (err) {
      const messageText = getProspectionErrorMessage(err);
      setAgentError(messageText);
      showSnackbar(messageText, "error");
    } finally {
      setAgentLoading(false);
    }
  };

  const downloadDiscoveryReport = async (run = lastDiscoveryRun) => {
    if (!run?.report_url || reportDownloading) return;
    setReportDownloading(true);
    try {
      const blob = await getDiscoveryReportBlob(run.report_url);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
      link.href = url;
      link.download = `Rapport_Prospection_${stamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar("Rapport PDF téléchargé.", "success");
    } catch (err) {
      showSnackbar(getProspectionErrorMessage(err, "Rapport PDF indisponible"), "error");
    } finally {
      setReportDownloading(false);
    }
  };

  const stats = useMemo(
    () => ({
      total,
      new: prospectsList.filter((p) => p.status === "new").length,
      contacted: prospectsList.filter((p) => p.status === "contacted").length,
      qualified: prospectsList.filter((p) => p.status === "qualified").length,
      won: prospectsList.filter((p) => p.status === "won").length,
      lost: prospectsList.filter((p) => p.status === "lost").length,
      hot: prospectsList.filter((p) => p.evaluation === "hot").length,
      warm: prospectsList.filter((p) => p.evaluation === "warm").length,
      cold: prospectsList.filter((p) => p.evaluation === "cold").length,
    }),
    [prospectsList, total]
  );

  // ── Exports ──
  const exportToCSV = () => {
    try {
      const h = [
        "Prénom",
        "Nom",
        "Email",
        "Téléphone",
        "Ville",
        "Pays",
        "Société",
        "Assigné à",
        "Statut",
        "Évaluation",
        "Origine",
        "Date création",
      ];
      const rows = prospectsList.map((p) => [
        p.first_name,
        p.last_name,
        p.email,
        p.phone || "",
        p.city || "",
        p.country || "",
        getCompanyNameById(p.prospect_company) || "",
        p.assigned_to_name || "",
        getStatusLabel(p.status),
        getEvaluationLabel(p.evaluation),
        getOriginLabel(p.origin),
        formatDate(p.created_at),
      ]);
      const csv = [h.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `prospects_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSnackbar(`Export CSV effectué`);
    } catch {
      showSnackbar("Erreur export CSV", "error");
    }
  };

  const exportToExcel = () => {
    if (!XLSX) {
      showSnackbar("Module xlsx non installé", "error");
      return;
    }
    try {
      const ws = XLSX.utils.json_to_sheet(
        prospectsList.map((p) => ({
          Prénom: p.first_name,
          Nom: p.last_name,
          Email: p.email,
          Téléphone: p.phone || "",
          Ville: p.city || "",
          Pays: p.country || "",
          Société: getCompanyNameById(p.prospect_company) || "",
          "Assigné à": p.assigned_to_name || "",
          Statut: getStatusLabel(p.status),
          Évaluation: getEvaluationLabel(p.evaluation),
          Origine: getOriginLabel(p.origin),
          "Date création": formatDate(p.created_at),
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prospects");
      XLSX.writeFile(wb, `prospects_${new Date().toISOString().split("T")[0]}.xlsx`);
      showSnackbar("Export Excel effectué");
    } catch {
      showSnackbar("Erreur export Excel", "error");
    }
  };

  const exportToPDF = () => {
    try {
      const win = window.open("", "_blank");
      win.document.write(
        `<html><head><title>Prospects</title><style>body{font-family:Arial;padding:20px}h1{color:#d32f2f}table{border-collapse:collapse;width:100%}th{background:#d32f2f;color:white;padding:10px;text-align:left}td{border:1px solid #ddd;padding:8px}tr:nth-child(even){background:#f9f9f9}</style></head><body><h1>Liste des prospects</h1>${"<table><thead><tr><th>Nom</th><th>Email</th><th>Ville</th><th>Pays</th><th>Société</th><th>Assigné à</th><th>Statut</th><th>Évaluation</th></tr></thead><tbody>"}${prospectsList
          .map(
            (p) =>
              `<tr><td>${p.first_name} ${p.last_name}</td><td>${p.email}</td><td>${
                p.city || "—"
              }</td><td>${p.country || "—"}</td><td>${
                getCompanyNameById(p.prospect_company) || "—"
              }</td><td>${p.assigned_to_name || "—"}</td><td>${getStatusLabel(
                p.status
              )}</td><td>${getEvaluationLabel(p.evaluation)}</td></tr>`
          )
          .join("")}</tbody></table></body></html>`
      );
      win.document.close();
      win.print();
      showSnackbar("Export PDF effectué");
    } catch {
      showSnackbar("Erreur export PDF", "error");
    }
  };

  // ── Handlers ──
  const handleViewDetails = (p) => {
    setSelectedProspect(p);
    setDetailsDrawerOpen(true);
  };
  const handleEdit = (p) => {
    setProspectData({
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      title: p.title || "",
      email: p.email || "",
      phone: p.phone || "",
      city: p.city || "",
      country: p.country || "",
      description: p.description || "",
      origin: p.origin || "",
      evaluation: p.evaluation || "",
      status: p.status || "new",
      source: p.source || "",
      source_url: p.source_url || "",
      google_maps_url: p.google_maps_url || "",
      latitude: p.latitude || "",
      longitude: p.longitude || "",
      address: p.address || "",
      website: p.website || "",
      linkedin_url: p.linkedin_url || "",
      facebook_url: p.facebook_url || "",
      instagram_url: p.instagram_url || "",
      notes: p.notes || "",
      assigned_to: p.assigned_to || "",
    });
    setSelectedCompany(
      p.prospect_company ? companies.find((c) => c.id === p.prospect_company) || null : null
    );
    setSelectedProspectId(p.id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let companyName = null;
      let companyId = selectedCompany?.id || null;
      if (selectedCompany) {
        companyName = selectedCompany.name;
      } else if (companyData.name) {
        const r = await api.post("/prospect-companies/", {
          ...companyData,
          number_of_employees: null,
          annual_revenue: null,
        });
        companyName = r.data.name;
        companyId = r.data.id;
      }
      const prospectName = [prospectData.first_name, prospectData.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!prospectName) {
        showNotification("Le nom du prospect est obligatoire", "error");
        return;
      }
      const urlFields = [
        ["source_url", "Lien source"],
        ["google_maps_url", "Lien Google Maps"],
        ["website", "Site web"],
        ["linkedin_url", "LinkedIn"],
        ["facebook_url", "Facebook"],
        ["instagram_url", "Instagram"],
      ];
      const invalidUrl = urlFields.find(
        ([field]) => prospectData[field] && !/^https?:\/\//i.test(prospectData[field])
      );
      if (invalidUrl) {
        showNotification(`${invalidUrl[1]} doit commencer par http:// ou https://`, "error");
        return;
      }
      const payload = {
        first_name: prospectData.first_name,
        last_name: prospectData.last_name || "",
        title: prospectData.title || null,
        email: prospectData.email || null,
        phone: prospectData.phone || null,
        city: prospectData.city || null,
        country: prospectData.country || null,
        description: prospectData.description || null,
        origin: prospectData.origin || null,
        evaluation: prospectData.evaluation || null,
        status: prospectData.status,
        source: prospectData.source || null,
        source_url: prospectData.source_url || null,
        google_maps_url: prospectData.google_maps_url || null,
        latitude: prospectData.latitude || null,
        longitude: prospectData.longitude || null,
        address: prospectData.address || null,
        website: prospectData.website || null,
        linkedin_url: prospectData.linkedin_url || null,
        facebook_url: prospectData.facebook_url || null,
        instagram_url: prospectData.instagram_url || null,
        notes: prospectData.notes || null,
        prospect_company: companyId || null,
        prospect_company_name: companyName || "",
        ...(isAdminOrManager && prospectData.assigned_to
          ? { assigned_to: prospectData.assigned_to }
          : {}),
      };
      if (isEditing && selectedProspectId) {
        await api.put(`/prospects/${selectedProspectId}/`, payload);
        showNotification("Prospect modifié avec succès");
      } else {
        await api.post("/prospects/", payload);
        showNotification("Prospect créé avec succès");
      }
      resetForm();
      refresh();
    } catch (err) {
      showNotification(
        err.response?.data?.email?.[0] || "Erreur lors de l'enregistrement",
        "error"
      );
    }
  };

  const resetForm = () => {
    setProspectData(emptyProspectData);
    setCompanyData(emptyCompanyData);
    setSelectedCompany(null);
    setIsEditing(false);
    setSelectedProspectId(null);
    setShowForm(false);
  };

  const handleArchive = async (id) => {
    try {
      await api.patch(`/prospects/${id}/`, { status: "lost" });
      showNotification("Prospect archivé");
      refresh();
    } catch {
      showNotification("Erreur archivage", "error");
    }
  };
  const handleRestore = async (id) => {
    try {
      await api.patch(`/prospects/${id}/`, { status: "new" });
      showNotification("Prospect restauré");
      refresh();
    } catch {
      showNotification("Erreur restauration", "error");
    }
  };
  const handleDeleteClick = (id) => {
    setProspectToDelete(id);
    setDeleteDialogOpen(true);
  };
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setProspectToDelete(null);
  };
  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/prospects/${prospectToDelete}/`);
      showNotification("Prospect supprimé");
      refresh();
      handleDeleteCancel();
    } catch {
      showNotification("Erreur suppression", "error");
    }
  };
  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setContextMenu({ open: true, mouseX: e.clientX + 2, mouseY: e.clientY - 6, prospectId: id });
  };
  const handleContextMenuClose = () =>
    setContextMenu({ open: false, mouseX: null, mouseY: null, prospectId: null });

  const handleApplyFilters = (newFilters) => {
    setApiFilters(newFilters);
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (apiFilters.status?.length) count += apiFilters.status.length;
    if (apiFilters.evaluation?.length) count += apiFilters.evaluation.length;
    if (apiFilters.origin?.length) count += apiFilters.origin.length;
    if (apiFilters.source?.length) count += apiFilters.source.length;
    if (apiFilters.prospect_company?.length) count += apiFilters.prospect_company.length;
    if (apiFilters.assigned_to?.length) count += apiFilters.assigned_to.length;
    if (apiFilters.date_from) count++;
    if (apiFilters.date_to) count++;
    return count;
  }, [apiFilters]);
  const agentStats = useMemo(() => discoveryStats(agentResult || {}), [agentResult]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3} px={3}>
        <Backdrop
          sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1, backdropFilter: "blur(4px)" }}
          open={loading}
        >
          <Box textAlign="center">
            <CircularProgress sx={{ color: THEME.primary }} />
            <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>Chargement...</Typography>
          </Box>
        </Backdrop>

        <Collapse in={!!message.text}>
          <Alert
            severity={message.type}
            sx={{ mb: 2, borderRadius: 3 }}
            action={
              <IconButton size="small" onClick={() => setMessage({ text: "", type: "success" })}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {message.text}
          </Alert>
        </Collapse>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* En-tête */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: THEME.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              Gestion des prospects
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {total} prospect(s) au total
            </Typography>
          </Box>
          <GradientButton
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Nouveau prospect
          </GradientButton>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => setAgentOpen(true)}
            sx={{ ml: 1, borderRadius: 2, textTransform: "none" }}
          >
            Rechercher des prospects avec IA
          </Button>
        </Box>

        <Dialog
          open={agentOpen}
          onClose={() => !agentLoading && setAgentOpen(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              borderRadius: 4,
              overflow: "hidden",
              bgcolor: "#f8fafc",
              boxShadow: "0 28px 80px rgba(15,23,42,0.28)",
            },
          }}
        >
          <DialogTitle
            sx={{
              p: 0,
              background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 58%, #111827 100%)",
              color: "white",
            }}
          >
            <Box sx={{ p: { xs: 2.25, md: 3 }, pb: { xs: 2, md: 2.5 } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Box>
                  <Stack direction="row" alignItems="center" gap={1} mb={0.75}>
                    <TriggerIcon sx={{ fontSize: 20 }} />
                    <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 0 }}>
                      Agent IA de prospection
                    </Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={900}>
                    Recherche intelligente de prospects
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.82, mt: 0.5 }}>
                    Décris ta cible. L&apos;agent cherche, vérifie puis synchronise les prospects
                    dans le CRM.
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setAgentOpen(false)}
                  disabled={agentLoading}
                  sx={{ color: "white", bgcolor: "rgba(255,255,255,0.12)" }}
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f8fafc" }}>
            <Grid container spacing={2.25}>
              <Grid item xs={12} md={7}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: "white",
                    borderColor: alpha(THEME.primary, 0.14),
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={900}>
                        Commande de recherche
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Le CRM transforme ta demande en prospects exploitables.
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      icon={<CheckCircleIcon />}
                      label="CRM connecté"
                      sx={{
                        bgcolor: alpha(THEME.success, 0.1),
                        color: THEME.success,
                        fontWeight: 800,
                      }}
                    />
                  </Stack>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Objectif de prospection"
                    value={agentQuery}
                    onChange={(e) => setAgentQuery(e.target.value)}
                    placeholder="Ex: trouver des ingénieurs électromécaniques sur LinkedIn en Tunisie"
                    disabled={agentLoading}
                    error={Boolean(agentError && !agentQuery.trim())}
                    helperText={
                      agentError && !agentQuery.trim()
                        ? agentError
                        : "Utilise une phrase naturelle: métier, secteur, ville, source ou réseau."
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                          <SearchIcon sx={{ color: THEME.primary }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Stack direction="row" gap={1} flexWrap="wrap" mt={1.5}>
                    <Chip
                      label="Qualification IA"
                      size="small"
                      sx={{
                        borderRadius: 2,
                        fontWeight: 800,
                        bgcolor: alpha(THEME.info, 0.08),
                        color: THEME.info,
                      }}
                    />
                    <Chip
                      label="Import CRM automatique"
                      size="small"
                      sx={{
                        borderRadius: 2,
                        fontWeight: 800,
                        bgcolor: alpha(THEME.success, 0.1),
                        color: THEME.success,
                      }}
                    />
                    {PROSPECTION_AGENT_SUGGESTIONS.map((suggestion) => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        onClick={() => !agentLoading && setAgentQuery(suggestion)}
                        size="small"
                        variant="outlined"
                        sx={{
                          maxWidth: "100%",
                          borderRadius: 2,
                          fontWeight: 700,
                          bgcolor: alpha(THEME.primary, 0.04),
                          borderColor: alpha(THEME.primary, 0.22),
                          color: THEME.primaryDark,
                        }}
                      />
                    ))}
                  </Stack>
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: "white",
                    borderColor: alpha(agentLoading ? THEME.primary : THEME.success, 0.18),
                  }}
                >
                  <Stack spacing={1.5}>
                    {PROSPECTION_AGENT_STEPS.map((step, index) => {
                      const done = agentResult && !agentLoading;
                      const active = agentLoading && index === agentProgressStep;
                      const passed = agentLoading && index < agentProgressStep;
                      return (
                        <Stack key={step} direction="row" alignItems="center" gap={1.25}>
                          <Avatar
                            sx={{
                              width: 30,
                              height: 30,
                              bgcolor:
                                done || passed
                                  ? alpha(THEME.success, 0.14)
                                  : active
                                  ? alpha(THEME.primary, 0.12)
                                  : "#eef2f7",
                              color:
                                done || passed
                                  ? THEME.success
                                  : active
                                  ? THEME.primary
                                  : "text.secondary",
                            }}
                          >
                            {active ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : done || passed ? (
                              <CheckCircleIcon sx={{ fontSize: 18 }} />
                            ) : (
                              <Typography variant="caption" fontWeight={900}>
                                {index + 1}
                              </Typography>
                            )}
                          </Avatar>
                          <Box flex={1}>
                            <Typography variant="body2" fontWeight={800}>
                              {step}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={done || passed ? 100 : active ? 64 : 0}
                              sx={{
                                mt: 0.5,
                                height: 5,
                                borderRadius: 99,
                                bgcolor: "#edf2f7",
                                "& .MuiLinearProgress-bar": {
                                  borderRadius: 99,
                                  bgcolor: done || passed ? THEME.success : THEME.primary,
                                },
                              }}
                            />
                          </Box>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={5}>
                <Paper
                  variant="outlined"
                  sx={{
                    height: "100%",
                    minHeight: 360,
                    p: 2,
                    borderRadius: 3,
                    color: "#24324b",
                    bgcolor: "#ffffff",
                    borderColor: alpha(THEME.primary, 0.14),
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "0 18px 45px rgba(148, 40, 40, 0.08)",
                  }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      inset: -40,
                      background:
                        "radial-gradient(circle at 18% 12%, rgba(211,47,47,0.1), transparent 34%), radial-gradient(circle at 88% 18%, rgba(46,125,50,0.1), transparent 28%)",
                    }}
                  />
                  <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography
                          variant="overline"
                          sx={{ color: "text.secondary", letterSpacing: 0, fontWeight: 800 }}
                        >
                          Centre de collecte
                        </Typography>
                        <Typography variant="h6" fontWeight={900} color="text.primary">
                          {agentLoading
                            ? "Détection en cours"
                            : agentResult
                            ? "Recherche finalisée"
                            : "Prêt à prospecter"}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={
                          agentLoading
                            ? "En cours"
                            : agentStats.hasProspects
                            ? `${agentStats.acceptedCount} validés`
                            : "En attente"
                        }
                        sx={{
                          bgcolor: agentLoading
                            ? alpha(THEME.warning, 0.14)
                            : alpha(THEME.success, 0.18),
                          color: agentLoading ? "#b45309" : THEME.success,
                          border: `1px solid ${
                            agentLoading ? alpha(THEME.warning, 0.28) : alpha(THEME.success, 0.28)
                          }`,
                          fontWeight: 800,
                        }}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                      {agentLoading
                        ? PROSPECTION_AGENT_STEPS[agentProgressStep]
                        : agentResult
                        ? "Les profils trouvés sont prêts à être consultés dans le CRM."
                        : "Lance une recherche pour générer une liste exploitable."}
                    </Typography>

                    <Box
                      sx={{
                        width: 220,
                        height: 220,
                        mx: "auto",
                        my: 2.5,
                        borderRadius: "50%",
                        position: "relative",
                        background:
                          "repeating-radial-gradient(circle, rgba(211,47,47,0.16) 0 1px, transparent 1px 42px), conic-gradient(from 0deg, rgba(211,47,47,0.24), rgba(46,125,50,0.2), rgba(25,118,210,0.08), rgba(211,47,47,0.24))",
                        border: `1px solid ${alpha(THEME.primary, 0.16)}`,
                        boxShadow:
                          "inset 0 0 36px rgba(211,47,47,0.08), 0 16px 36px rgba(36,50,75,0.08)",
                        "@keyframes crmProspectionSweep": {
                          to: { transform: "rotate(360deg)" },
                        },
                        "&:before": {
                          content: '""',
                          position: "absolute",
                          inset: 108,
                          height: 104,
                          width: 2,
                          transformOrigin: "center top",
                          bgcolor: alpha(THEME.primary, 0.72),
                          animation: agentLoading
                            ? "crmProspectionSweep 2.6s linear infinite"
                            : "none",
                        },
                        "&:after": {
                          content: '""',
                          position: "absolute",
                          inset: 96,
                          borderRadius: "50%",
                          bgcolor: THEME.primary,
                          boxShadow: `0 0 24px ${alpha(THEME.primary, 0.35)}`,
                        },
                      }}
                    >
                      {[
                        [28, 60, agentStats.acceptedCount],
                        [62, 24, agentStats.newCount],
                        [72, 66, agentStats.importedCount],
                        [38, 78, agentStats.existingCount],
                      ].map(([left, top, value], index) => (
                        <Box
                          key={`${left}-${top}`}
                          sx={{
                            position: "absolute",
                            left: `${left}%`,
                            top: `${top}%`,
                            width: value || agentLoading ? 12 : 8,
                            height: value || agentLoading ? 12 : 8,
                            borderRadius: "50%",
                            bgcolor: value || agentLoading ? THEME.success : alpha("#64748b", 0.26),
                            border: "2px solid #ffffff",
                            boxShadow:
                              value || agentLoading
                                ? `0 0 16px ${alpha(THEME.success, 0.45)}`
                                : "none",
                            opacity: agentResult || agentLoading || index < 2 ? 1 : 0.45,
                          }}
                        />
                      ))}
                    </Box>

                    <Grid container spacing={1}>
                      {[
                        ["Analysés", agentStats.rawResultsCount],
                        ["Exploitables", agentStats.acceptedCount],
                        ["Ajoutés CRM", agentStats.importedCount],
                        ["Déjà connus", agentStats.existingCount],
                      ].map(([label, value]) => (
                        <Grid item xs={6} key={label}>
                          <Box
                            sx={{
                              p: 1.2,
                              borderRadius: 2,
                              bgcolor: alpha("#f8fafc", 0.92),
                              border: `1px solid ${alpha("#94a3b8", 0.2)}`,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="h6" fontWeight={900} color="text.primary">
                              {value}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                {agentLoading && (
                  <Alert severity="info" icon={<CircularProgress size={18} />}>
                    {PROSPECTION_AGENT_STEPS[agentProgressStep]}...
                  </Alert>
                )}

                {agentError && agentQuery.trim() && (
                  <Alert severity="warning">
                    <Typography variant="subtitle2" fontWeight={900}>
                      Recherche non finalisée
                    </Typography>
                    <Typography variant="body2">{agentError}</Typography>
                  </Alert>
                )}

                {agentResult && (
                  <Paper
                    variant="outlined"
                    sx={{
                      mt: 1.5,
                      p: 2,
                      borderRadius: 3,
                      bgcolor: "white",
                      borderColor: alpha(THEME.success, 0.22),
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          p: 1.75,
                          borderRadius: 2.5,
                          bgcolor: agentStats.hasProspects
                            ? alpha(THEME.success, 0.08)
                            : alpha(THEME.info, 0.08),
                          border: `1px solid ${
                            agentStats.hasProspects
                              ? alpha(THEME.success, 0.22)
                              : alpha(THEME.info, 0.22)
                          }`,
                        }}
                      >
                        <Stack direction="row" gap={1.25} alignItems="flex-start">
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: agentStats.hasProspects
                                ? alpha(THEME.success, 0.14)
                                : alpha(THEME.info, 0.14),
                              color: agentStats.hasProspects ? THEME.success : THEME.info,
                            }}
                          >
                            <CheckCircleIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={900}>
                              {agentStats.hasProspects
                                ? "Prospection finalisée"
                                : "Recherche terminée"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {discoveryResultMessage(agentResult)} {agentStats.acceptedCount}{" "}
                              prospect(s) exploitable(s), {agentStats.importedCount} enregistré(s)
                              dans le CRM.
                            </Typography>
                            {agentResult.errors?.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                Certains résultats incomplets ont été ignorés.
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                      {agentResult.gemini_fallback_used && (
                        <Typography variant="caption" color="text.secondary">
                          La recherche a été finalisée avec le mode de continuité IA.
                        </Typography>
                      )}
                      <Grid container spacing={1}>
                        {[
                          ["Analysés", agentStats.rawResultsCount],
                          ["Exploitables", agentStats.acceptedCount],
                          ["Nouveaux", agentStats.newCount],
                          ["Déjà connus", agentStats.existingCount],
                          ["Incomplets", agentStats.rejectedCount],
                          ["Ajoutés CRM", agentStats.importedCount],
                          ["À vérifier", agentStats.importFailedCount],
                        ].map(([label, value]) => (
                          <Grid item xs={6} sm={3} md={2.4} key={label}>
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.25,
                                borderRadius: 2,
                                bgcolor: "#fbfdff",
                                borderColor: alpha(THEME.primary, 0.12),
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {label}
                              </Typography>
                              <Typography variant="h6" fontWeight={900}>
                                {value}
                              </Typography>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                      {discoverySummarySources(agentResult).length > 0 && (
                        <Box>
                          <Typography variant="caption" color="textSecondary" fontWeight={800}>
                            Sources exploitées
                          </Typography>
                          <Stack direction="row" gap={0.75} flexWrap="wrap" mt={0.75}>
                            {discoverySummarySources(agentResult).map((source) => (
                              <Chip
                                key={source.fullLabel}
                                size="small"
                                label={source.fullLabel}
                                sx={{
                                  borderRadius: 1,
                                  bgcolor: alpha(source.color, 0.1),
                                  color: source.color,
                                  border: `1px solid ${alpha(source.color, 0.35)}`,
                                  fontWeight: 700,
                                }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 2, bgcolor: "white" }}>
            <Button onClick={() => setAgentOpen(false)} disabled={agentLoading}>
              Annuler
            </Button>
            {agentResult?.report_available && (
              <Button
                variant="outlined"
                startIcon={<PeopleIcon />}
                onClick={() => setAgentOpen(false)}
                disabled={!agentStats.hasProspects}
                sx={{ textTransform: "none", borderRadius: 1.5 }}
              >
                Voir les prospects
              </Button>
            )}
            {agentResult?.report_available && (
              <GradientButton
                startIcon={
                  reportDownloading ? <CircularProgress size={16} color="inherit" /> : <PdfIcon />
                }
                onClick={() => downloadDiscoveryReport(agentResult)}
                disabled={reportDownloading}
              >
                Rapport PDF
              </GradientButton>
            )}
            <GradientButton
              startIcon={
                agentLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />
              }
              onClick={runAgentFromProspects}
              disabled={agentLoading || !agentQuery.trim()}
            >
              {agentLoading ? "Recherche..." : "Rechercher"}
            </GradientButton>
          </DialogActions>
        </Dialog>

        {lastDiscoveryRun?.report_available && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(THEME.primary, 0.025),
              borderColor: alpha(THEME.primary, 0.16),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>
                Dernière recherche IA
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {lastDiscoveryRun.found || 0} prospects trouvés · {lastDiscoveryRun.imported || 0}{" "}
                importés
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={reportDownloading ? <CircularProgress size={14} /> : <PdfIcon />}
              onClick={() => downloadDiscoveryReport(lastDiscoveryRun)}
              disabled={reportDownloading}
              sx={{ textTransform: "none", borderRadius: 1.5 }}
            >
              Rapport PDF
            </Button>
          </Paper>
        )}

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              title: "Total prospects",
              value: total,
              icon: <PeopleIcon />,
              color: THEME.primary,
              chips: [
                { label: `${stats.new} Nouveaux`, color: THEME.info, filter: { status: ["new"] } },
                {
                  label: `${stats.qualified} Qualifiés`,
                  color: THEME.success,
                  filter: { status: ["qualified"] },
                },
              ],
            },
            {
              title: "Évaluation chauds",
              value: stats.hot,
              icon: <Box sx={{ fontSize: 24 }}>🔥</Box>,
              color: THEME.error,
              chips: [
                {
                  label: `${stats.warm} Tièdes`,
                  color: THEME.warning,
                  filter: { evaluation: ["warm"] },
                },
                {
                  label: `${stats.cold} Froids`,
                  color: THEME.info,
                  filter: { evaluation: ["cold"] },
                },
              ],
            },
            {
              title: "Taux conversion",
              value: total ? `${Math.round((stats.won / total) * 100)}%` : "0%",
              icon: <TrendingUpIcon />,
              color: THEME.success,
              chips: [
                { label: `${stats.won} Gagnés`, color: THEME.success, filter: { status: ["won"] } },
                { label: `${stats.lost} Perdus`, color: THEME.error, filter: { status: ["lost"] } },
              ],
            },
            {
              title: "En cours",
              value: stats.contacted + stats.qualified,
              icon: <ScheduleIcon />,
              color: THEME.warning,
              chips: [
                {
                  label: `${stats.contacted} Contactés`,
                  color: THEME.warning,
                  filter: { status: ["contacted"] },
                },
                {
                  label: `${stats.qualified} Qualifiés`,
                  color: THEME.success,
                  filter: { status: ["qualified"] },
                },
              ],
            },
          ].map((card, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <StatsCardItem
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                onClick={() => setApiFilters({})}
              >
                {card.chips.map((chip, j) => (
                  <Chip
                    key={j}
                    size="small"
                    label={chip.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      setApiFilters(chip.filter);
                    }}
                    sx={{
                      bgcolor: alpha(chip.color, 0.1),
                      color: chip.color,
                      borderRadius: 1,
                      border: `1px solid ${chip.color}`,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </StatsCardItem>
            </Grid>
          ))}
        </Grid>

        {crmMapProspects.length > 0 && (
          <StyledCard sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    Localisation des prospects
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {crmMapProspects.length} prospect(s) avec coordonnees verifiees.
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  icon={<LocationOnIcon />}
                  label="Carte"
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha(THEME.primary, 0.08),
                    color: THEME.primary,
                  }}
                />
              </Box>
              <ProspectLocationsMap prospects={crmMapProspects} />
            </CardContent>
          </StyledCard>
        )}

        {/* Barre de recherche + filtres actifs */}
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Rechercher un prospect..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: THEME.primary }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchTerm("")}>
                          <ClearIcon sx={{ fontSize: 18, color: THEME.primary }} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                  <ButtonGroup variant="outlined" size="small">
                    {[
                      { mode: "table", icon: <ViewColumnIcon /> },
                      { mode: "cards", icon: <AssessmentIcon /> },
                    ].map((v) => (
                      <Button
                        key={v.mode}
                        onClick={() => setViewMode(v.mode)}
                        sx={{
                          bgcolor: viewMode === v.mode ? alpha(THEME.primary, 0.1) : "transparent",
                          color: viewMode === v.mode ? THEME.primary : "text.secondary",
                          borderColor: alpha(THEME.primary, 0.3),
                        }}
                      >
                        {v.icon}
                      </Button>
                    ))}
                  </ButtonGroup>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      sx={{
                        borderRadius: 3,
                        height: 36,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: alpha(THEME.primary, 0.3),
                        },
                      }}
                    >
                      <MenuItem value="-created_at">Date création ↓</MenuItem>
                      <MenuItem value="created_at">Date création ↑</MenuItem>
                      <MenuItem value="last_name">Nom A→Z</MenuItem>
                      <MenuItem value="-last_name">Nom Z→A</MenuItem>
                      <MenuItem value="status">Statut</MenuItem>
                      <MenuItem value="evaluation">Évaluation</MenuItem>
                    </Select>
                  </FormControl>
                  <Badge
                    color="error"
                    badgeContent={activeFilterCount}
                    invisible={activeFilterCount === 0}
                  >
                    <Button
                      variant="outlined"
                      startIcon={<FilterIcon />}
                      onClick={() => setShowFilters(true)}
                      size="small"
                      sx={{
                        borderRadius: 3,
                        borderColor:
                          activeFilterCount > 0 ? THEME.primary : alpha(THEME.primary, 0.3),
                        color: THEME.primary,
                        bgcolor: activeFilterCount > 0 ? alpha(THEME.primary, 0.05) : "transparent",
                      }}
                    >
                      Filtres
                    </Button>
                  </Badge>
                  <ExportMenu
                    onExportCSV={exportToCSV}
                    onExportExcel={exportToExcel}
                    onExportPDF={exportToPDF}
                  />
                  <Tooltip title="Rafraîchir">
                    <IconButton
                      size="small"
                      onClick={refresh}
                      sx={{
                        color: THEME.primary,
                        border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                        borderRadius: 2,
                      }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>

            {/* Chips des filtres actifs */}
            {activeFilterCount > 0 && (
              <Box mt={2} display="flex" flexWrap="wrap" gap={0.5} alignItems="center">
                <Typography variant="caption" color="textSecondary" sx={{ mr: 1 }}>
                  Filtres actifs :
                </Typography>
                {apiFilters.status?.map((v) => (
                  <Chip
                    key={`s-${v}`}
                    label={`Statut: ${getStatusLabel(v)}`}
                    size="small"
                    onDelete={() =>
                      setApiFilters({
                        ...apiFilters,
                        status: apiFilters.status.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.info, 0.1),
                      color: THEME.info,
                      border: `1px solid ${alpha(THEME.info, 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                {apiFilters.evaluation?.map((v) => (
                  <Chip
                    key={`e-${v}`}
                    label={`Éval: ${getEvaluationLabel(v)}`}
                    size="small"
                    onDelete={() =>
                      setApiFilters({
                        ...apiFilters,
                        evaluation: apiFilters.evaluation.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.warning, 0.1),
                      color: THEME.warning,
                      border: `1px solid ${alpha(THEME.warning, 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                {apiFilters.origin?.map((v) => (
                  <Chip
                    key={`o-${v}`}
                    label={`Origine: ${getOriginLabel(v)}`}
                    size="small"
                    onDelete={() =>
                      setApiFilters({
                        ...apiFilters,
                        origin: apiFilters.origin.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.success, 0.1),
                      color: THEME.success,
                      border: `1px solid ${alpha(THEME.success, 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                {apiFilters.source?.map((v) => (
                  <Chip
                    key={`src-${v}`}
                    label={`Source: ${SOURCE_CONFIG[v]?.label || v}`}
                    size="small"
                    onDelete={() =>
                      setApiFilters({
                        ...apiFilters,
                        source: apiFilters.source.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.primary, 0.1),
                      color: THEME.primary,
                      border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                {apiFilters.prospect_company?.map((v) => {
                  const company = companies.find((c) => String(c.id) === String(v));
                  return (
                    <Chip
                      key={`c-${v}`}
                      label={`Société: ${company?.name || v}`}
                      size="small"
                      icon={<BusinessIcon sx={{ fontSize: "14px !important" }} />}
                      onDelete={() =>
                        setApiFilters({
                          ...apiFilters,
                          prospect_company: apiFilters.prospect_company.filter((x) => x !== v),
                        })
                      }
                      sx={{
                        borderRadius: 1,
                        bgcolor: alpha(THEME.primary, 0.08),
                        color: THEME.primaryDark,
                        border: `1px solid ${alpha(THEME.primary, 0.25)}`,
                        fontSize: "0.72rem",
                      }}
                    />
                  );
                })}
                {apiFilters.assigned_to?.map((v) => {
                  const user = commercials.find((c) => String(c.id) === String(v));
                  return (
                    <Chip
                      key={`a-${v}`}
                      label={`Assigné: ${user?.username || v}`}
                      size="small"
                      icon={<PersonOutlineIcon sx={{ fontSize: "14px !important" }} />}
                      onDelete={() =>
                        setApiFilters({
                          ...apiFilters,
                          assigned_to: apiFilters.assigned_to.filter((x) => x !== v),
                        })
                      }
                      sx={{
                        borderRadius: 1,
                        bgcolor: alpha(THEME.primary, 0.08),
                        color: THEME.primaryDark,
                        border: `1px solid ${alpha(THEME.primary, 0.25)}`,
                        fontSize: "0.72rem",
                      }}
                    />
                  );
                })}
                <Chip
                  label="Tout effacer"
                  size="small"
                  onClick={() => setApiFilters({})}
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha(THEME.primary, 0.1),
                    color: THEME.primary,
                    border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                />
              </Box>
            )}
          </CardContent>
        </StyledCard>

        {/* Vue Tableau */}
        {viewMode === "table" && (
          <StyledCard>
            <StyledTableContainer>
              <Table aria-label="Tableau des prospects">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "27%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
                <StyledTableHead>
                  <TableRow>
                    <TableCell>Prospect</TableCell>
                    <TableCell>Société / Contact</TableCell>
                    <TableCell align="center">Statut</TableCell>
                    <TableCell>Assigné à</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </StyledTableHead>
                <TableBody>
                  {prospectsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                        <Box textAlign="center">
                          <PeopleIcon
                            sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }}
                          />
                          <Typography variant="h6" color="textSecondary" gutterBottom>
                            Aucun prospect trouvé
                          </Typography>
                          <GradientButton
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => {
                              resetForm();
                              setShowForm(true);
                            }}
                            sx={{ mt: 2 }}
                          >
                            Créer un prospect
                          </GradientButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    prospectsList.map((p) => (
                      <ProspectTableRow
                        key={p.id}
                        prospect={p}
                        companyName={getCompanyNameById(p.prospect_company)}
                        onView={handleViewDetails}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        onContextMenu={handleContextMenu}
                        onOpenDossier={(prospectId) => navigate(`/prospects/${prospectId}`)}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </StyledTableContainer>
            <PaginationBar
              page={page}
              pages={pages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              loading={loading}
            />
          </StyledCard>
        )}

        {/* Vue Cartes */}
        {viewMode === "cards" && (
          <>
            <Grid container spacing={2}>
              {prospectsList.map((p) => (
                <Grid item xs={12} sm={6} md={4} key={p.id}>
                  <ProspectCard
                    prospect={p}
                    companyName={getCompanyNameById(p.prospect_company)}
                    currentUser={currentUser}
                    onView={handleViewDetails}
                    onEdit={handleEdit}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    onDelete={handleDeleteClick}
                  />
                </Grid>
              ))}
            </Grid>
            <Box mt={2}>
              <PaginationBar
                page={page}
                pages={pages}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                loading={loading}
              />
            </Box>
          </>
        )}

        {/* Context Menu */}
        <Menu
          open={contextMenu.open}
          onClose={handleContextMenuClose}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu.open ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
          }
          PaperProps={{ sx: { borderRadius: 3, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" } }}
        >
          {[
            {
              icon: <VisibilityIcon fontSize="small" sx={{ color: "#0288d1" }} />,
              label: "Voir détails",
              fn: (id) => {
                const p = prospectsList.find((x) => x.id === id);
                if (p) handleViewDetails(p);
              },
            },
            {
              icon: <EditIcon fontSize="small" sx={{ color: "#1976d2" }} />,
              label: "Modifier",
              fn: (id) => {
                const p = prospectsList.find((x) => x.id === id);
                if (p) handleEdit(p);
              },
            },
            {
              icon: <ArchiveIcon fontSize="small" sx={{ color: "#ff9800" }} />,
              label: "Archiver",
              fn: handleArchive,
            },
            {
              icon: <RestoreIcon fontSize="small" sx={{ color: "#4caf50" }} />,
              label: "Restaurer",
              fn: handleRestore,
            },
          ].map((item) => (
            <MenuItem
              key={item.label}
              onClick={() => {
                item.fn(contextMenu.prospectId);
                handleContextMenuClose();
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem
            onClick={() => {
              if (contextMenu.prospectId) handleDeleteClick(contextMenu.prospectId);
              handleContextMenuClose();
            }}
            sx={{ color: THEME.primary }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Supprimer</ListItemText>
          </MenuItem>
        </Menu>

        <ProspectFormDrawer
          open={showForm}
          onClose={resetForm}
          isEditing={isEditing}
          companies={companies}
          commercials={commercials}
          currentUser={currentUser}
          prospectData={prospectData}
          companyData={companyData}
          selectedCompany={selectedCompany}
          onProspectDataChange={setProspectData}
          onCompanyDataChange={setCompanyData}
          onCompanySelect={setSelectedCompany}
          onSubmit={handleSubmit}
        />

        <FiltersDrawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          filters={apiFilters}
          onApply={handleApplyFilters}
          onReset={() => {
            setApiFilters({});
          }}
          companies={companies}
          commercials={commercials}
        />

        <ProspectDetailsDrawer
          open={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          prospect={selectedProspect}
          companies={companies}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />

        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
        >
          <DialogTitle sx={{ color: THEME.primary, fontWeight: 600 }}>
            Confirmer la suppression
          </DialogTitle>
          <DialogContent>
            <Typography>
              Êtes-vous sûr de vouloir supprimer ce prospect ? Cette action est irréversible.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} sx={{ borderRadius: 3, color: "text.secondary" }}>
              Annuler
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              sx={{ background: THEME.gradient, borderRadius: 3, px: 3 }}
            >
              Supprimer
            </Button>
          </DialogActions>
        </Dialog>
      </MDBox>
    </DashboardLayout>
  );
}
