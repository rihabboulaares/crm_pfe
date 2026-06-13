/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminTasks.js
import React, { useEffect, useState } from "react";
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
  Tabs,
  Tab,
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
  CheckCircle,
  Search,
  Timeline,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Event as EventIcon,
  Flag as FlagIcon,
  PriorityHigh as PriorityIcon,
  Assignment as TaskIcon,
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

const StyledChip = styled(Chip)(({ status, priority, type }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
  ...(status === "todo" && {
    background: alpha(THEME.n500, 0.1),
    color: THEME.n500,
    border: `1px solid ${THEME.n500}`,
  }),
  ...(status === "in_progress" && {
    background: alpha(THEME.blue, 0.1),
    color: THEME.blue,
    border: `1px solid ${THEME.blue}`,
  }),
  ...(status === "done" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
  ...(status === "cancelled" && {
    background: alpha(THEME.error, 0.1),
    color: THEME.error,
    border: `1px solid ${THEME.error}`,
  }),
  ...(priority === "high" && {
    background: alpha(THEME.error, 0.1),
    color: THEME.error,
    border: `1px solid ${THEME.error}`,
  }),
  ...(priority === "medium" && {
    background: alpha(THEME.warning, 0.1),
    color: THEME.warning,
    border: `1px solid ${THEME.warning}`,
  }),
  ...(priority === "low" && {
    background: alpha(THEME.success, 0.1),
    color: THEME.success,
    border: `1px solid ${THEME.success}`,
  }),
  ...(type === "quota" && {
    background: alpha(THEME.purple, 0.1),
    color: THEME.purple,
    border: `1px solid ${THEME.purple}`,
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
const STATUS_OPTIONS = ["", "todo", "in_progress", "done", "cancelled"];
const STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};
const PRIORITY_OPTIONS = ["", "low", "medium", "high"];
const PRIORITY_LABELS = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
};
const TASK_TYPE_OPTIONS = ["", "classic", "quota"];
const TASK_TYPE_LABELS = {
  classic: "Classique",
  quota: "Quota",
};
const ACTIVITY_TYPES = ["", "call", "email", "note", "meeting", "status_change"];
const ACTIVITY_LABELS = {
  call: "Appel",
  email: "Email",
  note: "Note",
  meeting: "Meeting",
  status_change: "Changement statut",
};
const ACTIVITY_COLORS = {
  call: { bg: alpha("#2563eb", 0.1), text: "#2563eb" },
  email: { bg: alpha("#059669", 0.1), text: "#059669" },
  note: { bg: alpha("#d97706", 0.1), text: "#d97706" },
  meeting: { bg: alpha("#7c3aed", 0.1), text: "#7c3aed" },
  status_change: { bg: alpha(THEME.primary, 0.1), text: THEME.primary },
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
// COMPOSANT TASK DETAILS DRAWER
// ==============================
const TaskDetailsDrawer = ({ open, onClose, task }) => {
  if (!task) return null;

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
            Détails de la tâche
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
              {task.title?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {task.title}
              </Typography>
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" gap={1}>
                <StyledChip
                  label={STATUS_LABELS[task.status] || task.status}
                  status={task.status}
                  size="small"
                />
                <StyledChip
                  label={PRIORITY_LABELS[task.priority] || task.priority}
                  priority={task.priority}
                  size="small"
                />
                {task.task_type === "quota" && (
                  <StyledChip label="Quota" type="quota" size="small" />
                )}
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
                  <TaskIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">
                    Type : {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                  </Typography>
                </Box>
                {task.company_name && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">Entreprise : {task.company_name}</Typography>
                  </Box>
                )}
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">
                    Assigné à : {task.assigned_to_username || "Non assigné"}
                  </Typography>
                </Box>
                {task.due_date && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <EventIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">
                      Échéance : {new Date(task.due_date).toLocaleDateString("fr-FR")}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          </Grid>

          {task.task_type === "quota" && (
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}
                >
                  Progression du quota
                </Typography>
                <Box>
                  <Typography variant="h4" sx={{ color: THEME.purple, fontWeight: 700 }}>
                    {task.quota_progress || 0}/{task.quota_target || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {Math.round(((task.quota_progress || 0) / (task.quota_target || 1)) * 100)}%
                    complété
                  </Typography>
                </Box>
              </Card>
            </Grid>
          )}
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

TaskDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  task: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    status: PropTypes.string,
    priority: PropTypes.string,
    task_type: PropTypes.string,
    company_name: PropTypes.string,
    assigned_to_username: PropTypes.string,
    due_date: PropTypes.string,
    quota_progress: PropTypes.number,
    quota_target: PropTypes.number,
  }),
};

// ==============================
// COMPOSANT ACTIVITY DETAILS DRAWER
// ==============================
const ActivityDetailsDrawer = ({ open, onClose, activity }) => {
  if (!activity) return null;

  const ac = ACTIVITY_COLORS[activity.activity_type] || { bg: THEME.n100, text: THEME.n500 };

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
            Détails de l&apos;activité
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
                bgcolor: ac.bg,
                color: ac.text,
                fontSize: "1.8rem",
                fontWeight: 600,
              }}
            >
              {activity.activity_type?.[0]?.toUpperCase()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight={700}>
                {ACTIVITY_LABELS[activity.activity_type] || activity.activity_type}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {new Date(activity.created_at).toLocaleDateString("fr-FR")}
              </Typography>
              <Chip
                size="small"
                label={activity.task_title}
                sx={{
                  bgcolor: alpha(THEME.primary, 0.1),
                  color: THEME.primary,
                  borderRadius: 1,
                  mt: 1,
                }}
              />
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
                  <PersonIcon sx={{ fontSize: 20, color: THEME.primary }} />
                  <Typography variant="body2">
                    Effectué par : {activity.performed_by_username || "—"}
                  </Typography>
                </Box>
                {activity.company_name && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <BusinessIcon sx={{ fontSize: 20, color: THEME.primary }} />
                    <Typography variant="body2">Entreprise : {activity.company_name}</Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                Contenu
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: THEME.n100,
                  border: `1px solid ${alpha(THEME.primary, 0.1)}`,
                }}
              >
                <Typography variant="body2">
                  {activity.notes ||
                    activity.email_subject ||
                    activity.call_result ||
                    "Aucune information"}
                </Typography>
              </Paper>
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

ActivityDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  activity: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    activity_type: PropTypes.string,
    task_title: PropTypes.string,
    performed_by_username: PropTypes.string,
    company_name: PropTypes.string,
    notes: PropTypes.string,
    email_subject: PropTypes.string,
    call_result: PropTypes.string,
    created_at: PropTypes.string,
  }),
};

// ==============================
// ONGLET TCHES
// ==============================
function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [backendStats, setBackendStats] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=15`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) params += `&status=${statusFilter}`;
      if (priorityFilter) params += `&priority=${priorityFilter}`;
      if (typeFilter) params += `&task_type=${typeFilter}`;
      const res = await apiGet(`/api/superadmin/tasks/${params}`);
      const data = res.data;
      setTasks(data.results || data);
      const total = data.count || (data.results || data).length;
      setTotalPages(Math.ceil(total / 15));
    } catch (e) {
      console.error("Erreur chargement tâches:", e);
      showNotification("Erreur lors du chargement des tâches", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, priorityFilter, typeFilter]);

  useEffect(() => {
    apiGet("/api/superadmin/tasks/stats/")
      .then((res) => setBackendStats(res.data))
      .catch((e) => console.error("Erreur stats tâches:", e));
  }, []);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleViewDetails = (task) => {
    setSelectedTask(task);
    setDetailsDrawerOpen(true);
  };

  // Statistiques
  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    high: tasks.filter((t) => t.priority === "high").length,
    quota: tasks.filter((t) => t.task_type === "quota").length,
  };
  const displayStats = backendStats
    ? {
        ...stats,
        total: backendStats.total,
        todo: backendStats.todo,
        inProgress: backendStats.in_progress,
        done: backendStats.done,
        high: backendStats.high,
        quota: backendStats.quota,
      }
    : stats;

  return (
    <>
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

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Total tâches"
            value={displayStats.total}
            icon={<TaskIcon />}
            color={THEME.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="À faire"
            value={displayStats.todo}
            icon={<FlagIcon />}
            color={THEME.n500}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="En cours"
            value={displayStats.inProgress}
            icon={<Timeline />}
            color={THEME.blue}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Terminées"
            value={displayStats.done}
            icon={<CheckCircle />}
            color={THEME.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatsCardItem
            title="Haute priorité"
            value={displayStats.high}
            icon={<PriorityIcon />}
            color={THEME.error}
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
                placeholder="Rechercher par titre, entreprise, assigné..."
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
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value);
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
                    <MenuItem value="">Toutes priorités</MenuItem>
                    {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
                      <MenuItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <Select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
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
                    <MenuItem value="">Tous types</MenuItem>
                    {TASK_TYPE_OPTIONS.filter(Boolean).map((t) => (
                      <MenuItem key={t} value={t}>
                        {TASK_TYPE_LABELS[t]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Badge
                  color="error"
                  badgeContent={
                    (statusFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (typeFilter ? 1 : 0)
                  }
                  invisible={!statusFilter && !priorityFilter && !typeFilter}
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
                    onClick={fetchTasks}
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
                <TableCell sx={{ width: 250 }}>Tâche</TableCell>
                <TableCell sx={{ width: 100 }}>Type</TableCell>
                <TableCell sx={{ width: 120 }}>Statut</TableCell>
                <TableCell sx={{ width: 100 }}>Priorité</TableCell>
                <TableCell sx={{ width: 150 }}>Assigné à</TableCell>
                <TableCell sx={{ width: 180 }}>Entreprise</TableCell>
                <TableCell sx={{ width: 100 }}>Échéance</TableCell>
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
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <TaskIcon sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucune tâche trouvée
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <StyledTableRow key={t.id} hover onDoubleClick={() => handleViewDetails(t)}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: alpha(THEME.blue, 0.1),
                            color: THEME.blue,
                          }}
                        >
                          <CheckCircle sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: THEME.n800 }}>
                            {t.title}
                          </Typography>
                          {t.task_type === "quota" && (
                            <Typography variant="caption" sx={{ color: THEME.n500 }}>
                              Quota : {t.quota_progress || 0}/{t.quota_target || 0}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {t.task_type === "quota" ? (
                        <StyledChip size="small" label="Quota" type="quota" />
                      ) : (
                        <Chip
                          size="small"
                          label="Classique"
                          sx={{
                            bgcolor: THEME.n100,
                            color: THEME.n500,
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <StyledChip
                        size="small"
                        label={STATUS_LABELS[t.status] || t.status}
                        status={t.status}
                      />
                    </TableCell>
                    <TableCell>
                      <StyledChip
                        size="small"
                        label={PRIORITY_LABELS[t.priority] || t.priority}
                        priority={t.priority}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: THEME.n500 }}>
                        {t.assigned_to_username || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {t.company_name ? (
                        <Chip
                          size="small"
                          label={t.company_name}
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
                      <Typography
                        variant="caption"
                        sx={{ color: t.due_date ? THEME.n800 : THEME.n500 }}
                      >
                        {t.due_date ? new Date(t.due_date).toLocaleDateString("fr-FR") : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Voir détails">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(t)}
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
              {tasks.length} tâche(s) sur cette page
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
          <InputLabel>Priorité</InputLabel>
          <Select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            label="Priorité"
          >
            <MenuItem value="">Toutes</MenuItem>
            {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
              <MenuItem key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            label="Type"
          >
            <MenuItem value="">Tous</MenuItem>
            {TASK_TYPE_OPTIONS.filter(Boolean).map((t) => (
              <MenuItem key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => {
              setStatusFilter("");
              setPriorityFilter("");
              setTypeFilter("");
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
      <TaskDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        task={selectedTask}
      />
    </>
  );
}

// ==============================
// ONGLET ACTIVITÉS
// ==============================
function ActivitiesTab() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      let params = `?page=${page}&page_size=15`;
      if (search) params += `&search=${encodeURIComponent(search)}`;
      if (typeFilter) params += `&activity_type=${typeFilter}`;
      const res = await apiGet(`/api/superadmin/task-activities/${params}`);
      const data = res.data;
      setActivities(data.results || data);
      const total = data.count || (data.results || data).length;
      setTotalPages(Math.ceil(total / 15));
    } catch (e) {
      console.error("Erreur chargement activités:", e);
      showNotification("Erreur lors du chargement des activités", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, typeFilter]);

  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  const handleViewDetails = (activity) => {
    setSelectedActivity(activity);
    setDetailsDrawerOpen(true);
  };

  // Statistiques par type
  const stats = {
    total: activities.length,
    calls: activities.filter((a) => a.activity_type === "call").length,
    emails: activities.filter((a) => a.activity_type === "email").length,
    notes: activities.filter((a) => a.activity_type === "note").length,
    meetings: activities.filter((a) => a.activity_type === "meeting").length,
  };

  return (
    <>
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

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Total activités"
            value={stats.total}
            icon={<Timeline />}
            color={THEME.primary}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Appels"
            value={stats.calls}
            icon={<Timeline />}
            color={THEME.blue}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Emails"
            value={stats.emails}
            icon={<Timeline />}
            color={THEME.success}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCardItem
            title="Notes"
            value={stats.notes}
            icon={<Timeline />}
            color={THEME.warning}
          />
        </Grid>
      </Grid>

      {/* Filtres */}
      <StyledCard sx={{ mb: 3 }}>
        <Box p={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Rechercher par tâche, utilisateur, entreprise..."
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
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
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
                    <MenuItem value="">Tous les types</MenuItem>
                    {ACTIVITY_TYPES.filter(Boolean).map((t) => (
                      <MenuItem key={t} value={t}>
                        {ACTIVITY_LABELS[t]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Badge color="error" badgeContent={typeFilter ? 1 : 0} invisible={!typeFilter}>
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
                    onClick={fetchActivities}
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
                <TableCell sx={{ width: 100 }}>Type</TableCell>
                <TableCell sx={{ width: 200 }}>Tâche</TableCell>
                <TableCell sx={{ width: 150 }}>Par</TableCell>
                <TableCell sx={{ width: 180 }}>Entreprise</TableCell>
                <TableCell sx={{ width: 250 }}>Notes / Sujet</TableCell>
                <TableCell sx={{ width: 100 }}>Date</TableCell>
                <TableCell sx={{ width: 80 }} align="center">
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
              ) : activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Box textAlign="center">
                      <Timeline sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }} />
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        Aucune activité trouvée
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                activities.map((a) => {
                  const ac = ACTIVITY_COLORS[a.activity_type] || {
                    bg: THEME.n100,
                    text: THEME.n500,
                  };
                  return (
                    <StyledTableRow key={a.id} hover onDoubleClick={() => handleViewDetails(a)}>
                      <TableCell>
                        <Chip
                          size="small"
                          label={ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                          sx={{ bgcolor: ac.bg, color: ac.text, fontWeight: 600, fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: THEME.n800, fontWeight: 500 }}>
                          {a.task_title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: THEME.n500 }}>
                          {a.performed_by_username || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {a.company_name ? (
                          <Chip
                            size="small"
                            label={a.company_name}
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
                        <Typography
                          variant="caption"
                          sx={{
                            color: THEME.n500,
                            maxWidth: 200,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.notes || a.email_subject || a.call_result || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: THEME.n500 }}>
                          {a.created_at ? new Date(a.created_at).toLocaleDateString("fr-FR") : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Voir détails">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(a)}
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
              {activities.length} activité(s) sur cette page
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
          <InputLabel>Type d&apos;activité</InputLabel>
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
              setShowFilters(false);
            }}
            label="Type d'activité"
          >
            <MenuItem value="">Tous</MenuItem>
            {ACTIVITY_TYPES.filter(Boolean).map((t) => (
              <MenuItem key={t} value={t}>
                {ACTIVITY_LABELS[t]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
          <Button
            onClick={() => {
              setTypeFilter("");
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
      <ActivityDetailsDrawer
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        activity={selectedActivity}
      />
    </>
  );
}

// ==============================
// PAGE PRINCIPALE
// ==============================
export default function SuperAdminTasks() {
  const [tab, setTab] = useState(0);

  return (
    <SuperAdminLayout>
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
            Tâches & Activités
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Supervision de toutes les tâches et activités
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(THEME.blue, 0.1), width: 48, height: 48 }}>
          {tab === 0 ? (
            <CheckCircle sx={{ color: THEME.blue }} />
          ) : (
            <Timeline sx={{ color: THEME.blue }} />
          )}
        </Avatar>
      </Box>

      {/* Tabs */}
      <StyledCard sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
              minHeight: 48,
            },
            "& .Mui-selected": {
              color: THEME.primary,
            },
            "& .MuiTabs-indicator": {
              backgroundColor: THEME.primary,
            },
          }}
        >
          <Tab label="Tâches" icon={<CheckCircle sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab label="Activités" icon={<Timeline sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </StyledCard>

      {/* Contenu */}
      {tab === 0 ? <TasksTab /> : <ActivitiesTab />}
    </SuperAdminLayout>
  );
}
