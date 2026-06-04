/* eslint-disable prettier/prettier */
// src/pages/modules/ProspectCompanies.jsx — pagination BACKEND
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";
import {
  Grid,
  TextField,
  MenuItem,
  Card,
  CardContent,
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
  Fade,
  alpha,
  Paper,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Sort as SortIcon,
  ViewColumn as ViewColumnIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Language as LanguageIcon,
  LinkedIn as LinkedInIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LocationOn as LocationIcon,
  Work as WorkIcon,
  AttachMoney as MoneyIcon,
  Group as GroupIcon,
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
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ==============================
// THEME
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
  "& .MuiTable-root": { borderCollapse: "separate", borderSpacing: "0 8px", padding: "0 8px" },
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
  backgroundColor: "#ffffff",
  borderRadius: 12,
  boxShadow: `0 2px 8px ${alpha("#000", 0.02)}`,
  transition: "all 0.2s",
  "&:hover": {
    backgroundColor: alpha(THEME.primary, 0.02),
    boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.1)}`,
    transform: "scale(1.001)",
  },
  "& td:first-of-type": { borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingLeft: 16 },
  "& td:last-of-type": { borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingRight: 16 },
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
const formatRevenue = (revenue) => {
  if (!revenue) return "-";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(revenue);
};
const getInitials = (name) => name?.charAt(0).toUpperCase() || "?";

const SOURCE_CONFIG = {
  commercial: { label: "Commercial", color: "#1976d2", icon: "person" },
  agent_prospection: { label: "Agent de prospection", color: "#7b1fa2", icon: "smart_toy" },
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

// ==============================
// COMPANY DETAILS DRAWER
// ==============================
const CompanyDetailsDrawer = ({ open, onClose, company }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (company?.id && open) {
      setLoading(true);
      api
        .get(`/prospects/?prospect_company=${company.id}`)
        .then((res) => {
          const data = res.data;
          setProspects(Array.isArray(data) ? data : data?.results || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [company, open]);
  if (!company) return null;

  const hasSocials =
    company.website || company.facebook_url || company.instagram_url || company.linkedin_url;

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
            Détails de l&apos;entreprise
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
                width: 80,
                height: 80,
                background: THEME.gradient,
                fontSize: "2rem",
                fontWeight: 600,
                boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
              }}
            >
              {getInitials(company.name)}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {company.name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {company.industry || "Secteur non spécifié"}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mt={0.5}>
                {company.source && <SourceBadge source={company.source} />}
                <Chip
                  label={`Créée le ${new Date(company.created_at).toLocaleDateString("fr-FR")}`}
                  size="small"
                  sx={{ bgcolor: alpha(THEME.info, 0.1), color: THEME.info, borderRadius: 1 }}
                />
              </Box>
            </Box>
          </Box>
        </Paper>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            mb: 3,
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.9rem" },
            "& .Mui-selected": { color: THEME.primary },
            "& .MuiTabs-indicator": { backgroundColor: THEME.primary },
          }}
        >
          <Tab label="Informations" />
          <Tab label={`Prospects (${prospects.length})`} />
        </Tabs>
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
                <Stack spacing={1.5}>
                  {company.email && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <EmailIcon sx={{ fontSize: 20, color: THEME.primary }} />
                      <Typography variant="body2">{company.email}</Typography>
                    </Box>
                  )}
                  {company.phone && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <PhoneIcon sx={{ fontSize: 20, color: THEME.primary }} />
                      <Typography variant="body2">{company.phone}</Typography>
                    </Box>
                  )}
                  {(company.city || company.country) && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocationIcon sx={{ fontSize: 20, color: THEME.primary }} />
                      <Typography variant="body2">
                        {[company.city, company.country].filter(Boolean).join(", ")}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Card>
            </Grid>
            {hasSocials && (
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                  >
                    Présence en ligne
                  </Typography>
                  <Stack spacing={1}>
                    <SocialLink
                      href={company.website}
                      icon={LanguageIcon}
                      label="Site web"
                      color="#1976d2"
                    />
                    <SocialLink
                      href={company.linkedin_url}
                      icon={LinkedInIcon}
                      label="LinkedIn"
                      color="#0077b5"
                    />
                    <SocialLink
                      href={company.facebook_url}
                      icon={FacebookIcon}
                      label="Facebook"
                      color="#1877f2"
                    />
                    <SocialLink
                      href={company.instagram_url}
                      icon={InstagramIcon}
                      label="Instagram"
                      color="#e1306c"
                    />
                  </Stack>
                </Card>
              </Grid>
            )}
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                >
                  Informations commerciales
                </Typography>
                <Stack spacing={1.5}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Secteur
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {company.industry || "-"}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="textSecondary">
                      Source
                    </Typography>
                    {company.source ? (
                      <SourceBadge source={company.source} />
                    ) : (
                      <Typography variant="body2">-</Typography>
                    )}
                  </Box>
                </Stack>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                >
                  Adresse
                </Typography>
                <Stack spacing={1.5}>
                  {company.address && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocationIcon sx={{ fontSize: 20, color: THEME.primary }} />
                      <Typography variant="body2">{company.address}</Typography>
                    </Box>
                  )}
                  {(company.city || company.country) && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                      <Typography variant="body2">
                        {[company.city, company.country].filter(Boolean).join(", ")}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Card>
            </Grid>
          </Grid>
        )}
        {activeTab === 1 && (
          <Stack spacing={2}>
            {loading ? (
              <Box textAlign="center" py={4}>
                <CircularProgress size={30} sx={{ color: THEME.primary }} />
              </Box>
            ) : prospects.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography color="textSecondary">Aucun prospect associé</Typography>
              </Box>
            ) : (
              prospects.map((prospect) => (
                <Card key={prospect.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: alpha(THEME.primary, 0.1), color: THEME.primary }}>
                      {prospect.first_name?.[0]}
                      {prospect.last_name?.[0]}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {prospect.first_name} {prospect.last_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {prospect.title || "Sans titre"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Chip
                        label={prospect.status}
                        size="small"
                        sx={{ bgcolor: alpha(THEME.info, 0.1), color: THEME.info }}
                      />
                      {prospect.source && <SourceBadge source={prospect.source} />}
                    </Stack>
                  </Box>
                </Card>
              ))
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};
CompanyDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  company: PropTypes.object,
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function ProspectCompanies() {
  const navigate = useNavigate();
  useTrackActivity("campaigns");

  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [apiFilters, setApiFilters] = useState({});
  const [localFilters, setLocalFilters] = useState({});
  const [sortBy, setSortBy] = useState("-created_at");
  const [viewMode, setViewMode] = useState("table");

  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    phone: "",
    email: "",
    number_of_employees: "",
    annual_revenue: "",
    city: "",
    country: "",
    address: "",
    website: "",
    source: "",
  });
  const [contextMenu, setContextMenu] = useState(null);
  const [contextCompanyId, setContextCompanyId] = useState(null);

  // ── Pagination backend ──────────────────────────────────────
  const hookFilters = useMemo(() => {
    const f = { ordering: sortBy };
    if (searchTerm) f.search = searchTerm;
    if (apiFilters.industry) f.industry = apiFilters.industry;
    if (apiFilters.country) f.country = apiFilters.country;
    if (apiFilters.source) f.source = apiFilters.source;
    if (apiFilters.date_from) f.created_at__gte = apiFilters.date_from;
    if (apiFilters.date_to) f.created_at__lte = apiFilters.date_to;
    return f;
  }, [searchTerm, apiFilters, sortBy]);

  const {
    data: companiesList,
    loading,
    total,
    pages,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: setHookFilters,
    refresh,
  } = usePaginatedList("/prospect-companies/", 10);

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
      localStorage.setItem("user", JSON.stringify(res.data));
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/sign-in");
      }
    }
  };

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const industries = {};
    const countries = {};
    companiesList.forEach((company) => {
      if (company.industry) industries[company.industry] = (industries[company.industry] || 0) + 1;
      if (company.country) countries[company.country] = (countries[company.country] || 0) + 1;
    });
    return {
      total,
      withEmail: companiesList.filter((c) => c.email).length,
      withPhone: companiesList.filter((c) => c.phone).length,
      totalEmployees: companiesList.reduce((s, c) => s + (c.number_of_employees || 0), 0),
      topIndustries: Object.entries(industries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
      topCountries: Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    };
  }, [companiesList, total]);

  // ── Handlers ──
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleEdit = (company) => {
    setFormData({
      name: company.name || "",
      industry: company.industry || "",
      phone: company.phone || "",
      email: company.email || "",
      number_of_employees: company.number_of_employees || "",
      annual_revenue: company.annual_revenue || "",
      city: company.city || "",
      country: company.country || "",
      address: company.address || "",
      website: company.website || "",
      source: company.source || "",
    });
    setSelectedCompanyId(company.id);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.name) {
        showNotification("Le nom de l'entreprise est obligatoire", "error");
        return;
      }
      const payload = {
        ...formData,
        source: isEditing ? formData.source : "commercial",
        number_of_employees: formData.number_of_employees
          ? parseInt(formData.number_of_employees)
          : null,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
      };
      if (isEditing && selectedCompanyId) {
        await api.put(`/prospect-companies/${selectedCompanyId}/`, payload);
        showNotification("Entreprise modifiée avec succès", "success");
      } else {
        await api.post("/prospect-companies/", payload);
        showNotification("Entreprise créée avec succès", "success");
      }
      resetForm();
      refresh();
    } catch (err) {
      console.error("Erreur:", err);
      showNotification("Erreur lors de l'enregistrement", "error");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      industry: "",
      phone: "",
      email: "",
      number_of_employees: "",
      annual_revenue: "",
      city: "",
      country: "",
      address: "",
      website: "",
      source: "",
    });
    setIsEditing(false);
    setSelectedCompanyId(null);
    setShowForm(false);
  };
  const handleDeleteClick = (id) => {
    setCompanyToDelete(id);
    setDeleteDialogOpen(true);
  };
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCompanyToDelete(null);
  };
  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/prospect-companies/${companyToDelete}/`);
      showNotification("Entreprise supprimée", "success");
      refresh();
      handleDeleteCancel();
    } catch {
      showNotification("Erreur lors de la suppression", "error");
    }
  };
  const handleViewDetails = (company) => {
    setSelectedCompany(company);
    setDetailsDrawerOpen(true);
  };
  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setContextMenu(contextMenu === null ? { mouseX: e.clientX + 2, mouseY: e.clientY - 6 } : null);
    setContextCompanyId(id);
  };
  const handleContextMenuClose = () => {
    setContextMenu(null);
    setContextCompanyId(null);
  };

  const exportToCSV = () => {
    const headers = [
      "Nom",
      "Secteur",
      "Email",
      "Téléphone",
      "Site web",
      "Ville",
      "Pays",
      "Date création",
    ];
    const data = companiesList.map((c) => [
      c.name,
      c.industry || "",
      c.email || "",
      c.phone || "",
      c.website || "",
      c.city || "",
      c.country || "",
      new Date(c.created_at).toLocaleDateString("fr-FR"),
    ]);
    const csv = [headers.join(","), ...data.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `entreprises_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Valeurs uniques pour les filtres (extraites de la page courante)
  const industries = useMemo(
    () => [...new Set(companiesList.map((c) => c.industry).filter(Boolean))].sort(),
    [companiesList]
  );
  const countries = useMemo(
    () => [...new Set(companiesList.map((c) => c.country).filter(Boolean))].sort(),
    [companiesList]
  );

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
            <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
              Chargement des données...
            </Typography>
          </Box>
        </Backdrop>

        <Collapse in={!!message.text}>
          <Alert
            severity={message.type}
            sx={{ mb: 2, borderRadius: 3, boxShadow: `0 4px 12px ${alpha("#000", 0.1)}` }}
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
              Gestion des entreprises prospectées
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {total} entreprise(s) au total
            </Typography>
          </Box>
          <GradientButton
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Nouvelle entreprise
          </GradientButton>
        </Box>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="textSecondary" gutterBottom>
                      Total entreprises
                    </Typography>
                    <Typography variant="h4" sx={{ color: THEME.primary, fontWeight: 700 }}>
                      {total}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      bgcolor: alpha(THEME.primary, 0.1),
                      color: THEME.primary,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <BusinessIcon />
                  </Avatar>
                </Box>
                <Box mt={2} display="flex" gap={1}>
                  <Chip
                    size="small"
                    label={`${stats.withEmail} emails`}
                    sx={{
                      bgcolor: alpha(THEME.success, 0.1),
                      color: THEME.success,
                      borderRadius: 1,
                    }}
                  />
                  <Chip
                    size="small"
                    label={`${stats.withPhone} tél.`}
                    sx={{ bgcolor: alpha(THEME.info, 0.1), color: THEME.info, borderRadius: 1 }}
                  />
                </Box>
              </CardContent>
            </StatsCard>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: alpha(THEME.warning, 0.1),
                      color: THEME.warning,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <GroupIcon />
                  </Avatar>
                </Box>
                <Box mt={2}>
                  <Typography variant="caption" color="textSecondary">
                    Moy.{" "}
                    {stats.totalEmployees && total ? Math.round(stats.totalEmployees / total) : 0}{" "}
                    employés
                  </Typography>
                </Box>
              </CardContent>
            </StatsCard>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: alpha(THEME.success, 0.1),
                      color: THEME.success,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <MoneyIcon />
                  </Avatar>
                </Box>
                <Box mt={2}>
                  <Typography variant="caption" color="textSecondary">
                    Page courante : {companiesList.length} ent.
                  </Typography>
                </Box>
              </CardContent>
            </StatsCard>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="textSecondary" gutterBottom>
                      Top secteurs
                    </Typography>
                    <Box mt={1}>
                      {stats.topIndustries.map(([ind, count]) => (
                        <Chip
                          key={ind}
                          size="small"
                          label={`${ind} (${count})`}
                          sx={{
                            m: 0.5,
                            bgcolor: alpha(THEME.primary, 0.1),
                            color: THEME.primary,
                            borderRadius: 1,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </StatsCard>
          </Grid>
        </Grid>

        {/* Barre de recherche */}
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Rechercher une entreprise..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      bgcolor: alpha(THEME.primary, 0.02),
                      "&:hover": { bgcolor: alpha(THEME.primary, 0.04) },
                    },
                  }}
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
                  <ButtonGroup variant="outlined" size="small" sx={{ borderRadius: 3 }}>
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
                  <FormControl size="small" sx={{ minWidth: 150 }}>
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
                      <MenuItem value="name">Nom A→Z</MenuItem>
                      <MenuItem value="-name">Nom Z→A</MenuItem>
                      <MenuItem value="industry">Secteur</MenuItem>
                      <MenuItem value="city">Ville</MenuItem>
                    </Select>
                  </FormControl>
                  <Badge
                    color="error"
                    badgeContent={Object.keys(apiFilters).length}
                    invisible={Object.keys(apiFilters).length === 0}
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

            {/* Filtres actifs */}
            {Object.keys(apiFilters).length > 0 && (
              <Box mt={2} display="flex" gap={0.5} flexWrap="wrap">
                {apiFilters.industry && (
                  <Chip
                    label={`Secteur: ${apiFilters.industry}`}
                    size="small"
                    onDelete={() => {
                      const f = { ...apiFilters };
                      delete f.industry;
                      setApiFilters(f);
                    }}
                    sx={{
                      bgcolor: alpha(THEME.primary, 0.1),
                      color: THEME.primary,
                      borderRadius: 1,
                    }}
                  />
                )}
                {apiFilters.country && (
                  <Chip
                    label={`Pays: ${apiFilters.country}`}
                    size="small"
                    onDelete={() => {
                      const f = { ...apiFilters };
                      delete f.country;
                      setApiFilters(f);
                    }}
                    sx={{
                      bgcolor: alpha(THEME.primary, 0.1),
                      color: THEME.primary,
                      borderRadius: 1,
                    }}
                  />
                )}
                {apiFilters.source && (
                  <Chip
                    label={`Source: ${SOURCE_CONFIG[apiFilters.source]?.label || apiFilters.source}`}
                    size="small"
                    onDelete={() => {
                      const f = { ...apiFilters };
                      delete f.source;
                      setApiFilters(f);
                    }}
                    sx={{
                      bgcolor: alpha(THEME.primary, 0.1),
                      color: THEME.primary,
                      borderRadius: 1,
                    }}
                  />
                )}
                <Chip
                  label="Effacer tout"
                  size="small"
                  onClick={() => setApiFilters({})}
                  sx={{
                    bgcolor: THEME.primary,
                    color: "white",
                    borderRadius: 1,
                    cursor: "pointer",
                    "&:hover": { bgcolor: THEME.primaryDark },
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
                    <TableCell sx={{ width: "18%" }}>Entreprise</TableCell>
                    <TableCell sx={{ width: "12%" }}>Secteur</TableCell>
                    <TableCell sx={{ width: "12%" }}>Contact</TableCell>
                    <TableCell sx={{ width: "10%" }}>Localisation</TableCell>
                    <TableCell sx={{ width: "10%" }}>Création</TableCell>
                    <TableCell sx={{ width: "8%" }} align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </StyledTableHead>
                <TableBody>
                  {companiesList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                        <Box textAlign="center">
                          <BusinessIcon
                            sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }}
                          />
                          <Typography variant="h6" color="textSecondary" gutterBottom>
                            Aucune entreprise trouvée
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
                            Créer une entreprise
                          </GradientButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    companiesList.map((company) => (
                      <StyledTableRow
                        key={company.id}
                        onDoubleClick={() => handleViewDetails(company)}
                        onContextMenu={(e) => handleContextMenu(e, company.id)}
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
                              {getInitials(company.name)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {company.name}
                              </Typography>
                              {company.website && (
                                <Typography variant="caption" color="textSecondary" noWrap>
                                  {company.website}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {company.industry || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.5}>
                            {company.email && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <EmailIcon
                                  sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }}
                                />
                                <Typography variant="caption" noWrap>
                                  {company.email}
                                </Typography>
                              </Box>
                            )}
                            {company.phone && (
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <PhoneIcon
                                  sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }}
                                />
                                <Typography variant="caption" noWrap>
                                  {company.phone}
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <LocationIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="body2" noWrap>
                              {[company.city, company.country].filter(Boolean).join(", ") || "-"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <CalendarIcon sx={{ fontSize: 14, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="caption">
                              {new Date(company.created_at).toLocaleDateString("fr-FR")}
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
                                fn: () => handleViewDetails(company),
                              },
                              {
                                icon: <EditIcon sx={{ fontSize: 18 }} />,
                                color: "#1976d2",
                                title: "Modifier",
                                fn: () => handleEdit(company),
                              },
                              {
                                icon: <DeleteIcon sx={{ fontSize: 18 }} />,
                                color: THEME.primary,
                                title: "Supprimer",
                                fn: () => handleDeleteClick(company.id),
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
            {/* ✅ PaginationBar backend */}
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
              {companiesList.map((company) => (
                <Grid item xs={12} sm={6} md={4} key={company.id}>
                  <StyledCard onDoubleClick={() => handleViewDetails(company)}>
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
                          {getInitials(company.name)}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h6" fontWeight={600} noWrap>
                            {company.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            {company.industry || "Secteur non spécifié"}
                          </Typography>
                        </Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1.5}>
                        {company.email && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <EmailIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="body2" noWrap>
                              {company.email}
                            </Typography>
                          </Box>
                        )}
                        {company.phone && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <PhoneIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="body2">{company.phone}</Typography>
                          </Box>
                        )}
                        {(company.city || company.country) && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                            <Typography variant="body2" noWrap>
                              {[company.city, company.country].filter(Boolean).join(", ")}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
                          <Typography variant="body2">
                            Créée le {new Date(company.created_at).toLocaleDateString("fr-FR")}
                          </Typography>
                        </Box>
                      </Stack>
                      <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                        {[
                          {
                            icon: <VisibilityIcon fontSize="small" />,
                            color: "#0288d1",
                            fn: () => handleViewDetails(company),
                          },
                          {
                            icon: <EditIcon fontSize="small" />,
                            color: "#1976d2",
                            fn: () => handleEdit(company),
                          },
                          {
                            icon: <DeleteIcon fontSize="small" />,
                            color: THEME.primary,
                            fn: () => handleDeleteClick(company.id),
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
          <MenuItem
            onClick={() => {
              const c = companiesList.find((x) => x.id === contextCompanyId);
              if (c) handleViewDetails(c);
              handleContextMenuClose();
            }}
          >
            <ListItemIcon>
              <VisibilityIcon fontSize="small" sx={{ color: "#0288d1" }} />
            </ListItemIcon>
            <ListItemText>Voir détails</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              const c = companiesList.find((x) => x.id === contextCompanyId);
              if (c) handleEdit(c);
              handleContextMenuClose();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText>Modifier</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              if (contextCompanyId) handleDeleteClick(contextCompanyId);
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
              width: { xs: "100%", sm: 700 },
              background: "#ffffff",
              borderTopLeftRadius: 24,
              borderBottomLeftRadius: 24,
            },
          }}
        >
          <Box sx={{ p: 4, maxHeight: "100vh", overflow: "auto" }}>
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
                {isEditing ? "Modifier l'entreprise" : "Nouvelle entreprise"}
              </Typography>
              <IconButton
                onClick={resetForm}
                sx={{
                  bgcolor: alpha(THEME.primary, 0.1),
                  "&:hover": { bgcolor: alpha(THEME.primary, 0.2) },
                }}
              >
                <CloseIcon sx={{ color: THEME.primary }} />
              </IconButton>
            </Box>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                      Informations de base
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Nom de l'entreprise"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Secteur d'activité"
                          name="industry"
                          value={formData.industry}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Site web"
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                          placeholder="https://www.example.com"
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
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Téléphone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                        />
                      </Grid>
                    </Grid>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                      Informations commerciales
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Nombre d'employés"
                      name="number_of_employees"
                      value={formData.number_of_employees}
                      onChange={handleChange}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                      Adresse
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Adresse"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          multiline
                          rows={2}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Ville"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Pays"
                          name="country"
                          value={formData.country}
                          onChange={handleChange}
                        />
                      </Grid>
                    </Grid>
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
                  {isEditing ? "Mettre à jour" : "Créer l'entreprise"}
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
              sx={{
                bgcolor: alpha(THEME.primary, 0.1),
                "&:hover": { bgcolor: alpha(THEME.primary, 0.2) },
              }}
            >
              <CloseIcon sx={{ color: THEME.primary }} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Secteur</InputLabel>
                <Select
                  value={localFilters.industry || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, industry: e.target.value })}
                  label="Secteur"
                >
                  <MenuItem value="">Tous</MenuItem>
                  {industries.map((ind) => (
                    <MenuItem key={ind} value={ind}>
                      {ind}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Pays</InputLabel>
                <Select
                  value={localFilters.country || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, country: e.target.value })}
                  label="Pays"
                >
                  <MenuItem value="">Tous</MenuItem>
                  {countries.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Source</InputLabel>
                <Select
                  value={localFilters.source || ""}
                  onChange={(e) => setLocalFilters({ ...localFilters, source: e.target.value })}
                  label="Source"
                >
                  <MenuItem value="">Toutes</MenuItem>
                  {Object.entries(SOURCE_CONFIG).map(([value, cfg]) => (
                    <MenuItem key={value} value={value}>
                      {cfg.label}
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

        {/* Drawer Détails */}
        <CompanyDetailsDrawer
          open={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          company={selectedCompany}
        />

        {/* Dialog Suppression */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          PaperProps={{
            sx: { borderRadius: 4, p: 1, boxShadow: `0 8px 24px ${alpha(THEME.primary, 0.2)}` },
          }}
        >
          <DialogTitle sx={{ color: THEME.primary, fontWeight: 600 }}>
            Confirmer la suppression
          </DialogTitle>
          <DialogContent>
            <Typography>
              Êtes-vous sûr de vouloir supprimer cette entreprise ? Cette action est irréversible.
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
