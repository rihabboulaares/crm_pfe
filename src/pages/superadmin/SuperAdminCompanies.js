/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminCompanies.js
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Pagination,
  InputAdornment,
  Grid,
  Collapse,
  Alert,
  Drawer,
  Divider,
  Backdrop,
  Paper,
  Badge,
  alpha,
  styled,
} from "@mui/material";

import {
  Business as BusinessIcon,
  Search,
  Visibility,
  SwapHoriz,
  CheckCircle,
  Cancel,
  People,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Category as CategoryIcon,
  Euro as EuroIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
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

const StyledChip = styled(Chip)(({ plan, status }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(plan === "enterprise" && {
    background: alpha(THEME.purple, 0.1),
    color: THEME.purple,
    border: `1px solid ${THEME.purple}`,
  }),
  ...(plan === "pro" && {
    background: alpha(THEME.blue, 0.1),
    color: THEME.blue,
    border: `1px solid ${THEME.blue}`,
  }),
  ...(plan === "starter" && {
    background: alpha(THEME.green, 0.1),
    color: THEME.green,
    border: `1px solid ${THEME.green}`,
  }),
  ...(status === "active" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
  ...(status === "inactive" && {
    background: alpha(THEME.error, 0.1),
    color: THEME.error,
    border: `1px solid ${THEME.error}`,
  }),
  ...(status === "trial" && {
    background: alpha(THEME.amber, 0.1),
    color: THEME.amber,
    border: `1px solid ${THEME.amber}`,
  }),
}));

// ==============================
// CONFIGURATION API
// ==============================
const api = (url) =>
  axios.get(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

const apiPost = (url, data) =>
  axios.post(`/${url}`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

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
// COMPOSANT COMPANY DETAILS DIALOG
// ==============================
const CompanyDetailsDialog = ({ open, onClose, companyId }) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (open && companyId) {
      fetchDetails();
    }
  }, [open, companyId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const r = await api(`/api/superadmin/companies/${companyId}/`);
      setDetail(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          color: THEME.primary,
          borderBottom: `1px solid ${alpha(THEME.primary, 0.1)}`,
          pb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        Détail de l&apos;entreprise
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: THEME.primary }} />
          </Box>
        ) : (
          detail && (
            <Box>
              {/* En-tête avec infos principales */}
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
                    {detail.company?.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="h5" fontWeight={700}>
                      {detail.company?.name}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" gap={1}>
                      {detail.company?.industry && (
                        <Chip
                          size="small"
                          label={detail.company.industry}
                          icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            bgcolor: alpha(THEME.info, 0.1),
                            color: THEME.info,
                          }}
                        />
                      )}
                      {detail.company?.country && (
                        <Chip
                          size="small"
                          label={detail.company.country}
                          icon={<LocationIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            bgcolor: alpha(THEME.amber, 0.1),
                            color: THEME.amber,
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Box>
              </Paper>

              <Grid container spacing={2}>
                {/* Informations générales */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                    >
                      Informations générales
                    </Typography>
                    <Stack spacing={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CategoryIcon sx={{ fontSize: 20, color: THEME.primary }} />
                        <Typography variant="body2">
                          <strong>Industrie :</strong> {detail.company?.industry || "—"}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LocationIcon sx={{ fontSize: 20, color: THEME.primary }} />
                        <Typography variant="body2">
                          <strong>Localisation :</strong> {detail.company?.city || "—"},{" "}
                          {detail.company?.country || "—"}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PhoneIcon sx={{ fontSize: 20, color: THEME.primary }} />
                        <Typography variant="body2">
                          <strong>Téléphone :</strong> {detail.company?.phone_number || "—"}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <EmailIcon sx={{ fontSize: 20, color: THEME.primary }} />
                        <Typography variant="body2">
                          <strong>Email :</strong> {detail.company?.email || "—"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                </Grid>

                {/* Propriétaire */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                    >
                      Propriétaire
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar
                        sx={{
                          bgcolor: alpha(THEME.purple, 0.1),
                          color: THEME.purple,
                        }}
                      >
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {detail.company?.owner_username}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {detail.company?.owner_email}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                </Grid>

                {/* Abonnement */}
                {detail.subscription && (
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                      >
                        Abonnement
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">
                            Plan
                          </Typography>
                          <StyledChip
                            size="small"
                            label={detail.subscription.plan_name}
                            plan={detail.subscription.plan_name}
                            sx={{ mt: 0.5 }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">
                            Prix
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {detail.subscription.plan_price} TND / mois
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">
                            Début
                          </Typography>
                          <Typography variant="body2">
                            {new Date(detail.subscription.start_date).toLocaleDateString("fr-FR")}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">
                            Fin
                          </Typography>
                          <Typography variant="body2">
                            {detail.subscription.end_date
                              ? new Date(detail.subscription.end_date).toLocaleDateString("fr-FR")
                              : "—"}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">
                            Statut
                          </Typography>
                          <StyledChip
                            size="small"
                            label={detail.subscription.is_active ? "Actif" : "Inactif"}
                            status={detail.subscription.is_active ? "active" : "inactive"}
                            sx={{ mt: 0.5 }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">
                            Jours restants
                          </Typography>
                          <Typography variant="body2">
                            {detail.subscription.days_until_expiry ?? "—"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Card>
                  </Grid>
                )}

                {/* Utilisateurs */}
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                    >
                      Utilisateurs ({detail.users?.length || 0})
                    </Typography>
                    <Stack spacing={1.5}>
                      {detail.users?.map((u) => (
                        <Paper
                          key={u.id}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(THEME.n100, 0.5),
                          }}
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            flexWrap="wrap"
                            gap={1}
                          >
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: alpha(THEME.purple, 0.1),
                                  color: THEME.purple,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {u.username?.[0]?.toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {u.username}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {u.email}
                                </Typography>
                              </Box>
                            </Stack>
                            <Stack direction="row" spacing={0.5}>
                              <StyledChip
                                size="small"
                                label={u.role}
                                plan={u.role?.toLowerCase()}
                              />
                              {!u.is_active && (
                                <Chip
                                  size="small"
                                  label="Inactif"
                                  sx={{
                                    bgcolor: alpha(THEME.error, 0.1),
                                    color: THEME.error,
                                  }}
                                />
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <GradientButton onClick={onClose} sx={{ px: 4 }}>
          Fermer
        </GradientButton>
      </DialogActions>
    </Dialog>
  );
};

CompanyDetailsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  companyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function SuperAdminCompanies() {
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [showFilters, setShowFilters] = useState(false);
  const [backendStats, setBackendStats] = useState(null);

  // Dialog détail
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  // Dialog assign plan
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=10`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (planFilter) params += `&plan=${planFilter}`;
      if (statusFilter === "active") params += `&subscription_active=true`;
      if (statusFilter === "inactive") params += `&subscription_active=false`;
      const res = await api(`/api/superadmin/companies/${params}`);
      const data = res.data;
      setCompanies(data.results || data);
      const total = data.count || (data.results || data).length;
      setTotalPages(Math.ceil(total / 10));
    } catch (e) {
      console.error("Erreur chargement entreprises:", e);
      showNotification("Erreur lors du chargement des entreprises", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => {
    api("/api/superadmin/plans/")
      .then((r) => setPlans(r.data))
      .catch(console.error);
    api("/api/superadmin/companies/stats/")
      .then((r) => setBackendStats(r.data))
      .catch((e) => console.error("Erreur stats entreprises:", e));
  }, []);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const openDetail = (id) => {
    setSelectedCompanyId(id);
    setDetailOpen(true);
  };

  const openAssign = (company) => {
    setSelectedCompany(company);
    setSelectedPlan(company.subscription_plan || "");
    setAssignMsg("");
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedPlan) return;
    setAssignLoading(true);
    try {
      const plan = plans.find((p) => p.name === selectedPlan);
      await apiPost(`/api/superadmin/companies/${selectedCompany.id}/assign-plan/`, {
        plan_id: plan.id,
        duration_days: 30,
      });
      setAssignMsg("Plan assigné avec succès ✓");
      showNotification("Plan modifié avec succès", "success");
      fetchCompanies();
      setTimeout(() => setAssignOpen(false), 1500);
    } catch (e) {
      setAssignMsg("Erreur lors de l'assignation");
      showNotification("Erreur lors de l'assignation", "error");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await apiPost(`/api/superadmin/companies/${id}/toggle-subscription/`, {});
      showNotification("Statut modifié avec succès", "success");
      fetchCompanies();
    } catch (e) {
      console.error(e);
      showNotification("Erreur lors de la modification", "error");
    }
  };

  // Statistiques
  const stats = useMemo(
    () => ({
      total: companies.length,
      active: companies.filter((c) => c.subscription_active).length,
      inactive: companies.filter((c) => !c.subscription_active).length,
      trial: companies.filter((c) => c.is_trial).length,
      totalUsers: companies.reduce((acc, c) => acc + (c.users_count || 0), 0),
      enterprise: companies.filter((c) => c.subscription_plan === "enterprise").length,
      pro: companies.filter((c) => c.subscription_plan === "pro").length,
      starter: companies.filter((c) => c.subscription_plan === "starter").length,
    }),
    [companies]
  );
  const displayStats = backendStats
    ? {
        ...stats,
        total: backendStats.total_companies,
        active: backendStats.active_companies,
        inactive: backendStats.inactive_companies,
        trial: backendStats.trial_companies,
        totalUsers: backendStats.total_users,
      }
    : stats;

  const activeFiltersCount = (planFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <SuperAdminLayout>
      {/* Backdrop de chargement */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(4px)",
        }}
        open={loading && companies.length === 0}
      >
        <Box textAlign="center">
          <CircularProgress sx={{ color: THEME.primary }} />
          <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
            Chargement des entreprises...
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
            Entreprises
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {companies.length} entreprise(s) • Dernière mise à jour{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(THEME.blue, 0.1), width: 48, height: 48 }}>
          <BusinessIcon sx={{ color: THEME.blue }} />
        </Avatar>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Total entreprises"
            value={displayStats.total}
            icon={<BusinessIcon />}
            color={THEME.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Actives"
            value={displayStats.active}
            icon={<CheckCircle />}
            color={THEME.success}
          >
            <Chip
              size="small"
              label={`${Math.round((displayStats.active / displayStats.total) * 100 || 0)}%`}
              sx={{
                bgcolor: alpha(THEME.success, 0.1),
                color: THEME.success,
                borderRadius: 1,
              }}
            />
          </StatsCardItem>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Inactives"
            value={displayStats.inactive}
            icon={<Cancel />}
            color={THEME.error}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Utilisateurs"
            value={displayStats.totalUsers}
            icon={<People />}
            color={THEME.info}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Essai"
            value={displayStats.trial}
            icon={<CalendarIcon />}
            color={THEME.amber}
          />
        </Grid>
      </Grid>

      {/* Filtres */}
      <StyledCard sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Rechercher par nom, email, pays..."
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
                    value={planFilter}
                    onChange={(e) => {
                      setPlanFilter(e.target.value);
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
                    <MenuItem value="">Tous plans</MenuItem>
                    <MenuItem value="starter">Starter</MenuItem>
                    <MenuItem value="pro">Pro</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </Select>
                </FormControl>

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
                    <MenuItem value="active">Actives</MenuItem>
                    <MenuItem value="inactive">Inactives</MenuItem>
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
                    onClick={fetchCompanies}
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
                <TableCell sx={{ width: 250 }}>Entreprise</TableCell>
                <TableCell sx={{ width: 200 }}>Propriétaire</TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Utilisateurs
                </TableCell>
                <TableCell sx={{ width: 150 }}>Plan</TableCell>
                <TableCell sx={{ width: 120 }} align="center">
                  Statut
                </TableCell>
                <TableCell sx={{ width: 180 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <CircularProgress sx={{ color: THEME.primary }} />
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <BusinessIcon
                        sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }}
                      />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucune entreprise trouvée
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => (
                  <StyledTableRow key={c.id} hover onDoubleClick={() => openDetail(c.id)}>
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
                          {c.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.n800 }}>
                            {c.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: THEME.n500 }}>
                            {c.industry || "—"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ color: THEME.n800 }}>
                          {c.owner_username}
                        </Typography>
                        <Typography variant="caption" sx={{ color: THEME.n500 }}>
                          {c.owner_email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="center"
                        spacing={0.5}
                      >
                        <People sx={{ fontSize: 16, color: THEME.info }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {c.users_count || 0}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {c.subscription_plan ? (
                          <StyledChip
                            size="small"
                            label={c.subscription_plan}
                            plan={c.subscription_plan}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="aucun"
                            sx={{
                              bgcolor: THEME.n100,
                              color: THEME.n500,
                            }}
                          />
                        )}
                        {c.is_trial && (
                          <Chip
                            size="small"
                            label="essai"
                            sx={{
                              bgcolor: alpha(THEME.amber, 0.1),
                              color: THEME.amber,
                            }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <StyledChip
                        size="small"
                        icon={
                          c.subscription_active ? (
                            <CheckCircle sx={{ fontSize: "14px !important" }} />
                          ) : (
                            <Cancel sx={{ fontSize: "14px !important" }} />
                          )
                        }
                        label={c.subscription_active ? "Actif" : "Inactif"}
                        status={c.subscription_active ? "active" : "inactive"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" justifyContent="center" gap={0.5}>
                        <Tooltip title="Voir détail">
                          <IconButton
                            size="small"
                            onClick={() => openDetail(c.id)}
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
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Changer de plan">
                          <IconButton
                            size="small"
                            onClick={() => openAssign(c)}
                            sx={{
                              color: THEME.purple,
                              bgcolor: alpha(THEME.purple, 0.1),
                              width: 32,
                              height: 32,
                              "&:hover": {
                                bgcolor: alpha(THEME.purple, 0.2),
                              },
                            }}
                          >
                            <SwapHoriz fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={c.subscription_active ? "Désactiver" : "Activer"}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggle(c.id)}
                            sx={{
                              color: c.subscription_active ? THEME.error : THEME.success,
                              bgcolor: alpha(
                                c.subscription_active ? THEME.error : THEME.success,
                                0.1
                              ),
                              width: 32,
                              height: 32,
                              "&:hover": {
                                bgcolor: alpha(
                                  c.subscription_active ? THEME.error : THEME.success,
                                  0.2
                                ),
                              },
                            }}
                          >
                            {c.subscription_active ? (
                              <Cancel fontSize="small" />
                            ) : (
                              <CheckCircle fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
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
              {companies.length} entreprise(s) sur cette page
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

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Plan</InputLabel>
          <Select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
              setShowFilters(false);
            }}
            label="Plan"
          >
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="starter">Starter</MenuItem>
            <MenuItem value="pro">Pro</MenuItem>
            <MenuItem value="enterprise">Enterprise</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              setShowFilters(false);
            }}
            label="Statut"
          >
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="active">Actives</MenuItem>
            <MenuItem value="inactive">Inactives</MenuItem>
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => {
              setPlanFilter("");
              setStatusFilter("");
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

      {/* Dialog Détail */}
      <CompanyDetailsDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        companyId={selectedCompanyId}
      />

      {/* Dialog Assign Plan */}
      <Dialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            color: THEME.primary,
            borderBottom: `1px solid ${alpha(THEME.primary, 0.1)}`,
            pb: 2,
          }}
        >
          Changer le plan — {selectedCompany?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Plan</InputLabel>
            <Select
              value={selectedPlan}
              label="Plan"
              onChange={(e) => setSelectedPlan(e.target.value)}
              sx={{
                borderRadius: 2,
              }}
            >
              {plans.map((p) => (
                <MenuItem key={p.id} value={p.name}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {p.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {p.price} TND/mois • {p.max_users ?? "∞"} utilisateurs
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {assignMsg && (
            <Alert
              severity={assignMsg.includes("✓") ? "success" : "error"}
              sx={{ mt: 2, borderRadius: 2 }}
            >
              {assignMsg}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setAssignOpen(false)}
            sx={{
              borderRadius: 2,
              color: THEME.n500,
              textTransform: "none",
              px: 3,
            }}
          >
            Annuler
          </Button>
          <GradientButton
            onClick={handleAssign}
            disabled={assignLoading || !selectedPlan}
            sx={{ px: 4 }}
          >
            {assignLoading ? <CircularProgress size={20} sx={{ color: "white" }} /> : "Confirmer"}
          </GradientButton>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
}
