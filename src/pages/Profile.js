/* eslint-disable prettier/prettier */
// src/pages/Profile.jsx — v4 — Horizontal Tabs, Red CRM Theme
import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import {
  Grid,
  TextField,
  IconButton,
  Button,
  Avatar,
  Typography,
  Box,
  Chip,
  Stack,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Skeleton,
  Container,
  CircularProgress,
  Badge,
} from "@mui/material";
import {
  Edit as EditIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  LinkedIn as LinkedInIcon,
  Business as BusinessIcon,
  LocationCity as LocationCityIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  CreditCard as CreditCardIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as ContentCopyIcon,
  PhotoCamera as PhotoCameraIcon,
  PersonAdd as PersonAddIcon,
  Shield as ShieldIcon,
  ManageAccounts as ManageAccountsIcon,
  Verified as VerifiedIcon,
  Email as EmailIcon,
  CheckCircle as CheckCircleIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { alpha, styled, keyframes } from "@mui/material/styles";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../pages/superadmin/Marketingwidgets";

const MEDIA_URL = "/";
const API_BASE = "/api/users";

// â”TNDâ”TNDâ”TND PALETTE â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
const R = {
  50: "#fff1f1",
  100: "#ffe4e4",
  200: "#fecaca",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
  800: "#991b1b",
  900: "#7f1d1d",
  grad: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
  gradSoft: "linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #7f1d1d 100%)",
};
const N = {
  0: "#ffffff",
  50: "#fafafa",
  100: "#f5f5f5",
  200: "#e5e5e5",
  300: "#d4d4d4",
  400: "#a3a3a3",
  500: "#737373",
  600: "#525252",
  700: "#404040",
  800: "#262626",
};

// â”TNDâ”TNDâ”TND KEYFRAMES â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
const fadeUp = keyframes`
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0);    }
`;
const slideIn = keyframes`
  from { opacity:0; transform:translateX(-8px); }
  to   { opacity:1; transform:translateX(0);    }
`;

// â”TNDâ”TNDâ”TND STYLED COMPONENTS â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND

/* Hero banner at top */
const HeroBanner = styled(Box)(() => ({
  background: "#fff",
  borderRadius: "20px",
  border: `1px solid ${N[200]}`,
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
  padding: "28px 32px 24px",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: "0 auto 0 0",
    width: 5,
    background: R.grad,
  },
  "&::after": {
    content: '""',
    position: "absolute",
    top: -80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: alpha(R[600], 0.05),
  },
}));

/* Horizontal tab bar */
const TabBar = styled(Box)(() => ({
  background: "#fff",
  border: `1px solid ${N[200]}`,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  padding: 6,
  gap: 4,
  marginTop: 18,
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
  overflowX: "auto",
  "&::-webkit-scrollbar": { display: "none" },
}));

const TabItem = styled(Box)(({ active }) => ({
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "14px 18px",
  cursor: "pointer",
  position: "relative",
  whiteSpace: "nowrap",
  transition: "all 0.18s",
  borderRadius: 12,
  background: active ? alpha(R[600], 0.09) : "transparent",
  "& .ti-icon": {
    fontSize: 16,
    color: active ? R[600] : N[400],
    transition: "color 0.18s",
  },
  "& .ti-label": {
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? R[700] : N[500],
    transition: "color 0.18s",
  },
  "&:hover .ti-icon": { color: active ? R[600] : N[600] },
  "&:hover .ti-label": { color: active ? R[700] : N[600] },
}));

/* Content area */
const PanelBody = styled(Box)(() => ({
  background: "#fff",
  border: `1px solid ${N[200]}`,
  borderRadius: 20,
  padding: "28px",
  minHeight: 0,
  marginTop: 18,
  animation: `${fadeUp} 0.22s ease`,
}));

/* Info field card */
const FieldCard = styled(Box)(() => ({
  background: "#fff",
  border: `1px solid ${N[200]}`,
  borderRadius: 14,
  padding: "14px 20px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  transition: "border-color 0.15s, box-shadow 0.15s",
  "&:hover": {
    borderColor: alpha(R[600], 0.22),
    boxShadow: `0 2px 10px ${alpha(R[600], 0.05)}`,
  },
}));

const IconBox = styled(Box)(({ bcolor }) => ({
  width: 38,
  height: 38,
  borderRadius: 10,
  background: alpha(bcolor || R[600], 0.09),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}));

const PrimaryBtn = styled(Button)(() => ({
  background: R.grad,
  color: "#fff",
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 700,
  fontSize: 13,
  padding: "8px 20px",
  boxShadow: `0 3px 10px ${alpha(R[600], 0.28)}`,
  "&:hover": {
    background: R.gradSoft,
    boxShadow: `0 5px 16px ${alpha(R[600], 0.38)}`,
    transform: "translateY(-1px)",
  },
  "&:disabled": { background: N[300], boxShadow: "none", color: "#fff" },
  transition: "all 0.18s",
}));

const GhostBtn = styled(Button)(({ bcolor }) => ({
  border: `1.5px solid ${alpha(bcolor || R[600], 0.3)}`,
  color: bcolor || R[600],
  background: "transparent",
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 600,
  fontSize: 13,
  padding: "7px 18px",
  "&:hover": {
    background: alpha(bcolor || R[600], 0.05),
    borderColor: bcolor || R[600],
  },
  transition: "all 0.15s",
}));

const MemberCard = styled(Box)(() => ({
  background: "#fff",
  border: `1px solid ${N[200]}`,
  borderRadius: 14,
  padding: "14px 18px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  transition: "all 0.15s",
  cursor: "pointer",
  "&:hover": {
    borderColor: alpha(R[600], 0.22),
    transform: "translateY(-1px)",
    boxShadow: `0 4px 16px ${alpha(R[600], 0.07)}`,
  },
}));

const StatPill = styled(Box)(({ color }) => ({
  flex: 1,
  textAlign: "center",
  padding: "14px 10px",
  borderRadius: 14,
  background: alpha(color, 0.07),
  border: `1px solid ${alpha(color, 0.14)}`,
}));

const SectionDivider = ({ label }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, my: 2.5 }}>
    <Box sx={{ flex: 1, height: "1px", bgcolor: N[200] }} />
    <Typography
      sx={{
        fontSize: 10,
        fontWeight: 700,
        color: N[400],
        textTransform: "uppercase",
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Typography>
    <Box sx={{ flex: 1, height: "1px", bgcolor: N[200] }} />
  </Box>
);
SectionDivider.propTypes = { label: PropTypes.string.isRequired };

const EmptyState = ({ icon, title, sub, action }) => (
  <Box sx={{ textAlign: "center", py: 6 }}>
    <Box
      sx={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        bgcolor: N[100],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        mx: "auto",
        mb: 2,
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: 28, color: N[300] } })}
    </Box>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color: N[500], mb: 0.5 }}>{title}</Typography>
    {sub && <Typography sx={{ fontSize: 13, color: N[400], mb: 2.5 }}>{sub}</Typography>}
    {action}
  </Box>
);
EmptyState.propTypes = {
  icon: PropTypes.element.isRequired,
  title: PropTypes.string.isRequired,
  sub: PropTypes.string,
  action: PropTypes.node,
};
EmptyState.defaultProps = { sub: null, action: null };

// â”TNDâ”TNDâ”TND ROLE CONFIG â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
const roleConfig = {
  ADMIN: { label: "Administrateur", color: R[600], icon: <ShieldIcon />, grad: R.grad },
  MANAGER: {
    label: "Manager",
    color: "#d97706",
    icon: <ManageAccountsIcon />,
    grad: "linear-gradient(135deg,#d97706,#92400e)",
  },
  COMMERCIAL: {
    label: "Commercial",
    color: "#059669",
    icon: <VerifiedIcon />,
    grad: "linear-gradient(135deg,#059669,#064e3b)",
  },
};

const options = {
  countries: ["Tunisie", "France", "USA", "Canada", "Belgique", "Maroc", "Algérie", "Suisse"],
  industries: [
    "Tech",
    "Finance",
    "Marketing",
    "Services",
    "Consulting",
    "E-commerce",
    "Industrie",
    "Santé",
  ],
};

function buildTabs(role) {
  const t = [{ id: "info", label: "Profil", icon: <PersonIcon /> }];
  if (role === "ADMIN") {
    t.push({ id: "company", label: "Entreprise", icon: <BusinessIcon /> });
    t.push({ id: "teams", label: "Equipes", icon: <GroupIcon /> });
  } else {
    t.push({ id: "teams", label: "Mon équipe", icon: <GroupIcon /> });
  }
  t.push({ id: "security", label: "Sécurité", icon: <LockIcon /> });
  return t;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function Profile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const fileInput = useRef(null);
  useTrackActivity("profile");

  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("info");
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [invitationLink, setInvitationLink] = useState("");
  const [currentPlan, setCurrentPlan] = useState("free");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [openCompanyEdit, setOpenCompanyEdit] = useState(false);
  const [openCreateTeam, setOpenCreateTeam] = useState(false);
  const [openInviteMember, setOpenInviteMember] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    phone_number: "",
    country: "",
    city: "",
    job_title: "",
    linkedin_url: "",
  });
  const [formEdit, setFormEdit] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    industry: "",
    number_of_employees: "",
    phone_number: "",
    founded_year: "",
    country: "",
    city: "",
  });
  const [teamForm, setTeamForm] = useState({ name: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "COMMERCIAL", team_id: null });
  const [pwdData, setPwdData] = useState({ old: "", new: "", confirm: "" });
  const [pwdEdit, setPwdEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const show = (msg, sev = "success") => setSnackbar({ open: true, message: msg, severity: sev });
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (!token) {
      navigate("/sign-in");
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const { data: u } = await axios.get(`${API_BASE}/me/`, auth);
      setUser(u);
      setFormData({
        username: u.username || "",
        phone_number: u.phone_number || "",
        country: u.country || "",
        city: u.city || "",
        job_title: u.job_title || "",
        linkedin_url: u.linkedin_url || "",
      });
      if (u.company?.id) {
        setCompany(u.company);
        setCompanyForm(u.company);
      }
      if (u.teams?.length > 0) {
        setTeams(u.teams);
        setSelectedTeam(u.teams[0]);
        fetchTeamMembers(u.teams[0].id);
      }
      try {
        const sub = await axios.get(`${MEDIA_URL}/api/subscriptions/current/`, auth);
        setCurrentPlan(sub.data.plan || "free");
      } catch (_) {}
    } catch (err) {
      show("Erreur lors du chargement", "error");
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/sign-in");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (id) => {
    try {
      const { data } = await axios.get(`${API_BASE}/teams/${id}/members/`, auth);
      setMembers(data);
    } catch {
      setMembers([]);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("profile_picture", file);
      await axios.put(`${API_BASE}/me/`, fd, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      show("Photo mise à jour !");
      fetchAll();
    } catch {
      show("Erreur upload photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getAvatarUrl = () => {
    if (!user?.profile_picture) return null;
    return user.profile_picture.startsWith("http")
      ? user.profile_picture
      : `${MEDIA_URL}${user.profile_picture}`;
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/me/`, formData, auth);
      show("Profil mis à jour !");
      setFormEdit(false);
      fetchAll();
    } catch {
      show("Erreur mise à jour", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (pwdData.new !== pwdData.confirm) {
      show("Mots de passe différents", "error");
      return;
    }
    setSaving(true);
    try {
      await axios.put(
        `${API_BASE}/change_password/`,
        { old_password: pwdData.old, new_password: pwdData.new },
        auth
      );
      show("Mot de passe changé !");
      setPwdData({ old: "", new: "", confirm: "" });
      setPwdEdit(false);
    } catch {
      show("Erreur changement", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCompany = async () => {
    try {
      await axios.put(`${API_BASE}/company/update/`, companyForm, auth);
      show("Entreprise mise à jour !");
      setOpenCompanyEdit(false);
      fetchAll();
    } catch {
      show("Erreur mise à jour", "error");
    }
  };

  const handleCreateTeam = async () => {
    if (!company?.id) {
      show("Entreprise introuvable", "error");
      return;
    }
    try {
      const { data } = await axios.post(
        `${API_BASE}/teams/`,
        { name: teamForm.name, company: company.id },
        auth
      );
      setTeams([...teams, data]);
      setSelectedTeam(data);
      show("Equipe créée !");
      setOpenCreateTeam(false);
      setTeamForm({ name: "" });
    } catch {
      show("Erreur création équipe", "error");
    }
  };

  const handleInviteMember = async () => {
    if (!selectedTeam) {
      show("Sélectionnez une équipe", "error");
      return;
    }
    try {
      const { data } = await axios.post(
        `${API_BASE}/invite-member/`,
        { email: inviteForm.email, team_id: selectedTeam.id, role: inviteForm.role },
        auth
      );
      setInvitationLink(`${window.location.origin}/accept-invite/${data.token}`);
      show("Invitation envoyée !");
      setOpenInviteMember(false);
      setInviteForm({ email: "", role: "COMMERCIAL", team_id: null });
    } catch {
      show("Erreur invitation", "error");
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !selectedTeam) return;
    try {
      await axios.post(
        `${API_BASE}/teams/${selectedTeam.id}/remove_member/`,
        { user_id: selectedMember.id },
        auth
      );
      setMembers(members.filter((m) => m.id !== selectedMember.id));
      show("Membre retiré");
      setAnchorEl(null);
      setSelectedMember(null);
    } catch {
      show("Erreur suppression", "error");
    }
  };

  // â”TNDâ”TND LOADING â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
  if (loading)
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Box
            sx={{
              borderRadius: "20px",
              overflow: "hidden",
              border: `1px solid ${N[200]}`,
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            <Skeleton variant="rectangular" height={160} />
            <Box
              sx={{
                display: "flex",
                gap: 0,
                bgcolor: "#fff",
                px: 3,
                borderBottom: `1px solid ${N[200]}`,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="text" width={90} height={52} sx={{ mr: 2 }} />
              ))}
            </Box>
            <Box sx={{ bgcolor: N[50], p: 4 }}>
              <Skeleton variant="rounded" height={28} width={220} sx={{ mb: 1 }} />
              <Skeleton variant="rounded" height={14} width={300} sx={{ mb: 4 }} />
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rounded" height={66} sx={{ mb: 1.5, borderRadius: 2 }} />
              ))}
            </Box>
          </Box>
        </Container>
      </DashboardLayout>
    );

  if (!user)
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            Utilisateur non trouvé
          </Alert>
        </Container>
      </DashboardLayout>
    );

  const role = user.role;
  const rc = roleConfig[role] || { label: role, color: N[500], grad: N[400], icon: <PersonIcon /> };
  const tabs = buildTabs(role);

  // â”TNDâ”TNDâ”TND PANEL RENDERER â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
  const renderPanel = () => {
    // â•â• PROFIL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (activeTab === "info")
      return (
        <Box key="info" sx={{ animation: `${fadeUp} 0.22s ease` }}>
          {/* Stats row */}
          <Stack direction="row" spacing={1.5} mb={3.5}>
            <StatPill color={R[600]}>
              <Typography sx={{ fontSize: 26, fontWeight: 900, color: R[600], lineHeight: 1 }}>
                {teams.length}
              </Typography>
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: N[400],
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  mt: 0.4,
                }}
              >
                Equipes
              </Typography>
            </StatPill>
            <StatPill color="#2563eb">
              <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#2563eb", lineHeight: 1 }}>
                {members.length}
              </Typography>
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: N[400],
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  mt: 0.4,
                }}
              >
                Collègues
              </Typography>
            </StatPill>
            {role === "ADMIN" && (
              <StatPill color="#059669">
                <Typography
                  sx={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#059669",
                    lineHeight: 1,
                    textTransform: "capitalize",
                  }}
                >
                  {currentPlan}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: N[400],
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    mt: 0.4,
                  }}
                >
                  Plan actif
                </Typography>
              </StatPill>
            )}
          </Stack>

          {/* Fields */}
          <Grid container spacing={1.5} mb={3}>
            {[
              { icon: <WorkIcon />, label: "Poste", field: "job_title", color: R[600], xs: 6 },
              {
                icon: <PhoneIcon />,
                label: "Téléphone",
                field: "phone_number",
                color: "#2563eb",
                xs: 6,
              },
              {
                icon: <EmailIcon />,
                label: "Email",
                value: user.email,
                color: "#7c3aed",
                xs: 12,
                ro: true,
              },
              {
                icon: <LocationCityIcon />,
                label: "Ville",
                field: "city",
                color: "#059669",
                xs: 6,
              },
              { icon: <BusinessIcon />, label: "Pays", field: "country", color: "#d97706", xs: 6 },
              {
                icon: <LinkedInIcon />,
                label: "LinkedIn",
                field: "linkedin_url",
                color: "#0077b5",
                xs: 12,
              },
            ].map(({ icon, label, field, value, color, xs, ro }) => (
              <Grid item xs={xs} key={label}>
                <FieldCard>
                  <IconBox bcolor={color}>
                    {React.cloneElement(icon, { sx: { fontSize: 17, color } })}
                  </IconBox>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: N[400],
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        mb: 0.3,
                      }}
                    >
                      {label}
                    </Typography>
                    {formEdit && !ro ? (
                      <TextField
                        variant="standard"
                        fullWidth
                        size="small"
                        value={formData[field] || ""}
                        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                        sx={{
                          "& .MuiInput-root": { fontSize: 13, fontWeight: 500 },
                          "& .MuiInput-underline:after": { borderBottomColor: R[600] },
                        }}
                      />
                    ) : (
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: value || formData[field] ? N[700] : N[300],
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {value || formData[field] || "Non renseigné"}
                      </Typography>
                    )}
                  </Box>
                  {ro && (
                    <Chip
                      label="Auto"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        bgcolor: alpha(color, 0.08),
                        color,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </FieldCard>
              </Grid>
            ))}
          </Grid>

          <Stack direction="row" spacing={1.5}>
            {formEdit ? (
              <>
                <PrimaryBtn
                  onClick={handleSaveProfile}
                  disabled={saving}
                  startIcon={
                    saving ? (
                      <CircularProgress size={13} sx={{ color: "#fff" }} />
                    ) : (
                      <SaveIcon sx={{ fontSize: 16 }} />
                    )
                  }
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </PrimaryBtn>
                <GhostBtn onClick={() => setFormEdit(false)}>Annuler</GhostBtn>
              </>
            ) : (
              <PrimaryBtn
                startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                onClick={() => setFormEdit(true)}
              >
                Modifier le profil
              </PrimaryBtn>
            )}
          </Stack>
        </Box>
      );

    // â•â• SECURITE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (activeTab === "security")
      return (
        <Box key="security" sx={{ animation: `${fadeUp} 0.22s ease`, maxWidth: 600 }}>
          {/* Status */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2.5,
              borderRadius: 14,
              bgcolor: alpha(R[600], 0.04),
              border: `1px solid ${alpha(R[600], 0.13)}`,
              mb: 3,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: R.grad,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldIcon sx={{ color: "#fff", fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: N[800] }}>
                Compte sécurisé
              </Typography>
              <Typography sx={{ fontSize: 12, color: N[400] }}>
                Votre session est active et protégée
              </Typography>
            </Box>
            <Chip
              label="Actif"
              size="small"
              sx={{
                bgcolor: alpha("#059669", 0.1),
                color: "#059669",
                fontWeight: 700,
                fontSize: 11,
                border: `1px solid ${alpha("#059669", 0.18)}`,
              }}
            />
          </Box>

          <SectionDivider label="Mot de passe" />

          {pwdEdit ? (
            <Stack spacing={2}>
              {[
                { label: "Mot de passe actuel", field: "old" },
                { label: "Nouveau mot de passe", field: "new" },
                { label: "Confirmer", field: "confirm" },
              ].map(({ label, field }) => (
                <TextField
                  key={field}
                  fullWidth
                  label={label}
                  type="password"
                  size="small"
                  value={pwdData[field]}
                  onChange={(e) => setPwdData({ ...pwdData, [field]: e.target.value })}
                  error={
                    field === "confirm" && pwdData.new !== pwdData.confirm && pwdData.confirm !== ""
                  }
                  helperText={
                    field === "confirm" && pwdData.new !== pwdData.confirm && pwdData.confirm !== ""
                      ? "Les mots de passe ne correspondent pas"
                      : ""
                  }
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: 2 },
                    "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: R[600] },
                    "& label.Mui-focused": { color: R[600] },
                  }}
                />
              ))}
              {pwdData.new && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography sx={{ fontSize: 11, color: N[400] }}>Force</Typography>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                          pwdData.new.length < 6
                            ? R[600]
                            : pwdData.new.length < 10
                            ? "#d97706"
                            : "#059669",
                      }}
                    >
                      {pwdData.new.length < 6
                        ? "Faible"
                        : pwdData.new.length < 10
                        ? "Moyen"
                        : "Fort"}
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 4, borderRadius: 2, bgcolor: N[200], overflow: "hidden" }}>
                    <Box
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        transition: "width 0.4s,background 0.3s",
                        width: `${Math.min(100, (pwdData.new.length / 12) * 100)}%`,
                        background:
                          pwdData.new.length < 6
                            ? R[600]
                            : pwdData.new.length < 10
                            ? "#d97706"
                            : "#059669",
                      }}
                    />
                  </Box>
                </Box>
              )}
              <Stack direction="row" spacing={1.5} mt={0.5}>
                <PrimaryBtn onClick={handleChangePassword} disabled={saving}>
                  {saving ? "Enregistrement..." : "Changer le mot de passe"}
                </PrimaryBtn>
                <GhostBtn
                  onClick={() => {
                    setPwdEdit(false);
                    setPwdData({ old: "", new: "", confirm: "" });
                  }}
                >
                  Annuler
                </GhostBtn>
              </Stack>
            </Stack>
          ) : (
            <FieldCard>
              <IconBox bcolor={R[600]}>
                <LockIcon sx={{ fontSize: 17, color: R[600] }} />
              </IconBox>
              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: N[400],
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    mb: 0.3,
                  }}
                >
                  Mot de passe
                </Typography>
                <Typography sx={{ fontSize: 14, color: N[300], letterSpacing: 3 }}>
                  ••••••••••
                </Typography>
              </Box>
              <GhostBtn
                size="small"
                startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                onClick={() => setPwdEdit(true)}
              >
                Modifier
              </GhostBtn>
            </FieldCard>
          )}

          {role === "ADMIN" && (
            <>
              <SectionDivider label="Abonnement" />
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 14,
                  background: R.gradSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      bgcolor: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CreditCardIcon sx={{ color: "#fff", fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                        textTransform: "capitalize",
                      }}
                    >
                      Plan {currentPlan}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
                      Gérer votre abonnement
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  onClick={() => navigate("/subscriptions")}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.18)",
                    color: "#fff",
                    borderRadius: 8,
                    textTransform: "none",
                    fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.28)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  Gérer
                </Button>
              </Box>
            </>
          )}
        </Box>
      );

    // â•â• ENTREPRISE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (activeTab === "company")
      return (
        <Box key="company" sx={{ animation: `${fadeUp} 0.22s ease` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: N[800] }}>
                Informations de l&apos;organisation
              </Typography>
              <Typography sx={{ fontSize: 13, color: N[400] }}>
                Données de votre entreprise
              </Typography>
            </Box>
            {company && (
              <PrimaryBtn
                size="small"
                startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                onClick={() => setOpenCompanyEdit(true)}
              >
                Modifier
              </PrimaryBtn>
            )}
          </Stack>

          {company ? (
            <>
              {/* Company hero card */}
              <Box
                sx={{
                  p: 3,
                  borderRadius: 18,
                  background: `linear-gradient(135deg,${alpha(R[600], 0.05)},${alpha(
                    R[600],
                    0.01
                  )})`,
                  border: `1px solid ${alpha(R[600], 0.12)}`,
                  mb: 3,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2.5}>
                  <Avatar
                    sx={{
                      width: 64,
                      height: 64,
                      background: R.grad,
                      fontSize: 26,
                      fontWeight: 900,
                      borderRadius: 16,
                      flexShrink: 0,
                    }}
                  >
                    {company.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, color: N[800], mb: 0.8 }}>
                      {company.name}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {company.industry && (
                        <Chip
                          label={company.industry}
                          size="small"
                          sx={{
                            bgcolor: alpha(R[600], 0.08),
                            color: R[700],
                            fontWeight: 600,
                            fontSize: 11,
                            border: `1px solid ${alpha(R[600], 0.14)}`,
                          }}
                        />
                      )}
                      {company.founded_year && (
                        <Chip
                          label={`Fondée en ${company.founded_year}`}
                          size="small"
                          sx={{ bgcolor: N[100], color: N[500], fontSize: 11 }}
                        />
                      )}
                      {company.number_of_employees && (
                        <Chip
                          label={`${company.number_of_employees} employés`}
                          size="small"
                          sx={{ bgcolor: alpha("#2563eb", 0.07), color: "#2563eb", fontSize: 11 }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>

              <Grid container spacing={1.5}>
                {[
                  {
                    icon: <PhoneIcon />,
                    label: "Téléphone",
                    value: company.phone_number,
                    color: R[600],
                    xs: 6,
                  },
                  {
                    icon: <LocationCityIcon />,
                    label: "Ville",
                    value: company.city,
                    color: "#059669",
                    xs: 6,
                  },
                  {
                    icon: <BusinessIcon />,
                    label: "Pays",
                    value: company.country,
                    color: "#d97706",
                    xs: 6,
                  },
                ].map(({ icon, label, value, color, xs }) => (
                  <Grid item xs={xs} key={label}>
                    <FieldCard>
                      <IconBox bcolor={color}>
                        {React.cloneElement(icon, { sx: { fontSize: 17, color } })}
                      </IconBox>
                      <Box>
                        <Typography
                          sx={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: N[400],
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                            mb: 0.2,
                          }}
                        >
                          {label}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 13, fontWeight: 500, color: value ? N[700] : N[300] }}
                        >
                          {value || "Non renseigné"}
                        </Typography>
                      </Box>
                    </FieldCard>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <EmptyState
              icon={<BusinessIcon />}
              title="Aucune entreprise associée"
              sub="Complétez votre profil pour associer votre entreprise"
              action={
                <PrimaryBtn onClick={() => navigate("/complete-profile")}>
                  Compléter mon profil
                </PrimaryBtn>
              }
            />
          )}
        </Box>
      );

    // â•â• EQUIPES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (activeTab === "teams")
      return (
        <Box key="teams" sx={{ animation: `${fadeUp} 0.22s ease` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: N[800] }}>
                {role === "ADMIN" ? "Gestion des équipes" : "Mon équipe"}
              </Typography>
              <Typography sx={{ fontSize: 13, color: N[400] }}>
                {role === "ADMIN"
                  ? "Créez et gérez vos équipes commerciales"
                  : "Vos collègues et leurs rôles"}
              </Typography>
            </Box>
            {role === "ADMIN" && company && (
              <PrimaryBtn
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                onClick={() => setOpenCreateTeam(true)}
              >
                Nouvelle équipe
              </PrimaryBtn>
            )}
          </Stack>

          {teams.length > 1 && role === "ADMIN" && (
            <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
              <InputLabel sx={{ "&.Mui-focused": { color: R[600] } }}>
                Equipe sélectionnée
              </InputLabel>
              <Select
                value={selectedTeam?.id || ""}
                label="Equipe sélectionnée"
                sx={{
                  borderRadius: 2,
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: R[600] },
                }}
                onChange={(e) => {
                  const t = teams.find((x) => x.id === e.target.value);
                  if (t) {
                    setSelectedTeam(t);
                    fetchTeamMembers(t.id);
                  }
                }}
              >
                {teams.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 22, height: 22, fontSize: 11, background: R.grad }}>
                        {t.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <span>{t.name}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {selectedTeam ? (
            <>
              {/* Team header */}
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 14,
                  background: `linear-gradient(135deg,${alpha(R[600], 0.05)},${alpha(
                    R[600],
                    0.01
                  )})`,
                  border: `1px solid ${alpha(R[600], 0.12)}`,
                  mb: 2.5,
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        background: R.grad,
                        fontSize: 18,
                        fontWeight: 900,
                        borderRadius: 13,
                      }}
                    >
                      {selectedTeam.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: N[800] }}>
                        {selectedTeam.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: N[400] }}>
                        {members.length} membre{members.length > 1 ? "s" : ""}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    {role === "ADMIN" && (
                      <PrimaryBtn
                        size="small"
                        startIcon={<PersonAddIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          setInviteForm({ ...inviteForm, team_id: selectedTeam.id });
                          setOpenInviteMember(true);
                        }}
                      >
                        Inviter
                      </PrimaryBtn>
                    )}
                    <IconButton
                      size="small"
                      onClick={async () => {
                        await fetchTeamMembers(selectedTeam.id);
                        show("Actualisé");
                      }}
                      sx={{ bgcolor: N[100], borderRadius: 2 }}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>

              {members.length > 0 ? (
                <Grid container spacing={1.5}>
                  {members.map((m) => {
                    const mc =
                      m.role === "ADMIN" ? R[600] : m.role === "MANAGER" ? "#d97706" : "#059669";
                    return (
                      <Grid item xs={12} sm={6} key={m.id}>
                        <MemberCard
                          onClick={
                            role === "ADMIN"
                              ? (e) => {
                                  setAnchorEl(e.currentTarget);
                                  setSelectedMember(m);
                                }
                              : undefined
                          }
                          sx={{ cursor: role === "ADMIN" ? "pointer" : "default" }}
                        >
                          <Avatar
                            sx={{
                              width: 42,
                              height: 42,
                              bgcolor: alpha(mc, 0.13),
                              color: mc,
                              fontWeight: 800,
                              fontSize: 16,
                            }}
                          >
                            {m.username?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" spacing={0.8}>
                              <Typography
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: N[700],
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {m.username}
                              </Typography>
                              {m.id === user.id && (
                                <Chip
                                  label="Vous"
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: "0.65rem",
                                    bgcolor: alpha(R[600], 0.08),
                                    color: R[600],
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </Stack>
                            <Typography
                              sx={{
                                fontSize: 11,
                                color: N[400],
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {m.email}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              bgcolor: alpha(mc, 0.08),
                              border: `1px solid ${alpha(mc, 0.18)}`,
                              borderRadius: 8,
                              px: 1.2,
                              py: 0.4,
                              flexShrink: 0,
                            }}
                          >
                            {roleConfig[m.role]?.icon &&
                              React.cloneElement(roleConfig[m.role].icon, {
                                sx: { fontSize: 11, color: mc },
                              })}
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: mc }}>
                              {roleConfig[m.role]?.label || m.role}
                            </Typography>
                          </Box>
                          {role === "ADMIN" && m.id !== user.id && (
                            <MoreVertIcon sx={{ fontSize: 17, color: N[300], flexShrink: 0 }} />
                          )}
                        </MemberCard>
                      </Grid>
                    );
                  })}
                </Grid>
              ) : (
                <EmptyState
                  icon={<PersonAddIcon />}
                  title="Aucun membre"
                  sub="Invitez des collaborateurs à rejoindre cette équipe"
                  action={
                    role === "ADMIN" && (
                      <PrimaryBtn
                        size="small"
                        startIcon={<PersonAddIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          setInviteForm({ ...inviteForm, team_id: selectedTeam?.id });
                          setOpenInviteMember(true);
                        }}
                      >
                        Inviter un membre
                      </PrimaryBtn>
                    )
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={<GroupIcon />}
              title="Aucune équipe"
              sub="Créez votre première équipe commerciale"
              action={
                company && (
                  <PrimaryBtn
                    startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                    onClick={() => setOpenCreateTeam(true)}
                  >
                    Créer une équipe
                  </PrimaryBtn>
                )
              }
            />
          )}
        </Box>
      );

    return null;
  };

  // â”TNDâ”TNDâ”TND RENDER â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container className="profile-page" maxWidth="xl" sx={{ py: 3 }}>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 30, fontWeight: 900, color: N[800], lineHeight: 1.15 }}>
            Profil
          </Typography>
          <Typography sx={{ mt: 0.6, color: N[500], fontSize: 14 }}>
            Gérez vos informations personnelles et les paramètres de votre compte.
          </Typography>
        </Box>

        <Box>
          {/* â”TNDâ”TND HERO BANNER â”TNDâ”TND */}
          <HeroBanner className="profile-hero">
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
              sx={{ position: "relative", zIndex: 1 }}
            >
              {/* Left: avatar + info */}
              <Stack direction="row" alignItems="center" spacing={2.5}>
                <Box sx={{ position: "relative" }}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInput}
                    style={{ display: "none" }}
                    onChange={handlePhotoUpload}
                  />
                  <Avatar
                    className="profile-avatar"
                    src={getAvatarUrl()}
                    sx={{
                      width: 76,
                      height: 76,
                      border: `4px solid ${R[100]}`,
                      bgcolor: R[600],
                      color: "#fff",
                      fontSize: 28,
                      fontWeight: 900,
                    }}
                  >
                    {user.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Tooltip title="Changer la photo">
                    <IconButton
                      size="small"
                      onClick={() => fileInput.current?.click()}
                      sx={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        bgcolor: "#fff",
                        width: 24,
                        height: 24,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
                        "&:hover": { bgcolor: R[50] },
                      }}
                    >
                      {uploadingPhoto ? (
                        <CircularProgress size={11} sx={{ color: R[600] }} />
                      ) : (
                        <PhotoCameraIcon sx={{ fontSize: 12, color: R[600] }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box>
                  <Typography
                    sx={{ fontSize: 22, fontWeight: 900, color: N[800], lineHeight: 1.1, mb: 0.5 }}
                  >
                    {user.username}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: N[500],
                      mb: 1,
                      wordBreak: "break-all",
                    }}
                  >
                    {user.email}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.8}>
                    <Box
                      className="crm-badge"
                      sx={{ bgcolor: R[50], color: R[800], border: `1px solid ${R[100]}` }}
                    >
                      <CheckCircleIcon sx={{ fontSize: 14 }} />
                      Compte actif
                    </Box>
                    <Box
                      className="crm-badge"
                      sx={{ bgcolor: N[50], color: N[700], border: `1px solid ${N[200]}` }}
                    >
                      CRM User
                    </Box>
                    <Box
                      className="crm-badge"
                      sx={{ bgcolor: N[50], color: N[700], border: `1px solid ${N[200]}` }}
                    >
                      {rc.icon &&
                        React.cloneElement(rc.icon, { sx: { fontSize: 13, color: R[600] } })}
                      {rc.label}
                    </Box>
                  </Stack>
                </Box>
              </Stack>

              {/* Right: quick stats */}
              <Stack direction="row" spacing={1.5}>
                {[
                  { val: teams.length, lbl: "Equipes", color: "rgba(255,255,255,0.2)" },
                  { val: members.length, lbl: "Collègues", color: "rgba(255,255,255,0.15)" },
                ].map((s) => (
                  <Box
                    key={s.lbl}
                    sx={{
                      textAlign: "center",
                      px: 2.5,
                      py: 1.5,
                      bgcolor: R[50],
                      border: `1px solid ${R[100]}`,
                      borderRadius: 14,
                    }}
                  >
                    <Typography
                      sx={{ fontSize: 24, fontWeight: 900, color: R[800], lineHeight: 1 }}
                    >
                      {s.val}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: N[500],
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0,
                        mt: 0.3,
                      }}
                    >
                      {s.lbl}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </HeroBanner>

          {/* â”TNDâ”TND HORIZONTAL TAB BAR â”TNDâ”TND */}
          <TabBar>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TabItem
                  key={tab.id}
                  active={isActive ? 1 : 0}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Box className="ti-icon">
                    {React.cloneElement(tab.icon, {
                      sx: { fontSize: 16, color: isActive ? R[600] : N[400] },
                    })}
                  </Box>
                  <Typography className="ti-label">{tab.label}</Typography>
                </TabItem>
              );
            })}
          </TabBar>

          {/* â”TNDâ”TND PANEL BODY â”TNDâ”TND */}
          <PanelBody className="profile-card" key={activeTab}>
            {renderPanel()}
          </PanelBody>
        </Box>

        {/* â•â• DIALOGS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

        {/* Entreprise */}
        {role === "ADMIN" && (
          <Dialog
            open={openCompanyEdit}
            onClose={() => setOpenCompanyEdit(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 4 } }}
          >
            <DialogTitle sx={{ borderBottom: `1px solid ${N[200]}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
                    Modifier l&apos;entreprise
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: N[400] }}>
                    Mettez à jour les informations
                  </Typography>
                </Box>
                <IconButton onClick={() => setOpenCompanyEdit(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nom"
                    value={companyForm.name || ""}
                    size="small"
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Secteur</InputLabel>
                    <Select
                      value={companyForm.industry || ""}
                      label="Secteur"
                      sx={{ borderRadius: 2 }}
                      onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    >
                      {options.industries.map((i) => (
                        <MenuItem key={i} value={i}>
                          {i}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Effectif"
                    type="number"
                    size="small"
                    value={companyForm.number_of_employees || ""}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, number_of_employees: e.target.value })
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    size="small"
                    value={companyForm.phone_number || ""}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, phone_number: e.target.value })
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Année fondation"
                    type="number"
                    size="small"
                    value={companyForm.founded_year || ""}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, founded_year: e.target.value })
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Pays</InputLabel>
                    <Select
                      value={companyForm.country || ""}
                      label="Pays"
                      sx={{ borderRadius: 2 }}
                      onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                    >
                      {options.countries.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Ville"
                    size="small"
                    value={companyForm.city || ""}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
              <GhostBtn onClick={() => setOpenCompanyEdit(false)}>Annuler</GhostBtn>
              <PrimaryBtn onClick={handleUpdateCompany}>Enregistrer</PrimaryBtn>
            </DialogActions>
          </Dialog>
        )}

        {/* Créer équipe */}
        {role === "ADMIN" && (
          <Dialog
            open={openCreateTeam}
            onClose={() => setOpenCreateTeam(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{ sx: { borderRadius: 4 } }}
          >
            <DialogTitle sx={{ borderBottom: `1px solid ${N[200]}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Créer une équipe</Typography>
                <IconButton onClick={() => setOpenCreateTeam(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <TextField
                fullWidth
                label="Nom de l'équipe"
                value={teamForm.name}
                size="small"
                onChange={(e) => setTeamForm({ name: e.target.value })}
                placeholder="Ex: Equipe Paris, Equipe Sud..."
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
              <GhostBtn onClick={() => setOpenCreateTeam(false)}>Annuler</GhostBtn>
              <PrimaryBtn onClick={handleCreateTeam} disabled={!teamForm.name}>
                Créer
              </PrimaryBtn>
            </DialogActions>
          </Dialog>
        )}

        {/* Inviter membre */}
        {role === "ADMIN" && (
          <Dialog
            open={openInviteMember}
            onClose={() => setOpenInviteMember(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 4 } }}
          >
            <DialogTitle sx={{ borderBottom: `1px solid ${N[200]}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 17 }}>Inviter un membre</Typography>
                  <Typography sx={{ fontSize: 12, color: N[400] }}>
                    Un lien d&apos;invitation sera généré
                  </Typography>
                </Box>
                <IconButton onClick={() => setOpenInviteMember(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Adresse email *"
                    size="small"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Rôle attribué</InputLabel>
                    <Select
                      value={inviteForm.role}
                      label="Rôle attribué"
                      sx={{ borderRadius: 2 }}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    >
                      <MenuItem value="ADMIN">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ShieldIcon sx={{ fontSize: 14, color: R[600] }} />
                          <span>Administrateur</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="MANAGER">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ManageAccountsIcon sx={{ fontSize: 14, color: "#d97706" }} />
                          <span>Manager</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="COMMERCIAL">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <VerifiedIcon sx={{ fontSize: 14, color: "#059669" }} />
                          <span>Commercial</span>
                        </Stack>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              {invitationLink && (
                <Box
                  sx={{
                    mt: 2.5,
                    p: 2,
                    bgcolor: alpha("#059669", 0.04),
                    borderRadius: 2,
                    border: `1px solid ${alpha("#059669", 0.18)}`,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.8} mb={1}>
                    <CheckCircleIcon sx={{ fontSize: 14, color: "#059669" }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>
                      Invitation créée avec succès
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <TextField
                      size="small"
                      fullWidth
                      value={invitationLink}
                      InputProps={{ readOnly: true, sx: { borderRadius: 2, fontSize: 12 } }}
                    />
                    <Tooltip title="Copier">
                      <IconButton
                        onClick={() => {
                          navigator.clipboard.writeText(invitationLink);
                          show("Lien copié !");
                        }}
                        size="small"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
              <GhostBtn onClick={() => setOpenInviteMember(false)}>Annuler</GhostBtn>
              <PrimaryBtn onClick={handleInviteMember} disabled={!inviteForm.email}>
                Envoyer l&apos;invitation
              </PrimaryBtn>
            </DialogActions>
          </Dialog>
        )}

        {/* Menu membre */}
        {role === "ADMIN" && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => {
              setAnchorEl(null);
              setSelectedMember(null);
            }}
            PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" } }}
          >
            {selectedMember && selectedMember.id !== user.id && (
              <MenuItem onClick={handleRemoveMember} sx={{ color: "#ef4444", gap: 1.5 }}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" sx={{ color: "#ef4444" }} />
                </ListItemIcon>
                <ListItemText>Retirer de l&apos;équipe</ListItemText>
              </MenuItem>
            )}
          </Menu>
        )}
      </Container>
    </DashboardLayout>
  );
}
