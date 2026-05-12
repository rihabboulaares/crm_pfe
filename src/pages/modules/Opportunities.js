/* eslint-disable prettier/prettier */
// src/pages/modules/Opportunities.jsx
// ✅ Style identique à Prospects et Tasks
// ✅ LIAISON BIDIRECTIONNELLE Opportunity ↔ Pipeline
//   - Changer le stage CRM → met à jour le pipeline automatiquement
//   - Déplacer dans le Kanban → met à jour le stage CRM
//   - Valider des tâches directement depuis le Kanban
//   - Indicateur pipeline_info dans la table des opportunités
//   - Drawer de tâches inline dans le kanban card
//   - Colonne "Stage & Pipeline" fusionnée
//   - Drag & drop kanban restreint aux admins/managers
//   - Blocage changement stage commercial tant que tâches non terminées

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Tab,
  Tabs,
  CircularProgress,
  Paper,
  LinearProgress,
  alpha,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  Fade,
  ButtonGroup,
  Backdrop,
  Menu as MuiMenu,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  Timeline as TimelineIcon,
  AccountTree as PipelineIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  KeyboardArrowRight as ArrowIcon,
  ViewKanban as KanbanIcon,
  LinearScale as LinearIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Notes as NoteIcon,
  MeetingRoom as MeetingIcon,
  ExpandMore as ExpandMoreIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Business as BusinessIcon,
  Star as StarIcon,
  People as PeopleIcon,
  Sort as SortIcon,
  Bolt as BoltIcon,
  Task as TaskIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as UncheckIcon,
  SyncAlt as SyncIcon,
  PlayArrow as PlayIcon,
  ViewColumn as ViewColumnIcon,
  BarChart as BarChartIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../superadmin/Marketingwidgets";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import PaginationBar from "../../components/PaginationBar";

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const API_BASE_URL = "http://127.0.0.1:8000/api/sales";
const API_USER_ME = "http://127.0.0.1:8000/api/users/me/";
const API_ASSIGN = "http://127.0.0.1:8000/api/users/assignable-users/";

const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ──────────────────────────────────────────────────────────────
// DESIGN TOKENS (Thème rouge identique à Prospects)
// ──────────────────────────────────────────────────────────────
const T = {
  primary: "#d32f2f",
  primaryLight: "#ff6659",
  primaryDark: "#9a0007",
  gradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  success: "#4caf50",
  warning: "#ff9800",
  info: "#2196f3",
  error: "#f44336",
  bg: "#F8F9FC",
  card: "#FFFFFF",
  border: "#E8ECF0",
  text: "#1A2332",
  muted: "#6B7A8D",
  light: "#9AA3B0",
  n100: "#F4F4F5",
  n200: "#E4E4E7",
  n300: "#D1D1D6",
  n400: "#A0A0AB",
  n500: "#71717A",
  n600: "#52525B",
};

const PS = {
  on_track: { label: "En cours", color: T.info, bg: alpha(T.info, 0.1), icon: "●" },
  at_risk: { label: "À risque", color: T.warning, bg: alpha(T.warning, 0.1), icon: "▲" },
  delayed: { label: "En retard", color: T.warning, bg: alpha(T.warning, 0.1), icon: "■" },
  blocked: { label: "Bloqué", color: "#6A1B9A", bg: alpha("#6A1B9A", 0.1), icon: "✕" },
  won: { label: "Gagné", color: T.success, bg: alpha(T.success, 0.1), icon: "✓" },
  lost: { label: "Perdu", color: T.n400, bg: alpha(T.n400, 0.1), icon: "✗" },
};

const ACTIVITY_TYPES = [
  { value: "call", label: "Appel", icon: <PhoneIcon sx={{ fontSize: 16 }} />, color: T.success },
  { value: "email", label: "Email", icon: <EmailIcon sx={{ fontSize: 16 }} />, color: T.info },
  { value: "note", label: "Note", icon: <NoteIcon sx={{ fontSize: 16 }} />, color: T.warning },
  {
    value: "meeting",
    label: "Meeting",
    icon: <MeetingIcon sx={{ fontSize: 16 }} />,
    color: "#6A1B9A",
  },
];

// ──────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────
const stageLabel = (s) =>
  ({
    new: "Nouvelle",
    qualified: "Qualifiée",
    proposal: "Proposition",
    negotiation: "Négociation",
    won: "Gagnée",
    lost: "Perdue",
  }[s] || s);

const stageColor = (s) =>
  ({
    new: T.info,
    qualified: T.success,
    proposal: T.warning,
    negotiation: T.warning,
    won: T.success,
    lost: T.n400,
  }[s] || T.n500);

const fmtMoney = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("fr-TN", {
        style: "currency",
        currency: "TND",
        maximumFractionDigits: 3,
        minimumFractionDigits: 3,
      }).format(n);
const fmtDays = (d) => {
  if (d == null) return "—";
  if (d < 1) return `${Math.round(d * 24)}h`;
  return `${Math.round(d)}j`;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "—");

// ──────────────────────────────────────────────────────────────
// ANIMATIONS
// ──────────────────────────────────────────────────────────────
const fadeUp = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`;
const slideIn = keyframes`from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}`;
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const popIn = keyframes`0%{transform:scale(0.8);opacity:0}100%{transform:scale(1);opacity:1}`;

// ──────────────────────────────────────────────────────────────
// STYLED COMPONENTS (Identiques à Prospects)
// ──────────────────────────────────────────────────────────────
const StyledCard = styled(Card)(() => ({
  borderRadius: 16,
  boxShadow: `0 8px 16px ${alpha(T.primary, 0.1)}`,
  transition: "transform 0.2s, box-shadow 0.2s",
  border: `1px solid ${alpha(T.primary, 0.1)}`,
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: `0 12px 24px ${alpha(T.primary, 0.2)}`,
    borderColor: T.primary,
  },
}));

const StatsCard = styled(Card)(() => ({
  borderRadius: 20,
  padding: 8,
  background: "white",
  boxShadow: `0 4px 12px ${alpha(T.primary, 0.08)}`,
  border: `1px solid ${alpha(T.primary, 0.1)}`,
  transition: "all 0.3s",
  cursor: "pointer",
  "&:hover": { borderColor: T.primary, boxShadow: `0 8px 24px ${alpha(T.primary, 0.15)}` },
}));

const GradBtn = styled(Button)({
  background: T.gradient,
  color: "white",
  borderRadius: 12,
  padding: "10px 24px",
  fontWeight: 700,
  textTransform: "none",
  boxShadow: `0 4px 12px ${alpha(T.primary, 0.3)}`,
  "&:hover": { background: T.gradient, boxShadow: `0 6px 16px ${alpha(T.primary, 0.4)}` },
  "&:disabled": { opacity: 0.6 },
});

const StyledTableContainer = styled(TableContainer)({
  borderRadius: 16,
  boxShadow: `0 8px 16px ${alpha("#000", 0.05)}`,
  border: `1px solid ${alpha(T.primary, 0.1)}`,
  overflowX: "auto",
  "& .MuiTable-root": { minWidth: 1100, borderCollapse: "collapse" },
});

const StyledTableHead = styled(TableHead)({
  "& .MuiTableCell-head": {
    fontWeight: 700,
    color: T.primary,
    fontSize: "0.85rem",
    padding: "16px 8px",
    backgroundColor: alpha(T.primary, 0.04),
    borderBottom: `2px solid ${T.primary}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
});

const StyledTableRow = styled(TableRow)({
  "&:hover": { backgroundColor: alpha(T.primary, 0.02), cursor: "pointer" },
  "& td": { padding: "12px 8px", borderBottom: `1px solid ${alpha("#000", 0.05)}` },
  transition: "background 0.15s",
});

const SPill = styled(Box)(({ pstatus }) => {
  const c = PS[pstatus] || PS.on_track;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 20,
    backgroundColor: c.bg,
    color: c.color,
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${alpha(c.color, 0.25)}`,
  };
});

const TBar = styled(Box)(({ pct, pstatus }) => {
  const c = (PS[pstatus] || PS.on_track).color;
  return {
    height: 4,
    borderRadius: 4,
    background: `linear-gradient(90deg, ${c} ${pct}%, ${alpha(c, 0.12)} ${pct}%)`,
  };
});

const KCol = styled(Box)(({ isover }) => ({
  minWidth: 285,
  maxWidth: 285,
  borderRadius: 14,
  padding: "10px 8px",
  backgroundColor: isover === "true" ? alpha(T.primary, 0.05) : T.n100,
  border: isover === "true" ? `2px dashed ${T.primary}` : `2px solid ${T.n200}`,
  transition: "all .18s",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  animation: `${fadeUp} .3s ease`,
}));

const KCard = styled(Paper)(({ pstatus, isexpanded, iscommercial }) => {
  const cfg = PS[pstatus] || PS.on_track;
  return {
    borderRadius: 12,
    padding: "12px 14px",
    boxShadow:
      isexpanded === "true" ? `0 4px 20px ${alpha(cfg.color, 0.2)}` : "0 1px 4px rgba(0,0,0,.06)",
    cursor: iscommercial === "true" ? "default" : "grab",
    transition: "all .18s",
    border:
      isexpanded === "true" ? `1.5px solid ${alpha(cfg.color, 0.4)}` : `1.5px solid transparent`,
    borderLeft: `3px solid ${cfg.color}`,
    animation: `${fadeUp} .22s ease`,
    "&:hover": { boxShadow: `0 6px 18px ${alpha(cfg.color, 0.18)}`, transform: "translateY(-2px)" },
  };
});

const TaskRow = styled(Box)(({ done }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 10px",
  borderRadius: 8,
  marginBottom: 4,
  cursor: "pointer",
  backgroundColor: done === "true" ? alpha(T.success, 0.04) : T.card,
  border: `1px solid ${done === "true" ? alpha(T.success, 0.2) : T.border}`,
  transition: "all .15s",
  "&:hover": { borderColor: alpha(T.primary, 0.3), backgroundColor: alpha(T.primary, 0.02) },
}));

const SyncBadge = styled(Box)({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 7px",
  borderRadius: 8,
  fontSize: 10,
  fontWeight: 700,
  animation: `${popIn} 0.3s ease`,
});

// ──────────────────────────────────────────────────────────────
// StatsCardItem (Identique à Prospects)
// ──────────────────────────────────────────────────────────────
const StatsCardItem = ({ title, value, icon, color, children, onClick }) => (
  <StatsCard onClick={onClick}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="caption" color="textSecondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ color, fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(color, 0.1), color, width: 48, height: 48 }}>{icon}</Avatar>
      </Box>
      {children && (
        <Box mt={2} display="flex" gap={1}>
          {children}
        </Box>
      )}
    </CardContent>
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

// ──────────────────────────────────────────────────────────────
// ExportMenu (Identique à Prospects)
// ──────────────────────────────────────────────────────────────
const ExportMenu = ({ onExportCSV }) => {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Tooltip title="Exporter">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          sx={{
            color: T.primary,
            border: `1px solid ${alpha(T.primary, 0.3)}`,
            borderRadius: 2,
          }}
        >
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      <MuiMenu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onExportCSV();
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" sx={{ color: T.primary }} />
          </ListItemIcon>
          <ListItemText>CSV</ListItemText>
        </MenuItem>
      </MuiMenu>
    </>
  );
};
ExportMenu.propTypes = {
  onExportCSV: PropTypes.func.isRequired,
};

// ──────────────────────────────────────────────────────────────
// COMPOSANT : StagePipelineBadge
// ──────────────────────────────────────────────────────────────
const StagePipelineBadge = ({ pipelineInfo }) => {
  if (!pipelineInfo) return null;
  const ps = PS[pipelineInfo.status] || PS.on_track;
  return (
    <Box display="flex" alignItems="center" gap={0.7} mt={0.4}>
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: pipelineInfo.stage_color || T.info,
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" sx={{ color: T.muted, fontSize: 10 }} noWrap>
        {pipelineInfo.stage_name}
      </Typography>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: ps.color, flexShrink: 0 }} />
    </Box>
  );
};
StagePipelineBadge.propTypes = { pipelineInfo: PropTypes.object };

// ──────────────────────────────────────────────────────────────
// COMPOSANT : InlineTaskPanel (tâches dans le kanban card)
// ──────────────────────────────────────────────────────────────
const InlineTaskPanel = ({ opPipelineId, onTaskToggle, initialTasks }) => {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [loading, setLoading] = useState(!initialTasks);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    if (!opPipelineId) return;
    setLoading(true);
    api
      .get(`/opportunity-pipelines/${opPipelineId}/tasks/`)
      .then((r) => setTasks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opPipelineId]);

  const toggleTask = async (task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    setToggling(task.id);
    try {
      const r = await api.post(`/opportunity-pipelines/${opPipelineId}/complete-task/`, {
        task_id: task.id,
        status: newStatus,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      if (onTaskToggle) onTaskToggle({ ...r.data, op_pipeline_id: opPipelineId });
    } catch {
    } finally {
      setToggling(null);
    }
  };

  if (loading)
    return (
      <Box display="flex" justifyContent="center" py={1.5}>
        <CircularProgress size={16} sx={{ color: T.info }} />
      </Box>
    );

  const pending = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = tasks.filter((t) => t.status === "done");

  if (tasks.length === 0)
    return (
      <Box py={1} textAlign="center">
        <Typography variant="caption" sx={{ color: T.light }}>
          Aucune tâche pour cette étape
        </Typography>
      </Box>
    );

  return (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
      {pending.map((task) => {
        const isToggling = toggling === task.id;
        const priorityColor =
          task.priority === "high" ? T.error : task.priority === "medium" ? T.warning : T.success;
        return (
          <TaskRow key={task.id} done="false" onClick={() => !isToggling && toggleTask(task)}>
            {isToggling ? (
              <CircularProgress size={14} sx={{ color: T.success, flexShrink: 0 }} />
            ) : (
              <UncheckIcon sx={{ fontSize: 16, color: T.n300, flexShrink: 0 }} />
            )}
            <Box flex={1} minWidth={0}>
              <Typography variant="caption" fontWeight={600} noWrap sx={{ color: T.text }}>
                {task.title}
              </Typography>
              <Box display="flex" gap={0.5} mt={0.2}>
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    bgcolor: priorityColor,
                    mt: 0.3,
                    flexShrink: 0,
                  }}
                />
                {task.due_date && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 9,
                      color: new Date(task.due_date) < new Date() ? T.error : T.light,
                    }}
                  >
                    {fmtDate(task.due_date)}
                  </Typography>
                )}
              </Box>
            </Box>
          </TaskRow>
        );
      })}
      {done.length > 0 && (
        <Box mt={0.5}>
          {done.slice(0, 2).map((task) => (
            <TaskRow key={task.id} done="true" onClick={() => !toggling && toggleTask(task)}>
              {toggling === task.id ? (
                <CircularProgress size={14} sx={{ color: T.success, flexShrink: 0 }} />
              ) : (
                <CheckBoxIcon sx={{ fontSize: 16, color: T.success, flexShrink: 0 }} />
              )}
              <Typography
                variant="caption"
                sx={{ flex: 1, textDecoration: "line-through", color: T.n400, fontSize: 11 }}
                noWrap
              >
                {task.title}
              </Typography>
            </TaskRow>
          ))}
          {done.length > 2 && (
            <Typography variant="caption" sx={{ color: T.light, pl: 1, fontSize: 9 }}>
              +{done.length - 2} terminée(s)
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
InlineTaskPanel.propTypes = {
  opPipelineId: PropTypes.number,
  onTaskToggle: PropTypes.func,
  initialTasks: PropTypes.array,
};

// ──────────────────────────────────────────────────────────────
// COMPOSANT : CreateOpportunityDrawer
// ──────────────────────────────────────────────────────────────
const CreateOpportunityDrawer = ({
  open,
  editOpp,
  onClose,
  onSaved,
  prospects,
  contacts,
  commercials,
  currentUser,
}) => {
  const isEdit = !!editOpp?.id;
  const [step, setStep] = useState(0);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [stageTemplates, setStageTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    prospect: "",
    contact: "",
    amount: "",
    stage: "new",
    expected_close_date: "",
    notes: "",
    assigned_to: "",
    pipeline_id: "",
    stage_id: "",
  });
  const [customTasks, setCustomTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskDue, setNewTaskDue] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    api
      .get("/pipelines/", { params: { is_active: true } })
      .then((r) => setPipelines(r.data.results || r.data))
      .catch(() => {});
    if (editOpp) {
      setForm({
        name: editOpp.name || "",
        prospect: editOpp.prospect || "",
        contact: editOpp.contact || "",
        amount: editOpp.amount || "",
        stage: editOpp.stage || "new",
        expected_close_date: editOpp.expected_close_date || "",
        notes: editOpp.notes || "",
        assigned_to: editOpp.assigned_to || "",
        pipeline_id: "",
        stage_id: "",
      });
      setStep(0);
    } else {
      setForm({
        name: "",
        prospect: "",
        contact: "",
        amount: "",
        stage: "new",
        expected_close_date: "",
        notes: "",
        assigned_to: "",
        pipeline_id: "",
        stage_id: "",
      });
      setStep(0);
      setCustomTasks([]);
    }
    setError("");
  }, [open, editOpp]);

  useEffect(() => {
    if (!form.pipeline_id) {
      setPipelineStages([]);
      setStageTemplates([]);
      return;
    }
    api
      .get("/pipeline-stages/", { params: { pipeline_id: form.pipeline_id } })
      .then((r) => {
        const stages = (r.data.results || r.data).sort((a, b) => a.order - b.order);
        setPipelineStages(stages);
        const first = stages.find((s) => !s.is_terminal);
        if (first) {
          set("stage_id", first.id);
          loadTemplates(first.id);
        }
      })
      .catch(() => {});
  }, [form.pipeline_id]);

  const loadTemplates = (stageId) => {
    api
      .get("/pipeline-stage-tasks/", { params: { stage_id: stageId } })
      .then((r) => setStageTemplates(r.data.results || r.data))
      .catch(() => {});
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) {
      setError("Nom et montant obligatoires.");
      return;
    }
    if (!form.prospect && !form.contact) {
      setError("Sélectionnez un prospect ou contact.");
      return;
    }
    if ((currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER") && !form.assigned_to) {
      setError("Assignez cette opportunité à un commercial.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        prospect: form.prospect || null,
        contact: form.contact || null,
        amount: form.amount,
        stage: form.stage,
        expected_close_date: form.expected_close_date || null,
        notes: form.notes || null,
        ...(currentUser?.role !== "COMMERCIAL" && form.assigned_to
          ? { assigned_to: form.assigned_to }
          : {}),
      };
      let opp;
      if (isEdit) {
        const r = await api.put(`/opportunities/${editOpp.id}/`, payload);
        opp = r.data;
      } else {
        const r = await api.post("/opportunities/", payload);
        opp = r.data;
      }
      if (!isEdit && form.pipeline_id && form.stage_id) {
        try {
          await api.post("/opportunity-pipelines/", {
            opportunity: opp.id,
            pipeline: form.pipeline_id,
            current_stage: form.stage_id,
          });
        } catch (e) {
          console.warn("Pipeline link failed:", e.response?.data);
        }
      }
      if (!isEdit && customTasks.length > 0) {
        await Promise.all(
          customTasks.map((t) =>
            api.post("/tasks/", {
              title: t.title,
              priority: t.priority,
              due_date: t.due_date || null,
              task_type: "classic",
              opportunity: opp.id,
              status: "todo",
            })
          )
        );
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(
        e.response?.data?.assigned_to?.[0] ||
          e.response?.data?.detail ||
          "Erreur lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  const canNext0 =
    form.name &&
    form.amount &&
    (form.prospect || form.contact) &&
    (currentUser?.role === "COMMERCIAL" || form.assigned_to);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 560 },
          background: T.bg,
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 3, pb: 2, background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{
                background: T.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {isEdit ? "Modifier l'opportunité" : "Nouvelle opportunité"}
            </Typography>
            <IconButton onClick={onClose} size="small" sx={{ bgcolor: T.n100 }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          {!isEdit && (
            <Stepper
              activeStep={step}
              alternativeLabel
              connector={
                <StepConnector sx={{ "& .MuiStepConnector-line": { borderColor: T.n200 } }} />
              }
            >
              {["Opportunité", "Pipeline", "Tâches initiales"].map((s) => (
                <Step key={s}>
                  <StepLabel
                    sx={{
                      "& .MuiStepLabel-label": { fontSize: 11, fontWeight: 600, color: T.n500 },
                      "& .Mui-active .MuiStepLabel-label": { color: T.primary },
                      "& .MuiStepIcon-root.Mui-active": { color: T.primary },
                      "& .MuiStepIcon-root.Mui-completed": { color: T.success },
                    }}
                  >
                    {s}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {(step === 0 || isEdit) && (
            <Stack spacing={2.5}>
              {(currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER") && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: `1px solid ${alpha(T.info, 0.3)}`,
                    bgcolor: alpha(T.info, 0.02),
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{
                      color: T.info,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      display: "block",
                      mb: 1.5,
                    }}
                  >
                    Commercial assigné *
                  </Typography>
                  <FormControl fullWidth size="small" required>
                    <InputLabel>Sélectionner un commercial</InputLabel>
                    <Select
                      value={form.assigned_to}
                      onChange={(e) => set("assigned_to", e.target.value)}
                      label="Sélectionner un commercial"
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="">
                        <em>— Choisir —</em>
                      </MenuItem>
                      {commercials.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar
                              sx={{
                                width: 26,
                                height: 26,
                                bgcolor: alpha(T.info, 0.15),
                                color: T.info,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {u.username?.[0]?.toUpperCase()}
                            </Avatar>
                            <Typography fontSize={13} fontWeight={600}>
                              {u.username}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Paper>
              )}
              <TextField
                fullWidth
                size="small"
                label="Nom de l'opportunité *"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card } }}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Prospect</InputLabel>
                    <Select
                      value={form.prospect}
                      label="Prospect"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, prospect: e.target.value, contact: "" }))
                      }
                      sx={{ borderRadius: 2, bgcolor: T.card }}
                    >
                      <MenuItem value="">Aucun</MenuItem>
                      {prospects.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Contact</InputLabel>
                    <Select
                      value={form.contact}
                      label="Contact"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, contact: e.target.value, prospect: "" }))
                      }
                      sx={{ borderRadius: 2, bgcolor: T.card }}
                    >
                      <MenuItem value="">Aucun</MenuItem>
                      {contacts.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Montant (DT) *"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Date clôture"
                    value={form.expected_close_date}
                    onChange={(e) => set("expected_close_date", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card } }}
                  />
                </Grid>
              </Grid>
              <FormControl fullWidth size="small">
                <InputLabel>Stage CRM</InputLabel>
                <Select
                  value={form.stage}
                  label="Stage CRM"
                  onChange={(e) => set("stage", e.target.value)}
                  sx={{ borderRadius: 2, bgcolor: T.card }}
                >
                  {["new", "qualified", "proposal", "negotiation", "won", "lost"].map((s) => (
                    <MenuItem key={s} value={s}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: stageColor(s) }}
                        />
                        {stageLabel(s)}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="Notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card } }}
              />
            </Stack>
          )}

          {step === 1 && !isEdit && (
            <Stack spacing={2.5}>
              <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                Liez cette opportunité à un pipeline. Les tâches seront créées automatiquement à
                chaque étape.
              </Alert>
              {pipelines.length === 0 ? (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  Aucun pipeline actif.
                </Alert>
              ) : (
                <>
                  {pipelines.map((p) => (
                    <Paper
                      key={p.id}
                      elevation={0}
                      onClick={() => set("pipeline_id", p.id)}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        cursor: "pointer",
                        transition: "all .18s",
                        border: `2px solid ${form.pipeline_id === p.id ? T.primary : T.border}`,
                        bgcolor: form.pipeline_id === p.id ? alpha(T.primary, 0.04) : T.card,
                        "&:hover": { borderColor: T.primary },
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            background: T.gradient,
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {p.pipeline_type === "b2b" ? "🏢" : "👤"}
                        </Avatar>
                        <Box flex={1}>
                          <Typography fontWeight={700} fontSize={14}>
                            {p.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {p.stages_count} étapes · {p.opportunities_count} opportunités
                          </Typography>
                        </Box>
                        {form.pipeline_id === p.id && <CheckIcon sx={{ color: T.success }} />}
                      </Box>
                    </Paper>
                  ))}
                  {form.pipeline_id && pipelineStages.length > 0 && (
                    <>
                      <Typography variant="body2" fontWeight={700} sx={{ color: T.n600 }}>
                        Étape de départ
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {pipelineStages
                          .filter((s) => !s.is_terminal)
                          .map((s) => (
                            <Chip
                              key={s.id}
                              label={s.name}
                              onClick={() => {
                                set("stage_id", s.id);
                                loadTemplates(s.id);
                              }}
                              sx={{
                                fontWeight: 600,
                                cursor: "pointer",
                                borderRadius: 2,
                                bgcolor: form.stage_id === s.id ? alpha(T.primary, 0.12) : T.n100,
                                color: form.stage_id === s.id ? T.primary : T.n600,
                                border: `1.5px solid ${
                                  form.stage_id === s.id ? T.primary : "transparent"
                                }`,
                              }}
                            />
                          ))}
                      </Box>
                      {stageTemplates.length > 0 && (
                        <Alert severity="success" sx={{ borderRadius: 2 }}>
                          <Typography variant="body2" fontWeight={600}>
                            ⚡ {stageTemplates.length} tâche(s) automatique(s) seront créées :
                          </Typography>
                          {stageTemplates.map((t) => (
                            <Typography key={t.id} variant="caption" display="block" sx={{ ml: 1 }}>
                              • {t.title} (J+{t.due_days_after_entry})
                            </Typography>
                          ))}
                        </Alert>
                      )}
                    </>
                  )}
                </>
              )}
            </Stack>
          )}

          {step === 2 && !isEdit && (
            <Stack spacing={2.5}>
              <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                Ajoutez des tâches spécifiques en plus des templates automatiques.
              </Alert>
              <Paper
                elevation={0}
                sx={{ p: 2.5, borderRadius: 3, border: `1px dashed ${T.n300}`, bgcolor: T.n100 }}
              >
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Titre de la tâche..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newTaskTitle.trim()) {
                          setCustomTasks((p) => [
                            ...p,
                            {
                              title: newTaskTitle,
                              priority: newTaskPriority,
                              due_date: newTaskDue,
                              _id: Date.now(),
                            },
                          ]);
                          setNewTaskTitle("");
                          setNewTaskDue("");
                        }
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card } }}
                    />
                  </Grid>
                  <Grid item xs={5}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value)}
                        sx={{ borderRadius: 2, bgcolor: T.card }}
                      >
                        <MenuItem value="low">🟢 Basse</MenuItem>
                        <MenuItem value="medium">🟡 Moyenne</MenuItem>
                        <MenuItem value="high">🔴 Haute</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card } }}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <GradBtn
                      fullWidth
                      onClick={() => {
                        if (!newTaskTitle.trim()) return;
                        setCustomTasks((p) => [
                          ...p,
                          {
                            title: newTaskTitle,
                            priority: newTaskPriority,
                            due_date: newTaskDue,
                            _id: Date.now(),
                          },
                        ]);
                        setNewTaskTitle("");
                        setNewTaskDue("");
                      }}
                      sx={{ height: "100%", px: 0, minWidth: 0 }}
                    >
                      <AddIcon />
                    </GradBtn>
                  </Grid>
                </Grid>
              </Paper>
              {customTasks.map((t) => (
                <TaskRow key={t._id} done="false">
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor:
                        t.priority === "high"
                          ? T.error
                          : t.priority === "medium"
                          ? T.warning
                          : T.success,
                      flexShrink: 0,
                    }}
                  />
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {t.title}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => setCustomTasks((p) => p.filter((x) => x._id !== t._id))}
                    sx={{ color: T.error }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </TaskRow>
              ))}
              {stageTemplates.length + customTasks.length > 0 && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {stageTemplates.length + customTasks.length} tâche(s) au total
                  </Typography>
                  <Typography variant="caption">
                    {stageTemplates.length} auto + {customTasks.length} personnalisée(s)
                  </Typography>
                </Alert>
              )}
            </Stack>
          )}
        </Box>

        <Box sx={{ p: 3, pt: 2, background: T.card, borderTop: `1px solid ${T.border}` }}>
          <Box display="flex" gap={1.5} justifyContent="space-between">
            {!isEdit && step > 0 ? (
              <Button onClick={() => setStep((s) => s - 1)} sx={{ borderRadius: 2, color: T.n500 }}>
                ← Retour
              </Button>
            ) : (
              <Button onClick={onClose} sx={{ borderRadius: 2, color: T.n500 }}>
                Annuler
              </Button>
            )}
            <Box display="flex" gap={1}>
              {!isEdit && step < 2 && (
                <Button
                  variant="outlined"
                  onClick={handleSave}
                  disabled={!canNext0 || saving}
                  sx={{ borderRadius: 2, borderColor: alpha(T.primary, 0.3), color: T.primary }}
                >
                  Créer sans {step === 0 ? "pipeline" : "tâches"}
                </Button>
              )}
              {!isEdit && step < 2 ? (
                <GradBtn onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !canNext0}>
                  Suivant →
                </GradBtn>
              ) : (
                <GradBtn onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <CircularProgress size={18} sx={{ color: "white" }} />
                  ) : isEdit ? (
                    "Mettre à jour"
                  ) : (
                    "Créer l'opportunité"
                  )}
                </GradBtn>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};
CreateOpportunityDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  editOpp: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
  prospects: PropTypes.array.isRequired,
  contacts: PropTypes.array.isRequired,
  commercials: PropTypes.array.isRequired,
  currentUser: PropTypes.object,
};

// ──────────────────────────────────────────────────────────────
// COMPOSANT : OpportunityDetailDrawer
// ──────────────────────────────────────────────────────────────
const OpportunityDetailDrawer = ({ open, opp, onClose, onRefresh }) => {
  const [tab, setTab] = useState("tasks"); // était useState(0)
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actForm, setActForm] = useState({
    activity_type: "call",
    notes: "",
    call_result: "",
    email_subject: "",
    email_sent_to: "",
  });
  const [savingAct, setSavingAct] = useState(false);
  const [actError, setActError] = useState("");
  const [tForm, setTForm] = useState({ title: "", priority: "medium", due_date: "" });
  const [savingT, setSavingT] = useState(false);

  useEffect(() => {
    if (!open || !opp) return;
    setLoading(true);
    Promise.all([
      api.get("/tasks/", { params: { opportunity: opp.id, page_size: 50 } }),
      api.get("/task-activities/", { params: { page_size: 50 } }),
      api.get("/opportunity-pipelines/", { params: { page_size: 100 } }),
    ])
      .then(([tRes, aRes, pRes]) => {
        setTasks(tRes.data.results || tRes.data);
        const taskIds = new Set((tRes.data.results || tRes.data).map((t) => t.id));
        setActivities((aRes.data.results || aRes.data).filter((a) => taskIds.has(a.task)));
        const found = (pRes.data.results || pRes.data).find((op) => op.opportunity === opp.id);
        if (found) setPipelineData(found);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, opp]);

  const toggleTask = async (task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      await api.patch(`/tasks/${task.id}/`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      onRefresh?.();
    } catch {}
  };

  const addActivity = async () => {
    if (!actForm.notes && !actForm.call_result && !actForm.email_subject) {
      setActError("Ajoutez au moins une note.");
      return;
    }
    let taskId =
      tasks.find((t) => t.status !== "done" && t.status !== "cancelled")?.id || tasks[0]?.id;
    if (!taskId) {
      try {
        const r = await api.post("/tasks/", {
          title: `Note — ${opp?.name}`,
          task_type: "classic",
          opportunity: opp.id,
          status: "done",
        });
        taskId = r.data.id;
        setTasks((prev) => [...prev, r.data]);
      } catch {
        setActError("Impossible de créer l'activité.");
        return;
      }
    }
    setSavingAct(true);
    setActError("");
    try {
      const r = await api.post("/task-activities/", { ...actForm, task: taskId });
      setActivities((prev) => [r.data, ...prev]);
      setActForm({
        activity_type: "call",
        notes: "",
        call_result: "",
        email_subject: "",
        email_sent_to: "",
      });
    } catch (e) {
      setActError(e.response?.data?.detail || "Erreur.");
    } finally {
      setSavingAct(false);
    }
  };

  const addQuickTask = async () => {
    if (!tForm.title.trim()) return;
    setSavingT(true);
    try {
      const r = await api.post("/tasks/", {
        title: tForm.title,
        priority: tForm.priority,
        due_date: tForm.due_date || null,
        task_type: "classic",
        opportunity: opp.id,
        status: "todo",
      });
      setTasks((prev) => [...prev, r.data]);
      setTForm({ title: "", priority: "medium", due_date: "" });
    } catch {
    } finally {
      setSavingT(false);
    }
  };

  if (!opp) return null;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 540 },
          background: T.bg,
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 3, pb: 2, background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Typography variant="h6" fontWeight={800} noWrap sx={{ mb: 0.5 }}>
                {opp.name}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h5" fontWeight={900} sx={{ color: T.primary }}>
                  {fmtMoney(opp.amount)}
                </Typography>
                <Chip
                  label={stageLabel(opp.stage)}
                  size="small"
                  sx={{
                    bgcolor: alpha(stageColor(opp.stage), 0.1),
                    color: stageColor(opp.stage),
                    fontWeight: 700,
                    borderRadius: 2,
                  }}
                />
              </Box>
              {opp.pipeline_info && (
                <Box display="flex" alignItems="center" gap={0.8} mt={0.8}>
                  <PipelineIcon sx={{ fontSize: 13, color: T.n400 }} />
                  <Typography variant="caption" sx={{ color: T.muted }}>
                    {opp.pipeline_info.pipeline_name} ·{" "}
                    <strong>{opp.pipeline_info.stage_name}</strong>
                  </Typography>
                  <SPill pstatus={opp.pipeline_info.status} sx={{ fontSize: 9 }}>
                    {PS[opp.pipeline_info.status]?.label}
                  </SPill>
                </Box>
              )}
            </Box>
            <IconButton onClick={onClose} size="small" sx={{ bgcolor: T.n100 }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          {totalTasks > 0 && (
            <Box mt={2}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" fontWeight={600} sx={{ color: T.n500 }}>
                  Progression tâches
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ color: pct === 100 ? T.success : T.primary }}
                >
                  {doneTasks}/{totalTasks} ({pct}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 6,
                  borderRadius: 4,
                  bgcolor: alpha(T.primary, 0.1),
                  "& .MuiLinearProgress-bar": {
                    background: pct === 100 ? T.success : T.gradient,
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          )}
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            bgcolor: T.card,
            px: 2,
            borderBottom: `1px solid ${T.border}`,
            "& .Mui-selected": { color: `${T.primary} !important`, fontWeight: 700 },
            "& .MuiTabs-indicator": { bgcolor: T.primary },
            "& .MuiTab-root": {
              textTransform: "none",
              minHeight: 44,
              fontSize: 13,
              fontWeight: 600,
            },
          }}
        >
          <Tab value="tasks" label={`Tâches (${totalTasks})`} />
          <Tab value="activities" label={`Activités (${activities.length})`} />
          {pipelineData && <Tab value="pipeline" label="Pipeline" />}
          <Tab value="info" label="Infos" />
        </Tabs>

        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress sx={{ color: T.primary }} />
            </Box>
          ) : (
            <>
              {tab === "tasks" && (
                <Stack spacing={2}>
                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 3, border: `1px dashed ${T.n300}`, bgcolor: T.n100 }}
                  >
                    <Box display="flex" gap={1}>
                      <TextField
                        size="small"
                        placeholder="Titre..."
                        value={tForm.title}
                        onChange={(e) => setTForm((f) => ({ ...f, title: e.target.value }))}
                        onKeyPress={(e) => e.key === "Enter" && addQuickTask()}
                        sx={{
                          flex: 1,
                          "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: T.card },
                        }}
                      />
                      <Select
                        size="small"
                        value={tForm.priority}
                        onChange={(e) => setTForm((f) => ({ ...f, priority: e.target.value }))}
                        sx={{ width: 100, borderRadius: 2, bgcolor: T.card }}
                      >
                        <MenuItem value="low">🟢</MenuItem>
                        <MenuItem value="medium">🟡</MenuItem>
                        <MenuItem value="high">🔴</MenuItem>
                      </Select>
                      <GradBtn
                        onClick={addQuickTask}
                        disabled={savingT}
                        sx={{ minWidth: 0, px: 1.5, borderRadius: 2 }}
                      >
                        <AddIcon />
                      </GradBtn>
                    </Box>
                  </Paper>
                  {tasks
                    .filter((t) => t.status !== "done" && t.status !== "cancelled")
                    .map((task) => (
                      <TaskRow key={task.id} done="false">
                        <Checkbox
                          checked={false}
                          onChange={() => toggleTask(task)}
                          size="small"
                          sx={{ p: 0.5, color: T.n300 }}
                        />
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {task.title}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.3}>
                            <Chip
                              label={task.priority}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: 9,
                                bgcolor: alpha(
                                  task.priority === "high"
                                    ? T.error
                                    : task.priority === "medium"
                                    ? T.warning
                                    : T.success,
                                  0.1
                                ),
                                color:
                                  task.priority === "high"
                                    ? T.error
                                    : task.priority === "medium"
                                    ? T.warning
                                    : T.success,
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                            {task.due_date && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: new Date(task.due_date) < new Date() ? T.error : T.n400,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.3,
                                }}
                              >
                                <CalendarIcon sx={{ fontSize: 11 }} />
                                {fmtDate(task.due_date)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TaskRow>
                    ))}
                  {tasks.filter((t) => t.status === "done").length > 0 && (
                    <Accordion
                      elevation={0}
                      sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}
                        sx={{ px: 0, py: 0.5, minHeight: 36 }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ color: T.success }}>
                          ✓ {tasks.filter((t) => t.status === "done").length} terminée(s)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        {tasks
                          .filter((t) => t.status === "done")
                          .map((task) => (
                            <TaskRow key={task.id} done="true">
                              <Checkbox
                                checked
                                onChange={() => toggleTask(task)}
                                size="small"
                                sx={{ p: 0.5, color: T.success }}
                              />
                              <Typography
                                variant="body2"
                                sx={{
                                  flex: 1,
                                  textDecoration: "line-through",
                                  color: T.n400,
                                  fontSize: 13,
                                }}
                              >
                                {task.title}
                              </Typography>
                            </TaskRow>
                          ))}
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Stack>
              )}

              {tab === "activities" && (
                <Stack spacing={2}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: `1px solid ${T.border}`,
                      bgcolor: T.card,
                    }}
                  >
                    {actError && (
                      <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, py: 0.5 }}>
                        {actError}
                      </Alert>
                    )}
                    <Box display="flex" gap={1} mb={1.5} flexWrap="wrap">
                      {ACTIVITY_TYPES.map((a) => (
                        <Button
                          key={a.value}
                          size="small"
                          onClick={() => setActForm((f) => ({ ...f, activity_type: a.value }))}
                          startIcon={a.icon}
                          sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: 12,
                            bgcolor:
                              actForm.activity_type === a.value ? alpha(a.color, 0.12) : T.n100,
                            color: actForm.activity_type === a.value ? a.color : T.n500,
                            border: `1.5px solid ${
                              actForm.activity_type === a.value ? a.color : "transparent"
                            }`,
                          }}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </Box>
                    {actForm.activity_type === "call" && (
                      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                        <InputLabel>Résultat de l&apos;appel</InputLabel>
                        <Select
                          value={actForm.call_result}
                          onChange={(e) =>
                            setActForm((f) => ({ ...f, call_result: e.target.value }))
                          }
                          label="Résultat de l'appel"
                          sx={{ borderRadius: 2 }}
                        >
                          <MenuItem value="">— Sélectionner —</MenuItem>
                          <MenuItem value="interested">✅ Intéressé</MenuItem>
                          <MenuItem value="callback">📞 Rappel demandé</MenuItem>
                          <MenuItem value="not_interested">❌ Pas intéressé</MenuItem>
                          <MenuItem value="no_answer">📵 Pas de réponse</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      placeholder="Notes / résumé..."
                      value={actForm.notes}
                      onChange={(e) => setActForm((f) => ({ ...f, notes: e.target.value }))}
                      sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                    <GradBtn fullWidth onClick={addActivity} disabled={savingAct} sx={{ py: 1 }}>
                      {savingAct ? (
                        <CircularProgress size={16} sx={{ color: "white" }} />
                      ) : (
                        "Enregistrer l'activité"
                      )}
                    </GradBtn>
                  </Paper>
                  {activities.map((act, idx) => {
                    const cfg =
                      ACTIVITY_TYPES.find((a) => a.value === act.activity_type) ||
                      ACTIVITY_TYPES[2];
                    return (
                      <Box
                        key={act.id}
                        display="flex"
                        gap={1.5}
                        sx={{ animation: `${slideIn} ${0.2 + idx * 0.05}s ease` }}
                      >
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(cfg.color, 0.12),
                              color: cfg.color,
                            }}
                          >
                            {React.cloneElement(cfg.icon, { sx: { fontSize: 15 } })}
                          </Avatar>
                          {idx < activities.length - 1 && (
                            <Box
                              sx={{
                                width: 1.5,
                                flex: 1,
                                bgcolor: T.n200,
                                my: 0.5,
                                borderRadius: 1,
                              }}
                            />
                          )}
                        </Box>
                        <Box pb={2} flex={1}>
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={700}>
                              {cfg.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: T.n400 }}>
                              {fmtDateTime(act.created_at)}
                            </Typography>
                          </Box>
                          {act.notes && (
                            <Typography
                              variant="body2"
                              sx={{ mt: 0.5, color: T.n600, fontStyle: "italic", fontSize: 12 }}
                            >
                              &quot;{act.notes}&quot;
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}

              {tab === "pipeline" && pipelineData && (
                <Stack spacing={2}>
                  <Paper
                    elevation={0}
                    sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${T.border}` }}
                  >
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" fontWeight={700}>
                        Statut pipeline
                      </Typography>
                      <SPill pstatus={pipelineData.status}>{PS[pipelineData.status]?.label}</SPill>
                    </Box>
                    <Grid container spacing={2}>
                      {[
                        {
                          label: "Temps écoulé",
                          value: fmtDays(pipelineData.time_metrics?.elapsed_days),
                        },
                        {
                          label: "Temps restant",
                          value: fmtDays(pipelineData.time_metrics?.remaining_days),
                        },
                        {
                          label: "Max étape",
                          value: `${pipelineData.current_stage_detail?.max_duration_days}j`,
                        },
                        { label: "Progression", value: `${pipelineData.progression}%` },
                      ].map((m) => (
                        <Grid item xs={6} key={m.label}>
                          <Box
                            sx={{ p: 1.5, bgcolor: T.n100, borderRadius: 2, textAlign: "center" }}
                          >
                            <Typography variant="caption" color="textSecondary">
                              {m.label}
                            </Typography>
                            <Typography variant="body1" fontWeight={800} sx={{ color: T.primary }}>
                              {m.value}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                  {pipelineData.history?.length > 0 && (
                    <Box>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          color: T.n400,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          display: "block",
                          mb: 1.5,
                        }}
                      >
                        Historique
                      </Typography>
                      {pipelineData.history.map((h, idx) => (
                        <Box key={h.id} display="flex" gap={1.5} mb={1.5}>
                          <Box display="flex" flexDirection="column" alignItems="center">
                            <Avatar
                              sx={{
                                width: 26,
                                height: 26,
                                bgcolor: h.to_stage_color || T.n200,
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {idx + 1}
                            </Avatar>
                            {idx < pipelineData.history.length - 1 && (
                              <Box sx={{ width: 1.5, flex: 1, bgcolor: T.n200, my: 0.5 }} />
                            )}
                          </Box>
                          <Box pb={1.5}>
                            <Typography variant="body2" fontWeight={600}>
                              {h.action_display}
                            </Typography>
                            {h.to_stage_name && (
                              <Typography variant="caption" color="textSecondary">
                                {h.from_stage_name ? `${h.from_stage_name} → ` : ""}
                                <strong>{h.to_stage_name}</strong>
                              </Typography>
                            )}
                            <Typography variant="caption" display="block" sx={{ color: T.n400 }}>
                              {fmtDateTime(h.created_at)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Stack>
              )}

              {tab === "info" && (
                <Stack spacing={2}>
                  <Paper
                    elevation={0}
                    sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${T.border}` }}
                  >
                    {[
                      { label: "Montant", value: fmtMoney(opp.amount) },
                      { label: "Stage CRM", value: stageLabel(opp.stage) },
                      { label: "Date clôture", value: fmtDate(opp.expected_close_date) },
                      { label: "Créé le", value: fmtDate(opp.created_at) },
                      { label: "Commercial", value: opp.assigned_to_detail?.username || "—" },
                    ].map((row) => (
                      <Box
                        key={row.label}
                        display="flex"
                        justifyContent="space-between"
                        py={1}
                        sx={{ borderBottom: `1px solid ${T.n100}` }}
                      >
                        <Typography variant="body2" color="textSecondary">
                          {row.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {row.value}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                  {opp.notes && (
                    <Paper
                      elevation={0}
                      sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${T.border}` }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          color: T.n400,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          display: "block",
                          mb: 1,
                        }}
                      >
                        Notes
                      </Typography>
                      <Typography variant="body2" sx={{ color: T.n600 }}>
                        {opp.notes}
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              )}
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
OpportunityDetailDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  opp: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onRefresh: PropTypes.func,
};

// ──────────────────────────────────────────────────────────────
// COMPOSANT : PipelineView (Kanban avec tâches inline)
// ──────────────────────────────────────────────────────────────
const PipelineView = ({ currentUser, onOppStageChanged }) => {
  const [pipelines, setPipelines] = useState([]);
  const [selPId, setSelPId] = useState(null);
  const [kanban, setKanban] = useState(null);
  const [view, setView] = useState("kanban");
  const [loading, setLoading] = useState(false);
  const [rk, setRk] = useState(0);
  const [expandedCard, setExpandedCard] = useState(null);
  const [dragCard, setDragCard] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [moveDialog, setMoveDialog] = useState({ open: false, op: null });
  const [moveStageId, setMoveStageId] = useState("");
  const [moveNotes, setMoveNotes] = useState("");
  const [moveForce, setMoveForce] = useState(false);
  const [moveWarning, setMoveWarning] = useState(null);
  const [moving, setMoving] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [syncToast, setSyncToast] = useState({ open: false, message: "" });

  useEffect(() => {
    api
      .get("/pipelines/", { params: { is_active: true } })
      .then((r) => {
        const list = r.data.results || r.data;
        setPipelines(list);
        if (list.length > 0) setSelPId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selPId) return;
    setLoading(true);
    api
      .get(`/pipelines/${selPId}/kanban/`)
      .then((r) => setKanban(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selPId, rk]);

  useEffect(() => {
    api
      .get("/pipeline-alerts/", { params: { is_resolved: false, page_size: 10 } })
      .then((r) => setAlerts(r.data.results || r.data))
      .catch(() => {});
  }, [rk]);

  const allStages = kanban?.stages || [];

  const showSyncToast = (msg) => {
    setSyncToast({ open: true, message: msg });
    setTimeout(() => setSyncToast({ open: false, message: "" }), 3000);
  };

  const confirmMove = async () => {
    const { op } = moveDialog;
    if (!op || !moveStageId) return;
    setMoving(true);
    setMoveWarning(null);
    try {
      const r = await api.post(`/opportunity-pipelines/${op.id}/move-stage/`, {
        stage_id: parseInt(moveStageId),
        notes: moveNotes,
        force: moveForce,
      });
      if (r.status === 422) {
        setMoveWarning(r.data);
        setMoving(false);
        return;
      }

      if (r.data.crm_stage_updated) {
        showSyncToast(`✅ Stage CRM mis à jour → ${stageLabel(r.data.crm_stage_updated)}`);
        if (onOppStageChanged) onOppStageChanged();
      }

      setMoveDialog({ open: false, op: null });
      setRk((k) => k + 1);
    } catch (e) {
      if (e.response?.status === 422) setMoveWarning(e.response.data);
    } finally {
      setMoving(false);
    }
  };

  // MODIFICATION 4a: Restreindre le drag aux admins/managers
  const onDragStart = (e, op) => {
    if (currentUser?.role === "COMMERCIAL") {
      e.preventDefault();
      return;
    }
    setDragCard(op);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => {
    setDragCard(null);
    setDropTarget(null);
  };
  const onDragOver = (e, stageId) => {
    e.preventDefault();
    setDropTarget(stageId);
  };
  const onDrop = (e, stageId) => {
    e.preventDefault();
    if (!dragCard) return;
    setMoveDialog({ open: true, op: dragCard });
    setMoveStageId(stageId.toString());
    setDropTarget(null);
    setDragCard(null);
  };

  const handleTaskToggle = (taskData) => {
    setKanban((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stages: prev.stages.map((stage) => ({
          ...stage,
          opportunities: stage.opportunities.map((op) => {
            // ✅ Ne mettre à jour que la carte concernée
            if (op.id !== taskData.op_pipeline_id) return op;
            return {
              ...op,
              tasks_summary: taskData.tasks_summary || op.tasks_summary,
              stage_completion: taskData.stage_completion || op.stage_completion,
            };
          }),
        })),
      };
    });
  };

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1.5}
        mb={2.5}
      >
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {pipelines.map((p) => (
            <Chip
              key={p.id}
              onClick={() => setSelPId(p.id)}
              label={`${p.pipeline_type === "b2b" ? "🏢" : "👤"} ${p.name}`}
              sx={{
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: 3,
                bgcolor: selPId === p.id ? alpha(T.primary, 0.12) : T.card,
                color: selPId === p.id ? T.primary : T.n500,
                border: `1.5px solid ${selPId === p.id ? T.primary : T.n200}`,
                "&:hover": { borderColor: T.primary },
              }}
            />
          ))}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Rafraîchir">
            <IconButton
              size="small"
              onClick={() => setRk((k) => k + 1)}
              sx={{ border: `1px solid ${T.n200}`, color: T.n500 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ display: "flex", bgcolor: T.n100, borderRadius: 2, p: 0.4, gap: 0.4 }}>
            {[
              { v: "kanban", icon: <KanbanIcon sx={{ fontSize: 16 }} />, label: "Kanban" },
              { v: "linear", icon: <LinearIcon sx={{ fontSize: 16 }} />, label: "Liste" },
            ].map((b) => (
              <Button
                key={b.v}
                size="small"
                onClick={() => setView(b.v)}
                startIcon={b.icon}
                sx={{
                  borderRadius: "6px !important",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: 11,
                  bgcolor: view === b.v ? "white" : "transparent",
                  color: view === b.v ? T.primary : T.n400,
                  boxShadow: view === b.v ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                  px: 1.5,
                }}
              >
                {b.label}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      {alerts.slice(0, 3).map((alert) => (
        <Alert
          key={alert.id}
          severity={alert.severity === "critical" ? "error" : "warning"}
          sx={{ mb: 1, borderRadius: 2.5 }}
          action={
            <IconButton
              size="small"
              onClick={async () => {
                await api.patch(`/pipeline-alerts/${alert.id}/resolve/`);
                setAlerts((p) => p.filter((a) => a.id !== alert.id));
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <strong>{alert.opportunity_name}</strong> — {alert.message}
        </Alert>
      ))}

      {loading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress sx={{ color: T.primary }} />
        </Box>
      )}

      {!loading && kanban && view === "kanban" && (
        <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 2, pt: 0.5 }}>
          {kanban.stages.map((stage) => (
            <KCol
              key={stage.stage_id}
              isover={dropTarget === stage.stage_id ? "true" : "false"}
              onDragOver={(e) => onDragOver(e, stage.stage_id)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => onDrop(e, stage.stage_id)}
            >
              <Box display="flex" alignItems="center" gap={1} px={0.5} mb={0.5}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: stage.stage_color,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" fontWeight={700} fontSize={12.5} flex={1} noWrap>
                  {stage.stage_name}
                </Typography>
                <Chip
                  label={stage.count}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    bgcolor: "white",
                    "& .MuiChip-label": { px: 0.8 },
                    boxShadow: "0 1px 3px rgba(0,0,0,.08)",
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ color: T.n400, px: 0.5, display: "block", mb: 0.5 }}
              >
                {fmtMoney(stage.total_value)}
                {!stage.is_terminal && ` · max ${stage.max_duration_days}j`}
              </Typography>

              <Box sx={{ flex: 1, overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
                {stage.opportunities.length === 0 ? (
                  <Box
                    sx={{
                      border: `2px dashed ${T.n200}`,
                      borderRadius: 3,
                      py: 3,
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: T.n300 }}>
                      Déposer ici
                    </Typography>
                  </Box>
                ) : (
                  stage.opportunities.map((op) => {
                    const cfg = PS[op.status] || PS.on_track;
                    const tm = op.time_metrics || {};
                    const pct2 = Math.min(100, tm.pct_elapsed || 0);
                    const ts = op.tasks_summary || {};
                    const sc = op.stage_completion || {};
                    const isExp = expandedCard === op.id;

                    // MODIFICATION 4b: draggable conditionnel et cursor modifié
                    return (
                      <KCard
                        key={op.id}
                        pstatus={op.status}
                        isexpanded={isExp ? "true" : "false"}
                        iscommercial={currentUser?.role === "COMMERCIAL" ? "true" : "false"}
                        draggable={currentUser?.role !== "COMMERCIAL"}
                        onDragStart={(e) => onDragStart(e, op)}
                        onDragEnd={onDragEnd}
                        elevation={0}
                        sx={{ mb: 1, opacity: dragCard?.id === op.id ? 0.4 : 1 }}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          mb={0.5}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            fontSize={12.5}
                            sx={{ flex: 1, pr: 0.5, lineHeight: 1.3 }}
                          >
                            {op.opportunity_name}
                          </Typography>
                          <SPill pstatus={op.status} sx={{ fontSize: 9, flexShrink: 0 }}>
                            {cfg.icon}
                          </SPill>
                        </Box>
                        <Typography
                          variant="body1"
                          fontWeight={900}
                          sx={{ color: T.primary, fontSize: 14, mb: 0.8 }}
                        >
                          {fmtMoney(op.opportunity_amount)}
                        </Typography>

                        {tm.max_days > 0 && (
                          <Box mb={0.8}>
                            <Box display="flex" justifyContent="space-between" mb={0.3}>
                              <Typography sx={{ fontSize: 9, color: T.n400 }}>
                                {fmtDays(tm.elapsed_days)} écoulés
                              </Typography>
                              <Typography sx={{ fontSize: 9, color: T.n400 }}>
                                {fmtDays(tm.remaining_days)} restants
                              </Typography>
                            </Box>
                            <TBar pct={pct2} pstatus={op.status} />
                          </Box>
                        )}

                        {ts.total > 0 && (
                          <Box mb={0.8}>
                            <Box display="flex" justifyContent="space-between" mb={0.3}>
                              <Typography sx={{ fontSize: 9, color: T.n400 }}>Tâches</Typography>
                              <Typography
                                sx={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: sc.can_advance ? T.success : T.warning,
                                }}
                              >
                                {ts.done}/{ts.total}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={ts.completion_pct}
                              sx={{
                                height: 3,
                                borderRadius: 2,
                                bgcolor: alpha(T.success, 0.15),
                                "& .MuiLinearProgress-bar": {
                                  bgcolor: sc.can_advance ? T.success : T.warning,
                                  borderRadius: 2,
                                },
                              }}
                            />
                          </Box>
                        )}

                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box display="flex" gap={0.5} alignItems="center">
                            {!sc.can_advance && ts.total > 0 && (
                              <Tooltip title={`${sc.blocking_tasks?.length} tâche(s) bloquante(s)`}>
                                <LockIcon sx={{ fontSize: 13, color: T.warning }} />
                              </Tooltip>
                            )}
                            {sc.can_advance && !stage.is_terminal && (
                              <Tooltip title="Prêt à avancer">
                                <LockOpenIcon sx={{ fontSize: 13, color: T.success }} />
                              </Tooltip>
                            )}
                            {op.alerts_count > 0 && (
                              <Chip
                                icon={<WarningIcon sx={{ fontSize: "10px !important" }} />}
                                label={op.alerts_count}
                                size="small"
                                sx={{
                                  height: 17,
                                  fontSize: 9,
                                  bgcolor: alpha(T.warning, 0.1),
                                  color: T.warning,
                                  "& .MuiChip-label": { px: 0.5 },
                                  "& .MuiChip-icon": { ml: 0.5 },
                                }}
                              />
                            )}
                          </Box>
                          <Box display="flex" gap={0.5} alignItems="center">
                            <Tooltip title={isExp ? "Masquer les tâches" : "Voir les tâches"}>
                              <IconButton
                                size="small"
                                onClick={() => setExpandedCard(isExp ? null : op.id)}
                                sx={{
                                  width: 20,
                                  height: 20,
                                  color: isExp ? T.info : T.n400,
                                  bgcolor: isExp ? alpha(T.info, 0.1) : T.n100,
                                }}
                              >
                                <TaskIcon sx={{ fontSize: 11 }} />
                              </IconButton>
                            </Tooltip>
                            {/* MODIFICATION 4c: Masquer le bouton "Déplacer" pour les commerciaux */}
                            {!stage.is_terminal && currentUser?.role !== "COMMERCIAL" && (
                              <Tooltip title="Déplacer vers une étape">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setMoveDialog({ open: true, op });
                                    setMoveStageId("");
                                    setMoveNotes("");
                                    setMoveForce(false);
                                    setMoveWarning(null);
                                  }}
                                  sx={{
                                    width: 20,
                                    height: 20,
                                    color: T.primary,
                                    bgcolor: alpha(T.primary, 0.08),
                                  }}
                                >
                                  <ArrowIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>

                        {isExp && (
                          <Box mt={1.5} pt={1.5} sx={{ borderTop: `1px solid ${T.border}` }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: T.n400,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                fontSize: 9,
                                letterSpacing: 0.8,
                                display: "block",
                                mb: 1,
                              }}
                            >
                              Tâches de l&apos;étape
                            </Typography>
                            <InlineTaskPanel
                              opPipelineId={op.id}
                              onTaskToggle={(data) => handleTaskToggle(data)}
                            />
                          </Box>
                        )}
                      </KCard>
                    );
                  })
                )}
              </Box>
            </KCol>
          ))}
        </Box>
      )}

      {!loading && kanban && view === "linear" && (
        <Box>
          {kanban.stages.map((stage) =>
            stage.opportunities.length === 0 ? null : (
              <Box key={stage.stage_id} mb={3}>
                <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                  <Box
                    sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: stage.stage_color }}
                  />
                  <Typography variant="body2" fontWeight={700} sx={{ color: T.n600 }}>
                    {stage.stage_name}
                  </Typography>
                  <Chip
                    label={stage.count}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: T.n100,
                      "& .MuiChip-label": { px: 0.8 },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: T.n400 }}>
                    {fmtMoney(stage.total_value)}
                  </Typography>
                </Box>
                {stage.opportunities.map((op) => (
                  <Paper
                    key={op.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: `1px solid ${T.border}`,
                      transition: "all .18s",
                      "&:hover": {
                        boxShadow: `0 4px 16px ${alpha(T.primary, 0.1)}`,
                        borderColor: alpha(T.primary, 0.3),
                      },
                      animation: `${fadeUp} .3s ease`,
                    }}
                  >
                    <Grid container alignItems="center" spacing={1.5}>
                      <Grid item xs={12} md={4}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <SPill pstatus={op.status}>
                            {PS[op.status]?.icon} {PS[op.status]?.label}
                          </SPill>
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              noWrap
                              sx={{ maxWidth: 200 }}
                            >
                              {op.opportunity_name}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: T.primary, fontWeight: 600 }}
                            >
                              {fmtMoney(op.opportunity_amount)}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                          {allStages
                            .filter((s) => !s.is_terminal)
                            .map((s, idx, arr) => (
                              <React.Fragment key={s.stage_id}>
                                <Chip
                                  label={s.stage_name}
                                  size="small"
                                  onClick={() => {
                                    if (currentUser?.role === "COMMERCIAL") return;
                                    setMoveDialog({ open: true, op });
                                    setMoveStageId(s.stage_id.toString());
                                    setMoveNotes("");
                                    setMoveForce(false);
                                    setMoveWarning(null);
                                  }}
                                  sx={{
                                    height: 22,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor:
                                      currentUser?.role === "COMMERCIAL" ? "default" : "pointer",
                                    bgcolor:
                                      s.stage_id === op.current_stage
                                        ? alpha(T.primary, 0.12)
                                        : T.n100,
                                    color: s.stage_id === op.current_stage ? T.primary : T.n500,
                                    border: `1.5px solid ${
                                      s.stage_id === op.current_stage ? T.primary : "transparent"
                                    }`,
                                  }}
                                />
                                {idx < arr.length - 1 && (
                                  <ArrowIcon sx={{ fontSize: 12, color: T.n300, flexShrink: 0 }} />
                                )}
                              </React.Fragment>
                            ))}
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <Box display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
                          {op.tasks_summary?.total > 0 && (
                            <Chip
                              label={`${op.tasks_summary.done}/${op.tasks_summary.total}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontWeight: 600,
                                bgcolor: op.stage_completion?.can_advance
                                  ? alpha(T.success, 0.1)
                                  : alpha(T.warning, 0.1),
                                color: op.stage_completion?.can_advance ? T.success : T.warning,
                              }}
                            />
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Box>
            )
          )}
        </Box>
      )}

      {!loading && !kanban && (
        <Box textAlign="center" py={10}>
          <PipelineIcon sx={{ fontSize: 64, color: T.n200, mb: 2, display: "block", mx: "auto" }} />
          <Typography variant="h6" color="textSecondary">
            Aucun pipeline disponible
          </Typography>
        </Box>
      )}

      <Dialog
        open={moveDialog.open}
        onClose={() => setMoveDialog({ open: false, op: null })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: T.primary }}>
          Déplacer l&apos;opportunité
        </DialogTitle>
        <DialogContent>
          {moveWarning && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {moveWarning.message}
              </Typography>
              {moveWarning.blocking_tasks?.map((t) => (
                <Typography key={t.id} variant="caption" display="block" sx={{ ml: 1 }}>
                  • {t.title}
                </Typography>
              ))}
              <Box mt={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setMoveForce(true)}
                  sx={{ borderRadius: 2, color: T.warning, borderColor: T.warning }}
                >
                  Forcer quand même
                </Button>
              </Box>
            </Alert>
          )}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Étape cible</InputLabel>
            <Select
              value={moveStageId}
              onChange={(e) => setMoveStageId(e.target.value)}
              label="Étape cible"
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">
                <em>— Sélectionner —</em>
              </MenuItem>
              {allStages
                .filter((s) => s.stage_id !== moveDialog.op?.current_stage)
                .map((s) => (
                  <MenuItem key={s.stage_id} value={s.stage_id.toString()}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: s.stage_color }}
                      />
                      {s.is_won ? "✓ " : s.is_terminal ? "✗ " : "→ "}
                      {s.stage_name}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            placeholder="Notes (optionnel)"
            value={moveNotes}
            onChange={(e) => setMoveNotes(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />
          <Box
            mt={1.5}
            p={1.5}
            sx={{
              borderRadius: 2,
              bgcolor: alpha(T.info, 0.06),
              border: `1px solid ${alpha(T.info, 0.2)}`,
            }}
          >
            <Box display="flex" alignItems="center" gap={0.8}>
              <SyncIcon sx={{ fontSize: 14, color: T.info }} />
              <Typography variant="caption" sx={{ color: T.info, fontWeight: 700 }}>
                Le stage CRM sera mis à jour automatiquement
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setMoveDialog({ open: false, op: null })}
            sx={{ borderRadius: 2, color: T.n500 }}
          >
            Annuler
          </Button>
          <GradBtn onClick={confirmMove} disabled={!moveStageId || moving}>
            {moving ? (
              <CircularProgress size={16} sx={{ color: "white" }} />
            ) : moveForce ? (
              "Forcer le déplacement"
            ) : (
              "Confirmer"
            )}
          </GradBtn>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={syncToast.open}
        message={syncToast.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        TransitionComponent={Fade}
        ContentProps={{ sx: { bgcolor: T.success, fontWeight: 700, borderRadius: 3 } }}
      />
    </Box>
  );
};
PipelineView.propTypes = { currentUser: PropTypes.object, onOppStageChanged: PropTypes.func };

// ──────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : Opportunities (Style identique à Prospects)
// ──────────────────────────────────────────────────────────────
export default function Opportunities() {
  const navigate = useNavigate();
  useTrackActivity("opportunities");

  const [currentUser, setCurrentUser] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [commercials, setCommercials] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [mainTab, setMainTab] = useState("opportunities");
  const [pipelineAlerts, setPipelineAlerts] = useState(0);
  const [viewMode, setViewMode] = useState("table");

  const [formOpen, setFormOpen] = useState(false);
  const [editOpp, setEditOpp] = useState(null);
  const [detailOpp, setDetailOpp] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [delDialogId, setDelDialogId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});
  const [localFilters, setLocalFilters] = useState({});
  const [sortBy, setSortBy] = useState("-created_at");
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [syncingIds, setSyncingIds] = useState(new Set());

  // Compte le nombre de filtres actifs pour le badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.stage?.length) count += filters.stage.length;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    return count;
  }, [filters]);

  const hookFilters = useMemo(() => {
    const f = { ordering: sortBy };
    if (searchTerm) f.search = searchTerm;
    if (filters.stage?.length) f.stage = filters.stage.join(",");
    if (filters.minAmount) f.amount__gte = filters.minAmount;
    if (filters.maxAmount) f.amount__lte = filters.maxAmount;
    return f;
  }, [searchTerm, filters, sortBy]);

  const {
    data: oppsList,
    loading,
    total,
    pages,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: setHookFilters,
    refresh,
  } = usePaginatedList("/opportunities/", 10);

  useEffect(() => {
    setHookFilters(hookFilters);
  }, [hookFilters]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      navigate("/sign-in");
      return;
    }
    axios
      .get(API_USER_ME, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => {
        setCurrentUser(r.data);
        loadSupport(r.data, t);
      })
      .catch(() => navigate("/sign-in"));
  }, []);

  useEffect(() => {
    api
      .get("/pipeline-alerts/summary/")
      .then((r) => setPipelineAlerts(r.data.total_unread || 0))
      .catch(() => {});
  }, [mainTab]);

  const loadSupport = async (user, t) => {
    try {
      const reqs = [api.get("/prospects/"), api.get("/contacts/")];
      if (user.role === "ADMIN" || user.role === "MANAGER")
        reqs.push(axios.get(API_ASSIGN, { headers: { Authorization: `Bearer ${t}` } }));
      const [pRes, cRes, uRes] = await Promise.all(reqs);
      setProspects(pRes.data.results || pRes.data);
      setContacts(cRes.data.results || cRes.data);
      if (uRes)
        setCommercials((uRes.data.results || uRes.data).filter((u) => u.role === "COMMERCIAL"));
    } catch {}
  };

  const notify = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };

  // MODIFICATION 3: handleStageChangeFromTable avec vérification des tâches pour les commerciaux
  const handleStageChangeFromTable = useCallback(
    async (opp, newStage) => {
      if (opp.stage === newStage) return;

      // ── Blocage commercial : vérifier les tâches avant de changer de stage ──
      if (currentUser?.role === "COMMERCIAL") {
        try {
          const tasksRes = await api.get("/tasks/", {
            params: { opportunity: opp.id, page_size: 100 },
          });
          const tasks = tasksRes.data.results || tasksRes.data;
          const blocking = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
          if (blocking.length > 0) {
            notify(
              `🔒 Terminez d'abord vos ${blocking.length} tâche(s) avant de changer de stage.`,
              "error"
            );
            return;
          }
        } catch {
          // Si erreur API on laisse passer
        }
      }

      const oppId = opp.id;
      setSyncingIds((prev) => new Set([...prev, oppId]));

      try {
        await api.patch(`/opportunities/${oppId}/`, { stage: newStage });

        try {
          const syncRes = await api.post(`/opportunities/${oppId}/sync-pipeline/`);
          if (syncRes.data.synced) {
            notify(
              `✅ Stage mis à jour → ${stageLabel(newStage)} · Pipeline synchronisé (${
                syncRes.data.pipeline_info?.stage_name
              })`
            );
          } else {
            notify(`✅ Stage mis à jour → ${stageLabel(newStage)}`);
          }
        } catch {
          notify(`✅ Stage mis à jour → ${stageLabel(newStage)}`);
        }

        refresh();
      } catch (e) {
        notify(e.response?.data?.detail || "Erreur lors de la mise à jour", "error");
      } finally {
        setSyncingIds((prev) => {
          const n = new Set(prev);
          n.delete(oppId);
          return n;
        });
      }
    },
    [refresh, currentUser]
  );

  const handleDelete = async () => {
    try {
      await api.delete(`/opportunities/${delDialogId}/`);
      notify("Opportunité supprimée");
      refresh();
    } catch {
      notify("Erreur lors de la suppression", "error");
    }
    setDelDialogId(null);
  };

  const exportToCSV = () => {
    const headers = [
      "Nom",
      "Prospect / Contact",
      "Commercial",
      "Montant",
      "Stage & Pipeline",
      "Date création",
      "Date clôture",
    ];
    const data = oppsList.map((opp) => {
      const entity = opp.prospect
        ? prospects.find((p) => p.id === opp.prospect)
        : contacts.find((c) => c.id === opp.contact);
      const entityName = entity ? `${entity.first_name} ${entity.last_name}` : "—";
      const stageAndPipeline = opp.pipeline_info
        ? `${stageLabel(opp.stage)} → ${opp.pipeline_info.stage_name} (${
            PS[opp.pipeline_info.status]?.label || ""
          })`
        : stageLabel(opp.stage);
      return [
        opp.name,
        entityName,
        opp.assigned_to_detail?.username || "—",
        opp.amount || "0",
        stageAndPipeline,
        fmtDate(opp.created_at),
        opp.expected_close_date ? fmtDate(opp.expected_close_date) : "—",
      ];
    });
    const csvContent = [headers.join(";"), ...data.map((row) => row.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `opportunites_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Export CSV effectué");
  };

  const stats = useMemo(
    () => ({
      total,
      totalAmt: oppsList.reduce((s, o) => s + parseFloat(o.amount || 0), 0),
      won: oppsList.filter((o) => o.stage === "won").length,
      negoc: oppsList.filter((o) => o.stage === "negotiation").length,
    }),
    [oppsList, total]
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
            <CircularProgress sx={{ color: T.primary }} />
            <Typography sx={{ mt: 2, color: "white", fontWeight: 500 }}>
              Chargement des opportunités...
            </Typography>
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

        {/* En-tête - Style identique à Prospects */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: T.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              Gestion des opportunités
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {total} opportunité(s) au total
            </Typography>
          </Box>
          {mainTab === "opportunities" && (
            <GradBtn
              startIcon={<AddIcon />}
              onClick={() => {
                setEditOpp(null);
                setFormOpen(true);
              }}
            >
              Nouvelle opportunité
            </GradBtn>
          )}
        </Box>

        {/* Tabs */}
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          sx={{
            mb: 3,
            borderBottom: `1px solid ${T.n200}`,
            "& .Mui-selected": { color: `${T.primary} !important`, fontWeight: 700 },
            "& .MuiTabs-indicator": { bgcolor: T.primary, height: 3, borderRadius: "3px 3px 0 0" },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: 14,
              minHeight: 48,
              px: 2.5,
            },
          }}
        >
          <Tab
            value="opportunities"
            label="Opportunités"
            icon={<TimelineIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
          />
          <Tab
            value="pipeline"
            label={
              <Box display="flex" alignItems="center" gap={1}>
                Pipeline intelligent
                {pipelineAlerts > 0 && (
                  <Badge
                    badgeContent={pipelineAlerts}
                    color="error"
                    max={9}
                    sx={{ "& .MuiBadge-badge": { fontSize: 9, minWidth: 16, height: 16 } }}
                  >
                    <Box sx={{ width: 4 }} />
                  </Badge>
                )}
              </Box>
            }
            icon={<PipelineIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
          />
        </Tabs>

        {/* ── OPPORTUNITIES TAB ── */}
        {mainTab === "opportunities" && (
          <>
            {/* Stats Cards - Style identique à Prospects */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                {
                  title: "Total opportunités",
                  value: stats.total,
                  icon: <TimelineIcon />,
                  color: T.primary,
                  chips: [
                    { label: `${stats.won} Gagnées`, color: T.success, filter: { stage: ["won"] } },
                    {
                      label: `${stats.negoc} Négociation`,
                      color: T.warning,
                      filter: { stage: ["negotiation"] },
                    },
                  ],
                },
                {
                  title: "Montant total",
                  value: fmtMoney(stats.totalAmt),
                  icon: <MoneyIcon />,
                  color: T.success,
                  chips: [
                    {
                      label: "À gagner",
                      color: T.primary,
                      filter: { stage: ["new", "qualified", "proposal", "negotiation"] },
                    },
                  ],
                },
                {
                  title: "Taux conversion",
                  value: stats.total ? `${Math.round((stats.won / stats.total) * 100)}%` : "0%",
                  icon: <TrendingUpIcon />,
                  color: T.warning,
                  chips: [
                    { label: `${stats.won} Gagnées`, color: T.success, filter: { stage: ["won"] } },
                    {
                      label: `${stats.total - stats.won - stats.negoc} À traiter`,
                      color: T.info,
                      filter: { stage: ["new", "qualified", "proposal"] },
                    },
                  ],
                },
                {
                  title: "Pipeline actif",
                  value: pipelineAlerts > 0 ? `${pipelineAlerts} alertes` : "Sain",
                  icon: <PipelineIcon />,
                  color: pipelineAlerts > 0 ? T.warning : T.success,
                  chips:
                    pipelineAlerts > 0
                      ? [
                          {
                            label: `${pipelineAlerts} alerte(s)`,
                            color: T.warning,
                            filter: {},
                          },
                        ]
                      : [],
                },
              ].map((card, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <StatsCardItem
                    title={card.title}
                    value={card.value}
                    icon={card.icon}
                    color={card.color}
                    onClick={() => {
                      if (card.chips[0]?.filter) setFilters(card.chips[0].filter);
                    }}
                  >
                    {card.chips.map((chip, j) => (
                      <Chip
                        key={j}
                        size="small"
                        label={chip.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilters(chip.filter);
                        }}
                        sx={{
                          bgcolor: alpha(chip.color, 0.1),
                          color: chip.color,
                          borderRadius: 1,
                          border: `1px solid ${chip.color}`,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </StatsCardItem>
                </Grid>
              ))}
            </Grid>

            {/* Barre de recherche + filtres actifs - Style identique à Prospects */}
            <StyledCard sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      placeholder="Rechercher une opportunité..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      size="small"
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: T.primary }} />
                          </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSearchTerm("")}>
                              <ClearIcon sx={{ fontSize: 18, color: T.primary }} />
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
                          { mode: "table", icon: <ViewColumnIcon /> },
                          { mode: "cards", icon: <BarChartIcon /> },
                        ].map((v) => (
                          <Button
                            key={v.mode}
                            onClick={() => setViewMode(v.mode)}
                            sx={{
                              bgcolor: viewMode === v.mode ? alpha(T.primary, 0.1) : "transparent",
                              color: viewMode === v.mode ? T.primary : "text.secondary",
                              borderColor: alpha(T.primary, 0.3),
                            }}
                          >
                            {v.icon}
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
                              borderColor: alpha(T.primary, 0.3),
                            },
                          }}
                        >
                          <MenuItem value="-created_at">Date création ↓</MenuItem>
                          <MenuItem value="created_at">Date création ↑</MenuItem>
                          <MenuItem value="name">Nom A→Z</MenuItem>
                          <MenuItem value="-amount">Montant ↓</MenuItem>
                          <MenuItem value="stage">Stage CRM</MenuItem>
                        </Select>
                      </FormControl>
                      <Badge
                        color="error"
                        badgeContent={activeFilterCount}
                        invisible={activeFilterCount === 0}
                      >
                        <Button
                          variant="outlined"
                          startIcon={<FilterIcon />}
                          onClick={() => setFilterDrawer(true)}
                          size="small"
                          sx={{
                            borderRadius: 3,
                            borderColor: activeFilterCount > 0 ? T.primary : alpha(T.primary, 0.3),
                            color: T.primary,
                            bgcolor: activeFilterCount > 0 ? alpha(T.primary, 0.05) : "transparent",
                          }}
                        >
                          Filtres
                        </Button>
                      </Badge>
                      <ExportMenu onExportCSV={exportToCSV} />
                      <Tooltip title="Rafraîchir">
                        <IconButton
                          size="small"
                          onClick={refresh}
                          sx={{
                            color: T.primary,
                            border: `1px solid ${alpha(T.primary, 0.3)}`,
                            borderRadius: 2,
                          }}
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                </Grid>

                {/* Chips des filtres actifs - Style identique à Prospects */}
                {activeFilterCount > 0 && (
                  <Box mt={2} display="flex" flexWrap="wrap" gap={0.5} alignItems="center">
                    <Typography variant="caption" color="textSecondary" sx={{ mr: 1 }}>
                      Filtres actifs :
                    </Typography>
                    {filters.stage?.map((v) => (
                      <Chip
                        key={`s-${v}`}
                        label={`Stage: ${stageLabel(v)}`}
                        size="small"
                        onDelete={() =>
                          setFilters({
                            ...filters,
                            stage: filters.stage.filter((x) => x !== v),
                          })
                        }
                        sx={{
                          borderRadius: 1,
                          bgcolor: alpha(stageColor(v), 0.1),
                          color: stageColor(v),
                          border: `1px solid ${alpha(stageColor(v), 0.3)}`,
                          fontSize: "0.72rem",
                        }}
                      />
                    ))}
                    {filters.minAmount && (
                      <Chip
                        label={`Montant ≥ ${fmtMoney(filters.minAmount)}`}
                        size="small"
                        onDelete={() => setFilters({ ...filters, minAmount: null })}
                        sx={{
                          borderRadius: 1,
                          bgcolor: alpha(T.success, 0.1),
                          color: T.success,
                          border: `1px solid ${alpha(T.success, 0.3)}`,
                          fontSize: "0.72rem",
                        }}
                      />
                    )}
                    {filters.maxAmount && (
                      <Chip
                        label={`Montant ≤ ${fmtMoney(filters.maxAmount)}`}
                        size="small"
                        onDelete={() => setFilters({ ...filters, maxAmount: null })}
                        sx={{
                          borderRadius: 1,
                          bgcolor: alpha(T.success, 0.1),
                          color: T.success,
                          border: `1px solid ${alpha(T.success, 0.3)}`,
                          fontSize: "0.72rem",
                        }}
                      />
                    )}
                    <Chip
                      label="Tout effacer"
                      size="small"
                      onClick={() => setFilters({})}
                      sx={{
                        borderRadius: 1,
                        bgcolor: alpha(T.primary, 0.1),
                        color: T.primary,
                        border: `1px solid ${alpha(T.primary, 0.3)}`,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </StyledCard>

            {/* Tableau - Style identique à Prospects */}
            <StyledCard>
              <StyledTableContainer>
                <Table>
                  <StyledTableHead>
                    <TableRow>
                      {[
                        "Opportunité",
                        "Prospect / Contact",
                        "Commercial",
                        "Montant",
                        "Stage & Pipeline", // MODIFICATION 1: Colonne fusionnée
                        "Actions",
                      ].map((h) => (
                        <TableCell key={h}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </StyledTableHead>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          <CircularProgress sx={{ color: T.primary }} />
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && oppsList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                          <Box textAlign="center">
                            <TimelineIcon
                              sx={{
                                fontSize: 48,
                                color: alpha(T.primary, 0.3),
                                mb: 2,
                              }}
                            />
                            <Typography variant="h6" color="textSecondary" gutterBottom>
                              Aucune opportunité trouvée
                            </Typography>
                            <GradBtn
                              size="small"
                              startIcon={<AddIcon />}
                              sx={{ mt: 2 }}
                              onClick={() => {
                                setEditOpp(null);
                                setFormOpen(true);
                              }}
                            >
                              Créer une opportunité
                            </GradBtn>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                    {oppsList.map((opp) => {
                      const entity = opp.prospect
                        ? prospects.find((p) => p.id === opp.prospect)
                        : contacts.find((c) => c.id === opp.contact);
                      const entityName = entity ? `${entity.first_name} ${entity.last_name}` : "—";
                      const entityType = opp.prospect ? "Prospect" : opp.contact ? "Contact" : null;
                      const isSyncing = syncingIds.has(opp.id);

                      return (
                        <StyledTableRow
                          key={opp.id}
                          onDoubleClick={() => {
                            setDetailOpp(opp);
                            setDetailOpen(true);
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {opp.name}
                            </Typography>
                            {opp.notes && (
                              <Typography
                                variant="caption"
                                color="textSecondary"
                                noWrap
                                sx={{ maxWidth: 180, display: "block" }}
                              >
                                {opp.notes}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: alpha(T.primary, 0.1),
                                  color: T.primary,
                                }}
                              >
                                {opp.prospect ? (
                                  <BusinessIcon sx={{ fontSize: 14 }} />
                                ) : (
                                  <PersonIcon sx={{ fontSize: 14 }} />
                                )}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {entityName}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {entityType}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {opp.assigned_to_detail ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Avatar
                                  sx={{
                                    width: 26,
                                    height: 26,
                                    bgcolor: alpha(T.info, 0.12),
                                    color: T.info,
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  {opp.assigned_to_detail.username?.[0]?.toUpperCase()}
                                </Avatar>
                                <Typography variant="body2" fontWeight={600}>
                                  {opp.assigned_to_detail.username}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="textSecondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700} sx={{ color: T.primary }}>
                              {fmtMoney(opp.amount)}
                            </Typography>
                          </TableCell>

                          {/* MODIFICATION 2: Colonne fusionnée Stage & Pipeline */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Box display="flex" flexDirection="column" gap={0.6}>
                              {/* Selector Stage CRM — bloqué pour commercial si tâches non terminées */}
                              <Box display="flex" alignItems="center" gap={0.8}>
                                {isSyncing && <CircularProgress size={12} sx={{ color: T.info }} />}
                                <Select
                                  size="small"
                                  value={opp.stage}
                                  onChange={(e) => handleStageChangeFromTable(opp, e.target.value)}
                                  disabled={
                                    isSyncing ||
                                    (currentUser?.role === "COMMERCIAL" &&
                                      opp.pipeline_info &&
                                      opp.pipeline_info.status !== "won" &&
                                      opp.pipeline_info.status !== "lost")
                                  }
                                  sx={{
                                    borderRadius: 2,
                                    height: 28,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    bgcolor: alpha(stageColor(opp.stage), 0.08),
                                    color: stageColor(opp.stage),
                                    "& .MuiOutlinedInput-notchedOutline": {
                                      borderColor: alpha(stageColor(opp.stage), 0.3),
                                    },
                                    "& .MuiSelect-select": { py: 0.5, pl: 1 },
                                    "& .MuiSvgIcon-root": {
                                      color: stageColor(opp.stage),
                                      fontSize: 16,
                                    },
                                  }}
                                >
                                  {[
                                    "new",
                                    "qualified",
                                    "proposal",
                                    "negotiation",
                                    "won",
                                    "lost",
                                  ].map((s) => (
                                    <MenuItem key={s} value={s}>
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                        <Box
                                          sx={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: "50%",
                                            bgcolor: stageColor(s),
                                          }}
                                        />
                                        <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
                                          {stageLabel(s)}
                                        </Typography>
                                      </Box>
                                    </MenuItem>
                                  ))}
                                </Select>
                                {isSyncing && (
                                  <SyncBadge sx={{ bgcolor: alpha(T.info, 0.1), color: T.info }}>
                                    <SyncIcon
                                      sx={{ fontSize: 10, animation: `${spin} 1s linear infinite` }}
                                    />
                                    Synchro...
                                  </SyncBadge>
                                )}
                                {/* Icône verrou pour le commercial si pipeline actif */}
                                {currentUser?.role === "COMMERCIAL" &&
                                  opp.pipeline_info &&
                                  opp.pipeline_info.status !== "won" &&
                                  opp.pipeline_info.status !== "lost" && (
                                    <Tooltip title="Terminez vos tâches pour changer de stage">
                                      <LockIcon sx={{ fontSize: 14, color: T.warning }} />
                                    </Tooltip>
                                  )}
                              </Box>

                              {/* Info pipeline sous le selector */}
                              {opp.pipeline_info ? (
                                <Box display="flex" alignItems="center" gap={0.7}>
                                  <Box
                                    sx={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      bgcolor: opp.pipeline_info.stage_color || T.info,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Typography
                                    variant="caption"
                                    sx={{ color: T.muted, fontSize: 10, fontWeight: 600 }}
                                    noWrap
                                  >
                                    {opp.pipeline_info.stage_name}
                                  </Typography>
                                  <SPill
                                    pstatus={opp.pipeline_info.status}
                                    sx={{ fontSize: 8, py: 0.2, px: 0.6 }}
                                  >
                                    {PS[opp.pipeline_info.status]?.label}
                                  </SPill>
                                </Box>
                              ) : (
                                <Typography variant="caption" sx={{ color: T.light, fontSize: 10 }}>
                                  Hors pipeline
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              {[
                                {
                                  icon: <VisibilityIcon sx={{ fontSize: 16 }} />,
                                  color: "#0288d1",
                                  title: "Voir",
                                  onClick: () => {
                                    setDetailOpp(opp);
                                    setDetailOpen(true);
                                  },
                                },
                                {
                                  icon: <EditIcon sx={{ fontSize: 16 }} />,
                                  color: "#1976d2",
                                  title: "Modifier",
                                  onClick: () => {
                                    setEditOpp(opp);
                                    setFormOpen(true);
                                  },
                                },
                                {
                                  icon: <DeleteIcon sx={{ fontSize: 16 }} />,
                                  color: T.error,
                                  title: "Supprimer",
                                  onClick: () => setDelDialogId(opp.id),
                                },
                              ].map((btn, i) => (
                                <Tooltip key={i} title={btn.title}>
                                  <IconButton
                                    size="small"
                                    onClick={btn.onClick}
                                    sx={{
                                      width: 30,
                                      height: 30,
                                      color: btn.color,
                                      bgcolor: alpha(btn.color, 0.1),
                                    }}
                                  >
                                    {btn.icon}
                                  </IconButton>
                                </Tooltip>
                              ))}
                            </Box>
                          </TableCell>
                        </StyledTableRow>
                      );
                    })}
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
          </>
        )}

        {/* ── PIPELINE TAB ── */}
        {mainTab === "pipeline" && (
          <PipelineView currentUser={currentUser} onOppStageChanged={refresh} />
        )}

        {/* Drawers & dialogs */}
        <CreateOpportunityDrawer
          open={formOpen}
          editOpp={editOpp}
          onClose={() => {
            setFormOpen(false);
            setEditOpp(null);
          }}
          onSaved={() => {
            refresh();
            notify(editOpp ? "Opportunité modifiée !" : "Opportunité créée et liée au pipeline !");
          }}
          prospects={prospects}
          contacts={contacts}
          commercials={commercials}
          currentUser={currentUser}
        />

        <OpportunityDetailDrawer
          open={detailOpen}
          opp={detailOpp}
          onClose={() => setDetailOpen(false)}
          onRefresh={refresh}
        />

        {/* Drawer filtres */}
        <Drawer
          anchor="right"
          open={filterDrawer}
          onClose={() => setFilterDrawer(false)}
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
                background: T.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Filtres avancés
            </Typography>
            <IconButton
              onClick={() => setFilterDrawer(false)}
              sx={{ bgcolor: alpha(T.primary, 0.1) }}
            >
              <CloseIcon sx={{ color: T.primary }} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Stage CRM</InputLabel>
                <Select
                  multiple
                  value={localFilters.stage || []}
                  onChange={(e) => setLocalFilters({ ...localFilters, stage: e.target.value })}
                  label="Stage CRM"
                  renderValue={(sel) => (
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {sel.map((v) => (
                        <Chip
                          key={v}
                          label={stageLabel(v)}
                          size="small"
                          sx={{
                            bgcolor: alpha(stageColor(v), 0.1),
                            color: stageColor(v),
                            borderRadius: 1,
                          }}
                        />
                      ))}
                    </Box>
                  )}
                >
                  {["new", "qualified", "proposal", "negotiation", "won", "lost"].map((s) => (
                    <MenuItem key={s} value={s}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: stageColor(s) }}
                        />
                        {stageLabel(s)}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Montant min (DT)"
                value={localFilters.minAmount || ""}
                onChange={(e) => setLocalFilters({ ...localFilters, minAmount: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Montant max (DT)"
                value={localFilters.maxAmount || ""}
                onChange={(e) => setLocalFilters({ ...localFilters, maxAmount: e.target.value })}
              />
            </Grid>
          </Grid>
          <Box mt={4} display="flex" gap={2} justifyContent="space-between">
            <Button
              onClick={() => {
                setLocalFilters({});
                setFilters({});
                setFilterDrawer(false);
              }}
              variant="outlined"
              sx={{ borderRadius: 3, borderColor: alpha(T.primary, 0.3), color: T.primary }}
            >
              Réinitialiser
            </Button>
            <Box display="flex" gap={1}>
              <Button
                onClick={() => setFilterDrawer(false)}
                variant="outlined"
                sx={{ borderRadius: 3, borderColor: alpha(T.primary, 0.3), color: T.primary }}
              >
                Annuler
              </Button>
              <GradBtn
                onClick={() => {
                  setFilters(localFilters);
                  setFilterDrawer(false);
                }}
                sx={{ borderRadius: 3 }}
              >
                Appliquer
              </GradBtn>
            </Box>
          </Box>
        </Drawer>

        {/* Dialog suppression */}
        <Dialog
          open={!!delDialogId}
          onClose={() => setDelDialogId(null)}
          PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
        >
          <DialogTitle sx={{ color: T.error, fontWeight: 700 }}>
            Confirmer la suppression
          </DialogTitle>
          <DialogContent>
            <Typography>Cette action est irréversible. Continuer ?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDelDialogId(null)} sx={{ borderRadius: 2 }}>
              Annuler
            </Button>
            <Button
              onClick={handleDelete}
              variant="contained"
              sx={{ background: T.gradient, borderRadius: 2, px: 3 }}
            >
              Supprimer
            </Button>
          </DialogActions>
        </Dialog>
      </MDBox>
    </DashboardLayout>
  );
}
