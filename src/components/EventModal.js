/* eslint-disable prettier/prettier */
// src/components/CRMCalendar/EventModal.jsx
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Typography,
  IconButton,
  Divider,
  Autocomplete,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import PersonIcon from "@mui/icons-material/Person";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import FlagIcon from "@mui/icons-material/Flag";
import EventIcon from "@mui/icons-material/Event";
import NotificationsIcon from "@mui/icons-material/Notifications";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const CRM_RED = {
  main: "#C62828",
  light: "#EF9A9A",
  dark: "#8B0000",
  surface: "#FFEBEE",
  border: "#FFCDD2",
};

// ── Types d'événements ────────────────────────────────────────────────────────
// readOnly = true → généré automatiquement par les signaux backend, non créable manuellement
const EVENT_TYPES = [
  { value: "task", label: "Tâche", icon: "✅", color: "#7b1fa2", readOnly: false },
  { value: "meeting", label: "Réunion", icon: "📅", color: "#0288d1", readOnly: false },
  { value: "deadline", label: "Échéance", icon: "⏰", color: "#C62828", readOnly: false },
  { value: "reminder", label: "Rappel", icon: "🔔", color: "#f57c00", readOnly: false },
  { value: "stage", label: "Étape Pipeline", icon: "🏁", color: "#388e3c", readOnly: false },
  { value: "activity", label: "Activité CRM", icon: "📝", color: "#00695c", readOnly: true },
  {
    value: "pipeline_alert",
    label: "Alerte Pipeline",
    icon: "⚠️",
    color: "#bf360c",
    readOnly: true,
  },
];

const PRIORITIES = [
  { value: "low", label: "Basse", color: "#4caf50", bg: "#e8f5e9" },
  { value: "medium", label: "Moyenne", color: "#1976d2", bg: "#e3f2fd" },
  { value: "high", label: "Haute", color: "#ff9800", bg: "#fff3e0" },
  { value: "critical", label: "Critique", color: "#C62828", bg: "#ffebee" },
];

const REMINDER_OPTIONS = [
  { value: 15, label: "15 minutes avant" },
  { value: 30, label: "30 minutes avant" },
  { value: 60, label: "1 heure avant" },
  { value: 1440, label: "1 jour avant" },
];

const ALERT_SEVERITY_LABELS = {
  info: "Information",
  warning: "Avertissement",
  critical: "Critique",
};

const ACTIVITY_TYPE_LABELS = {
  call: "Appel",
  email: "Email",
  note: "Note",
  meeting: "Meeting",
  status_change: "Changement de statut",
};

// ── Formulaire vide par défaut ────────────────────────────────────────────────
const DEFAULT_FORM = {
  title: "",
  description: "",
  start: "",
  end: "",
  all_day: false,
  event_type: "task",
  priority: "medium",
  color: "#C62828",
  task: null,
  opportunity: null,
  pipeline_stage: null,
  assigned_to: null,
  reminder: "",
  _pipeline: "", // champ UI interne, non envoyé au backend
};

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(val) {
  return val ? new Date(val).toISOString() : "";
}

// ── Sous-composants ───────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const t = EVENT_TYPES.find((e) => e.value === type) || EVENT_TYPES[0];
  return (
    <Chip
      size="small"
      label={
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <span style={{ fontSize: 13 }}>{t.icon}</span>
          <span>{t.label}</span>
        </Stack>
      }
      sx={{
        bgcolor: `${t.color}18`,
        color: t.color,
        border: `1px solid ${t.color}40`,
        fontWeight: 600,
      }}
    />
  );
}
TypeBadge.propTypes = { type: PropTypes.string.isRequired };

function PriorityBadge({ priority }) {
  const p = PRIORITIES.find((x) => x.value === priority) || PRIORITIES[1];
  return (
    <Chip
      size="small"
      icon={<FlagIcon style={{ fontSize: 14, color: p.color }} />}
      label={p.label}
      sx={{ bgcolor: p.bg, color: p.color, border: `1px solid ${p.color}40`, fontWeight: 600 }}
    />
  );
}
PriorityBadge.propTypes = { priority: PropTypes.string.isRequired };

function Section({ icon, label, children }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Box sx={{ color: CRM_RED.main, display: "flex" }}>{icon}</Box>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ textTransform: "uppercase", letterSpacing: 1, color: CRM_RED.main }}
        >
          {label}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}
Section.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

// ── Bloc lecture seule pour events auto-sync ──────────────────────────────────
function ReadOnlyInfo({ event }) {
  if (!event) return null;
  const lines = [];

  // Activity
  if (event.eventType === "task") {
    if (event.taskTitle) lines.push({ label: "Tâche liée", value: event.taskTitle });
    if (event.taskStatus) lines.push({ label: "Statut", value: event.taskStatus });
    if (event.taskIsOverdue) lines.push({ label: "Alerte", value: "Tâche en retard" });
  }

  // Activity
  if (event.eventType === "activity") {
    if (event.activityType)
      lines.push({
        label: "Type d'activité",
        value: ACTIVITY_TYPE_LABELS[event.activityType] || event.activityType,
      });
    if (event.activityResult) lines.push({ label: "Résultat appel", value: event.activityResult });
    if (event.meetingLocation) lines.push({ label: "Lieu", value: event.meetingLocation });
    if (event.taskTitle) lines.push({ label: "Tâche liée", value: event.taskTitle });
  }

  // Pipeline alert
  if (event.eventType === "pipeline_alert") {
    if (event.alertType) lines.push({ label: "Type d'alerte", value: event.alertType });
    if (event.alertSeverity)
      lines.push({
        label: "Sévérité",
        value: ALERT_SEVERITY_LABELS[event.alertSeverity] || event.alertSeverity,
      });
    if (event.alertIsRead !== undefined)
      lines.push({ label: "Lu", value: event.alertIsRead ? "Oui" : "Non" });
  }

  // Stage
  if (event.eventType === "stage") {
    if (event.stageName) lines.push({ label: "Étape", value: event.stageName });
    if (event.pipelineName) lines.push({ label: "Pipeline", value: event.pipelineName });
    if (event.opStatus) lines.push({ label: "Statut", value: event.opStatus });
    if (event.opProgression != null)
      lines.push({ label: "Progression", value: `${event.opProgression}%` });
  }

  // Deadline
  if (event.eventType === "deadline") {
    if (event.opportunityName) lines.push({ label: "Opportunité", value: event.opportunityName });
    if (event.opportunityStage) lines.push({ label: "Étape CRM", value: event.opportunityStage });
    if (event.opportunityAmount)
      lines.push({ label: "Montant", value: `${event.opportunityAmount} TND` });
  }

  if (lines.length === 0) return null;

  return (
    <Alert
      severity="info"
      icon={<InfoOutlinedIcon fontSize="small" />}
      sx={{ borderRadius: 2, "& .MuiAlert-message": { width: "100%" } }}
    >
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
        Informations CRM liées
      </Typography>
      <Stack spacing={0.4}>
        {lines.map((l, i) => (
          <Stack key={i} direction="row" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>
              {l.label} :
            </Typography>
            <Typography variant="caption" fontWeight={500}>
              {l.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}
ReadOnlyInfo.propTypes = { event: PropTypes.object };
ReadOnlyInfo.defaultProps = { event: null };

// ── Composant principal ───────────────────────────────────────────────────────
export default function EventModal({
  open,
  event,
  defaultDates,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onSaved,
  fetchTasks,
  fetchPipelines,
  fetchStages,
  fetchUsers,
}) {
  const isEdit = Boolean(event?.id);
  const isAutoSync =
    isEdit && (event?.isVirtualTaskEvent || ["activity", "pipeline_alert"].includes(event?.eventType));

  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [delConf, setDelConf] = useState(false);

  // Données dynamiques
  const [tasks, setTasks] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  // ── Init formulaire à l'ouverture ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (isEdit) {
      setForm({
        title: event.title || "",
        description: event.description || "",
        start: toLocalInput(event.start),
        end: toLocalInput(event.end),
        all_day: event.allDay || false,
        event_type: event.eventType || "task",
        priority: event.priority || "medium",
        color: event.color || "#C62828",
        // Liaisons CRM
        task: event.task ? { id: event.task, title: event.taskTitle || "" } : null,
        opportunity: event.opportunity
          ? { id: event.opportunity, name: event.opportunityName || "" }
          : null,
        pipeline_stage: event.pipelineStage
          ? { id: event.pipelineStage, name: event.stageName || "" }
          : null,
        assigned_to: event.assignedTo
          ? {
              id: event.assignedTo,
              first_name: event.assignedName?.split(" ")[0] || "",
              last_name: event.assignedName?.split(" ").slice(1).join(" ") || "",
              username: "",
            }
          : null,
        reminder: event.reminder || "",
        _pipeline: "",
      });
    } else {
      setForm({
        ...DEFAULT_FORM,
        start: toLocalInput(defaultDates?.start || ""),
        end: toLocalInput(defaultDates?.end || ""),
        all_day: defaultDates?.allDay || false,
      });
    }

    setErrors({});
    setDelConf(false);

    // Charger les listes de référence
    if (fetchTasks) {
      setLoadingTasks(true);
      fetchTasks()
        .then(setTasks)
        .catch(console.error)
        .finally(() => setLoadingTasks(false));
    }
    if (fetchPipelines) fetchPipelines().then(setPipelines).catch(console.error);
    if (fetchUsers) fetchUsers().then(setUsers).catch(console.error);
  }, [open]); // eslint-disable-line

  // Charger les étapes quand le pipeline change
  useEffect(() => {
    if (!form._pipeline || !fetchStages) {
      setStages([]);
      return;
    }
    setLoadingStages(true);
    fetchStages(form._pipeline)
      .then(setStages)
      .catch(console.error)
      .finally(() => setLoadingStages(false));
  }, [form._pipeline, fetchStages]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Le titre est obligatoire";
    if (!form.start) e.start = "La date de début est obligatoire";
    if (form.end && form.start && form.end < form.start)
      e.end = "La date de fin doit être après le début";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    // On n'envoie JAMAIS task_activity / pipeline_alert / opportunity_pipeline
    // ces champs sont gérés uniquement par les signaux Django
    const payload = {
      title: form.title.trim(),
      description: form.description,
      start: fromLocalInput(form.start),
      end: form.end ? fromLocalInput(form.end) : null,
      all_day: form.all_day,
      event_type: form.event_type,
      priority: form.priority,
      color: form.color,
      task: form.task?.id || null,
      opportunity: form.opportunity?.id || null,
      pipeline_stage: form.pipeline_stage?.id || null,
      assigned_to: form.assigned_to?.id || null,
      reminder: form.reminder || null,
    };

    try {
      if (isEdit) await onUpdate(event.id, payload);
      else await onCreate(payload);
      onSaved?.();
    } catch (err) {
      setErrors({ submit: err?.response?.data?.detail || "Une erreur est survenue" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!delConf) {
      setDelConf(true);
      return;
    }
    setLoading(true);
    try {
      await onDelete(event.id);
      onSaved?.();
    } catch {
      setErrors({ submit: "Erreur lors de la suppression" });
    } finally {
      setLoading(false);
    }
  };

  const headerColor = EVENT_TYPES.find((t) => t.value === form.event_type)?.color || CRM_RED.main;
  const inputSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
      "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: CRM_RED.light },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: CRM_RED.main },
    },
    "& label.Mui-focused": { color: CRM_RED.main },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      {/* En-tête coloré */}
      <Box sx={{ bgcolor: headerColor, px: 3, pt: 2.5, pb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ fontSize: 22 }}>
              {EVENT_TYPES.find((t) => t.value === form.event_type)?.icon || "📅"}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} color="#fff" lineHeight={1.2}>
                {isEdit ? "Modifier l'événement" : "Nouvel événement"}
              </Typography>
              <Stack direction="row" spacing={1} mt={0.5}>
                <TypeBadge type={form.event_type} />
                <PriorityBadge priority={form.priority} />
              </Stack>
            </Box>
          </Stack>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: "rgba(255,255,255,0.8)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <Stack spacing={2.5}>
          {errors.submit && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {errors.submit}
            </Alert>
          )}

          {/* Bloc infos lecture seule pour les événements auto-sync */}
          {isEdit && <ReadOnlyInfo event={event} />}

          {/* Titre */}
          <TextField
            label="Titre *"
            fullWidth
            size="small"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title}
            placeholder="Nom de l'événement..."
            disabled={isAutoSync}
            sx={inputSx}
          />

          {/* Type + Priorité */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel>Type</InputLabel>
              <Select
                value={form.event_type}
                label="Type"
                onChange={(e) => set("event_type", e.target.value)}
                disabled={isAutoSync}
              >
                {EVENT_TYPES
                  // En création : masquer les types readOnly (activity, pipeline_alert)
                  // En édition  : afficher tous pour refléter le type réel
                  .filter((t) => isEdit || !t.readOnly)
                  .map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                        {t.readOnly && (
                          <Typography variant="caption" color="text.secondary">
                            (auto)
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel>Priorité</InputLabel>
              <Select
                value={form.priority}
                label="Priorité"
                onChange={(e) => set("priority", e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: p.color }} />
                      <span>{p.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider sx={{ borderColor: CRM_RED.border }} />

          {/* Dates */}
          <Section icon={<EventIcon fontSize="small" />} label="Date et Heure">
            <Stack spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.all_day}
                    onChange={(e) => set("all_day", e.target.checked)}
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": { color: CRM_RED.main },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                        bgcolor: CRM_RED.light,
                      },
                    }}
                  />
                }
                label={<Typography variant="body2">Journée entière</Typography>}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="Début *"
                  type={form.all_day ? "date" : "datetime-local"}
                  fullWidth
                  size="small"
                  value={form.all_day ? form.start?.slice(0, 10) : form.start}
                  onChange={(e) => set("start", e.target.value)}
                  error={Boolean(errors.start)}
                  helperText={errors.start}
                  InputLabelProps={{ shrink: true }}
                  sx={inputSx}
                />
                <TextField
                  label="Fin"
                  type={form.all_day ? "date" : "datetime-local"}
                  fullWidth
                  size="small"
                  value={form.all_day ? form.end?.slice(0, 10) : form.end}
                  onChange={(e) => set("end", e.target.value)}
                  error={Boolean(errors.end)}
                  helperText={errors.end}
                  InputLabelProps={{ shrink: true }}
                  sx={inputSx}
                />
              </Stack>
            </Stack>
          </Section>

          <Divider sx={{ borderColor: CRM_RED.border }} />

          {/* Liaison CRM — masquée pour les events auto-sync */}
          {!isAutoSync && (
            <Section icon={<LinkIcon fontSize="small" />} label="Liaison CRM">
              <Stack spacing={1.5}>
                {/* Tâche */}
                <Autocomplete
                  size="small"
                  options={tasks}
                  value={form.task}
                  onChange={(_, v) => set("task", v)}
                  loading={loadingTasks}
                  getOptionLabel={(t) => t.title || ""}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderOption={(props, t) => (
                    <Box component="li" {...props}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <span style={{ fontSize: 13 }}>✅</span>
                        <Box>
                          <Typography variant="body2">{t.title}</Typography>
                          {t.status && (
                            <Typography variant="caption" color="text.secondary">
                              {t.status}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Lier à une tâche"
                      placeholder="Rechercher une tâche..."
                      sx={inputSx}
                    />
                  )}
                />

                {/* Pipeline + Étape */}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <FormControl fullWidth size="small" sx={inputSx}>
                    <InputLabel>Pipeline</InputLabel>
                    <Select
                      value={form._pipeline || ""}
                      label="Pipeline"
                      onChange={(e) => {
                        set("_pipeline", e.target.value);
                        set("pipeline_stage", null);
                      }}
                    >
                      <MenuItem value="">
                        <em>Aucun</em>
                      </MenuItem>
                      {pipelines.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: p.color || CRM_RED.main,
                              }}
                            />
                            <span>{p.name}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    fullWidth
                    size="small"
                    sx={inputSx}
                    disabled={!form._pipeline || loadingStages}
                  >
                    <InputLabel>Étape</InputLabel>
                    <Select
                      value={form.pipeline_stage?.id || ""}
                      label="Étape"
                      onChange={(e) => {
                        const s = stages.find((st) => st.id === e.target.value) || null;
                        set("pipeline_stage", s);
                      }}
                    >
                      <MenuItem value="">
                        <em>Aucune</em>
                      </MenuItem>
                      {stages.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: 1,
                                bgcolor: s.color || CRM_RED.light,
                              }}
                            />
                            <span>{s.name}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            </Section>
          )}

          {!isAutoSync && <Divider sx={{ borderColor: CRM_RED.border }} />}

          {/* Assigné à */}
          <Section icon={<PersonIcon fontSize="small" />} label="Assigné à">
            <Autocomplete
              size="small"
              options={users}
              value={form.assigned_to}
              onChange={(_, v) => set("assigned_to", v)}
              getOptionLabel={(u) => `${u.first_name} ${u.last_name}`.trim() || u.username}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderOption={(props, u) => (
                <Box component="li" {...props}>
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: CRM_RED.main }}>
                      {(u.first_name?.[0] || u.username?.[0] || "?").toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">
                        {`${u.first_name} ${u.last_name}`.trim() || u.username}
                      </Typography>
                      {u.email && (
                        <Typography variant="caption" color="text.secondary">
                          {u.email}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Membre de l'équipe"
                  placeholder="Rechercher..."
                  sx={inputSx}
                />
              )}
            />
          </Section>

          <Divider sx={{ borderColor: CRM_RED.border }} />

          {/* Rappel */}
          <Section icon={<NotificationsIcon fontSize="small" />} label="Rappel">
            <FormControl fullWidth size="small" sx={inputSx}>
              <InputLabel>Rappel avant l&apos;événement</InputLabel>
              <Select
                value={form.reminder}
                label="Rappel avant l'événement"
                onChange={(e) => set("reminder", e.target.value)}
              >
                <MenuItem value="">
                  <em>Pas de rappel</em>
                </MenuItem>
                {REMINDER_OPTIONS.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Section>

          <Divider sx={{ borderColor: CRM_RED.border }} />

          {/* Description */}
          <TextField
            label="Description"
            multiline
            rows={3}
            fullWidth
            size="small"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Détails, notes, instructions..."
            sx={inputSx}
          />

          {/* Couleur */}
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Couleur :
            </Typography>
            <Stack direction="row" spacing={1}>
              {[
                "#C62828",
                "#7b1fa2",
                "#0288d1",
                "#388e3c",
                "#f57c00",
                "#455a64",
                "#00695c",
                "#bf360c",
              ].map((c) => (
                <Tooltip key={c} title={c}>
                  <Box
                    onClick={() => set("color", c)}
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      bgcolor: c,
                      cursor: "pointer",
                      border: form.color === c ? `3px solid ${c}` : "3px solid transparent",
                      outline: form.color === c ? `2px solid ${c}40` : "none",
                      transition: "all 0.15s",
                      "&:hover": { transform: "scale(1.2)" },
                    }}
                  />
                </Tooltip>
              ))}
              {/* Couleur personnalisée */}
              <Tooltip title="Couleur personnalisée">
                <Box sx={{ position: "relative", width: 24, height: 24 }}>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => set("color", e.target.value)}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                    }}
                  />
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "2px dashed #bbb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#bbb",
                      pointerEvents: "none",
                    }}
                  >
                    +
                  </Box>
                </Box>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>

      <Divider sx={{ borderColor: CRM_RED.border }} />
      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        {isEdit && !isAutoSync ? (
          <Button
            variant={delConf ? "contained" : "outlined"}
            color="error"
            size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDelete}
            disabled={loading || isAutoSync}
            sx={{
              borderRadius: 2,
              ...(delConf && { bgcolor: "#d32f2f", "&:hover": { bgcolor: "#b71c1c" } }),
            }}
          >
            {delConf ? "Confirmer la suppression" : "Supprimer"}
          </Button>
        ) : (
          <Box />
        )}

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            onClick={onClose}
            disabled={loading}
            sx={{
              borderRadius: 2,
              borderColor: CRM_RED.border,
              color: CRM_RED.main,
              "&:hover": { borderColor: CRM_RED.main, bgcolor: CRM_RED.surface },
            }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={loading || isAutoSync}
            startIcon={
              loading ? (
                <CircularProgress size={14} sx={{ color: "#fff" }} />
              ) : isEdit ? (
                <EditIcon />
              ) : (
                <AddIcon />
              )
            }
            sx={{
              borderRadius: 2,
              bgcolor: CRM_RED.main,
              fontWeight: 700,
              boxShadow: `0 2px 8px ${CRM_RED.light}`,
              "&:hover": { bgcolor: CRM_RED.dark },
            }}
          >
            {isEdit ? "Enregistrer" : "Créer l'événement"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

EventModal.propTypes = {
  open: PropTypes.bool.isRequired,
  event: PropTypes.object,
  defaultDates: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
  fetchTasks: PropTypes.func,
  fetchPipelines: PropTypes.func,
  fetchStages: PropTypes.func,
  fetchUsers: PropTypes.func,
};
EventModal.defaultProps = {
  event: null,
  defaultDates: null,
  onSaved: null,
  fetchTasks: null,
  fetchPipelines: null,
  fetchStages: null,
  fetchUsers: null,
};
