/* eslint-disable prettier/prettier */
// src/components/CRMCalendar/CalendarFilters.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Paper,
  Stack,
  Chip,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
  Button,
  Collapse,
  Avatar,
  Tooltip,
  IconButton,
  Grid,
  CircularProgress,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Badge,
  alpha,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PersonIcon from "@mui/icons-material/Person";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import FlagIcon from "@mui/icons-material/Flag";
import EventIcon from "@mui/icons-material/Event";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DateRangeIcon from "@mui/icons-material/DateRange";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ScheduleIcon from "@mui/icons-material/Schedule";

// Couleurs CRM
const CRM_RED = {
  main: "#C62828",
  light: "#EF9A9A",
  dark: "#8B0000",
  surface: "#FFEBEE",
  border: "#FFCDD2",
  hover: "#FFE4E6",
  gradient: "linear-gradient(135deg, #FFEBEE 0%, #FFE4E6 100%)",
};

// Types d'événements
const EVENT_TYPES = [
  { value: "task", label: "Tâche", icon: "✅", color: "#7b1fa2", description: "Tâches à réaliser" },
  {
    value: "meeting",
    label: "Réunion",
    icon: "📅",
    color: "#0288d1",
    description: "Réunions et rendez-vous",
  },
  {
    value: "deadline",
    label: "Échéance",
    icon: "⏰",
    color: "#C62828",
    description: "Échéances importantes",
  },
  {
    value: "reminder",
    label: "Rappel",
    icon: "🔔",
    color: "#f57c00",
    description: "Rappels divers",
  },
  {
    value: "stage",
    label: "Étape Pipeline",
    icon: "🏁",
    color: "#388e3c",
    description: "Étapes du pipeline",
  },
  {
    value: "activity",
    label: "Activité",
    icon: "📝",
    color: "#00695c",
    description: "Activités CRM",
  },
  {
    value: "pipeline_alert",
    label: "Alerte",
    icon: "⚠️",
    color: "#bf360c",
    description: "Alertes pipeline",
  },
];

// Priorités
const PRIORITIES = [
  { value: "low", label: "Basse", color: "#4caf50", bg: "#e8f5e9", icon: "🔽" },
  { value: "medium", label: "Moyenne", color: "#1976d2", bg: "#e3f2fd", icon: "🔼" },
  { value: "high", label: "Haute", color: "#ff9800", bg: "#fff3e0", icon: "⬆️" },
  { value: "critical", label: "Critique", color: "#C62828", bg: "#ffebee", icon: "⚠️" },
];

// Presets de dates
const DATE_PRESETS = [
  { value: "today", label: "Aujourd'hui", icon: "📅", days: 0 },
  { value: "tomorrow", label: "Demain", icon: "➡️", days: 1 },
  { value: "this_week", label: "Cette semaine", icon: "📆", days: 7 },
  { value: "next_week", label: "Semaine prochaine", icon: "➡️📆", days: 14 },
  { value: "this_month", label: "Ce mois", icon: "📅", days: 30 },
  { value: "next_month", label: "Mois prochain", icon: "➡️📅", days: 60 },
  { value: "overdue", label: "En retard", icon: "⚠️", days: -1 },
];

// Fonction pour obtenir la plage de dates
function getDateRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAY = 86400000;

  switch (preset) {
    case "today":
      return { start: today.toISOString(), end: new Date(today.getTime() + DAY).toISOString() };
    case "tomorrow":
      const tomorrow = new Date(today.getTime() + DAY);
      return {
        start: tomorrow.toISOString(),
        end: new Date(tomorrow.getTime() + DAY).toISOString(),
      };
    case "this_week": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: mon.toISOString(), end: sun.toISOString() };
    }
    case "next_week": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) + 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: mon.toISOString(), end: sun.toISOString() };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: first.toISOString(), end: last.toISOString() };
    }
    case "next_month": {
      const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { start: first.toISOString(), end: last.toISOString() };
    }
    case "overdue":
      return { end: today.toISOString() };
    default:
      return {};
  }
}

// Compteur de filtres actifs
function countActiveFilters(obj) {
  return Object.values(obj).filter(
    (v) => v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  ).length;
}

// Composant de section pliable
function FilterSection({ icon, label, children, defaultOpen, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen((o) => !o)}
        sx={{
          cursor: "pointer",
          py: 1,
          userSelect: "none",
          "&:hover": { opacity: 0.75 },
          transition: "all 0.2s ease",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box sx={{ color: CRM_RED.main, display: "flex" }}>{icon}</Box>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{
              textTransform: "uppercase",
              letterSpacing: 1,
              color: CRM_RED.main,
              fontSize: "0.7rem",
            }}
          >
            {label}
          </Typography>
          {badge && badge > 0 && (
            <Chip
              label={badge}
              size="small"
              sx={{
                height: 18,
                bgcolor: CRM_RED.main,
                color: "#fff",
                fontSize: "0.65rem",
                fontWeight: 700,
              }}
            />
          )}
        </Stack>
        <Box sx={{ color: CRM_RED.light, display: "flex" }}>
          {open ? (
            <KeyboardArrowUpIcon fontSize="small" />
          ) : (
            <KeyboardArrowDownIcon fontSize="small" />
          )}
        </Box>
      </Stack>
      <Collapse in={open}>
        <Box pb={2}>{children}</Box>
      </Collapse>
    </Box>
  );
}

FilterSection.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  defaultOpen: PropTypes.bool,
  badge: PropTypes.number,
};

FilterSection.defaultProps = { defaultOpen: true, badge: 0 };

// Composant de groupe de chips
function ChipToggleGroup({
  options,
  selected,
  onChange,
  getColor,
  size = "small",
  showIcons = true,
}) {
  const toggle = (value) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  return (
    <Stack direction="row" flexWrap="wrap" gap={0.8} mt={0.5}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        const color = getColor ? getColor(opt) : CRM_RED.main;
        return (
          <Chip
            key={opt.value}
            size={size}
            label={
              <Stack direction="row" alignItems="center" spacing={0.6}>
                {showIcons && opt.icon && (
                  <span style={{ fontSize: size === "small" ? 13 : 14 }}>{opt.icon}</span>
                )}
                <span style={{ fontWeight: active ? 600 : 400 }}>{opt.label}</span>
              </Stack>
            }
            onClick={() => toggle(opt.value)}
            onDelete={active ? () => toggle(opt.value) : undefined}
            deleteIcon={<ClearIcon style={{ fontSize: size === "small" ? 14 : 16 }} />}
            sx={{
              fontWeight: active ? 600 : 400,
              bgcolor: active ? color : "transparent",
              color: active ? "#fff" : "text.secondary",
              border: `1.5px solid ${active ? color : "#e0e0e0"}`,
              transition: "all 0.18s ease",
              "&:hover": {
                bgcolor: active ? color : CRM_RED.surface,
                borderColor: color,
                color: active ? "#fff" : CRM_RED.dark,
                transform: "translateY(-1px)",
              },
              "& .MuiChip-deleteIcon": {
                color: active ? "rgba(255,255,255,0.7)" : "#999",
                "&:hover": { color: active ? "#fff" : CRM_RED.main },
              },
            }}
          />
        );
      })}
    </Stack>
  );
}

ChipToggleGroup.propTypes = {
  options: PropTypes.array.isRequired,
  selected: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  getColor: PropTypes.func,
  size: PropTypes.string,
  showIcons: PropTypes.bool,
};

ChipToggleGroup.defaultProps = { getColor: null, size: "small", showIcons: true };

// Composant principal
export default function CalendarFilters({
  filters,
  onChange,
  fetchPipelines,
  fetchStages,
  fetchUsers,
}) {
  const [open, setOpen] = useState(true);
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingPipe, setLoadingPipe] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // État local des filtres
  const [local, setLocal] = useState({
    event_type: [],
    priority: [],
    pipeline: "",
    pipeline_stage: "",
    assigned_to: null,
    date_preset: "",
    start: "",
    end: "",
    only_synced: false,
    show_completed: true,
    ...filters,
  });

  // Charger pipelines
  useEffect(() => {
    if (!fetchPipelines) return;
    setLoadingPipe(true);
    fetchPipelines()
      .then(setPipelines)
      .catch(console.error)
      .finally(() => setLoadingPipe(false));
  }, [fetchPipelines]);

  // Charger stages quand pipeline change
  useEffect(() => {
    if (!local.pipeline || !fetchStages) {
      setStages([]);
      return;
    }
    setLoadingStages(true);
    fetchStages(local.pipeline)
      .then(setStages)
      .catch(console.error)
      .finally(() => setLoadingStages(false));
  }, [local.pipeline, fetchStages]);

  // Charger utilisateurs
  useEffect(() => {
    if (!fetchUsers) return;
    setLoadingUsers(true);
    fetchUsers()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, [fetchUsers]);

  const set = (key, value) => setLocal((prev) => ({ ...prev, [key]: value }));

  // Appliquer un preset de date
  const applyPreset = (preset) => {
    if (!preset || preset === selectedPreset) {
      setSelectedPreset("");
      setLocal((prev) => ({ ...prev, date_preset: "", start: "", end: "" }));
      return;
    }
    const range = getDateRange(preset);
    setSelectedPreset(preset);
    setLocal((prev) => ({ ...prev, date_preset: preset, ...range }));
  };

  // Réinitialiser tous les filtres
  const handleReset = () => {
    const empty = {
      event_type: [],
      priority: [],
      pipeline: "",
      pipeline_stage: "",
      assigned_to: null,
      date_preset: "",
      start: "",
      end: "",
      only_synced: false,
      show_completed: true,
    };
    setLocal(empty);
    setSelectedPreset("");
    onChange({});
  };

  // Appliquer les filtres
  const handleApply = useCallback(() => {
    const params = {};
    if (local.event_type?.length) params.event_type = local.event_type.join(",");
    if (local.priority?.length) params.priority = local.priority.join(",");
    if (local.pipeline_stage) params.pipeline_stage = local.pipeline_stage;
    if (local.assigned_to?.id) params.assigned_to = local.assigned_to.id;
    if (local.start) params.start = local.start;
    if (local.end) params.end = local.end;
    if (local.only_synced) params.synced_only = "true";
    if (!local.show_completed) params.show_completed = "false";
    onChange(params);
  }, [local, onChange]);

  // Compter les filtres actifs
  const activeCount = countActiveFilters({
    ...(local.event_type?.length ? { a: 1 } : {}),
    ...(local.priority?.length ? { b: 1 } : {}),
    ...(local.pipeline_stage ? { c: 1 } : {}),
    ...(local.assigned_to ? { d: 1 } : {}),
    ...(local.date_preset ? { e: 1 } : {}),
    ...(local.start ? { f: 1 } : {}),
    ...(local.end ? { g: 1 } : {}),
    ...(local.only_synced ? { h: 1 } : {}),
    ...(!local.show_completed ? { i: 1 } : {}),
  });

  // Styles
  const inputSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
      transition: "all 0.2s ease",
      "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: CRM_RED.light },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: CRM_RED.main },
    },
    "& label.Mui-focused": { color: CRM_RED.main },
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        border: `1.5px solid ${CRM_RED.border}`,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "#fff",
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: `0 4px 12px ${alpha(CRM_RED.main, 0.1)}`,
        },
      }}
    >
      {/* Header avec gradient */}
      <Box
        sx={{
          background: CRM_RED.gradient,
          borderBottom: open ? `1px solid ${CRM_RED.border}` : "none",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => setOpen((o) => !o)}
          sx={{
            px: 2.5,
            py: 1.5,
            cursor: "pointer",
            "&:hover": { bgcolor: alpha(CRM_RED.hover, 0.5) },
            transition: "background 0.2s ease",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <FilterListIcon sx={{ color: CRM_RED.main, fontSize: 20 }} />
            <Typography fontWeight={700} fontSize={14} sx={{ color: CRM_RED.dark }}>
              Filtres du calendrier
            </Typography>
            {activeCount > 0 && (
              <Chip
                label={`${activeCount} actif${activeCount > 1 ? "s" : ""}`}
                size="small"
                sx={{
                  bgcolor: CRM_RED.main,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  height: 20,
                  "&:hover": { bgcolor: CRM_RED.dark },
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {activeCount > 0 && (
              <Tooltip title="Réinitialiser tous les filtres">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                  sx={{ color: CRM_RED.main, "&:hover": { bgcolor: alpha(CRM_RED.main, 0.1) } }}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ color: CRM_RED.main, display: "flex", alignItems: "center" }}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </Box>
          </Stack>
        </Stack>
      </Box>

      <Collapse in={open}>
        <Box px={2.5} pt={2} pb={1}>
          <Grid container spacing={3}>
            {/* Colonne gauche */}
            <Grid item xs={12} md={6}>
              <FilterSection
                icon={<EventIcon fontSize="small" />}
                label="Type d'événement"
                badge={local.event_type.length}
              >
                <ChipToggleGroup
                  options={EVENT_TYPES}
                  selected={local.event_type}
                  onChange={(v) => set("event_type", v)}
                  getColor={(opt) => opt.color}
                />
              </FilterSection>

              <Divider sx={{ my: 1.5, borderColor: CRM_RED.border }} />

              <FilterSection
                icon={<FlagIcon fontSize="small" />}
                label="Priorité"
                badge={local.priority.length}
              >
                <ChipToggleGroup
                  options={PRIORITIES}
                  selected={local.priority}
                  onChange={(v) => set("priority", v)}
                  getColor={(opt) => opt.color}
                />
              </FilterSection>
            </Grid>

            {/* Colonne droite */}
            <Grid item xs={12} md={6}>
              <FilterSection
                icon={<AccountTreeIcon fontSize="small" />}
                label="Pipeline & Étape"
                badge={local.pipeline_stage ? 1 : 0}
              >
                <Stack spacing={1.5} mt={0.5}>
                  <FormControl fullWidth size="small" sx={inputSx}>
                    <InputLabel>Pipeline</InputLabel>
                    <Select
                      value={local.pipeline}
                      label="Pipeline"
                      onChange={(e) => {
                        set("pipeline", e.target.value);
                        set("pipeline_stage", "");
                      }}
                      endAdornment={
                        loadingPipe ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null
                      }
                    >
                      <MenuItem value="">
                        <em>Tous les pipelines</em>
                      </MenuItem>
                      {pipelines.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: p.color_hex || CRM_RED.main,
                              }}
                            />
                            <span>{p.name}</span>
                            {p.pipeline_type && (
                              <Typography variant="caption" color="text.secondary">
                                ({p.pipeline_type})
                              </Typography>
                            )}
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl
                    fullWidth
                    size="small"
                    sx={inputSx}
                    disabled={!local.pipeline || loadingStages}
                  >
                    <InputLabel>Étape</InputLabel>
                    <Select
                      value={local.pipeline_stage}
                      label="Étape"
                      onChange={(e) => set("pipeline_stage", e.target.value)}
                      endAdornment={
                        loadingStages ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null
                      }
                    >
                      <MenuItem value="">
                        <em>Toutes les étapes</em>
                      </MenuItem>
                      {stages.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: 1,
                                bgcolor: s.color_hex || CRM_RED.light,
                              }}
                            />
                            <span>{s.name}</span>
                            {s.order !== undefined && (
                              <Typography variant="caption" color="text.secondary">
                                (étape {s.order})
                              </Typography>
                            )}
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </FilterSection>

              <Divider sx={{ my: 1.5, borderColor: CRM_RED.border }} />

              <FilterSection
                icon={<PersonIcon fontSize="small" />}
                label="Assigné à"
                badge={local.assigned_to ? 1 : 0}
              >
                <Autocomplete
                  size="small"
                  options={users}
                  value={local.assigned_to}
                  onChange={(_, v) => set("assigned_to", v)}
                  loading={loadingUsers}
                  getOptionLabel={(u) => `${u.first_name} ${u.last_name}`.trim() || u.username}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderOption={(props, u) => (
                    <Box component="li" {...props}>
                      <Stack direction="row" alignItems="center" spacing={1.2}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: CRM_RED.main }}>
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
              </FilterSection>
            </Grid>

            {/* Période rapide */}
            <Grid item xs={12}>
              <Divider sx={{ mb: 2, borderColor: CRM_RED.border }} />
              <FilterSection
                icon={<DateRangeIcon fontSize="small" />}
                label="Période rapide"
                badge={selectedPreset ? 1 : 0}
              >
                <Stack direction="row" flexWrap="wrap" gap={0.8} mt={0.5}>
                  {DATE_PRESETS.map((p) => {
                    const active = selectedPreset === p.value;
                    return (
                      <Chip
                        key={p.value}
                        label={
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <span style={{ fontSize: 13 }}>{p.icon}</span>
                            <span>{p.label}</span>
                          </Stack>
                        }
                        size="small"
                        onClick={() => applyPreset(active ? "" : p.value)}
                        onDelete={active ? () => applyPreset("") : undefined}
                        deleteIcon={<CloseIcon style={{ fontSize: 13 }} />}
                        sx={{
                          fontWeight: active ? 600 : 400,
                          bgcolor: active ? CRM_RED.main : "transparent",
                          color: active ? "#fff" : "text.secondary",
                          border: `1.5px solid ${active ? CRM_RED.main : "#e0e0e0"}`,
                          "& .MuiChip-deleteIcon": { color: "rgba(255,255,255,0.8)" },
                          "&:hover": {
                            bgcolor: active ? CRM_RED.dark : CRM_RED.surface,
                            borderColor: CRM_RED.main,
                            transform: "translateY(-1px)",
                          },
                        }}
                      />
                    );
                  })}
                </Stack>
              </FilterSection>
            </Grid>

            {/* Options avancées */}
            <Grid item xs={12}>
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  sx={{
                    color: CRM_RED.main,
                    textTransform: "none",
                    "&:hover": { bgcolor: CRM_RED.surface },
                  }}
                >
                  {showAdvanced ? "▼ Moins d'options" : "▶ Plus d'options"}
                </Button>

                <Collapse in={showAdvanced}>
                  <Box sx={{ mt: 2, pt: 1, pl: 1 }}>
                    <Stack spacing={2}>
                      {/* Dates personnalisées */}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          type="datetime-local"
                          size="small"
                          label="Date de début"
                          value={local.start}
                          onChange={(e) => {
                            set("start", e.target.value);
                            set("date_preset", "");
                            setSelectedPreset("");
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1, ...inputSx }}
                        />
                        <TextField
                          type="datetime-local"
                          size="small"
                          label="Date de fin"
                          value={local.end}
                          onChange={(e) => {
                            set("end", e.target.value);
                            set("date_preset", "");
                            setSelectedPreset("");
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1, ...inputSx }}
                        />
                      </Stack>

                      {/* Options supplémentaires */}
                      <FormGroup>
                        <Stack direction="row" spacing={3}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={local.only_synced}
                                onChange={(e) => set("only_synced", e.target.checked)}
                                sx={{
                                  color: CRM_RED.main,
                                  "&.Mui-checked": { color: CRM_RED.main },
                                }}
                              />
                            }
                            label={
                              <Typography variant="body2">
                                Uniquement les événements synchronisés
                              </Typography>
                            }
                          />
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={local.show_completed}
                                onChange={(e) => set("show_completed", e.target.checked)}
                                sx={{
                                  color: CRM_RED.main,
                                  "&.Mui-checked": { color: CRM_RED.main },
                                }}
                              />
                            }
                            label={
                              <Typography variant="body2">Afficher les tâches terminées</Typography>
                            }
                          />
                        </Stack>
                      </FormGroup>
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ mt: 2, mb: 1.5, borderColor: CRM_RED.border }} />

          {/* Boutons d'action */}
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} pt={1} pb={0.5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
              sx={{
                borderColor: CRM_RED.border,
                color: CRM_RED.main,
                borderRadius: 2,
                textTransform: "none",
                "&:hover": {
                  borderColor: CRM_RED.main,
                  bgcolor: CRM_RED.surface,
                  transform: "translateY(-1px)",
                },
                transition: "all 0.2s ease",
              }}
            >
              Réinitialiser
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckCircleIcon />}
              onClick={handleApply}
              sx={{
                bgcolor: CRM_RED.main,
                borderRadius: 2,
                fontWeight: 600,
                textTransform: "none",
                boxShadow: `0 2px 8px ${alpha(CRM_RED.main, 0.3)}`,
                "&:hover": {
                  bgcolor: CRM_RED.dark,
                  transform: "translateY(-1px)",
                  boxShadow: `0 4px 12px ${alpha(CRM_RED.main, 0.4)}`,
                },
                transition: "all 0.2s ease",
              }}
            >
              Appliquer les filtres
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

CalendarFilters.propTypes = {
  filters: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  fetchPipelines: PropTypes.func,
  fetchStages: PropTypes.func,
  fetchUsers: PropTypes.func,
};

CalendarFilters.defaultProps = {
  filters: {},
  fetchPipelines: null,
  fetchStages: null,
  fetchUsers: null,
};
