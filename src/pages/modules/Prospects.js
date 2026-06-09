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
} from "@mui/icons-material";

import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../superadmin/Marketingwidgets";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import PaginationBar from "../../components/PaginationBar";
import SocialConnectionBox, { isSessionReady } from "../../components/social/SocialConnectionBox";
import { runProspectionAgent } from "../../services/prospectAgentApi";

const SOURCE_CONFIG = {
  google_maps: { label: "Google Maps", color: "#d32f2f" },
  linkedin: { label: "LinkedIn", color: "#0077b5" },
  instagram: { label: "Instagram", color: "#e1306c" },
  facebook: { label: "Facebook", color: "#1877f2" },
  web: { label: "Web", color: "#c62828" },
  other: { label: "Autre", color: "#6d4c41" },
  commercial: { label: "Commercial", color: "#b71c1c" },
  agent_prospection: { label: "Agent de prospection", color: "#8e0000" },
};

const PROSPECT_SOURCE_OPTIONS = [
  ["google_maps", "Google Maps"],
  ["linkedin", "LinkedIn"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["web", "Web"],
  ["other", "Autre"],
];

const TASK_TYPE_OPTIONS = [
  ["classic", "Tache classique"],
  ["call", "Appel"],
  ["linkedin_message", "Message LinkedIn"],
  ["email", "Email"],
  ["facebook_message", "Message Facebook"],
  ["instagram_message", "Message Instagram"],
  ["follow_up", "Relance"],
  ["meeting", "RDV"],
  ["note", "Note"],
  ["other", "Autre"],
];

const getProspectDisplayName = (prospect) =>
  [prospect?.first_name, prospect?.last_name].filter(Boolean).join(" ").trim() || "Sans nom";

const getProspectInitials = (prospect) => {
  const name = getProspectDisplayName(prospect);
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const SourceBadge = ({ source }) => {
  const cfg = SOURCE_CONFIG[source] || { label: source, color: "#9e9e9e" };
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
  source: PropTypes.string,
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
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const agentCompanies = (result) => result?.prospect_companies || result?.companies || [];
const agentPersons = (result) => result?.prospect_persons || result?.prospects || [];
const agentMapProspects = (result) => result?.map_prospects || [];
const agentLeadName = (item) =>
  item?.name ||
  item?.company_name ||
  item?.full_name ||
  [item?.first_name, item?.last_name].filter(Boolean).join(" ").trim() ||
  "Prospect";
const agentLeadSourceLabel = (item) =>
  item?.source_label || SOURCE_CONFIG[item?.source]?.label || item?.source || "Source inconnue";
const agentLeadScore = (item) =>
  Number(item?.lead_score ?? item?.score_ia ?? item?.score ?? 0);
const hasCoordinates = (item) => item?.latitude && item?.longitude;

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
  const score = agentLeadScore(item);
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

        <Box>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary">
              Score IA
            </Typography>
            <Typography variant="caption" fontWeight={800}>
              {score}/100
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, score))}
            sx={{ height: 6, borderRadius: 1 }}
          />
        </Box>

        {(item.raison_score || item.reason || item.evaluation) && (
          <Typography variant="caption" color="text.secondary">
            Qualification : {item.raison_score || item.reason || item.evaluation}
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
const API_BASE_URL = "http://127.0.0.1:8000/api/sales";
const API_ENGAGEMENT_URL = "http://127.0.0.1:8000/api/engagement";
const API_USER_ME = "http://127.0.0.1:8000/api/users/me/";
const API_ASSIGNABLE = "http://127.0.0.1:8000/api/users/assignable-users/";

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const engagementApi = axios.create({ baseURL: API_ENGAGEMENT_URL });
engagementApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: `0 12px 24px ${alpha(THEME.primary, 0.2)}`,
    borderColor: THEME.primary,
  },
}));

const StyledTableContainer = styled(TableContainer)(() => ({
  borderRadius: 16,
  boxShadow: `0 8px 16px ${alpha("#000", 0.05)}`,
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  overflowX: "auto",
  "& .MuiTable-root": { minWidth: 1500, borderCollapse: "collapse", tableLayout: "fixed" },
}));

const StyledTableHead = styled(TableHead)(() => ({
  "& .MuiTableCell-head": {
    fontWeight: 700,
    color: THEME.primary,
    fontSize: "0.85rem",
    padding: "16px 8px",
    backgroundColor: alpha(THEME.primary, 0.04),
    borderBottom: `2px solid ${THEME.primary}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  "&:hover": { backgroundColor: alpha(THEME.primary, 0.02), cursor: "pointer" },
  "& td": { padding: "12px 8px", borderBottom: `1px solid ${alpha("#000", 0.05)}` },
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
  background: "white",
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
  currentUser,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onContextMenu,
}) => {
  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);
  const displayName = getProspectDisplayName(prospect);
  const linkedCompanyName = companyName || prospect.prospect_company_detail?.name;
  const sourceLinks = [
    { href: prospect.source_url, icon: OpenInNewIcon, label: "Source", color: THEME.primary },
    { href: prospect.google_maps_url, icon: LocationOnIcon, label: "Maps", color: "#d32f2f" },
    { href: prospect.website, icon: LanguageIcon, label: "Web", color: "#1976d2" },
    { href: prospect.linkedin_url, icon: LinkedInIcon, label: "LinkedIn", color: "#0077b5" },
    { href: prospect.facebook_url, icon: FacebookIcon, label: "Facebook", color: "#1877f2" },
    { href: prospect.instagram_url, icon: InstagramIcon, label: "Instagram", color: "#e1306c" },
  ].filter((link) => link.href);
  return (
    <StyledTableRow
      onDoubleClick={() => onView(prospect)}
      onContextMenu={(e) => onContextMenu(e, prospect.id)}
    >
      {/* Prospect */}
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, maxWidth: 170 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(THEME.primary, 0.1),
              color: THEME.primary,
              fontSize: "0.75rem",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {getProspectInitials(prospect)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {displayName}
            </Typography>
            <Typography variant="caption" color="textSecondary" noWrap>
              {prospect.title || "Sans titre"}
            </Typography>
          </Box>
        </Box>
      </TableCell>

      {/* Contact */}
      <TableCell>
        <Stack spacing={0.5} sx={{ maxWidth: 170 }}>
          {prospect.email && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <EmailIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6), flexShrink: 0 }} />
              <Typography variant="caption" noWrap>
                {prospect.email}
              </Typography>
            </Box>
          )}
          {prospect.phone && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <PhoneIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6), flexShrink: 0 }} />
              <Typography variant="caption" noWrap>
                {prospect.phone}
              </Typography>
            </Box>
          )}
          {!prospect.email && !prospect.phone && (
            <Typography variant="caption" color="textSecondary">
              —
            </Typography>
          )}
        </Stack>
      </TableCell>

      {/* ✅ Colonne Localisation dédiée */}
      <TableCell>
        {prospect.city || prospect.country ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: 120 }}>
            <LocationOnIcon
              sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6), flexShrink: 0 }}
            />
            <Typography variant="caption" noWrap>
              {[prospect.city, prospect.country].filter(Boolean).join(", ")}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="textSecondary">
            —
          </Typography>
        )}
      </TableCell>

      {/* Société */}
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: 130 }}>
          <BusinessIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6), flexShrink: 0 }} />
          <Typography variant="body2" noWrap>
            {linkedCompanyName || "Sans societe"}
          </Typography>
        </Box>
      </TableCell>

      {/* Assigné à */}
      {isAdminOrManager && (
        <TableCell>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: 130 }}>
            <PersonOutlineIcon
              sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6), flexShrink: 0 }}
            />
            {prospect.assigned_to_name ? (
              <Chip
                label={prospect.assigned_to_name}
                size="small"
                sx={{
                  bgcolor: alpha(THEME.primary, 0.08),
                  color: THEME.primaryDark,
                  borderRadius: 1,
                  fontSize: "0.72rem",
                  height: 22,
                }}
              />
            ) : (
              <Typography variant="caption" color="textSecondary">
                Non assigné
              </Typography>
            )}
          </Box>
        </TableCell>
      )}

      {/* Évaluation */}
      <TableCell align="center">
        {prospect.evaluation ? (
          <StyledChip
            label={getEvaluationLabel(prospect.evaluation)}
            evaluation={prospect.evaluation}
            size="small"
          />
        ) : (
          <Typography variant="caption" color="textSecondary">
            -
          </Typography>
        )}
      </TableCell>

      {/* Statut */}
      <TableCell align="center">
        <Chip
          label={getStatusLabel(prospect.status)}
          size="small"
          icon={getStatusIcon(prospect.status)}
          sx={{
            bgcolor: alpha(getStatusColor(prospect.status), 0.1),
            color: getStatusColor(prospect.status),
            borderRadius: 1,
            fontWeight: 500,
          }}
        />
      </TableCell>

      {/* Prochaine tache */}
      <TableCell>
        {prospect.next_task ? (
          <Chip
            size="small"
            label={prospect.next_task.title}
            sx={{
              maxWidth: 190,
              borderRadius: 1,
              bgcolor: alpha(THEME.primary, 0.08),
              color: THEME.primaryDark,
              border: `1px solid ${alpha(THEME.primary, 0.25)}`,
              fontWeight: 600,
              "& .MuiChip-label": {
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            }}
          />
        ) : (
          <Typography variant="caption" color="textSecondary">
            Aucune
          </Typography>
        )}
      </TableCell>

      {/* Source */}
      <TableCell>
        <Stack spacing={0.75} sx={{ minWidth: 150 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
            {prospect.source ? (
              <SourceBadge source={prospect.source} />
            ) : (
              <Typography variant="caption" color="textSecondary">
                —
              </Typography>
            )}
            {sourceLinks.slice(0, 4).map(({ href, icon: Icon, label, color }) => (
              <Tooltip key={`${label}-${href}`} title={label}>
                <IconButton
                  component="a"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    width: 24,
                    height: 24,
                    color,
                    bgcolor: alpha(color, 0.08),
                    border: `1px solid ${alpha(color, 0.22)}`,
                  }}
                >
                  <Icon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        </Stack>
      </TableCell>

      {/* Création */}
      <TableCell>
        <Typography variant="caption" noWrap>
          {formatDate(prospect.created_at)}
        </Typography>
      </TableCell>

      {/* ✅ Actions — sans Restaurer */}
      <TableCell align="center">
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
          {[
            {
              title: "Voir",
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
              title: "Archiver",
              color: "#ff9800",
              icon: <ArchiveIcon sx={{ fontSize: 16 }} />,
              onClick: () => onArchive(prospect.id),
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
  currentUser: PropTypes.object,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onArchive: PropTypes.func.isRequired,
  onRestore: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onContextMenu: PropTypes.func.isRequired,
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
          {prospect.source === "google_maps" ? (
            <Chip size="small" color="success" label="Google Maps" sx={{ borderRadius: 1 }} />
          ) : (
            prospect.source && <SourceBadge source={prospect.source} />
          )}
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
// ==============================
const ProspectDetailsDrawer = ({ open, onClose, prospect, companies, currentUser }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showPlanCall, setShowPlanCall] = useState(false);
  const [taskToRecord, setTaskToRecord] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [socialAnalysis, setSocialAnalysis] = useState(null);
  const [socialAnalysisLoading, setSocialAnalysisLoading] = useState(false);
  const [socialAnalysisError, setSocialAnalysisError] = useState("");

  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setShowPlanCall(false);
      setTaskToRecord(null);
      setSocialAnalysis(prospect?.social_profile_analysis || null);
      setSocialAnalysisError("");
    }
  }, [open, prospect?.id, prospect?.social_profile_analysis]);

  const getCompanyName = useCallback(
    (id) => {
      if (!id || !companies) return null;
      return companies.find((c) => c.id === id)?.name || null;
    },
    [companies]
  );

  if (!prospect) return null;

  const evalColor =
    { hot: THEME.error, warm: THEME.warning, cold: THEME.info }[prospect.evaluation] || "#9e9e9e";
  const statColor = STATUS_COLORS[prospect.status] || "#9e9e9e";

  const handleCallCreated = (task) => {
    setShowPlanCall(false);
    setRefreshKey((k) => k + 1);
    setActiveTab(1);
  };

  const handleResultDone = () => {
    setTaskToRecord(null);
    setRefreshKey((k) => k + 1);
    setActiveTab(2);
  };

  const handleAnalyzeSocial = async () => {
    if (!prospect?.id) return;

    setSocialAnalysisLoading(true);
    setSocialAnalysisError("");

    try {
      const res = await engagementApi.post(`/prospects/${prospect.id}/analyze-social/`, {});
      const analysis = res.data?.analysis || {};
      setSocialAnalysis(analysis);
      if (!res.data?.success) {
        setSocialAnalysisError(res.data?.error || "Analyse sociale indisponible.");
      }
    } catch (err) {
      setSocialAnalysisError(
        err.response?.data?.error || err.message || "Erreur pendant l'analyse sociale."
      );
    } finally {
      setSocialAnalysisLoading(false);
    }
  };

  const tabs = ["Informations", "Tâches & Appels", "Activités", "Agent IA"];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: "min(720px, 95vw)",
          maxWidth: "95vw",
          overflowY: "auto",
          overflowX: "hidden",
          wordBreak: "break-word",
          whiteSpace: "normal",
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ p: 3, pb: 2, flexShrink: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: THEME.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Fiche prospect
            </Typography>
            <IconButton onClick={onClose} sx={{ bgcolor: alpha(THEME.primary, 0.08) }}>
              <CloseIcon sx={{ color: THEME.primary, fontSize: 20 }} />
            </IconButton>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: alpha(THEME.primary, 0.02),
              border: `1px solid ${alpha(THEME.primary, 0.1)}`,
              mb: 2,
            }}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  background: THEME.gradient,
                  fontSize: "1.4rem",
                  fontWeight: 700,
                }}
              >
                {getProspectInitials(prospect)}
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography variant="h6" fontWeight={700} noWrap>
                  {getProspectDisplayName(prospect)}
                </Typography>
                <Typography variant="caption" color="textSecondary" noWrap display="block">
                  {prospect.title || "Sans titre"}{" "}
                  {getCompanyName(prospect.prospect_company)
                    ? `· ${getCompanyName(prospect.prospect_company)}`
                    : ""}
                </Typography>
                <Stack direction="row" spacing={0.75} mt={0.75} flexWrap="wrap">
                  {prospect.evaluation && (
                    <Chip
                      label={EVALUATION_LABELS[prospect.evaluation] || prospect.evaluation}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.68rem",
                        bgcolor: alpha(evalColor, 0.1),
                        color: evalColor,
                        border: `1px solid ${evalColor}`,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Chip
                    label={STATUS_LABELS[prospect.status] || prospect.status}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: "0.68rem",
                      bgcolor: alpha(statColor, 0.1),
                      color: statColor,
                      border: `1px solid ${statColor}`,
                    }}
                  />
                </Stack>
              </Box>
            </Box>
          </Paper>

          {!showPlanCall && !taskToRecord && (
            <GradientButton
              fullWidth
              startIcon={<TaskIcon />}
              onClick={() => setShowPlanCall(true)}
              sx={{ mb: 1.5 }}
            >
              Planifier une tache
            </GradientButton>
          )}

          {showPlanCall && (
            <Box mb={1.5}>
              <PlanCallForm
                prospect={prospect}
                onCreated={handleCallCreated}
                onCancel={() => setShowPlanCall(false)}
              />
            </Box>
          )}

          {taskToRecord && (
            <Box mb={1.5}>
              <CallResultForm
                task={taskToRecord}
                prospect={prospect}
                onDone={handleResultDone}
                onCancel={() => setTaskToRecord(null)}
              />
            </Box>
          )}

          <Box
            display="flex"
            gap={0.5}
            sx={{ borderBottom: `1px solid ${alpha(THEME.primary, 0.1)}`, pb: 0 }}
          >
            {tabs.map((tab, i) => (
              <Button
                key={tab}
                onClick={() => setActiveTab(i)}
                size="small"
                sx={{
                  textTransform: "none",
                  fontWeight: activeTab === i ? 700 : 400,
                  fontSize: "0.82rem",
                  color: activeTab === i ? THEME.primary : "text.secondary",
                  borderRadius: 0,
                  pb: 1,
                  borderBottom:
                    activeTab === i ? `2px solid ${THEME.primary}` : "2px solid transparent",
                  transition: "all .15s",
                }}
              >
                {tab}
              </Button>
            ))}
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", px: 3, pb: 3 }}>
          {activeTab === 0 && (
            <Stack spacing={2} pt={1}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}
                >
                  Coordonnées
                </Typography>
                <Stack spacing={1.25}>
                  {prospect.email && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <EmailIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                      <Typography variant="body2">{prospect.email}</Typography>
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
                      <LocationOnIcon
                        sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6), mt: 0.25 }}
                      />
                      <Typography variant="body2">{prospect.address}</Typography>
                    </Box>
                  )}
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                    <Typography variant="body2">
                      {getCompanyName(prospect.prospect_company) ||
                        prospect.prospect_company_detail?.name ||
                        "Sans societe"}
                    </Typography>
                  </Box>
                </Stack>
              </Card>

              {(prospect.source_url ||
                prospect.google_maps_url ||
                prospect.website ||
                prospect.linkedin_url ||
                prospect.facebook_url ||
                prospect.instagram_url) && (
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}
                  >
                    Présence en ligne
                  </Typography>
                  <Stack spacing={1}>
                    <SocialLink
                      href={prospect.source_url}
                      icon={OpenInNewIcon}
                      label="Lien source"
                      color={THEME.primary}
                    />
                    <SocialLink
                      href={prospect.google_maps_url}
                      icon={LocationOnIcon}
                      label="Google Maps"
                      color="#d32f2f"
                    />
                    <SocialLink
                      href={prospect.website}
                      icon={LanguageIcon}
                      label="Site web"
                      color="#1976d2"
                    />
                    <SocialLink
                      href={prospect.linkedin_url}
                      icon={LinkedInIcon}
                      label="LinkedIn"
                      color="#0077b5"
                    />
                    <SocialLink
                      href={prospect.facebook_url}
                      icon={FacebookIcon}
                      label="Facebook"
                      color="#1877f2"
                    />
                    <SocialLink
                      href={prospect.instagram_url}
                      icon={InstagramIcon}
                      label="Instagram"
                      color="#e1306c"
                    />
                  </Stack>
                </Card>
              )}

              {prospect.description && (
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}
                  >
                    Description du prospect
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {prospect.description}
                  </Typography>
                </Card>
              )}

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1.5}
                  mb={1.5}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <AssessmentIcon sx={{ fontSize: 18, color: THEME.primary }} />
                    <Typography variant="subtitle2" sx={{ color: THEME.primary, fontWeight: 700 }}>
                      Analyse sociale IA
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleAnalyzeSocial}
                    disabled={socialAnalysisLoading}
                    startIcon={
                      socialAnalysisLoading ? <CircularProgress size={14} /> : <RefreshIcon />
                    }
                    sx={{
                      textTransform: "none",
                      borderColor: alpha(THEME.primary, 0.3),
                      color: THEME.primary,
                      fontWeight: 700,
                    }}
                  >
                    Relancer
                  </Button>
                </Box>

                {socialAnalysisError && (
                  <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}>
                    {socialAnalysisError}
                  </Alert>
                )}

                {socialAnalysis?.summary ? (
                  <Stack spacing={1.2}>
                    <Typography variant="body2" color="textSecondary">
                      {socialAnalysis.summary}
                    </Typography>

                    {socialAnalysis.description && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {socialAnalysis.description}
                      </Typography>
                    )}

                    {socialAnalysis.profile_type && (
                      <Chip
                        size="small"
                        label={socialAnalysis.profile_type}
                        sx={{
                          alignSelf: "flex-start",
                          bgcolor: alpha(THEME.primary, 0.08),
                          color: THEME.primaryDark,
                          fontWeight: 600,
                        }}
                      />
                    )}

                    {Boolean(socialAnalysis.interests?.length) && (
                      <Box display="flex" gap={0.75} flexWrap="wrap">
                        {socialAnalysis.interests.map((interest) => (
                          <Chip
                            key={interest}
                            size="small"
                            label={interest}
                            sx={{
                              bgcolor: alpha(THEME.primary, 0.08),
                              color: THEME.primaryDark,
                              fontWeight: 600,
                            }}
                          />
                        ))}
                      </Box>
                    )}

                    {Boolean(socialAnalysis.recent_topics?.length) && (
                      <Box display="flex" gap={0.75} flexWrap="wrap">
                        {socialAnalysis.recent_topics.map((topic) => (
                          <Chip key={topic} size="small" label={topic} variant="outlined" />
                        ))}
                      </Box>
                    )}

                    <Stack spacing={0.75}>
                      {[
                        ["Activite", socialAnalysis.activity_level],
                        ["Ton recommande", socialAnalysis.communication_tone],
                        ["Pertinence", socialAnalysis.commercial_relevance],
                      ].map(([label, value]) => (
                        <Box key={label} display="flex" justifyContent="space-between" gap={2}>
                          <Typography variant="caption" color="textSecondary">
                            {label}
                          </Typography>
                          <Typography variant="caption" fontWeight={700}>
                            {value || "unknown"}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>

                    {socialAnalysis.personalized_hook && (
                      <Box
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: alpha(THEME.primary, 0.04),
                          border: `1px solid ${alpha(THEME.primary, 0.12)}`,
                        }}
                      >
                        <Typography variant="caption" color="textSecondary" display="block">
                          Accroche proposee
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {socialAnalysis.personalized_hook}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Aucune analyse sociale disponible pour ce prospect.
                  </Typography>
                )}
              </Card>

              {prospect.notes && (
                <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}
                  >
                    Notes internes
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {prospect.notes}
                  </Typography>
                </Card>
              )}

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}
                >
                  Informations CRM
                </Typography>
                <Stack spacing={1}>
                  {[
                    { label: "Statut", value: STATUS_LABELS[prospect.status] || prospect.status },
                    { label: "Évaluation", value: EVALUATION_LABELS[prospect.evaluation] || "—" },
                    { label: "Assigné à", value: prospect.assigned_to_name || "Non assigné" },
                    { label: "Créé le", value: formatDate(prospect.created_at) },
                    { label: "Modifié le", value: formatDate(prospect.updated_at) },
                  ].map(({ label, value }) => (
                    <Box key={label} display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        {label}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="textSecondary">
                      Source
                    </Typography>
                    {prospect.source ? (
                      <SourceBadge source={prospect.source} />
                    ) : (
                      <Typography variant="body2" fontWeight={600}>
                        —
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Card>
            </Stack>
          )}

          {activeTab === 1 && (
            <Box pt={1}>
              <ProspectTasksList
                key={refreshKey}
                prospect={prospect}
                onRecordResult={(task) => {
                  setTaskToRecord(task);
                  setActiveTab(1);
                }}
              />
            </Box>
          )}

          {activeTab === 2 && (
            <Box pt={1}>
              <ActivityTimeline key={refreshKey} prospect={prospect} />
            </Box>
          )}

          {activeTab === 3 && (
            <Stack spacing={2} pt={1}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Typography variant="subtitle2" sx={{ color: THEME.primary, fontWeight: 600 }}>
                    Resume social IA
                  </Typography>
                  <Button
                    size="small"
                    onClick={runSocialAnalysis}
                    disabled={socialAnalysisLoading}
                    sx={{
                      textTransform: "none",
                      borderColor: alpha(THEME.primary, 0.3),
                      color: THEME.primary,
                      fontWeight: 700,
                    }}
                  >
                    Relancer analyse
                  </Button>
                </Box>
                {socialAnalysisError && (
                  <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}>
                    {socialAnalysisError}
                  </Alert>
                )}
                <Box
                  sx={{
                    bgcolor: "#fff",
                    border: "1px solid #fee2e2",
                    borderRadius: 2,
                    p: 1.5,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {socialAnalysis?.summary || "Aucune analyse sociale disponible pour ce prospect."}
                  </Typography>
                </Box>
              </Card>

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}>
                  Description IA
                </Typography>
                <Box
                  sx={{
                    bgcolor: "#fff",
                    border: "1px solid #fee2e2",
                    borderRadius: 2,
                    p: 1.5,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {socialAnalysis?.description || prospect.social_profile_description || "-"}
                  </Typography>
                </Box>
              </Card>

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}>
                  Interets et sujets recents
                </Typography>
                <Stack spacing={1.5}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {(socialAnalysis?.interests || prospect.social_profile_interests || []).length ? (
                      (socialAnalysis?.interests || prospect.social_profile_interests || []).map((interest) => (
                        <Chip key={interest} size="small" label={interest} />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </Box>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {(socialAnalysis?.recent_topics || prospect.social_profile_topics || []).length ? (
                      (socialAnalysis?.recent_topics || prospect.social_profile_topics || []).map((topic) => (
                        <Chip key={topic} size="small" label={topic} variant="outlined" />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </Box>
                </Stack>
              </Card>

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}>
                  Recommandations IA
                </Typography>
                <Stack spacing={1}>
                  {[
                    ["Niveau d'activite", socialAnalysis?.activity_level || prospect.social_profile_activity_level],
                    ["Pertinence commerciale", socialAnalysis?.commercial_relevance || prospect.social_profile_relevance],
                    ["Accroche recommandee", socialAnalysis?.personalized_hook || prospect.social_profile_hook],
                    ["Message prepare", prospect.generated_message],
                  ].map(([label, value]) => (
                    <Box key={label}>
                      <Typography variant="caption" color="textSecondary">
                        {label}
                      </Typography>
                      <Box
                        sx={{
                          mt: 0.5,
                          bgcolor: "#fff",
                          border: "1px solid #fee2e2",
                          borderRadius: 2,
                          p: 1.25,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        <Typography variant="body2">{value || "-"}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Card>
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
  currentUser: PropTypes.object,
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
  const [socialSessions, setSocialSessions] = useState({});

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
  }, [hookFilters]);

  // ── Init ──
  useEffect(() => {
    const tok = localStorage.getItem("token");
    if (!tok) {
      navigate("/sign-in");
      return;
    }
    fetchCurrentUser(tok);
  }, [navigate]);

  const fetchCurrentUser = async (tok) => {
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
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/prospect-companies/");
      setCompanies(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {}
  };

  const fetchCommercials = async (tok) => {
    try {
      const res = await axios.get(API_ASSIGNABLE, { headers: { Authorization: `Bearer ${tok}` } });
      const data = res.data;
      setCommercials(Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []);
    } catch {
      setCommercials([]);
    }
  };

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

  // ── Stats ──
  const loginRequired = Boolean(
    agentResult?.logs?.some((item) => item.step === "login_required") ||
      agentResult?.scrape_debug_events?.some((item) => item.requires_login) ||
      agentResult?.errors?.some((item) => item.step === "login_required")
  );
  const loginPlatforms = [
    ...new Set(
      [
        ...(agentResult?.logs || [])
          .filter((item) => item.step === "login_required")
          .map((item) => item.platform),
        ...(agentResult?.scrape_debug_events || [])
          .filter((item) => item.requires_login)
          .map((item) => item.platform),
      ].filter(Boolean)
    ),
  ];

  const requiredAgentPlatforms = useMemo(() => {
    const query = agentQuery.toLowerCase();
    const required = [];
    if (query.includes("linkedin")) required.push("linkedin");
    if (query.includes("facebook")) required.push("facebook");
    if (query.includes("instagram")) required.push("instagram");
    return required.length ? required : ["linkedin"];
  }, [agentQuery]);

  const missingRequiredAgentPlatforms = useMemo(
    () => requiredAgentPlatforms.filter((platform) => !isSessionReady(socialSessions?.[platform])),
    [requiredAgentPlatforms, socialSessions]
  );

  const canLaunchProspecting = missingRequiredAgentPlatforms.length === 0;

  const runAgentFromProspects = async () => {
    const query = agentQuery.trim();
    if (!query) {
      setAgentError("Veuillez saisir une requete");
      return;
    }

    if (!canLaunchProspecting) {
      const messageText = `Connectez d'abord : ${missingRequiredAgentPlatforms.join(", ")}`;
      setAgentError(messageText);
      showSnackbar(messageText, "warning");
      return;
    }

    setAgentLoading(true);
    setAgentError("");
    setAgentResult(null);

    try {
      const data = await runProspectionAgent(query);
      setAgentResult(data);
      await refresh();
      await fetchCompanies();
      showSnackbar(data.message || "Prospection terminee", "success");
    } catch (err) {
      const messageText =
        err.response?.data?.message || err.message || "Erreur pendant la prospection";
      setAgentError(messageText);
      showSnackbar(messageText, "error");
    } finally {
      setAgentLoading(false);
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
        </Box>

        {agentOpen && (
          <StyledCard
            sx={{
              position: "fixed",
              right: { xs: 16, md: 32 },
              bottom: { xs: 88, md: 104 },
              width: { xs: "calc(100vw - 32px)", sm: 440 },
              maxHeight: "calc(100vh - 140px)",
              overflow: "auto",
              zIndex: 1300,
              mb: 0,
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={2}
                  flexWrap="wrap"
                >
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      Agent de prospection
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Lancez une recherche, puis la liste des prospects et societes se rafraichit
                      automatiquement.
                    </Typography>
                  </Box>
                  {agentResult?.company_id && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`Workspace #${agentResult.company_id}`}
                    />
                  )}
                  <Tooltip title="Fermer l'agent">
                    <IconButton size="small" onClick={() => setAgentOpen(false)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <SocialConnectionBox
                  title="Connexions sociales pour la prospection"
                  compact
                  requiredPlatforms={requiredAgentPlatforms}
                  onStatusChange={setSocialSessions}
                />

                {missingRequiredAgentPlatforms.length > 0 && (
                  <Alert severity="warning">
                    Connectez les plateformes suivantes avant de lancer l&apos;agent :{" "}
                    {missingRequiredAgentPlatforms.join(", ")}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  value={agentQuery}
                  onChange={(e) => setAgentQuery(e.target.value)}
                  placeholder="Exemple : trouve des restaurants a Tunis avec telephone et Facebook"
                  disabled={agentLoading}
                />

                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  <GradientButton
                    startIcon={
                      agentLoading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />
                    }
                    onClick={runAgentFromProspects}
                    disabled={agentLoading || !canLaunchProspecting}
                  >
                    {agentLoading ? "Prospection en cours..." : "Lancer l'agent"}
                  </GradientButton>
                  {agentError && (
                    <Alert severity="error" sx={{ py: 0 }}>
                      {agentError}
                    </Alert>
                  )}
                </Box>

                {loginRequired && (
                  <Alert severity="warning">
                    Connexion {loginPlatforms.join(", ") || "reseau social"} requise. Utilisez le
                    panneau Connexions sociales pour ouvrir la fenetre de connexion, puis cliquez
                    sur Verifier session.
                  </Alert>
                )}

                {agentResult && (
                  <Box>
                    <Grid container spacing={1}>
                      {[
                        ["Entreprises trouvees", agentResult.companies_found || 0],
                        ["Personnes trouvees", agentResult.persons_found || 0],
                        ["Societes creees", agentResult.import_stats?.companies_created || 0],
                        ["Societes mises a jour", agentResult.import_stats?.companies_updated || 0],
                        ["Prospects crees", agentResult.import_stats?.persons_created || 0],
                        ["Prospects mis a jour", agentResult.import_stats?.persons_updated || 0],
                        ["Pages crawlees", agentResult.crawled_pages || 0],
                        ["Resultats rejetes", agentResult.rejected_results || 0],
                      ].map(([label, value]) => (
                        <Grid item xs={6} md={3} key={label}>
                          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="h6" fontWeight={800}>
                              {value}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    <AgentResultsPreview result={agentResult} />

                    <Collapse
                      in={Boolean(
                        agentResult.logs?.length ||
                          agentResult.gemini_decisions?.length ||
                          agentResult.scraping_debug?.length ||
                          agentResult.errors?.length
                      )}
                    >
                      <Box mt={2}>
                        <details>
                          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                            Details techniques
                          </summary>
                          <Box
                            component="pre"
                            sx={{
                              mt: 1,
                              p: 1.5,
                              bgcolor: alpha(THEME.primary, 0.04),
                              borderRadius: 2,
                              maxHeight: 260,
                              overflow: "auto",
                              fontSize: 12,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {JSON.stringify(
                              {
                                logs: agentResult.logs || [],
                                gemini_decisions: agentResult.gemini_decisions || [],
                                scraping_debug: agentResult.scraping_debug || [],
                                errors: agentResult.errors || [],
                              },
                              null,
                              2
                            )}
                          </Box>
                        </details>
                      </Box>
                    </Collapse>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </StyledCard>
        )}

        <Tooltip title={agentOpen ? "Agent ouvert" : "Ouvrir l'agent de prospection"}>
          <IconButton
            onClick={() => setAgentOpen((open) => !open)}
            sx={{
              position: "fixed",
              right: { xs: 16, md: 32 },
              bottom: { xs: 20, md: 28 },
              zIndex: 1301,
              width: 58,
              height: 58,
              color: "white",
              background: THEME.gradient,
              boxShadow: `0 12px 28px ${alpha(THEME.primary, 0.35)}`,
              "&:hover": {
                background: THEME.gradient,
                transform: "translateY(-2px)",
              },
            }}
          >
            {agentLoading ? <CircularProgress size={24} color="inherit" /> : <TriggerIcon />}
          </IconButton>
        </Tooltip>

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
                  sx={{ borderRadius: 1, bgcolor: alpha(THEME.primary, 0.08), color: THEME.primary }}
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
              <Table>
                <StyledTableHead>
                  <TableRow>
                    <TableCell sx={{ width: 190 }}>Prospect</TableCell>
                    <TableCell sx={{ width: 210 }}>Contact</TableCell>
                    <TableCell sx={{ width: 120 }}>Localisation</TableCell>

                    <TableCell sx={{ width: 140 }}>Société</TableCell>
                    {isAdminOrManager && <TableCell sx={{ width: 140 }}>Assigné à</TableCell>}
                    <TableCell sx={{ width: 100 }} align="center">
                      Évaluation
                    </TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      Statut
                    </TableCell>
                    <TableCell sx={{ width: 210 }}>Prochaine tache</TableCell>
                    <TableCell sx={{ width: 180 }}>Source</TableCell>
                    <TableCell sx={{ width: 100 }}>Création</TableCell>
                    <TableCell sx={{ width: 200 }} align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </StyledTableHead>
                <TableBody>
                  {prospectsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdminOrManager ? 11 : 10} align="center" sx={{ py: 5 }}>
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
                        currentUser={currentUser}
                        onView={handleViewDetails}
                        onEdit={handleEdit}
                        onArchive={handleArchive}
                        onRestore={handleRestore}
                        onDelete={handleDeleteClick}
                        onContextMenu={handleContextMenu}
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
          currentUser={currentUser}
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
