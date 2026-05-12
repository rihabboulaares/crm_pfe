/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminUsers.js
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Pagination,
  InputAdornment,
  Grid,
  Badge,
  Collapse,
  Alert,
  Drawer,
  Divider,
  Button,
  Backdrop,
  Paper,
  alpha,
  styled,
} from "@mui/material";

import {
  People,
  Search,
  CheckCircle,
  Cancel,
  FilterList as FilterIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  AdminPanelSettings as AdminIcon,
  SupervisorAccount as ManagerIcon,
  Person as CommercialIcon,
  Block as BlockIcon,
  Verified as VerifiedIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";

import SuperAdminLayout from "./SuperAdminLayout";

// ==============================
// THÈME PERSONNALISÉ (identique à Prospects)
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
// STYLES PERSONNALISÉS (copiés de Prospects)
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

const StyledChip = styled(Chip)(({ role }) => ({
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
}));

// ==============================
// CONFIGURATION API
// ==============================
const api = (url) =>
  axios.get(`http://127.0.0.1:8000${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

const apiPost = (url, data) =>
  axios.post(`http://127.0.0.1:8000${url}`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

const ROLES = ["", "ADMIN", "MANAGER", "COMMERCIAL"];

// ==============================
// COMPOSANT STATS CARD (adapté de Prospects)
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
// COMPOSANT USER DETAILS DRAWER
// ==============================
const UserDetailsDrawer = ({ open, onClose, user }) => {
  if (!user) return null;

  const getRoleIcon = (role) => {
    const icons = {
      ADMIN: <AdminIcon sx={{ fontSize: 20, color: THEME.blue }} />,
      MANAGER: <ManagerIcon sx={{ fontSize: 20, color: THEME.purple }} />,
      COMMERCIAL: <CommercialIcon sx={{ fontSize: 20, color: THEME.n500 }} />,
    };
    return icons[role] || <People sx={{ fontSize: 20, color: THEME.primary }} />;
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
            Détails de l&apos;utilisateur
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
              {user.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {user.username}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {user.email}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <StyledChip label={user.role} role={user.role} size="small" />
                <Chip
                  label={user.is_active ? "Actif" : "Inactif"}
                  size="small"
                  sx={{
                    bgcolor: user.is_active ? alpha(THEME.green, 0.1) : alpha(THEME.error, 0.1),
                    color: user.is_active ? THEME.green : THEME.error,
                    borderRadius: 1,
                  }}
                />
              </Stack>
            </Box>
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Informations générales
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EmailIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">{user.email}</Typography>
                </Box>
                {user.company_name && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">{user.company_name}</Typography>
                  </Box>
                )}
                <Box display="flex" alignItems="center" gap={1}>
                  {getRoleIcon(user.role)}
                  <Typography variant="body2">Rôle : {user.role}</Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Statut du compte
              </Typography>
              <Stack spacing={1.5}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Compte vérifié
                  </Typography>
                  <Chip
                    size="small"
                    icon={user.is_verified ? <VerifiedIcon /> : <Cancel />}
                    label={user.is_verified ? "Vérifié" : "Non vérifié"}
                    sx={{
                      bgcolor: user.is_verified ? alpha(THEME.green, 0.1) : alpha(THEME.n500, 0.1),
                      color: user.is_verified ? THEME.green : THEME.n500,
                    }}
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Statut
                  </Typography>
                  <Chip
                    size="small"
                    label={user.is_active ? "Actif" : "Inactif"}
                    sx={{
                      bgcolor: user.is_active ? alpha(THEME.green, 0.1) : alpha(THEME.error, 0.1),
                      color: user.is_active ? THEME.green : THEME.error,
                    }}
                  />
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

UserDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    company_name: PropTypes.string,
    is_active: PropTypes.bool,
    is_verified: PropTypes.bool,
  }),
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function SuperAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toggling, setToggling] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=12`;
      if (search) params += `&search=${search}`;
      if (roleFilter) params += `&role=${roleFilter}`;
      const res = await api(`/api/superadmin/users/${params}`);
      const data = res.data;
      setUsers(data.results || data);
      setTotalPages(Math.ceil((data.count || (data.results || data).length) / 12));
    } catch (e) {
      console.error(e);
      showNotification("Erreur lors du chargement des utilisateurs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter]);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleToggle = async (id) => {
    setToggling(id);
    try {
      await apiPost(`/api/superadmin/users/${id}/toggle-active/`, {});
      showNotification("Statut modifié avec succès", "success");
      fetchUsers();
    } catch (e) {
      console.error(e);
      showNotification("Erreur lors de la modification", "error");
    } finally {
      setToggling(null);
    }
  };

  const handleViewDetails = (user) => {
    setSelectedUser(user);
    setDetailsDrawerOpen(true);
  };

  // Statistiques
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
      verified: users.filter((u) => u.is_verified).length,
      admins: users.filter((u) => u.role === "ADMIN").length,
      managers: users.filter((u) => u.role === "MANAGER").length,
      commercials: users.filter((u) => u.role === "COMMERCIAL").length,
    }),
    [users]
  );

  const roleColor = (role) =>
    ({
      ADMIN: { bg: alpha(THEME.blue, 0.1), text: THEME.blue },
      MANAGER: { bg: alpha(THEME.purple, 0.1), text: THEME.purple },
      COMMERCIAL: { bg: alpha(THEME.n500, 0.1), text: THEME.n500 },
    }[role] || { bg: THEME.n100, text: THEME.n500 });

  return (
    <SuperAdminLayout>
      {/* Backdrop de chargement */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backdropFilter: "blur(4px)",
        }}
        open={loading && users.length === 0}
      >
        <Box textAlign="center">
          <CircularProgress sx={{ color: THEME.primary }} />
          <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
            Chargement des utilisateurs...
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

      {/* Header avec style Prospects */}
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
            Utilisateurs
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {users.length} utilisateur(s) • Dernière mise à jour{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(THEME.purple, 0.1), width: 48, height: 48 }}>
          <People sx={{ color: THEME.purple }} />
        </Avatar>
      </Box>

      {/* Stats Cards style Prospects */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Total utilisateurs"
            value={stats.total}
            icon={<People />}
            color={THEME.primary}
          >
            <Chip
              size="small"
              label={`${stats.active} Actifs`}
              sx={{
                bgcolor: alpha(THEME.success, 0.1),
                color: THEME.success,
                borderRadius: 1,
                border: `1px solid ${THEME.success}`,
              }}
            />
            <Chip
              size="small"
              label={`${stats.inactive} Inactifs`}
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
            title="Rôles"
            value={stats.admins + stats.managers + stats.commercials}
            icon={<AdminIcon />}
            color={THEME.blue}
          >
            <Chip
              size="small"
              label={`${stats.admins} Admins`}
              sx={{
                bgcolor: alpha(THEME.blue, 0.1),
                color: THEME.blue,
                borderRadius: 1,
                border: `1px solid ${THEME.blue}`,
              }}
            />
            <Chip
              size="small"
              label={`${stats.managers} Managers`}
              sx={{
                bgcolor: alpha(THEME.purple, 0.1),
                color: THEME.purple,
                borderRadius: 1,
                border: `1px solid ${THEME.purple}`,
              }}
            />
          </StatsCardItem>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Vérification"
            value={stats.verified}
            icon={<VerifiedIcon />}
            color={THEME.success}
          >
            <Chip
              size="small"
              label={`${((stats.verified / stats.total) * 100 || 0).toFixed(0)}% vérifiés`}
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
            title="Commerciaux"
            value={stats.commercials}
            icon={<CommercialIcon />}
            color={THEME.n500}
          />
        </Grid>
      </Grid>

      {/* Filtres style Prospects */}
      <StyledCard sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Rechercher par email, nom, entreprise..."
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
                <FormControl size="small" sx={{ minWidth: 160 }}>
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
                    <MenuItem value="">Tous les rôles</MenuItem>
                    {ROLES.filter(Boolean).map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Badge color="error" badgeContent={roleFilter ? 1 : 0} invisible={!roleFilter}>
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
                    onClick={fetchUsers}
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

      {/* Table style Prospects */}
      <StyledCard>
        <StyledTableContainer>
          <Table>
            <StyledTableHead>
              <TableRow>
                <TableCell sx={{ width: 200 }}>Utilisateur</TableCell>
                <TableCell sx={{ width: 220 }}>Email</TableCell>
                <TableCell sx={{ width: 120 }}>Rôle</TableCell>
                <TableCell sx={{ width: 180 }}>Entreprise</TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Vérifié
                </TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Statut
                </TableCell>
                <TableCell sx={{ width: 100 }} align="center">
                  Action
                </TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <CircularProgress sx={{ color: THEME.primary }} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <People sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucun utilisateur trouvé
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const rc = roleColor(u.role);
                  return (
                    <StyledTableRow
                      key={u.id}
                      hover
                      sx={{ opacity: u.is_active ? 1 : 0.6 }}
                      onDoubleClick={() => handleViewDetails(u)}
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(THEME.primary, 0.1),
                              color: THEME.primary,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {u.username?.[0]?.toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.n800 }}>
                            {u.username}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: THEME.n500, noWrap: true }}>
                          {u.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StyledChip size="small" label={u.role} role={u.role} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: THEME.n800 }}>
                          {u.company_name || <span style={{ color: THEME.n500 }}>—</span>}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {u.is_verified ? (
                          <CheckCircle sx={{ fontSize: 18, color: THEME.success }} />
                        ) : (
                          <Cancel sx={{ fontSize: 18, color: THEME.n500 }} />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={u.is_active ? "Actif" : "Inactif"}
                          sx={{
                            fontWeight: 600,
                            fontSize: 11,
                            bgcolor: u.is_active
                              ? alpha(THEME.success, 0.1)
                              : alpha(THEME.error, 0.1),
                            color: u.is_active ? THEME.success : THEME.error,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={0.5}>
                          <Tooltip title="Voir détails">
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(u)}
                              sx={{
                                color: "#0288d1",
                                bgcolor: alpha("#0288d1", 0.1),
                                width: 32,
                                height: 32,
                              }}
                            >
                              <VisibilityIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={u.is_active ? "Désactiver" : "Activer"}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleToggle(u.id)}
                                disabled={toggling === u.id}
                                sx={{
                                  color: u.is_active ? THEME.error : THEME.success,
                                  bgcolor: alpha(u.is_active ? THEME.error : THEME.success, 0.1),
                                  width: 32,
                                  height: 32,
                                  "&:hover": {
                                    bgcolor: alpha(u.is_active ? THEME.error : THEME.success, 0.2),
                                  },
                                }}
                              >
                                {toggling === u.id ? (
                                  <CircularProgress size={16} />
                                ) : u.is_active ? (
                                  <BlockIcon sx={{ fontSize: 18 }} />
                                ) : (
                                  <CheckCircle sx={{ fontSize: 18 }} />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </StyledTableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </StyledTableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
            <Typography variant="caption" color="textSecondary">
              {users.length} utilisateur(s) sur cette page
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
            {ROLES.filter(Boolean).map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="space-between">
          <Button
            onClick={() => {
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
      <UserDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        user={selectedUser}
      />
    </SuperAdminLayout>
  );
}
