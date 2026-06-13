/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminOpportunities.js
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
  AttachMoney,
  Search,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Euro as EuroIcon,
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

const StyledChip = styled(Chip)(({ stage }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(stage === "new" && {
    background: alpha(THEME.info, 0.1),
    color: THEME.info,
    border: `1px solid ${THEME.info}`,
  }),
  ...(stage === "qualified" && {
    background: alpha(THEME.blue, 0.1),
    color: THEME.blue,
    border: `1px solid ${THEME.blue}`,
  }),
  ...(stage === "proposal" && {
    background: alpha(THEME.warning, 0.1),
    color: THEME.warning,
    border: `1px solid ${THEME.warning}`,
  }),
  ...(stage === "negotiation" && {
    background: alpha(THEME.purple, 0.1),
    color: THEME.purple,
    border: `1px solid ${THEME.purple}`,
  }),
  ...(stage === "won" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
  ...(stage === "lost" && {
    background: alpha(THEME.error, 0.1),
    color: THEME.error,
    border: `1px solid ${THEME.error}`,
  }),
}));

// ==============================
// CONFIGURATION API
// ==============================
const apiGet = (url) =>
  axios.get(`/${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

// ==============================
// CONSTANTES
// ==============================
const STAGES = ["", "new", "qualified", "proposal", "negotiation", "won", "lost"];
const STAGE_LABELS = {
  new: "Nouveau",
  qualified: "Qualifié",
  proposal: "Proposition",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
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
// COMPOSANT OPPORTUNITY DETAILS DRAWER
// ==============================
const OpportunityDetailsDrawer = ({ open, onClose, opportunity }) => {
  if (!opportunity) return null;

  const getStageIcon = (stage) => {
    const icons = {
      new: <ScheduleIcon sx={{ fontSize: 18 }} />,
      qualified: <CheckCircleIcon sx={{ fontSize: 18 }} />,
      proposal: <AttachMoney sx={{ fontSize: 18 }} />,
      negotiation: <TrendingUpIcon sx={{ fontSize: 18 }} />,
      won: <CheckCircleIcon sx={{ fontSize: 18 }} />,
      lost: <CancelIcon sx={{ fontSize: 18 }} />,
    };
    return icons[stage] || null;
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
            Détails de l&apos;opportunité
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
              {opportunity.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {opportunity.name}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <StyledChip
                  label={STAGE_LABELS[opportunity.stage] || opportunity.stage}
                  stage={opportunity.stage}
                  size="small"
                  icon={getStageIcon(opportunity.stage)}
                />
              </Stack>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Informations financières
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EuroIcon sx={{ fontSize: 20, color: THEME.success }} />
                  <Typography variant="body2">
                    Montant :{" "}
                    <strong>{parseFloat(opportunity.amount).toLocaleString("fr-FR")} TND</strong>
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Prospect / Contact
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">{opportunity.prospect_name || "—"}</Typography>
                </Box>
                {opportunity.prospect_email && (
                  <Typography variant="caption" sx={{ color: THEME.n500, ml: 4 }}>
                    {opportunity.prospect_email}
                  </Typography>
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
                    label={opportunity.company_name || "—"}
                    sx={{
                      bgcolor: alpha(THEME.purple, 0.1),
                      color: THEME.purple,
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Assigné à
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {opportunity.assigned_to_username || "Non assigné"}
                  </Typography>
                </Box>
                {opportunity.expected_close_date && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Clôture prévue
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {new Date(opportunity.expected_close_date).toLocaleDateString("fr-FR")}
                    </Typography>
                  </Box>
                )}
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Créé le
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {opportunity.created_at
                      ? new Date(opportunity.created_at).toLocaleDateString("fr-FR")
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

OpportunityDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  opportunity: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    stage: PropTypes.string,
    prospect_name: PropTypes.string,
    prospect_email: PropTypes.string,
    company_name: PropTypes.string,
    assigned_to_username: PropTypes.string,
    expected_close_date: PropTypes.string,
    created_at: PropTypes.string,
  }),
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function SuperAdminOpportunities() {
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [backendStats, setBackendStats] = useState(null);

  const fetchOpps = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=15`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (stageFilter) params += `&stage=${stageFilter}`;
      const res = await apiGet(`/api/superadmin/opportunities/${params}`);
      const data = res.data;
      const list = data.results || data;
      setOpps(list);
      const total = data.count || list.length;
      setTotalPages(Math.ceil(total / 15));
    } catch (e) {
      console.error("Erreur chargement opportunités:", e);
      showNotification("Erreur lors du chargement des opportunités", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, stageFilter]);

  useEffect(() => {
    apiGet("/api/superadmin/opportunities/stats/")
      .then((res) => setBackendStats(res.data))
      .catch((e) => console.error("Erreur stats opportunités:", e));
  }, []);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleViewDetails = (opp) => {
    setSelectedOpportunity(opp);
    setDetailsDrawerOpen(true);
  };

  // Statistiques
  const stats = useMemo(() => {
    const total = opps.reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
    const won = opps
      .filter((o) => o.stage === "won")
      .reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
    const lost = opps
      .filter((o) => o.stage === "lost")
      .reduce((sum, o) => sum + parseFloat(o.amount || 0), 0);
    const qualified = opps.filter((o) => o.stage === "qualified").length;
    const negotiation = opps.filter((o) => o.stage === "negotiation").length;

    return {
      total: opps.length,
      totalAmount: total,
      wonAmount: won,
      lostAmount: lost,
      qualifiedCount: qualified,
      negotiationCount: negotiation,
      avgAmount: opps.length ? Math.round(total / opps.length) : 0,
      conversionRate: total ? Math.round((won / total) * 100) : 0,
    };
  }, [opps]);
  const displayStats = backendStats
    ? {
        ...stats,
        total: backendStats.total,
        totalAmount: backendStats.total_amount,
        wonAmount: backendStats.won_amount,
        lostAmount: backendStats.lost_amount,
        qualifiedCount: backendStats.qualified,
        negotiationCount: backendStats.negotiation,
        conversionRate: backendStats.conversion_rate,
      }
    : stats;

  return (
    <SuperAdminLayout>
      {/* Backdrop de chargement */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(4px)",
        }}
        open={loading && opps.length === 0}
      >
        <Box textAlign="center">
          <CircularProgress sx={{ color: THEME.primary }} />
          <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
            Chargement des opportunités...
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
            Opportunités
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {opps.length} opportunité(s) • Dernière mise à jour{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ textAlign: "right" }}>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ textTransform: "uppercase", letterSpacing: 1 }}
            >
              Montant total
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: THEME.success }}>
              {displayStats.totalAmount.toLocaleString("fr-FR")} TND
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: alpha(THEME.success, 0.1), width: 48, height: 48 }}>
            <AttachMoney sx={{ color: THEME.success }} />
          </Avatar>
        </Stack>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Total opportunités"
            value={displayStats.total}
            icon={<AttachMoney />}
            color={THEME.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Montant gagné"
            value={`${displayStats.wonAmount.toLocaleString("fr-FR")}TND`}
            icon={<CheckCircleIcon />}
            color={THEME.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Montant perdu"
            value={`${displayStats.lostAmount.toLocaleString("fr-FR")}TND`}
            icon={<CancelIcon />}
            color={THEME.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Moyenne"
            value={`${displayStats.avgAmount.toLocaleString("fr-FR")}TND`}
            icon={<TrendingUpIcon />}
            color={THEME.warning}
          >
            <Chip
              size="small"
              label={`${displayStats.qualifiedCount} qualifiées`}
              sx={{
                bgcolor: alpha(THEME.blue, 0.1),
                color: THEME.blue,
                borderRadius: 1,
              }}
            />
          </StatsCardItem>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Taux conversion"
            value={`${displayStats.conversionRate}%`}
            icon={<TrendingUpIcon />}
            color={THEME.purple}
          >
            <Chip
              size="small"
              label={`${displayStats.negotiationCount} en négo`}
              sx={{
                bgcolor: alpha(THEME.purple, 0.1),
                color: THEME.purple,
                borderRadius: 1,
              }}
            />
          </StatsCardItem>
        </Grid>
      </Grid>

      {/* Filtres */}
      <StyledCard sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Rechercher par nom, prospect, entreprise..."
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

            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1} justifyContent="flex-end" flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <Select
                    value={stageFilter}
                    onChange={(e) => {
                      setStageFilter(e.target.value);
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
                    renderValue={(selected) => {
                      if (!selected) return "Tous les stages";
                      return STAGE_LABELS[selected] || selected;
                    }}
                  >
                    <MenuItem value="">Tous les stages</MenuItem>
                    {STAGES.filter(Boolean).map((s) => (
                      <MenuItem key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Badge color="error" badgeContent={stageFilter ? 1 : 0} invisible={!stageFilter}>
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
                    onClick={fetchOpps}
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
                <TableCell sx={{ width: 250 }}>Opportunité</TableCell>
                <TableCell sx={{ width: 120 }} align="right">
                  Montant
                </TableCell>
                <TableCell sx={{ width: 150 }}>Stage</TableCell>
                <TableCell sx={{ width: 180 }}>Prospect/Contact</TableCell>
                <TableCell sx={{ width: 130 }}>Assigné à</TableCell>
                <TableCell sx={{ width: 150 }}>Entreprise CRM</TableCell>
                <TableCell sx={{ width: 120 }}>Clôture prévue</TableCell>
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
              ) : opps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <AttachMoney sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucune opportunité trouvée
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                opps.map((o) => (
                  <StyledTableRow key={o.id} hover onDoubleClick={() => handleViewDetails(o)}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: alpha(THEME.success, 0.1),
                            color: THEME.success,
                          }}
                        >
                          <AttachMoney sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.n800 }}>
                          {o.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: THEME.success }}>
                        {parseFloat(o.amount).toLocaleString("fr-FR")} TND
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StyledChip
                        size="small"
                        label={STAGE_LABELS[o.stage] || o.stage}
                        stage={o.stage}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {o.prospect_name || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {o.assigned_to_username || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {o.company_name ? (
                        <Chip
                          size="small"
                          label={o.company_name}
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
                      <Typography variant="caption" sx={{ color: THEME.n500 }}>
                        {o.expected_close_date
                          ? new Date(o.expected_close_date).toLocaleDateString("fr-FR")
                          : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir détails">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(o)}
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
              {opps.length} opportunité(s) sur cette page
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
            Filtres
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

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Stage</InputLabel>
          <Select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
              setShowFilters(false);
            }}
            label="Stage"
          >
            <MenuItem value="">Tous</MenuItem>
            {STAGES.filter(Boolean).map((s) => (
              <MenuItem key={s} value={s}>
                {STAGE_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => {
              setStageFilter("");
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
      <OpportunityDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        opportunity={selectedOpportunity}
      />
    </SuperAdminLayout>
  );
}
