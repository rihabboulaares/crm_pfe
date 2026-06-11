/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminContacts.js
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
  Contacts,
  Search,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  CalendarToday as CalendarIcon,
  AccountCircle as AccountIcon,
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

const StyledChip = styled(Chip)(({ type }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(type === "account" && {
    background: alpha(THEME.blue, 0.1),
    color: THEME.blue,
    border: `1px solid ${THEME.blue}`,
  }),
  ...(type === "company" && {
    background: alpha(THEME.purple, 0.1),
    color: THEME.purple,
    border: `1px solid ${THEME.purple}`,
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
// COMPOSANT CONTACT DETAILS DRAWER
// ==============================
const ContactDetailsDrawer = ({ open, onClose, contact }) => {
  if (!contact) return null;

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
            Détails du contact
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
              {contact.first_name?.[0]?.toUpperCase()}
              {contact.last_name?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {contact.first_name} {contact.last_name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {contact.title || "Sans titre"}
              </Typography>
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" gap={1}>
                {contact.account_name && (
                  <StyledChip
                    label={contact.account_name}
                    type="account"
                    size="small"
                    icon={<AccountIcon sx={{ fontSize: 14 }} />}
                  />
                )}
                {contact.company_name && (
                  <StyledChip
                    label={contact.company_name}
                    type="company"
                    size="small"
                    icon={<BusinessIcon sx={{ fontSize: 14 }} />}
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
                {contact.email && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <EmailIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">{contact.email}</Typography>
                  </Box>
                )}
                {contact.phone && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhoneIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">{contact.phone}</Typography>
                  </Box>
                )}
                {contact.mobile && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <PhoneIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">Mobile : {contact.mobile}</Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Informations professionnelles
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <WorkIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">Poste : {contact.title || "—"}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">Compte : {contact.account_name || "—"}</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">
                    Entreprise : {contact.company_name || "—"}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Informations système
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Créé le
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {contact.created_at
                      ? new Date(contact.created_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </Typography>
                </Box>
                {contact.updated_at && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Modifié le
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {new Date(contact.updated_at).toLocaleDateString("fr-FR")}
                    </Typography>
                  </Box>
                )}
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

ContactDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  contact: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    mobile: PropTypes.string,
    title: PropTypes.string,
    account_name: PropTypes.string,
    company_name: PropTypes.string,
    created_at: PropTypes.string,
    updated_at: PropTypes.string,
  }),
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function SuperAdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedContact, setSelectedContact] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [backendStats, setBackendStats] = useState(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=15`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      const res = await apiGet(`/api/superadmin/contacts/${params}`);
      const data = res.data;
      setContacts(data.results || data);
      const total = data.count || (data.results || data).length;
      setTotalPages(Math.ceil(total / 15));
    } catch (e) {
      console.error("Erreur chargement contacts:", e);
      showNotification("Erreur lors du chargement des contacts", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    apiGet("/api/superadmin/contacts/stats/")
      .then((res) => setBackendStats(res.data))
      .catch((e) => console.error("Erreur stats contacts:", e));
  }, []);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleViewDetails = (contact) => {
    setSelectedContact(contact);
    setDetailsDrawerOpen(true);
  };

  // Statistiques
  const stats = useMemo(
    () => ({
      total: contacts.length,
      withAccount: contacts.filter((c) => c.account_name).length,
      withoutAccount: contacts.filter((c) => !c.account_name).length,
      withPhone: contacts.filter((c) => c.phone || c.mobile).length,
      withEmail: contacts.filter((c) => c.email).length,
      withTitle: contacts.filter((c) => c.title).length,
    }),
    [contacts]
  );
  const displayStats = backendStats
    ? {
        ...stats,
        total: backendStats.total_contacts,
        withAccount: backendStats.with_account,
        withoutAccount: backendStats.without_account,
        withPhone: backendStats.with_phone,
        withEmail: backendStats.with_email,
        withTitle: backendStats.with_title,
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
        open={loading && contacts.length === 0}
      >
        <Box textAlign="center">
          <CircularProgress sx={{ color: THEME.primary }} />
          <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
            Chargement des contacts...
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
            Contacts
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {contacts.length} contact(s) • Dernière mise à jour{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(THEME.green, 0.1), width: 48, height: 48 }}>
          <Contacts sx={{ color: THEME.green }} />
        </Avatar>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Total contacts"
            value={displayStats.total}
            icon={<Contacts />}
            color={THEME.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Avec compte"
            value={displayStats.withAccount}
            icon={<AccountIcon />}
            color={THEME.blue}
          >
            <Chip
              size="small"
              label={`${Math.round((displayStats.withAccount / displayStats.total) * 100 || 0)}%`}
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
            title="Sans compte"
            value={displayStats.withoutAccount}
            icon={<AccountIcon />}
            color={THEME.warning}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Avec téléphone"
            value={displayStats.withPhone}
            icon={<PhoneIcon />}
            color={THEME.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Avec poste"
            value={displayStats.withTitle}
            icon={<WorkIcon />}
            color={THEME.purple}
          />
        </Grid>
      </Grid>

      {/* Recherche */}
      <StyledCard sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Rechercher par nom, email, entreprise, compte..."
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

            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Badge color="error" badgeContent={0} invisible={true}>
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
                    onClick={fetchContacts}
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
                <TableCell sx={{ width: 220 }}>Contact</TableCell>
                <TableCell sx={{ width: 200 }}>Email</TableCell>
                <TableCell sx={{ width: 130 }}>Téléphone</TableCell>
                <TableCell sx={{ width: 150 }}>Poste</TableCell>
                <TableCell sx={{ width: 150 }}>Compte</TableCell>
                <TableCell sx={{ width: 150 }}>Entreprise CRM</TableCell>
                <TableCell sx={{ width: 100 }}>Créé le</TableCell>
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
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <Contacts sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucun contact trouvé
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((c) => (
                  <StyledTableRow key={c.id} hover onDoubleClick={() => handleViewDetails(c)}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: alpha(THEME.green, 0.1),
                            color: THEME.green,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {c.first_name?.[0]?.toUpperCase()}
                          {c.last_name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.n800 }}>
                            {c.first_name} {c.last_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: THEME.n500 }}>
                            {c.title || "—"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {c.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {c.phone || c.mobile || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {c.title || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {c.account_name ? (
                        <StyledChip size="small" label={c.account_name} type="account" />
                      ) : (
                        <Typography variant="caption" sx={{ color: THEME.n500 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.company_name ? (
                        <StyledChip size="small" label={c.company_name} type="company" />
                      ) : (
                        <Typography variant="caption" sx={{ color: THEME.n500 }}>
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: THEME.n500 }}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir détails">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(c)}
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
              {contacts.length} contact(s) sur cette page
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

      {/* Drawer de filtres (placeholder) */}
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

        <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 4 }}>
          Fonctionnalité à venir
        </Typography>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => setShowFilters(false)}
            variant="contained"
            sx={{
              background: THEME.gradient,
              borderRadius: 3,
              px: 3,
            }}
          >
            Fermer
          </Button>
        </Box>
      </Drawer>

      {/* Drawer de détails */}
      <ContactDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        contact={selectedContact}
      />
    </SuperAdminLayout>
  );
}
