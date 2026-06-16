/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminInvitations.js
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
  Mail,
  Search,
  CheckCircle,
  Cancel,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Group as GroupIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as ManagerIcon,
  Person as CommercialIcon,
  Schedule as ScheduleIcon,
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

const StyledChip = styled(Chip)(({ role, status }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(role === "ADMIN" && {
    background: alpha(THEME.blue, 0.1),
    color: THEME.blue,
    border: `1px solid ${THEME.blue}`,
  }),
  ...(role === "MANAGER" && {
    background: alpha(THEME.purple, 0.1),
    color: THEME.purple,
    border: `1px solid ${THEME.purple}`,
  }),
  ...(role === "COMMERCIAL" && {
    background: alpha(THEME.n500, 0.1),
    color: THEME.n500,
    border: `1px solid ${THEME.n500}`,
  }),
  ...(status === "accepted" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
  ...(status === "pending" && {
    background: alpha(THEME.amber, 0.1),
    color: THEME.amber,
    border: `1px solid ${THEME.amber}`,
  }),
}));

// ==============================
// CONFIGURATION API
// ==============================
const apiGet = (url) =>
  axios.get(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

// ==============================
// CONSTANTES
// ==============================
const ROLE_OPTIONS = ["", "ADMIN", "MANAGER", "COMMERCIAL"];
const ROLE_LABELS = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  COMMERCIAL: "Commercial",
};
const ROLE_ICONS = {
  ADMIN: <AdminIcon sx={{ fontSize: 16 }} />,
  MANAGER: <ManagerIcon sx={{ fontSize: 16 }} />,
  COMMERCIAL: <CommercialIcon sx={{ fontSize: 16 }} />,
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
// COMPOSANT INVITATION DETAILS DRAWER
// ==============================
const InvitationDetailsDrawer = ({ open, onClose, invitation }) => {
  if (!invitation) return null;

  const getRoleIcon = (role) => {
    return ROLE_ICONS[role] || <PersonIcon sx={{ fontSize: 20 }} />;
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
            Détails de l&apos;invitation
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
              {invitation.email?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {invitation.email}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <StyledChip
                  label={invitation.role}
                  role={invitation.role}
                  size="small"
                  icon={getRoleIcon(invitation.role)}
                />
                <StyledChip
                  label={invitation.accepted ? "Acceptée" : "En attente"}
                  status={invitation.accepted ? "accepted" : "pending"}
                  size="small"
                  icon={
                    invitation.accepted ? (
                      <CheckCircle sx={{ fontSize: 14 }} />
                    ) : (
                      <ScheduleIcon sx={{ fontSize: 14 }} />
                    )
                  }
                />
              </Stack>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Informations
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EmailIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">{invitation.email}</Typography>
                </Box>
                {invitation.company_name && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">Entreprise : {invitation.company_name}</Typography>
                  </Box>
                )}
                {invitation.team_name && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <GroupIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">Équipe : {invitation.team_name}</Typography>
                  </Box>
                )}
                <Box display="flex" alignItems="center" gap={1}>
                  {getRoleIcon(invitation.role)}
                  <Typography variant="body2">Rôle : {invitation.role}</Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Invité par
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">{invitation.invited_by_email}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">
                    Envoyée le : {new Date(invitation.created_at).toLocaleDateString("fr-FR")}
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

InvitationDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invitation: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    email: PropTypes.string,
    role: PropTypes.string,
    accepted: PropTypes.bool,
    company_name: PropTypes.string,
    team_name: PropTypes.string,
    invited_by_email: PropTypes.string,
    created_at: PropTypes.string,
  }),
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function SuperAdminInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [backendStats, setBackendStats] = useState(null);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=15`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (statusFilter === "accepted") params += `&accepted=true`;
      if (statusFilter === "pending") params += `&accepted=false`;
      if (roleFilter) params += `&role=${roleFilter}`;
      const res = await apiGet(`/api/superadmin/invitations/${params}`);
      const data = res.data;
      setInvitations(data.results || data);
      const total = data.count || (data.results || data).length;
      setTotalPages(Math.ceil(total / 15));
    } catch (e) {
      console.error("Erreur chargement invitations:", e);
      showNotification("Erreur lors du chargement des invitations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, roleFilter]);

  useEffect(() => {
    apiGet("/api/superadmin/invitations/stats/")
      .then((res) => setBackendStats(res.data))
      .catch((e) => console.error("Erreur stats invitations:", e));
  }, []);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleViewDetails = (invitation) => {
    setSelectedInvitation(invitation);
    setDetailsDrawerOpen(true);
  };

  // Statistiques
  const stats = useMemo(
    () => ({
      total: invitations.length,
      accepted: invitations.filter((i) => i.accepted).length,
      pending: invitations.filter((i) => !i.accepted).length,
      admins: invitations.filter((i) => i.role === "ADMIN").length,
      managers: invitations.filter((i) => i.role === "MANAGER").length,
      commercials: invitations.filter((i) => i.role === "COMMERCIAL").length,
    }),
    [invitations]
  );
  const displayStats = backendStats ? { ...stats, ...backendStats } : stats;

  const activeFiltersCount = (statusFilter ? 1 : 0) + (roleFilter ? 1 : 0);

  return (
    <SuperAdminLayout>
      {/* Backdrop de chargement */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(4px)",
        }}
        open={loading && invitations.length === 0}
      >
        <Box textAlign="center">
          <CircularProgress sx={{ color: THEME.primary }} />
          <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
            Chargement des invitations...
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
            Invitations
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {invitations.length} invitation(s) • Dernière mise à jour{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(THEME.amber, 0.1), width: 48, height: 48 }}>
          <Mail sx={{ color: THEME.amber }} />
        </Avatar>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Total invitations"
            value={displayStats.total}
            icon={<Mail />}
            color={THEME.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Acceptées"
            value={displayStats.accepted}
            icon={<CheckCircle />}
            color={THEME.success}
          >
            <Chip
              size="small"
              label={`${Math.round((displayStats.accepted / displayStats.total) * 100 || 0)}%`}
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
            title="En attente"
            value={displayStats.pending}
            icon={<ScheduleIcon />}
            color={THEME.amber}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Admins"
            value={displayStats.admins}
            icon={<AdminIcon />}
            color={THEME.blue}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Managers"
            value={displayStats.managers}
            icon={<ManagerIcon />}
            color={THEME.purple}
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
                placeholder="Rechercher par email, entreprise, équipe..."
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
                    <MenuItem value="accepted">Acceptées</MenuItem>
                    <MenuItem value="pending">En attente</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <Select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
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
                    <MenuItem value="">Tous rôles</MenuItem>
                    {ROLE_OPTIONS.filter(Boolean).map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
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
                    onClick={fetchInvitations}
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
                <TableCell sx={{ width: 200 }}>Email invité</TableCell>
                <TableCell sx={{ width: 150 }}>Entreprise</TableCell>
                <TableCell sx={{ width: 150 }}>Équipe</TableCell>
                <TableCell sx={{ width: 100 }}>Rôle</TableCell>
                <TableCell sx={{ width: 200 }}>Invité par</TableCell>
                <TableCell sx={{ width: 120 }}>Statut</TableCell>
                <TableCell sx={{ width: 100 }}>Date</TableCell>
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
              ) : invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <Mail sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucune invitation trouvée
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => (
                  <StyledTableRow key={inv.id} hover onDoubleClick={() => handleViewDetails(inv)}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: alpha(THEME.amber, 0.1),
                            color: THEME.amber,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {inv.email?.[0]?.toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" sx={{ color: THEME.n800 }}>
                          {inv.email}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n800 }}>
                        {inv.company_name || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {inv.team_name || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StyledChip size="small" label={inv.role} role={inv.role} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {inv.invited_by_email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {inv.accepted ? (
                        <StyledChip
                          size="small"
                          icon={<CheckCircle sx={{ fontSize: "14px !important" }} />}
                          label="Acceptée"
                          status="accepted"
                        />
                      ) : (
                        <StyledChip
                          size="small"
                          icon={<ScheduleIcon sx={{ fontSize: "14px !important" }} />}
                          label="En attente"
                          status="pending"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: THEME.n500 }}>
                        {inv.created_at
                          ? new Date(inv.created_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir détails">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(inv)}
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
              {invitations.length} invitation(s) sur cette page
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
            <MenuItem value="accepted">Acceptées</MenuItem>
            <MenuItem value="pending">En attente</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Rôle</InputLabel>
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
              setShowFilters(false);
            }}
            label="Rôle"
          >
            <MenuItem value="">Tous</MenuItem>
            {ROLE_OPTIONS.filter(Boolean).map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => {
              setStatusFilter("");
              setRoleFilter("");
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
      <InvitationDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        invitation={selectedInvitation}
      />
    </SuperAdminLayout>
  );
}
