/* eslint-disable prettier/prettier */
// src/pages/modules/Historypage.js
// Tableau d'audit CRM professionnel — qui a fait quoi sur quoi et quand

import React, { useState, useCallback, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  Stack,
  Avatar,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Skeleton,
  Button,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Divider,
  alpha,
  Card,
  CardContent,
  Drawer,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Badge,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  KeyboardArrowDown as ChevronDown,
  KeyboardArrowRight as ChevronRight,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  HistoryOutlined as HistoryIcon,
  Close as CloseIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  PersonOutline as PersonOutlineIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useHistory } from "../../hooks/useNotifications";
import PaginationBar from "../../components/PaginationBar";
import MDBox from "components/MDBox";

// ==============================
// THEME (IDENTIQUE À PROSPECTS)
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
// STYLES (IDENTIQUES À PROSPECTS)
// ==============================
const StyledCard = styled(Card)(() => ({
  borderRadius: 16,
  boxShadow: `0 8px 16px ${alpha(THEME.primary, 0.1)}`,
  transition: "transform 0.2s, box-shadow 0.2s",
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  overflow: "hidden",
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
  "& .MuiTable-root": { minWidth: 1200, borderCollapse: "collapse", tableLayout: "fixed" },
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

const StyledTableRow = styled(TableRow)(({ open }) => ({
  "&:hover": { backgroundColor: alpha(THEME.primary, 0.02), cursor: "pointer" },
  "& td": { padding: "12px 8px", borderBottom: `1px solid ${alpha("#000", 0.05)}` },
  borderLeft: open ? `3px solid ${THEME.primary}` : "3px solid transparent",
  transition: "background 0.12s, border-color 0.12s",
}));

const GradientButton = styled(Button)(() => ({
  background: THEME.gradient,
  color: "white",
  borderRadius: 12,
  padding: "8px 20px",
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

// Animation for rows
const rowIn = keyframes`from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}`;

// ─── ACTION & ENTITY MAPS ────────────────────────────────────────
const ACTION = {
  create: {
    label: "Création",
    color: THEME.success,
    bg: alpha(THEME.success, 0.1),
    dot: THEME.success,
  },
  update: { label: "Modification", color: THEME.info, bg: alpha(THEME.info, 0.1), dot: THEME.info },
  delete: {
    label: "Suppression",
    color: THEME.error,
    bg: alpha(THEME.error, 0.1),
    dot: THEME.error,
  },
  assign: {
    label: "Assignation",
    color: THEME.warning,
    bg: alpha(THEME.warning, 0.1),
    dot: THEME.warning,
  },
  unassign: {
    label: "Désassignation",
    color: THEME.warning,
    bg: alpha(THEME.warning, 0.1),
    dot: THEME.warning,
  },
  status: { label: "Statut", color: "#6D28D9", bg: alpha("#6D28D9", 0.1), dot: "#8B5CF6" },
  stage: { label: "Étape", color: "#BE185D", bg: alpha("#BE185D", 0.1), dot: "#EC4899" },
  comment: { label: "Commentaire", color: THEME.info, bg: alpha(THEME.info, 0.1), dot: THEME.info },
  invite: {
    label: "Invitation",
    color: THEME.success,
    bg: alpha(THEME.success, 0.1),
    dot: THEME.success,
  },
};

const ENTITY = {
  prospect: { label: "Prospect", abbr: "PR" },
  contact: { label: "Contact", abbr: "CO" },
  opportunity: { label: "Opportunité", abbr: "OP" },
  task: { label: "Tâche", abbr: "TK" },
  activity: { label: "Activité", abbr: "AC" },
  user: { label: "Utilisateur", abbr: "US" },
  team: { label: "Équipe", abbr: "EQ" },
  company: { label: "Entreprise", abbr: "EN" },
};

const ENTITY_COLORS = [
  THEME.info,
  "#6D28D9",
  THEME.warning,
  "#BE185D",
  THEME.success,
  "#0891B2",
  "#BE123C",
  "#92400E",
];
const entityColor = (type) =>
  ENTITY_COLORS[Object.keys(ENTITY).indexOf(type) % ENTITY_COLORS.length] || "#4A5568";

// ─── UTILS ──────────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, "0");

const formatDate = (d) => {
  const dt = new Date(d);
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};

const formatTime = (d) => {
  const dt = new Date(d);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
};

const relativeTime = (d) => {
  const diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  return formatDate(d);
};

const roleLabel = (role) =>
  ({ ADMIN: "Admin", MANAGER: "Manager", COMMERCIAL: "Commercial" }[role] || role || "");

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// ─── BADGE ACTION ────────────────────────────────────────────────
function ActionBadge({ action }) {
  const cfg = ACTION[action] || {
    label: action,
    color: "#4A5568",
    bg: alpha("#4A5568", 0.1),
    dot: "#4A5568",
  };
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: cfg.bg,
        color: cfg.color,
        borderRadius: 1,
        fontWeight: 600,
        fontSize: "0.72rem",
        height: 24,
        border: `1px solid ${alpha(cfg.color, 0.2)}`,
      }}
    />
  );
}
ActionBadge.propTypes = { action: PropTypes.string.isRequired };

// ─── BADGE ENTITÉ ────────────────────────────────────────────────
function EntityBadge({ type }) {
  const cfg = ENTITY[type] || { label: type, abbr: "??" };
  const color = entityColor(type);
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: alpha(color, 0.1),
        color,
        borderRadius: 1,
        fontWeight: 600,
        fontSize: "0.72rem",
        height: 24,
        border: `1px solid ${alpha(color, 0.2)}`,
      }}
    />
  );
}
EntityBadge.propTypes = { type: PropTypes.string.isRequired };

// ─── AVATAR ACTEUR ───────────────────────────────────────────────
function ActorCell({ actor }) {
  if (!actor) {
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: alpha(THEME.primary, 0.08),
            color: THEME.primary,
            fontSize: "0.75rem",
          }}
        >
          SYS
        </Avatar>
        <Typography variant="body2" color="textSecondary">
          Système
        </Typography>
      </Stack>
    );
  }
  const roleColors = { ADMIN: THEME.primary, MANAGER: "#6D28D9", COMMERCIAL: THEME.info };
  const bgColor = alpha(roleColors[actor.role] || "#4A5568", 0.1);
  const txtColor = roleColors[actor.role] || "#4A5568";

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: bgColor,
          color: txtColor,
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        {initials(actor.username)}
      </Avatar>
      <Box>
        <Typography variant="body2" fontWeight={600}>
          {actor.username}
        </Typography>
        {actor.role && (
          <Typography variant="caption" color="textSecondary">
            {roleLabel(actor.role)}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
ActorCell.propTypes = { actor: PropTypes.object };

// ─── PANNEAU DÉTAIL ───────────────────────────────────────────────
function DetailPanel({ log }) {
  const hasChanges = log.new_value && Object.keys(log.new_value).length > 0;
  const actionCfg = ACTION[log.action] || {};

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: alpha(THEME.primary, 0.02),
        borderLeft: `4px solid ${actionCfg.dot || THEME.primary}`,
      }}
    >
      <Stack spacing={2}>
        {/* Description */}
        <Box>
          <Typography
            variant="caption"
            sx={{ color: THEME.primary, fontWeight: 600, textTransform: "uppercase" }}
          >
            Détail de l&apos;action
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
            {log.description || "Aucun détail disponible."}
          </Typography>
        </Box>

        {/* Champs modifiés */}
        {hasChanges && (
          <Box>
            <Typography
              variant="caption"
              sx={{ color: THEME.primary, fontWeight: 600, textTransform: "uppercase" }}
            >
              Champs modifiés
            </Typography>
            <Stack spacing={0.5} mt={1}>
              {Object.entries(log.new_value)
                .slice(0, 8)
                .map(([key, newVal]) => {
                  const oldVal = log.old_value?.[key];
                  const changed = oldVal !== undefined && String(oldVal) !== String(newVal);
                  return (
                    <Box
                      key={key}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        p: 1,
                        bgcolor: "white",
                        borderRadius: 1,
                        border: `1px solid ${alpha(THEME.primary, 0.1)}`,
                      }}
                    >
                      <Typography variant="caption" sx={{ minWidth: 120, fontWeight: 600 }}>
                        {key}
                      </Typography>
                      {changed ? (
                        <>
                          <Typography
                            variant="caption"
                            sx={{ color: THEME.error, textDecoration: "line-through" }}
                          >
                            {String(oldVal)}
                          </Typography>
                          <Typography variant="caption">→</Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: THEME.success, fontWeight: 600 }}
                          >
                            {String(newVal)}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" fontWeight={600}>
                          {String(newVal)}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
            </Stack>
          </Box>
        )}

        {/* Acteur */}
        <Box>
          <Typography
            variant="caption"
            sx={{ color: THEME.primary, fontWeight: 600, textTransform: "uppercase" }}
          >
            Réalisé par
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: alpha(THEME.primary, 0.1),
                color: THEME.primary,
              }}
            >
              {log.actor ? initials(log.actor.username) : "SYS"}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {log.actor ? log.actor.username : "Système"}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Le {formatDate(log.created_at)} à {formatTime(log.created_at)}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
DetailPanel.propTypes = { log: PropTypes.object.isRequired };

// ─── FILTRE DRAWER (COMME DANS PROSPECTS) ─────────────────────────
const FiltersDrawer = ({ open, onClose, filters, onApply, onReset }) => {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters, open]);

  const ACTION_OPTIONS = Object.entries(ACTION).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
  }));
  const ENTITY_OPTIONS = Object.entries(ENTITY).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
  }));

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
            <InputLabel>Type d&apos;action</InputLabel>
            <Select
              multiple
              value={local.action || []}
              label="Type d'action"
              onChange={(e) => setLocal({ ...local, action: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => {
                    const opt = ACTION_OPTIONS.find((o) => o.value === v);
                    return (
                      <Chip
                        key={v}
                        label={opt?.label || v}
                        size="small"
                        sx={{
                          borderRadius: 1,
                          bgcolor: alpha(THEME.primary, 0.08),
                          color: THEME.primaryDark,
                        }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {ACTION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth size="small">
            <InputLabel>Entité</InputLabel>
            <Select
              multiple
              value={local.entity || []}
              label="Entité"
              onChange={(e) => setLocal({ ...local, entity: e.target.value })}
              renderValue={(sel) => (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {sel.map((v) => {
                    const opt = ENTITY_OPTIONS.find((o) => o.value === v);
                    return (
                      <Chip
                        key={v}
                        label={opt?.label || v}
                        size="small"
                        sx={{
                          borderRadius: 1,
                          bgcolor: alpha(THEME.primary, 0.08),
                          color: THEME.primaryDark,
                        }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {ENTITY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

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
};

// ─── LIGNE TABLEAU ────────────────────────────────────────────────
function HistoryRow({ log, index, open, onToggle }) {
  return (
    <>
      <StyledTableRow
        open={open}
        onClick={onToggle}
        sx={{ animation: `${rowIn} 0.18s ease both`, animationDelay: `${index * 0.02}s` }}
      >
        {/* Expand */}
        <TableCell sx={{ width: 32, pl: 1, pr: 0 }}>
          {open ? (
            <ChevronDown sx={{ fontSize: 18, color: THEME.primary }} />
          ) : (
            <ChevronRight sx={{ fontSize: 18, color: "#4A5568" }} />
          )}
        </TableCell>

        {/* Date */}
        <TableCell sx={{ width: 110 }}>
          <Typography variant="body2" fontWeight={600}>
            {formatDate(log.created_at)}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {formatTime(log.created_at)}
          </Typography>
        </TableCell>

        {/* Réalisé par */}
        <TableCell sx={{ width: 180 }}>
          <ActorCell actor={log.actor} />
        </TableCell>

        {/* Action */}
        <TableCell sx={{ width: 130 }}>
          <ActionBadge action={log.action} />
        </TableCell>

        {/* Entité */}
        <TableCell sx={{ width: 140 }}>
          <EntityBadge type={log.entity_type} />
        </TableCell>

        {/* Élément */}
        <TableCell sx={{ maxWidth: 200 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {log.entity_name || "—"}
          </Typography>
        </TableCell>

        {/* Description courte */}
        <TableCell>
          <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 320 }}>
            {log.description || "—"}
          </Typography>
        </TableCell>

        {/* Nb champs */}
        <TableCell sx={{ width: 80, textAlign: "center" }}>
          {log.new_value && Object.keys(log.new_value).length > 0 ? (
            <Chip
              label={Object.keys(log.new_value).length}
              size="small"
              sx={{
                bgcolor: alpha(THEME.primary, 0.08),
                color: THEME.primaryDark,
                fontWeight: 600,
                borderRadius: 1,
              }}
            />
          ) : (
            <Typography variant="caption" color="textSecondary">
              —
            </Typography>
          )}
        </TableCell>

        {/* Relatif */}
        <TableCell sx={{ width: 80 }}>
          <Tooltip title={`${formatDate(log.created_at)} ${formatTime(log.created_at)}`}>
            <Typography variant="caption" color="textSecondary">
              {relativeTime(log.created_at)}
            </Typography>
          </Tooltip>
        </TableCell>
      </StyledTableRow>

      {/* Détail expandé */}
      <TableRow>
        <TableCell colSpan={9} sx={{ padding: 0, borderBottom: "none" }}>
          <Collapse in={open} timeout={220} unmountOnExit>
            <DetailPanel log={log} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
HistoryRow.propTypes = {
  log: PropTypes.object.isRequired,
  index: PropTypes.number,
  open: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};

// ─── PAGE PRINCIPALE ─────────────────────────────────────────────
export default function HistoryPage() {
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});
  const [loadingExport, setLoadingExport] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const { logs, total, pages, loading } = useHistory(
    entityFilter,
    actionFilter,
    search,
    page,
    refreshKey
  );

  const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const hasFilters =
    entityFilter ||
    actionFilter ||
    search ||
    filters.action?.length ||
    filters.entity?.length ||
    filters.date_from ||
    filters.date_to;

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleClearFilters = useCallback(() => {
    setEntityFilter("");
    setActionFilter("");
    setSearch("");
    setSearchInput("");
    setFilters({});
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const toggleRow = useCallback((id) => setExpandedId((p) => (p === id ? null : id)), []);

  const handleApplyFilters = (newFilters) => {
    setActionFilter(newFilters.action?.join(",") || "");
    setEntityFilter(newFilters.entity?.join(",") || "");
    setFilters(newFilters);
    setPage(1);
  };

  const handleResetFilters = () => {
    setActionFilter("");
    setEntityFilter("");
    setFilters({});
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (actionFilter) count += actionFilter.split(",").length;
    if (entityFilter) count += entityFilter.split(",").length;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    if (search) count++;
    return count;
  }, [actionFilter, entityFilter, filters.date_from, filters.date_to, search]);

  // Stats pour les cartes
  const stats = useMemo(() => {
    const out = {
      total,
      create: 0,
      update: 0,
      delete: 0,
      assign: 0,
    };
    logs.forEach((l) => {
      if (out[l.action] !== undefined) out[l.action]++;
    });
    return out;
  }, [logs, total]);

  const showSnackbar = (msg, sev = "success") =>
    setSnackbar({ open: true, message: msg, severity: sev });

  const exportToCSV = () => {
    setLoadingExport(true);
    try {
      const headers = [
        "Date",
        "Heure",
        "Utilisateur",
        "Action",
        "Entité",
        "Élément",
        "Description",
      ];
      const rows = logs.map((log) => [
        formatDate(log.created_at),
        formatTime(log.created_at),
        log.actor?.username || "Système",
        ACTION[log.action]?.label || log.action,
        ENTITY[log.entity_type]?.label || log.entity_type,
        log.entity_name || "",
        log.description || "",
      ]);
      const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `audit_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSnackbar("Export CSV effectué");
    } catch {
      showSnackbar("Erreur export CSV", "error");
    } finally {
      setLoadingExport(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3} px={3}>
        <Backdrop
          sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 1, backdropFilter: "blur(4px)" }}
          open={loading || loadingExport}
        >
          <Box textAlign="center">
            <CircularProgress sx={{ color: THEME.primary }} />
            <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
              {loadingExport ? "Export en cours..." : "Chargement..."}
            </Typography>
          </Box>
        </Backdrop>

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
              Journal d&apos;audit
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {user.role === "ADMIN"
                ? "Toutes les actions de l'entreprise"
                : user.role === "MANAGER"
                ? "Actions de votre équipe"
                : "Vos actions"}{" "}
              · {total} entrée{total !== 1 ? "s" : ""}
            </Typography>
          </Box>
          <GradientButton
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
            disabled={loadingExport}
          >
            Exporter CSV
          </GradientButton>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCardItem
              title="Total actions"
              value={stats.total}
              icon={<HistoryIcon />}
              color={THEME.primary}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCardItem
              title="Créations"
              value={stats.create}
              icon={<AddIcon />}
              color={THEME.success}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCardItem
              title="Modifications"
              value={stats.update}
              icon={<EditIcon />}
              color={THEME.info}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCardItem
              title="Suppressions"
              value={stats.delete}
              icon={<DeleteIcon />}
              color={THEME.error}
            />
          </Grid>
        </Grid>

        {/* Barre de recherche + filtres actifs */}
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Rechercher une action..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: THEME.primary }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchInput("")}>
                          <ClearIcon sx={{ fontSize: 18, color: THEME.primary }} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
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
                  <Tooltip title="Rafraîchir">
                    <IconButton
                      size="small"
                      onClick={handleRefresh}
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
                {actionFilter &&
                  actionFilter.split(",").map((v) => (
                    <Chip
                      key={`a-${v}`}
                      label={`Action: ${ACTION[v]?.label || v}`}
                      size="small"
                      onDelete={() => {
                        const newActions = actionFilter.split(",").filter((x) => x !== v);
                        setActionFilter(newActions.join(","));
                      }}
                      sx={{
                        borderRadius: 1,
                        bgcolor: alpha(THEME.info, 0.1),
                        color: THEME.info,
                        border: `1px solid ${alpha(THEME.info, 0.3)}`,
                        fontSize: "0.72rem",
                      }}
                    />
                  ))}
                {entityFilter &&
                  entityFilter.split(",").map((v) => (
                    <Chip
                      key={`e-${v}`}
                      label={`Entité: ${ENTITY[v]?.label || v}`}
                      size="small"
                      onDelete={() => {
                        const newEntities = entityFilter.split(",").filter((x) => x !== v);
                        setEntityFilter(newEntities.join(","));
                      }}
                      sx={{
                        borderRadius: 1,
                        bgcolor: alpha(THEME.success, 0.1),
                        color: THEME.success,
                        border: `1px solid ${alpha(THEME.success, 0.3)}`,
                        fontSize: "0.72rem",
                      }}
                    />
                  ))}
                {filters.date_from && (
                  <Chip
                    label={`Du: ${filters.date_from}`}
                    size="small"
                    onDelete={() => setFilters({ ...filters, date_from: "" })}
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.warning, 0.1),
                      color: THEME.warning,
                      fontSize: "0.72rem",
                    }}
                  />
                )}
                {filters.date_to && (
                  <Chip
                    label={`Au: ${filters.date_to}`}
                    size="small"
                    onDelete={() => setFilters({ ...filters, date_to: "" })}
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.warning, 0.1),
                      color: THEME.warning,
                      fontSize: "0.72rem",
                    }}
                  />
                )}
                <Chip
                  label="Tout effacer"
                  size="small"
                  onClick={handleClearFilters}
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

        {/* Tableau */}
        <StyledCard>
          <StyledTableContainer>
            <Table size="small">
              <StyledTableHead>
                <TableRow>
                  <TableCell sx={{ width: 32 }} />
                  <TableCell>Date</TableCell>
                  <TableCell sx={{ color: `${THEME.primary} !important` }}>Réalisé par</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Entité</TableCell>
                  <TableCell>Nom de l&apos;élément</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell sx={{ textAlign: "center" }}>Champs</TableCell>
                  <TableCell>Il y a</TableCell>
                </TableRow>
              </StyledTableHead>

              <TableBody>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      {[32, 100, 160, 110, 120, 180, 260, 60, 70].map((w, j) => (
                        <TableCell key={j} sx={{ py: 1.5, px: 2 }}>
                          <Skeleton
                            variant="rounded"
                            height={20}
                            width={w}
                            sx={{ borderRadius: 1, opacity: 0.6 - i * 0.04 }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                      <Box textAlign="center">
                        <HistoryIcon
                          sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }}
                        />
                        <Typography variant="h6" color="textSecondary" gutterBottom>
                          Aucune entrée d&apos;audit trouvée
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {hasFilters
                            ? "Aucun résultat pour ces critères de recherche"
                            : "Les actions de votre équipe apparaîtront ici automatiquement"}
                        </Typography>
                        {hasFilters && (
                          <GradientButton size="small" onClick={handleClearFilters} sx={{ mt: 2 }}>
                            Réinitialiser les filtres
                          </GradientButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, idx) => (
                    <HistoryRow
                      key={log.id}
                      log={log}
                      index={idx}
                      open={expandedId === log.id}
                      onToggle={() => toggleRow(log.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </StyledTableContainer>

          {/* Pagination - Centrée comme dans Prospects */}
          <Box sx={{ borderTop: `1px solid ${alpha(THEME.primary, 0.1)}`, px: 2, py: 1.5 }}>
            <Box display="flex" justifyContent="center">
              <PaginationBar
                page={page}
                pages={pages}
                total={total}
                pageSize={25}
                onPageChange={setPage}
                loading={loading}
              />
            </Box>
          </Box>
        </StyledCard>

        {/* Filters Drawer */}
        <FiltersDrawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      </MDBox>
    </DashboardLayout>
  );
}
