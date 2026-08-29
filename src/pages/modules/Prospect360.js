/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  AssignmentTurnedIn as ActionIcon,
  AutoFixHigh as AgentIcon,
  Business as BusinessIcon,
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  Email as EmailIcon,
  EventNote as ActivityIcon,
  Insights as ScoreIcon,
  Language as WebIcon,
  LinkedIn as LinkedInIcon,
  Phone as PhoneIcon,
  Timeline as TimelineIcon,
} from "@mui/icons-material";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import {
  getLatestProspectQualification,
  getProspectQualificationHistory,
  runProspectQualification,
} from "services/qualificationApi";

const CRM_RED = {
  main: "#C62828",
  dark: "#8B0000",
  soft: "#FFF1F2",
  border: "#FFCDD2",
  ink: "#211316",
  muted: "#786264",
};

const api = axios.create({ baseURL: "/api/sales" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const ACTIVITY_TYPES = [
  ["call_done", "Appel effectué"],
  ["email_sent", "Email envoyé"],
  ["message_sent", "Message envoyé"],
  ["reply_received", "Réponse reçue"],
  ["interested", "Prospect intéressé"],
  ["not_interested", "Prospect non intéressé"],
  ["info_requested", "Demande d'informations"],
  ["meeting_scheduled", "Réunion planifiée"],
  ["meeting_done", "Réunion réalisée"],
  ["follow_up", "Relance"],
  ["no_response", "Aucun retour"],
  ["commercial_note", "Note commerciale"],
  ["other", "Autre"],
];

const CHANNELS = [
  ["phone", "Téléphone"],
  ["email", "Email"],
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["meeting", "Réunion"],
  ["website", "Site web"],
  ["other", "Autre"],
];

const DOC_TYPES = [
  ["presentation", "Présentation"],
  ["quote", "Devis"],
  ["contract", "Contrat"],
  ["proposal", "Proposition commerciale"],
  ["specifications", "Cahier des charges"],
  ["report", "Rapport"],
  ["attachment", "Pièce jointe"],
  ["other", "Autre"],
];

const QUALIFICATION_STATUS_LABELS = {
  ENGAGE: "A engager",
  DEEPEN: "A approfondir",
  READY_FOR_OPPORTUNITY: "Pret pour une opportunite",
  NOT_QUALIFIED: "Non qualifie",
  ANALYSIS_INCOMPLETE: "Analyse incomplete",
};

const QUALIFICATION_ACTION_LABELS = {
  ENGAGE_PROSPECT: "Engager le prospect",
  DEEPEN_DISCOVERY: "Approfondir la decouverte",
  CREATE_OPPORTUNITY: "Creer une opportunite",
  DO_NOT_CONTACT: "Ne pas contacter",
  RETRY_QUALIFICATION: "Relancer la qualification",
};

const QUALIFICATION_MODE_LABELS = {
  INITIAL: "Initiale",
  POST_ENGAGEMENT: "Apres engagement",
};

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function EmptyState({ title }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 3, border: `1px dashed ${CRM_RED.border}`, borderRadius: 2, bgcolor: "#fff" }}
    >
      <Typography fontWeight={800} color="text.secondary">
        {title}
      </Typography>
    </Paper>
  );
}

function KpiCard({ label, value, sub, icon }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: 2, border: `1px solid ${CRM_RED.border}`, bgcolor: "#fff" }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center">
        <Avatar
          sx={{ bgcolor: alpha(CRM_RED.main, 0.1), color: CRM_RED.main, width: 36, height: 36 }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={900} lineHeight={1.1}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            {label}
          </Typography>
          {sub && (
            <Typography variant="caption" display="block" color="text.secondary" noWrap>
              {sub}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function Prospect360() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [agents, setAgents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [engagement, setEngagement] = useState([]);
  const [qualification, setQualification] = useState(null);
  const [qualificationHistory, setQualificationHistory] = useState([]);
  const [qualificationLoading, setQualificationLoading] = useState(false);
  const [qualificationError, setQualificationError] = useState("");
  const [activityForm, setActivityForm] = useState({
    activity_type: "commercial_note",
    channel: "other",
    title: "",
    description: "",
  });
  const [docForm, setDocForm] = useState({
    name: "",
    document_type: "attachment",
    description: "",
    file: null,
  });

  const prospect = data?.prospect;
  const summary = data?.summary || {};
  const company = prospect?.prospect_company_detail || {};
  const qualificationScore = qualification?.score ?? null;
  const displayedScore = qualificationScore ?? 0;

  const loadQualification = async () => {
    setQualificationError("");
    try {
      const [latest, history] = await Promise.allSettled([
        getLatestProspectQualification(id),
        getProspectQualificationHistory(id),
      ]);
      if (latest.status === "fulfilled") {
        setQualification(latest.value.data);
      } else if (latest.reason?.response?.status === 404) {
        setQualification(null);
      } else {
        throw latest.reason;
      }
      if (history.status === "fulfilled") {
        setQualificationHistory(history.value.data || []);
      } else {
        throw history.reason;
      }
    } catch (err) {
      setQualification(null);
      setQualificationHistory([]);
      setQualificationError(
        err.response?.data?.detail || "Impossible de charger la qualification IA."
      );
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [details, acts, docs, runs, recs, logs] = await Promise.all([
        api.get(`/prospects/${id}/details/`),
        api.get(`/prospects/${id}/activity-stream/`),
        api.get(`/prospects/${id}/documents/`),
        api.get(`/prospects/${id}/agent-runs/`),
        api.get(`/prospects/${id}/recommendations/`),
        api.get(`/prospects/${id}/engagement/`),
      ]);
      setData(details.data);
      setActivities(acts.data || []);
      setDocuments(docs.data || []);
      setAgents(runs.data || []);
      setRecommendations(recs.data || []);
      setEngagement(logs.data || []);
      await loadQualification();
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible de charger le dossier prospect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addActivity = async () => {
    if (!activityForm.title.trim()) return;
    await api.post(`/prospects/${id}/activity-stream/`, activityForm);
    setActivityForm({
      activity_type: "commercial_note",
      channel: "other",
      title: "",
      description: "",
    });
    await loadAll();
  };

  const uploadDocument = async () => {
    if (!docForm.file || !docForm.name.trim()) return;
    const form = new FormData();
    form.append("name", docForm.name);
    form.append("document_type", docForm.document_type);
    form.append("description", docForm.description);
    form.append("file", docForm.file);
    await api.post(`/prospects/${id}/documents/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setDocForm({ name: "", document_type: "attachment", description: "", file: null });
    await loadAll();
  };

  const setRecommendationStatus = async (recommendationId, status) => {
    await api.post(`/prospects/${id}/recommendations/${recommendationId}/status/`, { status });
    await loadAll();
  };

  const runQualification = async () => {
    setQualificationLoading(true);
    setQualificationError("");
    try {
      const response = await runProspectQualification(id);
      setQualification(response.data);
      await loadQualification();
    } catch (err) {
      setQualificationError(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          "La qualification IA n'a pas pu etre executee."
      );
    } finally {
      setQualificationLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <Box p={4} textAlign="center">
          <CircularProgress sx={{ color: CRM_RED.main }} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Box px={{ xs: 2, md: 3 }} py={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/prospects")}
          sx={{ mb: 2, color: CRM_RED.main }}
        >
          Retour aux prospects
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {prospect && (
          <>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 3,
                border: `1px solid ${CRM_RED.border}`,
                bgcolor: "#fff",
                boxShadow: "0 18px 44px rgba(139,0,0,0.08)",
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={7}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        width: 64,
                        height: 64,
                        bgcolor: CRM_RED.main,
                        fontSize: 24,
                        fontWeight: 900,
                      }}
                    >
                      {(prospect.first_name?.[0] || "?").toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="h4"
                        fontWeight={900}
                        color={CRM_RED.dark}
                        lineHeight={1.1}
                      >
                        {company.name || "Entreprise non renseignée"}
                      </Typography>
                      <Typography color="text.secondary" fontWeight={700}>
                        Contact : {prospect.first_name} {prospect.last_name}
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={0.8} mt={1}>
                        {[
                          prospect.evaluation,
                          prospect.status,
                          prospect.engagement_status,
                          company.industry,
                        ]
                          .filter(Boolean)
                          .map((badge) => (
                            <Chip
                              key={badge}
                              label={badge}
                              size="small"
                              sx={{
                                borderRadius: 1,
                                bgcolor: CRM_RED.soft,
                                color: CRM_RED.dark,
                                fontWeight: 800,
                              }}
                            />
                          ))}
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Stack spacing={1}>
                    <Typography fontWeight={900}>
                      Qualification IA : {displayedScore || 0}/100
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(displayedScore || 0, 100)}
                      sx={{
                        height: 10,
                        borderRadius: 8,
                        bgcolor: CRM_RED.soft,
                        "& .MuiLinearProgress-bar": { bgcolor: CRM_RED.main },
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Statut :{" "}
                      {qualification?.status
                        ? QUALIFICATION_STATUS_LABELS[qualification.status] || qualification.status
                        : summary.priority || "A qualifier"}{" "}
                      · Dernière activité :{" "}
                      {summary.last_interaction_title || "Aucune"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Action recommandée :{" "}
                      {qualification?.recommended_action
                        ? QUALIFICATION_ACTION_LABELS[qualification.recommended_action] ||
                          qualification.recommended_action
                        : summary.next_action || "A definir"}
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={1.5} mt={0.5}>
              <Grid item xs={6} md={2}>
                <KpiCard
                  label="Score"
                  value={qualification ? `${displayedScore || 0}/100` : "--/100"}
                  sub={
                    qualification?.qualification_mode
                      ? QUALIFICATION_MODE_LABELS[qualification.qualification_mode]
                      : "Qualification"
                  }
                  icon={<ScoreIcon />}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <KpiCard
                  label="Contacts"
                  value={summary.contact_methods || 0}
                  sub="disponibles"
                  icon={<PhoneIcon />}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <KpiCard
                  label="Interaction"
                  value={fmtDate(summary.last_interaction_at)}
                  icon={<TimelineIcon />}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <KpiCard
                  label="Activités"
                  value={summary.activities_count || 0}
                  icon={<ActivityIcon />}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <KpiCard
                  label="Documents"
                  value={summary.documents_count || 0}
                  icon={<DocumentIcon />}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <KpiCard
                  label="Agents"
                  value={summary.agent_runs_count || 0}
                  icon={<AgentIcon />}
                />
              </Grid>
            </Grid>

            <Card sx={{ mt: 2, borderRadius: 3 }}>
              <CardContent>
                <Tabs
                  value={tab}
                  onChange={(_, value) => setTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {[
                    "Vue générale",
                    "Informations",
                    "Activités",
                    "Engagement",
                    "Documents",
                    "Agents IA",
                    "Qualification IA",
                  ].map((label) => (
                    <Tab key={label} label={label} />
                  ))}
                </Tabs>
                <Divider sx={{ mb: 2 }} />

                {tab === 0 && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={7}>
                      <InfoPanel prospect={prospect} company={company} />
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <RecommendationPanel
                        recommendations={recommendations}
                        onStatus={setRecommendationStatus}
                      />
                    </Grid>
                  </Grid>
                )}
                {tab === 1 && <InfoPanel prospect={prospect} company={company} detailed />}
                {tab === 2 && (
                  <ActivityPanel
                    activities={activities}
                    form={activityForm}
                    setForm={setActivityForm}
                    onAdd={addActivity}
                  />
                )}
                {tab === 3 && <EngagementPanel logs={engagement} />}
                {tab === 4 && (
                  <DocumentsPanel
                    documents={documents}
                    form={docForm}
                    setForm={setDocForm}
                    onUpload={uploadDocument}
                  />
                )}
                {tab === 5 && <AgentRunsPanel runs={agents} />}
                {tab === 6 && (
                  <QualificationPanel
                    latest={qualification}
                    history={qualificationHistory}
                    loading={qualificationLoading}
                    error={qualificationError}
                    onRun={runQualification}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </DashboardLayout>
  );
}

function InfoPanel({ prospect, company }) {
  const rows = [
    ["Nom", `${prospect.first_name || ""} ${prospect.last_name || ""}`.trim()],
    ["Entreprise", company.name],
    ["Secteur", company.industry],
    ["Poste", prospect.title],
    ["Email", prospect.email],
    ["Téléphone", prospect.phone],
    [
      "Localisation",
      [prospect.city || company.city, prospect.country || company.country]
        .filter(Boolean)
        .join(", "),
    ],
    ["Source", prospect.source_label || prospect.origin],
    ["Description", prospect.description],
  ];
  const links = [
    ["Site web", prospect.website, <WebIcon key="website" />],
    ["LinkedIn", prospect.linkedin_url, <LinkedInIcon key="linkedin" />],
    ["Email", prospect.email ? `mailto:${prospect.email}` : "", <EmailIcon key="email" />],
  ].filter(([, href]) => href);
  return (
    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}>
      <Typography fontWeight={900} mb={1}>
        Informations prospect
      </Typography>
      <Grid container spacing={1.2}>
        {rows.map(([label, value]) => (
          <Grid item xs={12} md={6} key={label}>
            <Typography variant="caption" color="text.secondary" fontWeight={800}>
              {label}
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {value || "—"}
            </Typography>
          </Grid>
        ))}
      </Grid>
      <Stack direction="row" flexWrap="wrap" gap={1} mt={2}>
        {links.map(([label, href, icon]) => (
          <Button
            key={label}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            size="small"
            startIcon={icon}
            sx={{ color: CRM_RED.main }}
          >
            {label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}

function RecommendationPanel({ recommendations, onStatus }) {
  const pending = recommendations.filter((item) => item.status === "pending");
  if (!pending.length) return <EmptyState title="Aucune recommandation en attente." />;
  return (
    <Stack spacing={1.2}>
      {pending.map((item) => (
        <Paper
          key={item.id}
          elevation={0}
          sx={{
            p: 2,
            border: `1px solid ${CRM_RED.border}`,
            borderRadius: 2,
            bgcolor: CRM_RED.soft,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ActionIcon sx={{ color: CRM_RED.main }} />
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={900}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {item.reason || item.description}
              </Typography>
            </Box>
            <Chip label={item.priority} size="small" />
          </Stack>
          <Stack direction="row" spacing={1} mt={1.5}>
            <Button
              size="small"
              variant="contained"
              onClick={() => onStatus(item.id, "completed")}
              sx={{ bgcolor: CRM_RED.main }}
            >
              Marquer réalisé
            </Button>
            <Button
              size="small"
              onClick={() => onStatus(item.id, "ignored")}
              sx={{ color: CRM_RED.main }}
            >
              Ignorer
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function ActivityPanel({ activities, form, setForm, onAdd }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper elevation={0} sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}>
          <Typography fontWeight={900} mb={1}>
            + Ajouter une activité
          </Typography>
          <Stack spacing={1.2}>
            <TextField
              select
              size="small"
              label="Type"
              value={form.activity_type}
              onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
            >
              {ACTIVITY_TYPES.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Canal"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              {CHANNELS.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Titre"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              size="small"
              multiline
              minRows={3}
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button variant="contained" onClick={onAdd} sx={{ bgcolor: CRM_RED.main }}>
              Ajouter
            </Button>
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        <TimelineList items={activities} />
      </Grid>
    </Grid>
  );
}

function TimelineList({ items }) {
  if (!items.length) return <EmptyState title="Aucune activité enregistrée." />;
  return (
    <Stack spacing={1.4}>
      {items.map((item) => (
        <Paper
          key={item.id}
          elevation={0}
          sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            {fmtDate(item.created_at)}
          </Typography>
          <Typography fontWeight={900}>{item.activity_type_display || item.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {item.description || item.title}
          </Typography>
          <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
            {item.channel && <Chip label={item.channel_display || item.channel} size="small" />}
            {item.created_by_name && (
              <Chip label={`Ajouté par ${item.created_by_name}`} size="small" />
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function EngagementPanel({ logs }) {
  if (!logs.length) return <EmptyState title="Aucun engagement enregistré." />;
  return (
    <Stack spacing={1.2}>
      {logs.map((log) => (
        <EngagementItem key={log.id} log={log} />
      ))}
    </Stack>
  );
}

function EngagementItem({ log }) {
  const [open, setOpen] = useState(false);
  return (
    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Box>
          <Typography fontWeight={900}>
            {log.channel || "Message"} · {log.status}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Généré par : {log.agent} · {fmtDate(log.created_at)}
          </Typography>
        </Box>
        <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ color: CRM_RED.main }}>
          Voir contenu
        </Button>
      </Stack>
      <Collapse in={open}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {log.message || "Aucun contenu."}
        </Typography>
      </Collapse>
    </Paper>
  );
}

function DocumentsPanel({ documents, form, setForm, onUpload }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper elevation={0} sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}>
          <Typography fontWeight={900} mb={1}>
            Ajouter un document
          </Typography>
          <Stack spacing={1.2}>
            <TextField
              size="small"
              label="Titre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              select
              size="small"
              label="Type"
              value={form.document_type}
              onChange={(e) => setForm({ ...form, document_type: e.target.value })}
            >
              {DOC_TYPES.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              multiline
              minRows={2}
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button
              component="label"
              startIcon={<UploadIcon />}
              variant="outlined"
              sx={{ borderColor: CRM_RED.border, color: CRM_RED.main }}
            >
              Choisir fichier
              <input
                hidden
                type="file"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              {form.file?.name || "PDF, Word, Excel, image ou TXT"}
            </Typography>
            <Button variant="contained" onClick={onUpload} sx={{ bgcolor: CRM_RED.main }}>
              Uploader
            </Button>
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12} md={8}>
        {!documents.length ? (
          <EmptyState title="Aucun document." />
        ) : (
          <Stack spacing={1}>
            {documents.map((doc) => (
              <Paper
                key={doc.id}
                elevation={0}
                sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={900}>{doc.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.document_type} · {fmtDate(doc.created_at)} ·{" "}
                      {doc.uploaded_by_name || "—"}
                    </Typography>
                  </Box>
                  <Button
                    href={doc.file_url}
                    target="_blank"
                    size="small"
                    sx={{ color: CRM_RED.main }}
                  >
                    Télécharger
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Grid>
    </Grid>
  );
}

function AgentRunsPanel({ runs }) {
  if (!runs.length) return <EmptyState title="Aucun agent exécuté." />;
  return (
    <Stack spacing={1.2}>
      {runs.map((run) => (
        <Paper
          key={run.id}
          elevation={0}
          sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <AgentIcon sx={{ color: CRM_RED.main }} />
            <Box>
              <Typography fontWeight={900}>{run.agent_type}</Typography>
              <Typography variant="caption" color="text.secondary">
                {run.status} · {fmtDate(run.started_at)} ·{" "}
                {run.duration_seconds ? `${run.duration_seconds}s` : ""}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {run.output_summary || run.error_message || "Aucun détail."}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function SignalList({ title, items, empty = "Aucun signal renseigne." }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}>
      <Typography fontWeight={900} mb={1}>
        {title}
      </Typography>
      {items?.length ? (
        <Stack spacing={0.8}>
          {items.map((item, index) => (
            <Typography key={`${title}-${index}`} variant="body2" color="text.secondary">
              - {item}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      )}
    </Paper>
  );
}

function QualificationPanel({ latest, history, loading, error, onRun }) {
  const statusLabel = latest?.status
    ? QUALIFICATION_STATUS_LABELS[latest.status] || latest.status
    : "Non qualifie";
  const actionLabel = latest?.recommended_action
    ? QUALIFICATION_ACTION_LABELS[latest.recommended_action] || latest.recommended_action
    : "A determiner";
  const modeLabel = latest?.qualification_mode
    ? QUALIFICATION_MODE_LABELS[latest.qualification_mode] || latest.qualification_mode
    : "Initiale";

  return (
    <Stack spacing={2}>
      {error && <Alert severity="warning">{error}</Alert>}

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          border: `1px solid ${CRM_RED.border}`,
          borderRadius: 2,
          bgcolor: "#fff",
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <Typography variant="overline" color="text.secondary" fontWeight={900}>
              Agent IA de qualification
            </Typography>
            <Typography variant="h4" fontWeight={900} color={CRM_RED.dark}>
              {latest ? `${latest.score}/100` : "--/100"}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={latest ? Math.min(latest.score || 0, 100) : 0}
              sx={{
                mt: 1,
                height: 10,
                borderRadius: 8,
                bgcolor: CRM_RED.soft,
                "& .MuiLinearProgress-bar": { bgcolor: CRM_RED.main },
              }}
            />
            <Typography variant="caption" color="text.secondary" fontWeight={800}>
              Confiance {latest?.confidence ?? 0}% · {modeLabel}
            </Typography>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1}>
              <Chip label={statusLabel} sx={{ borderRadius: 1, fontWeight: 900 }} />
              <Chip
                label={latest?.opportunity_ready ? "Opportunite possible" : "Pas encore pret"}
                sx={{
                  borderRadius: 1,
                  fontWeight: 900,
                  bgcolor: latest?.opportunity_ready ? "#E8F5E9" : CRM_RED.soft,
                  color: latest?.opportunity_ready ? "#1B5E20" : CRM_RED.dark,
                }}
              />
            </Stack>
            <Typography fontWeight={900}>{actionLabel}</Typography>
            <Typography variant="body2" color="text.secondary">
              {latest?.summary ||
                "Lancez l'agent pour qualifier ce prospect avec les donnees CRM disponibles."}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AgentIcon />}
              disabled={loading}
              onClick={onRun}
              sx={{ bgcolor: CRM_RED.main, "&:hover": { bgcolor: CRM_RED.dark } }}
            >
              {latest ? "Requalifier" : "Qualifier"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {!latest ? (
        <EmptyState title="Aucune qualification IA enregistree pour ce prospect." />
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <SignalList title="Forces detectees" items={latest.strengths} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SignalList title="Risques" items={latest.risks} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SignalList title="Informations manquantes" items={latest.missing_information} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SignalList title="Besoins detectes" items={latest.detected_needs} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SignalList title="Signaux d'achat" items={latest.buying_signals} />
          </Grid>
          <Grid item xs={12} md={4}>
            <SignalList title="Objections" items={latest.objections} />
          </Grid>
        </Grid>
      )}

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${CRM_RED.border}`, borderRadius: 2 }}>
        <Typography fontWeight={900} mb={1}>
          Historique de qualification
        </Typography>
        {!history.length ? (
          <Typography variant="body2" color="text.secondary">
            Aucun historique disponible.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {history.map((item) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{ p: 1.5, border: "1px solid #eee", borderRadius: 2, bgcolor: "#fff" }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Box>
                    <Typography fontWeight={900}>
                      {item.score}/100 ·{" "}
                      {QUALIFICATION_STATUS_LABELS[item.status] || item.status || "Statut inconnu"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(item.created_at)} ·{" "}
                      {QUALIFICATION_MODE_LABELS[item.qualification_mode] ||
                        item.qualification_mode}
                    </Typography>
                  </Box>
                  <Chip
                    label={
                      item.score_delta === null || item.score_delta === undefined
                        ? "Premier calcul"
                        : `${item.score_delta > 0 ? "+" : ""}${item.score_delta} pts`
                    }
                    size="small"
                    sx={{ borderRadius: 1, fontWeight: 900 }}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
