/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminDashboard.js
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  IconButton,
  Tooltip,
  Paper,
} from "@mui/material";
import {
  Business,
  People,
  TrendingUp,
  Subscriptions,
  CheckCircle,
  HourglassEmpty,
  Warning,
  AdminPanelSettings,
  NotificationsActive,
  Star as StarIcon,
  Feedback as FeedbackIcon,
  Map as MapIcon,
  Apps as AppsIcon,
  PersonAdd as PersonAddIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
  Campaign as CampaignIcon,
  SmartToy,
} from "@mui/icons-material";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { alpha } from "@mui/material/styles";
import SuperAdminLayout from "./SuperAdminLayout";
import { apiGet, apiPatch, safeArray, SA_ENDPOINTS } from "./saUtils";

// ── Palette ──────────────────────────────────────────────────
const T = {
  red: "#dc2626",
  purple: "#7c3aed",
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  n50: "#f9fafb",
  n100: "#f3f4f6",
  n200: "#e5e7eb",
  n500: "#6b7280",
  n800: "#1f2937",
};

const MARKETING_COLORS = [
  "#dc2626",
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#00bcd4",
  "#ff5722",
];

const PLAN_COLORS = { starter: T.green, pro: T.blue, enterprise: T.purple };

const FEEDBACK_STATUS_COLORS = {
  new: { label: "Nouveau", color: "#2196f3" },
  in_review: { label: "En examen", color: "#ff9800" },
  done: { label: "Traité", color: "#4caf50" },
  rejected: { label: "Rejeté", color: "#f44336" },
};

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        p: 3,
        bgcolor: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        borderLeft: `4px solid ${color}`,
        transition: "transform .2s, box-shadow .2s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(0,0,0,0.10)" },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography
            variant="caption"
            sx={{ color: T.n500, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}
          >
            {label}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, color: T.n800, my: 0.5 }}>
            {value ?? <CircularProgress size={22} />}
          </Typography>
          {sub && (
            <Typography variant="caption" sx={{ color: T.n500 }}>
              {sub}
            </Typography>
          )}
        </Box>
        <Avatar sx={{ width: 52, height: 52, bgcolor: alpha(color, 0.12) }}>
          {React.cloneElement(icon, { sx: { color, fontSize: 26 } })}
        </Avatar>
      </Stack>
    </Card>
  );
}

StatCard.propTypes = {
  icon: PropTypes.element.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  color: PropTypes.string.isRequired,
  sub: PropTypes.string,
};
StatCard.defaultProps = { value: null, sub: null };

// ── SectionCard ───────────────────────────────────────────────
function SectionCard({ title, icon, children }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        height: "100%",
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Box sx={{ color: T.red }}>{icon}</Box>
          <Typography variant="h6" fontWeight={600} color={T.n800}>
            {title}
          </Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

SectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.element.isRequired,
  children: PropTypes.node.isRequired,
};

// ════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [growthData, setGrowthData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [marketingData, setMarketingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackFilter, setFeedbackFilter] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // ── Charger données CRM ──────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiGet(SA_ENDPOINTS.stats),
      apiGet(SA_ENDPOINTS.dashboardGrowth),
      apiGet("/api/superadmin/companies/?page_size=5&ordering=-created_at"),
      apiGet("/api/superadmin/users/?page_size=5"),
    ])
      .then(([s, g, c, u]) => {
        setStats(s.data);
        setGrowthData(safeArray(g.data));
        setCompanies(c.data.results || c.data);
        setUsers(u.data.results || u.data);
      })
      .catch((e) => {
        console.error(e);
        setError("Impossible de charger les données.");
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Charger données Marketing (quand onglet activé) ──────────
  useEffect(() => {
    if (activeTab !== 1 || marketingData) return;
    setMarketingLoading(true);
    apiGet(SA_ENDPOINTS.marketingDashboard)
      .then((res) => setMarketingData(res.data))
      .catch((e) => console.error("Marketing error:", e))
      .finally(() => setMarketingLoading(false));
  }, [activeTab, marketingData]);

  const reloadMarketing = () => {
    setMarketingLoading(true);
    apiGet(SA_ENDPOINTS.marketingDashboard)
      .then((res) => setMarketingData(res.data))
      .catch((e) => console.error(e))
      .finally(() => setMarketingLoading(false));
  };

  const updateFeedbackStatus = async (id, newStatus) => {
    try {
      await apiPatch(SA_ENDPOINTS.feedback(id), { status: newStatus });
      reloadMarketing();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading)
    return (
      <SuperAdminLayout>
        <Box
          sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}
        >
          <CircularProgress sx={{ color: T.red }} size={48} />
        </Box>
      </SuperAdminLayout>
    );

  if (error)
    return (
      <SuperAdminLayout>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </SuperAdminLayout>
    );

  // ── Données graphiques CRM ────────────────────────────────────
  const pieData = Object.entries(stats?.companies_by_plan || {}).map(([name, value]) => ({
    name,
    value,
  }));
  const barData = [
    { name: "Actifs", value: stats?.active_subscriptions || 0 },
    { name: "Essai", value: stats?.trial_subscriptions || 0 },
    { name: "Expirés", value: stats?.expired_subscriptions || 0 },
  ];
  const areaData = growthData.map((row) => ({
    mois: row.month,
    entreprises: row.companies || 0,
    prospects: row.prospects || 0,
    opportunites: row.opportunities || 0,
    revenus: row.revenue || 0,
  }));
  const totalSubs =
    (stats?.active_subscriptions || 0) +
    (stats?.trial_subscriptions || 0) +
    (stats?.expired_subscriptions || 0);
  const conversionRate =
    totalSubs > 0 ? Math.round(((stats?.active_subscriptions || 0) / totalSubs) * 100) : 0;
  const hasAlerts =
    (stats?.trial_subscriptions || 0) > 0 || (stats?.expired_subscriptions || 0) > 0;
  const supervisionAlerts = stats?.supervision_alerts || [];
  const recentActivities = stats?.recent_user_activities || [];
  const recentAgentRuns = stats?.recent_agent_runs || [];
  const fmtDateTime = (value) =>
    value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
  const alertPalette = {
    error: T.red,
    warning: T.amber,
    info: T.blue,
  };

  // ── Marketing data helpers ────────────────────────────────────
  const mkt = marketingData;
  const filteredFeedbacks = mkt
    ? feedbackFilter
      ? mkt.recent_feedbacks.filter((f) => f.status === feedbackFilter)
      : mkt.recent_feedbacks
    : [];

  return (
    <SuperAdminLayout>
      {/* ── Header ──────────────────────────────────────── */}
      <Card
        sx={{
          borderRadius: 3,
          p: 4,
          mb: 3,
          color: "white",
          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          boxShadow: "0 8px 32px rgba(220,38,38,0.25)",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: "rgba(255,255,255,0.15)" }}>
              <AdminPanelSettings sx={{ fontSize: 30 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Vue globale — Super Admin
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Bienvenue, {user.username} · Plateforme CRM
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Chip
              label={`${stats?.new_companies_this_month ?? 0} nouveaux ce mois`}
              sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600 }}
            />
            <Chip
              label={`${conversionRate}% conversion`}
              sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600 }}
            />
            {mkt && (
              <Chip
                label={`★ ${mkt.quick_stats.avg_rating}/5`}
                sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 600 }}
              />
            )}
          </Stack>
        </Stack>
      </Card>

      {/* ── Onglets ──────────────────────────────────────── */}
      <Card sx={{ borderRadius: 3, mb: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            px: 2,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              minHeight: 56,
            },
            "& .Mui-selected": { color: T.red },
            "& .MuiTabs-indicator": { bgcolor: T.red, height: 3, borderRadius: 2 },
          }}
        >
          <Tab icon={<DashboardIcon />} iconPosition="start" label="Vue d'ensemble" />
          <Tab icon={<CampaignIcon />} iconPosition="start" label="Marketing & Feedback" />
        </Tabs>
      </Card>

      {/* ════════════════════════════════════════════════════
          ONGLET 0 — VUE D'ENSEMBLE
      ════════════════════════════════════════════════════ */}
      {activeTab === 0 && (
        <Box>
          {/* Alertes */}
          {hasAlerts && (
            <Stack spacing={1.5} mb={3}>
              {(stats?.expired_subscriptions || 0) > 0 && (
                <Alert
                  severity="error"
                  icon={<Warning />}
                  sx={{ borderRadius: 2, fontWeight: 500 }}
                >
                  {stats.expired_subscriptions} abonnement
                  {stats.expired_subscriptions > 1 ? "s" : ""} expiré
                  {stats.expired_subscriptions > 1 ? "s" : ""} — action requise
                </Alert>
              )}
              {(stats?.trial_subscriptions || 0) > 0 && (
                <Alert
                  severity="warning"
                  icon={<NotificationsActive />}
                  sx={{ borderRadius: 2, fontWeight: 500 }}
                >
                  {stats.trial_subscriptions} entreprise{stats.trial_subscriptions > 1 ? "s" : ""}{" "}
                  en période d&apos;essai
                </Alert>
              )}
            </Stack>
          )}

          {/* Centre supervision */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  height: "100%",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.2} mb={2}>
                  <NotificationsActive sx={{ color: T.red }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: T.n800 }}>
                    Points à surveiller
                  </Typography>
                </Stack>
                <Stack spacing={1.2}>
                  {supervisionAlerts.length > 0 ? (
                    supervisionAlerts.map((item) => {
                      const color = alertPalette[item.severity] || T.blue;
                      return (
                        <Box
                          key={`${item.title}-${item.message}`}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: alpha(color, 0.08),
                            border: `1px solid ${alpha(color, 0.22)}`,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 700, color }}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.n500 }}>
                            {item.message}
                          </Typography>
                        </Box>
                      );
                    })
                  ) : (
                    <Alert severity="success" sx={{ borderRadius: 2 }}>
                      Aucun point critique détecté.
                    </Alert>
                  )}
                </Stack>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  height: "100%",
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <AppsIcon sx={{ color: T.blue }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: T.n800 }}>
                      Activité utilisateurs
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={`${stats?.active_users_today || 0} actifs aujourd'hui`}
                    sx={{ bgcolor: alpha(T.green, 0.1), color: T.green, fontWeight: 600 }}
                  />
                </Stack>
                <Stack spacing={1.3}>
                  {recentActivities.length > 0 ? (
                    recentActivities.slice(0, 5).map((activity) => (
                      <Box key={activity.id}>
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: T.n800 }}>
                              {activity.username || activity.email || "Utilisateur"}
                            </Typography>
                            <Typography variant="caption" sx={{ color: T.n500 }}>
                              {activity.module_label} · {activity.company_name || "Sans entreprise"}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ color: T.n500, whiteSpace: "nowrap" }}>
                            {fmtDateTime(activity.created_at)}
                          </Typography>
                        </Stack>
                        <Divider sx={{ mt: 1.2 }} />
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Aucune activité récente.
                    </Typography>
                  )}
                </Stack>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  height: "100%",
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    <SmartToy sx={{ color: T.purple }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: T.n800 }}>
                      Agents IA récents
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={`${stats?.ai_failed_runs || 0} échecs`}
                    sx={{
                      bgcolor: alpha(stats?.ai_failed_runs ? T.red : T.green, 0.1),
                      color: stats?.ai_failed_runs ? T.red : T.green,
                      fontWeight: 600,
                    }}
                  />
                </Stack>
                <Stack spacing={1.3}>
                  {recentAgentRuns.length > 0 ? (
                    recentAgentRuns.slice(0, 5).map((run) => (
                      <Box key={run.id}>
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: T.n800 }}>
                              {run.agent_type}
                            </Typography>
                            <Typography variant="caption" sx={{ color: T.n500 }}>
                              {run.company_name || "Sans entreprise"} · {run.launched_by || "Système"}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={run.status}
                            sx={{
                              height: 22,
                              bgcolor:
                                run.status === "success"
                                  ? alpha(T.green, 0.12)
                                  : run.status === "failed"
                                  ? alpha(T.red, 0.12)
                                  : alpha(T.blue, 0.12),
                              color:
                                run.status === "success"
                                  ? T.green
                                  : run.status === "failed"
                                  ? T.red
                                  : T.blue,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          />
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            color: T.n500,
                            display: "block",
                            mt: 0.3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {run.query || run.error_message || fmtDateTime(run.started_at)}
                        </Typography>
                        <Divider sx={{ mt: 1.2 }} />
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Aucun agent exécuté récemment.
                    </Typography>
                  )}
                </Stack>
              </Card>
            </Grid>
          </Grid>

          {/* KPIs ligne 1 */}
          <Grid container spacing={3} mb={3}>
            {[
              {
                icon: <Business />,
                label: "Entreprises",
                value: stats?.total_companies,
                color: T.blue,
                sub: `+${stats?.new_companies_this_month ?? 0} ce mois`,
              },
              {
                icon: <People />,
                label: "Utilisateurs",
                value: stats?.total_users,
                color: T.purple,
              },
              {
                icon: <CheckCircle />,
                label: "Abonnements actifs",
                value: stats?.active_subscriptions,
                color: T.green,
              },
              {
                icon: <TrendingUp />,
                label: "Revenus mensuels",
                value: stats ? `${stats.total_revenue_monthly} TND` : null,
                color: T.amber,
              },
            ].map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.label}>
                <StatCard {...s} />
              </Grid>
            ))}
          </Grid>

          {/* KPIs ligne 2 */}
          <Grid container spacing={3} mb={3}>
            {[
              {
                icon: <HourglassEmpty />,
                label: "En essai",
                value: stats?.trial_subscriptions,
                color: T.amber,
              },
              {
                icon: <Warning />,
                label: "Expirés",
                value: stats?.expired_subscriptions,
                color: T.red,
              },
              {
                icon: <Subscriptions />,
                label: "Total abonnements",
                value: totalSubs,
                color: T.blue,
              },
              {
                icon: <TrendingUp />,
                label: "Taux conversion",
                value: `${conversionRate}%`,
                color: T.green,
              },
            ].map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.label}>
                <StatCard {...s} />
              </Grid>
            ))}
          </Grid>

          {/* Graphiques ligne 1 */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} md={7}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: T.n800 }}>
                  Évolution (5 derniers mois)
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.blue} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.green} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={T.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
                    <XAxis dataKey="mois" tick={{ fontSize: 12, fill: T.n500 }} />
                    <YAxis tick={{ fontSize: 12, fill: T.n500 }} />
                    <ReTooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="entreprises"
                      name="Entreprises"
                      stroke={T.blue}
                      fill="url(#gEnt)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenus"
                      name="Revenus (TND)"
                      stroke={T.green}
                      fill="url(#gRev)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Grid>

            <Grid item xs={12} md={5}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: T.n800 }}>
                  Répartition par plan
                </Typography>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || T.blue} />
                        ))}
                      </Pie>
                      <ReTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 240,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: T.n500 }}>
                      Aucune donnée
                    </Typography>
                  </Box>
                )}
              </Card>
            </Grid>
          </Grid>

          {/* Graphiques ligne 2 */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: T.n800 }}>
                  Statut des abonnements
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={50}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: T.n500 }} />
                    <YAxis tick={{ fontSize: 13, fill: T.n500 }} allowDecimals={false} />
                    <ReTooltip />
                    <Bar dataKey="value" name="Entreprises" radius={[6, 6, 0, 0]}>
                      {barData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.name === "Actifs"
                              ? T.green
                              : entry.name === "Essai"
                              ? T.amber
                              : T.red
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  height: "100%",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: T.n800 }}>
                  Résumé financier
                </Typography>
                <Stack spacing={1.5}>
                  {[
                    {
                      label: "Revenus mensuels",
                      value: `${stats?.total_revenue_monthly || 0} TND`,
                      color: T.green,
                    },
                    {
                      label: "Abonnements actifs",
                      value: stats?.active_subscriptions || 0,
                      color: T.blue,
                    },
                    {
                      label: "En période d'essai",
                      value: stats?.trial_subscriptions || 0,
                      color: T.amber,
                    },
                    {
                      label: "Abonnements expirés",
                      value: stats?.expired_subscriptions || 0,
                      color: T.red,
                    },
                    { label: "Taux de conversion", value: `${conversionRate}%`, color: T.purple },
                  ].map(({ label, value, color }) => (
                    <Box
                      key={label}
                      sx={{
                        p: 2,
                        bgcolor: T.n100,
                        borderRadius: 2,
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ color: T.n500 }}>
                          {label}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color }}>
                          {value}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Card>
            </Grid>
          </Grid>

          {/* Données récentes */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: T.n800 }}>
                  Entreprises récentes
                </Typography>
                {companies.length === 0 ? (
                  <Typography variant="body2" sx={{ color: T.n500 }}>
                    Aucune entreprise
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {companies.map((c, i) => (
                      <Box key={c.id}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Avatar
                              sx={{
                                width: 34,
                                height: 34,
                                bgcolor: alpha(T.blue, 0.1),
                                fontSize: 13,
                              }}
                            >
                              {c.name?.[0]?.toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: T.n800 }}>
                                {c.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: T.n500 }}>
                                {c.owner_email} · {c.users_count} user
                                {c.users_count !== 1 ? "s" : ""}
                              </Typography>
                            </Box>
                          </Stack>
                          <Stack direction="row" spacing={0.5}>
                            <Chip
                              size="small"
                              label={c.subscription_plan || "aucun"}
                              sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                bgcolor: c.subscription_active ? alpha(T.green, 0.1) : T.n100,
                                color: c.subscription_active ? T.green : T.n500,
                              }}
                            />
                            {c.is_trial && (
                              <Chip
                                size="small"
                                label="essai"
                                sx={{ fontSize: 10, bgcolor: alpha(T.amber, 0.1), color: T.amber }}
                              />
                            )}
                          </Stack>
                        </Stack>
                        {i < companies.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card
                sx={{
                  borderRadius: 3,
                  p: 3,
                  bgcolor: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: T.n800 }}>
                  Utilisateurs récents
                </Typography>
                {users.length === 0 ? (
                  <Typography variant="body2" sx={{ color: T.n500 }}>
                    Aucun utilisateur
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {users.map((u, i) => (
                      <Box key={u.id}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Avatar
                              sx={{
                                width: 34,
                                height: 34,
                                bgcolor: alpha(T.purple, 0.1),
                                fontSize: 13,
                              }}
                            >
                              {u.username?.[0]?.toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: T.n800 }}>
                                {u.username}
                              </Typography>
                              <Typography variant="caption" sx={{ color: T.n500 }}>
                                {u.email} · {u.company_name || "sans company"}
                              </Typography>
                            </Box>
                          </Stack>
                          <Chip
                            size="small"
                            label={u.role}
                            sx={{
                              fontSize: 10,
                              fontWeight: 600,
                              bgcolor:
                                u.role === "ADMIN"
                                  ? alpha(T.blue, 0.1)
                                  : u.role === "MANAGER"
                                  ? alpha(T.purple, 0.1)
                                  : T.n100,
                              color:
                                u.role === "ADMIN"
                                  ? T.blue
                                  : u.role === "MANAGER"
                                  ? T.purple
                                  : T.n500,
                            }}
                          />
                        </Stack>
                        {i < users.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ════════════════════════════════════════════════════
          ONGLET 1 — MARKETING & FEEDBACK
      ════════════════════════════════════════════════════ */}
      {activeTab === 1 && (
        <Box>
          {marketingLoading ? (
            <Box sx={{ p: 4 }}>
              <LinearProgress
                sx={{
                  borderRadius: 1,
                  bgcolor: alpha(T.red, 0.1),
                  "& .MuiLinearProgress-bar": { bgcolor: T.red },
                }}
              />
              <Typography align="center" mt={2} color="text.secondary">
                Chargement des données marketing...
              </Typography>
            </Box>
          ) : !mkt ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              Erreur lors du chargement des données marketing.
            </Alert>
          ) : (
            <>
              {/* Header marketing */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={700} color={T.n800}>
                  Analyse Marketing & Feedback
                </Typography>
                <Tooltip title="Actualiser">
                  <IconButton
                    onClick={reloadMarketing}
                    sx={{ bgcolor: alpha(T.red, 0.08), color: T.red }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Stats rapides marketing */}
              <Grid container spacing={2} mb={3}>
                {[
                  {
                    icon: <People />,
                    label: "Total utilisateurs",
                    value: mkt.quick_stats.total_users,
                    color: T.red,
                    sub: `+${mkt.quick_stats.new_this_month} ce mois`,
                  },
                  {
                    icon: <Business />,
                    label: "Total entreprises",
                    value: mkt.quick_stats.total_companies,
                    color: T.blue,
                  },
                  {
                    icon: <StarIcon />,
                    label: "Note moyenne",
                    value: `${mkt.quick_stats.avg_rating}/5`,
                    color: T.amber,
                    sub: `${mkt.quick_stats.total_ratings} avis`,
                  },
                  {
                    icon: <PersonAddIcon />,
                    label: "Actifs aujourd'hui",
                    value: mkt.quick_stats.active_today,
                    color: T.green,
                    sub: `${mkt.quick_stats.active_week} cette semaine`,
                  },
                ].map((s) => (
                  <Grid item xs={12} sm={6} md={3} key={s.label}>
                    <StatCard {...s} />
                  </Grid>
                ))}
              </Grid>

              {/* Croissance + Sources */}
              <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={8}>
                  <SectionCard title="Croissance des utilisateurs" icon={<TrendingUp />}>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={mkt.user_growth}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <ReTooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke={T.red}
                          strokeWidth={3}
                          dot={{ fill: T.red, r: 4 }}
                          name="Nouveaux utilisateurs"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </Grid>

                <Grid item xs={12} md={4}>
                  <SectionCard title="Sources d'acquisition" icon={<PersonAddIcon />}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={mkt.acquisition_sources}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={({ percentage }) => `${percentage}%`}
                          labelLine={false}
                        >
                          {mkt.acquisition_sources.map((_, i) => (
                            <Cell key={i} fill={MARKETING_COLORS[i % MARKETING_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip formatter={(val, name) => [val, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Stack spacing={0.5} mt={1}>
                      {mkt.acquisition_sources.slice(0, 4).map((s, i) => (
                        <Stack
                          key={s.source}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: MARKETING_COLORS[i % MARKETING_COLORS.length],
                              }}
                            />
                            <Typography variant="caption">{s.label}</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={600}>
                            {s.percentage}%
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </SectionCard>
                </Grid>
              </Grid>

              {/* Ratings + Modules + Géo */}
              <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={4}>
                  <SectionCard title="Évaluation de l'application" icon={<StarIcon />}>
                    <Box textAlign="center" mb={2}>
                      <Typography variant="h2" fontWeight={700} sx={{ color: T.amber }}>
                        {mkt.quick_stats.avg_rating}
                      </Typography>
                      <Stack direction="row" justifyContent="center" spacing={0.3}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <StarIcon
                            key={s}
                            sx={{
                              fontSize: 20,
                              color: s <= Math.round(mkt.quick_stats.avg_rating) ? T.amber : T.n200,
                            }}
                          />
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {mkt.quick_stats.total_ratings} avis
                      </Typography>
                    </Box>
                    <Stack spacing={1}>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const found = mkt.ratings_distribution.find((r) => r.stars === star);
                        const pct = found ? found.percentage : 0;
                        return (
                          <Stack key={star} direction="row" alignItems="center" spacing={1}>
                            <Typography variant="caption" sx={{ minWidth: 16 }}>
                              {star}★
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{
                                flex: 1,
                                height: 8,
                                borderRadius: 4,
                                bgcolor: alpha(T.amber, 0.1),
                                "& .MuiLinearProgress-bar": { bgcolor: T.amber, borderRadius: 4 },
                              }}
                            />
                            <Typography variant="caption" sx={{ minWidth: 35 }}>
                              {pct}%
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </SectionCard>
                </Grid>

                <Grid item xs={12} md={4}>
                  <SectionCard title="Modules les plus utilisés" icon={<AppsIcon />}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={mkt.modules_usage} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={90} />
                        <ReTooltip />
                        <Bar dataKey="count" name="Utilisations" radius={[0, 4, 4, 0]}>
                          {mkt.modules_usage.map((_, i) => (
                            <Cell key={i} fill={MARKETING_COLORS[i % MARKETING_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </Grid>

                <Grid item xs={12} md={4}>
                  <SectionCard title="Analyse géographique" icon={<MapIcon />}>
                    <Stack spacing={1.5} mt={1}>
                      {mkt.geography.length > 0 ? (
                        mkt.geography.map((g, i) => (
                          <Box key={g.country}>
                            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                              <Typography variant="body2">{g.country}</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {g.percentage}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={g.percentage}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: alpha(MARKETING_COLORS[i % MARKETING_COLORS.length], 0.1),
                                "& .MuiLinearProgress-bar": {
                                  bgcolor: MARKETING_COLORS[i % MARKETING_COLORS.length],
                                  borderRadius: 3,
                                },
                              }}
                            />
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          Aucune donnée géographique
                        </Typography>
                      )}
                    </Stack>
                  </SectionCard>
                </Grid>
              </Grid>

              {/* Top entreprises + Feedbacks */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <SectionCard title="Top entreprises actives" icon={<TrophyIcon />}>
                    <Stack spacing={1.5}>
                      {mkt.top_companies.length > 0 ? (
                        mkt.top_companies.map((c, i) => (
                          <Paper
                            key={c.company}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: alpha(MARKETING_COLORS[i % MARKETING_COLORS.length], 0.05),
                              border: `1px solid ${alpha(
                                MARKETING_COLORS[i % MARKETING_COLORS.length],
                                0.15
                              )}`,
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Avatar
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    fontSize: "0.8rem",
                                    bgcolor: MARKETING_COLORS[i % MARKETING_COLORS.length],
                                  }}
                                >
                                  {i + 1}
                                </Avatar>
                                <Typography variant="body2" fontWeight={500}>
                                  {c.company}
                                </Typography>
                              </Stack>
                              <Chip
                                label={`${c.actions} actions`}
                                size="small"
                                sx={{
                                  bgcolor: alpha(
                                    MARKETING_COLORS[i % MARKETING_COLORS.length],
                                    0.1
                                  ),
                                  color: MARKETING_COLORS[i % MARKETING_COLORS.length],
                                  fontSize: "0.7rem",
                                }}
                              />
                            </Stack>
                          </Paper>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          Aucune activité enregistrée
                        </Typography>
                      )}
                    </Stack>
                  </SectionCard>
                </Grid>

                <Grid item xs={12} md={8}>
                  <SectionCard title="Feedbacks utilisateurs" icon={<FeedbackIcon />}>
                    <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                      {Object.entries(FEEDBACK_STATUS_COLORS).map(([key, val]) => (
                        <Chip
                          key={key}
                          label={`${val.label}: ${mkt.feedback_status[key] || 0}`}
                          size="small"
                          sx={{
                            bgcolor: alpha(val.color, 0.1),
                            color: val.color,
                            border: `1px solid ${alpha(val.color, 0.3)}`,
                          }}
                        />
                      ))}
                    </Stack>
                    <Stack direction="row" justifyContent="flex-end" mb={1}>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <Select
                          value={feedbackFilter}
                          onChange={(e) => setFeedbackFilter(e.target.value)}
                          displayEmpty
                          sx={{ borderRadius: 2, fontSize: "0.8rem" }}
                        >
                          <MenuItem value="">Tous les statuts</MenuItem>
                          {Object.entries(FEEDBACK_STATUS_COLORS).map(([key, val]) => (
                            <MenuItem key={key} value={key}>
                              {val.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            {["Utilisateur", "Catégorie", "Message", "Statut", "Action"].map(
                              (h) => (
                                <TableCell
                                  key={h}
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    bgcolor: alpha(T.red, 0.04),
                                    color: T.red,
                                  }}
                                >
                                  {h}
                                </TableCell>
                              )
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredFeedbacks.length > 0 ? (
                            filteredFeedbacks.map((f) => (
                              <TableRow key={f.id} hover>
                                <TableCell sx={{ fontSize: "0.75rem" }}>
                                  <Typography variant="caption" fontWeight={600}>
                                    {f.username}
                                  </Typography>
                                  {f.company_name && (
                                    <Typography
                                      variant="caption"
                                      display="block"
                                      color="text.secondary"
                                    >
                                      {f.company_name}
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={f.category}
                                    size="small"
                                    sx={{ fontSize: "0.65rem", height: 20 }}
                                  />
                                </TableCell>
                                <TableCell sx={{ fontSize: "0.75rem", maxWidth: 200 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                    }}
                                  >
                                    {f.message}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={FEEDBACK_STATUS_COLORS[f.status]?.label || f.status}
                                    size="small"
                                    sx={{
                                      fontSize: "0.65rem",
                                      height: 20,
                                      bgcolor: alpha(
                                        FEEDBACK_STATUS_COLORS[f.status]?.color || "#999",
                                        0.1
                                      ),
                                      color: FEEDBACK_STATUS_COLORS[f.status]?.color || "#999",
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <FormControl size="small">
                                    <Select
                                      value={f.status}
                                      onChange={(e) => updateFeedbackStatus(f.id, e.target.value)}
                                      sx={{ fontSize: "0.7rem", height: 28, borderRadius: 1 }}
                                    >
                                      {Object.entries(FEEDBACK_STATUS_COLORS).map(([key, val]) => (
                                        <MenuItem
                                          key={key}
                                          value={key}
                                          sx={{ fontSize: "0.75rem" }}
                                        >
                                          {val.label}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} align="center">
                                <Typography variant="caption" color="text.secondary">
                                  Aucun feedback
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </SectionCard>
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      )}
    </SuperAdminLayout>
  );
}
