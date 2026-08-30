// ══════════════════════════════════════════════════════════════
// TriggerSystem.jsx — Composants de notification de trigger
// À importer dans TasksPage.jsx et utiliser dans AddActivityForm
// ══════════════════════════════════════════════════════════════
//
// USAGE dans TasksPage.jsx :
//   import { TriggerNotification, EnhancedAddActivityForm, NoAnswerBadge } from "./TriggerSystem";
//
// Remplacer <AddActivityForm> par <EnhancedAddActivityForm> dans TaskDetailsDrawer.
// ══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { createApiClient } from "../services/axiosConfig";
import {
  Box,
  Chip,
  Typography,
  Alert,
  AlertTitle,
  Button,
  Collapse,
  Stack,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  TextareaAutosize,
  Divider,
  Avatar,
  LinearProgress,
  Tooltip,
  alpha,
} from "@mui/material";
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  Note as NoteIcon,
  Groups as MeetingIcon,
  Send as SendIcon,
  AutoFixHigh as TriggerIcon,
  Assignment as TaskIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RetryIcon,
  EscalatorWarning as EscalateIcon,
} from "@mui/icons-material";

const API_BASE_URL = "/api/sales";
const api = createApiClient(API_BASE_URL);

const THEME = {
  primary: "#d32f2f",
  gradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  success: "#4caf50",
  warning: "#ff9800",
  info: "#2196f3",
  error: "#f44336",
};

// ══════════════════════════════════════════════════════════════
// TRIGGER NOTIFICATION BANNER
// Affiché après la soumission d'une activité d'appel avec résultat
// ══════════════════════════════════════════════════════════════

export const TriggerNotification = ({ trigger, onViewTask, onDismiss }) => {
  const [visible, setVisible] = useState(true);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  if (!trigger || !trigger.triggered) return null;

  const config = {
    no_answer: {
      icon: <RetryIcon sx={{ fontSize: 20 }} />,
      color: THEME.warning,
      bgColor: alpha(THEME.warning, 0.08),
      borderColor: alpha(THEME.warning, 0.3),
      label: "Relance planifiée",
    },
    prospect_unreachable: {
      icon: <ErrorIcon sx={{ fontSize: 20 }} />,
      color: THEME.error,
      bgColor: alpha(THEME.error, 0.08),
      borderColor: alpha(THEME.error, 0.3),
      label: "Prospect injoignable",
    },
    not_interested: {
      icon: <InfoIcon sx={{ fontSize: 20 }} />,
      color: THEME.info,
      bgColor: alpha(THEME.info, 0.08),
      borderColor: alpha(THEME.info, 0.3),
      label: "Email de relance planifié",
    },
    interested: {
      icon: <CheckCircleIcon sx={{ fontSize: 20 }} />,
      color: THEME.success,
      bgColor: alpha(THEME.success, 0.08),
      borderColor: alpha(THEME.success, 0.3),
      label: "Meeting planifié !",
    },
    callback: {
      icon: <PhoneIcon sx={{ fontSize: 20 }} />,
      color: THEME.primary,
      bgColor: alpha(THEME.primary, 0.08),
      borderColor: alpha(THEME.primary, 0.3),
      label: "Rappel planifié",
    },
  };

  const cfg = config[trigger.action] || config["no_answer"];

  return (
    <Collapse in={visible}>
      <Box
        sx={{
          mt: 2,
          p: 2,
          borderRadius: 3,
          border: `1px solid ${cfg.borderColor}`,
          bgcolor: cfg.bgColor,
          position: "relative",
        }}
      >
        {/* Header */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(cfg.color, 0.15), color: cfg.color }}>
            <TriggerIcon sx={{ fontSize: 16 }} />
          </Avatar>
          <Typography variant="body2" fontWeight={600} sx={{ color: cfg.color }}>
            🤖 Trigger automatique déclenché
          </Typography>
        </Box>

        {/* Badge action */}
        <Chip
          icon={cfg.icon}
          label={cfg.label}
          size="small"
          sx={{
            mb: 1,
            bgcolor: alpha(cfg.color, 0.12),
            color: cfg.color,
            border: `1px solid ${cfg.color}`,
            fontWeight: 600,
          }}
        />

        {/* Message */}
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
          {trigger.message}
        </Typography>

        {/* Tentatives badge (no_answer) */}
        {trigger.attempt_number && (
          <Box mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="textSecondary">
                Tentatives d&apos;appel
              </Typography>
              <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600 }}>
                {trigger.attempt_number} / 4
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(trigger.attempt_number / 4) * 100}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(cfg.color, 0.1),
                "& .MuiLinearProgress-bar": { bgcolor: cfg.color, borderRadius: 3 },
              }}
            />
          </Box>
        )}

        {/* Escalade manager */}
        {trigger.escalated && (
          <Box
            display="flex"
            alignItems="center"
            gap={0.5}
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: alpha(THEME.error, 0.08),
              border: `1px solid ${alpha(THEME.error, 0.2)}`,
              mb: 1.5,
            }}
          >
            <EscalateIcon sx={{ fontSize: 16, color: THEME.error }} />
            <Typography variant="caption" sx={{ color: THEME.error, fontWeight: 600 }}>
              Manager notifié automatiquement
            </Typography>
          </Box>
        )}

        {/* Actions */}
        <Box display="flex" gap={1} justifyContent="flex-end">
          <Button
            size="small"
            onClick={handleDismiss}
            sx={{ borderRadius: 2, color: "text.secondary", fontSize: "0.75rem" }}
          >
            Ignorer
          </Button>
          {trigger.follow_up_task_id && onViewTask && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<TaskIcon sx={{ fontSize: 14 }} />}
              onClick={() => onViewTask(trigger.follow_up_task_id)}
              sx={{
                borderRadius: 2,
                borderColor: cfg.color,
                color: cfg.color,
                fontSize: "0.75rem",
              }}
            >
              Voir la tâche créée
            </Button>
          )}
        </Box>
      </Box>
    </Collapse>
  );
};
TriggerNotification.propTypes = {
  trigger: PropTypes.object,
  onViewTask: PropTypes.func,
  onDismiss: PropTypes.func.isRequired,
};

// ══════════════════════════════════════════════════════════════
// NO ANSWER BADGE — Compteur de tentatives
// Affiché dans le header de la task quand calls_count > 0
// ══════════════════════════════════════════════════════════════

export const NoAnswerBadge = ({ prospectId, taskId }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!prospectId && !taskId) return;
    const params = prospectId ? `prospect_id=${prospectId}` : `task_id=${taskId}`;
    api
      .get(`/task-activities/no-answer-count/?${params}`)
      .then((res) => setData(res.data))
      .catch(() => {});
  }, [prospectId, taskId]);

  if (!data || data.no_answer_count === 0) return null;

  const isUnreachable = data.is_unreachable;
  const willEscalate = data.will_escalate_next;
  const color = isUnreachable ? THEME.error : willEscalate ? THEME.warning : THEME.info;

  return (
    <Tooltip
      title={
        isUnreachable
          ? "Prospect injoignable — 4 tentatives sans réponse"
          : willEscalate
          ? "Prochain échec → manager notifié"
          : `${data.remaining_attempts} tentative(s) restante(s) avant escalade`
      }
    >
      <Chip
        icon={<PhoneIcon sx={{ fontSize: 14 }} />}
        label={`${data.no_answer_count}/${data.max_attempts} tentatives`}
        size="small"
        sx={{
          bgcolor: alpha(color, 0.1),
          color,
          border: `1px solid ${color}`,
          fontSize: "0.7rem",
          height: 22,
          fontWeight: 600,
        }}
      />
    </Tooltip>
  );
};
NoAnswerBadge.propTypes = {
  prospectId: PropTypes.number,
  taskId: PropTypes.number,
};

// ══════════════════════════════════════════════════════════════
// CALL RESULT SELECTOR — Sélection guidée du résultat d'appel
// Composant visuel qui remplace le simple <Select> du résultat
// ══════════════════════════════════════════════════════════════

const CALL_RESULT_OPTIONS = [
  {
    value: "no_answer",
    label: "Pas de réponse",
    description: "Le prospect n'a pas décroché",
    icon: <PhoneIcon sx={{ fontSize: 18 }} />,
    color: THEME.warning,
    triggerLabel: "Relance auto dans 2–5j",
  },
  {
    value: "interested",
    label: "Intéressé",
    description: "Le prospect veut en savoir plus",
    icon: <CheckCircleIcon sx={{ fontSize: 18 }} />,
    color: THEME.success,
    triggerLabel: "Meeting planifié dans 1j",
  },
  {
    value: "not_interested",
    label: "Pas intéressé",
    description: "Le prospect décline l'offre",
    icon: <ErrorIcon sx={{ fontSize: 18 }} />,
    color: THEME.error,
    triggerLabel: "Email relance dans 7j",
  },
  {
    value: "callback",
    label: "Rappeler plus tard",
    description: "Le prospect demande un rappel",
    icon: <RetryIcon sx={{ fontSize: 18 }} />,
    color: THEME.info,
    triggerLabel: "Tâche rappel créée",
  },
];

export const CallResultSelector = ({ value, onChange }) => (
  <Box>
    <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: "block" }}>
      Résultat de l&apos;appel
    </Typography>
    <Stack spacing={1}>
      {CALL_RESULT_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Box
            key={opt.value}
            onClick={() => onChange(opt.value)}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: `1.5px solid ${selected ? opt.color : alpha("#000", 0.1)}`,
              bgcolor: selected ? alpha(opt.color, 0.06) : "transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              "&:hover": {
                borderColor: opt.color,
                bgcolor: alpha(opt.color, 0.04),
              },
            }}
          >
            <Avatar
              sx={{ width: 32, height: 32, bgcolor: alpha(opt.color, 0.12), color: opt.color }}
            >
              {opt.icon}
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={selected ? 600 : 400}>
                {opt.label}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {opt.description}
              </Typography>
            </Box>
            {selected && (
              <Chip
                icon={<TriggerIcon sx={{ fontSize: 12 }} />}
                label={opt.triggerLabel}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.65rem",
                  bgcolor: alpha(opt.color, 0.1),
                  color: opt.color,
                  border: `1px solid ${alpha(opt.color, 0.3)}`,
                }}
              />
            )}
          </Box>
        );
      })}
    </Stack>
  </Box>
);
CallResultSelector.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

// ══════════════════════════════════════════════════════════════
// ENHANCED ADD ACTIVITY FORM
// Remplace AddActivityForm dans TaskDetailsDrawer
// Intègre CallResultSelector + TriggerNotification
// ══════════════════════════════════════════════════════════════

export const EnhancedAddActivityForm = ({ taskId, prospectId, onAdded }) => {
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
    callback_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);

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
    setTriggerResult(null);
    try {
      const payload = { task: taskId, activity_type: type, notes: form.notes || "" };

      if (type === "call") {
        if (form.call_result) payload.call_result = form.call_result;
        if (form.call_duration_minutes)
          payload.call_duration_minutes = parseInt(form.call_duration_minutes);
        // Passer la date de callback dans meeting_date (réutilisation du champ)
        if (form.call_result === "callback" && form.callback_date)
          payload.meeting_date = form.callback_date;
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
      if (prospectId) payload.prospect = prospectId;

      const response = await api.post("/task-activities/", payload);
      const data = response.data;

      onAdded(data);

      // Afficher la notification de trigger si présente
      if (data.trigger && data.trigger.triggered) {
        setTriggerResult(data.trigger);
      }

      // Réinitialiser le formulaire
      setForm({
        notes: "",
        call_result: "",
        call_duration_minutes: "",
        email_subject: "",
        email_body: "",
        email_sent_to: "",
        meeting_date: "",
        meeting_location: "",
        callback_date: "",
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

      {/* Sélecteur de type */}
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
        {/* APPEL — sélection visuelle du résultat */}
        {type === "call" && (
          <>
            <CallResultSelector
              value={form.call_result}
              onChange={(v) => setForm({ ...form, call_result: v })}
            />
            <TextField
              fullWidth
              size="small"
              label="Durée (minutes)"
              type="number"
              value={form.call_duration_minutes}
              onChange={(e) => setForm({ ...form, call_duration_minutes: e.target.value })}
              inputProps={{ min: 1 }}
            />
            {/* Champ date uniquement si callback */}
            {form.call_result === "callback" && (
              <TextField
                fullWidth
                size="small"
                label="Date du rappel"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={form.callback_date}
                onChange={(e) => setForm({ ...form, callback_date: e.target.value })}
              />
            )}
          </>
        )}

        {/* EMAIL */}
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

        {/* MEETING */}
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

        {/* Notes communes */}
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
            disabled={
              loading ||
              (type === "call" && !form.call_result) ||
              (type === "email" && (!form.email_sent_to || !form.email_subject))
            }
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

      {/* Notification de trigger */}
      {triggerResult && (
        <TriggerNotification trigger={triggerResult} onDismiss={() => setTriggerResult(null)} />
      )}
    </Box>
  );
};
EnhancedAddActivityForm.propTypes = {
  taskId: PropTypes.number.isRequired,
  prospectId: PropTypes.number,
  onAdded: PropTypes.func.isRequired,
};

export default EnhancedAddActivityForm;
