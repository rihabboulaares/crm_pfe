/* eslint-disable prettier/prettier */
// src/pages/modules/PipelineAdmin.jsx
// ✅ Version améliorée :
//   - Squelettes B2B / B2C / SaaS / Personnalisé avec étapes + tâches préconfigurées
//   - Wizard de création en 2 étapes (modèle → configuration)
//   - Tâches automatiques avec type d'activité (appel, email, réunion, document...)
//   - UI redesignée : timeline visuelle, badges, stats, idées de tâches
//   - Séparation étapes actives / terminales

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PropTypes from "prop-types";
import {
  Grid,
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Collapse,
  Tooltip,
  CircularProgress,
  Paper,
  alpha,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  AccountTree as PipelineIcon,
  PlayArrow as AssignIcon,
  KeyboardArrowRight as ArrowIcon,
  Task as TaskIcon,
  AddTask as AddTaskIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  VideoCameraFront as MeetingIcon,
  Description as DocIcon,
  CheckBox as CheckBoxIcon,
  FormatListBulleted as ListIcon,
  Bolt as BoltIcon,
} from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// ─── CONFIG ──────────────────────────────────────────────────────
const API_BASE = "/api/sales";
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ─── DESIGN TOKENS ───────────────────────────────────────────────
const T = {
  primary: "#C62828",
  primaryDark: "#8B0000",
  gradient: "linear-gradient(135deg, #C62828 0%, #8B0000 100%)",
  success: "#2E7D32",
  warning: "#E65100",
  info: "#0277BD",
  purple: "#6A1B9A",
  teal: "#00695C",
  bg: "#F8F9FC",
  bgCard: "#FFFFFF",
  border: "#E8ECF0",
  text: "#1A2332",
  textMuted: "#6B7A8D",
  textLight: "#9AA3B0",
};

// ─── SKELETONS ────────────────────────────────────────────────────
const SKELETONS = [
  {
    key: "b2b",
    label: "B2B Enterprise",
    icon: "🏢",
    color: T.info,
    description: "Vente complexe multi-interlocuteurs (cycle long)",
    stages: [
      {
        name: "Prospection",
        color: "blue",
        order: 1,
        max_duration_days: 14,
        warning_threshold_pct: 70,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Rechercher l'entreprise et les décideurs",
            priority: "high",
            due_days: 1,
            activity_type: "research",
          },
          {
            title: "Envoyer email de prise de contact",
            priority: "high",
            due_days: 2,
            activity_type: "email",
          },
          { title: "Ajouter sur LinkedIn", priority: "low", due_days: 3, activity_type: "other" },
        ],
      },
      {
        name: "Qualification",
        color: "purple",
        order: 2,
        max_duration_days: 7,
        warning_threshold_pct: 75,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Appel de qualification BANT (Budget, Autorité, Besoin, Timing)",
            priority: "high",
            due_days: 1,
            activity_type: "call",
          },
          {
            title: "Identifier le décideur final",
            priority: "high",
            due_days: 2,
            activity_type: "note",
          },
          {
            title: "Envoyer questionnaire de besoins",
            priority: "medium",
            due_days: 3,
            activity_type: "email",
          },
        ],
      },
      {
        name: "Analyse des besoins",
        color: "yellow",
        order: 3,
        max_duration_days: 10,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Réunion de découverte (visio ou présentiel)",
            priority: "high",
            due_days: 2,
            activity_type: "meeting",
          },
          {
            title: "Rédiger le cahier des charges",
            priority: "high",
            due_days: 5,
            activity_type: "document",
          },
          {
            title: "Identifier les points de douleur",
            priority: "medium",
            due_days: 3,
            activity_type: "note",
          },
        ],
      },
      {
        name: "Proposition",
        color: "orange",
        order: 4,
        max_duration_days: 7,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Préparer la proposition commerciale personnalisée",
            priority: "high",
            due_days: 3,
            activity_type: "document",
          },
          {
            title: "Présentation de l'offre au client",
            priority: "high",
            due_days: 4,
            activity_type: "meeting",
          },
          {
            title: "Envoyer la proposition par email",
            priority: "medium",
            due_days: 5,
            activity_type: "email",
          },
        ],
      },
      {
        name: "Négociation",
        color: "red",
        order: 5,
        max_duration_days: 14,
        warning_threshold_pct: 70,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Appel de négociation tarifaire",
            priority: "high",
            due_days: 1,
            activity_type: "call",
          },
          {
            title: "Préparer contre-proposition si nécessaire",
            priority: "high",
            due_days: 3,
            activity_type: "document",
          },
          {
            title: "Validation juridique du contrat",
            priority: "medium",
            due_days: 7,
            activity_type: "document",
          },
        ],
      },
      {
        name: "Closing",
        color: "green",
        order: 6,
        max_duration_days: 5,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Signature du contrat",
            priority: "high",
            due_days: 2,
            activity_type: "document",
          },
          {
            title: "Réunion d'onboarding client",
            priority: "high",
            due_days: 3,
            activity_type: "meeting",
          },
          {
            title: "Confirmer réception de l'acompte",
            priority: "medium",
            due_days: 4,
            activity_type: "note",
          },
        ],
      },
      {
        name: "✓ Gagné",
        color: "green",
        order: 7,
        max_duration_days: 1,
        warning_threshold_pct: 100,
        is_terminal: true,
        is_won: true,
        tasks: [],
      },
      {
        name: "✗ Perdu",
        color: "gray",
        order: 8,
        max_duration_days: 1,
        warning_threshold_pct: 100,
        is_terminal: true,
        is_won: false,
        tasks: [],
      },
    ],
  },
  {
    key: "b2c",
    label: "B2C Retail",
    icon: "👤",
    color: T.success,
    description: "Vente directe particuliers, cycle court et rapide",
    stages: [
      {
        name: "Lead entrant",
        color: "blue",
        order: 1,
        max_duration_days: 1,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          { title: "Rappeler sous 2 heures", priority: "high", due_days: 1, activity_type: "call" },
          {
            title: "Envoyer email de bienvenue",
            priority: "medium",
            due_days: 1,
            activity_type: "email",
          },
        ],
      },
      {
        name: "Prise de contact",
        color: "purple",
        order: 2,
        max_duration_days: 3,
        warning_threshold_pct: 75,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Appel découverte des besoins",
            priority: "high",
            due_days: 1,
            activity_type: "call",
          },
          {
            title: "Qualifier le budget disponible",
            priority: "high",
            due_days: 2,
            activity_type: "note",
          },
        ],
      },
      {
        name: "Offre envoyée",
        color: "orange",
        order: 3,
        max_duration_days: 5,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Envoyer devis personnalisé",
            priority: "high",
            due_days: 1,
            activity_type: "email",
          },
          {
            title: "Relance si pas de réponse sous 48h",
            priority: "medium",
            due_days: 3,
            activity_type: "call",
          },
        ],
      },
      {
        name: "Closing",
        color: "green",
        order: 4,
        max_duration_days: 3,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Appel de closing et traitement des objections",
            priority: "high",
            due_days: 1,
            activity_type: "call",
          },
          {
            title: "Confirmation commande par email",
            priority: "high",
            due_days: 2,
            activity_type: "email",
          },
        ],
      },
      {
        name: "✓ Gagné",
        color: "green",
        order: 5,
        max_duration_days: 1,
        warning_threshold_pct: 100,
        is_terminal: true,
        is_won: true,
        tasks: [],
      },
      {
        name: "✗ Perdu",
        color: "gray",
        order: 6,
        max_duration_days: 1,
        warning_threshold_pct: 100,
        is_terminal: true,
        is_won: false,
        tasks: [],
      },
    ],
  },
  {
    key: "saas",
    label: "SaaS / Tech",
    icon: "🚀",
    color: T.purple,
    description: "Pipeline produit SaaS avec trial et conversion",
    stages: [
      {
        name: "Trial/Signup",
        color: "blue",
        order: 1,
        max_duration_days: 3,
        warning_threshold_pct: 70,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Envoyer email de bienvenue + guide de démarrage",
            priority: "high",
            due_days: 1,
            activity_type: "email",
          },
          {
            title: "Proposer une démo personnalisée",
            priority: "high",
            due_days: 2,
            activity_type: "call",
          },
        ],
      },
      {
        name: "Activation",
        color: "purple",
        order: 2,
        max_duration_days: 7,
        warning_threshold_pct: 75,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Vérifier l'utilisation et l'activation du compte",
            priority: "high",
            due_days: 2,
            activity_type: "note",
          },
          {
            title: "Session onboarding vidéo",
            priority: "high",
            due_days: 3,
            activity_type: "meeting",
          },
          {
            title: "Envoyer checklist de succès",
            priority: "medium",
            due_days: 4,
            activity_type: "email",
          },
        ],
      },
      {
        name: "Expansion",
        color: "yellow",
        order: 3,
        max_duration_days: 14,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Appel de suivi et satisfaction client",
            priority: "high",
            due_days: 3,
            activity_type: "call",
          },
          {
            title: "Présentation des plans payants",
            priority: "high",
            due_days: 5,
            activity_type: "meeting",
          },
          {
            title: "Envoyer comparaison des plans et tarifs",
            priority: "medium",
            due_days: 7,
            activity_type: "email",
          },
        ],
      },
      {
        name: "Conversion",
        color: "orange",
        order: 4,
        max_duration_days: 7,
        warning_threshold_pct: 80,
        is_terminal: false,
        is_won: false,
        tasks: [
          {
            title: "Négocier le tarif annuel",
            priority: "high",
            due_days: 2,
            activity_type: "call",
          },
          {
            title: "Envoyer lien de paiement",
            priority: "high",
            due_days: 3,
            activity_type: "email",
          },
        ],
      },
      {
        name: "✓ Converti",
        color: "green",
        order: 5,
        max_duration_days: 1,
        warning_threshold_pct: 100,
        is_terminal: true,
        is_won: true,
        tasks: [],
      },
      {
        name: "✗ Churné",
        color: "gray",
        order: 6,
        max_duration_days: 1,
        warning_threshold_pct: 100,
        is_terminal: true,
        is_won: false,
        tasks: [],
      },
    ],
  },
  {
    key: "blank",
    label: "Personnalisé",
    icon: "✏️",
    color: T.textMuted,
    description: "Créer de zéro, liberté totale sur les étapes",
    stages: [],
  },
];

// ─── ACTIVITY TYPES ──────────────────────────────────────────────
const ACTIVITY_TYPES = [
  {
    key: "call",
    label: "Appel téléphonique",
    icon: <PhoneIcon sx={{ fontSize: 13 }} />,
    color: T.success,
  },
  { key: "email", label: "Email", icon: <EmailIcon sx={{ fontSize: 13 }} />, color: T.info },
  {
    key: "meeting",
    label: "Réunion / Visio",
    icon: <MeetingIcon sx={{ fontSize: 13 }} />,
    color: T.purple,
  },
  {
    key: "document",
    label: "Document à envoyer",
    icon: <DocIcon sx={{ fontSize: 13 }} />,
    color: T.warning,
  },
  {
    key: "research",
    label: "Recherche / Analyse",
    icon: <ListIcon sx={{ fontSize: 13 }} />,
    color: "#795548",
  },
  {
    key: "note",
    label: "Note interne",
    icon: <CheckBoxIcon sx={{ fontSize: 13 }} />,
    color: T.textMuted,
  },
  {
    key: "other",
    label: "Autre action",
    icon: <BoltIcon sx={{ fontSize: 13 }} />,
    color: T.primary,
  },
];
const getActType = (key) => ACTIVITY_TYPES.find((a) => a.key === key) || ACTIVITY_TYPES[6];

const COLOR_OPTIONS = [
  { value: "blue", hex: "#3B82F6" },
  { value: "purple", hex: "#8B5CF6" },
  { value: "yellow", hex: "#F59E0B" },
  { value: "orange", hex: "#F97316" },
  { value: "green", hex: "#10B981" },
  { value: "red", hex: "#EF4444" },
  { value: "pink", hex: "#EC4899" },
  { value: "gray", hex: "#6B7280" },
  { value: "teal", hex: "#14B8A6" },
  { value: "indigo", hex: "#6366F1" },
];
const colorHex = (c) => COLOR_OPTIONS.find((x) => x.value === c)?.hex || "#3B82F6";
const PRIORITY_COLORS = { low: T.success, medium: T.warning, high: T.primary };
const PRIORITY_LABELS = { low: "Basse", medium: "Moyenne", high: "Haute" };

// ─── ANIMATIONS ──────────────────────────────────────────────────
const fadeUp = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`;
const slideIn = keyframes`from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}`;

// ─── STYLED ──────────────────────────────────────────────────────
const GradBtn = styled(Button)({
  background: T.gradient,
  color: "white",
  borderRadius: 10,
  padding: "9px 22px",
  fontWeight: 700,
  textTransform: "none",
  fontSize: 13,
  boxShadow: `0 3px 10px ${alpha(T.primary, 0.28)}`,
  "&:hover": { background: T.gradient, boxShadow: `0 5px 14px ${alpha(T.primary, 0.38)}` },
  "&:disabled": { opacity: 0.55 },
});

const PCard = styled(Card)(({ selected }) => ({
  borderRadius: 14,
  cursor: "pointer",
  transition: "all 0.22s ease",
  border: selected === "true" ? `2px solid ${T.primary}` : `2px solid transparent`,
  background: selected === "true" ? alpha(T.primary, 0.03) : T.bgCard,
  boxShadow:
    selected === "true"
      ? `0 0 0 3px ${alpha(T.primary, 0.1)}, 0 4px 14px ${alpha(T.primary, 0.1)}`
      : `0 1px 4px rgba(0,0,0,0.06)`,
  "&:hover": {
    borderColor: alpha(T.primary, 0.4),
    transform: "translateY(-1px)",
    boxShadow: `0 6px 18px ${alpha(T.primary, 0.1)}`,
  },
  animation: `${fadeUp} 0.3s ease`,
}));

const StageRow = styled(Paper)(({ isselected, isterminal }) => ({
  borderRadius: 11,
  padding: "10px 13px",
  marginBottom: 6,
  border:
    isselected === "true"
      ? `2px solid ${T.primary}`
      : isterminal === "true"
      ? `1px solid ${alpha(T.textLight, 0.3)}`
      : `1px solid ${T.border}`,
  background: isterminal === "true" ? "#FAFBFC" : T.bgCard,
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  transition: "all 0.18s",
  boxShadow: isselected === "true" ? `0 2px 8px ${alpha(T.primary, 0.12)}` : "none",
  "&:hover": { boxShadow: `0 3px 10px rgba(0,0,0,0.07)`, borderColor: alpha(T.primary, 0.3) },
  animation: `${slideIn} 0.22s ease`,
}));

const SkCard = styled(Paper)(({ isselected, cardcolor }) => ({
  borderRadius: 14,
  padding: "16px 18px",
  cursor: "pointer",
  border: isselected === "true" ? `2px solid ${cardcolor}` : `2px solid ${alpha(cardcolor, 0.2)}`,
  background: isselected === "true" ? alpha(cardcolor, 0.05) : T.bgCard,
  transition: "all 0.2s",
  "&:hover": {
    borderColor: cardcolor,
    transform: "translateY(-2px)",
    boxShadow: `0 6px 18px ${alpha(cardcolor, 0.18)}`,
  },
}));

// ─── PIPELINE WIZARD ─────────────────────────────────────────────
const PipelineWizard = ({ open, pipeline, onClose, onSaved }) => {
  const isEdit = !!pipeline?.id;
  const [step, setStep] = useState(0);
  const [selectedSkeleton, setSelectedSkeleton] = useState(null);
  const [form, setForm] = useState({ name: "", pipeline_type: "b2b", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStep(isEdit ? 1 : 0);
      setSelectedSkeleton(null);
      setError("");
      setForm(
        pipeline
          ? {
              name: pipeline.name || "",
              pipeline_type: pipeline.pipeline_type || "b2b",
              description: pipeline.description || "",
            }
          : { name: "", pipeline_type: "b2b", description: "" }
      );
    }
  }, [open, pipeline, isEdit]);

  const handleSkeletonSelect = (sk) => {
    setSelectedSkeleton(sk);
    if (sk.key !== "blank" && !form.name) {
      setForm((f) => ({
        ...f,
        name: sk.label,
        pipeline_type: ["b2b", "b2c"].includes(sk.key) ? sk.key : "custom",
      }));
    }
    setStep(1);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setSaving(true);
    try {
      let pid;
      if (isEdit) {
        await api.patch(`/pipelines/${pipeline.id}/`, form);
        pid = pipeline.id;
      } else {
        const r = await api.post("/pipelines/", form);
        pid = r.data.id;
        if (selectedSkeleton?.stages?.length > 0) {
          for (const stage of selectedSkeleton.stages) {
            const sr = await api.post("/pipeline-stages/", {
              name: stage.name,
              order: stage.order,
              max_duration_days: stage.max_duration_days,
              warning_threshold_pct: stage.warning_threshold_pct,
              color: stage.color,
              is_terminal: stage.is_terminal,
              is_won: stage.is_won,
              crm_stage: stage.crm_stage || "none",
              pipeline: pid,
            });
            if (!stage.is_terminal && stage.tasks?.length > 0) {
              for (let i = 0; i < stage.tasks.length; i++) {
                const t = stage.tasks[i];
                await api.post("/pipeline-stage-tasks/", {
                  title: t.title,
                  priority: t.priority,
                  due_days_after_entry: t.due_days,
                  order: i + 1,
                  stage: sr.data.id,
                });
              }
            }
          }
        }
      }
      onSaved(pid);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", maxHeight: "90vh" } }}
    >
      <Box
        sx={{
          background: T.gradient,
          px: 3,
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800} color="white">
            {isEdit ? "✏️ Modifier le pipeline" : "🚀 Nouveau pipeline"}
          </Typography>
          {!isEdit && (
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.7) }}>
              {step === 0
                ? "Étape 1 : Choisissez un modèle de départ"
                : "Étape 2 : Configurez votre pipeline"}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      {!isEdit && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Stepper
            activeStep={step}
            sx={{ "& .MuiStepLabel-label": { fontSize: 12, fontWeight: 600 } }}
          >
            <Step>
              <StepLabel>Choisir un modèle</StepLabel>
            </Step>
            <Step>
              <StepLabel>Configurer</StepLabel>
            </Step>
          </Stepper>
        </Box>
      )}
      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 0 && (
          <Box sx={{ animation: `${fadeUp} 0.3s ease` }}>
            <Typography variant="body2" sx={{ color: T.textMuted, mb: 2.5 }}>
              Démarrez avec un modèle préconfiguré incluant étapes et tâches automatiques, ou créez
              de zéro.
            </Typography>
            <Grid container spacing={2}>
              {SKELETONS.map((sk) => (
                <Grid item xs={12} sm={6} key={sk.key}>
                  <SkCard
                    isselected={selectedSkeleton?.key === sk.key ? "true" : "false"}
                    cardcolor={sk.color}
                    elevation={0}
                    onClick={() => handleSkeletonSelect(sk)}
                  >
                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                      <Typography sx={{ fontSize: 26 }}>{sk.icon}</Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={800} sx={{ color: T.text }}>
                          {sk.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: T.textMuted }}>
                          {sk.description}
                        </Typography>
                      </Box>
                    </Box>
                    {sk.stages.length > 0 ? (
                      <Box>
                        <Box display="flex" flexWrap="wrap" gap={0.5} mb={0.8}>
                          {sk.stages
                            .filter((s) => !s.is_terminal)
                            .map((s, i) => (
                              <Chip
                                key={i}
                                label={s.name}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  bgcolor: alpha(sk.color, 0.1),
                                  color: sk.color,
                                  "& .MuiChip-label": { px: 0.8 },
                                }}
                              />
                            ))}
                        </Box>
                        <Typography variant="caption" sx={{ color: T.textLight }}>
                          ⚡{" "}
                          {sk.stages
                            .filter((s) => !s.is_terminal)
                            .reduce((a, s) => a + (s.tasks?.length || 0), 0)}{" "}
                          tâches auto préconfigurées
                        </Typography>
                      </Box>
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{ color: T.textLight, fontStyle: "italic" }}
                      >
                        Liberté totale — étapes à définir
                      </Typography>
                    )}
                  </SkCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {step === 1 && (
          <Box sx={{ animation: `${fadeUp} 0.3s ease` }}>
            {selectedSkeleton && selectedSkeleton.key !== "blank" && (
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 3,
                  background: alpha(selectedSkeleton.color, 0.06),
                  border: `1px solid ${alpha(selectedSkeleton.color, 0.2)}`,
                }}
              >
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography sx={{ fontSize: 18 }}>{selectedSkeleton.icon}</Typography>
                  <Typography
                    variant="body2"
                    fontWeight={800}
                    sx={{ color: selectedSkeleton.color }}
                  >
                    Modèle sélectionné : {selectedSkeleton.label}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setStep(0)}
                    sx={{
                      ml: "auto",
                      borderRadius: 2,
                      fontSize: 11,
                      textTransform: "none",
                      color: selectedSkeleton.color,
                      bgcolor: alpha(selectedSkeleton.color, 0.1),
                    }}
                  >
                    Changer
                  </Button>
                </Box>
                <Box display="flex" gap={3}>
                  <Typography variant="caption" sx={{ color: T.textMuted }}>
                    ✓ {selectedSkeleton.stages.filter((s) => !s.is_terminal).length} étapes actives
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textMuted }}>
                    ⚡{" "}
                    {selectedSkeleton.stages
                      .filter((s) => !s.is_terminal)
                      .reduce((a, s) => a + (s.tasks?.length || 0), 0)}{" "}
                    tâches automatiques
                  </Typography>
                </Box>
              </Box>
            )}
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                size="small"
                label="Nom du pipeline *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={form.pipeline_type}
                  label="Type"
                  onChange={(e) => setForm((f) => ({ ...f, pipeline_type: e.target.value }))}
                  sx={{ borderRadius: 2.5 }}
                >
                  <MenuItem value="b2b">🏢 B2B — Vente entreprises</MenuItem>
                  <MenuItem value="b2c">👤 B2C — Vente particuliers</MenuItem>
                  <MenuItem value="custom">📋 Pipeline personnalisé</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="Description (optionnel)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {step === 1 && !isEdit && (
          <Button
            onClick={() => setStep(0)}
            sx={{ borderRadius: 2.5, textTransform: "none", color: T.textMuted }}
          >
            ← Retour
          </Button>
        )}
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2.5, textTransform: "none", color: T.textMuted }}
        >
          Annuler
        </Button>
        {step === 0 && <GradBtn onClick={() => setStep(1)}>Configurer →</GradBtn>}
        {step === 1 && (
          <GradBtn onClick={handleSave} disabled={saving}>
            {saving ? (
              <CircularProgress size={16} sx={{ color: "white" }} />
            ) : isEdit ? (
              "Mettre à jour"
            ) : (
              "✓ Créer le pipeline"
            )}
          </GradBtn>
        )}
      </DialogActions>
    </Dialog>
  );
};
PipelineWizard.propTypes = {
  open: PropTypes.bool.isRequired,
  pipeline: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

// ─── STAGE DIALOG ─────────────────────────────────────────────────
const StageDialog = ({ open, stage, pipelineId, nextOrder, onClose, onSaved }) => {
  const isEdit = !!stage?.id;
  const [form, setForm] = useState({
    name: "",
    order: 1,
    max_duration_days: 7,
    warning_threshold_pct: 80,
    color: "blue",
    description: "",
    is_terminal: false,
    is_won: false,
    crm_stage: "none",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (stage)
      setForm({
        name: stage.name || "",
        order: stage.order || 1,
        max_duration_days: stage.max_duration_days || 7,
        warning_threshold_pct: stage.warning_threshold_pct || 80,
        color: stage.color || "blue",
        description: stage.description || "",
        is_terminal: stage.is_terminal || false,
        is_won: stage.is_won || false,
      });
    else
      setForm({
        name: "",
        order: nextOrder || 1,
        max_duration_days: 7,
        warning_threshold_pct: 80,
        color: "blue",
        description: "",
        is_terminal: false,
        is_won: false,
      });
    setError("");
  }, [stage, open, nextOrder]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, pipeline: pipelineId };
      if (isEdit) await api.patch(`/pipeline-stages/${stage.id}/`, payload);
      else await api.post("/pipeline-stages/", payload);
      onSaved();
      onClose();
    } catch (e) {
      const d = e.response?.data;
      setError(d?.non_field_errors?.[0] || d?.order?.[0] || d?.detail || "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  const termMode = !form.is_terminal ? "active" : form.is_won ? "won" : "lost";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
    >
      <Box
        sx={{
          background: T.gradient,
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" fontWeight={800} color="white">
          {isEdit ? "✏️ Modifier l'étape" : "➕ Nouvelle étape"}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField
                fullWidth
                size="small"
                label="Nom de l'étape *"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Ordre"
                value={form.order}
                onChange={(e) => set("order", parseInt(e.target.value) || 1)}
                InputProps={{ inputProps: { min: 1 } }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Durée max (jours)"
                value={form.max_duration_days}
                onChange={(e) => set("max_duration_days", parseInt(e.target.value) || 1)}
                helperText="Délai avant alerte rouge"
                InputProps={{ inputProps: { min: 1 } }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Seuil alerte (%)"
                value={form.warning_threshold_pct}
                onChange={(e) => set("warning_threshold_pct", parseInt(e.target.value) || 80)}
                helperText="% avant alerte orange"
                InputProps={{ inputProps: { min: 1, max: 100 } }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
            </Grid>
          </Grid>
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: T.textMuted, mb: 1, display: "block" }}
            >
              Couleur
            </Typography>
            <Box display="flex" gap={0.8} flexWrap="wrap">
              {COLOR_OPTIONS.map((c) => (
                <Tooltip key={c.value} title={c.value}>
                  <Box
                    onClick={() => set("color", c.value)}
                    sx={{
                      width: 27,
                      height: 27,
                      borderRadius: "50%",
                      cursor: "pointer",
                      bgcolor: c.hex,
                      transition: "all 0.15s",
                      border:
                        form.color === c.value ? `3px solid #1A2332` : "3px solid transparent",
                      boxShadow:
                        form.color === c.value ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : "none",
                      transform: form.color === c.value ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label="Description (optionnel)"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Stage CRM correspondant</InputLabel>
            <Select
              value={form.crm_stage}
              label="Stage CRM correspondant"
              onChange={(e) => set("crm_stage", e.target.value)}
              sx={{ borderRadius: 2.5 }}
              disabled={form.is_terminal}
            >
              <MenuItem value="none">— Aucun (étape personnalisée) —</MenuItem>
              <MenuItem value="new">🔵 Nouvelle</MenuItem>
              <MenuItem value="qualified">🟢 Qualifiée</MenuItem>
              <MenuItem value="proposal">🟡 Proposition</MenuItem>
              <MenuItem value="negotiation">🟠 Négociation</MenuItem>
              <MenuItem value="won">✅ Gagnée</MenuItem>
              <MenuItem value="lost">❌ Perdue</MenuItem>
            </Select>
            <Typography variant="caption" sx={{ color: T.textMuted, mt: 0.5 }}>
              Quand le stage CRM change vers cette valeur, l&apos;opportunité se déplace
              automatiquement vers cette étape.
            </Typography>
          </FormControl>
          <Box sx={{ p: 2, borderRadius: 3, border: `1px solid ${T.border}`, bgcolor: T.bg }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5, color: T.text }}>
              Type d&apos;étape
            </Typography>
            <Stack direction="row" spacing={1.5}>
              {[
                { key: "active", label: "Étape active", color: T.info },
                { key: "won", label: "✓ Gagné", color: T.success },
                { key: "lost", label: "✗ Perdu", color: T.primary },
              ].map((opt) => (
                <Button
                  key={opt.key}
                  size="small"
                  variant={termMode === opt.key ? "contained" : "outlined"}
                  onClick={() => {
                    if (opt.key === "active") {
                      set("is_terminal", false);
                      set("is_won", false);
                    }
                    if (opt.key === "won") {
                      set("is_terminal", true);
                      set("is_won", true);
                    }
                    if (opt.key === "lost") {
                      set("is_terminal", true);
                      set("is_won", false);
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                    flex: 1,
                    ...(termMode === opt.key
                      ? {
                          bgcolor: opt.color,
                          borderColor: opt.color,
                          "&:hover": { bgcolor: opt.color },
                        }
                      : { borderColor: alpha(opt.color, 0.4), color: opt.color }),
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </Stack>
            {form.is_terminal && (
              <Typography variant="caption" sx={{ color: T.textLight, display: "block", mt: 1 }}>
                Les étapes terminales ne génèrent pas de tâches automatiques.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2.5, textTransform: "none", color: T.textMuted }}
        >
          Annuler
        </Button>
        <GradBtn onClick={handleSave} disabled={saving}>
          {saving ? (
            <CircularProgress size={16} sx={{ color: "white" }} />
          ) : isEdit ? (
            "Mettre à jour"
          ) : (
            "Ajouter"
          )}
        </GradBtn>
      </DialogActions>
    </Dialog>
  );
};
StageDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  stage: PropTypes.object,
  pipelineId: PropTypes.number,
  nextOrder: PropTypes.number,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

// ─── TASK TEMPLATE DIALOG ─────────────────────────────────────────
const TaskTemplateDialog = ({ open, template, stageId, nextOrder, onClose, onSaved }) => {
  const isEdit = !!template?.id;
  const [form, setForm] = useState({
    title: "",
    description: "",
    order: 1,
    priority: "medium",
    due_days_after_entry: 2,
    activity_type: "call",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (template)
      setForm({
        title: template.title || "",
        description: template.description || "",
        order: template.order || 1,
        priority: template.priority || "medium",
        due_days_after_entry: template.due_days_after_entry || 2,
        activity_type: template.activity_type || "call",
      });
    else
      setForm({
        title: "",
        description: "",
        order: nextOrder || 1,
        priority: "medium",
        due_days_after_entry: 2,
        activity_type: "call",
      });
    setError("");
  }, [template, open, nextOrder]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Le titre est requis.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, stage: stageId };
      if (isEdit) await api.patch(`/pipeline-stage-tasks/${template.id}/`, payload);
      else await api.post("/pipeline-stage-tasks/", payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  const actType = getActType(form.activity_type);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
    >
      <Box
        sx={{
          bgcolor: T.info,
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" fontWeight={800} color="white">
          {isEdit ? "✏️ Modifier la tâche" : "⚡ Nouvelle tâche automatique"}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              bgcolor: alpha(T.info, 0.06),
              border: `1px solid ${alpha(T.info, 0.15)}`,
            }}
          >
            <Typography variant="caption" sx={{ color: T.info, fontWeight: 700 }}>
              ⚡ Sera automatiquement créée et assignée au commercial dès qu&apos;une opportunité
              entre dans cette étape.
            </Typography>
          </Box>

          {/* Activity type */}
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: T.textMuted, display: "block", mb: 1 }}
            >
              Type d&apos;activité
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.7}>
              {ACTIVITY_TYPES.map((at) => (
                <Box
                  key={at.key}
                  onClick={() => setForm((f) => ({ ...f, activity_type: at.key }))}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.6,
                    px: 1.4,
                    py: 0.7,
                    borderRadius: 2,
                    cursor: "pointer",
                    border:
                      form.activity_type === at.key
                        ? `2px solid ${at.color}`
                        : `1px solid ${T.border}`,
                    bgcolor: form.activity_type === at.key ? alpha(at.color, 0.08) : T.bgCard,
                    transition: "all 0.15s",
                    "&:hover": { borderColor: at.color },
                  }}
                >
                  <Box sx={{ color: at.color }}>{at.icon}</Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: form.activity_type === at.key ? at.color : T.textMuted,
                    }}
                  >
                    {at.label.split(" ")[0]}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth
            size="small"
            label="Titre de la tâche *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="ex: Appeler le prospect pour qualifier le budget"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label="Instructions pour le commercial"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Décrivez ce que le commercial doit faire exactement..."
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
          />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priorité</InputLabel>
                <Select
                  value={form.priority}
                  label="Priorité"
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  sx={{ borderRadius: 2.5 }}
                >
                  <MenuItem value="low">🟢 Basse</MenuItem>
                  <MenuItem value="medium">🟡 Moyenne</MenuItem>
                  <MenuItem value="high">🔴 Haute</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Délai (jours)"
                value={form.due_days_after_entry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, due_days_after_entry: parseInt(e.target.value) || 1 }))
                }
                helperText="Après entrée dans l'étape"
                InputProps={{ inputProps: { min: 1 } }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
              />
            </Grid>
          </Grid>

          {/* Preview */}
          {form.title && (
            <Box sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${T.border}`, bgcolor: T.bg }}>
              <Typography
                variant="caption"
                sx={{ color: T.textMuted, fontWeight: 700, display: "block", mb: 1 }}
              >
                Aperçu
              </Typography>
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                p={1.2}
                sx={{
                  borderRadius: 2,
                  bgcolor: alpha(actType.color, 0.07),
                  border: `1px solid ${alpha(actType.color, 0.18)}`,
                }}
              >
                <Box sx={{ color: actType.color }}>{actType.icon}</Box>
                <Typography variant="caption" fontWeight={700} sx={{ flex: 1, color: T.text }}>
                  {form.title}
                </Typography>
                <Chip
                  label={PRIORITY_LABELS[form.priority]}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: 9,
                    bgcolor: alpha(PRIORITY_COLORS[form.priority], 0.1),
                    color: PRIORITY_COLORS[form.priority],
                    "& .MuiChip-label": { px: 0.7 },
                  }}
                />
                <Typography variant="caption" sx={{ color: T.textLight, whiteSpace: "nowrap" }}>
                  J+{form.due_days_after_entry}
                </Typography>
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2.5, textTransform: "none", color: T.textMuted }}
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          sx={{
            borderRadius: 2.5,
            bgcolor: T.info,
            "&:hover": { bgcolor: "#01579B" },
            px: 3,
            textTransform: "none",
            fontWeight: 700,
          }}
        >
          {saving ? (
            <CircularProgress size={16} sx={{ color: "white" }} />
          ) : isEdit ? (
            "Mettre à jour"
          ) : (
            "⚡ Ajouter"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
TaskTemplateDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  template: PropTypes.object,
  stageId: PropTypes.number,
  nextOrder: PropTypes.number,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

// ─── ASSIGN OP DIALOG ─────────────────────────────────────────────
const AssignOpDialog = ({ open, pipeline, stages, onClose, onAssigned }) => {
  const [opps, setOpps] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !pipeline) return;
    setLoading(true);
    setSelected([]);
    setError("");
    Promise.all([
      api.get("/opportunities/", { params: { page_size: 100 } }),
      api.get("/opportunity-pipelines/", { params: { pipeline_id: pipeline.id, page_size: 100 } }),
    ])
      .then(([oRes, opRes]) => {
        const all = oRes.data.results || oRes.data;
        const inPipe = new Set((opRes.data.results || opRes.data).map((x) => x.opportunity));
        setOpps(all.filter((o) => !inPipe.has(o.id) && o.stage !== "won" && o.stage !== "lost"));
      })
      .catch(() => setError("Impossible de charger."))
      .finally(() => setLoading(false));
  }, [open, pipeline]);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleAssign = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      const firstStageId = stages?.[0]?.id;
      await Promise.all(
        selected.map((id) =>
          api.post("/opportunity-pipelines/", {
            opportunity: id,
            pipeline: pipeline.id,
            ...(firstStageId ? { current_stage: firstStageId } : {}),
          })
        )
      );
      onAssigned();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
    >
      <Box
        sx={{
          background: `linear-gradient(135deg, ${T.success} 0%, #1B5E20 100%)`,
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800} color="white">
            Ajouter des opportunités
          </Typography>
          {pipeline && (
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.7) }}>
              {pipeline.name}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress sx={{ color: T.primary }} />
          </Box>
        ) : opps.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Toutes les opportunités actives sont déjà dans ce pipeline.
          </Alert>
        ) : (
          <>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="body2" sx={{ color: T.textMuted }}>
                {opps.length} disponible(s)
              </Typography>
              <Chip
                label={`${selected.length} sélectionnée(s)`}
                size="small"
                sx={{ bgcolor: alpha(T.primary, 0.08), color: T.primary, fontWeight: 700 }}
              />
            </Box>
            <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
              {opps.map((opp) => {
                const isSel = selected.includes(opp.id);
                return (
                  <Paper
                    key={opp.id}
                    elevation={0}
                    onClick={() => toggle(opp.id)}
                    sx={{
                      p: 1.8,
                      mb: 1,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: isSel ? `2px solid ${T.primary}` : `2px solid ${T.border}`,
                      bgcolor: isSel ? alpha(T.primary, 0.02) : T.bgCard,
                      transition: "all 0.15s",
                      "&:hover": { borderColor: alpha(T.primary, 0.4) },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            flexShrink: 0,
                            border: `2px solid ${isSel ? T.primary : T.border}`,
                            bgcolor: isSel ? T.primary : "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSel && (
                            <Box
                              sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "white" }}
                            />
                          )}
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {opp.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.textMuted }}>
                            {opp.assigned_to_detail?.username || "—"}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" fontWeight={800} sx={{ color: T.primary }}>
                        {parseFloat(opp.amount || 0).toLocaleString("fr-FR")} TND
                      </Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2.5, textTransform: "none", color: T.textMuted }}
        >
          Annuler
        </Button>
        <Button
          onClick={handleAssign}
          disabled={!selected.length || saving}
          variant="contained"
          sx={{
            borderRadius: 2.5,
            bgcolor: T.success,
            "&:hover": { bgcolor: "#1B5E20" },
            px: 3,
            textTransform: "none",
            fontWeight: 700,
          }}
        >
          {saving ? (
            <CircularProgress size={16} sx={{ color: "white" }} />
          ) : (
            `Ajouter${selected.length > 0 ? ` (${selected.length})` : ""}`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
AssignOpDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  pipeline: PropTypes.object,
  stages: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onAssigned: PropTypes.func.isRequired,
};

// ─── STAGE TASKS PANEL ────────────────────────────────────────────
const StageTasksPanel = ({ stage, onChanged }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editTmpl, setEditTmpl] = useState(null);

  const load = useCallback(() => {
    if (!stage) return;
    setLoading(true);
    api
      .get("/pipeline-stage-tasks/", { params: { stage_id: stage.id } })
      .then((r) => setTemplates((r.data.results || r.data).sort((a, b) => a.order - b.order)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce template ?")) return;
    await api.delete(`/pipeline-stage-tasks/${id}/`);
    load();
    if (onChanged) onChanged();
  };

  if (!stage)
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={280}
        sx={{ color: T.textLight }}
      >
        <BoltIcon sx={{ fontSize: 50, mb: 2, color: alpha(T.info, 0.2) }} />
        <Typography variant="body2" fontWeight={600} sx={{ color: T.textMuted }}>
          Sélectionnez une étape
        </Typography>
        <Typography variant="caption" sx={{ color: T.textLight, mt: 0.5, textAlign: "center" }}>
          Gérez les tâches automatiques par étape
        </Typography>
      </Box>
    );

  if (stage.is_terminal)
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: 36, mb: 1.5 }}>{stage.is_won ? "🎉" : "📋"}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ color: T.textMuted }}>
          Étape terminale
        </Typography>
        <Typography variant="caption" sx={{ color: T.textLight }}>
          Les étapes {stage.is_won ? "Gagné" : "Perdu"} ne génèrent pas de tâches automatiques
        </Typography>
      </Box>
    );

  const maxDelay = templates.reduce((a, t) => Math.max(a, t.due_days_after_entry || 0), 0);
  const typeCounts = templates.reduce((acc, t) => {
    const key = t.activity_type || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box sx={{ animation: `${fadeUp} 0.3s ease` }}>
      {/* Stage header */}
      <Box
        display="flex"
        alignItems="center"
        gap={1.5}
        mb={2.5}
        p={2}
        sx={{
          borderRadius: 3,
          bgcolor: alpha(colorHex(stage.color), 0.07),
          border: `1px solid ${alpha(colorHex(stage.color), 0.2)}`,
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: colorHex(stage.color),
            flexShrink: 0,
          }}
        />
        <Box flex={1}>
          <Typography variant="body1" fontWeight={800} sx={{ color: T.text }}>
            {stage.name}
          </Typography>
          <Typography variant="caption" sx={{ color: T.textMuted }}>
            Durée max : {stage.max_duration_days}j · Alerte à {stage.warning_threshold_pct}%
          </Typography>
        </Box>
        {templates.length > 0 && (
          <Box textAlign="right">
            <Typography
              variant="caption"
              sx={{ color: T.textMuted, fontSize: 9, display: "block" }}
            >
              délai max
            </Typography>
            <Typography variant="body2" fontWeight={800} sx={{ color: colorHex(stage.color) }}>
              J+{maxDelay}
            </Typography>
          </Box>
        )}
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box display="flex" alignItems="center" gap={0.8}>
          <BoltIcon sx={{ fontSize: 15, color: T.info }} />
          <Typography variant="body2" fontWeight={800} sx={{ color: T.text }}>
            Tâches automatiques
          </Typography>
          <Chip
            label={templates.length}
            size="small"
            sx={{
              height: 17,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: alpha(T.info, 0.1),
              color: T.info,
              "& .MuiChip-label": { px: 0.8 },
            }}
          />
        </Box>
        <Button
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 13 }} />}
          onClick={() => {
            setEditTmpl(null);
            setDlgOpen(true);
          }}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 700,
            fontSize: 12,
            color: T.info,
            bgcolor: alpha(T.info, 0.08),
            "&:hover": { bgcolor: alpha(T.info, 0.15) },
          }}
        >
          Ajouter
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} sx={{ color: T.info }} />
        </Box>
      ) : templates.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: `2px dashed ${alpha(T.info, 0.2)}`,
            textAlign: "center",
            bgcolor: alpha(T.info, 0.01),
          }}
        >
          <BoltIcon sx={{ fontSize: 36, color: alpha(T.info, 0.2), mb: 1 }} />
          <Typography variant="body2" fontWeight={600} sx={{ color: T.textMuted }} gutterBottom>
            Aucune tâche configurée
          </Typography>
          <Typography variant="caption" sx={{ color: T.textLight }}>
            Ajoutez des tâches créées automatiquement
            <br />à chaque entrée dans cette étape
          </Typography>
          <Box mt={2}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddTaskIcon />}
              onClick={() => {
                setEditTmpl(null);
                setDlgOpen(true);
              }}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                borderColor: alpha(T.info, 0.4),
                color: T.info,
              }}
            >
              Ajouter une tâche
            </Button>
          </Box>
        </Paper>
      ) : (
        <Box>
          {/* Timeline */}
          {templates.map((t, idx) => {
            const at = getActType(t.activity_type || "other");
            return (
              <Box key={t.id} display="flex" gap={1.5} alignItems="stretch" mb={1}>
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  width={28}
                  flexShrink={0}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      bgcolor: alpha(at.color, 0.12),
                      border: `2px solid ${alpha(at.color, 0.3)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: at.color,
                      flexShrink: 0,
                    }}
                  >
                    {at.icon}
                  </Box>
                  {idx < templates.length - 1 && (
                    <Box sx={{ width: 2, flex: 1, bgcolor: T.border, my: 0.5, minHeight: 8 }} />
                  )}
                </Box>
                <Paper
                  elevation={0}
                  sx={{
                    flex: 1,
                    p: 1.4,
                    borderRadius: 2.5,
                    mb: 0.5,
                    border: `1px solid ${T.border}`,
                    bgcolor: T.bgCard,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    transition: "all 0.15s",
                    "&:hover": { boxShadow: `0 2px 8px rgba(0,0,0,0.07)` },
                  }}
                >
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={700} noWrap sx={{ color: T.text }}>
                      {t.title}
                    </Typography>
                    <Box display="flex" gap={0.7} mt={0.3} alignItems="center">
                      <Chip
                        label={at.label}
                        size="small"
                        sx={{
                          height: 15,
                          fontSize: 9,
                          bgcolor: alpha(at.color, 0.1),
                          color: at.color,
                          "& .MuiChip-label": { px: 0.7 },
                        }}
                      />
                      <Chip
                        label={PRIORITY_LABELS[t.priority]}
                        size="small"
                        sx={{
                          height: 15,
                          fontSize: 9,
                          bgcolor: alpha(PRIORITY_COLORS[t.priority], 0.1),
                          color: PRIORITY_COLORS[t.priority],
                          "& .MuiChip-label": { px: 0.7 },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: T.textLight }}>
                        J+{t.due_days_after_entry}
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" gap={0.3}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditTmpl(t);
                        setDlgOpen(true);
                      }}
                      sx={{
                        color: T.info,
                        width: 24,
                        height: 24,
                        bgcolor: alpha(T.info, 0.07),
                        "&:hover": { bgcolor: alpha(T.info, 0.15) },
                      }}
                    >
                      <EditIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(t.id)}
                      sx={{
                        color: T.primary,
                        width: 24,
                        height: 24,
                        bgcolor: alpha(T.primary, 0.07),
                        "&:hover": { bgcolor: alpha(T.primary, 0.15) },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                </Paper>
              </Box>
            );
          })}

          {/* Summary */}
          <Box
            mt={1.5}
            p={1.5}
            sx={{ borderRadius: 2.5, bgcolor: T.bg, border: `1px solid ${T.border}` }}
          >
            <Box display="flex" gap={2} flexWrap="wrap">
              {Object.entries(typeCounts).map(([key, count]) => {
                const at = getActType(key);
                return (
                  <Box key={key} display="flex" alignItems="center" gap={0.5}>
                    <Box sx={{ color: at.color }}>{at.icon}</Box>
                    <Typography variant="caption" sx={{ color: T.textMuted, fontSize: 10 }}>
                      {count}x {at.label.split(" ")[0]}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}

      {/* Idea box */}
      {templates.length < 3 && (
        <Box
          mt={2}
          p={1.8}
          sx={{
            borderRadius: 3,
            bgcolor: alpha(T.info, 0.04),
            border: `1px dashed ${alpha(T.info, 0.2)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: T.info, fontWeight: 700, display: "block", mb: 0.8 }}
          >
            💡 Idées pour « {stage.name} »
          </Typography>
          {[
            { icon: "📞", text: "Appel de qualification (Budget / Besoin)" },
            { icon: "📧", text: "Email de relance personnalisé J+2" },
            { icon: "📹", text: "Démo produit ou présentation visio" },
            { icon: "📄", text: "Envoyer une proposition commerciale" },
            { icon: "✅", text: "Vérifier les objections et y répondre" },
          ].map((idea, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{ color: T.textMuted, display: "block", mb: 0.2, fontSize: 11 }}
            >
              {idea.icon} {idea.text}
            </Typography>
          ))}
        </Box>
      )}

      <TaskTemplateDialog
        open={dlgOpen}
        template={editTmpl}
        stageId={stage.id}
        nextOrder={templates.length + 1}
        onClose={() => setDlgOpen(false)}
        onSaved={() => {
          load();
          if (onChanged) onChanged();
        }}
      />
    </Box>
  );
};
StageTasksPanel.propTypes = { stage: PropTypes.object, onChanged: PropTypes.func };

// ─── MAIN PAGE ─────────────────────────────────────────────────────
export default function PipelineAdmin() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelPipeline] = useState(null);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelStage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stagesLoading, setStLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "success" });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editPipeline, setEditPipeline] = useState(null);
  const [stageDlg, setStageDlg] = useState(false);
  const [editStage, setEditStage] = useState(null);
  const [assignDlg, setAssignDlg] = useState(false);
  const [deletePId, setDeletePId] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      navigate("/sign-in");
      return;
    }
    loadPipelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMsg = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "success" }), 4500);
  };

  const loadPipelines = async () => {
    setLoading(true);
    try {
      const r = await api.get("/pipelines/");
      const list = r.data.results || r.data;
      setPipelines(list);
      if (list.length > 0) {
        setSelPipeline(list[0]);
        loadStages(list[0].id);
      }
    } catch {
      showMsg("Erreur lors du chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadStages = async (pid) => {
    setStLoading(true);
    try {
      const r = await api.get("/pipeline-stages/", { params: { pipeline_id: pid } });
      const list = (r.data.results || r.data).sort((a, b) => a.order - b.order);
      setStages(list);
      setSelStage(null);
    } catch {
      showMsg("Erreur chargement étapes.", "error");
    } finally {
      setStLoading(false);
    }
  };

  const handleSelectPipeline = (p) => {
    setSelPipeline(p);
    setSelStage(null);
    loadStages(p.id);
  };

  const handleDeletePipeline = async () => {
    try {
      await api.delete(`/pipelines/${deletePId}/`);
      showMsg("Pipeline supprimé.");
      setDeletePId(null);
      if (selectedPipeline?.id === deletePId) {
        setSelPipeline(null);
        setStages([]);
      }
      loadPipelines();
    } catch {
      showMsg("Erreur lors de la suppression.", "error");
    }
  };

  const handleDeleteStage = async (id) => {
    if (!window.confirm("Supprimer cette étape ?")) return;
    try {
      await api.delete(`/pipeline-stages/${id}/`);
      showMsg("Étape supprimée.");
      if (selectedStage?.id === id) setSelStage(null);
      loadStages(selectedPipeline.id);
    } catch (e) {
      showMsg(e.response?.data?.detail || "Impossible de supprimer.", "error");
    }
  };

  const nextOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.order)) + 1 : 1;
  const nonTerminal = stages.filter((s) => !s.is_terminal);
  const terminal = stages.filter((s) => s.is_terminal);
  const totalTasks = stages.reduce((a, s) => a + (s.task_templates?.length || 0), 0);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3} px={3} sx={{ background: "#F8F9FC", minHeight: "100vh" }}>
        <Collapse in={!!message.text}>
          <Alert
            severity={message.type}
            sx={{ mb: 2.5, borderRadius: 3, fontWeight: 600 }}
            action={
              <IconButton size="small" onClick={() => setMessage({ text: "", type: "success" })}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {message.text}
          </Alert>
        </Collapse>

        {/* HEADER */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                background: T.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PipelineIcon sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: T.text, lineHeight: 1.2 }}>
                Administration Pipeline
              </Typography>
              <Typography variant="caption" sx={{ color: T.textMuted }}>
                Configurez vos pipelines, étapes et tâches automatiques
              </Typography>
            </Box>
          </Box>
          <GradBtn
            startIcon={<AddIcon />}
            onClick={() => {
              setEditPipeline(null);
              setWizardOpen(true);
            }}
          >
            Nouveau pipeline
          </GradBtn>
        </Box>

        {/* HOW IT WORKS */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: `1px solid ${T.border}`,
            bgcolor: T.bgCard,
            mb: 3,
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1.5}>
            <BoltIcon sx={{ color: T.warning, fontSize: 18 }} />
            <Typography variant="body2" fontWeight={800} sx={{ color: T.text }}>
              Comment ça marche ?
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            {[
              { n: "1", label: "Créer un pipeline", icon: "🚀" },
              { n: "2", label: "Configurer les étapes", icon: "📋" },
              { n: "3", label: "Ajouter des tâches auto", icon: "⚡" },
              { n: "4", label: "Ajouter des opportunités", icon: "💼" },
              { n: "5", label: "Suivre dans Kanban", icon: "📊" },
            ].map((item, i) => (
              <React.Fragment key={i}>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={0.6}
                  sx={{
                    px: 1.4,
                    py: 0.7,
                    borderRadius: 2,
                    bgcolor: alpha(T.primary, 0.05),
                    border: `1px solid ${alpha(T.primary, 0.1)}`,
                  }}
                >
                  <Typography sx={{ fontSize: 13 }}>{item.icon}</Typography>
                  <Typography variant="caption" fontWeight={700} sx={{ color: T.textMuted }}>
                    {item.n}. {item.label}
                  </Typography>
                </Box>
                {i < 4 && <ArrowIcon sx={{ color: T.textLight, fontSize: 15 }} />}
              </React.Fragment>
            ))}
          </Box>
        </Paper>

        {loading ? (
          <Box display="flex" justifyContent="center" py={10}>
            <Box textAlign="center">
              <CircularProgress sx={{ color: T.primary, mb: 2 }} />
              <Typography variant="body2" sx={{ color: T.textMuted }}>
                Chargement...
              </Typography>
            </Box>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* ══ COL 1 — PIPELINES ══ */}
            <Grid item xs={12} md={3}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: T.textLight,
                  fontSize: 10,
                  display: "block",
                  mb: 1.5,
                }}
              >
                Pipelines ({pipelines.length})
              </Typography>
              {pipelines.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    textAlign: "center",
                    border: `2px dashed ${alpha(T.primary, 0.2)}`,
                  }}
                >
                  <PipelineIcon sx={{ fontSize: 44, color: alpha(T.primary, 0.2), mb: 1.5 }} />
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ color: T.textMuted }}
                    gutterBottom
                  >
                    Aucun pipeline
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditPipeline(null);
                      setWizardOpen(true);
                    }}
                    sx={{
                      mt: 1.5,
                      borderRadius: 2.5,
                      textTransform: "none",
                      fontWeight: 700,
                      color: T.primary,
                      bgcolor: alpha(T.primary, 0.08),
                    }}
                  >
                    Créer maintenant
                  </Button>
                </Paper>
              ) : (
                pipelines.map((p) => (
                  <PCard
                    key={p.id}
                    selected={selectedPipeline?.id === p.id ? "true" : "false"}
                    onClick={() => handleSelectPipeline(p)}
                    sx={{ mb: 1.5 }}
                  >
                    <CardContent sx={{ p: "14px !important" }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1} minWidth={0}>
                          <Typography
                            variant="body2"
                            fontWeight={800}
                            noWrap
                            sx={{ color: T.text, mb: 0.7 }}
                          >
                            {p.name}
                          </Typography>
                          <Stack direction="row" spacing={0.6} flexWrap="wrap">
                            <Chip
                              label={p.pipeline_type?.toUpperCase()}
                              size="small"
                              sx={{
                                height: 17,
                                fontSize: 9,
                                fontWeight: 800,
                                bgcolor: alpha(T.primary, 0.1),
                                color: T.primary,
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                            <Chip
                              label={`${p.stages_count || 0} étapes`}
                              size="small"
                              sx={{
                                height: 17,
                                fontSize: 9,
                                bgcolor: alpha(T.info, 0.08),
                                color: T.info,
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                            <Chip
                              label={`${p.opportunities_count || 0} opps`}
                              size="small"
                              sx={{
                                height: 17,
                                fontSize: 9,
                                bgcolor: alpha(T.success, 0.08),
                                color: T.success,
                                "& .MuiChip-label": { px: 0.8 },
                              }}
                            />
                          </Stack>
                        </Box>
                        <Box display="flex" gap={0.3} ml={0.8}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditPipeline(p);
                              setWizardOpen(true);
                            }}
                            sx={{
                              color: T.info,
                              width: 24,
                              height: 24,
                              bgcolor: alpha(T.info, 0.08),
                            }}
                          >
                            <EditIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletePId(p.id);
                            }}
                            sx={{
                              color: T.primary,
                              width: 24,
                              height: 24,
                              bgcolor: alpha(T.primary, 0.08),
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </PCard>
                ))
              )}
            </Grid>

            {/* ══ COL 2 — ÉTAPES ══ */}
            <Grid item xs={12} md={4}>
              {selectedPipeline ? (
                <>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: T.textLight,
                        fontSize: 10,
                      }}
                    >
                      Étapes ({stages.length})
                    </Typography>
                    <Box display="flex" gap={0.8}>
                      <Button
                        size="small"
                        startIcon={<AssignIcon sx={{ fontSize: 13 }} />}
                        onClick={() => setAssignDlg(true)}
                        sx={{
                          borderRadius: 2,
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 11,
                          color: T.success,
                          bgcolor: alpha(T.success, 0.08),
                          "&:hover": { bgcolor: alpha(T.success, 0.15) },
                        }}
                      >
                        + Opps
                      </Button>
                      <Button
                        size="small"
                        startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                        onClick={() => {
                          setEditStage(null);
                          setStageDlg(true);
                        }}
                        sx={{
                          borderRadius: 2,
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 11,
                          color: T.primary,
                          bgcolor: alpha(T.primary, 0.08),
                          "&:hover": { bgcolor: alpha(T.primary, 0.15) },
                        }}
                      >
                        + Étape
                      </Button>
                    </Box>
                  </Box>

                  {stages.length > 0 && (
                    <Box display="flex" gap={1.2} mb={2}>
                      <Box
                        flex={1}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          bgcolor: T.bgCard,
                          border: `1px solid ${T.border}`,
                          textAlign: "center",
                        }}
                      >
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ color: T.info, lineHeight: 1.2 }}
                        >
                          {nonTerminal.length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: T.textMuted }}>
                          Actives
                        </Typography>
                      </Box>
                      <Box
                        flex={1}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          bgcolor: T.bgCard,
                          border: `1px solid ${T.border}`,
                          textAlign: "center",
                        }}
                      >
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ color: T.warning, lineHeight: 1.2 }}
                        >
                          {totalTasks}
                        </Typography>
                        <Typography variant="caption" sx={{ color: T.textMuted }}>
                          Tâches auto
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {stagesLoading ? (
                    <Box display="flex" justifyContent="center" py={5}>
                      <CircularProgress size={28} sx={{ color: T.primary }} />
                    </Box>
                  ) : stages.length === 0 ? (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 4,
                        borderRadius: 3,
                        textAlign: "center",
                        border: `2px dashed ${alpha(T.primary, 0.2)}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: T.textMuted }} gutterBottom>
                        Aucune étape
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setEditStage(null);
                          setStageDlg(true);
                        }}
                        sx={{
                          mt: 1,
                          borderRadius: 2,
                          textTransform: "none",
                          color: T.primary,
                          bgcolor: alpha(T.primary, 0.08),
                        }}
                      >
                        Ajouter
                      </Button>
                    </Paper>
                  ) : (
                    <>
                      {nonTerminal.length > 0 && (
                        <Box mb={1.5}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: T.textLight,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              fontSize: 9,
                              letterSpacing: 0.8,
                              display: "block",
                              mb: 0.8,
                              ml: 0.5,
                            }}
                          >
                            Étapes actives
                          </Typography>
                          {nonTerminal.map((stage) => (
                            <StageRow
                              key={stage.id}
                              isselected={selectedStage?.id === stage.id ? "true" : "false"}
                              isterminal="false"
                              onClick={() =>
                                setSelStage(selectedStage?.id === stage.id ? null : stage)
                              }
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  bgcolor: colorHex(stage.color),
                                  flexShrink: 0,
                                }}
                              />
                              <Box flex={1} minWidth={0}>
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                  noWrap
                                  sx={{ color: T.text }}
                                >
                                  {stage.name}
                                </Typography>
                                <Box display="flex" gap={1} alignItems="center">
                                  <Typography variant="caption" sx={{ color: T.textLight }}>
                                    #{stage.order} · {stage.max_duration_days}j max
                                  </Typography>
                                  {(stage.task_templates?.length || 0) > 0 && (
                                    <Chip
                                      icon={<BoltIcon sx={{ fontSize: "9px !important" }} />}
                                      label={stage.task_templates.length}
                                      size="small"
                                      sx={{
                                        height: 15,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        bgcolor: alpha(T.info, 0.1),
                                        color: T.info,
                                        "& .MuiChip-label": { pl: 0.3, pr: 0.7 },
                                      }}
                                    />
                                  )}
                                </Box>
                              </Box>
                              <Box display="flex" gap={0.3} onClick={(e) => e.stopPropagation()}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditStage(stage);
                                    setStageDlg(true);
                                  }}
                                  sx={{
                                    color: T.info,
                                    width: 24,
                                    height: 24,
                                    bgcolor: alpha(T.info, 0.08),
                                  }}
                                >
                                  <EditIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteStage(stage.id)}
                                  sx={{
                                    color: T.primary,
                                    width: 24,
                                    height: 24,
                                    bgcolor: alpha(T.primary, 0.08),
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Box>
                            </StageRow>
                          ))}
                        </Box>
                      )}

                      {terminal.length > 0 && (
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: T.textLight,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              fontSize: 9,
                              letterSpacing: 0.8,
                              display: "block",
                              mb: 0.8,
                              ml: 0.5,
                            }}
                          >
                            Étapes terminales
                          </Typography>
                          {terminal.map((stage) => (
                            <StageRow
                              key={stage.id}
                              isselected={selectedStage?.id === stage.id ? "true" : "false"}
                              isterminal="true"
                              onClick={() =>
                                setSelStage(selectedStage?.id === stage.id ? null : stage)
                              }
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  bgcolor: stage.is_won ? T.success : T.primary,
                                  flexShrink: 0,
                                }}
                              />
                              <Box flex={1}>
                                <Typography
                                  variant="body2"
                                  fontWeight={700}
                                  sx={{ color: stage.is_won ? T.success : T.primary }}
                                >
                                  {stage.name}
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditStage(stage);
                                  setStageDlg(true);
                                }}
                                sx={{
                                  color: T.info,
                                  width: 24,
                                  height: 24,
                                  bgcolor: alpha(T.info, 0.08),
                                }}
                              >
                                <EditIcon sx={{ fontSize: 12 }} />
                              </IconButton>
                            </StageRow>
                          ))}
                        </Box>
                      )}

                      {/* Flow */}
                      {stages.length > 1 && (
                        <Box
                          mt={2.5}
                          p={2}
                          sx={{
                            borderRadius: 3,
                            bgcolor: T.bgCard,
                            border: `1px solid ${T.border}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: T.textLight,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              fontSize: 9,
                              letterSpacing: 0.8,
                              display: "block",
                              mb: 1,
                            }}
                          >
                            Flux du pipeline
                          </Typography>
                          <Box display="flex" alignItems="center" flexWrap="wrap" gap={0.5}>
                            {stages.map((s, i) => (
                              <React.Fragment key={s.id}>
                                <Box
                                  sx={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    bgcolor: s.is_terminal
                                      ? s.is_won
                                        ? T.success
                                        : T.primary
                                      : colorHex(s.color),
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: s.is_terminal
                                      ? s.is_won
                                        ? T.success
                                        : T.primary
                                      : T.textMuted,
                                  }}
                                >
                                  {s.name}
                                </Typography>
                                {i < stages.length - 1 && (
                                  <ArrowIcon sx={{ fontSize: 11, color: T.textLight }} />
                                )}
                              </React.Fragment>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </>
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  height={300}
                  sx={{ color: T.textLight }}
                >
                  <PipelineIcon sx={{ fontSize: 50, mb: 2, color: alpha(T.primary, 0.15) }} />
                  <Typography variant="body2" fontWeight={600} sx={{ color: T.textMuted }}>
                    Sélectionnez un pipeline
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* ══ COL 3 — TCHES ══ */}
            <Grid item xs={12} md={5}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: T.textLight,
                  fontSize: 10,
                  display: "block",
                  mb: 1.5,
                }}
              >
                Tâches automatiques
              </Typography>
              <Card
                sx={{
                  borderRadius: 3,
                  border: `1px solid ${T.border}`,
                  boxShadow: "none",
                  minHeight: 350,
                  bgcolor: T.bgCard,
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <StageTasksPanel
                    stage={selectedStage}
                    onChanged={() => selectedPipeline && loadStages(selectedPipeline.id)}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* DIALOGS */}
        <PipelineWizard
          open={wizardOpen}
          pipeline={editPipeline}
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            loadPipelines();
            showMsg(
              editPipeline ? "Pipeline modifié !" : "🎉 Pipeline créé avec étapes et tâches !"
            );
          }}
        />

        <StageDialog
          open={stageDlg}
          stage={editStage}
          pipelineId={selectedPipeline?.id}
          nextOrder={editStage ? editStage.order : nextOrder}
          onClose={() => setStageDlg(false)}
          onSaved={() => {
            loadStages(selectedPipeline.id);
            showMsg(editStage ? "Étape modifiée." : "Étape ajoutée !");
          }}
        />

        <AssignOpDialog
          open={assignDlg}
          pipeline={selectedPipeline}
          stages={stages}
          onClose={() => setAssignDlg(false)}
          onAssigned={() => {
            loadPipelines();
            showMsg("Opportunité(s) ajoutée(s) !");
          }}
        />

        <Dialog
          open={!!deletePId}
          onClose={() => setDeletePId(null)}
          PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: T.text }}>
            ⚠️ Confirmer la suppression
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: T.textMuted }}>
              Toutes les étapes, tâches templates et l&apos;historique seront définitivement perdus.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button
              onClick={() => setDeletePId(null)}
              sx={{ borderRadius: 2.5, textTransform: "none" }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleDeletePipeline}
              variant="contained"
              sx={{
                background: T.gradient,
                borderRadius: 2.5,
                px: 3,
                textTransform: "none",
                fontWeight: 700,
              }}
            >
              Supprimer
            </Button>
          </DialogActions>
        </Dialog>
      </MDBox>
    </DashboardLayout>
  );
}
