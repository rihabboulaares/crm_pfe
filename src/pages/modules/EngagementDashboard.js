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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoFixHigh,
  Close,
  Email,
  ErrorOutline,
  Facebook,
  History,
  Instagram,
  LinkedIn,
  MarkEmailRead,
  PendingActions,
  Refresh,
  Save,
  Send,
  TaskAlt,
} from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import {
  createFollowUpTask,
  completeCrmTask,
  getEngagementDashboard,
  getEngagementLogs,
  getEngagementProspects,
  getProspectTasks,
  markEngagementReplied,
  openFacebookSession,
  prepareEngagementMessage,
  saveEngagementMessage,
  sendEngagementMessage,
  startSocialLogin,
  checkSocialSession,
  analyzeSocialProfile,
} from "../../services/engagementApi";

const AGENT_THEME = {
  red: "#C8102E",
  redDeep: "#9B0D22",
  redSoft: "#FDEEF1",
  redBorder: "#F5C6CE",
  text: "#111827",
};

const STATUS_META = {
  new: { label: "Nouveau", color: "#6b7280" },
  preparing: { label: "Preparation", color: "#d97706" },
  message_ready: { label: "Message pret", color: "#059669" },
  sending: { label: "Envoi", color: "#2563eb" },
  message_sent: { label: "Envoye", color: "#1e40af" },
  message_failed: { label: "Erreur", color: "#dc2626" },
  replied: { label: "Reponse recue", color: "#7c3aed" },
  follow_up_required: { label: "Relance requise", color: "#ea580c" },
  closed: { label: "Termine", color: "#111827" },
};

const KANBAN = [
  { key: "new", label: "Nouveau" },
  { key: "message_ready", label: "Message pret" },
  { key: "message_sent", label: "Envoye" },
  { key: "replied", label: "Reponse recue" },
  { key: "follow_up_required", label: "Relance" },
  { key: "message_failed", label: "Erreur" },
];

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "new", label: "Nouveau" },
  { key: "message_ready", label: "Message pret" },
  { key: "message_sent", label: "Envoye" },
  { key: "message_failed", label: "Erreur" },
  { key: "replied", label: "Reponse recue" },
];

const emptyStats = {
  new: 0,
  to_prepare: 0,
  message_ready: 0,
  message_sent: 0,
  replied: 0,
  errors: 0,
};

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

function channelOptions(prospect) {
  return [
    { key: "linkedin", label: "LinkedIn", icon: <LinkedIn />, disabled: !prospect?.linkedin_url },
    { key: "email", label: "Email", icon: <Email />, disabled: !prospect?.email },
    { key: "facebook", label: "Facebook", icon: <Facebook />, disabled: !prospect?.facebook_url },
    { key: "instagram", label: "Instagram", icon: <Instagram />, disabled: !prospect?.instagram_url },
  ];
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

function AiTextBlock({ children }) {
  if (!children) return <Typography variant="body2" color="text.secondary">-</Typography>;
  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: "1px solid #fee2e2",
        borderRadius: 1,
        p: 1.5,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Box>
  );
}

function BadgeList({ items }) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) return <Typography variant="body2" color="text.secondary">-</Typography>;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
      {values.map((item) => (
        <Chip key={item} size="small" label={item} sx={{ borderRadius: 1, maxWidth: "100%" }} />
      ))}
    </Stack>
  );
}

function FieldLine({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Typography variant="body2" align="right" sx={{ wordBreak: "break-word", whiteSpace: "normal" }}>
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

AiTextBlock.propTypes = {
  children: PropTypes.node,
};

AiTextBlock.defaultProps = {
  children: null,
};

BadgeList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
};

BadgeList.defaultProps = {
  items: [],
};

FieldLine.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

FieldLine.defaultProps = {
  value: "",
};

function EngagementDashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [prospects, setProspects] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("");
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState(0);
  const [testMode, setTestMode] = useState(true);
  const [toast, setToast] = useState(null);
  const [linkedinModal, setLinkedinModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, prospectsRes] = await Promise.all([
        getEngagementDashboard(),
        getEngagementProspects({ status: filter, search }),
      ]);
      setStats(dashboardRes.data || emptyStats);
      setProspects(prospectsRes.data?.results || []);
    } catch (error) {
      setToast({ severity: "error", message: "Impossible de charger l'agent d'engagement." });
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openProspect = async (prospect) => {
    setSelected(prospect);
    setMessage(prospect.engagement_message || "");
    setChannel(prospect.engagement_channel || (prospect.linkedin_url ? "linkedin" : prospect.email ? "email" : ""));
    setTab(0);
    try {
      const res = await getEngagementLogs(prospect.id);
      setLogs(res.data?.results || []);
      const taskRes = await getProspectTasks(prospect.id);
      setTasks(Array.isArray(taskRes.data) ? taskRes.data : taskRes.data?.results || []);
    } catch (error) {
      setLogs([]);
      setTasks([]);
    }
  };

  const refreshSelected = async (updatedProspect) => {
    setSelected(updatedProspect);
    setMessage(updatedProspect.engagement_message || "");
    setChannel(updatedProspect.engagement_channel || channel);
    await load();
    const res = await getEngagementLogs(updatedProspect.id);
    setLogs(res.data?.results || []);
    const taskRes = await getProspectTasks(updatedProspect.id);
    setTasks(Array.isArray(taskRes.data) ? taskRes.data : taskRes.data?.results || []);
  };

  const runAction = async (name, fn, successText) => {
    if (!selected) return;
    setBusyAction(name);
    try {
      const res = await fn();
      if (res.data?.login_url) {
        setLinkedinModal(true);
        return;
      }
      if (res.data?.success === false) {
        const updatedProspect = res.data?.prospect || selected;
        if (res.data?.prospect) {
          await refreshSelected(updatedProspect);
        }
        setToast({
          severity:
            res.data?.status === "login_required" || res.data?.status === "checkpoint_required"
              ? "warning"
              : "error",
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

  const handleSocialLogin = async (platform) => {
    setBusyAction(`login-${platform}`);
    try {
      const res = platform === "facebook" ? await openFacebookSession() : await startSocialLogin(platform);
      setToast({
        severity: res.data?.success ? "success" : "info",
        message:
          res.data?.message ||
          (platform === "facebook"
            ? "Une fenetre Facebook vient de s'ouvrir. Connectez-vous puis relancez Preparer engagement."
            : "Une fenetre vient de s'ouvrir. Connectez-vous puis cliquez sur Verifier la session."),
      });
    } catch (error) {
      setToast({ severity: "error", message: error.response?.data?.error || "Connexion sociale impossible." });
    } finally {
      setBusyAction("");
    }
  };

  const handleSocialSessionCheck = async (platform) => {
    setBusyAction(`check-${platform}`);
    try {
      const res = await checkSocialSession(platform);
      setToast({
        severity: res.data?.success ? "success" : "warning",
        message: res.data?.success ? `Session ${platform} active.` : res.data?.message || "Session non connectee.",
      });
    } catch (error) {
      setToast({ severity: "error", message: error.response?.data?.error || "Verification impossible." });
    } finally {
      setBusyAction("");
    }
  };

  const groupedProspects = useMemo(() => {
    return KANBAN.reduce((acc, col) => {
      acc[col.key] = prospects.filter((prospect) => prospect.engagement_status === col.key);
      return acc;
    }, {});
  }, [prospects]);

  const statCards = [
    { title: "Nouveaux prospects", value: stats.new, icon: <PendingActions />, color: AGENT_THEME.red },
    { title: "Messages a preparer", value: stats.to_prepare, icon: <AutoFixHigh />, color: AGENT_THEME.red },
    { title: "Messages prets", value: stats.message_ready, icon: <TaskAlt />, color: AGENT_THEME.red },
    { title: "Messages envoyes", value: stats.message_sent, icon: <Send />, color: AGENT_THEME.red },
    { title: "Reponses recues", value: stats.replied, icon: <MarkEmailRead />, color: AGENT_THEME.red },
    { title: "Erreurs", value: stats.errors, icon: <ErrorOutline />, color: AGENT_THEME.red },
  ];

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: AGENT_THEME.redDeep }}>
              Agent Engagement IA
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preparation, validation humaine, envoi et suivi des messages commerciaux.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">Mode test</Typography>
            <Switch
              checked={testMode}
              onChange={(event) => setTestMode(event.target.checked)}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: AGENT_THEME.red },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  bgcolor: AGENT_THEME.red,
                },
              }}
            />
            <Tooltip title="Rafraichir">
              <IconButton onClick={load} disabled={loading}>
                {loading ? <CircularProgress size={20} /> : <Refresh />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Grid container spacing={2} mb={2}>
          {statCards.map((card) => (
            <Grid key={card.title} item xs={12} sm={6} md={4} lg={2}>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 1,
                  border: `1px solid ${alpha(AGENT_THEME.red, 0.18)}`,
                  boxShadow: `0 6px 18px ${alpha(AGENT_THEME.red, 0.08)}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {card.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ color: AGENT_THEME.red }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: AGENT_THEME.redSoft, color: AGENT_THEME.red }}>
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

        <Grid container spacing={2} alignItems="stretch" mb={2}>
          {KANBAN.map((col) => (
            <Grid item xs={12} md={6} lg={2} key={col.key}>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  minHeight: 260,
                  height: "100%",
                  borderTop: `3px solid ${AGENT_THEME.red}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" fontWeight={800}>
                    {col.label}
                  </Typography>
                  <Chip size="small" label={groupedProspects[col.key]?.length || 0} />
                </Stack>
                <Stack spacing={1}>
                  {(groupedProspects[col.key] || []).slice(0, 8).map((prospect) => (
                    <Card
                      key={prospect.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 1,
                        "&:hover": {
                          borderColor: AGENT_THEME.redBorder,
                          boxShadow: `0 4px 12px ${alpha(AGENT_THEME.red, 0.12)}`,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <Typography variant="body2" fontWeight={800} noWrap>
                          {getFullName(prospect)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {prospect.company_name || prospect.prospect_company_detail?.name || "Societe inconnue"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {prospect.title || "Poste non renseigne"}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" mt={1} mb={1}>
                          {statusChip(prospect.engagement_status)}
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" onClick={() => openProspect(prospect)} sx={{ minWidth: 0, color: AGENT_THEME.red }}>
                            Ouvrir
                          </Button>
                          <Button size="small" onClick={() => openProspect(prospect)} sx={{ minWidth: 0, color: AGENT_THEME.red }}>
                            Generer
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ borderRadius: 1, overflow: "hidden", border: `1px solid ${AGENT_THEME.redBorder}` }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telephone</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Canal recommande</TableCell>
                <TableCell>Statut engagement</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prospects.map((prospect) => (
                <TableRow key={prospect.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {getFullName(prospect)}
                    </Typography>
                  </TableCell>
                  <TableCell>{prospect.email || "-"}</TableCell>
                  <TableCell>{prospect.phone || prospect.mobile || "-"}</TableCell>
                  <TableCell>{prospect.status || "-"}</TableCell>
                  <TableCell>{prospect.source || prospect.origin || "-"}</TableCell>
                  <TableCell>{prospect.engagement_channel || prospect.last_engagement_channel || "-"}</TableCell>
                  <TableCell>
                    {statusChip(prospect.engagement_status)}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openProspect(prospect)} sx={{ color: AGENT_THEME.red }}>
                      Ouvrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </MDBox>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        PaperProps={{
          sx: {
            width: "min(720px, 95vw)",
            maxWidth: "95vw",
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
                  {selected.title || "Poste non renseigne"} - {selected.company_name || "Societe inconnue"}
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
                    <FieldLine label="Nom" value={selected.company_name || selected.prospect_company_detail?.name} />
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
                {tasks.length === 0 && <Alert severity="info">Aucune tache liee a ce prospect.</Alert>}
                {tasks.map((task) => (
                  <Paper key={task.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={800} sx={{ wordBreak: "break-word" }}>
                          {task.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.task_type} - {task.status}
                          {task.due_date ? ` - ${new Date(task.due_date).toLocaleDateString("fr-FR")}` : ""}
                        </Typography>
                      </Box>
                      {!["completed", "done", "cancelled"].includes(task.status) && (
                        <Button
                          size="small"
                          sx={{ color: AGENT_THEME.red }}
                          onClick={() =>
                            runAction(`task-${task.id}`, () => completeCrmTask(task.id), "Tache terminee.")
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
              <Stack spacing={1}>
                {logs.length === 0 && <Alert severity="info">Aucun historique pour ce prospect.</Alert>}
                {logs.map((log) => (
                  <Paper key={log.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={800}>
                        {log.action}
                      </Typography>
                      {statusChip(log.status)}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(log.created_at).toLocaleString("fr-FR")} - {log.channel || "canal non defini"}
                    </Typography>
                    {log.message && <AiTextBlock>{log.message}</AiTextBlock>}
                    {log.error && <Alert severity="error" sx={{ mt: 1 }}>{log.error}</Alert>}
                  </Paper>
                ))}
              </Stack>
            )}

            {tab === 3 && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {statusChip(selected.engagement_status)}
                  <Chip size="small" label={`Email: ${selected.email || "manquant"}`} />
                  <Chip size="small" label={`LinkedIn: ${selected.linkedin_url ? "ok" : "manquant"}`} />
                  <Chip size="small" label={`Facebook: ${selected.facebook_url ? "ok" : "manquant"}`} />
                  <Chip size="small" label={`Instagram: ${selected.instagram_url ? "ok" : "manquant"}`} />
                </Stack>
                <DetailCard title="Sessions sociales">
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
                    {[
                      { key: "linkedin", label: "Connecter LinkedIn", icon: <LinkedIn /> },
                      { key: "facebook", label: "Connecter Facebook", icon: <Facebook /> },
                      { key: "instagram", label: "Connecter Instagram", icon: <Instagram /> },
                    ].map((item) => (
                      <Stack key={item.key} direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={item.icon}
                          variant="outlined"
                          disabled={Boolean(busyAction)}
                          sx={{ color: AGENT_THEME.red, borderColor: AGENT_THEME.redBorder, textTransform: "none" }}
                          onClick={() => handleSocialLogin(item.key)}
                        >
                          {item.label}
                        </Button>
                        <Button
                          size="small"
                          disabled={Boolean(busyAction)}
                          sx={{ color: AGENT_THEME.red, textTransform: "none" }}
                          onClick={() => handleSocialSessionCheck(item.key)}
                        >
                          Verifier la session
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </DetailCard>
                <DetailCard title="Resume social IA">
                  <AiTextBlock>{selected.social_profile_summary}</AiTextBlock>
                </DetailCard>
                <DetailCard title="Description IA">
                  <AiTextBlock>{selected.social_profile_description}</AiTextBlock>
                </DetailCard>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <DetailCard title="Interets">
                      <BadgeList items={selected.social_profile_interests} />
                    </DetailCard>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <DetailCard title="Sujets recents">
                      <BadgeList items={selected.social_profile_topics} />
                    </DetailCard>
                  </Grid>
                </Grid>
                <DetailCard title="Signaux IA">
                  <Stack spacing={1}>
                    <FieldLine label="Activite" value={selected.social_profile_activity_level} />
                    <FieldLine label="Pertinence" value={selected.social_profile_relevance} />
                    <FieldLine label="Ton" value={selected.social_profile_tone} />
                  </Stack>
                </DetailCard>
                <DetailCard title="Accroche recommandee">
                  <AiTextBlock>{selected.social_profile_hook}</AiTextBlock>
                </DetailCard>
                <FormControl fullWidth size="small">
                  <InputLabel>Canal</InputLabel>
                  <Select label="Canal" value={channel} onChange={(event) => setChannel(event.target.value)}>
                    {channelOptions(selected).map((option) => (
                      <MenuItem key={option.key} value={option.key} disabled={option.disabled}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {option.icon}
                          <span>{option.label}</span>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Message prepare"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  fullWidth
                  multiline
                  minRows={8}
                />
                {selected.engagement_error && (
                  <Alert severity="error">{selected.engagement_error}</Alert>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    startIcon={<AutoFixHigh />}
                    variant="contained"
                    sx={{ bgcolor: AGENT_THEME.red, "&:hover": { bgcolor: AGENT_THEME.redDeep } }}
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      runAction("prepare", () => prepareEngagementMessage(selected.id), "Message IA genere.")
                    }
                  >
                    Generer message IA
                  </Button>
                  <Button
                    startIcon={<AutoFixHigh />}
                    disabled={Boolean(busyAction)}
                    sx={{ color: AGENT_THEME.red }}
                    onClick={() =>
                      runAction("regenerate", () => prepareEngagementMessage(selected.id), "Message regenere.")
                    }
                  >
                    Regenerer
                  </Button>
                  <Button
                    startIcon={<Refresh />}
                    disabled={Boolean(busyAction)}
                    sx={{ color: AGENT_THEME.red }}
                    onClick={() =>
                      runAction("analyze-social", () => analyzeSocialProfile(selected.id), "Analyse sociale relancee.")
                    }
                  >
                    Relancer analyse
                  </Button>
                  <Button
                    startIcon={<Save />}
                    disabled={Boolean(busyAction) || !message.trim() || !channel}
                    sx={{ color: AGENT_THEME.red }}
                    onClick={() =>
                      runAction(
                        "save",
                        () => saveEngagementMessage(selected.id, { message, channel }),
                        "Message sauvegarde."
                      )
                    }
                  >
                    Valider message
                  </Button>
                  <Button
                    startIcon={<Send />}
                    variant="contained"
                    disabled={Boolean(busyAction) || !message.trim() || !channel}
                    sx={{ bgcolor: AGENT_THEME.red, "&:hover": { bgcolor: AGENT_THEME.redDeep } }}
                    onClick={() =>
                      runAction(
                        "send",
                        () => sendEngagementMessage(selected.id, { message, channel, send: !testMode }),
                        testMode ? "Mode test: envoi prepare sans clic final." : "Message envoye."
                      )
                    }
                  >
                    Envoyer maintenant
                  </Button>
                  <Button
                    startIcon={<MarkEmailRead />}
                    sx={{ color: AGENT_THEME.red }}
                    onClick={() =>
                      runAction("replied", () => markEngagementReplied(selected.id), "Prospect marque comme repondu.")
                    }
                  >
                    Marquer repondu
                  </Button>
                  <Button
                    startIcon={<TaskAlt />}
                    sx={{ color: AGENT_THEME.red }}
                    onClick={() =>
                      runAction(
                        "followup",
                        () => createFollowUpTask(selected.id, { due_days: 3 }),
                        "Tache de relance creee."
                      )
                    }
                  >
                    Creer relance
                  </Button>
                </Stack>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" fontWeight={800} mb={1}>
                    Taches liees
                  </Typography>
                  <Stack spacing={1}>
                    {tasks.length === 0 && <Alert severity="info">Aucune tache liee a ce prospect.</Alert>}
                    {tasks.map((task) => (
                      <Paper key={task.id} variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={800} noWrap>
                              {task.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {task.task_type} - {task.status}
                              {task.due_date ? ` - ${new Date(task.due_date).toLocaleDateString("fr-FR")}` : ""}
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
                </Box>
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

      <Dialog open={linkedinModal} onClose={() => setLinkedinModal(false)}>
        <DialogTitle>Connexion LinkedIn requise</DialogTitle>
        <DialogContent>
          <Typography>
            {"La session LinkedIn doit etre connectee avant un envoi reel. Ouvrez la page de connexion, connectez-vous, puis relancez l'envoi."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkedinModal(false)} sx={{ color: AGENT_THEME.red }}>
            Fermer
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: AGENT_THEME.red, "&:hover": { bgcolor: AGENT_THEME.redDeep } }}
            onClick={() => window.open("/engagement/linkedin-login", "_blank")}
          >
            Connecter LinkedIn
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast && <Alert severity={toast.severity}>{toast.message}</Alert>}
      </Snackbar>
    </DashboardLayout>
  );
}

export default EngagementDashboard;
