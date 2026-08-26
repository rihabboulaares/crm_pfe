/* eslint-disable prettier/prettier */
// src/pages/modules/TasksPage.jsx — Style identique à Prospects
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
// LIGNE 17 - Modifier le chemin d'import
import {
  syncTaskToCalendar,
  updateCalendarEventFromTask,
  deleteCalendarEventByTaskId,
} from "../../components/calendarSyncService";
import axios from "axios";
import {
  Grid,
  TextField,
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
  Tabs,
  Tab,
  Backdrop,
  CircularProgress,
  ButtonGroup,
  alpha,
  Paper,
  MenuItem,
  List,
  ListItem,
  ListItemAvatar,
  TextareaAutosize,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
  Sort as SortIcon,
  ViewColumn as ViewColumnIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  Flag as FlagIcon,
  CalendarToday as CalendarIcon,
  PlayArrow as PlayArrowIcon,
  BarChart as BarChartIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Note as NoteIcon,
  Chat as ChatIcon,
  Send as SendIcon,
  CheckCircleOutline as CloseTaskIcon,
  Groups as MeetingIcon,
  SubdirectoryArrowRight as FollowUpIcon,
  AddCircleOutline as IncrementIcon,
  People as PeopleIcon,
  PersonOutline as PersonOutlineIcon,
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
const API_BASE_URL = "/api/sales";
const API_ASSIGNABLE_USERS_URL = "/api/users/assignable-users/";

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
// THEME (IDENTIQUE À PROSPECTS)
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
// STYLES (IDENTIQUES À PROSPECTS)
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
  "& .MuiTable-root": { width: "100%", minWidth: 1200, borderCollapse: "collapse" },
}));

const StyledTableHead = styled(TableHead)(() => ({
  "& .MuiTableCell-head": {
    height: 58,
    fontWeight: 900,
    color: THEME.primary,
    fontSize: "0.76rem",
    lineHeight: 1.2,
    padding: "0 18px",
    backgroundColor: alpha(THEME.primary, 0.04),
    borderBottom: `2px solid ${THEME.primary}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0,
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
}));

const StyledTableRow = styled(TableRow)(() => ({
  "&:hover": { backgroundColor: alpha(THEME.primary, 0.02), cursor: "pointer" },
  "& td": {
    height: 74,
    padding: "12px 18px",
    borderBottom: `1px solid ${alpha("#000", 0.05)}`,
    verticalAlign: "middle",
  },
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

const PriorityChip = styled(Chip)(({ priority }) => ({
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.75rem",
  height: 24,
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
}));

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

// ==============================
// UTILS
// ==============================
const getPriorityLabel = (p) => ({ high: "Haute", medium: "Moyenne", low: "Basse" }[p] || p);
const getStatusLabel = (s) =>
  ({
    todo: "A faire",
    pending: "En attente",
    ready: "Pret",
    in_progress: "En cours",
    done: "Termine",
    completed: "Termine",
    cancelled: "Annule",
    failed: "Echec",
  }[s] || s);
const getTaskTypeLabel = (t) =>
  ({
    classic: "Classique",
    quota: "Quota",
    call: "Telephone",
    linkedin_message: "LinkedIn",
    email: "Email",
    facebook_message: "Facebook",
    instagram_message: "Instagram",
    follow_up: "Relance",
    meeting: "RDV",
    note: "Note",
  }[t] || t);
const getActivityTypeLabel = (t) =>
  ({ call: "Appel", email: "Email", note: "Note", meeting: "Meeting", status_change: "Statut" }[
    t
  ] || t);
const getCallResultLabel = (r) =>
  ({
    interested: "Intéressé",
    callback: "Rappel demandé",
    not_interested: "Pas intéressé",
    no_answer: "Pas de réponse",
    voicemail: "Messagerie",
  }[r] || r);
const getStatusIcon = (status) =>
  ({
    todo: <ScheduleIcon sx={{ fontSize: 16 }} />,
    pending: <ScheduleIcon sx={{ fontSize: 16 }} />,
    ready: <CheckCircleIcon sx={{ fontSize: 16 }} />,
    in_progress: <PlayArrowIcon sx={{ fontSize: 16 }} />,
    done: <CheckCircleIcon sx={{ fontSize: 16 }} />,
    completed: <CheckCircleIcon sx={{ fontSize: 16 }} />,
    cancelled: <CancelIcon sx={{ fontSize: 16 }} />,
    failed: <CancelIcon sx={{ fontSize: 16 }} />,
  }[status] || null);
const getStatusColor = (status) =>
  ({ todo: THEME.info, in_progress: THEME.warning, done: THEME.success, cancelled: THEME.error }[
    status
  ] || "#9e9e9e");
const getActivityIcon = (type) =>
  ({
    call: <PhoneIcon sx={{ fontSize: 16 }} />,
    email: <EmailIcon sx={{ fontSize: 16 }} />,
    note: <NoteIcon sx={{ fontSize: 16 }} />,
    meeting: <MeetingIcon sx={{ fontSize: 16 }} />,
    status_change: <CheckCircleIcon sx={{ fontSize: 16 }} />,
  }[type] || <NoteIcon sx={{ fontSize: 16 }} />);
const getActivityColor = (type) =>
  ({
    call: "#2196f3",
    email: "#9c27b0",
    note: "#ff9800",
    meeting: "#009688",
    status_change: "#4caf50",
  }[type] || "#9e9e9e");
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const formatDateShort = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

// ==============================
// QUOTA BAR
// ==============================
const QuotaBar = ({ progress, target }) => {
  const percentage = target ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const color =
    percentage >= 100 ? THEME.success : percentage >= 60 ? THEME.warning : THEME.primary;
  return (
    <Box sx={{ width: "100%" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography variant="caption" color="textSecondary">
          {progress} / {target}
        </Typography>
        <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
          {percentage}%
        </Typography>
      </Box>
      <Box
        sx={{
          height: 8,
          backgroundColor: alpha(THEME.primary, 0.1),
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${percentage}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </Box>
    </Box>
  );
};
QuotaBar.propTypes = { progress: PropTypes.number.isRequired, target: PropTypes.number.isRequired };

// ==============================
// ACTIVITY TIMELINE
// ==============================
const ActivityTimeline = ({ activities, loading }) => {
  if (loading)
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} sx={{ color: THEME.primary }} />
      </Box>
    );
  if (!activities.length)
    return (
      <Box textAlign="center" py={4}>
        <NoteIcon sx={{ fontSize: 40, color: alpha(THEME.primary, 0.3), mb: 1 }} />
        <Typography variant="body2" color="textSecondary">
          Aucune activité enregistrée
        </Typography>
      </Box>
    );
  return (
    <List disablePadding>
      {activities.map((activity, index) => (
        <ListItem
          key={activity.id}
          alignItems="flex-start"
          sx={{
            px: 0,
            pb: 2,
            position: "relative",
            "&::before":
              index < activities.length - 1
                ? {
                    content: '""',
                    position: "absolute",
                    left: 19,
                    top: 44,
                    bottom: 0,
                    width: 2,
                    bgcolor: alpha(getActivityColor(activity.activity_type), 0.2),
                  }
                : {},
          }}
        >
          <ListItemAvatar sx={{ minWidth: 44 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: alpha(getActivityColor(activity.activity_type), 0.12),
                color: getActivityColor(activity.activity_type),
              }}
            >
              {getActivityIcon(activity.activity_type)}
            </Avatar>
          </ListItemAvatar>
          <Box flex={1}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
              <Typography variant="body2" fontWeight={600}>
                {getActivityTypeLabel(activity.activity_type)}
                {activity.call_result && (
                  <Chip
                    label={getCallResultLabel(activity.call_result)}
                    size="small"
                    sx={{
                      ml: 1,
                      height: 18,
                      fontSize: "0.65rem",
                      bgcolor: alpha(getActivityColor(activity.activity_type), 0.1),
                      color: getActivityColor(activity.activity_type),
                    }}
                  />
                )}
              </Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ whiteSpace: "nowrap", ml: 1 }}
              >
                {formatDate(activity.created_at)}
              </Typography>
            </Box>
            {activity.performed_by_detail && (
              <Typography variant="caption" color="textSecondary" display="block" mb={0.5}>
                Par {activity.performed_by_detail.username}
              </Typography>
            )}
            {activity.activity_type === "email" && activity.email_subject && (
              <Box
                sx={{
                  bgcolor: alpha("#9c27b0", 0.05),
                  border: `1px solid ${alpha("#9c27b0", 0.15)}`,
                  borderRadius: 2,
                  p: 1.5,
                  mb: 1,
                }}
              >
                <Typography variant="caption" fontWeight={600} color="#9c27b0" display="block">
                  Objet : {activity.email_subject}
                </Typography>
                {activity.email_sent_to && (
                  <Typography variant="caption" color="textSecondary">
                    À : {activity.email_sent_to}
                  </Typography>
                )}
                {activity.email_sent && (
                  <Chip
                    label="Envoyé"
                    size="small"
                    sx={{
                      ml: 1,
                      height: 16,
                      fontSize: "0.6rem",
                      bgcolor: alpha(THEME.success, 0.1),
                      color: THEME.success,
                    }}
                  />
                )}
              </Box>
            )}
            {activity.activity_type === "meeting" && activity.meeting_date && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 14, color: "#009688" }} />
                <Typography variant="caption" color="textSecondary">
                  {formatDate(activity.meeting_date)}
                  {activity.meeting_location && ` — ${activity.meeting_location}`}
                </Typography>
              </Box>
            )}
            {activity.notes && (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{ bgcolor: alpha("#000", 0.03), borderRadius: 1, p: 1, mt: 0.5 }}
              >
                {activity.notes}
              </Typography>
            )}
          </Box>
        </ListItem>
      ))}
    </List>
  );
};
ActivityTimeline.propTypes = {
  activities: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
};

// ==============================
// ADD ACTIVITY FORM
// ==============================
const AddActivityForm = ({ taskId, onAdded }) => {
  const [type, setType] = useState("call");
  const [form, setForm] = useState({
    notes: "",
    call_result: "",
    call_duration_minutes: "",
    email_subject: "",
    email_body: "",
    email_sent_to: "",
    meeting_date: "",
    meeting_location: "",
  });
  const [loading, setLoading] = useState(false);
  const activityTypes = [
    { value: "call", label: "Appel", icon: <PhoneIcon sx={{ fontSize: 16 }} />, color: "#2196f3" },
    { value: "email", label: "Email", icon: <EmailIcon sx={{ fontSize: 16 }} />, color: "#9c27b0" },
    { value: "note", label: "Note", icon: <NoteIcon sx={{ fontSize: 16 }} />, color: "#ff9800" },
    {
      value: "meeting",
      label: "Meeting",
      icon: <MeetingIcon sx={{ fontSize: 16 }} />,
      color: "#009688",
    },
  ];
  const handleSubmit = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const payload = { task: taskId, activity_type: type, notes: form.notes || "" };
      if (type === "call") {
        if (form.call_result) payload.call_result = form.call_result;
        if (form.call_duration_minutes)
          payload.call_duration_minutes = parseInt(form.call_duration_minutes);
      }
      if (type === "email") {
        payload.email_subject = form.email_subject;
        payload.email_body = form.email_body;
        payload.email_sent_to = form.email_sent_to;
      }
      if (type === "meeting") {
        if (form.meeting_date) payload.meeting_date = form.meeting_date;
        if (form.meeting_location) payload.meeting_location = form.meeting_location;
      }
      const response = await api.post("/task-activities/", payload);
      onAdded(response.data);
      setForm({
        notes: "",
        call_result: "",
        call_duration_minutes: "",
        email_subject: "",
        email_body: "",
        email_sent_to: "",
        meeting_date: "",
        meeting_location: "",
      });
    } catch (err) {
      console.error("Erreur création activité:", err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box sx={{ border: `1px solid ${alpha(THEME.primary, 0.15)}`, borderRadius: 3, p: 2, mt: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ color: THEME.primary, mb: 1.5 }}>
        Enregistrer une activité
      </Typography>
      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        {activityTypes.map((t) => (
          <Chip
            key={t.value}
            icon={t.icon}
            label={t.label}
            onClick={() => setType(t.value)}
            variant={type === t.value ? "filled" : "outlined"}
            sx={{
              cursor: "pointer",
              fontWeight: 600,
              ...(type === t.value
                ? { bgcolor: alpha(t.color, 0.15), color: t.color, border: `1px solid ${t.color}` }
                : { borderColor: alpha("#000", 0.2), color: "text.secondary" }),
            }}
          />
        ))}
      </Box>
      <Stack spacing={1.5}>
        {type === "call" && (
          <>
            <FormControl fullWidth size="small">
              <InputLabel>Résultat de l&apos;appel</InputLabel>
              <Select
                value={form.call_result}
                label="Résultat de l'appel"
                onChange={(e) => setForm({ ...form, call_result: e.target.value })}
              >
                <MenuItem value="interested">Intéressé</MenuItem>
                <MenuItem value="callback">Rappel demandé</MenuItem>
                <MenuItem value="not_interested">Pas intéressé</MenuItem>
                <MenuItem value="no_answer">Pas de réponse</MenuItem>
                <MenuItem value="voicemail">Messagerie vocale</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              label="Durée (minutes)"
              type="number"
              value={form.call_duration_minutes}
              onChange={(e) => setForm({ ...form, call_duration_minutes: e.target.value })}
              inputProps={{ min: 1 }}
            />
          </>
        )}
        {type === "email" && (
          <>
            <TextField
              fullWidth
              size="small"
              label="Destinataire"
              type="email"
              required
              value={form.email_sent_to}
              onChange={(e) => setForm({ ...form, email_sent_to: e.target.value })}
            />
            <TextField
              fullWidth
              size="small"
              label="Objet"
              required
              value={form.email_subject}
              onChange={(e) => setForm({ ...form, email_subject: e.target.value })}
            />
            <TextareaAutosize
              minRows={3}
              placeholder="Corps de l'email..."
              value={form.email_body}
              onChange={(e) => setForm({ ...form, email_body: e.target.value })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                fontFamily: "inherit",
                fontSize: "0.875rem",
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </>
        )}
        {type === "meeting" && (
          <>
            <TextField
              fullWidth
              size="small"
              label="Date du meeting"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={form.meeting_date}
              onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
            />
            <TextField
              fullWidth
              size="small"
              label="Lieu / Lien"
              value={form.meeting_location}
              onChange={(e) => setForm({ ...form, meeting_location: e.target.value })}
            />
          </>
        )}
        <TextareaAutosize
          minRows={2}
          placeholder={type === "note" ? "Votre note..." : "Notes complémentaires..."}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            fontFamily: "inherit",
            fontSize: "0.875rem",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || (type === "email" && (!form.email_sent_to || !form.email_subject))}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{
              background: THEME.gradient,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {type === "email" ? "Envoyer l'email" : "Enregistrer"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};
AddActivityForm.propTypes = {
  taskId: PropTypes.number.isRequired,
  onAdded: PropTypes.func.isRequired,
};

// ==============================
// COMMENTS SECTION
// ==============================
const CommentsSection = ({ taskId, currentUser }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/task-comments/?task_id=${taskId}`);
      setComments(res.data);
    } catch (err) {
      console.error("Erreur chargement commentaires:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);
  const handleSend = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const res = await api.post("/task-comments/", { task: taskId, content: newComment.trim() });
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (err) {
      console.error("Erreur envoi commentaire:", err);
    } finally {
      setSending(false);
    }
  };
  if (loading)
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={24} sx={{ color: THEME.primary }} />
      </Box>
    );
  return (
    <Box>
      <Box sx={{ maxHeight: 320, overflowY: "auto", mb: 2, pr: 0.5 }}>
        {comments.length === 0 ? (
          <Box textAlign="center" py={4}>
            <ChatIcon sx={{ fontSize: 40, color: alpha(THEME.primary, 0.3), mb: 1 }} />
            <Typography variant="body2" color="textSecondary">
              Aucun message. Démarrez la conversation !
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {comments.map((comment) => {
              const isMe = comment.author_detail?.id === currentUser?.id;
              return (
                <Box
                  key={comment.id}
                  display="flex"
                  flexDirection={isMe ? "row-reverse" : "row"}
                  alignItems="flex-end"
                  gap={1}
                >
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      fontSize: "0.7rem",
                      flexShrink: 0,
                      bgcolor: isMe ? alpha(THEME.primary, 0.2) : alpha(THEME.info, 0.2),
                      color: isMe ? THEME.primary : THEME.info,
                    }}
                  >
                    {comment.author_detail?.username?.[0]?.toUpperCase() || "?"}
                  </Avatar>
                  <Box sx={{ maxWidth: "75%" }}>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{ display: "block", textAlign: isMe ? "right" : "left", mb: 0.3 }}
                    >
                      {comment.author_detail?.username} · {formatDate(comment.created_at)}
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: isMe ? alpha(THEME.primary, 0.1) : alpha("#000", 0.04),
                        border: `1px solid ${
                          isMe ? alpha(THEME.primary, 0.2) : alpha("#000", 0.08)
                        }`,
                        borderRadius: isMe ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Typography variant="body2">{comment.content}</Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Stack>
        )}
      </Box>
      <Box display="flex" gap={1} alignItems="flex-end">
        <TextareaAutosize
          minRows={2}
          placeholder="Écrire un message interne..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            fontFamily: "inherit",
            fontSize: "0.875rem",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={sending || !newComment.trim()}
          sx={{
            bgcolor: THEME.primary,
            color: "white",
            borderRadius: 2,
            width: 40,
            height: 40,
            flexShrink: 0,
            "&:hover": { bgcolor: THEME.primaryDark },
            "&:disabled": { bgcolor: alpha(THEME.primary, 0.3) },
          }}
        >
          {sending ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <SendIcon sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Box>
      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: "block" }}>
        Entrée pour envoyer · Shift+Entrée pour un saut de ligne
      </Typography>
    </Box>
  );
};
CommentsSection.propTypes = {
  taskId: PropTypes.number.isRequired,
  currentUser: PropTypes.object.isRequired,
};

// ==============================
// TASK TABLE ROW (Style identique à ProspectTableRow)
// ==============================
const TaskTableRow = ({ task, currentUser, onView, onEdit, onDelete, onContextMenu }) => {
  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);
  return (
    <StyledTableRow
      onDoubleClick={() => onView(task)}
      onContextMenu={(e) => onContextMenu(e, task.id)}
    >
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, maxWidth: 250 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(THEME.primary, 0.1),
              color: THEME.primary,
              fontSize: "0.75rem",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <AssignmentIcon sx={{ fontSize: 16 }} />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {task.title}
            </Typography>
            {task.description && (
              <Typography variant="caption" color="textSecondary" noWrap>
                {task.description}
              </Typography>
            )}
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, maxWidth: 130 }}>
          <Avatar
            sx={{
              width: 24,
              height: 24,
              bgcolor: alpha(THEME.info, 0.1),
              color: THEME.info,
              fontSize: "0.7rem",
            }}
          >
            {task.assigned_to_detail?.username?.[0]?.toUpperCase() || "?"}
          </Avatar>
          <Typography variant="body2" noWrap>
            {task.assigned_to_detail?.username || "Non assigné"}
          </Typography>
        </Box>
      </TableCell>
      <TableCell align="center">
        <PriorityChip
          label={getPriorityLabel(task.priority)}
          priority={task.priority}
          size="small"
        />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={getStatusLabel(task.status)}
          size="small"
          icon={getStatusIcon(task.status)}
          sx={{
            bgcolor: alpha(getStatusColor(task.status), 0.1),
            color: getStatusColor(task.status),
            borderRadius: 1,
            fontWeight: 500,
          }}
        />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={getTaskTypeLabel(task.task_type)}
          size="small"
          sx={{
            bgcolor: alpha(task.task_type === "quota" ? "#7c3aed" : THEME.primary, 0.1),
            color: task.task_type === "quota" ? "#7c3aed" : THEME.primary,
            borderRadius: 1,
          }}
        />
      </TableCell>
      <TableCell>
        <Box display="flex" gap={0.5} flexWrap="wrap">
          {task.calls_count > 0 && (
            <Tooltip title={`${task.calls_count} appel(s)`}>
              <Chip
                icon={<PhoneIcon sx={{ fontSize: 12 }} />}
                label={task.calls_count}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  bgcolor: alpha("#2196f3", 0.1),
                  color: "#2196f3",
                }}
              />
            </Tooltip>
          )}
          {task.emails_count > 0 && (
            <Tooltip title={`${task.emails_count} email(s)`}>
              <Chip
                icon={<EmailIcon sx={{ fontSize: 12 }} />}
                label={task.emails_count}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  bgcolor: alpha("#9c27b0", 0.1),
                  color: "#9c27b0",
                }}
              />
            </Tooltip>
          )}
          {!task.calls_count && !task.emails_count && !task.meetings_count && (
            <Typography variant="caption" color="textSecondary">
              —
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell>
        {task.task_type === "quota" && task.quota_target ? (
          <Box sx={{ minWidth: 130 }}>
            <QuotaBar progress={task.quota_progress || 0} target={task.quota_target} />
          </Box>
        ) : (
          <Typography variant="caption" color="textSecondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {task.due_date ? (
          <Box display="flex" alignItems="center" gap={0.5}>
            <CalendarIcon
              sx={{
                fontSize: 14,
                color: task.is_overdue ? THEME.error : alpha(THEME.primary, 0.6),
                flexShrink: 0,
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: task.is_overdue ? THEME.error : "inherit" }}
              noWrap
            >
              {formatDateShort(task.due_date)}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="textSecondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
          {[
            {
              title: "Voir",
              color: "#0288d1",
              icon: <VisibilityIcon sx={{ fontSize: 16 }} />,
              onClick: () => onView(task),
            },
            {
              title: "Modifier",
              color: "#1976d2",
              icon: <EditIcon sx={{ fontSize: 16 }} />,
              onClick: () => onEdit(task),
            },
            ...(isAdminOrManager
              ? [
                  {
                    title: "Supprimer",
                    color: THEME.primary,
                    icon: <DeleteIcon sx={{ fontSize: 16 }} />,
                    onClick: () => onDelete(task.id),
                  },
                ]
              : []),
          ].map((btn) => (
            <Tooltip key={btn.title} title={btn.title}>
              <IconButton
                size="small"
                onClick={btn.onClick}
                sx={{ color: btn.color, bgcolor: alpha(btn.color, 0.1), width: 30, height: 30 }}
              >
                {btn.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </TableCell>
    </StyledTableRow>
  );
};
TaskTableRow.propTypes = {
  task: PropTypes.object.isRequired,
  currentUser: PropTypes.object,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onContextMenu: PropTypes.func.isRequired,
};

// ==============================
// TASK CARD (Style identique à ProspectCard)
// ==============================
const TaskCard = ({ task, currentUser, onView, onEdit, onDelete }) => {
  const isAdminOrManager = currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role);
  return (
    <StyledCard onDoubleClick={() => onView(task)}>
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
            <AssignmentIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" fontWeight={600} noWrap>
              {task.title}
            </Typography>
            <Typography variant="caption" color="textSecondary" noWrap>
              {task.assigned_to_detail?.username || "Non assigné"}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <PriorityChip
            label={getPriorityLabel(task.priority)}
            priority={task.priority}
            size="small"
          />
          <Chip
            label={getStatusLabel(task.status)}
            size="small"
            icon={getStatusIcon(task.status)}
            sx={{
              bgcolor: alpha(getStatusColor(task.status), 0.1),
              color: getStatusColor(task.status),
              borderRadius: 1,
            }}
          />
          <Chip
            label={getTaskTypeLabel(task.task_type)}
            size="small"
            sx={{
              bgcolor: alpha(task.task_type === "quota" ? "#7c3aed" : THEME.primary, 0.1),
              color: task.task_type === "quota" ? "#7c3aed" : THEME.primary,
              borderRadius: 1,
            }}
          />
        </Box>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.5}>
          {task.description && (
            <Typography variant="body2" color="textSecondary" noWrap>
              {task.description}
            </Typography>
          )}
          <Box display="flex" alignItems="center" gap={1}>
            <PersonOutlineIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
            <Typography variant="body2">
              {task.assigned_to_detail?.username || "Non assigné"}
            </Typography>
          </Box>
          {task.due_date && (
            <Box display="flex" alignItems="center" gap={1}>
              <CalendarIcon sx={{ fontSize: 18, color: alpha(THEME.primary, 0.6) }} />
              <Typography variant="body2" sx={{ color: task.is_overdue ? THEME.error : "inherit" }}>
                {formatDateShort(task.due_date)}
                {task.is_overdue && " (En retard)"}
              </Typography>
            </Box>
          )}
          {task.task_type === "quota" && task.quota_target && (
            <Box>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                Progression
              </Typography>
              <QuotaBar progress={task.quota_progress || 0} target={task.quota_target} />
            </Box>
          )}
        </Stack>
        <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
          {[
            {
              title: "Voir",
              color: "#0288d1",
              icon: <VisibilityIcon fontSize="small" />,
              fn: () => onView(task),
            },
            {
              title: "Modifier",
              color: "#1976d2",
              icon: <EditIcon fontSize="small" />,
              fn: () => onEdit(task),
            },
            ...(isAdminOrManager
              ? [
                  {
                    title: "Supprimer",
                    color: THEME.primary,
                    icon: <DeleteIcon fontSize="small" />,
                    fn: () => onDelete(task.id),
                  },
                ]
              : []),
          ].map((b) => (
            <Tooltip key={b.title} title={b.title}>
              <IconButton
                size="small"
                onClick={b.fn}
                sx={{ color: b.color, bgcolor: alpha(b.color, 0.1) }}
              >
                {b.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      </CardContent>
    </StyledCard>
  );
};
TaskCard.propTypes = {
  task: PropTypes.object.isRequired,
  currentUser: PropTypes.object,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// ==============================
// TASK DETAILS DRAWER
// ==============================
const TaskDetailsDrawer = ({
  open,
  onClose,
  task,
  onStatusChange,
  onQuotaUpdate,
  onTaskClosed,
  currentUser,
  assignableUsers,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const isOwner = task?.assigned_to_detail?.id === currentUser?.id;
  const canEdit = isOwner || currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  useEffect(() => {
    if (!open || !task || activeTab !== 1) return;
    const load = async () => {
      setActivitiesLoading(true);
      try {
        const res = await api.get(`/tasks/${task.id}/activities/`);
        setActivities(res.data);
      } catch (err) {
        console.error("Erreur chargement activités:", err);
      } finally {
        setActivitiesLoading(false);
      }
    };
    load();
  }, [open, task, activeTab]);
  useEffect(() => {
    if (open) setActiveTab(0);
  }, [open]);
  if (!task) return null;
  const handleActivityAdded = (newActivity) => setActivities((prev) => [newActivity, ...prev]);
  const tabs = [
    { label: "Infos" },
    { label: "Activités" },
    { label: "Messages" },
    { label: "Clôture" },
    { label: "Suivi" },
    ...(task.task_type === "quota" ? [{ label: "Quota" }] : []),
  ];
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 560 },
          background: "#ffffff",
          borderTopLeftRadius: 24,
          borderBottomLeftRadius: 24,
          boxShadow: `-8px 0 24px ${alpha(THEME.primary, 0.15)}`,
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ p: 3, pb: 0, flexShrink: 0 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
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
              borderRadius: 3,
              p: 2,
              mb: 2,
              border: `1px solid ${alpha(THEME.primary, 0.1)}`,
            }}
          >
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  width: 52,
                  height: 52,
                  background: THEME.gradient,
                  boxShadow: `0 4px 12px ${alpha(THEME.primary, 0.3)}`,
                }}
              >
                <AssignmentIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography variant="h6" fontWeight={700} noWrap>
                  {task.title}
                </Typography>
                <Stack direction="row" spacing={0.5} mt={0.5} flexWrap="wrap">
                  <PriorityChip
                    label={getPriorityLabel(task.priority)}
                    priority={task.priority}
                    size="small"
                  />
                  <Chip
                    label={getStatusLabel(task.status)}
                    size="small"
                    icon={getStatusIcon(task.status)}
                    sx={{
                      bgcolor: alpha(getStatusColor(task.status), 0.1),
                      color: getStatusColor(task.status),
                      borderRadius: 1,
                    }}
                  />
                  {task.is_overdue && task.status !== "done" && (
                    <Chip
                      label="En retard"
                      size="small"
                      sx={{
                        bgcolor: alpha(THEME.error, 0.1),
                        color: THEME.error,
                        borderRadius: 1,
                        fontSize: "0.7rem",
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Box>
            {task.task_type === "quota" && task.quota_target && (
              <Box mt={1.5}>
                <QuotaBar progress={task.quota_progress || 0} target={task.quota_target} />
              </Box>
            )}
          </Paper>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.82rem",
                minWidth: 0,
                px: 1.5,
              },
              "& .Mui-selected": { color: THEME.primary },
              "& .MuiTabs-indicator": { backgroundColor: THEME.primary },
            }}
          >
            {tabs.map((tab, i) => (
              <Tab key={i} label={tab.label} />
            ))}
          </Tabs>
          <Divider />
        </Box>
        <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {activeTab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: THEME.primary, mb: 1, fontWeight: 600 }}
                  >
                    Description
                  </Typography>
                  <Typography variant="body2">
                    {task.description || "Aucune description fournie"}
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: THEME.primary, mb: 1.5, fontWeight: 600 }}
                  >
                    Informations
                  </Typography>
                  <Stack spacing={1.2}>
                    {[
                      {
                        label: "Assigné à",
                        value: task.assigned_to_detail?.username || "Non assigné",
                      },
                      { label: "Créé par", value: task.created_by_detail?.username || "—" },
                      task.due_date && { label: "Date limite", value: formatDate(task.due_date) },
                      {
                        label: "Créée le",
                        value: new Date(task.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }),
                      },
                      task.parent_task && { label: "Tâche parente", value: `#${task.parent_task}` },
                    ]
                      .filter(Boolean)
                      .map((item) => (
                        <Box
                          key={item.label}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography variant="body2" color="textSecondary">
                            {item.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {item.value}
                          </Typography>
                        </Box>
                      ))}
                  </Stack>
                </Card>
              </Grid>
              {canEdit && task.status !== "cancelled" && task.status !== "done" && (
                <Grid item xs={12}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: THEME.primary, mb: 1, fontWeight: 600 }}
                    >
                      Changer le statut
                    </Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        value={task.status}
                        onChange={(e) => onStatusChange(task.id, e.target.value)}
                      >
                        <MenuItem value="todo">À faire</MenuItem>
                        <MenuItem value="pending">En attente</MenuItem>
                        <MenuItem value="ready">Prêt</MenuItem>
                        <MenuItem value="in_progress">En cours</MenuItem>
                        <MenuItem value="done">Terminé</MenuItem>
                        <MenuItem value="completed">Terminé</MenuItem>
                        <MenuItem value="cancelled">Annulé</MenuItem>
                        <MenuItem value="failed">Échec</MenuItem>
                      </Select>
                    </FormControl>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
          {activeTab === 1 && (
            <Box>
              <ActivityTimeline activities={activities} loading={activitiesLoading} />
              {task.status !== "done" && task.status !== "cancelled" && (
                <AddActivityForm taskId={task.id} onAdded={handleActivityAdded} />
              )}
            </Box>
          )}
          {activeTab === 2 && <CommentsSection taskId={task.id} currentUser={currentUser} />}
          {activeTab === 3 && (
            <Box>
              <CloseTaskSection task={task} onClosed={onTaskClosed} />
            </Box>
          )}
          {activeTab === 4 && (
            <FollowUpSection
              task={task}
              currentUser={currentUser}
              assignableUsers={assignableUsers}
              onFollowUpCreated={() => {}}
            />
          )}
          {activeTab === 5 && task.task_type === "quota" && (
            <QuotaSection task={task} canEdit={canEdit} onQuotaUpdate={onQuotaUpdate} />
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
TaskDetailsDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  task: PropTypes.object,
  onStatusChange: PropTypes.func.isRequired,
  onQuotaUpdate: PropTypes.func.isRequired,
  onTaskClosed: PropTypes.func.isRequired,
  currentUser: PropTypes.object.isRequired,
  assignableUsers: PropTypes.array.isRequired,
};

// ==============================
// CLOSE TASK SECTION
// ==============================
const CloseTaskSection = ({ task, onClosed }) => {
  const [report, setReport] = useState(task.closing_report || "");
  const [loading, setLoading] = useState(false);
  if (task.status === "done")
    return (
      <Box textAlign="center" py={3}>
        <CheckCircleIcon sx={{ fontSize: 48, color: THEME.success, mb: 1 }} />
        <Typography variant="h6" fontWeight={700} color={THEME.success}>
          Tâche clôturée
        </Typography>
        {task.closed_at && (
          <Typography variant="caption" color="textSecondary" display="block">
            Le {formatDate(task.closed_at)}
          </Typography>
        )}
        {task.closing_report && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: alpha(THEME.success, 0.05),
              borderRadius: 2,
              border: `1px solid ${alpha(THEME.success, 0.2)}`,
              textAlign: "left",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} color={THEME.success} gutterBottom>
              Rapport de clôture
            </Typography>
            <Typography variant="body2">{task.closing_report}</Typography>
          </Box>
        )}
      </Box>
    );
  if (task.status === "cancelled")
    return (
      <Box textAlign="center" py={3}>
        <CancelIcon sx={{ fontSize: 48, color: THEME.error, mb: 1 }} />
        <Typography variant="h6" color={THEME.error}>
          Tâche annulée
        </Typography>
      </Box>
    );
  const handleClose = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/tasks/${task.id}/close/`, { closing_report: report });
      onClosed(response.data);
    } catch (err) {
      console.error("Erreur clôture:", err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          p: 2,
          bgcolor: alpha(THEME.warning, 0.06),
          borderRadius: 2,
          border: `1px solid ${alpha(THEME.warning, 0.2)}`,
        }}
      >
        <Typography variant="body2" color="textSecondary">
          En clôturant cette tâche, son statut passera à <strong>Terminé</strong> et un rapport sera
          généré.
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={600} sx={{ color: THEME.primary, mb: 1 }}>
          Rapport de clôture (optionnel)
        </Typography>
        <TextareaAutosize
          minRows={4}
          placeholder="Résumez ce qui a été accompli..."
          value={report}
          onChange={(e) => setReport(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            fontFamily: "inherit",
            fontSize: "0.875rem",
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </Box>
      <GradientButton
        fullWidth
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <CloseTaskIcon />}
        onClick={handleClose}
        disabled={loading}
        sx={{ py: 1.5 }}
      >
        {loading ? "Clôture en cours..." : "Clôturer la tâche"}
      </GradientButton>
    </Stack>
  );
};
CloseTaskSection.propTypes = {
  task: PropTypes.object.isRequired,
  onClosed: PropTypes.func.isRequired,
};

// ==============================
// QUOTA SECTION
// ==============================
const QuotaSection = ({ task, canEdit, onQuotaUpdate }) => {
  const [increment, setIncrement] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);
  const currentProgress = task.quota_progress || 0;
  const target = task.quota_target || 0;
  const remaining = Math.max(0, target - currentProgress);
  const isDone = task.status === "done" || task.status === "cancelled";
  const previewTotal =
    increment && parseInt(increment) > 0
      ? Math.min(currentProgress + parseInt(increment), target)
      : null;
  const handleQuickAdd = async (value) => {
    if (isDone || loading) return;
    const safeValue = Math.min(value, remaining);
    if (safeValue <= 0) return;
    setLoading(true);
    try {
      await onQuotaUpdate(task.id, currentProgress + safeValue);
      setLastAdded(safeValue);
      setTimeout(() => setLastAdded(null), 3000);
    } finally {
      setLoading(false);
    }
  };
  const handleManualAdd = async () => {
    const value = parseInt(increment, 10);
    if (isNaN(value) || value <= 0) return;
    const safeValue = Math.min(value, remaining);
    if (safeValue <= 0) return;
    setLoading(true);
    try {
      await onQuotaUpdate(task.id, currentProgress + safeValue);
      setLastAdded(safeValue);
      setIncrement("");
      setTimeout(() => setLastAdded(null), 3000);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography variant="subtitle2" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
          Progression du quota
        </Typography>
        <QuotaBar progress={currentProgress} target={target} />
        <Grid container spacing={1} sx={{ mt: 1.5 }}>
          {[
            { label: "Réalisé", value: currentProgress, color: THEME.primary },
            { label: "Objectif", value: target, color: THEME.info },
            {
              label: "Restant",
              value: remaining,
              color: remaining === 0 ? THEME.success : THEME.warning,
            },
          ].map((stat) => (
            <Grid item xs={4} key={stat.label}>
              <Box
                sx={{
                  textAlign: "center",
                  p: 1,
                  bgcolor: alpha(stat.color, 0.06),
                  borderRadius: 2,
                  border: `1px solid ${alpha(stat.color, 0.15)}`,
                }}
              >
                <Typography variant="h6" fontWeight={700} sx={{ color: stat.color }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        {remaining === 0 && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              textAlign: "center",
              bgcolor: alpha(THEME.success, 0.08),
              borderRadius: 2,
              border: `1px solid ${alpha(THEME.success, 0.25)}`,
            }}
          >
            <CheckCircleIcon
              sx={{ color: THEME.success, fontSize: 20, mr: 0.5, verticalAlign: "middle" }}
            />
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ color: THEME.success, display: "inline" }}
            >
              Objectif atteint !
            </Typography>
          </Box>
        )}
      </Card>
      {canEdit && !isDone && remaining > 0 && (
        <Card variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <IncrementIcon sx={{ color: THEME.primary, fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: THEME.primary }}>
              Ajouter à la progression
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary" display="block" mb={2}>
            Saisissez le nombre réalisé depuis la dernière mise à jour. Il sera{" "}
            <strong>ajouté</strong> à la progression actuelle ({currentProgress}).
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" mb={1}>
            Ajout rapide :
          </Typography>
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            {[1, 2, 3, 5, 10].map((quick) => {
              const disabled = loading || quick > remaining;
              return (
                <Button
                  key={quick}
                  size="small"
                  variant="outlined"
                  disabled={disabled}
                  onClick={() => handleQuickAdd(quick)}
                  sx={{
                    borderRadius: 2,
                    minWidth: 52,
                    fontWeight: 700,
                    borderColor: disabled ? alpha(THEME.primary, 0.2) : alpha(THEME.primary, 0.5),
                    color: disabled ? alpha(THEME.primary, 0.3) : THEME.primary,
                    "&:hover": { bgcolor: alpha(THEME.primary, 0.08), borderColor: THEME.primary },
                  }}
                >
                  +{quick}
                </Button>
              );
            })}
          </Box>
          <Typography variant="caption" color="textSecondary" display="block" mb={1}>
            Ou saisir une valeur :
          </Typography>
          <Box display="flex" gap={1} alignItems="flex-start">
            <Box flex={1}>
              <TextField
                fullWidth
                size="small"
                type="number"
                placeholder={`Max +${remaining}`}
                value={increment}
                onChange={(e) => setIncrement(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualAdd();
                }}
                inputProps={{ min: 1, max: remaining }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    "& fieldset": { borderColor: alpha(THEME.primary, 0.3) },
                    "&:hover fieldset": { borderColor: THEME.primary },
                    "&.Mui-focused fieldset": { borderColor: THEME.primary },
                  },
                }}
              />
              {previewTotal !== null && (
                <Box
                  sx={{
                    mt: 1,
                    p: 1,
                    borderRadius: 2,
                    bgcolor: alpha(THEME.success, 0.06),
                    border: `1px solid ${alpha(THEME.success, 0.2)}`,
                  }}
                >
                  <Typography variant="caption" color="textSecondary">
                    Après ajout :{" "}
                    <strong style={{ color: THEME.primary }}>{currentProgress}</strong>
                    {" + "}
                    <strong style={{ color: THEME.success }}>
                      +{Math.min(parseInt(increment), remaining)}
                    </strong>
                    {" = "}
                    <strong style={{ color: THEME.primary, fontSize: "0.85rem" }}>
                      {previewTotal}
                    </strong>
                    {" / "}
                    {target}
                    {previewTotal >= target && (
                      <Chip
                        label="Objectif atteint !"
                        size="small"
                        sx={{
                          ml: 1,
                          height: 18,
                          fontSize: "0.6rem",
                          bgcolor: alpha(THEME.success, 0.15),
                          color: THEME.success,
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </Typography>
                </Box>
              )}
            </Box>
            <Button
              variant="contained"
              onClick={handleManualAdd}
              disabled={loading || !increment || parseInt(increment) <= 0}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
              sx={{
                background: THEME.gradient,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                height: 40,
                px: 2,
                flexShrink: 0,
              }}
            >
              Ajouter
            </Button>
          </Box>
          {lastAdded && (
            <Box
              sx={{
                mt: 1.5,
                p: 1,
                borderRadius: 2,
                bgcolor: alpha(THEME.success, 0.08),
                border: `1px solid ${alpha(THEME.success, 0.25)}`,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <CheckCircleIcon sx={{ color: THEME.success, fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: THEME.success, fontWeight: 600 }}>
                +{lastAdded} ajouté avec succès !
              </Typography>
            </Box>
          )}
        </Card>
      )}
      {isDone && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            textAlign: "center",
            bgcolor: alpha(THEME.success, 0.06),
            border: `1px solid ${alpha(THEME.success, 0.2)}`,
          }}
        >
          <CheckCircleIcon sx={{ color: THEME.success, fontSize: 32, mb: 0.5 }} />
          <Typography variant="body2" color="textSecondary">
            Cette tâche est terminée. La progression ne peut plus être modifiée.
          </Typography>
        </Box>
      )}
    </Stack>
  );
};
QuotaSection.propTypes = {
  task: PropTypes.object.isRequired,
  canEdit: PropTypes.bool.isRequired,
  onQuotaUpdate: PropTypes.func.isRequired,
};

// ==============================
// FOLLOW UP SECTION
// ==============================
const FollowUpSection = ({ task, currentUser, assignableUsers, onFollowUpCreated }) => {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    due_date: "",
    assigned_to: "",
    priority: "medium",
  });
  const [creating, setCreating] = useState(false);
  const isAdminOrManager = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/${task.id}/followups/`);
      setFollowUps(res.data);
    } catch (err) {
      console.error("Erreur chargement follow-ups:", err);
    } finally {
      setLoading(false);
    }
  }, [task.id]);
  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);
  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    setCreating(true);
    try {
      const payload = {
        title: formData.title,
        priority: formData.priority,
        due_date: formData.due_date || null,
        status: "todo",
        task_type: "classic",
      };
      if (isAdminOrManager && formData.assigned_to)
        payload.assigned_to = parseInt(formData.assigned_to);
      const res = await api.post(`/tasks/${task.id}/create-followup/`, payload);

      // Créer l'événement calendrier pour la tâche de suivi
      await syncTaskToCalendar(res.data, null);

      setFollowUps((prev) => [...prev, res.data]);
      setShowForm(false);
      setFormData({ title: "", due_date: "", assigned_to: "", priority: "medium" });
      if (onFollowUpCreated) onFollowUpCreated(res.data);
      showNotification("✅ Tâche de suivi créée et ajoutée au calendrier");
    } catch (err) {
      console.error("Erreur création follow-up:", err);
      showNotification("❌ Erreur lors de la création du suivi", "error");
    } finally {
      setCreating(false);
    }
  };
  return (
    <Stack spacing={2}>
      {loading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} sx={{ color: THEME.primary }} />
        </Box>
      ) : followUps.length === 0 && !showForm ? (
        <Box textAlign="center" py={3}>
          <FollowUpIcon sx={{ fontSize: 40, color: alpha(THEME.primary, 0.3), mb: 1 }} />
          <Typography variant="body2" color="textSecondary">
            Aucune tâche de suivi
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {followUps.map((fu) => (
            <Box
              key={fu.id}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${alpha(getStatusColor(fu.status), 0.3)}`,
                bgcolor: alpha(getStatusColor(fu.status), 0.04),
                display: "flex",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <FollowUpIcon
                sx={{ fontSize: 18, color: alpha(THEME.primary, 0.5), flexShrink: 0 }}
              />
              <Box flex={1} minWidth={0}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {fu.title}
                </Typography>
                <Box display="flex" gap={0.5} mt={0.3} flexWrap="wrap">
                  <Chip
                    label={getStatusLabel(fu.status)}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.65rem",
                      bgcolor: alpha(getStatusColor(fu.status), 0.1),
                      color: getStatusColor(fu.status),
                    }}
                  />
                  <Chip
                    label={getPriorityLabel(fu.priority)}
                    size="small"
                    sx={{ height: 18, fontSize: "0.65rem" }}
                  />
                  {fu.due_date && (
                    <Typography variant="caption" color="textSecondary">
                      · {new Date(fu.due_date).toLocaleDateString("fr-FR")}
                    </Typography>
                  )}
                </Box>
              </Box>
              {fu.assigned_to_detail && (
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    fontSize: "0.65rem",
                    bgcolor: alpha(THEME.info, 0.2),
                    color: THEME.info,
                    flexShrink: 0,
                  }}
                >
                  {fu.assigned_to_detail.username?.[0]?.toUpperCase()}
                </Avatar>
              )}
            </Box>
          ))}
        </Stack>
      )}
      {showForm ? (
        <Box sx={{ border: `1px solid ${alpha(THEME.primary, 0.2)}`, borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: THEME.primary, mb: 1.5 }}>
            Nouvelle tâche de suivi
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              fullWidth
              size="small"
              label="Titre"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priorité</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priorité"
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <MenuItem value="low">Basse</MenuItem>
                    <MenuItem value="medium">Moyenne</MenuItem>
                    <MenuItem value="high">Haute</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Date limite"
                  type="datetime-local"
                  InputLabelProps={{ shrink: true }}
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </Grid>
            </Grid>
            {isAdminOrManager && (
              <FormControl fullWidth size="small">
                <InputLabel>Assigné à</InputLabel>
                <Select
                  value={formData.assigned_to}
                  label="Assigné à"
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                >
                  <MenuItem value="">— Moi-même —</MenuItem>
                  {assignableUsers.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.username} ({u.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button
                size="small"
                onClick={() => setShowForm(false)}
                sx={{ borderRadius: 2, color: "text.secondary" }}
              >
                Annuler
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleCreate}
                disabled={creating || !formData.title.trim()}
                startIcon={creating ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                sx={{ background: THEME.gradient, borderRadius: 2, textTransform: "none" }}
              >
                Créer
              </Button>
            </Box>
          </Stack>
        </Box>
      ) : (
        <Button
          startIcon={<AddIcon />}
          onClick={() => setShowForm(true)}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: 2,
            borderColor: alpha(THEME.primary, 0.3),
            color: THEME.primary,
            textTransform: "none",
          }}
        >
          Ajouter une tâche de suivi
        </Button>
      )}
    </Stack>
  );
};
FollowUpSection.propTypes = {
  task: PropTypes.object.isRequired,
  currentUser: PropTypes.object.isRequired,
  assignableUsers: PropTypes.array.isRequired,
  onFollowUpCreated: PropTypes.func,
};

// ==============================
// TASK FORM DRAWER
// ==============================
const TaskFormDrawer = ({ open, onClose, onSaved, assignableUsers, currentUser, editingTask }) => {
  const isAdminOrManager = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";
  const emptyForm = useMemo(() => ({
    title: "",
    description: "",
    task_type: "classic",
    assigned_to: "",
    due_date: "",
    priority: "medium",
    status: "todo",
    quota_target: "",
  }), []);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title || "",
        description: editingTask.description || "",
        task_type: editingTask.task_type || "classic",
        assigned_to: editingTask.assigned_to || "",
        due_date: editingTask.due_date ? editingTask.due_date.slice(0, 16) : "",
        priority: editingTask.priority || "medium",
        status: editingTask.status || "todo",
        quota_target: editingTask.quota_target || "",
      });
    } else {
      setFormData(emptyForm);
    }
  }, [editingTask, emptyForm, open]);
  const handleClose = () => {
    setFormData(emptyForm);
    onClose();
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || "",
        task_type: formData.task_type,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date || null,
      };
      if (isAdminOrManager && formData.assigned_to)
        payload.assigned_to = parseInt(formData.assigned_to, 10);
      if (formData.task_type === "quota")
        payload.quota_target = parseInt(formData.quota_target, 10);
      const response = editingTask
        ? await api.put(`/tasks/${editingTask.id}/`, payload)
        : await api.post("/tasks/", payload);
      onSaved(response.data, !!editingTask);
      handleClose();
    } catch (error) {
      console.error("Erreur enregistrement:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 700 },
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
            {editingTask ? "Modifier la tâche" : "Nouvelle tâche"}
          </Typography>
          <IconButton
            onClick={handleClose}
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
                  Type de tâche
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {[
                    { value: "classic", label: "Tâche classique" },
                    { value: "quota", label: "Objectif / Quota" },
                    { value: "call", label: "Appel" },
                    { value: "linkedin_message", label: "LinkedIn" },
                    { value: "email", label: "Email" },
                    { value: "facebook_message", label: "Facebook" },
                    { value: "instagram_message", label: "Instagram" },
                    { value: "follow_up", label: "Relance" },
                    { value: "meeting", label: "RDV" },
                    { value: "note", label: "Note" },
                  ].map((t) => (
                    <Button
                      key={t.value}
                      type="button"
                      variant={formData.task_type === t.value ? "contained" : "outlined"}
                      onClick={() => setFormData({ ...formData, task_type: t.value })}
                      sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        ...(formData.task_type === t.value
                          ? { background: THEME.gradient }
                          : { borderColor: alpha(THEME.primary, 0.3), color: THEME.primary }),
                      }}
                    >
                      {t.label}
                    </Button>
                  ))}
                </Box>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ color: THEME.primary, mb: 2, fontWeight: 600 }}>
                  Informations
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={isAdminOrManager ? 6 : 12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Titre"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </Grid>
                  {isAdminOrManager && (
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small" required>
                        <InputLabel>Assigné à</InputLabel>
                        <Select
                          value={formData.assigned_to}
                          label="Assigné à"
                          onChange={(e) =>
                            setFormData({ ...formData, assigned_to: e.target.value })
                          }
                        >
                          <MenuItem value="" disabled>
                            — Sélectionner —
                          </MenuItem>
                          {assignableUsers.map((u) => (
                            <MenuItem key={u.id} value={u.id}>
                              {u.username} ({u.role})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Description"
                      multiline
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </Grid>
                  {formData.task_type === "quota" && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Objectif cible"
                        type="number"
                        required
                        inputProps={{ min: 1 }}
                        value={formData.quota_target}
                        onChange={(e) => setFormData({ ...formData, quota_target: e.target.value })}
                      />
                    </Grid>
                  )}
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Date limite"
                      type="datetime-local"
                      InputLabelProps={{ shrink: true }}
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Priorité</InputLabel>
                      <Select
                        value={formData.priority}
                        label="Priorité"
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <MenuItem value="low">Basse</MenuItem>
                        <MenuItem value="medium">Moyenne</MenuItem>
                        <MenuItem value="high">Haute</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Statut</InputLabel>
                      <Select
                        value={formData.status}
                        label="Statut"
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <MenuItem value="todo">À faire</MenuItem>
                        <MenuItem value="pending">En attente</MenuItem>
                        <MenuItem value="ready">Prêt</MenuItem>
                        <MenuItem value="in_progress">En cours</MenuItem>
                        <MenuItem value="done">Terminé</MenuItem>
                        <MenuItem value="completed">Terminé</MenuItem>
                        <MenuItem value="cancelled">Annulé</MenuItem>
                        <MenuItem value="failed">Échec</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Card>
            </Grid>
          </Grid>
          <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button
              onClick={handleClose}
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
            <GradientButton type="submit" disabled={loading} sx={{ px: 4, py: 1.5 }}>
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : editingTask ? (
                "Mettre à jour"
              ) : (
                "Créer la tâche"
              )}
            </GradientButton>
          </Box>
        </form>
      </Box>
    </Drawer>
  );
};
TaskFormDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
  assignableUsers: PropTypes.array.isRequired,
  currentUser: PropTypes.object.isRequired,
  editingTask: PropTypes.object,
};

// ==============================
// EXPORT MENU (identique à Prospects)
// ==============================
const ExportMenu = ({ onExportCSV }) => {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Tooltip title="Exporter">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          sx={{
            color: THEME.primary,
            border: `1px solid ${alpha(THEME.primary, 0.3)}`,
            borderRadius: 2,
          }}
        >
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      <Menu
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
            <DownloadIcon fontSize="small" sx={{ color: THEME.primary }} />
          </ListItemIcon>
          <ListItemText>CSV</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
ExportMenu.propTypes = {
  onExportCSV: PropTypes.func.isRequired,
};

// ==============================
// COMPOSANT PRINCIPAL
// ==============================
export default function TasksPage() {
  useTrackActivity("tasks");
  const [user] = useState(getUser());
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("-created_at");
  const [viewMode, setViewMode] = useState("table");
  const [contextMenu, setContextMenu] = useState(null);
  const [contextTaskId, setContextTaskId] = useState(null);

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";

  const fetchTaskProspect = useCallback(async (task) => {
    if (!task.prospect) return null;
    try {
      const response = await api.get(`/prospects/${task.prospect}/`);
      return response.data;
    } catch (error) {
      console.error("Erreur récupération prospect:", error);
      return null;
    }
  }, []);

  // ==============================
  // AJOUTER LA FONCTION showNotification ICI
  // ==============================
  const showNotification = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 5000);
  };
  // ── Pagination backend ──
  const hookFilters = useMemo(() => {
    const f = { ordering: sortBy };
    if (searchTerm) f.search = searchTerm;
    if (filters.status?.length) f.status = filters.status.join(",");
    if (filters.priority?.length) f.priority = filters.priority.join(",");
    if (filters.task_type?.length) f.task_type = filters.task_type.join(",");
    if (filters.date_from) f.created_at__gte = filters.date_from;
    if (filters.date_to) f.created_at__lte = filters.date_to;
    return f;
  }, [searchTerm, filters, sortBy]);

  const {
    data: tasks,
    loading,
    total,
    pages,
    page,
    pageSize,
    setPage,
    setPageSize,
    setFilters: setHookFilters,
    refresh: refreshTasks,
  } = usePaginatedList("/tasks/", 10);

  useEffect(() => {
    setHookFilters(hookFilters);
  }, [hookFilters, setHookFilters]);

  // ── Fetch assignable users ──
  const fetchAssignableUsers = useCallback(async () => {
    if (!isAdminOrManager) return;
    try {
      const response = await axios.get(API_ASSIGNABLE_USERS_URL, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setAssignableUsers(
        Array.isArray(response.data) ? response.data : response.data?.results || []
      );
    } catch (error) {
      console.error("Erreur chargement utilisateurs:", error);
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    if (!user) return;
    fetchAssignableUsers();
  }, [fetchAssignableUsers, user]);

  // ── Stats ──
  const stats = useMemo(
    () => ({
      total,
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      high: tasks.filter((t) => t.priority === "high").length,
      quota: tasks.filter((t) => t.task_type === "quota").length,
    }),
    [tasks, total]
  );

  const showSnackbar = (msg, sev = "success") => {
    setMessage({ text: msg, type: sev });
  };

  // ── Handlers ──
  const handleQuotaUpdate = useCallback(
    async (taskId, newProgress) => {
      try {
        const response = await api.patch(`/tasks/${taskId}/update-quota/`, {
          quota_progress: newProgress,
        });
        setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, ...response.data } : prev));
        refreshTasks();
        showNotification("Progression mise à jour avec succès");
      } catch {
        showNotification("Erreur lors de la mise à jour de la progression", "error");
      }
    },
    [refreshTasks]
  );

  const handleStatusChange = useCallback(
    async (taskId, newStatus) => {
      try {
        await api.patch(`/tasks/${taskId}/`, { status: newStatus });
        setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, status: newStatus } : prev));
        refreshTasks();
        showNotification("Statut mis à jour avec succès");
      } catch {
        showNotification("Erreur lors de la mise à jour du statut", "error");
      }
    },
    [refreshTasks]
  );

  const handleTaskClosed = useCallback(
    (closedTask) => {
      setSelectedTask(closedTask);
      refreshTasks();
      showNotification("Tâche clôturée avec succès");
    },
    [refreshTasks]
  );

  const handleSaved = useCallback(
    async (savedTask, isEdit) => {
      refreshTasks();

      if (!isEdit) {
        // NOUVELLE TCHE
        try {
          let prospect = null;
          if (savedTask.prospect) {
            prospect = await fetchTaskProspect(savedTask);
          }
          await syncTaskToCalendar(savedTask, prospect);
          showNotification("✅ Tâche créée et ajoutée au calendrier");
        } catch (error) {
          console.error("Erreur synchro calendrier:", error);
          showNotification("⚠️ Tâche créée mais erreur de synchronisation calendrier", "warning");
        }
      } else {
        // TCHE MODIFIÉE
        try {
          await updateCalendarEventFromTask(savedTask);
          showNotification("✅ Tâche modifiée avec succès");
        } catch (error) {
          showNotification("⚠️ Tâche modifiée mais erreur de mise à jour calendrier", "warning");
        }
      }
    },
    [refreshTasks, fetchTaskProspect]
  );

  const handleViewDetails = (task) => {
    setSelectedTask(task);
    setDetailsDrawerOpen(true);
  };
  const handleEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };
  const handleDeleteClick = (taskId) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };
  const handleDeleteConfirm = async () => {
    try {
      // Supprimer l'événement calendrier associé
      await deleteCalendarEventByTaskId(taskToDelete);

      // Supprimer la tâche
      await api.delete(`/tasks/${taskToDelete}/`);
      refreshTasks();
      showNotification("✅ Tâche supprimée avec succès");
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      if (selectedTask?.id === taskToDelete) setDetailsDrawerOpen(false);
    } catch (error) {
      console.error("Erreur suppression:", error);
      showNotification("❌ Erreur lors de la suppression", "error");
    }
  };
  const handleContextMenu = (e, taskId) => {
    e.preventDefault();
    setContextMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6 });
    setContextTaskId(taskId);
  };
  const handleContextMenuClose = () => {
    setContextMenu(null);
    setContextTaskId(null);
  };

  // Compte le nombre de filtres actifs pour le badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status?.length) count += filters.status.length;
    if (filters.priority?.length) count += filters.priority.length;
    if (filters.task_type?.length) count += filters.task_type.length;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    return count;
  }, [filters]);

  const exportToCSV = () => {
    const headers = [
      "Titre",
      "Type",
      "Priorité",
      "Statut",
      "Assigné à",
      "Appels",
      "Emails",
      "Progression",
      "Objectif",
      "Date limite",
      "Date création",
    ];
    const data = tasks.map((t) => [
      t.title,
      getTaskTypeLabel(t.task_type),
      getPriorityLabel(t.priority),
      getStatusLabel(t.status),
      t.assigned_to_detail?.username || "Non assigné",
      t.calls_count || 0,
      t.emails_count || 0,
      t.quota_progress || "-",
      t.quota_target || "-",
      t.due_date ? formatDateShort(t.due_date) : "-",
      formatDateShort(t.created_at),
    ]);
    const csvContent = [headers.join(";"), ...data.map((row) => row.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `taches_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSnackbar("Export CSV effectué");
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  if (!user)
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox p={3}>
          <Typography>Utilisateur non connecté</Typography>
        </MDBox>
      </DashboardLayout>
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
              Chargement des tâches...
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
                background: THEME.gradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              Gestion des tâches
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {total} tâche(s) au total
            </Typography>
          </Box>
          <GradientButton
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingTask(null);
              setShowForm(true);
            }}
          >
            Nouvelle tâche
          </GradientButton>
        </Box>

        {/* Stats Cards - Style identique à Prospects */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              title: "Total tâches",
              value: total,
              icon: <AssignmentIcon />,
              color: THEME.primary,
              chips: [
                { label: `${stats.todo} À faire`, color: THEME.info, filter: { status: ["todo"] } },
                {
                  label: `${stats.in_progress} En cours`,
                  color: THEME.warning,
                  filter: { status: ["in_progress"] },
                },
              ],
            },
            {
              title: "Tâches terminées",
              value: stats.done,
              icon: <CheckCircleIcon />,
              color: THEME.success,
              chips: [
                {
                  label: `${stats.quota} Quotas`,
                  color: "#7c3aed",
                  filter: { task_type: ["quota"] },
                },
              ],
            },
            {
              title: "Priorité haute",
              value: stats.high,
              icon: <FlagIcon />,
              color: THEME.error,
              chips: [
                {
                  label: `${stats.high} Haute`,
                  color: THEME.error,
                  filter: { priority: ["high"] },
                },
              ],
            },
            {
              title: "Taux complétion",
              value: total ? `${Math.round((stats.done / total) * 100)}%` : "0%",
              icon: <TrendingUpIcon />,
              color: THEME.success,
              chips: [
                {
                  label: `${stats.done} Terminées`,
                  color: THEME.success,
                  filter: { status: ["done"] },
                },
              ],
            },
          ].map((card, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <StatsCardItem
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                onClick={() => setFilters({})}
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
                  placeholder="Rechercher une tâche..."
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
                      { mode: "table", icon: <ViewColumnIcon /> },
                      { mode: "cards", icon: <BarChartIcon /> },
                    ].map((v) => (
                      <Button
                        key={v.mode}
                        onClick={() => setViewMode(v.mode)}
                        sx={{
                          bgcolor: viewMode === v.mode ? alpha(THEME.primary, 0.1) : "transparent",
                          color: viewMode === v.mode ? THEME.primary : "text.secondary",
                          borderColor: alpha(THEME.primary, 0.3),
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
                          borderColor: alpha(THEME.primary, 0.3),
                        },
                      }}
                    >
                      <MenuItem value="-created_at">Date création ↓</MenuItem>
                      <MenuItem value="created_at">Date création ↑</MenuItem>
                      <MenuItem value="title">Titre A→Z</MenuItem>
                      <MenuItem value="-priority">Priorité ↓</MenuItem>
                      <MenuItem value="status">Statut</MenuItem>
                      <MenuItem value="due_date">Date limite ↑</MenuItem>
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
                      onClick={() => setShowFilters(true)}
                      size="small"
                      sx={{
                        borderRadius: 3,
                        borderColor:
                          activeFilterCount > 0 ? THEME.primary : alpha(THEME.primary, 0.3),
                        color: THEME.primary,
                        bgcolor: activeFilterCount > 0 ? alpha(THEME.primary, 0.05) : "transparent",
                      }}
                    >
                      Filtres
                    </Button>
                  </Badge>
                  <ExportMenu onExportCSV={exportToCSV} />
                  <Tooltip title="Rafraîchir">
                    <IconButton
                      size="small"
                      onClick={refreshTasks}
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

            {/* Chips des filtres actifs - Style identique à Prospects */}
            {activeFilterCount > 0 && (
              <Box mt={2} display="flex" flexWrap="wrap" gap={0.5} alignItems="center">
                <Typography variant="caption" color="textSecondary" sx={{ mr: 1 }}>
                  Filtres actifs :
                </Typography>
                {filters.status?.map((v) => (
                  <Chip
                    key={`s-${v}`}
                    label={`Statut: ${getStatusLabel(v)}`}
                    size="small"
                    onDelete={() =>
                      setFilters({
                        ...filters,
                        status: filters.status.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.info, 0.1),
                      color: THEME.info,
                      border: `1px solid ${alpha(THEME.info, 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                {filters.priority?.map((v) => (
                  <Chip
                    key={`p-${v}`}
                    label={`Priorité: ${getPriorityLabel(v)}`}
                    size="small"
                    onDelete={() =>
                      setFilters({
                        ...filters,
                        priority: filters.priority.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha(THEME.warning, 0.1),
                      color: THEME.warning,
                      border: `1px solid ${alpha(THEME.warning, 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                {filters.task_type?.map((v) => (
                  <Chip
                    key={`t-${v}`}
                    label={`Type: ${getTaskTypeLabel(v)}`}
                    size="small"
                    onDelete={() =>
                      setFilters({
                        ...filters,
                        task_type: filters.task_type.filter((x) => x !== v),
                      })
                    }
                    sx={{
                      borderRadius: 1,
                      bgcolor: alpha("#7c3aed", 0.1),
                      color: "#7c3aed",
                      border: `1px solid ${alpha("#7c3aed", 0.3)}`,
                      fontSize: "0.72rem",
                    }}
                  />
                ))}
                <Chip
                  label="Tout effacer"
                  size="small"
                  onClick={() => setFilters({})}
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha(THEME.primary, 0.1),
                    color: THEME.primary,
                    border: `1px solid ${alpha(THEME.primary, 0.3)}`,
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                />
              </Box>
            )}
          </CardContent>
        </StyledCard>

        {/* Vue Tableau - Style identique à Prospects */}
        {viewMode === "table" && (
          <StyledCard>
            <StyledTableContainer>
              <Table>
                <StyledTableHead>
                  <TableRow>
                    <TableCell sx={{ width: 280 }}>Tâche</TableCell>
                    <TableCell sx={{ width: 140 }}>Assigné à</TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      Priorité
                    </TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      Statut
                    </TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      Type
                    </TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      Activités
                    </TableCell>
                    <TableCell sx={{ width: 160 }}>Progression</TableCell>
                    <TableCell sx={{ width: 100 }} align="center">
                      Date limite
                    </TableCell>
                    <TableCell sx={{ width: 140 }} align="center">
                      Actions
                    </TableCell>
                  </TableRow>
                </StyledTableHead>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                        <Box textAlign="center">
                          <AssignmentIcon
                            sx={{ fontSize: 48, color: alpha(THEME.primary, 0.3), mb: 2 }}
                          />
                          <Typography variant="h6" color="textSecondary" gutterBottom>
                            Aucune tâche trouvée
                          </Typography>
                          <GradientButton
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => {
                              setEditingTask(null);
                              setShowForm(true);
                            }}
                            sx={{ mt: 2 }}
                          >
                            Créer une tâche
                          </GradientButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((task) => (
                      <TaskTableRow
                        key={task.id}
                        task={task}
                        currentUser={user}
                        onView={handleViewDetails}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                        onContextMenu={handleContextMenu}
                      />
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

        {/* Vue Cartes - Style identique à Prospects */}
        {viewMode === "cards" && (
          <>
            <Grid container spacing={2}>
              {tasks.map((task) => (
                <Grid item xs={12} sm={6} md={4} key={task.id}>
                  <TaskCard
                    task={task}
                    currentUser={user}
                    onView={handleViewDetails}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                  />
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

        {/* Menu contextuel */}
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
              const t = tasks.find((x) => x.id === contextTaskId);
              if (t) handleViewDetails(t);
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
              const t = tasks.find((x) => x.id === contextTaskId);
              if (t) handleEdit(t);
              handleContextMenuClose();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText>Modifier</ListItemText>
          </MenuItem>
          {isAdminOrManager && (
            <MenuItem
              onClick={() => {
                if (contextTaskId) handleDeleteClick(contextTaskId);
                handleContextMenuClose();
              }}
              sx={{ color: THEME.primary }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" sx={{ color: THEME.primary }} />
              </ListItemIcon>
              <ListItemText>Supprimer</ListItemText>
            </MenuItem>
          )}
        </Menu>

        <TaskFormDrawer
          open={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
          onSaved={handleSaved}
          assignableUsers={assignableUsers}
          currentUser={user}
          editingTask={editingTask}
        />

        <TaskDetailsDrawer
          open={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          task={selectedTask}
          onStatusChange={handleStatusChange}
          onQuotaUpdate={handleQuotaUpdate}
          onTaskClosed={handleTaskClosed}
          currentUser={user}
          assignableUsers={assignableUsers}
        />

        {/* Drawer filtres */}
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
            {[
              {
                label: "Statut",
                key: "status",
                options: [
                  { value: "todo", label: "A faire" },
                  { value: "pending", label: "En attente" },
                  { value: "ready", label: "Pret" },
                  { value: "in_progress", label: "En cours" },
                  { value: "done", label: "Termine" },
                  { value: "completed", label: "Termine" },
                  { value: "cancelled", label: "Annule" },
                  { value: "failed", label: "Echec" },
                ],
              },
              {
                label: "Priorité",
                key: "priority",
                options: [
                  { value: "high", label: "Haute" },
                  { value: "medium", label: "Moyenne" },
                  { value: "low", label: "Basse" },
                ],
              },
              {
                label: "Type",
                key: "task_type",
                options: [
                  { value: "classic", label: "Classique" },
                  { value: "quota", label: "Quota" },
                  { value: "call", label: "Telephone" },
                  { value: "linkedin_message", label: "LinkedIn" },
                  { value: "email", label: "Email" },
                  { value: "facebook_message", label: "Facebook" },
                  { value: "instagram_message", label: "Instagram" },
                  { value: "follow_up", label: "Relance" },
                  { value: "meeting", label: "RDV" },
                  { value: "note", label: "Note" },
                ],
              },
            ].map((filter) => (
              <Grid item xs={12} key={filter.key}>
                <FormControl fullWidth size="small">
                  <InputLabel>{filter.label}</InputLabel>
                  <Select
                    multiple
                    value={filters[filter.key] || []}
                    label={filter.label}
                    onChange={(e) => setFilters({ ...filters, [filter.key]: e.target.value })}
                    renderValue={(selected) => (
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {selected.map((v) => (
                          <Chip
                            key={v}
                            label={filter.options.find((o) => o.value === v)?.label || v}
                            size="small"
                            sx={{ borderRadius: 1 }}
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {filter.options.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            ))}
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Date début"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={filters.date_from || ""}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Date fin"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={filters.date_to || ""}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </Grid>
          </Grid>
          <Box mt={4} display="flex" gap={2} justifyContent="space-between">
            <Button
              onClick={() => {
                setFilters({});
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
              <GradientButton onClick={() => setShowFilters(false)} sx={{ borderRadius: 3 }}>
                Appliquer
              </GradientButton>
            </Box>
          </Box>
        </Drawer>

        {/* Dialog suppression */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          PaperProps={{
            sx: { borderRadius: 4, p: 1, boxShadow: `0 8px 24px ${alpha(THEME.primary, 0.2)}` },
          }}
        >
          <DialogTitle sx={{ color: THEME.primary, fontWeight: 600 }}>
            Confirmer la suppression
          </DialogTitle>
          <DialogContent>
            <Typography>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              sx={{ borderRadius: 3, color: "text.secondary" }}
            >
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
