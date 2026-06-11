/* eslint-disable prettier/prettier */
// src/pages/modules/ManagerDashboard.jsx — version IA + Google Maps complète

import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Grid,
  Typography,
  Box,
  Stack,
  Avatar,
  Chip,
  Divider,
  LinearProgress,
  Alert,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  PersonAdd,
  CheckCircle,
  AttachMoney,
  People,
  TrendingUp,
  Warning,
  EmojiEvents,
  BarChart as BarChartIcon,
  SmartToy,
  AutoAwesome,
  LocationOn,
  Psychology,
  Campaign,
  MarkEmailRead,
  Map as MapIcon,
  Insights,
  HealthAndSafety,
  Refresh,
  Phone,
  Email,
  Groups,
  Timeline,
  TrendingDown,
  Bolt,
} from "@mui/icons-material";
import { alpha, styled, keyframes } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";

import { ScoreRing, AlertRow, PerfSkeleton, scoreColor } from "./PerformanceWidgets";
import { useTeamKPI, useAlerts, useLeaderboard } from "../../hooks/usePerformance";
import { FeedbackButton, useTrackActivity } from "../superadmin/Marketingwidgets";
import DashboardDataFrame, { useOfficialDashboardData } from "./DashboardDataFrame";

const toList = (d) => (Array.isArray(d) ? d : d?.results || []);

const C = {
  red: "#dc2626",
  redDark: "#991b1b",
  green: "#059669",
  blue: "#2563eb",
  amber: "#d97706",
  purple: "#7c3aed",
  teal: "#0d9488",
  rose: "#e11d48",
  indigo: "#4f46e5",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n300: "#cbd5e1",
  n400: "#94a3b8",
  n500: "#64748b",
  n600: "#475569",
  n700: "#334155",
  n800: "#1e293b",
  white: "#ffffff",
  grad: "linear-gradient(135deg,#dc2626 0%,#991b1b 100%)",
};

const fadeUp = keyframes`
  from { opacity:0; transform:translateY(10px); }
  to { opacity:1; transform:translateY(0); }
`;

const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.04); opacity: .75; }
  100% { transform: scale(1); opacity: 1; }
`;

const AccentCard = styled(Box)(({ accent }) => ({
  background: C.white,
  border: `1px solid ${C.n200}`,
  borderRadius: 16,
  borderTop: `3px solid ${accent || C.red}`,
  padding: 20,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  transition: "box-shadow 0.2s, transform 0.2s",
  "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.08)" },
}));

const KpiTile = styled(Box)(({ color }) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 18px",
  borderRadius: 14,
  background: C.white,
  border: `1px solid ${C.n200}`,
  borderLeft: `4px solid ${color || C.red}`,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
}));

const TabPill = styled(Box)(({ active }) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 18px",
  borderRadius: 10,
  cursor: "pointer",
  background: active ? alpha(C.red, 0.08) : "transparent",
  border: active ? `1px solid ${alpha(C.red, 0.2)}` : "1px solid transparent",
  transition: "all 0.15s",
  "& .lbl": { fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.red : C.n500 },
}));

const PrimaryBtn = styled(Button)(() => ({
  background: C.grad,
  color: "#fff",
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 700,
  fontSize: 13,
  padding: "8px 18px",
  boxShadow: `0 3px 10px ${alpha(C.red, 0.28)}`,
  "&:hover": { background: "linear-gradient(135deg,#dc2626,#7f1d1d)" },
}));

function fmtTND(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

function safeDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOverdue(task) {
  const d = safeDate(task?.due_date);
  if (!d) return false;
  return task.status !== "done" && task.status !== "cancelled" && d < new Date();
}

function getProspectName(p) {
  return (
    p.name ||
    p.company_name ||
    `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
    p.email ||
    `Prospect #${p.id}`
  );
}

function getProspectScore(p) {
  return Number(p.ai_score || p.score || p.relevance || p.lead_score || 0);
}

function getSource(p) {
  return (p.source || p.origin || p.channel || "manuel").toString().toLowerCase();
}

function getStatusLabel(status) {
  const map = {
    new: "Nouveau",
    contacted: "Contacté",
    qualified: "Qualifié",
    won: "Gagné",
    lost: "Perdu",
    proposal: "Proposition",
    negotiation: "Négociation",
  };
  return map[status] || status || "—";
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.2} mb={2}>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 10,
          bgcolor: alpha(C.red, 0.1),
          color: C.red,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: C.n800 }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: 11, color: C.n400 }}>{subtitle}</Typography>}
      </Box>
    </Stack>
  );
}
SectionTitle.propTypes = { icon: PropTypes.node, title: PropTypes.string, subtitle: PropTypes.string };
SectionTitle.defaultProps = { icon: null, title: "", subtitle: "" };

function MiniKpi({ label, value, icon, color, sub }) {
  return (
    <Box
      sx={{
        p: 1.6,
        borderRadius: 12,
        bgcolor: alpha(color, 0.06),
        border: `1px solid ${alpha(color, 0.14)}`,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.8}>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: C.n500, textTransform: "uppercase" }}>
          {label}
        </Typography>
        <Box sx={{ color }}>{icon}</Box>
      </Stack>
      <Typography sx={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: C.n500, mt: 0.5 }}>{sub}</Typography>}
    </Box>
  );
}
MiniKpi.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node,
  color: PropTypes.string,
  sub: PropTypes.string,
};
MiniKpi.defaultProps = { icon: null, color: C.red, sub: null };

function AiCenter({ prospects, tasks, opportunities }) {
  const aiProspects = prospects.filter((p) => {
    const source = getSource(p);
    return p.created_by_agent || p.ai_generated || source.includes("agent") || source.includes("maps") || source.includes("linkedin") || source.includes("instagram") || source.includes("facebook");
  });
  const qualifiedAi = aiProspects.filter((p) => p.status === "qualified" || getProspectScore(p) >= 70);
  const messagesReady = prospects.filter((p) => ["message_ready", "prepared", "ready_to_send"].includes(p.engagement_status || p.status));
  const replied = prospects.filter((p) => ["replied", "reply_detected", "follow_up_required"].includes(p.engagement_status || p.status));
  const hotProspects = prospects.filter((p) => getProspectScore(p) >= 80).length;
  const qualificationRate = aiProspects.length ? Math.round((qualifiedAi.length / aiProspects.length) * 100) : 0;

  const sourceData = Object.entries(
    prospects.reduce((acc, p) => {
      const source = getSource(p);
      const clean = source.includes("maps")
        ? "Google Maps"
        : source.includes("linkedin")
        ? "LinkedIn"
        : source.includes("instagram")
        ? "Instagram"
        : source.includes("facebook")
        ? "Facebook"
        : source.includes("web") || source.includes("site")
        ? "Web"
        : source.includes("agent")
        ? "Agent IA"
        : "Manuel";
      acc[clean] = (acc[clean] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value], index) => ({
    name,
    value,
    color: [C.blue, C.purple, C.rose, C.indigo, C.teal, C.amber, C.n400][index % 7],
  }));

  return (
    <AccentCard accent={C.purple}>
      <SectionTitle
        icon={<SmartToy sx={{ fontSize: 18 }} />}
        title="Centre IA Manager"
        subtitle="Supervision de la prospection et de l'engagement intelligent"
      />
      <Grid container spacing={1.5} mb={2.5}>
        <Grid item xs={6} md={3}>
          <MiniKpi label="Prospects IA" value={aiProspects.length} icon={<AutoAwesome fontSize="small" />} color={C.purple} sub={`${hotProspects} chauds`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <MiniKpi label="Qualification" value={`${qualificationRate}%`} icon={<Psychology fontSize="small" />} color={C.green} sub={`${qualifiedAi.length} qualifiés`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <MiniKpi label="Messages prêts" value={messagesReady.length} icon={<Campaign fontSize="small" />} color={C.amber} sub="à valider" />
        </Grid>
        <Grid item xs={6} md={3}>
          <MiniKpi label="Réponses" value={replied.length} icon={<MarkEmailRead fontSize="small" />} color={C.blue} sub="à traiter" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.n700, mb: 1 }}>
            Répartition des sources
          </Typography>
          {sourceData.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {sourceData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ReTooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune source disponible</Typography>
          )}
        </Grid>
        <Grid item xs={12} md={7}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.n700, mb: 1 }}>
            Monitoring des agents
          </Typography>
          <Grid container spacing={1.2}>
            {[
              { label: "Agent Prospection", status: aiProspects.length > 0 ? "Actif" : "En attente", color: aiProspects.length > 0 ? C.green : C.amber },
              { label: "Agent Engagement", status: messagesReady.length || replied.length ? "Actif" : "En attente", color: messagesReady.length || replied.length ? C.green : C.amber },
              { label: "Google Maps", status: process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? "Connecté" : "Clé manquante", color: process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? C.green : C.red },
              { label: "Gemini", status: "Configuré", color: C.green },
              { label: "Playwright", status: "Session sociale", color: C.blue },
              { label: "CRM Import", status: "Disponible", color: C.teal },
            ].map((item) => (
              <Grid item xs={12} sm={6} key={item.label}>
                <Box sx={{ p: 1.2, borderRadius: 10, bgcolor: alpha(item.color, 0.06), border: `1px solid ${alpha(item.color, 0.14)}` }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n700 }}>{item.label}</Typography>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={{ height: 22, fontSize: 10, fontWeight: 800, bgcolor: alpha(item.color, 0.1), color: item.color }}
                    />
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </AccentCard>
  );
}
AiCenter.propTypes = { prospects: PropTypes.array, tasks: PropTypes.array, opportunities: PropTypes.array };
AiCenter.defaultProps = { prospects: [], tasks: [], opportunities: [] };

function GeoProspectsMap({ prospects }) {
  const [selected, setSelected] = useState(null);
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const mappedProspects = prospects
    .map((p) => ({ ...p, lat: Number(p.latitude || p.lat), lng: Number(p.longitude || p.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const fallbackByCity = Object.entries(
    prospects.reduce((acc, p) => {
      const city = p.city || p.region || p.country || "Localisation inconnue";
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);

  const center = mappedProspects.length
    ? { lat: mappedProspects[0].lat, lng: mappedProspects[0].lng }
    : { lat: 36.8065, lng: 10.1815 };

  if (!apiKey) {
    return (
      <Box>
        <Alert severity="warning" sx={{ borderRadius: 2, mb: 2, fontSize: 13 }}>
          Clé Google Maps manquante. Ajoute REACT_APP_GOOGLE_MAPS_API_KEY dans le fichier .env du frontend puis redémarre npm start.
        </Alert>
        <CityFallback cities={fallbackByCity} />
      </Box>
    );
  }

  if (!mappedProspects.length) {
    return (
      <Box>
        <Alert severity="info" sx={{ borderRadius: 2, mb: 2, fontSize: 13 }}>
          Aucun prospect avec latitude/longitude. La carte Google Maps sera affichée dès que les coordonnées existent dans le backend.
        </Alert>
        <CityFallback cities={fallbackByCity} />
      </Box>
    );
  }

  return (
    <Box>
      <LoadScript googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: 360, borderRadius: 16 }}
          center={center}
          zoom={mappedProspects.length > 1 ? 7 : 11}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
        >
          {mappedProspects.map((p) => (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              onClick={() => setSelected(p)}
            />
          ))}
          {selected && (
            <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
              <Box sx={{ minWidth: 180 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: C.n800 }}>
                  {getProspectName(selected)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: C.n600 }}>{selected.city || selected.address || selected.country || "—"}</Typography>
                <Typography sx={{ fontSize: 12, color: C.n600 }}>Source : {getSource(selected)}</Typography>
                <Typography sx={{ fontSize: 12, color: C.n600 }}>Score IA : {getProspectScore(selected) || "—"}</Typography>
              </Box>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5}>
        <Typography sx={{ fontSize: 11, color: C.n500 }}>{mappedProspects.length} prospects affichés sur Google Maps</Typography>
        <Typography sx={{ fontSize: 11, color: C.n400 }}>{prospects.length - mappedProspects.length} sans coordonnées</Typography>
      </Stack>
    </Box>
  );
}
GeoProspectsMap.propTypes = { prospects: PropTypes.array };
GeoProspectsMap.defaultProps = { prospects: [] };

function CityFallback({ cities }) {
  if (!cities.length) return <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune donnée géographique.</Typography>;
  const max = Math.max(...cities.map((c) => c.count), 1);
  return (
    <Stack spacing={1}>
      {cities.slice(0, 8).map((c) => (
        <Box key={c.city}>
          <Stack direction="row" justifyContent="space-between" mb={0.4}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n700 }}>{c.city}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.blue }}>{c.count}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={(c.count / max) * 100}
            sx={{ height: 6, borderRadius: 3, bgcolor: C.n100, "& .MuiLinearProgress-bar": { bgcolor: C.blue, borderRadius: 3 } }}
          />
        </Box>
      ))}
    </Stack>
  );
}
CityFallback.propTypes = { cities: PropTypes.array };
CityFallback.defaultProps = { cities: [] };

function PipelineFunnel({ opportunities }) {
  const stages = [
    { key: "new", name: "Nouveau", color: C.blue, probability: 0.1 },
    { key: "qualified", name: "Qualifié", color: C.purple, probability: 0.25 },
    { key: "proposal", name: "Proposition", color: C.amber, probability: 0.5 },
    { key: "negotiation", name: "Négociation", color: C.teal, probability: 0.7 },
    { key: "won", name: "Gagné", color: C.green, probability: 1 },
  ];
  const data = stages.map((s) => {
    const items = opportunities.filter((o) => o.stage === s.key || o.status === s.key);
    return {
      name: s.name,
      value: Math.max(items.length, 0),
      fill: s.color,
      amount: items.reduce((sum, o) => sum + Number(o.amount || 0), 0),
      forecast: items.reduce((sum, o) => sum + Number(o.amount || 0) * (Number(o.probability || 0) || s.probability), 0),
    };
  });
  const totalPipeline = opportunities.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const forecast = data.reduce((sum, d) => sum + d.forecast, 0);

  return (
    <AccentCard accent={C.green}>
      <SectionTitle icon={<Insights sx={{ fontSize: 18 }} />} title="Pipeline & Prévision CA" subtitle="Prévision basée sur le stade et la probabilité" />
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          {opportunities.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <FunnelChart>
                <ReTooltip
  formatter={(value, name) => [`${value} opportunité(s)`, name]}
/>
                <Funnel dataKey="value" data={data.filter((d) => d.value > 0)} isAnimationActive>
                  <LabelList position="right" fill={C.n700} stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : (
            <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune opportunité.</Typography>
          )}
        </Grid>
        <Grid item xs={12} md={5}>
          <Stack spacing={1.3}>
            <MiniKpi label="Pipeline total" value={fmtTND(totalPipeline)} icon={<AttachMoney fontSize="small" />} color={C.green} />
            <MiniKpi label="Prévision CA" value={fmtTND(forecast)} icon={<TrendingUp fontSize="small" />} color={C.blue} />
            <Box sx={{ p: 1.4, borderRadius: 12, bgcolor: C.n50, border: `1px solid ${C.n200}` }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.n500, mb: 1 }}>Détail par étape</Typography>
              <Stack spacing={0.8}>
                {data.map((d) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={0.8}>
                      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: d.fill }} />
                      <Typography sx={{ fontSize: 11, color: C.n600 }}>{d.name}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: d.fill }}>{d.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </AccentCard>
  );
}
PipelineFunnel.propTypes = { opportunities: PropTypes.array };
PipelineFunnel.defaultProps = { opportunities: [] };

function SmartAlerts({ prospects, tasks, opportunities, members }) {
  const alerts = [];
  const now = new Date();

  prospects.forEach((p) => {
    const score = getProspectScore(p);
    const status = p.engagement_status || p.status;
    if (score >= 80 && !["contacted", "message_ready", "replied", "won"].includes(status)) {
      alerts.push({ type: "warning", title: `Prospect chaud sans suivi : ${getProspectName(p)}`, sub: `Score IA ${score}% · action recommandée : relance rapide` });
    }
    if (["replied", "reply_detected", "follow_up_required"].includes(status)) {
      alerts.push({ type: "info", title: `Réponse détectée : ${getProspectName(p)}`, sub: "Un commercial doit traiter la conversation" });
    }
  });

  opportunities.forEach((o) => {
    const updated = safeDate(o.updated_at || o.last_activity_at || o.created_at);
    const days = updated ? Math.floor((now - updated) / (1000 * 60 * 60 * 24)) : 0;
    if (!["won", "lost"].includes(o.stage || o.status) && days >= 7) {
      alerts.push({ type: "warning", title: `Opportunité inactive : ${o.name || o.title || "Opportunité"}`, sub: `${days} jours sans activité · relance recommandée` });
    }
  });

  tasks.filter(isOverdue).forEach((t) => {
    alerts.push({ type: "error", title: `Tâche en retard : ${t.title}`, sub: `${t.assigned_to_detail?.username || "Commercial"} · échéance dépassée` });
  });

  members.forEach((m) => {
    const memberTasks = tasks.filter((t) => t.assigned_to === m.id);
    const done = memberTasks.filter((t) => t.status === "done").length;
    if (memberTasks.length >= 3 && done === 0) {
      alerts.push({ type: "warning", title: `Activité faible : ${m.username}`, sub: "Aucune tâche terminée récemment · coaching conseillé" });
    }
  });

  return (
    <AccentCard accent={C.amber}>
      <SectionTitle icon={<Warning sx={{ fontSize: 18 }} />} title="Alertes IA Manager" subtitle="Risques et actions à suivre" />
      {alerts.length ? (
        <Grid container spacing={1}>
          {alerts.slice(0, 8).map((alert, i) => (
            <Grid item xs={12} md={6} key={`${alert.title}-${i}`}>
              <AlertRow {...alert} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="success" sx={{ borderRadius: 2, fontSize: 13 }}>Aucune alerte critique détectée.</Alert>
      )}
    </AccentCard>
  );
}
SmartAlerts.propTypes = { prospects: PropTypes.array, tasks: PropTypes.array, opportunities: PropTypes.array, members: PropTypes.array };
SmartAlerts.defaultProps = { prospects: [], tasks: [], opportunities: [], members: [] };

function ManagerRecommendations({ prospects, tasks, opportunities, leaderboard }) {
  const recs = [];
  const top = leaderboard?.[0];
  const low = leaderboard?.find((e) => Number(e.score || 0) < 60);
  const hot = prospects.find((p) => getProspectScore(p) >= 85);
  const replied = prospects.find((p) => ["replied", "reply_detected", "follow_up_required"].includes(p.engagement_status || p.status));
  const riskyOpp = opportunities.find((o) => !["won", "lost"].includes(o.stage || o.status));

  if (top) recs.push({ icon: "🏆", title: `${top.username} est le meilleur performer`, action: "Prévoir une reconnaissance ou un bonus", color: C.green });
  if (low) recs.push({ icon: "🎯", title: `${low.username} a un score faible`, action: "Planifier un coaching individuel", color: C.red });
  if (hot) recs.push({ icon: "🔥", title: `Prospect chaud : ${getProspectName(hot)}`, action: "Assigner une relance prioritaire", color: C.amber });
  if (replied) recs.push({ icon: "💬", title: `Réponse à traiter : ${getProspectName(replied)}`, action: "Demander au commercial de répondre aujourd'hui", color: C.blue });
  if (riskyOpp) recs.push({ icon: "📈", title: `Opportunité à suivre : ${riskyOpp.name || riskyOpp.title || "Opportunité"}`, action: "Vérifier la prochaine action commerciale", color: C.purple });

  if (!recs.length) {
    recs.push({ icon: "✅", title: "Situation stable", action: "Continuer le suivi hebdomadaire de l'équipe", color: C.green });
  }

  return (
    <AccentCard accent={C.indigo}>
      <SectionTitle icon={<Psychology sx={{ fontSize: 18 }} />} title="Recommandations Manager" subtitle="Actions intelligentes proposées" />
      <Grid container spacing={1.5}>
        {recs.slice(0, 6).map((r, index) => (
          <Grid item xs={12} md={6} key={`${r.title}-${index}`}>
            <Box sx={{ p: 1.6, borderRadius: 12, bgcolor: alpha(r.color, 0.06), border: `1px solid ${alpha(r.color, 0.14)}`, height: "100%" }}>
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Typography sx={{ fontSize: 24, lineHeight: 1 }}>{r.icon}</Typography>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: C.n800 }}>{r.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: C.n600, mt: 0.5 }}>{r.action}</Typography>
                </Box>
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>
    </AccentCard>
  );
}
ManagerRecommendations.propTypes = { prospects: PropTypes.array, tasks: PropTypes.array, opportunities: PropTypes.array, leaderboard: PropTypes.array };
ManagerRecommendations.defaultProps = { prospects: [], tasks: [], opportunities: [], leaderboard: [] };

function PerformanceTable({ leaderboard, selected, onSelect }) {
  if (!leaderboard.length) {
    return <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>Aucune donnée KPI ce mois.</Alert>;
  }

  return (
    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 14, border: `1px solid ${C.n200}`, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: C.n50 }}>
            {["#", "Commercial", "Score", "Tâches", "Activités", "Deals", "Pénalité"].map((h) => (
              <TableCell key={h} sx={{ fontSize: 10, fontWeight: 800, color: C.n400, textTransform: "uppercase", py: 1.5 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {leaderboard.map((entry) => {
            const isSel = selected?.user_id === entry.user_id;
            const color = scoreColor(entry.score);
            const taskPct = entry.tasks_total > 0 ? Math.round((entry.tasks_done / entry.tasks_total) * 100) : 0;
            const rank = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
            return (
              <TableRow
                key={entry.user_id}
                onClick={() => onSelect(isSel ? null : entry)}
                sx={{ cursor: "pointer", bgcolor: isSel ? alpha(C.red, 0.03) : "white", borderLeft: isSel ? `3px solid ${C.red}` : "3px solid transparent", "&:hover": { bgcolor: alpha(C.n100, 0.8) } }}
              >
                <TableCell sx={{ py: 1.5, fontSize: 13, fontWeight: 800 }}>{rank}</TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <Avatar sx={{ width: 30, height: 30, bgcolor: alpha(color, 0.15), color, fontWeight: 800, fontSize: 11 }}>{entry.username?.[0]?.toUpperCase()}</Avatar>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.n800 }}>{entry.username}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography sx={{ fontSize: 17, fontWeight: 900, color }}>{Math.round(entry.score)}%</Typography>
                    {entry.score >= 85 ? <TrendingUp sx={{ fontSize: 13, color: C.green }} /> : entry.score < 60 ? <TrendingDown sx={{ fontSize: 13, color: C.red }} /> : null}
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 1.5, minWidth: 100 }}>
                  <Typography sx={{ fontSize: 10, color: C.n500, mb: 0.3 }}>{entry.tasks_done}/{entry.tasks_total}</Typography>
                  <LinearProgress variant="determinate" value={taskPct} sx={{ height: 5, borderRadius: 2, bgcolor: C.n100, "& .MuiLinearProgress-bar": { bgcolor: C.blue, borderRadius: 2 } }} />
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <Stack direction="row" spacing={0.5}>
                    {[{ icon: <Phone />, val: entry.calls || 0, color: C.blue }, { icon: <Email />, val: entry.emails || 0, color: C.purple }, { icon: <Groups />, val: entry.meetings || 0, color: C.teal }].map((it, i) => (
                      <Chip key={i} size="small" icon={React.cloneElement(it.icon, { sx: { fontSize: 12 } })} label={it.val} sx={{ height: 22, fontSize: 10, bgcolor: alpha(it.color, 0.1), color: it.color, fontWeight: 800 }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 1.5, fontSize: 13, fontWeight: 900, color: C.teal }}>{entry.opportunities_won || 0}</TableCell>
                <TableCell sx={{ py: 1.5, fontSize: 11, fontWeight: 800, color: (entry.penalty_points || 0) < 0 ? C.red : C.green }}>{entry.penalty_points || 0} pts</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
PerformanceTable.propTypes = { leaderboard: PropTypes.array, selected: PropTypes.object, onSelect: PropTypes.func };
PerformanceTable.defaultProps = { leaderboard: [], selected: null, onSelect: () => {} };

function TeamPerformanceTab({ members, prospects, tasks, opportunities }) {
  const { data: teamData, loading } = useTeamKPI();
  const { data: alertsData } = useAlerts();
  const { data: leaderboard } = useLeaderboard();
  const [selected, setSelected] = useState(null);
  const leaderboardList = leaderboard?.leaderboard || [];
  const avgScore = teamData?.avg_score || (leaderboardList.length ? Math.round(leaderboardList.reduce((s, e) => s + Number(e.score || 0), 0) / leaderboardList.length) : 0);
  const externalAlerts = alertsData
    ? [
        ...(alertsData.overdue_tasks || []).map((t) => ({ type: "error", title: `En retard : ${t.title}`, sub: `${t.commercial} · ${new Date(t.due_date).toLocaleDateString("fr-FR")}` })),
        ...(alertsData.inactive_users || []).map((u) => ({ type: "warning", title: `${u.username} inactif`, sub: "Aucune activité détectée" })),
        ...(alertsData.low_score_users || []).map((u) => ({ type: "warning", title: `Score faible : ${u.username}`, sub: `${Math.round(u.score)}%` })),
      ]
    : [];

  if (loading) return <PerfSkeleton rows={6} />;

  return (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}><KpiTile color={scoreColor(avgScore)}><ScoreRing score={avgScore} size={48} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Score moyen</Typography><Typography sx={{ fontSize: 20, fontWeight: 900, color: scoreColor(avgScore) }}>{Math.round(avgScore)}%</Typography></Box></KpiTile></Grid>
        <Grid item xs={6} sm={3}><KpiTile color={C.blue}><People sx={{ color: C.blue }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Commerciaux</Typography><Typography sx={{ fontSize: 20, fontWeight: 900, color: C.blue }}>{teamData?.team_count || members.length}</Typography></Box></KpiTile></Grid>
        <Grid item xs={6} sm={3}><KpiTile color={C.red}><Warning sx={{ color: C.red }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>En difficulté</Typography><Typography sx={{ fontSize: 20, fontWeight: 900, color: C.red }}>{(teamData?.in_difficulty || []).length || leaderboardList.filter((e) => e.score < 60).length}</Typography></Box></KpiTile></Grid>
        <Grid item xs={6} sm={3}><KpiTile color={C.amber}><Timeline sx={{ color: C.amber }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Alertes KPI</Typography><Typography sx={{ fontSize: 20, fontWeight: 900, color: C.amber }}>{externalAlerts.length}</Typography></Box></KpiTile></Grid>
      </Grid>

      {externalAlerts.length > 0 && (
        <Box mb={3}>
          <Grid container spacing={1}>
            {externalAlerts.slice(0, 4).map((a, i) => <Grid item xs={12} sm={6} key={i}><AlertRow {...a} /></Grid>)}
          </Grid>
        </Box>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <AccentCard accent={C.red}>
            <SectionTitle icon={<EmojiEvents sx={{ fontSize: 18 }} />} title="Classement commerciaux" subtitle="Performance de l'équipe ce mois" />
            <PerformanceTable leaderboard={leaderboardList} selected={selected} onSelect={setSelected} />
          </AccentCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <ManagerRecommendations prospects={prospects} tasks={tasks} opportunities={opportunities} leaderboard={leaderboardList} />
        </Grid>
      </Grid>
    </Box>
  );
}
TeamPerformanceTab.propTypes = { members: PropTypes.array, prospects: PropTypes.array, tasks: PropTypes.array, opportunities: PropTypes.array };
TeamPerformanceTab.defaultProps = { members: [], prospects: [], tasks: [], opportunities: [] };

export default function ManagerDashboard({ data, onRefresh }) {
  const remote = useOfficialDashboardData("MANAGER", data);
  const [activeTab, setActiveTab] = useState(0);
  useTrackActivity("dashboard");

  const effectiveData = data || remote.data || {};
  const effectiveRefresh = onRefresh || remote.refresh;
  const prospects = toList(effectiveData?.prospects);
  const tasks = toList(effectiveData?.tasks);
  const opportunities = toList(effectiveData?.opportunities);
  const members = toList(effectiveData?.members || effectiveData?.users);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const standaloneBlocked = !data && (remote.loading || remote.error);

  const overdueTasks = tasks.filter(isOverdue);
  const activeTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "todo");
  const wonOpps = opportunities.filter((o) => (o.stage || o.status) === "won");
  const pipeline = opportunities.reduce((s, o) => s + Number(o.amount || 0), 0);
  const hotProspects = prospects.filter((p) => getProspectScore(p) >= 80);
  const replies = prospects.filter((p) => ["replied", "reply_detected", "follow_up_required"].includes(p.engagement_status || p.status));

  const barData = members.map((m) => ({
    name: m.username,
    Prospects: prospects.filter((p) => p.assigned_to === m.id || p.owner === m.id).length,
    Taches: tasks.filter((t) => t.assigned_to === m.id && t.status === "done").length,
  }));

  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      const month = d.getMonth();
      const year = d.getFullYear();
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      return {
        month: label,
        Prospects: prospects.filter((p) => {
          const c = safeDate(p.created_at);
          return c && c.getMonth() === month && c.getFullYear() === year;
        }).length,
        Opportunites: opportunities.filter((o) => {
          const c = safeDate(o.created_at);
          return c && c.getMonth() === month && c.getFullYear() === year;
        }).length,
      };
    });
  }, [prospects, opportunities]);

  const tabs = [
    { label: "Vue Manager", icon: <People sx={{ fontSize: 15 }} /> },
    { label: "Performance & KPIs", icon: <EmojiEvents sx={{ fontSize: 15 }} /> },
  ];

  const body = (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
      <Box sx={{ borderRadius: 20, p: 3, mb: 3, position: "relative", overflow: "hidden", background: C.grad, boxShadow: `0 8px 28px ${alpha(C.red, 0.28)}` }}>
        <Box sx={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.06)" }} />
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} sx={{ position: "relative", zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ width: 54, height: 54, bgcolor: "rgba(255,255,255,0.2)", fontSize: 22, fontWeight: 900 }}>{user.username?.[0]?.toUpperCase() || "M"}</Avatar>
            <Box>
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Tableau de bord Manager IA</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>Bonjour, {user.username || "Manager"} 👋</Typography>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>Pilotage équipe, agents IA, pipeline et géographie commerciale</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {overdueTasks.length > 0 && <Chip icon={<Warning sx={{ color: "#fcd34d !important" }} />} label={`${overdueTasks.length} en retard`} sx={{ color: "#fff", fontWeight: 800, bgcolor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }} />}
            <Chip icon={<People sx={{ color: "#fff !important" }} />} label={`${members.length} membres`} sx={{ color: "#fff", fontWeight: 800, bgcolor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }} />
            <Box onClick={effectiveRefresh} sx={{ display: "flex", alignItems: "center", gap: 0.8, color: "#fff", fontWeight: 800, fontSize: 12, bgcolor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, px: 1.6, py: 0.7, cursor: "pointer" }}><Refresh sx={{ fontSize: 15 }} />Actualiser</Box>
            <Box sx={{ "& .MuiButton-root": { borderColor: "rgba(255,255,255,.55)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, textTransform: "none" } }}><FeedbackButton /></Box>
          </Stack>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} mb={3} sx={{ bgcolor: "#fff", p: 1, borderRadius: 14, border: `1px solid ${C.n200}`, width: "fit-content" }}>
        {tabs.map((tab, i) => (
          <TabPill key={tab.label} active={activeTab === i ? 1 : 0} onClick={() => setActiveTab(i)}>
            {React.cloneElement(tab.icon, { sx: { fontSize: 15, color: activeTab === i ? C.red : C.n400 } })}
            <span className="lbl">{tab.label}</span>
          </TabPill>
        ))}
      </Stack>

      {activeTab === 0 && (
        <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
          <Grid container spacing={2.5} mb={3}>
            <Grid item xs={12} sm={6} md={3}><KpiTile color={C.blue}><People sx={{ color: C.blue }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Membres équipe</Typography><Typography sx={{ fontSize: 24, fontWeight: 900, color: C.blue }}>{members.length}</Typography></Box></KpiTile></Grid>
            <Grid item xs={12} sm={6} md={3}><KpiTile color={C.purple}><PersonAdd sx={{ color: C.purple }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Prospects équipe</Typography><Typography sx={{ fontSize: 24, fontWeight: 900, color: C.purple }}>{prospects.length}</Typography><Typography sx={{ fontSize: 11, color: C.n500 }}>{hotProspects.length} chauds</Typography></Box></KpiTile></Grid>
            <Grid item xs={12} sm={6} md={3}><KpiTile color={C.amber}><CheckCircle sx={{ color: C.amber }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Tâches actives</Typography><Typography sx={{ fontSize: 24, fontWeight: 900, color: C.amber }}>{activeTasks.length}</Typography><Typography sx={{ fontSize: 11, color: C.n500 }}>{overdueTasks.length} en retard</Typography></Box></KpiTile></Grid>
            <Grid item xs={12} sm={6} md={3}><KpiTile color={C.green}><AttachMoney sx={{ color: C.green }} /><Box><Typography sx={{ fontSize: 10, color: C.n400, fontWeight: 800 }}>Pipeline équipe</Typography><Typography sx={{ fontSize: 24, fontWeight: 900, color: C.green }}>{fmtTND(pipeline)}</Typography><Typography sx={{ fontSize: 11, color: C.n500 }}>{wonOpps.length} gagnées</Typography></Box></KpiTile></Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} lg={8}><AiCenter prospects={prospects} tasks={tasks} opportunities={opportunities} /></Grid>
            <Grid item xs={12} lg={4}>
              <AccentCard accent={C.rose}>
                <SectionTitle icon={<Bolt sx={{ fontSize: 18 }} />} title="Actions immédiates" subtitle="Priorités du jour" />
                <Stack spacing={1.2}>
                  <MiniKpi label="Prospects chauds" value={hotProspects.length} icon={<AutoAwesome fontSize="small" />} color={C.amber} />
                  <MiniKpi label="Réponses à traiter" value={replies.length} icon={<MarkEmailRead fontSize="small" />} color={C.blue} />
                  <MiniKpi label="Tâches en retard" value={overdueTasks.length} icon={<Warning fontSize="small" />} color={C.red} />
                </Stack>
              </AccentCard>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} lg={7}>
              <AccentCard accent={C.blue}>
                <SectionTitle icon={<BarChartIcon sx={{ fontSize: 18 }} />} title="Performance équipe" subtitle="Prospects et tâches terminées par commercial" />
                {barData.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.n200} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.n400 }} />
                      <YAxis tick={{ fontSize: 11, fill: C.n400 }} allowDecimals={false} />
                      <ReTooltip />
                      <Bar dataKey="Prospects" fill={C.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Taches" fill={C.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune donnée.</Typography>}
              </AccentCard>
            </Grid>
            <Grid item xs={12} lg={5}>
              <AccentCard accent={C.teal}>
                <SectionTitle icon={<Timeline sx={{ fontSize: 18 }} />} title="Évolution mensuelle" subtitle="Prospects et opportunités" />
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gProspects" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.25} /><stop offset="95%" stopColor={C.blue} stopOpacity={0} /></linearGradient>
                      <linearGradient id="gOpps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.green} stopOpacity={0.25} /><stop offset="95%" stopColor={C.green} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.n200} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.n400 }} />
                    <YAxis tick={{ fontSize: 11, fill: C.n400 }} allowDecimals={false} />
                    <ReTooltip />
                    <Area type="monotone" dataKey="Prospects" stroke={C.blue} fill="url(#gProspects)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Opportunites" stroke={C.green} fill="url(#gOpps)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </AccentCard>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} lg={6}><PipelineFunnel opportunities={opportunities} /></Grid>
            <Grid item xs={12} lg={6}>
              <AccentCard accent={C.blue}>
                <SectionTitle icon={<MapIcon sx={{ fontSize: 18 }} />} title="Répartition géographique" subtitle="Google Maps des prospects de l'équipe" />
                <GeoProspectsMap prospects={prospects} />
              </AccentCard>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} lg={6}><SmartAlerts prospects={prospects} tasks={tasks} opportunities={opportunities} members={members} /></Grid>
            <Grid item xs={12} lg={6}><ManagerRecommendations prospects={prospects} tasks={tasks} opportunities={opportunities} leaderboard={[]} /></Grid>
          </Grid>

          <AccentCard accent={C.purple}>
            <SectionTitle icon={<People sx={{ fontSize: 18 }} />} title="Membres de l'équipe" subtitle="Suivi rapide des commerciaux" />
            <Grid container spacing={1.5}>
              {members.map((m) => {
                const mt = tasks.filter((t) => t.assigned_to === m.id);
                const md = mt.filter((t) => t.status === "done");
                const pct = mt.length ? Math.round((md.length / mt.length) * 100) : 0;
                return (
                  <Grid item xs={12} sm={6} md={4} key={m.id}>
                    <Box sx={{ p: 1.5, borderRadius: 12, border: `1px solid ${C.n200}`, bgcolor: C.n50 }}>
                      <Stack direction="row" alignItems="center" spacing={1.2} mb={1}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(C.blue, 0.12), color: C.blue, fontWeight: 800 }}>{m.username?.[0]?.toUpperCase()}</Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: C.n800 }}>{m.username}</Typography>
                          <Typography sx={{ fontSize: 10, color: C.n400 }}>{m.role}</Typography>
                        </Box>
                        <Chip size="small" label={`${md.length}/${mt.length}`} sx={{ fontSize: 10, bgcolor: alpha(C.green, 0.1), color: C.green, fontWeight: 800 }} />
                      </Stack>
                      <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 3, bgcolor: C.n100, "& .MuiLinearProgress-bar": { bgcolor: C.green, borderRadius: 3 } }} />
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </AccentCard>
        </Box>
      )}

      {activeTab === 1 && <TeamPerformanceTab members={members} prospects={prospects} tasks={tasks} opportunities={opportunities} />}
    </Box>
  );

  if (!data) {
    return (
      <DashboardDataFrame loading={standaloneBlocked && remote.loading} error={standaloneBlocked ? remote.error : null} onRefresh={remote.refresh} lastUpdated={remote.lastUpdated}>
        {standaloneBlocked ? null : body}
      </DashboardDataFrame>
    );
  }

  return body;
}

ManagerDashboard.propTypes = { data: PropTypes.object, onRefresh: PropTypes.func };
ManagerDashboard.defaultProps = { data: null, onRefresh: null };
