import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { AutoFixHigh, ContentCopy, Launch, Phone, TaskAlt } from "@mui/icons-material";

import {
  continueInteraction,
  getInteractionOptions,
  getInteractions,
  recordInteraction,
  startInitialEngagementPlan,
} from "../../services/engagementApi";
import {
  ACTION_TYPE_LABELS,
  CHANNEL_LABELS,
  INTEREST_LABELS,
  INTENT_LABELS,
  OBJECTIVE_LABELS,
  OUTCOME_LABELS,
  POLICY_LABELS,
  SENTIMENT_LABELS,
  STRATEGY_LABELS,
  TEMPERATURE_LABELS,
  confidenceLevel,
  labelFromEnum,
} from "./engagementDisplayLabels";

const THEME = {
  red: "#C8102E",
  redDeep: "#9B0D22",
  redSoft: "#FDEEF1",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  softSurface: "#F8FAFC",
  muted: "#6B7280",
  text: "#111827",
  success: "#059669",
  warning: "#D97706",
};

const CHANNELS = [
  { key: "email", api: "EMAIL", label: "Email" },
  { key: "phone", api: "PHONE", label: "Téléphone" },
  { key: "linkedin", api: "LINKEDIN", label: "LinkedIn" },
  { key: "facebook", api: "FACEBOOK", label: "Facebook" },
  { key: "instagram", api: "INSTAGRAM", label: "Instagram" },
  { key: "other", api: "OTHER", label: "Autre" },
];

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(Math.max(0, Math.min(1, number)) * 100);
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function fullName(prospect) {
  return `${prospect?.first_name || ""} ${prospect?.last_name || ""}`.trim() || "Prospect";
}

function companyName(prospect) {
  return prospect?.company_name || prospect?.prospect_company_detail?.name || "Société inconnue";
}

function availableContactChannels(prospect, availableChannels = {}) {
  return CHANNELS.filter((channel) => channel.key !== "other")
    .map((channel) => ({
      ...channel,
      available: Boolean(
        availableChannels?.[channel.key]?.available ||
          prospect?.[`${channel.key}_url`] ||
          prospect?.[channel.key] ||
          (channel.key === "phone" && (prospect?.phone || prospect?.mobile))
      ),
    }))
    .filter((channel) => channel.available);
}

function channelApiToUi(value) {
  const normalized = String(value || "").toLowerCase();
  return (
    CHANNELS.find((channel) => channel.key === normalized || channel.api === value)?.api || "OTHER"
  );
}

function actionForChannel(channel) {
  if (channel === "email") return "EMAIL_SENT";
  if (channel === "phone") return "PHONE_CALL";
  if (["linkedin", "facebook", "instagram"].includes(channel)) return "SOCIAL_MESSAGE_SENT";
  return "OTHER";
}

function buildBackendOptions(values, labels, channelLabels = CHANNELS) {
  return list(values).map((value) => {
    const channel = channelLabels.find((item) => item.api === value);
    return {
      value,
      label: labels?.[value] || channel?.label || value,
    };
  });
}

function copyText(text, onToast) {
  if (!text) return;
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    onToast?.("Copie dans le presse-papiers.");
  }
}

function SectionCard({ title, children, action }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1,
        borderColor: THEME.border,
        boxShadow: "0 10px 28px rgba(17, 24, 39, 0.06)",
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Typography variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function TextBlock({ children }) {
  return (
    <Box
      sx={{
        bgcolor: "#F9FAFB",
        border: `1px solid ${THEME.border}`,
        borderRadius: 1,
        p: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "normal",
        overflowWrap: "anywhere",
      }}
    >
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {children || "-"}
      </Typography>
    </Box>
  );
}

function ValueLine({ label, value }) {
  return (
    <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        align="right"
        sx={{ wordBreak: "normal", overflowWrap: "anywhere", minWidth: 0 }}
      >
        {value || "-"}
      </Typography>
    </Stack>
  );
}

export function StrategyCard({ title, plan }) {
  if (!plan) {
    return (
      <SectionCard title={title}>
        <Alert severity="info">Aucune action préparée pour ce prospect.</Alert>
      </SectionCard>
    );
  }

  const confidence = confidenceLevel(plan.confidence);
  return (
    <SectionCard title={title}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            Stratégie
          </Typography>
          <Typography variant="h5" fontWeight={900} sx={{ color: THEME.text, mt: 0.5 }}>
            {labelFromEnum(plan.strategy, STRATEGY_LABELS)}
          </Typography>
        </Grid>
        <Grid item xs={12} md={7}>
          <ValueLine label="Objectif" value={labelFromEnum(plan.objective, OBJECTIVE_LABELS)} />
          <ValueLine
            label="Niveau d'intérêt"
            value={labelFromEnum(plan.prospect_temperature, TEMPERATURE_LABELS)}
          />
          <ValueLine
            label="Canal recommandé"
            value={labelFromEnum(plan.primary_channel, CHANNEL_LABELS)}
          />
          <ValueLine label="Attendre" value={plan.should_wait ? "Oui" : "Non"} />
          <ValueLine
            label="Revoir dans"
            value={plan.suggested_wait_days ? `${plan.suggested_wait_days} jours` : ""}
          />
          <Typography variant="caption" color="text.secondary">
            {"Confiance de l'agent"}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <LinearProgress
              variant="determinate"
              value={confidence.percent}
              sx={{
                flex: 1,
                height: 8,
                borderRadius: 1,
                bgcolor: "#F3F4F6",
                "& .MuiLinearProgress-bar": { bgcolor: THEME.red },
              }}
            />
            <Typography variant="body2" fontWeight={800}>
              {confidence.label} · {confidence.percent} %
            </Typography>
          </Stack>
        </Grid>
      </Grid>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        Pourquoi cette recommandation ?
      </Typography>
      {list(plan.reasons).length ? (
        <Stack component="ul" sx={{ pl: 2, mt: 0.5, mb: 1 }}>
          {list(plan.reasons).map((reason) => (
            <Typography component="li" key={reason} variant="body2">
              {reason}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          -
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        Informations manquantes
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1, mt: 0.5 }}>
        {list(plan.missing_information).length ? (
          list(plan.missing_information).map((item) => (
            <Chip key={item} size="small" label={item} sx={{ borderRadius: 1 }} />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            -
          </Typography>
        )}
      </Stack>
    </SectionCard>
  );
}

export function PolicyAlert({ policy }) {
  if (!policy) return null;
  if (policy.status === "ALLOWED" && !list(policy.warnings).length) return null;

  const isBlocked = policy.status === "BLOCKED" || policy.allowed === false;
  const severity = isBlocked ? "error" : policy.status === "REQUIRES_REVIEW" ? "warning" : "info";
  const title = isBlocked
    ? "Action bloquée"
    : policy.status === "REQUIRES_REVIEW"
    ? "Vérification requise"
    : "Point d'attention";
  const items = [...list(policy.violations), ...list(policy.warnings)];

  return (
    <Alert severity={severity}>
      <Typography variant="body2" fontWeight={800}>
        {title}
      </Typography>
      {items.map((item) => (
        <Typography key={item} variant="body2">
          {POLICY_LABELS[item] || item}
        </Typography>
      ))}
    </Alert>
  );
}

export function GeneratedContentCard({ content, plan, prospect, onToast, onActionDone, disabled }) {
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });
  const [socialDraft, setSocialDraft] = useState("");

  useEffect(() => {
    setEmailDraft({
      subject: content?.email?.subject || "",
      body: content?.email?.body || "",
    });
    setSocialDraft(content?.social_message?.message || "");
  }, [content]);

  if (!plan && !content) {
    return (
      <SectionCard title="Action à effectuer">
        <Alert severity="info">{"Lancez l'agent IA pour préparer une action recommandée."}</Alert>
      </SectionCard>
    );
  }

  if (plan?.strategy === "STOP_ENGAGEMENT") {
    return (
      <SectionCard title="Sollicitations arrêtées">
        <Alert severity="warning">{"Aucun contact n'est recommandé pour ce prospect."}</Alert>
      </SectionCard>
    );
  }

  if (plan?.strategy === "WAIT" || content?.content_required === false) {
    return (
      <SectionCard title="L'agent recommande d'attendre">
        <Stack spacing={1}>
          <TextBlock>
            {content?.reason || plan?.reasons?.[0] || "Aucune action immédiate recommandée."}
          </TextBlock>
          <ValueLine
            label="Revoir dans"
            value={plan?.suggested_wait_days ? `${plan.suggested_wait_days} jours` : ""}
          />
        </Stack>
      </SectionCard>
    );
  }

  if (content?.channel === "email" && content.email) {
    const text = `${emailDraft.subject}\n\n${emailDraft.body}`;
    return (
      <SectionCard title="Email proposé">
        <Stack spacing={1.5}>
          <TextField
            label="Objet"
            value={emailDraft.subject}
            onChange={(event) =>
              setEmailDraft((current) => ({ ...current, subject: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Message"
            value={emailDraft.body}
            onChange={(event) =>
              setEmailDraft((current) => ({ ...current, body: event.target.value }))
            }
            multiline
            minRows={7}
            fullWidth
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
            <Button
              startIcon={<ContentCopy />}
              onClick={() => copyText(text, onToast)}
              sx={{ color: THEME.red }}
            >
              Copier
            </Button>
            <Button
              startIcon={<TaskAlt />}
              disabled={disabled}
              onClick={() =>
                onActionDone?.({
                  channel: "EMAIL",
                  action_type: "EMAIL_SENT",
                  outcome: "SENT",
                  generated_content_reference: text,
                })
              }
              sx={{ color: THEME.red }}
            >
              {"Enregistrer l'envoi"}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    );
  }

  if (content?.channel === "phone" && content.call_script) {
    const script = content.call_script;
    const text = [
      script.call_objective,
      script.opening,
      script.hook,
      ...list(script.discovery_questions),
      script.value_proposition,
      ...list(script.possible_objections).map(
        (item) => `${item.objection}: ${item.suggested_response}`
      ),
      script.call_to_action,
      script.closing,
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <SectionCard title="Script d'appel recommandé">
        <Stack spacing={1}>
          <ValueLine label="Introduction" value={script.opening} />
          <ValueLine label="Accroche" value={script.hook} />
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            Questions à poser
          </Typography>
          <TextBlock>{list(script.discovery_questions).join("\n")}</TextBlock>
          <ValueLine label="Proposition de valeur" value={script.value_proposition} />
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            Objections possibles et réponses suggérées
          </Typography>
          <TextBlock>
            {list(script.possible_objections)
              .map((item) => `${item.objection}: ${item.suggested_response}`)
              .join("\n")}
          </TextBlock>
          <ValueLine label="Prochaine étape" value={script.call_to_action} />
          <ValueLine label="Conclusion" value={script.closing} />
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<ContentCopy />}
              onClick={() => copyText(text, onToast)}
              sx={{ color: THEME.red }}
            >
              Copier le script
            </Button>
            <Button
              startIcon={<Phone />}
              onClick={() =>
                onActionDone?.({
                  channel: "PHONE",
                  action_type: "PHONE_CALL",
                  outcome: "NO_RESPONSE",
                  generated_content_reference: text,
                })
              }
              disabled={disabled}
              sx={{ color: THEME.red }}
            >
              Appel effectué
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    );
  }

  if (content?.social_message) {
    const profileUrl = prospect?.[`${content.channel}_url`];
    const channelLabel = labelFromEnum(content.channel, CHANNEL_LABELS);
    return (
      <SectionCard title={`Message ${channelLabel} proposé`}>
        <Stack spacing={1.5}>
          <TextField
            label="Message proposé"
            value={socialDraft}
            onChange={(event) => setSocialDraft(event.target.value)}
            multiline
            minRows={6}
            fullWidth
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
            <Button
              startIcon={<ContentCopy />}
              onClick={() => copyText(socialDraft, onToast)}
              sx={{ color: THEME.red }}
            >
              Copier le message
            </Button>
            {profileUrl && (
              <Button
                startIcon={<Launch />}
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: THEME.red }}
              >
                Ouvrir {channelLabel}
              </Button>
            )}
            <Button
              startIcon={<TaskAlt />}
              onClick={() =>
                onActionDone?.({
                  channel: channelApiToUi(content.channel),
                  action_type: "SOCIAL_MESSAGE_SENT",
                  outcome: "SENT",
                  generated_content_reference: socialDraft,
                })
              }
              disabled={disabled}
              sx={{ color: THEME.red }}
            >
              Marquer comme envoyé
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Contenu généré">
      <Alert severity="info">Aucun contenu à afficher.</Alert>
    </SectionCard>
  );
}

export function InteractionForm({ open, initialValues, onClose, onSubmit, saving, options }) {
  const [form, setForm] = useState({
    channel: "EMAIL",
    action_type: "EMAIL_SENT",
    outcome: "SENT",
    prospect_response: "",
    commercial_notes: "",
  });

  useEffect(() => {
    if (open) setForm((current) => ({ ...current, ...initialValues }));
  }, [initialValues, open]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Enregistrer le résultat</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Canal"
            value={form.channel}
            onChange={update("channel")}
            fullWidth
          >
            {options.channels.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Type d'action"
            value={form.action_type}
            onChange={update("action_type")}
            fullWidth
          >
            {options.actionTypes.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Résultat"
            value={form.outcome}
            onChange={update("outcome")}
            fullWidth
          >
            {options.outcomes.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Réponse du prospect"
            value={form.prospect_response}
            onChange={update("prospect_response")}
            multiline
            minRows={4}
            fullWidth
          />
          <TextField
            label="Notes internes"
            value={form.commercial_notes}
            onChange={update("commercial_notes")}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: THEME.red }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => onSubmit(form)}
          sx={{ bgcolor: THEME.red, "&:hover": { bgcolor: THEME.redDeep } }}
        >
          {saving ? "Enregistrement..." : "Enregistrer l'interaction"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ResponseAnalysisCard({ analysis }) {
  if (!analysis) return null;
  return (
    <SectionCard title="Analyse de la réponse">
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ValueLine label="Intention" value={labelFromEnum(analysis.intent, INTENT_LABELS)} />
          <ValueLine
            label="Sentiment"
            value={labelFromEnum(analysis.sentiment, SENTIMENT_LABELS)}
          />
          <ValueLine
            label="Intérêt"
            value={labelFromEnum(analysis.interest_level, INTEREST_LABELS)}
          />
          <ValueLine label="Solution actuelle" value={analysis.current_solution} />
          <ValueLine label="Timing" value={analysis.timing} />
          <ValueLine
            label="Confiance"
            value={`${confidenceLevel(analysis.confidence).label} · ${formatPercent(
              analysis.confidence
            )} %`}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ValueLine
            label="Objections"
            value={list(analysis.detected_objections)
              .map((item) => labelFromEnum(item.type || item))
              .join(", ")}
          />
          <ValueLine
            label="Demandes"
            value={list(analysis.detected_requests)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
          <ValueLine
            label="Besoins identifiés"
            value={list(analysis.detected_pain_points)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
          <ValueLine
            label="Signaux positifs"
            value={list(analysis.buying_signals)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
        </Grid>
      </Grid>
      <Divider sx={{ my: 1.5 }} />
      <TextBlock>{analysis.summary}</TextBlock>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            Faits confirmés
          </Typography>
          <Stack spacing={0.75} mt={0.5}>
            {list(analysis.confirmed_facts).map((fact) => (
              <Chip
                key={`${fact.label || fact.value}`}
                size="small"
                label={`${labelFromEnum(fact.label || "Fait")}: ${labelFromEnum(
                  fact.value || fact
                )}`}
                sx={{ borderRadius: 1, justifyContent: "flex-start" }}
              />
            ))}
            {!list(analysis.confirmed_facts).length && (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            )}
          </Stack>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            Signaux détectés
          </Typography>
          <Stack spacing={0.75} mt={0.5}>
            {list(analysis.inferred_signals).map((signal) => (
              <Chip
                key={`${signal.label || signal.value}`}
                size="small"
                label={`${labelFromEnum(signal.label || "Signal")}: ${labelFromEnum(
                  signal.value || signal
                )}`}
                sx={{ borderRadius: 1, justifyContent: "flex-start" }}
              />
            ))}
            {!list(analysis.inferred_signals).length && (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            )}
          </Stack>
        </Grid>
      </Grid>
    </SectionCard>
  );
}

export function EngagementMemoryCard({ memory }) {
  if (!memory) return null;
  return (
    <SectionCard title="Ce que l'agent a retenu">
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ValueLine label="Solution actuelle" value={memory.current_solution} />
          <ValueLine
            label="Niveau d'intérêt"
            value={labelFromEnum(memory.interest_level, INTEREST_LABELS)}
          />
          <ValueLine label="Timing" value={memory.timing} />
        </Grid>
        <Grid item xs={12} md={6}>
          <ValueLine
            label="Besoins identifiés"
            value={list(memory.known_needs)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
          <ValueLine
            label="Difficultés"
            value={list(memory.known_pain_points)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
          <ValueLine
            label="Objections"
            value={list(memory.known_objections)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
          <ValueLine
            label="Demandes"
            value={list(memory.known_requests)
              .map((item) => labelFromEnum(item))
              .join(", ")}
          />
        </Grid>
      </Grid>
    </SectionCard>
  );
}

function errorMessage(error) {
  const status = error?.response?.status;
  if (status === 429) return "Le service est momentanément sollicité. Réessayez un peu plus tard.";
  if (status === 401) return "Votre session a expiré. Veuillez vous reconnecter.";
  if (status === 403) return "Cette action n'est pas autorisée pour ce prospect.";
  return "L'action n'a pas pu être finalisée. Réessayez dans quelques instants.";
}

export default function AgentEngagementCockpit({ prospect, onToast, onConversationChanged }) {
  const [initialResult, setInitialResult] = useState(null);
  const [continuedResult, setContinuedResult] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [memory, setMemory] = useState(null);
  const [interactionOptions, setInteractionOptions] = useState({
    channels: [],
    action_types: [],
    outcomes: [],
  });
  const [loading, setLoading] = useState("");
  const [interactionFormOpen, setInteractionFormOpen] = useState(false);
  const [interactionDefaults, setInteractionDefaults] = useState({});

  const currentResult = continuedResult || initialResult || {};
  const plan = currentResult.plan || null;
  const manualReviewRequired = Boolean(currentResult.manual_review_required);
  const content = manualReviewRequired ? null : currentResult.content || null;
  const policy = currentResult.policy || null;
  const availableChannels = currentResult.available_channels || {};
  const formOptions = useMemo(
    () => ({
      channels: buildBackendOptions(interactionOptions.channels, null),
      actionTypes: buildBackendOptions(interactionOptions.action_types, ACTION_TYPE_LABELS),
      outcomes: buildBackendOptions(interactionOptions.outcomes, OUTCOME_LABELS),
    }),
    [interactionOptions]
  );

  const loadInteractions = useCallback(async () => {
    if (!prospect?.id) return;
    try {
      const res = await getInteractions(prospect.id);
      setInteractions(res.data?.results || res.data?.interactions || []);
    } catch {
      setInteractions([]);
    }
  }, [prospect?.id]);

  useEffect(() => {
    setInitialResult(null);
    setContinuedResult(null);
    setSelectedInteraction(null);
    setAnalysis(null);
    setMemory(null);
    loadInteractions();
  }, [loadInteractions, prospect?.id]);

  useEffect(() => {
    let active = true;
    getInteractionOptions()
      .then((res) => {
        if (!active) return;
        setInteractionOptions({
          channels: res.data?.channels || [],
          action_types: res.data?.action_types || [],
          outcomes: res.data?.outcomes || [],
        });
      })
      .catch(() => {
        if (active) {
          setInteractionOptions({ channels: [], action_types: [], outcomes: [] });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const runInitial = async () => {
    setLoading("Analyse du prospect, génération de la stratégie et du contenu...");
    try {
      const res = await startInitialEngagementPlan(prospect.id);
      setInitialResult(res.data);
      setContinuedResult(null);
      setMemory(res.data?.engagement_memory || null);
      await onConversationChanged?.();
      onToast?.(
        res.data?.policy?.allowed === false || res.data?.success === false
          ? "La politique d'engagement bloque l'action proposée."
          : "Stratégie générée."
      );
    } catch (error) {
      onToast?.(errorMessage(error), "error");
    } finally {
      setLoading("");
    }
  };

  const openInteractionForm = (defaults = {}) => {
    setInteractionDefaults(defaults);
    setInteractionFormOpen(true);
  };

  const submitInteraction = async (payload) => {
    setLoading("Enregistrement de l'interaction...");
    try {
      const res = await recordInteraction(prospect.id, payload);
      const interaction = res.data?.interaction;
      setSelectedInteraction(interaction);
      setInteractionFormOpen(false);
      await loadInteractions();
      await onConversationChanged?.();
      onToast?.("Interaction enregistrée.");
    } catch (error) {
      onToast?.(errorMessage(error), "error");
    } finally {
      setLoading("");
    }
  };

  const continueEngagement = async () => {
    if (!selectedInteraction?.id) return;
    setLoading("Analyse de l'interaction et adaptation de la recommandation...");
    try {
      const res = await continueInteraction(prospect.id, selectedInteraction.id);
      const result = res.data || {};
      setContinuedResult(result);
      setAnalysis(result.analysis || null);
      setMemory(result.engagement_memory || null);
      await onConversationChanged?.();
      onToast?.(
        result.manual_review_required
          ? "Une vérification humaine est nécessaire."
          : result.policy?.allowed === false || result.success === false
          ? "La politique d'engagement bloque l'action proposée."
          : "Recommandation adaptée."
      );
    } catch (error) {
      onToast?.(errorMessage(error), "error");
    } finally {
      setLoading("");
    }
  };

  const initialPlan = initialResult?.plan;
  const continuedPlan = continuedResult?.plan;
  const contactChannels = availableContactChannels(prospect, availableChannels);
  const primaryChannelLabel = plan?.primary_channel
    ? labelFromEnum(plan.primary_channel, CHANNEL_LABELS)
    : contactChannels[0]?.label || "À déterminer";
  const confidence = plan ? confidenceLevel(plan.confidence) : { label: "En attente", percent: 0 };
  const progressSteps = [
    ["Stratégie", Boolean(initialPlan)],
    ["Contenu", Boolean(initialResult?.content?.content_required)],
    ["Action enregistrée", interactions.length > 0],
    ["Réponse analysée", Boolean(analysis)],
    ["Relance adaptée", Boolean(continuedResult)],
  ];

  return (
    <Stack spacing={2.25}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
          borderColor: alpha(THEME.red, 0.16),
          background:
            "linear-gradient(135deg, rgba(200,16,46,0.08) 0%, rgba(255,255,255,1) 52%, rgba(23,32,51,0.05) 100%)",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          gap={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
            <Avatar
              sx={{
                width: 54,
                height: 54,
                bgcolor: THEME.red,
                color: "white",
                fontWeight: 900,
              }}
            >
              {fullName(prospect).slice(0, 1)}
            </Avatar>
            <Box minWidth={0}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0 }}>
                Dossier d&apos;engagement
              </Typography>
              <Typography variant="h5" fontWeight={900} noWrap>
                {fullName(prospect)}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {prospect?.title || "Fonction non renseignée"} · {companyName(prospect)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
            <Chip
              label={plan ? "Recommandation prête" : "Analyse à lancer"}
              sx={{
                bgcolor: plan ? alpha(THEME.success, 0.12) : alpha(THEME.warning, 0.12),
                color: plan ? THEME.success : THEME.warning,
                fontWeight: 800,
              }}
            />
            <Chip
              label={`Canal: ${primaryChannelLabel}`}
              sx={{ bgcolor: THEME.softSurface, fontWeight: 800 }}
            />
            <Chip
              label={`Confiance: ${confidence.percent}%`}
              sx={{ bgcolor: THEME.softSurface, fontWeight: 800 }}
            />
          </Stack>
        </Stack>
      </Paper>

      {loading && (
        <Alert severity="info" icon={<CircularProgress size={18} />}>
          {loading}
        </Alert>
      )}
      <PolicyAlert policy={policy} />
      {manualReviewRequired && (
        <Alert severity="warning">
          <Typography variant="body2" fontWeight={800}>
            Une vérification humaine est nécessaire.
          </Typography>
          {currentResult.manual_review_reason && (
            <Typography variant="body2">{currentResult.manual_review_reason}</Typography>
          )}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Stack spacing={2}>
            {!initialResult && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  borderColor: alpha(THEME.red, 0.16),
                  bgcolor: THEME.surface,
                }}
              >
                <Typography variant="h6" fontWeight={900} mb={0.75}>
                  Prochaine meilleure action
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  L&apos;agent analyse le profil, choisit le canal le plus pertinent et prépare un
                  message ou un script à valider.
                </Typography>
                <Button
                  startIcon={<AutoFixHigh />}
                  variant="contained"
                  disabled={Boolean(loading)}
                  onClick={runInitial}
                  sx={{
                    bgcolor: THEME.red,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 800,
                    "&:hover": { bgcolor: THEME.redDeep },
                  }}
                >
                  {"Lancer l'agent d'engagement"}
                </Button>
              </Paper>
            )}
            {plan && (
              <StrategyCard
                title={continuedPlan ? "Nouvelle stratégie recommandée" : "Stratégie recommandée"}
                plan={plan}
              />
            )}
            {initialResult && (
              <GeneratedContentCard
                content={content}
                plan={plan}
                prospect={prospect}
                disabled={Boolean(loading) || policy?.allowed === false || manualReviewRequired}
                onToast={onToast}
                onActionDone={(defaults) => openInteractionForm(defaults)}
              />
            )}
          </Stack>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Stack spacing={2}>
            <SectionCard title="Contexte utile">
              <Stack spacing={1.25}>
                <ValueLine label="Entreprise" value={companyName(prospect)} />
                <ValueLine label="Poste" value={prospect?.title} />
                <ValueLine
                  label="Canaux disponibles"
                  value={
                    contactChannels.length
                      ? contactChannels.map((channel) => channel.label).join(", ")
                      : "Aucun canal renseigné"
                  }
                />
                {plan && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>
                      Niveau de confiance
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LinearProgress
                        variant="determinate"
                        value={confidence.percent}
                        sx={{
                          flex: 1,
                          height: 8,
                          borderRadius: 99,
                          bgcolor: "#EEF2F7",
                          "& .MuiLinearProgress-bar": { bgcolor: THEME.red, borderRadius: 99 },
                        }}
                      />
                      <Typography variant="body2" fontWeight={900}>
                        {confidence.label}
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </SectionCard>

            <SectionCard title="Progression">
              <Stack spacing={1}>
                {progressSteps.map(([label, done], index) => (
                  <Stack key={label} direction="row" spacing={1.25} alignItems="center">
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: 13,
                        bgcolor: done ? alpha(THEME.red, 0.12) : "#EEF2F7",
                        color: done ? THEME.red : THEME.muted,
                        fontWeight: 900,
                      }}
                    >
                      {done ? <TaskAlt sx={{ fontSize: 16 }} /> : index + 1}
                    </Avatar>
                    <Typography
                      variant="body2"
                      fontWeight={done ? 900 : 600}
                      color={done ? "text.primary" : "text.secondary"}
                    >
                      {label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      {initialPlan && continuedPlan && (
        <SectionCard title="L'agent adapte sa recommandation">
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Précédemment
              </Typography>
              <Typography variant="body2" fontWeight={800}>
                {labelFromEnum(initialPlan.strategy, STRATEGY_LABELS)} sur{" "}
                {labelFromEnum(initialPlan.primary_channel, CHANNEL_LABELS)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary">
                Nouvelle recommandation
              </Typography>
              <Typography variant="body2" fontWeight={800}>
                {labelFromEnum(continuedPlan.strategy, STRATEGY_LABELS)} sur{" "}
                {labelFromEnum(continuedPlan.primary_channel, CHANNEL_LABELS)}
              </Typography>
            </Grid>
          </Grid>
        </SectionCard>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
        <Button
          startIcon={<TaskAlt />}
          disabled={!plan || Boolean(loading) || policy?.allowed === false || manualReviewRequired}
          onClick={() =>
            openInteractionForm({
              channel: channelApiToUi(plan?.primary_channel),
              action_type: actionForChannel(plan?.primary_channel),
              outcome: "SENT",
            })
          }
          sx={{ color: THEME.red }}
        >
          Enregistrer le résultat
        </Button>
        <Button
          startIcon={<AutoFixHigh />}
          disabled={!selectedInteraction?.id || Boolean(loading)}
          onClick={continueEngagement}
          sx={{ color: THEME.red }}
        >
          {"Analyser et adapter la recommandation"}
        </Button>
      </Stack>

      {(analysis || memory) && (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={6}>
            <ResponseAnalysisCard analysis={analysis} />
          </Grid>
          <Grid item xs={12} lg={6}>
            <EngagementMemoryCard memory={memory} />
          </Grid>
        </Grid>
      )}

      {interactions.length > 0 && (
        <SectionCard title="Historique récent">
          <Stack spacing={1}>
            {interactions
              .slice()
              .reverse()
              .map((item) => (
                <Paper
                  key={item.id}
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    cursor: "pointer",
                    borderColor: selectedInteraction?.id === item.id ? THEME.red : THEME.border,
                  }}
                  onClick={() => setSelectedInteraction(item)}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800}>
                        {labelFromEnum(item.channel, CHANNEL_LABELS)} ·{" "}
                        {labelFromEnum(item.action_type, ACTION_TYPE_LABELS)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Résultat : {labelFromEnum(item.outcome, OUTCOME_LABELS)}
                      </Typography>
                    </Box>
                    {selectedInteraction?.id === item.id && (
                      <Chip size="small" label="Sélectionnée" sx={{ borderRadius: 1 }} />
                    )}
                  </Stack>
                  {item.prospect_response && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.prospect_response}
                    </Typography>
                  )}
                </Paper>
              ))}
          </Stack>
        </SectionCard>
      )}
      <InteractionForm
        open={interactionFormOpen}
        initialValues={interactionDefaults}
        saving={loading === "Enregistrement de l'interaction..."}
        options={formOptions}
        onClose={() => setInteractionFormOpen(false)}
        onSubmit={submitInteraction}
      />
    </Stack>
  );
}

SectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  action: PropTypes.node,
};

SectionCard.defaultProps = { children: null, action: null };
TextBlock.propTypes = { children: PropTypes.node };
TextBlock.defaultProps = { children: null };
ValueLine.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node };
ValueLine.defaultProps = { value: "" };

StrategyCard.propTypes = {
  title: PropTypes.string.isRequired,
  plan: PropTypes.object,
};
StrategyCard.defaultProps = { plan: null };

PolicyAlert.propTypes = { policy: PropTypes.object };
PolicyAlert.defaultProps = { policy: null };

GeneratedContentCard.propTypes = {
  content: PropTypes.object,
  plan: PropTypes.object,
  prospect: PropTypes.object.isRequired,
  onToast: PropTypes.func,
  onActionDone: PropTypes.func,
  disabled: PropTypes.bool,
};
GeneratedContentCard.defaultProps = {
  content: null,
  plan: null,
  onToast: null,
  onActionDone: null,
  disabled: false,
};

InteractionForm.propTypes = {
  open: PropTypes.bool.isRequired,
  initialValues: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  options: PropTypes.shape({
    channels: PropTypes.array,
    actionTypes: PropTypes.array,
    outcomes: PropTypes.array,
  }),
};
InteractionForm.defaultProps = {
  initialValues: {},
  saving: false,
  options: { channels: [], actionTypes: [], outcomes: [] },
};

ResponseAnalysisCard.propTypes = { analysis: PropTypes.object };
ResponseAnalysisCard.defaultProps = { analysis: null };
EngagementMemoryCard.propTypes = { memory: PropTypes.object };
EngagementMemoryCard.defaultProps = { memory: null };

AgentEngagementCockpit.propTypes = {
  prospect: PropTypes.object.isRequired,
  onToast: PropTypes.func,
  onConversationChanged: PropTypes.func,
};
AgentEngagementCockpit.defaultProps = {
  onToast: null,
  onConversationChanged: null,
};
