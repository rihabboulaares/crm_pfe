/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminProspects.js
import React, { useEffect, useState, useMemo } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import {
  Box,
  Card,
  Typography,
  Stack,
  Avatar,
  Chip,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Pagination,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Collapse,
  Alert,
  Drawer,
  Divider,
  Button,
  Backdrop,
  Paper,
  Badge,
  alpha,
  styled,
} from "@mui/material";

import {
  PersonAdd,
  Search,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Star as StarIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";

import SuperAdminLayout from "./SuperAdminLayout";

// ==============================
// THÈME PERSONNALISÉ
// ==============================
const THEME = {
  primary: "#d32f2f",
  primaryLight: "#ff6659",
  primaryDark: "#9a0007",
  secondary: "#ffebee",
  gradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  success: "#4caf50",
  warning: "#ff9800",
  info: "#2196f3",
  error: "#f44336",
  purple: "#7c3aed",
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  n100: "#f3f4f6",
  n200: "#e5e7eb",
  n500: "#6b7280",
  n800: "#1f2937",
};

// ==============================
// STYLES PERSONNALISÉS
// ==============================
const StyledCard = styled(Card)(({ theme }) => ({
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

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 16,
  boxShadow: `0 8px 16px ${alpha("#000", 0.05)}`,
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  overflowX: "auto",
  overflowY: "hidden",
  width: "100%",
  maxWidth: "100%",
  "& .MuiTable-root": {
    minWidth: 1200,
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
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
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:hover": {
    backgroundColor: alpha(THEME.primary, 0.02),
    cursor: "pointer",
  },
  "& td": {
    padding: "12px 8px",
    borderBottom: `1px solid ${alpha("#000", 0.05)}`,
  },
}));

const GradientButton = styled(Button)(({ theme }) => ({
  background: THEME.gradient,
  color: "white",
  borderRadius: 12,
  padding: "10px 24px",
  fontWeight: 600,
  textTransform: "none",
  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
  "&:hover": {
    background: THEME.gradient,
    boxShadow: `0 6px 16px ${alpha(THEME.primary, 0.4)}`,
  },
  "&:disabled": {
    opacity: 0.6,
  },
}));

const StatsCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  padding: 8,
  background: "white",
  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.08)}`,
  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
  transition: "all 0.3s",
  cursor: "pointer",
  "&:hover": {
    borderColor: THEME.primary,
    boxShadow: `0 8px 24px ${alpha(THEME.primary, 0.15)}`,
  },
}));

const StyledChip = styled(Chip)(({ status, evaluation }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(status === "new" && {
    background: alpha(THEME.info, 0.1),
    color: THEME.info,
    border: `1px solid ${THEME.info}`,
  }),
  ...(status === "contacted" && {
    background: alpha(THEME.warning, 0.1),
    color: THEME.warning,
    border: `1px solid ${THEME.warning}`,
  }),
  ...(status === "qualified" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
  ...(status === "lost" && {
    background: alpha(THEME.error, 0.1),
    color: THEME.error,
    border: `1px solid ${THEME.error}`,
  }),
  ...(status === "won" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
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
// CONFIGURATION API
// ==============================
const apiGet = (url) =>
  axios.get(`http://127.0.0.1:8000${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

// ==============================
// CONSTANTES
// ==============================
const STATUS_OPTIONS = ["", "new", "contacted", "qualified", "lost", "won"];
const STATUS_LABELS = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  lost: "Perdu",
  won: "Gagné",
};

const EVALUATION_OPTIONS = ["", "cold", "warm", "hot"];
const EVALUATION_LABELS = {
  cold: "Froid",
  warm: "Tiède",
  hot: "Chaud",
};

const ORIGIN_OPTIONS = ["", "website", "facebook", "linkedin", "referral"];
const ORIGIN_LABELS = {
  website: "Site web",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  referral: "Recommandation",
};

// ==============================
// COMPOSANT STATS CARD
// ==============================
const StatsCardItem = ({ title, value, icon, color, children, onClick }) => (
  <StatsCard onClick={onClick}>
    <Box p={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="caption" color="textSecondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ color, fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        <Avatar
          sx={{
            bgcolor: alpha(color, 0.1),
            color,
            width: 48,
            height: 48,
          }}
        >
          {icon}
        </Avatar>
      </Box>
      {children && (
        <Box mt={2} display="flex" gap={1}>
          {children}
        </Box>
      )}
    </Box>
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
// COMPOSANT PROSPECT DETAILS DRAWER
// ==============================
const ProspectDetailsDrawer = ({ open, onClose, prospect }) => {
  if (!prospect) return null;

  const getStatusIcon = (status) => {
    const icons = {
      new: <ScheduleIcon sx={{ fontSize: 18 }} />,
      contacted: <PersonIcon sx={{ fontSize: 18 }} />,
      qualified: <CheckCircleIcon sx={{ fontSize: 18 }} />,
      lost: <CancelIcon sx={{ fontSize: 18 }} />,
      won: <StarIcon sx={{ fontSize: 18 }} />,
    };
    return icons[status] || null;
  };

  const getEvaluationIcon = (evaluation) => {
    const icons = {
      hot: <TrendingUpIcon sx={{ fontSize: 18 }} />,
      warm: <ScheduleIcon sx={{ fontSize: 18 }} />,
      cold: <AssignmentIcon sx={{ fontSize: 18 }} />,
    };
    return icons[evaluation] || null;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 450 },
          background: "#ffffff",
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
          boxShadow: `-8px 0 24px ${alpha(THEME.primary, 0.15)}`,
        },
      }}
    >
      <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
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
            Détails du prospect
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{
              bgcolor: alpha(THEME.primary, 0.1),
              "&:hover": { bgcolor: alpha(THEME.primary, 0.2) },
            }}
          >
            <CloseIcon sx={{ color: THEME.primary }} />
          </IconButton>
        </Box>

        <Paper
          elevation={0}
          sx={{
            background: alpha(THEME.primary, 0.02),
            borderRadius: 4,
            p: 3,
            mb: 3,
            border: `1px solid ${alpha(THEME.primary, 0.1)}`,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              sx={{
                width: 70,
                height: 70,
                background: THEME.gradient,
                fontSize: "1.8rem",
                fontWeight: 600,
                boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
              }}
            >
              {prospect.first_name?.[0]?.toUpperCase()}
              {prospect.last_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {prospect.first_name} {prospect.last_name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {prospect.title || "Sans titre"}
              </Typography>
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" gap={1}>
                {prospect.status && (
                  <StyledChip
                    label={STATUS_LABELS[prospect.status]}
                    status={prospect.status}
                    size="small"
                    icon={getStatusIcon(prospect.status)}
                  />
                )}
                {prospect.evaluation && (
                  <StyledChip
                    label={EVALUATION_LABELS[prospect.evaluation]}
                    evaluation={prospect.evaluation}
                    size="small"
                    icon={getEvaluationIcon(prospect.evaluation)}
                  />
                )}
              </Stack>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Coordonnées
              </Typography>
              <Stack spacing={2}>
                {prospect.email && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <EmailIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">{prospect.email}</Typography>
                  </Box>
                )}
                {prospect.phone && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhoneIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">{prospect.phone}</Typography>
                  </Box>
                )}
                {prospect.prospect_company_name && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">{prospect.prospect_company_name}</Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Informations complémentaires
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Entreprise CRM
                  </Typography>
                  <Chip
                    size="small"
                    label={prospect.company_name || "—"}
                    sx={{
                      bgcolor: alpha(THEME.purple, 0.1),
                      color: THEME.purple,
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Origine
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {ORIGIN_LABELS[prospect.origin] || prospect.origin || "—"}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Assigné à
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {prospect.assigned_to_username || "Non assigné"}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Créé le
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {prospect.created_at
                      ? new Date(prospect.created_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        </Grid>

        <Box mt={3} display="flex" justifyContent="flex-end">
          <GradientButton onClick={onClose} sx={{ px: 4 }}>
            Fermer
          </GradientButton>
        </Box>
      </Box>
    </Drawer>
  );
};

ProspectDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  prospect: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    title: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    status: PropTypes.string,
    evaluation: PropTypes.string,
    origin: PropTypes.string,
    prospect_company_name: PropTypes.string,
    company_name: PropTypes.string,
    assigned_to_username: PropTypes.string,
    created_at: PropTypes.string,
  }),
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function SuperAdminProspects() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [evaluationFilter, setEvaluationFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedProspect, setSelectedProspect] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=15`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) params += `&status=${statusFilter}`;
      if (evaluationFilter) params += `&evaluation=${evaluationFilter}`;
      if (originFilter) params += `&origin=${originFilter}`;
      const res = await apiGet(`/api/superadmin/prospects/${params}`);
      const data = res.data;
      setProspects(data.results || data);
      const total = data.count || (data.results || data).length;
      setTotalPages(Math.ceil(total / 15));
    } catch (e) {
      console.error("Erreur chargement prospects:", e);
      showNotification("Erreur lors du chargement des prospects", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, evaluationFilter, originFilter]);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleViewDetails = (prospect) => {
    setSelectedProspect(prospect);
    setDetailsDrawerOpen(true);
  };

  // Statistiques
  const stats = useMemo(
    () => ({
      total: prospects.length,
      new: prospects.filter((p) => p.status === "new").length,
      contacted: prospects.filter((p) => p.status === "contacted").length,
      qualified: prospects.filter((p) => p.status === "qualified").length,
      won: prospects.filter((p) => p.status === "won").length,
      lost: prospects.filter((p) => p.status === "lost").length,
      hot: prospects.filter((p) => p.evaluation === "hot").length,
      warm: prospects.filter((p) => p.evaluation === "warm").length,
      cold: prospects.filter((p) => p.evaluation === "cold").length,
      assigned: prospects.filter((p) => p.assigned_to_username).length,
      unassigned: prospects.filter((p) => !p.assigned_to_username).length,
    }),
    [prospects]
  );

  const activeFiltersCount =
    (statusFilter ? 1 : 0) + (evaluationFilter ? 1 : 0) + (originFilter ? 1 : 0);

  return (
    <SuperAdminLayout>
      {/* Backdrop de chargement */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(4px)",
        }}
        open={loading && prospects.length === 0}
      >
        <Box textAlign="center">
          <CircularProgress sx={{ color: THEME.primary }} />
          <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
            Chargement des prospects...
          </Typography>
        </Box>
      </Backdrop>

      {/* Notification */}
      <Collapse in={!!message.text}>
        <Alert
          severity={message.type}
          sx={{
            mb: 2,
            borderRadius: 3,
            boxShadow: `0 4px 12px ${alpha("#000", 0.1)}`,
            border: `1px solid ${
              message.type === "success" ? alpha(THEME.success, 0.3) : alpha(THEME.error, 0.3)
            }`,
          }}
          action={
            <IconButton size="small" onClick={() => setMessage({ text: "", type: "success" })}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {message.text}
        </Alert>
      </Collapse>

      {/* Header */}
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
            Prospects
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {prospects.length} prospect(s) • Dernière mise à jour{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(THEME.blue, 0.1), width: 48, height: 48 }}>
          <PersonAdd sx={{ color: THEME.blue }} />
        </Avatar>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Total prospects"
            value={stats.total}
            icon={<PersonAdd />}
            color={THEME.primary}
          >
            <Chip
              size="small"
              label={`${stats.new} Nouveaux`}
              sx={{
                bgcolor: alpha(THEME.info, 0.1),
                color: THEME.info,
                borderRadius: 1,
                border: `1px solid ${THEME.info}`,
              }}
            />
            <Chip
              size="small"
              label={`${stats.qualified} Qualifiés`}
              sx={{
                bgcolor: alpha(THEME.success, 0.1),
                color: THEME.success,
                borderRadius: 1,
                border: `1px solid ${THEME.success}`,
              }}
            />
          </StatsCardItem>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Évaluation"
            value={stats.hot}
            icon={<TrendingUpIcon />}
            color={THEME.error}
          >
            <Chip
              size="small"
              label={`${stats.warm} Tièdes`}
              sx={{
                bgcolor: alpha(THEME.warning, 0.1),
                color: THEME.warning,
                borderRadius: 1,
                border: `1px solid ${THEME.warning}`,
              }}
            />
            <Chip
              size="small"
              label={`${stats.cold} Froids`}
              sx={{
                bgcolor: alpha(THEME.info, 0.1),
                color: THEME.info,
                borderRadius: 1,
                border: `1px solid ${THEME.info}`,
              }}
            />
          </StatsCardItem>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Conversion"
            value={stats.total ? `${Math.round((stats.won / stats.total) * 100)}%` : "0%"}
            icon={<StarIcon />}
            color={THEME.success}
          >
            <Chip
              size="small"
              label={`${stats.won} Gagnés`}
              sx={{
                bgcolor: alpha(THEME.success, 0.1),
                color: THEME.success,
                borderRadius: 1,
                border: `1px solid ${THEME.success}`,
              }}
            />
            <Chip
              size="small"
              label={`${stats.lost} Perdus`}
              sx={{
                bgcolor: alpha(THEME.error, 0.1),
                color: THEME.error,
                borderRadius: 1,
                border: `1px solid ${THEME.error}`,
              }}
            />
          </StatsCardItem>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Assignation"
            value={stats.assigned}
            icon={<PersonIcon />}
            color={THEME.purple}
          >
            <Chip
              size="small"
              label={`${stats.unassigned} Non assignés`}
              sx={{
                bgcolor: alpha(THEME.warning, 0.1),
                color: THEME.warning,
                borderRadius: 1,
                border: `1px solid ${THEME.warning}`,
              }}
            />
          </StatsCardItem>
        </Grid>
      </Grid>

      {/* Filtres */}
      <StyledCard sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Rechercher par nom, email, entreprise..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    bgcolor: alpha(THEME.primary, 0.02),
                    "&:hover": {
                      bgcolor: alpha(THEME.primary, 0.04),
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: THEME.primary }} />
                    </InputAdornment>
                  ),
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <CloseIcon sx={{ fontSize: 18, color: THEME.primary }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={8}>
              <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    displayEmpty
                    sx={{
                      borderRadius: 3,
                      height: 36,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: alpha(THEME.primary, 0.3),
                      },
                    }}
                  >
                    <MenuItem value="">Tous statuts</MenuItem>
                    {STATUS_OPTIONS.filter(Boolean).map((s) => (
                      <MenuItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <Select
                    value={evaluationFilter}
                    onChange={(e) => {
                      setEvaluationFilter(e.target.value);
                      setPage(1);
                    }}
                    displayEmpty
                    sx={{
                      borderRadius: 3,
                      height: 36,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: alpha(THEME.primary, 0.3),
                      },
                    }}
                  >
                    <MenuItem value="">Toutes évaluations</MenuItem>
                    {EVALUATION_OPTIONS.filter(Boolean).map((e) => (
                      <MenuItem key={e} value={e}>
                        {EVALUATION_LABELS[e]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <Select
                    value={originFilter}
                    onChange={(e) => {
                      setOriginFilter(e.target.value);
                      setPage(1);
                    }}
                    displayEmpty
                    sx={{
                      borderRadius: 3,
                      height: 36,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: alpha(THEME.primary, 0.3),
                      },
                    }}
                  >
                    <MenuItem value="">Toutes origines</MenuItem>
                    {ORIGIN_OPTIONS.filter(Boolean).map((o) => (
                      <MenuItem key={o} value={o}>
                        {ORIGIN_LABELS[o]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Badge
                  color="error"
                  badgeContent={activeFiltersCount}
                  invisible={activeFiltersCount === 0}
                >
                  <Button
                    variant="outlined"
                    startIcon={<FilterIcon />}
                    onClick={() => setShowFilters(true)}
                    size="small"
                    sx={{
                      borderRadius: 3,
                      borderColor: alpha(THEME.primary, 0.3),
                      color: THEME.primary,
                    }}
                  >
                    Filtres
                  </Button>
                </Badge>

                <Tooltip title="Rafraîchir">
                  <IconButton
                    size="small"
                    onClick={fetchProspects}
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
        </Box>
      </StyledCard>

      {/* Table */}
      <StyledCard>
        <StyledTableContainer>
          <Table>
            <StyledTableHead>
              <TableRow>
                <TableCell sx={{ width: 200 }}>Prospect</TableCell>
                <TableCell sx={{ width: 200 }}>Email</TableCell>
                <TableCell sx={{ width: 150 }}>Société prospect</TableCell>
                <TableCell sx={{ width: 150 }}>Entreprise CRM</TableCell>
                <TableCell sx={{ width: 120 }}>Assigné à</TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Évaluation
                </TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Statut
                </TableCell>
                <TableCell sx={{ width: 80 }} align="center">
                  Action
                </TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <CircularProgress sx={{ color: THEME.primary }} />
                  </TableCell>
                </TableRow>
              ) : prospects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <PersonAdd sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucun prospect trouvé
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                prospects.map((p) => (
                  <StyledTableRow key={p.id} hover onDoubleClick={() => handleViewDetails(p)}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: alpha(THEME.blue, 0.1),
                            color: THEME.blue,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {p.first_name?.[0]?.toUpperCase()}
                          {p.last_name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.n800 }}>
                            {p.first_name} {p.last_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: THEME.n500 }}>
                            {p.title || "—"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {p.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n800 }}>
                        {p.prospect_company_name || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.company_name ? (
                        <Chip
                          size="small"
                          label={p.company_name}
                          sx={{
                            bgcolor: alpha(THEME.purple, 0.1),
                            color: THEME.purple,
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: THEME.n500 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {p.assigned_to_username || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {p.evaluation ? (
                        <StyledChip
                          size="small"
                          label={EVALUATION_LABELS[p.evaluation]}
                          evaluation={p.evaluation}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: THEME.n500 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <StyledChip
                        size="small"
                        label={STATUS_LABELS[p.status] || p.status}
                        status={p.status}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir détails">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(p)}
                          sx={{
                            color: "#0288d1",
                            bgcolor: alpha("#0288d1", 0.1),
                            width: 32,
                            height: 32,
                            "&:hover": {
                              bgcolor: alpha("#0288d1", 0.2),
                            },
                          }}
                        >
                          <VisibilityIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </StyledTableRow>
                ))
              )}
            </TableBody>
          </Table>
        </StyledTableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
            <Typography variant="caption" color="textSecondary">
              {prospects.length} prospect(s) sur cette page
            </Typography>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
              sx={{
                "& .MuiPaginationItem-root": {
                  color: THEME.primary,
                  "&.Mui-selected": {
                    bgcolor: THEME.primary,
                    color: "white",
                  },
                },
              }}
              shape="rounded"
            />
          </Box>
        )}
      </StyledCard>

      {/* Drawer de filtres */}
      <Drawer
        anchor="right"
        open={showFilters}
        onClose={() => setShowFilters(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 350 },
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
          <IconButton
            onClick={() => setShowFilters(false)}
            sx={{
              bgcolor: alpha(THEME.primary, 0.1),
              "&:hover": { bgcolor: alpha(THEME.primary, 0.2) },
            }}
          >
            <CloseIcon sx={{ color: THEME.primary }} />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            label="Statut"
          >
            <MenuItem value="">Tous</MenuItem>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Évaluation</InputLabel>
          <Select
            value={evaluationFilter}
            onChange={(e) => {
              setEvaluationFilter(e.target.value);
              setPage(1);
            }}
            label="Évaluation"
          >
            <MenuItem value="">Toutes</MenuItem>
            {EVALUATION_OPTIONS.filter(Boolean).map((e) => (
              <MenuItem key={e} value={e}>
                {EVALUATION_LABELS[e]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Origine</InputLabel>
          <Select
            value={originFilter}
            onChange={(e) => {
              setOriginFilter(e.target.value);
              setPage(1);
            }}
            label="Origine"
          >
            <MenuItem value="">Toutes</MenuItem>
            {ORIGIN_OPTIONS.filter(Boolean).map((o) => (
              <MenuItem key={o} value={o}>
                {ORIGIN_LABELS[o]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => {
              setStatusFilter("");
              setEvaluationFilter("");
              setOriginFilter("");
              setShowFilters(false);
            }}
            variant="outlined"
            sx={{
              borderRadius: 3,
              borderColor: alpha(THEME.primary, 0.3),
              color: THEME.primary,
            }}
          >
            Réinitialiser
          </Button>
          <Button
            onClick={() => setShowFilters(false)}
            variant="contained"
            sx={{
              background: THEME.gradient,
              borderRadius: 3,
              px: 3,
            }}
          >
            Appliquer
          </Button>
        </Box>
      </Drawer>

      {/* Drawer de détails */}
      <ProspectDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        prospect={selectedProspect}
      />
    </SuperAdminLayout>
  );
}
