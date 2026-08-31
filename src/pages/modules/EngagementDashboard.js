/* eslint-disable prettier/prettier */
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
  Divider,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoFixHigh,
  ChatBubbleOutline,
  Close,
  Email,
  History,
  MarkEmailRead,
  PendingActions,
  Person,
  Refresh,
  Send,
  SmartToy,
  TaskAlt,
} from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import PaginationBar from "../../components/PaginationBar";
import AgentEngagementCockpit from "../../components/engagementAgentV2/AgentEngagementCockpit";
import {
  createFollowUpTask,
  completeCrmTask,
  getEngagementDashboard,
  getEngagementLogs,
  getEngagementProspects,
  getProspectTasks,
  connectGoogleEmail,
  disconnectEmail,
  getEmailConnections,
  testEmailConnection,
} from "../../services/engagementApi";

const AGENT_THEME = {
  red: "#C8102E",
  redDeep: "#9B0D22",
  redSoft: "#FDEEF1",
  redBorder: "#F5C6CE",
  ink: "#172033",
  slate: "#475569",
  surface: "#FFFFFF",
  text: "#111827",
};

const STATUS_META = {
  new: { label: "Nouveau", color: "#6b7280" },
  preparing: { label: "Préparation", color: "#d97706" },
  pending_validation: { label: "À valider", color: "#059669" },
  message_ready: { label: "Message prêt", color: "#059669" },
  sending: { label: "Envoi", color: "#2563eb" },
  message_sent: { label: "Envoyé", color: "#1e40af" },
  waiting_reply: { label: "En attente de réponse", color: "#1e40af" },
  reply_detected: { label: "Réponse détectée", color: "#7c3aed" },
  followup_generated: { label: "Relance générée", color: "#ea580c" },
  opportunity_ready: { label: "Opportunité prête", color: "#059669" },
  message_failed: { label: "À vérifier", color: "#dc2626" },
  replied: { label: "Réponse reçue", color: "#7c3aed" },
  follow_up_required: { label: "Relance requise", color: "#ea580c" },
  closed: { label: "Terminé", color: "#111827" },
  rejected: { label: "Refusé", color: "#991b1b" },
};

const KANBAN = [
  { key: "new", label: "Nouveau" },
  { key: "pending_validation", label: "À valider" },
  { key: "message_sent", label: "Envoyé" },
  { key: "waiting_reply", label: "En attente" },
  { key: "reply_detected", label: "Réponse analysée" },
  { key: "replied", label: "Réponse reçue" },
  { key: "followup_generated", label: "Relance proposée" },
  { key: "follow_up_required", label: "Relance" },
  { key: "opportunity_ready", label: "Opportunité" },
  { key: "message_failed", label: "À vérifier" },
];

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "new", label: "Nouveau" },
  { key: "pending_validation", label: "À valider" },
  { key: "message_sent", label: "Envoyé" },
  { key: "reply_detected", label: "Réponse détectée" },
  { key: "followup_generated", label: "Relance générée" },
  { key: "opportunity_ready", label: "Opportunité prête" },
  { key: "message_failed", label: "À vérifier" },
  { key: "replied", label: "Réponse reçue" },
];

const emptyStats = {
  new: 0,
  to_prepare: 0,
  pending_validation: 0,
  to_validate: 0,
  message_ready: 0,
  message_sent: 0,
  replied: 0,
  errors: 0,
};

const CHANNEL_LABELS = {
  email: "Email",
  phone: "Téléphone",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  other: "Autre",
  EMAIL: "Email",
  PHONE: "Téléphone",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  OTHER: "Autre",
};

const ACTION_LABELS = {
  agent_launched: "Agent lancé",
  message_generated: "Message préparé",
  message_updated: "Message modifié",
  message_sent: "Message envoyé",
  send_error: "Erreur d'envoi",
  message_rejected: "Message rejeté",
  replied: "Réponse reçue",
  follow_up_created: "Relance créée",
  campaign_created: "Campagne créée",
  EMAIL_SENT: "Email envoyé",
  PHONE_CALL: "Appel effectué",
  SOCIAL_MESSAGE_SENT: "Message social envoyé",
  FOLLOW_UP: "Relance",
  OTHER: "Autre",
  LAST_MESSAGE_SENT: "Dernier message envoyé",
  LAST_REPLY: "Dernière réponse",
};

const OUTCOME_LABELS = {
  SENT: "Envoyé",
  NO_RESPONSE: "Pas de réponse",
  INTERESTED: "Intéressé",
  NOT_INTERESTED: "Pas intéressé",
  CALL_LATER: "À rappeler",
  OBJECTION: "Objection",
  REQUEST_INFORMATION: "Demande d'information",
  MEETING_REQUEST: "Demande de rendez-vous",
  WRONG_CONTACT: "Mauvais contact",
  UNSUBSCRIBE: "Ne plus contacter",
  OTHER: "Autre",
};

function humanLabel(value, labels = {}) {
  if (!value) return "";
  if (labels[value]) return labels[value];
  const normalized = String(value).replaceAll("_", " ").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusChip(status) {
  const meta = STATUS_META[status] || STATUS_META.new;
  return (
    <Chip
      size="small"
      label={meta.label}
      sx={{
        borderRadius: 1,
        bgcolor: alpha(meta.color, 0.1),
        color: meta.color,
        border: `1px solid ${alpha(meta.color, 0.25)}`,
        fontWeight: 700,
      }}
    />
  );
}

function getFullName(prospect) {
  return `${prospect?.first_name || ""} ${prospect?.last_name || ""}`.trim();
}

function DetailCard({ title, children }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 1, borderColor: AGENT_THEME.redBorder }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="subtitle2" fontWeight={800} mb={1}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldLine({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        align="right"
        sx={{ wordBreak: "break-word", whiteSpace: "normal" }}
      >
        {value || "-"}
      </Typography>
    </Stack>
  );
}

DetailCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

DetailCard.defaultProps = {
  children: null,
};

FieldLine.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

FieldLine.defaultProps = {
  value: "",
};

function fallbackConversationFromLogs(items) {
  return (items || []).map((log) => ({
    id: `log-${log.id}`,
    actor:
      log.action === "replied"
        ? "prospect"
        : log.action === "message_generated" || log.action === "agent_launched"
        ? "agent"
        : "commercial",
    action: log.action,
    channel: log.channel,
    status: log.status,
    text: log.message || log.error || log.error_message || "",
    sender_email: log.sender_email,
    provider: log.provider,
    created_at: log.sent_at || log.created_at,
  }));
}

function ConversationBubble({ item, prospect }) {
  const isProspect = item.actor === "prospect";
  const isAgent = item.actor === "agent";
  const align = isProspect ? "flex-start" : isAgent ? "center" : "flex-end";
  const name = isProspect
    ? getFullName(prospect) || "Prospect"
    : isAgent
    ? "Agent IA"
    : "Commercial";
  const channel = humanLabel(item.channel, CHANNEL_LABELS);
  const action = humanLabel(item.action, ACTION_LABELS);
  const outcome = humanLabel(item.outcome || item.status, OUTCOME_LABELS) || item.status;

  return (
    <Stack direction="row" justifyContent={align} sx={{ width: "100%" }}>
      <Box
        sx={{
          maxWidth: isAgent ? "82%" : "72%",
          minWidth: { xs: "100%", sm: 280 },
          display: "flex",
          flexDirection: isProspect ? "row" : "row-reverse",
          gap: 1,
          alignItems: "flex-start",
          ...(isAgent && { flexDirection: "row", mx: "auto" }),
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: isProspect
              ? alpha("#2563eb", 0.12)
              : isAgent
              ? alpha(AGENT_THEME.red, 0.1)
              : AGENT_THEME.red,
            color: isProspect ? "#2563eb" : isAgent ? AGENT_THEME.red : "white",
          }}
        >
          {isAgent ? (
            <SmartToy fontSize="small" />
          ) : isProspect ? (
            <Person fontSize="small" />
          ) : (
            <Send fontSize="small" />
          )}
        </Avatar>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: isProspect ? "#eff6ff" : isAgent ? "#f8fafc" : AGENT_THEME.redSoft,
            border: `1px solid ${
              isProspect ? alpha("#2563eb", 0.16) : isAgent ? "#e2e8f0" : AGENT_THEME.redBorder
            }`,
            flex: 1,
          }}
        >
          <Stack direction="row" justifyContent="space-between" gap={1} mb={0.75}>
            <Typography
              variant="caption"
              fontWeight={900}
              color={isProspect ? "#1d4ed8" : AGENT_THEME.red}
            >
              {name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(item.created_at)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75, mb: 1 }}>
            {action && (
              <Chip size="small" label={action} sx={{ borderRadius: 1, fontWeight: 800 }} />
            )}
            {channel && (
              <Chip size="small" label={channel} variant="outlined" sx={{ borderRadius: 1 }} />
            )}
            {outcome && (
              <Chip size="small" label={outcome} variant="outlined" sx={{ borderRadius: 1 }} />
            )}
          </Stack>
          {item.text ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {item.text}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Activité enregistrée sans contenu textuel.
            </Typography>
          )}
          {item.summary && (
            <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
              {item.summary}
            </Alert>
          )}
          {(item.sender_email || item.provider || item.created_by_name) && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              {[item.created_by_name, item.sender_email, item.provider].filter(Boolean).join(" · ")}
            </Typography>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}

function ConversationPanel({ conversation, logs, prospect }) {
  const items = (conversation?.length ? conversation : fallbackConversationFromLogs(logs)).filter(
    (item) => item.text || item.action || item.status
  );

  if (!items.length) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: "#f8fafc",
          borderColor: "#e2e8f0",
          textAlign: "center",
        }}
      >
        <Avatar sx={{ mx: "auto", mb: 1, bgcolor: AGENT_THEME.redSoft, color: AGENT_THEME.red }}>
          <ChatBubbleOutline />
        </Avatar>
        <Typography variant="subtitle1" fontWeight={900}>
          Aucune discussion enregistrée.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quand un message est envoyé ou qu&apos;une réponse est saisie, elle apparaîtra ici sous
          forme de conversation.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.25, md: 2 },
        borderRadius: 3,
        bgcolor: "#ffffff",
        borderColor: "#e2e8f0",
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={900}>
            Discussion avec le prospect
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Messages envoyés, réponses reçues et notes d&apos;engagement enregistrés dans le CRM.
          </Typography>
        </Box>
        <Divider />
        {items.map((item) => (
          <ConversationBubble
            key={item.id || `${item.action}-${item.created_at}`}
            item={item}
            prospect={prospect}
          />
        ))}
      </Stack>
    </Paper>
  );
}

ConversationBubble.propTypes = {
  item: PropTypes.object.isRequired,
  prospect: PropTypes.object.isRequired,
};

ConversationPanel.propTypes = {
  conversation: PropTypes.arrayOf(PropTypes.object),
  logs: PropTypes.arrayOf(PropTypes.object),
  prospect: PropTypes.object.isRequired,
};

ConversationPanel.defaultProps = {
  conversation: [],
  logs: [],
};

function EngagementDashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [prospects, setProspects] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState(null);
  const [emailConnection, setEmailConnection] = useState({ connected: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, prospectsRes, emailRes] = await Promise.all([
        getEngagementDashboard(),
        getEngagementProspects({ status: filter, search, page, page_size: pageSize }),
        getEmailConnections(),
      ]);
      setStats(dashboardRes.data || emptyStats);
      setEmailConnection(
        emailRes.data?.active || dashboardRes.data?.email_connection || { connected: false }
      );
      setProspects(prospectsRes.data?.results || []);
      setTotal(prospectsRes.data?.total ?? prospectsRes.data?.count ?? 0);
      setPages(prospectsRes.data?.pages || 1);
      if (prospectsRes.data?.page && prospectsRes.data.page !== page) {
        setPage(prospectsRes.data.page);
      }
    } catch (error) {
      setToast({
        severity: "warning",
        message: "L'espace d'engagement n'a pas pu être chargé. Réessayez dans quelques instants.",
      });
    } finally {
      setLoading(false);
    }
  }, [filter, search, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const loadProspectEngagementDetails = useCallback(async (prospectId) => {
    const [logsRes, taskRes] = await Promise.all([
      getEngagementLogs(prospectId),
      getProspectTasks(prospectId),
    ]);
    setLogs(logsRes.data?.results || []);
    setConversation(logsRes.data?.conversation || []);
    setTasks(Array.isArray(taskRes.data) ? taskRes.data : taskRes.data?.results || []);
    if (logsRes.data?.prospect) {
      setSelected((current) =>
        current?.id === logsRes.data.prospect.id
          ? { ...current, ...logsRes.data.prospect }
          : current
      );
    }
  }, []);

  const openProspect = async (prospect) => {
    setSelected(prospect);
    setTab(0);
    setLogs([]);
    setConversation([]);
    setTasks([]);
    try {
      await loadProspectEngagementDetails(prospect.id);
    } catch (error) {
      setLogs([]);
      setConversation([]);
      setTasks([]);
    }
  };

  const refreshSelected = async (updatedProspect) => {
    setSelected(updatedProspect);
    await load();
    await loadProspectEngagementDetails(updatedProspect.id);
  };

  const syncUpdatedProspect = async (updatedProspect) => {
    if (!updatedProspect?.id) {
      await load();
      return;
    }
    setProspects((items) =>
      items.map((item) => (item.id === updatedProspect.id ? { ...item, ...updatedProspect } : item))
    );
    if (selected?.id === updatedProspect.id) {
      await refreshSelected(updatedProspect);
      return;
    }
    await load();
  };

  const runAction = async (name, fn, successText) => {
    if (!selected) return;
    setBusyAction(name);
    try {
      const res = await fn();
      if (res.data?.success === false) {
        const updatedProspect = res.data?.prospect || selected;
        if (res.data?.prospect) {
          await refreshSelected(updatedProspect);
        }
        setToast({
          severity: res.data?.status === "unsupported_channel" ? "warning" : "error",
          message: res.data?.message || res.data?.error || "Action impossible.",
        });
        return;
      }
      const updatedProspect = res.data?.prospect || selected;
      await refreshSelected(updatedProspect);
      setToast({ severity: "success", message: successText });
    } catch (error) {
      setToast({ severity: "error", message: error.response?.data?.error || "Action impossible." });
    } finally {
      setBusyAction("");
    }
  };

  const refreshEmailConnection = async () => {
    const res = await getEmailConnections();
    setEmailConnection(res.data?.active || { connected: false });
  };

  const handleEmailConnect = async () => {
    setBusyAction("email-gmail");
    try {
      const res = await connectGoogleEmail();
      if (res.data?.authorization_url) {
        window.open(res.data.authorization_url, "_blank", "noopener,noreferrer");
      }
      setToast({
        severity: "info",
        message: "Terminez la connexion email dans la fenêtre ouverte, puis testez la connexion.",
      });
    } catch (error) {
      const missing = error.response?.data?.missing;
      setToast({
        severity: "warning",
        message:
          Array.isArray(missing) && missing.length
            ? "La connexion email nécessite une configuration complémentaire."
            : "Connexion email indisponible pour le moment.",
      });
    } finally {
      setBusyAction("");
    }
  };

  const handleEmailTest = async () => {
    setBusyAction("email-test");
    try {
      const res = await testEmailConnection();
      setEmailConnection(res.data?.connection || { connected: false });
      setToast({ severity: "success", message: "Connexion email verifiee." });
    } catch (error) {
      setEmailConnection({ connected: false });
      setToast({
        severity: "warning",
        message: "Connexion email requise ou expirée.",
      });
    } finally {
      setBusyAction("");
    }
  };

  const handleEmailDisconnect = async () => {
    setBusyAction("email-disconnect");
    try {
      await disconnectEmail(emailConnection.provider);
      await refreshEmailConnection();
      setToast({ severity: "success", message: "Connexion email deconnectee." });
    } catch (error) {
      setToast({ severity: "error", message: "Deconnexion email impossible." });
    } finally {
      setBusyAction("");
    }
  };

  const workflowStats = useMemo(
    () =>
      KANBAN.map((step) => ({
        ...step,
        count: prospects.filter((prospect) => prospect.engagement_status === step.key).length,
      })),
    [prospects]
  );

  const statCards = [
    {
      title: "À engager",
      value: stats.new,
      icon: <PendingActions />,
      color: AGENT_THEME.red,
    },
    {
      title: "Actions prêtes",
      value: stats.to_prepare,
      icon: <AutoFixHigh />,
      color: AGENT_THEME.red,
    },
    {
      title: "À valider",
      value: stats.to_validate || stats.pending_validation || stats.message_ready,
      icon: <TaskAlt />,
      color: AGENT_THEME.red,
    },
    {
      title: "Messages envoyés",
      value: stats.message_sent,
      icon: <Send />,
      color: AGENT_THEME.red,
    },
    {
      title: "Réponses reçues",
      value: stats.replied,
      icon: <MarkEmailRead />,
      color: AGENT_THEME.red,
    },
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Paper
          sx={{
            p: { xs: 2, md: 2.5 },
            mb: 2,
            borderRadius: 3,
            color: "white",
            background: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 48%, #172033 100%)",
            boxShadow: "0 18px 44px rgba(127, 29, 29, 0.22)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            gap={2}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.75}>
                <AutoFixHigh fontSize="small" />
                <Typography variant="overline" sx={{ opacity: 0.78, letterSpacing: 0 }}>
                  Cockpit commercial
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={900}>
                {"Agent d'engagement IA"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.82, maxWidth: 720, mt: 0.5 }}>
                Priorise les prospects, prépare la prochaine action et garde l&apos;humain au centre
                de la validation.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={emailConnection.connected ? "Email prêt" : "Email à connecter"}
                sx={{
                  color: "white",
                  bgcolor: emailConnection.connected
                    ? "rgba(34,197,94,0.22)"
                    : "rgba(255,255,255,0.16)",
                  fontWeight: 800,
                }}
              />
              <Tooltip title="Rafraîchir">
                <IconButton
                  onClick={load}
                  disabled={loading}
                  sx={{ color: "white", bgcolor: "rgba(255,255,255,0.12)" }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : <Refresh />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(AGENT_THEME.red, 0.12)}`,
            boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Email fontSize="small" sx={{ color: AGENT_THEME.red }} />
                <Typography variant="subtitle2" fontWeight={900}>
                  Canal email
                </Typography>
                <Chip
                  size="small"
                  label={emailConnection.connected ? "Connecté" : "À connecter"}
                  color={emailConnection.connected ? "success" : "warning"}
                  variant="outlined"
                  sx={{ fontWeight: 800 }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {emailConnection.connected
                  ? `${emailConnection.display_name || "Compte email"} - ${
                      emailConnection.email
                    } (${emailConnection.provider})`
                  : "Connecte Gmail pour envoyer les messages préparés par l'agent."}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={Boolean(busyAction)}
                onClick={handleEmailConnect}
                sx={{ textTransform: "none" }}
              >
                Connecter Gmail
              </Button>
              <Button
                size="small"
                disabled={Boolean(busyAction)}
                onClick={handleEmailTest}
                sx={{ color: AGENT_THEME.red, textTransform: "none" }}
              >
                Tester
              </Button>
              {emailConnection.connected && (
                <Button
                  size="small"
                  disabled={Boolean(busyAction)}
                  onClick={handleEmailDisconnect}
                  sx={{ color: AGENT_THEME.red, textTransform: "none" }}
                >
                  Déconnecter
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2} mb={2}>
          {statCards.map((card) => (
            <Grid key={card.title} item xs={12} sm={6} lg={3}>
              <Paper
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  border: `1px solid ${alpha(card.color, 0.14)}`,
                  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
                  bgcolor: "white",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {card.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={900} sx={{ color: AGENT_THEME.ink }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(card.color, 0.1), color: card.color }}>
                    {card.icon}
                  </Avatar>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 2, mb: 2, borderRadius: 1, border: `1px solid ${AGENT_THEME.redBorder}` }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Rechercher"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                {FILTERS.map((item) => (
                  <Button
                    key={item.key}
                    size="small"
                    variant={filter === item.key ? "contained" : "outlined"}
                    onClick={() => setFilter(item.key)}
                    sx={{
                      borderRadius: 1,
                      textTransform: "none",
                      mb: 1,
                      ...(filter === item.key
                        ? {
                            bgcolor: AGENT_THEME.red,
                            "&:hover": { bgcolor: AGENT_THEME.redDeep },
                          }
                        : {
                            color: AGENT_THEME.red,
                            borderColor: AGENT_THEME.redBorder,
                            "&:hover": {
                              borderColor: AGENT_THEME.red,
                              bgcolor: AGENT_THEME.redSoft,
                            },
                          }),
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Paper
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(AGENT_THEME.red, 0.12)}`,
            boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
          }}
        >
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} alignItems="stretch">
            {workflowStats.map((step, index) => (
              <Box
                key={step.key}
                sx={{
                  flex: 1,
                  minWidth: 120,
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: step.count ? alpha(AGENT_THEME.red, 0.05) : "#f8fafc",
                  border: `1px solid ${
                    step.count ? alpha(AGENT_THEME.red, 0.18) : "rgba(148,163,184,0.18)"
                  }`,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      fontSize: 13,
                      bgcolor: step.count ? AGENT_THEME.red : "#e2e8f0",
                      color: step.count ? "white" : AGENT_THEME.slate,
                    }}
                  >
                    {index + 1}
                  </Avatar>
                  <Box minWidth={0}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {step.label}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={900}>
                      {step.count}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(AGENT_THEME.red, 0.12)}`,
            boxShadow: "0 14px 36px rgba(15,23,42,0.06)",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                File d&apos;engagement
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Une seule liste priorisée pour préparer, valider et suivre les actions.
              </Typography>
            </Box>
            <Chip size="small" label={`${total} prospect(s)`} sx={{ fontWeight: 800 }} />
          </Stack>

          {prospects.length === 0 ? (
            <Alert severity="info">Aucun prospect d&apos;engagement trouvé.</Alert>
          ) : (
            <Stack spacing={1.25}>
              {prospects.map((prospect) => (
                <Paper
                  key={prospect.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    borderColor: alpha(AGENT_THEME.red, 0.12),
                    bgcolor: "white",
                    "&:hover": {
                      borderColor: alpha(AGENT_THEME.red, 0.34),
                      boxShadow: "0 10px 28px rgba(15,23,42,0.08)",
                    },
                  }}
                >
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar sx={{ bgcolor: AGENT_THEME.redSoft, color: AGENT_THEME.red }}>
                          {getFullName(prospect).slice(0, 1) || "P"}
                        </Avatar>
                        <Box minWidth={0}>
                          <Typography variant="body2" fontWeight={900} noWrap>
                            {getFullName(prospect)}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            noWrap
                          >
                            {prospect.title || "Poste non renseigné"}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Société
                      </Typography>
                      <Typography variant="body2" fontWeight={800} noWrap>
                        {prospect.company_name ||
                          prospect.prospect_company_detail?.name ||
                          "Société inconnue"}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <Typography variant="caption" color="text.secondary">
                        Canal
                      </Typography>
                      <Typography variant="body2" fontWeight={800}>
                        {prospect.engagement_channel || prospect.last_engagement_channel || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={2}>
                      {statusChip(prospect.engagement_status)}
                    </Grid>
                    <Grid item xs={12} md={1} textAlign={{ xs: "left", md: "right" }}>
                      <Button
                        size="small"
                        onClick={() => openProspect(prospect)}
                        sx={{ color: AGENT_THEME.red, fontWeight: 900 }}
                      >
                        Ouvrir
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Stack>
          )}
          <PaginationBar
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            loading={loading}
          />
        </Paper>
      </MDBox>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        PaperProps={{
          sx: {
            width: "min(1100px, 92vw)",
            maxWidth: "92vw",
            p: 2,
            overflowY: "auto",
            overflowX: "hidden",
            wordBreak: "break-word",
            whiteSpace: "normal",
          },
        }}
      >
        {selected && (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  {getFullName(selected)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selected.title || "Poste non renseigne"} -{" "}
                  {selected.company_name || "Societe inconnue"}
                </Typography>
              </Box>
              <IconButton onClick={() => setSelected(null)}>
                <Close />
              </IconButton>
            </Stack>
            <Divider />
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              sx={{
                "& .MuiTab-root.Mui-selected": { color: AGENT_THEME.red },
                "& .MuiTabs-indicator": { bgcolor: AGENT_THEME.red },
              }}
            >
              <Tab label="Informations" />
              <Tab label="Taches & Appels" />
              <Tab icon={<History />} label="Activites" iconPosition="start" />
              <Tab label="Agent IA" />
            </Tabs>

            {tab === 0 && (
              <Stack spacing={2}>
                <DetailCard title="Presence en ligne">
                  <Stack spacing={1}>
                    <FieldLine label="LinkedIn" value={selected.linkedin_url} />
                    <FieldLine label="Facebook" value={selected.facebook_url} />
                    <FieldLine label="Instagram" value={selected.instagram_url} />
                  </Stack>
                </DetailCard>
                <DetailCard title="Coordonnees">
                  <Stack spacing={1}>
                    <FieldLine label="Email" value={selected.email} />
                    <FieldLine label="Telephone" value={selected.phone || selected.mobile} />
                    <FieldLine label="Poste" value={selected.title} />
                  </Stack>
                </DetailCard>
                <DetailCard title="Societe">
                  <Stack spacing={1}>
                    <FieldLine
                      label="Nom"
                      value={selected.company_name || selected.prospect_company_detail?.name}
                    />
                    <FieldLine label="Source" value={selected.source || selected.origin} />
                    <FieldLine label="URL source" value={selected.source_url} />
                  </Stack>
                </DetailCard>
              </Stack>
            )}

            {tab === 1 && (
              <Stack spacing={1}>
                <Button
                  startIcon={<TaskAlt />}
                  sx={{ color: AGENT_THEME.red, alignSelf: "flex-start" }}
                  onClick={() =>
                    runAction(
                      "followup",
                      () => createFollowUpTask(selected.id, { due_days: 3 }),
                      "Tache de relance creee."
                    )
                  }
                >
                  Planifier tache
                </Button>
                {tasks.length === 0 && (
                  <Alert severity="info">Aucune tache liee a ce prospect.</Alert>
                )}
                {tasks.map((task) => (
                  <Paper key={task.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{ wordBreak: "break-word" }}
                        >
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.task_type} - {task.status}
                          {task.due_date
                            ? ` - ${new Date(task.due_date).toLocaleDateString("fr-FR")}`
                            : ""}
                        </Typography>
                      </Box>
                      {!["completed", "done", "cancelled"].includes(task.status) && (
                        <Button
                          size="small"
                          sx={{ color: AGENT_THEME.red }}
                          onClick={() =>
                            runAction(
                              `task-${task.id}`,
                              () => completeCrmTask(task.id),
                              "Tache terminee."
                            )
                          }
                        >
                          Terminer
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            {tab === 2 && (
              <ConversationPanel conversation={conversation} logs={logs} prospect={selected} />
            )}
            {tab === 3 && (
              <Stack spacing={2}>
                <AgentEngagementCockpit
                  prospect={selected}
                  onConversationChanged={() => loadProspectEngagementDetails(selected.id)}
                  onToast={(toastMessage, severity = "success") =>
                    setToast({ severity, message: toastMessage })
                  }
                />
                {busyAction && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2">Action en cours...</Typography>
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Drawer>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast && <Alert severity={toast.severity}>{toast.message}</Alert>}
      </Snackbar>
    </DashboardLayout>
  );
}

export default EngagementDashboard;
