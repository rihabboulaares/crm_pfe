/* eslint-disable */
// src/pages/modules/Contacts.jsx — pagination BACKEND
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";
import {
  Grid,
  TextField,
  Card,
  CardContent,
  Autocomplete,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  IconButton,
  Chip,
  Box,
  Drawer,
  Badge,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Avatar,
  Button,
  Typography,
  Stack,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Backdrop,
  CircularProgress,
  ButtonGroup,
  alpha,
  Paper,
  MenuItem,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Visibility as VisibilityIcon,
  Sort as SortIcon,
  ViewColumn as ViewColumnIcon,
  CalendarToday as CalendarIcon,
  PersonOutline as PersonOutlineIcon,
  LocationOn as LocationOnIcon,
  Archive as ArchiveIcon,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../superadmin/Marketingwidgets";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import PaginationBar from "../../components/PaginationBar";

// ==============================
// CONFIG
// ==============================
const API_BASE_URL = "http://127.0.0.1:8000/api/sales";
const API_USER = "http://127.0.0.1:8000/api/users/me/";

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
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
  "& .MuiTable-root": { minWidth: 1100, borderCollapse: "collapse", tableLayout: "fixed" },
}));

const StyledTableHead = styled(TableHead)(() => ({
  "& .MuiTableCell-head": {
    fontWeight: 700,
    color: THEME.primary,
    fontSize: "0.85rem",
    padding: "16px 12px",
    backgroundColor: alpha(THEME.primary, 0.04),
    borderBottom: `2px solid ${THEME.primary}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  "&:hover": { backgroundColor: alpha(THEME.primary, 0.02), cursor: "pointer" },
  "& td": { padding: "12px", borderBottom: `1px solid ${alpha("#000", 0.05)}` },
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

// ==============================
// UTILS
// ==============================
const getInitials = (first, last) => `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "-";
const formatDateLong = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "-";

// ==============================
// ContactDetailsDrawer
// ==============================
const ContactDetailsDrawer = ({ open, onClose, contact, currentUser }) => {
  const [activeTab, setActiveTab] = useState(0);
  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);
  if (!contact) return null;
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 500 },
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
          <IconButton onClick={onClose} sx={{ bgcolor: alpha(THEME.primary, 0.1) }}>
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
                width: 80,
                height: 80,
                background: THEME.gradient,
                fontSize: "2rem",
                fontWeight: 600,
              }}
            >
              {getInitials(contact.first_name, contact.last_name)}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {contact.first_name} {contact.last_name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {contact.title || "Sans titre"}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                <Chip
                  label="Contact"
                  size="small"
                  sx={{ bgcolor: alpha(THEME.info, 0.1), color: THEME.info, borderRadius: 1 }}
                />
                {contact.account && (
                  <Chip
                    label={contact.account.name}
                    size="small"
                    sx={{
                      bgcolor: alpha(THEME.primary, 0.1),
                      color: THEME.primary,
                      borderRadius: 1,
                    }}
                  />
                )}
                {isAdminOrManager && contact.assigned_to_name && (
                  <Chip
                    icon={<PersonOutlineIcon sx={{ fontSize: 14 }} />}
                    label={`Assigné à : ${contact.assigned_to_name}`}
                    size="small"
                    sx={{
                      bgcolor: alpha(THEME.primary, 0.08),
                      color: THEME.primaryDark,
                      borderRadius: 1,
                    }}
                  />
                )}
              </Stack>
            </Box>
          </Box>
        </Paper>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          {["Informations", "Activités"].map((tab, i) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(i)}
              size="small"
              sx={{
                textTransform: "none",
                fontWeight: 600,
                mr: 1,
                color: activeTab === i ? THEME.primary : "text.secondary",
                borderBottom: activeTab === i ? `2px solid ${THEME.primary}` : "none",
                borderRadius: 0,
              }}
            >
              {tab}
            </Button>
          ))}
        </Box>
        {activeTab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                >
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
                  {/* ✅ Localisation dans le drawer */}
                  {(contact.city || contact.country) && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocationOnIcon sx={{ fontSize: 20, color: THEME.primary }} />
                      <Typography variant="body2">
                        {[contact.city, contact.country].filter(Boolean).join(", ")}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                >
                  Informations professionnelles
                </Typography>
                <Stack spacing={1.5}>
                  {contact.title && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Titre
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {contact.title}
                      </Typography>
                    </Box>
                  )}
                  {contact.account && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Société
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {contact.account.name}
                      </Typography>
                    </Box>
                  )}
                  {isAdminOrManager && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="textSecondary">
                        Assigné à
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {contact.assigned_to_name || "—"}
                      </Typography>
                    </Box>
                  )}
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Créé le
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDateLong(contact.created_at)}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        )}
        {activeTab === 1 && (
          <Box textAlign="center" py={4}>
            <Typography color="textSecondary">Aucune activité récente</Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};
ContactDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  contact: PropTypes.object,
  currentUser: PropTypes.object,
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function Contacts() {
  const navigate = useNavigate();
  useTrackActivity("contacts");

  const [currentUser, setCurrentUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [apiFilters, setApiFilters] = useState({});
  const [localFilters, setLocalFilters] = useState({});
  const [sortBy, setSortBy] = useState("-created_at");
  const [viewMode, setViewMode] = useState("table");

  const [contactData, setContactData] = useState({
    first_name: "",
    last_name: "",
    title: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    account: null,
  });
  const [contextMenu, setContextMenu] = useState(null);
  const [contextContactId, setContextContactId] = useState(null);

  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);

  // ── Pagination backend ──
  const hookFilters = useMemo(() => {
    const f = { ...apiFilters, ordering: sortBy };
    if (searchTerm) f.search = searchTerm;
    if (apiFilters.account) f.account = apiFilters.account;
    if (apiFilters.date_from) f.created_at__gte = apiFilters.date_from;
    if (apiFilters.date_to) f.created_at__lte = apiFilters.date_to;
    return f;
  }, [apiFilters, searchTerm, sortBy]);

  const {
    data: contactsList,
    loading,
    total,
    pages,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: setHookFilters,
    refresh,
  } = usePaginatedList("/contacts/", 10);

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
      const res = await axios.get(API_USER, { headers: { Authorization: `Bearer ${tok}` } });
      setCurrentUser(res.data);
      fetchAccounts();
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/sign-in");
      }
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/accounts/");
      setAccounts(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {}
  };

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  // ── Stats ──
  const stats = useMemo(
    () => ({
      total,
      withAccount: contactsList.filter((c) => c.account).length,
      withoutAccount: contactsList.filter((c) => !c.account).length,
      withEmail: contactsList.filter((c) => c.email).length,
      withPhone: contactsList.filter((c) => c.phone).length,
    }),
    [contactsList, total]
  );

  // ── Handlers ──
  const handleEdit = (contact) => {
    setContactData({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      city: contact.city || "",
      country: contact.country || "",
    });
    setSelectedAccount(contact.account || null);
    setSelectedContactId(contact.id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!contactData.first_name || !contactData.last_name || !contactData.email) {
        showNotification("Prénom, Nom et Email sont obligatoires", "error");
        return;
      }
      const payload = {
        first_name: contactData.first_name,
        last_name: contactData.last_name,
        title: contactData.title || null,
        email: contactData.email,
        phone: contactData.phone || null,
        city: contactData.city || null,
        country: contactData.country || null,
        account: selectedAccount?.id || null,
      };
      if (isEditing && selectedContactId) {
        await api.put(`/contacts/${selectedContactId}/`, payload);
        showNotification("Contact modifié avec succès");
      } else {
        await api.post("/contacts/", payload);
        showNotification("Contact créé avec succès");
      }
      resetForm();
      refresh();
    } catch {
      showNotification("Erreur lors de l'enregistrement", "error");
    }
  };

  const resetForm = () => {
    setContactData({
      first_name: "",
      last_name: "",
      title: "",
      email: "",
      phone: "",
      city: "",
      country: "",
    });
    setSelectedAccount(null);
    setIsEditing(false);
    setSelectedContactId(null);
    setShowForm(false);
  };

  const handleDeleteClick = (id) => {
    setContactToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setContactToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/contacts/${contactToDelete}/`);
      showNotification("Contact supprimé");
      refresh();
      handleDeleteCancel();
    } catch {
      showNotification("Erreur lors de la suppression", "error");
    }
  };

  const handleArchive = async (id) => {
    try {
      await api.patch(`/contacts/${id}/`, { is_archived: true });
      showNotification("Contact archivé");
      refresh();
    } catch {
      showNotification("Erreur lors de l'archivage", "error");
    }
  };

  const handleViewDetails = (c) => {
    setSelectedContact(c);
    setDetailsDrawerOpen(true);
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setContextMenu(contextMenu === null ? { mouseX: e.clientX + 2, mouseY: e.clientY - 6 } : null);
    setContextContactId(id);
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
    setContextContactId(null);
  };

  const exportToCSV = () => {
    const headers = [
      "Prénom",
      "Nom",
      "Email",
      "Téléphone",
      "Ville",
      "Pays",
      "Titre",
      "Société",
      "Assigné à",
      "Date création",
    ];
    const rows = contactsList.map((c) => [
      c.first_name,
      c.last_name,
      c.email,
      c.phone || "",
      c.city || "",
      c.country || "",
      c.title || "",
      c.account?.name || "",
      c.assigned_to_name || "",
      formatDate(c.created_at),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contacts_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              Gestion des contacts
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {total} contact(s) au total
            </Typography>
          </Box>
          <GradientButton
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Nouveau contact
          </GradientButton>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              label: "Total contacts",
              value: total,
              color: THEME.primary,
              icon: <PeopleIcon />,
              sub: (
                <>
                  <Chip
                    size="small"
                    label={`${stats.withAccount} en société`}
                    sx={{
                      bgcolor: alpha(THEME.success, 0.1),
                      color: THEME.success,
                      borderRadius: 1,
                      border: `1px solid ${THEME.success}`,
                    }}
                  />
                  <Chip
                    size="small"
                    label={`${stats.withoutAccount} indépendants`}
                    sx={{
                      bgcolor: alpha(THEME.info, 0.1),
                      color: THEME.info,
                      borderRadius: 1,
                      border: `1px solid ${THEME.info}`,
                    }}
                  />
                </>
              ),
            },
            {
              label: "Avec email",
              value: stats.withEmail,
              color: THEME.info,
              icon: <EmailIcon />,
              sub: (
                <Typography variant="caption" color="textSecondary">
                  {Math.round((stats.withEmail / (total || 1)) * 100)}% des contacts
                </Typography>
              ),
            },
            {
              label: "Avec téléphone",
              value: stats.withPhone,
              color: THEME.warning,
              icon: <PhoneIcon />,
              sub: (
                <Typography variant="caption" color="textSecondary">
                  {Math.round((stats.withPhone / (total || 1)) * 100)}% des contacts
                </Typography>
              ),
            },
            {
              label: "Sociétés",
              value: accounts.length,
              color: THEME.success,
              icon: <BusinessIcon />,
              sub: (
                <Typography variant="caption" color="textSecondary">
                  {Math.round((stats.withAccount / (total || 1)) * 100)}% en société
                </Typography>
              ),
            },
          ].map((s, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <StatsCard>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="textSecondary" gutterBottom>
                        {s.label}
                      </Typography>
                      <Typography variant="h4" sx={{ color: s.color, fontWeight: 700 }}>
                        {s.value}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{ bgcolor: alpha(s.color, 0.1), color: s.color, width: 48, height: 48 }}
                    >
                      {s.icon}
                    </Avatar>
                  </Box>
                  <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                    {s.sub}
                  </Box>
                </CardContent>
              </StatsCard>
            </Grid>
          ))}
        </Grid>

        {/* Barre de recherche */}
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Rechercher un contact..."
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
                      { v: "table", icon: <ViewColumnIcon /> },
                      { v: "cards", icon: <AssessmentIcon /> },
                    ].map((b) => (
                      <Button
                        key={b.v}
                        onClick={() => setViewMode(b.v)}
                        sx={{
                          bgcolor: viewMode === b.v ? alpha(THEME.primary, 0.1) : "transparent",
                          color: viewMode === b.v ? THEME.primary : "text.secondary",
                          borderColor: alpha(THEME.primary, 0.3),
                        }}
                      >
                        {b.icon}
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
                      <MenuItem value="email">Email</MenuItem>
                    </Select>
                  </FormControl>
                  <Badge
                    color="error"
                    badgeContent={Object.keys(apiFilters).length}
                    invisible={!Object.keys(apiFilters).length}
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
                  <Tooltip title="Exporter CSV">
                    <IconButton
                      size="small"
                      onClick={exportToCSV}
                      sx={{
                        color: THEME.primary,
                        border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                        borderRadius: 2,
                      }}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
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
          </CardContent>
        </StyledCard>

        {/* Vue Tableau */}
        {viewMode === "table" && (
          <StyledCard>
            <StyledTableContainer>
              <Table>
                <StyledTableHead>
                  <TableRow>
                    <TableCell sx={{ width: "18%" }}>Contact</TableCell>
                    <TableCell sx={{ width: "18%" }}>Email</TableCell>
                    <TableCell sx={{ width: "12%" }}>Téléphone</TableCell>
                    <TableCell sx={{ width: "12%" }}>Localisation</TableCell>
                    <TableCell sx={{ width: "15%" }}>Société</TableCell>
                    {isAdminOrManager && <TableCell sx={{ width: "13%" }}>Assigné à</TableCell>}
                    <TableCell sx={{ width: "10%" }}>Titre</TableCell>
                    <TableCell sx={{ width: "10%" }}>Création</TableCell>
                    <TableCell sx={{ width: "10%" }} align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </StyledTableHead>
                <TableBody>
                  {contactsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdminOrManager ? 9 : 8} align="center" sx={{ py: 5 }}>
                        <Box textAlign="center">
                          <PeopleIcon
                            sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }}
                          />
                          <Typography variant="h6" color="textSecondary" gutterBottom>
                            Aucun contact trouvé
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
                            Créer un contact
                          </GradientButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    contactsList.map((contact) => (
                      <StyledTableRow
                        key={contact.id}
                        onDoubleClick={() => handleViewDetails(contact)}
                        onContextMenu={(e) => handleContextMenu(e, contact.id)}
                      >
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar
                              sx={{
                                width: 36,
                                height: 36,
                                bgcolor: alpha(THEME.primary, 0.1),
                                color: THEME.primary,
                                fontSize: "0.875rem",
                                fontWeight: 600,
                              }}
                            >
                              {getInitials(contact.first_name, contact.last_name)}
                            </Avatar>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {contact.first_name} {contact.last_name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <EmailIcon
                              sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6), flexShrink: 0 }}
                            />
                            <Typography variant="caption" noWrap>
                              {contact.email}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <PhoneIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }} />
                              <Typography variant="caption" noWrap>
                                {contact.phone}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="textSecondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        {/* ✅ Localisation dans le tableau */}
                        <TableCell>
                          {contact.city || contact.country ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <LocationOnIcon
                                sx={{
                                  fontSize: 14,
                                  color: alpha(THEME.primary, 0.6),
                                  flexShrink: 0,
                                }}
                              />
                              <Typography variant="caption" noWrap>
                                {[contact.city, contact.country].filter(Boolean).join(", ")}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="textSecondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.account ? (
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <BusinessIcon
                                sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }}
                              />
                              <Typography variant="body2" noWrap>
                                {contact.account.name}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="textSecondary">
                              Indépendant
                            </Typography>
                          )}
                        </TableCell>
                        {isAdminOrManager && (
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <PersonOutlineIcon
                                sx={{
                                  fontSize: 14,
                                  color: alpha(THEME.primary, 0.6),
                                  flexShrink: 0,
                                }}
                              />
                              {contact.assigned_to_name ? (
                                <Chip
                                  label={contact.assigned_to_name}
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
                        <TableCell>
                          <Typography variant="caption" noWrap>
                            {contact.title || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <CalendarIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="caption">
                              {formatDate(contact.created_at)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box display="flex" justifyContent="center" gap={0.5}>
                            {[
                              {
                                icon: <VisibilityIcon sx={{ fontSize: 18 }} />,
                                color: "#0288d1",
                                title: "Voir",
                                fn: () => handleViewDetails(contact),
                              },
                              {
                                icon: <EditIcon sx={{ fontSize: 18 }} />,
                                color: "#1976d2",
                                title: "Modifier",
                                fn: () => handleEdit(contact),
                              },
                              {
                                icon: <DeleteIcon sx={{ fontSize: 18 }} />,
                                color: THEME.primary,
                                title: "Supprimer",
                                fn: () => handleDeleteClick(contact.id),
                              },
                            ].map((btn) => (
                              <Tooltip key={btn.title} title={btn.title}>
                                <IconButton
                                  size="small"
                                  onClick={btn.fn}
                                  sx={{
                                    color: btn.color,
                                    bgcolor: alpha(btn.color, 0.1),
                                    width: 32,
                                    height: 32,
                                  }}
                                >
                                  {btn.icon}
                                </IconButton>
                              </Tooltip>
                            ))}
                          </Box>
                        </TableCell>
                      </StyledTableRow>
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
              {contactsList.map((contact) => (
                <Grid item xs={12} sm={6} md={4} key={contact.id}>
                  <StyledCard onDoubleClick={() => handleViewDetails(contact)}>
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
                          {getInitials(contact.first_name, contact.last_name)}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h6" fontWeight={600} noWrap>
                            {contact.first_name} {contact.last_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            {contact.title || "Sans titre"}
                          </Typography>
                        </Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1.5}>
                        {contact.email && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <EmailIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="body2" noWrap>
                              {contact.email}
                            </Typography>
                          </Box>
                        )}
                        {contact.phone && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <PhoneIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="body2">{contact.phone}</Typography>
                          </Box>
                        )}
                        {/* ✅ Localisation dans la vue cartes */}
                        {(contact.city || contact.country) && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationOnIcon
                              sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }}
                            />
                            <Typography variant="body2">
                              {[contact.city, contact.country].filter(Boolean).join(", ")}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" alignItems="center" gap={1}>
                          <BusinessIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                          <Typography variant="body2" noWrap>
                            {contact.account?.name || "Indépendant"}
                          </Typography>
                        </Box>
                        {isAdminOrManager && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <PersonOutlineIcon
                              sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }}
                            />
                            <Typography
                              variant="body2"
                              color={contact.assigned_to_name ? "textPrimary" : "textSecondary"}
                            >
                              {contact.assigned_to_name
                                ? `Assigné à : ${contact.assigned_to_name}`
                                : "Non assigné"}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                          <Typography variant="body2">{formatDate(contact.created_at)}</Typography>
                        </Box>
                      </Stack>
                      <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                        {[
                          {
                            icon: <VisibilityIcon fontSize="small" />,
                            color: "#0288d1",
                            fn: () => handleViewDetails(contact),
                          },
                          {
                            icon: <EditIcon fontSize="small" />,
                            color: "#1976d2",
                            fn: () => handleEdit(contact),
                          },
                          {
                            icon: <DeleteIcon fontSize="small" />,
                            color: THEME.primary,
                            fn: () => handleDeleteClick(contact.id),
                          },
                        ].map((b, i) => (
                          <IconButton
                            key={i}
                            size="small"
                            onClick={b.fn}
                            sx={{ color: b.color, bgcolor: alpha(b.color, 0.1) }}
                          >
                            {b.icon}
                          </IconButton>
                        ))}
                      </Box>
                    </CardContent>
                  </StyledCard>
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
          open={contextMenu !== null}
          onClose={handleContextMenuClose}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
          }
          PaperProps={{ sx: { borderRadius: 3, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" } }}
        >
          {[
            {
              icon: <VisibilityIcon fontSize="small" sx={{ color: "#0288d1" }} />,
              label: "Voir détails",
              fn: () => {
                const c = contactsList.find((x) => x.id === contextContactId);
                if (c) handleViewDetails(c);
              },
            },
            {
              icon: <EditIcon fontSize="small" sx={{ color: "#1976d2" }} />,
              label: "Modifier",
              fn: () => {
                const c = contactsList.find((x) => x.id === contextContactId);
                if (c) handleEdit(c);
              },
            },
          ].map((item) => (
            <MenuItem
              key={item.label}
              onClick={() => {
                item.fn();
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
              if (contextContactId) handleDeleteClick(contextContactId);
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

        {/* Drawer Formulaire */}
        <Drawer
          anchor="right"
          open={showForm}
          onClose={resetForm}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 600 },
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
                {isEditing ? "Modifier le contact" : "Nouveau contact"}
              </Typography>
              <IconButton onClick={resetForm} sx={{ bgcolor: alpha(THEME.primary, 0.1) }}>
                <CloseIcon sx={{ color: THEME.primary }} />
              </IconButton>
            </Box>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                      Identité
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Prénom"
                          value={contactData.first_name}
                          required
                          onChange={(e) =>
                            setContactData({ ...contactData, first_name: e.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Nom"
                          value={contactData.last_name}
                          required
                          onChange={(e) =>
                            setContactData({ ...contactData, last_name: e.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Titre / Fonction"
                          value={contactData.title}
                          onChange={(e) =>
                            setContactData({ ...contactData, title: e.target.value })
                          }
                        />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                      Coordonnées
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Email"
                          type="email"
                          value={contactData.email}
                          required
                          onChange={(e) =>
                            setContactData({ ...contactData, email: e.target.value })
                          }
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Téléphone"
                          value={contactData.phone}
                          onChange={(e) =>
                            setContactData({ ...contactData, phone: e.target.value })
                          }
                        />
                      </Grid>
                      {/* ✅ Champs Ville et Pays */}
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Ville"
                          value={contactData.city || ""}
                          onChange={(e) => setContactData({ ...contactData, city: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Pays"
                          value={contactData.country || ""}
                          onChange={(e) =>
                            setContactData({ ...contactData, country: e.target.value })
                          }
                        />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                      Société
                    </Typography>
                    <Autocomplete
                      options={accounts}
                      getOptionLabel={(o) => o.name || ""}
                      value={selectedAccount}
                      onChange={(e, val) => setSelectedAccount(val)}
                      size="small"
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Sélectionner une société" />
                      )}
                    />
                  </Card>
                </Grid>
              </Grid>
              <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end", gap: 2 }}>
                <Button
                  onClick={resetForm}
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
                <GradientButton type="submit" sx={{ px: 4, py: 1.5 }}>
                  {isEditing ? "Mettre à jour" : "Créer le contact"}
                </GradientButton>
              </Box>
            </form>
          </Box>
        </Drawer>

        {/* Drawer Filtres */}
        <Drawer
          anchor="right"
          open={showFilters}
          onClose={() => setShowFilters(false)}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 400 },
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
              sx={{ bgcolor: alpha(THEME.primary, 0.1) }}
            >
              <CloseIcon sx={{ color: THEME.primary }} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <Autocomplete
                options={accounts}
                getOptionLabel={(o) => o.name || ""}
                value={accounts.find((a) => a.id === localFilters.account) || null}
                onChange={(e, val) => setLocalFilters({ ...localFilters, account: val?.id })}
                size="small"
                renderInput={(params) => <TextField {...params} label="Société" />}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Date début"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={localFilters.date_from || ""}
                onChange={(e) => setLocalFilters({ ...localFilters, date_from: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Date fin"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={localFilters.date_to || ""}
                onChange={(e) => setLocalFilters({ ...localFilters, date_to: e.target.value })}
              />
            </Grid>
          </Grid>
          <Box mt={4} display="flex" gap={2} justifyContent="space-between">
            <Button
              onClick={() => {
                setLocalFilters({});
                setApiFilters({});
                setShowFilters(false);
              }}
              variant="outlined"
              sx={{ borderRadius: 3, borderColor: alpha(THEME.primary, 0.3), color: THEME.primary }}
            >
              Réinitialiser
            </Button>
            <Box display="flex" gap={1}>
              <Button
                onClick={() => setShowFilters(false)}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderColor: alpha(THEME.primary, 0.3),
                  color: THEME.primary,
                }}
              >
                Annuler
              </Button>
              <GradientButton
                onClick={() => {
                  setApiFilters(localFilters);
                  setShowFilters(false);
                }}
                sx={{ borderRadius: 3 }}
              >
                Appliquer
              </GradientButton>
            </Box>
          </Box>
        </Drawer>

        <ContactDetailsDrawer
          open={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          contact={selectedContact}
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
              Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est irréversible.
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
