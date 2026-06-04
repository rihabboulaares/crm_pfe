/* eslint-disable prettier/prettier */
// src/pages/modules/CommercialDashboard.jsx — v2 Redesigned
import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Grid,
  Card,
  Typography,
  Box,
  Stack,
  Avatar,
  Chip,
  Divider,
  LinearProgress,
  Alert,
  Tab,
  Tabs,
  Paper,
} from "@mui/material";
import {
  PersonAdd,
  CheckCircle,
  AttachMoney,
  Contacts,
  TrendingUp,
  Warning,
  AccessTime,
  Star,
  EmojiEvents,
  RateReview,
} from "@mui/icons-material";
import { alpha, styled, keyframes } from "@mui/material/styles";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import {
  ScoreRing,
  ScoreBreakdownCard,
  ActivityCounters,
  BadgeChip,
  GoalRow,
  Sparkline,
  FeedbackCard,
  PerfSkeleton,
  T,
  scoreColor,
} from "./PerformanceWidgets";
import {
  useMyKPI,
  useHistory,
  useMyGoals,
  useMyBadges,
  useMyFeedbacks,
} from "../../hooks/usePerformance";
import { FeedbackButton, useTrackActivity } from "../superadmin/Marketingwidgets";

const toList = (d) => (Array.isArray(d) ? d : d?.results || []);

// ─── DESIGN TOKENS ──────────────────────────────────────────────
const C = {
  red: "#dc2626",
  redLight: "#fee2e2",
  redSoft: alpha("#dc2626", 0.07),
  green: "#059669",
  greenLight: "#d1fae5",
  blue: "#2563eb",
  blueLight: "#dbeafe",
  amber: "#d97706",
  amberLight: "#fef3c7",
  purple: "#7c3aed",
  purpleLight: "#ede9fe",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n400: "#94a3b8",
  n500: "#64748b",
  n600: "#475569",
  n800: "#1e293b",
  grad: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
};

const fadeUp = keyframes`
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
`;

// ─── STYLED ─────────────────────────────────────────────────────
const PageCard = styled(Box)(() => ({
  background: "#fff",
  border: `1px solid ${C.n200}`,
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  transition: "box-shadow 0.2s",
  "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.09)" },
}));

const AccentCard = styled(Box)(({ accent = C.red }) => ({
  background: "#fff",
  border: `1px solid ${C.n200}`,
  borderRadius: 16,
  borderTop: `3px solid ${accent}`,
  padding: "20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
}));

const KpiBox = styled(Box)(({ color = C.red }) => ({
  flex: 1,
  padding: "16px 14px",
  borderRadius: 14,
  background: alpha(color, 0.06),
  border: `1px solid ${alpha(color, 0.14)}`,
  textAlign: "center",
  transition: "transform 0.15s",
  "&:hover": { transform: "translateY(-2px)" },
}));

const TabBtn = styled(Box)(({ active }) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 18px",
  borderRadius: 10,
  cursor: "pointer",
  transition: "all 0.15s",
  background: active ? alpha(C.red, 0.08) : "transparent",
  border: active ? `1px solid ${alpha(C.red, 0.2)}` : "1px solid transparent",
  "& span": {
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? C.red : C.n500,
  },
}));

// ─── STAT CARD ───────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub }) {
  return (
    <AccentCard accent={color}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: C.n400,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              mb: 0.5,
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{ fontSize: 26, fontWeight: 900, color: C.n800, lineHeight: 1.1, mb: 0.4 }}
          >
            {value ?? "—"}
          </Typography>
          {sub && <Typography sx={{ fontSize: 11, color: C.n400 }}>{sub}</Typography>}
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 12,
            bgcolor: alpha(color, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {React.cloneElement(icon, { sx: { color, fontSize: 22 } })}
        </Box>
      </Stack>
    </AccentCard>
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

// ─── PERFORMANCE TAB ─────────────────────────────────────────────
function PerformanceTab() {
  const { data: kpi, loading: kpiLoading } = useMyKPI();
  const { data: history } = useHistory(null, 6);
  const { data: goals } = useMyGoals();
  const { data: badges } = useMyBadges();
  const { data: feedbacks } = useMyFeedbacks();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (kpiLoading) return <PerfSkeleton rows={5} />;
  if (!kpi)
    return (
      <Alert severity="info" sx={{ borderRadius: 2, fontSize: 13 }}>
        Aucune donnée de performance pour ce mois.
      </Alert>
    );

  const color = scoreColor(kpi.score);

  return (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
      {/* Hero score */}
      <PageCard sx={{ mb: 2.5 }}>
        <Box
          sx={{
            p: 3,
            background: `linear-gradient(135deg,${alpha(color, 0.07)},${alpha(color, 0.02)})`,
            borderBottom: `1px solid ${alpha(color, 0.1)}`,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={2}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.n400,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  mb: 0.5,
                }}
              >
                Mon score KPI —{" "}
                {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: C.n800, mb: 1 }}>
                {user.username}
              </Typography>
              <Stack direction="row" spacing={0.8} flexWrap="wrap">
                {badges.slice(0, 4).map((b) => (
                  <BadgeChip key={b.id} badgeType={b.badge_type} />
                ))}
              </Stack>
            </Box>
            <ScoreRing score={kpi.score} size={110} />
          </Stack>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={1.5}>
            {[
              { label: "Tâches", value: `${kpi.tasks_done}/${kpi.tasks_total}`, color: C.blue },
              { label: "Dans les temps", value: `${kpi.tasks_on_time}`, color: C.green },
              { label: "Deals gagnés", value: kpi.opportunities_won, color: C.amber },
              {
                label: "Pénalités",
                value: `${kpi.penalty_points} pts`,
                color: kpi.penalty_points < 0 ? C.red : C.green,
              },
            ].map((s) => (
              <Grid item xs={6} sm={3} key={s.label}>
                <KpiBox color={s.color}>
                  <Typography sx={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                    {s.value}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: C.n400, mt: 0.4 }}>{s.label}</Typography>
                </KpiBox>
              </Grid>
            ))}
          </Grid>
        </Box>
      </PageCard>

      <Grid container spacing={2.5} mb={2.5}>
        {/* Activités */}
        <Grid item xs={12} md={4}>
          <AccentCard accent={C.blue}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 2 }}>
              Mes activités ce mois
            </Typography>
            <ActivityCounters calls={kpi.calls} emails={kpi.emails} meetings={kpi.meetings} />
          </AccentCard>
        </Grid>
        {/* Décomposition */}
        <Grid item xs={12} md={8}>
          <ScoreBreakdownCard kpi={kpi} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mb={2.5}>
        {/* Évolution */}
        <Grid item xs={12} md={5}>
          <AccentCard accent={C.purple}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 1.5 }}>
              📅 Mon évolution (6 mois)
            </Typography>
            <Sparkline data={history} color={color} />
            <Stack direction="row" justifyContent="space-between" mt={0.8}>
              {history.slice(-6).map((h) => (
                <Typography key={h.label} sx={{ fontSize: 9, color: C.n400 }}>
                  {h.label}
                </Typography>
              ))}
            </Stack>
            {history.length >= 2 && (
              <Box sx={{ mt: 1.5, p: 1.2, bgcolor: alpha(C.n100, 0.8), borderRadius: 2 }}>
                <Typography sx={{ fontSize: 12, color: C.n500 }}>
                  Progression :&nbsp;
                  <strong
                    style={{
                      color:
                        history[history.length - 1]?.score > history[history.length - 2]?.score
                          ? C.green
                          : C.red,
                    }}
                  >
                    {history[history.length - 1]?.score > history[history.length - 2]?.score
                      ? "▲"
                      : "▼"}
                    {Math.abs(
                      Math.round(
                        (history[history.length - 1]?.score || 0) -
                          (history[history.length - 2]?.score || 0)
                      )
                    )}
                    %
                  </strong>
                  &nbsp;ce mois
                </Typography>
              </Box>
            )}
          </AccentCard>
        </Grid>
        {/* Objectifs */}
        <Grid item xs={12} md={7}>
          <AccentCard accent={C.amber}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 2 }}>
              🎯 Mes objectifs du mois
            </Typography>
            {goals.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <Typography sx={{ fontSize: 13, color: C.n400 }}>
                  Aucun objectif fixé par votre manager ce mois.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.8}>
                {goals.map((g) => (
                  <GoalRow key={g.id} goal={g} />
                ))}
              </Stack>
            )}
          </AccentCard>
        </Grid>
      </Grid>

      {/* Feedbacks reçus */}
      {feedbacks.length > 0 && (
        <AccentCard accent={C.red}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: C.grad,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RateReview sx={{ color: "#fff", fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                ✍️ Feedbacks de mon manager
              </Typography>
              <Typography sx={{ fontSize: 11, color: C.n400 }}>
                {feedbacks.length} feedback{feedbacks.length > 1 ? "s" : ""} reçu
                {feedbacks.length > 1 ? "s" : ""}
              </Typography>
            </Box>
          </Stack>
          <Stack spacing={1.2}>
            {feedbacks.slice(0, 3).map((f) => (
              <FeedbackCard key={f.id} feedback={f} />
            ))}
          </Stack>
        </AccentCard>
      )}
    </Box>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function CommercialDashboard({ data }) {
  const [activeTab, setActiveTab] = useState(0);
  useTrackActivity("dashboard");
  const prospects = toList(data?.prospects);
  const tasks = toList(data?.tasks);
  const opportunities = toList(data?.opportunities);
  const contacts = toList(data?.contacts);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.due_date &&
      new Date(t.due_date) < new Date()
  );
  const todayTasks = tasks.filter(
    (t) => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()
  );
  const doneTasks = tasks.filter((t) => t.status === "done");
  const activeTasks = tasks.filter((t) => t.status === "in_progress");
  const wonOpps = opportunities.filter((o) => o.stage === "won");
  const pipeline = opportunities.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const prospectPieData = Object.entries(
    prospects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({
    name:
      { new: "Nouveau", contacted: "Contacté", qualified: "Qualifié", lost: "Perdu", won: "Gagné" }[
        status
      ] || status,
    value: count,
    color:
      { new: C.blue, contacted: C.amber, qualified: C.green, lost: C.red, won: C.purple }[status] ||
      C.blue,
  }));

  const urgentTasks = [
    ...overdueTasks,
    ...todayTasks.filter((t) => !overdueTasks.includes(t)),
  ].slice(0, 6);
  const tabs = [
    { label: "Mon CRM", icon: <Star sx={{ fontSize: 15 }} /> },
    { label: "Ma Performance", icon: <EmojiEvents sx={{ fontSize: 15 }} /> },
  ];

  return (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
      {/* ── HEADER ── */}
      <Box
        sx={{
          borderRadius: 20,
          p: 3,
          mb: 3,
          position: "relative",
          overflow: "hidden",
          background: C.grad,
          boxShadow: `0 8px 28px ${alpha(C.red, 0.28)}`,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 180,
            height: 180,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.06)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: -30,
            left: "35%",
            width: 100,
            height: 100,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.04)",
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
          sx={{ position: "relative", zIndex: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: "rgba(255,255,255,0.2)",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {user.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.65)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  mb: 0.2,
                }}
              >
                Tableau de bord Commercial
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
                Bonjour, {user.username} 👋
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            {overdueTasks.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  bgcolor: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 20,
                  px: 1.5,
                  py: 0.6,
                }}
              >
                <Warning sx={{ fontSize: 14, color: "#fcd34d" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {overdueTasks.length} en retard
                </Typography>
              </Box>
            )}
            {todayTasks.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  bgcolor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 20,
                  px: 1.5,
                  py: 0.6,
                }}
              >
                <AccessTime sx={{ fontSize: 14, color: "#fff" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {todayTasks.length} aujourd&apos;hui
                </Typography>
              </Box>
            )}
            {/* Feedback superadmin */}
            <Box
              sx={{
                "& .MuiButton-root": {
                  borderColor: "rgba(255,255,255,0.55)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 20,
                  textTransform: "none",
                  px: 1.8,
                  py: 0.5,
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.15)" },
                },
              }}
            >
              <FeedbackButton />
            </Box>
          </Stack>
        </Stack>
      </Box>

      {overdueTasks.length > 0 && (
        <Alert severity="error" sx={{ borderRadius: 12, mb: 2.5, fontWeight: 600 }}>
          Vous avez {overdueTasks.length} tâche{overdueTasks.length > 1 ? "s" : ""} en retard —
          traitez-les en priorité !
        </Alert>
      )}

      {/* ── CUSTOM TABS ── */}
      <Stack
        direction="row"
        spacing={1}
        mb={3}
        sx={{
          bgcolor: "#fff",
          p: 1,
          borderRadius: 14,
          border: `1px solid ${C.n200}`,
          width: "fit-content",
        }}
      >
        {tabs.map((tab, i) => (
          <TabBtn key={i} active={activeTab === i ? 1 : 0} onClick={() => setActiveTab(i)}>
            {React.cloneElement(tab.icon, {
              sx: { fontSize: 15, color: activeTab === i ? C.red : C.n400 },
            })}
            <span>{tab.label}</span>
          </TabBtn>
        ))}
      </Stack>

      {/* ── CRM TAB ── */}
      {activeTab === 0 && (
        <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
          <Grid container spacing={2.5} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<PersonAdd />}
                label="Mes prospects"
                value={prospects.length}
                color={C.blue}
                sub={`${prospects.filter((p) => p.status === "new").length} nouveaux`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<CheckCircle />}
                label="Mes tâches"
                value={activeTasks.length}
                color={C.amber}
                sub={`${completionRate}% complétées`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<AttachMoney />}
                label="Mon pipeline"
                value={`${(pipeline / 1000).toFixed(1)}k TND`}
                color={C.green}
                sub={`${wonOpps.length} gagnées`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<Contacts />}
                label="Mes contacts"
                value={contacts.length}
                color={C.purple}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            {/* Progress */}
            <Grid item xs={12} md={4}>
              <AccentCard accent={C.green}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <TrendingUp sx={{ color: C.green, fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                    Ma progression
                  </Typography>
                </Stack>
                <Stack spacing={2}>
                  {[
                    {
                      label: "Tâches complétées",
                      value: completionRate,
                      color: C.green,
                      count: `${doneTasks.length}/${tasks.length}`,
                    },
                    {
                      label: "Prospects qualifiés",
                      value:
                        prospects.length > 0
                          ? Math.round(
                              (prospects.filter((p) => p.status === "qualified").length /
                                prospects.length) *
                                100
                            )
                          : 0,
                      color: C.blue,
                      count: `${prospects.filter((p) => p.status === "qualified").length}/${
                        prospects.length
                      }`,
                    },
                    {
                      label: "Opportunités gagnées",
                      value:
                        opportunities.length > 0
                          ? Math.round((wonOpps.length / opportunities.length) * 100)
                          : 0,
                      color: C.amber,
                      count: `${wonOpps.length}/${opportunities.length}`,
                    },
                  ].map(({ label, value, color, count }) => (
                    <Box key={label}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography sx={{ fontSize: 12, color: C.n500 }}>{label}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>
                          {count} ({value}%)
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={value}
                        sx={{
                          height: 5,
                          borderRadius: 3,
                          bgcolor: C.n100,
                          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </AccentCard>
            </Grid>

            {/* Pie */}
            <Grid item xs={12} md={4}>
              <AccentCard accent={C.red}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 1 }}>
                  Mes prospects
                </Typography>
                {prospectPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={prospectPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {prospectPieData.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucun prospect</Typography>
                  </Box>
                )}
              </AccentCard>
            </Grid>

            {/* Pipeline stages */}
            <Grid item xs={12} md={4}>
              <AccentCard accent={C.amber}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 2 }}>
                  Mon pipeline
                </Typography>
                {opportunities.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune opportunité</Typography>
                ) : (
                  <Stack spacing={1.2}>
                    {Object.entries(
                      opportunities.reduce((acc, o) => {
                        acc[o.stage] = (acc[o.stage] || 0) + parseFloat(o.amount || 0);
                        return acc;
                      }, {})
                    ).map(([stage, amount]) => {
                      const stageLabels = {
                        new: "Nouveau",
                        qualified: "Qualifié",
                        proposal: "Proposition",
                        negotiation: "Négo.",
                        won: "Gagné",
                        lost: "Perdu",
                      };
                      const stageColors = {
                        new: C.blue,
                        qualified: C.green,
                        proposal: C.amber,
                        negotiation: C.purple,
                        won: C.green,
                        lost: C.red,
                      };
                      const sc = stageColors[stage] || C.blue;
                      return (
                        <Box
                          key={stage}
                          sx={{
                            p: 1.5,
                            bgcolor: alpha(sc, 0.06),
                            borderRadius: 10,
                            borderLeft: `3px solid ${sc}`,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between">
                            <Typography sx={{ fontSize: 12, color: C.n500 }}>
                              {stageLabels[stage] || stage}
                            </Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: sc }}>
                              {amount.toLocaleString("fr-FR")} TND
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </AccentCard>
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            {/* Urgent tasks */}
            <Grid item xs={12} md={6}>
              <AccentCard accent={C.red}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <AccessTime sx={{ color: C.amber, fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                    Tâches prioritaires
                  </Typography>
                </Stack>
                {urgentTasks.length === 0 ? (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: alpha(C.green, 0.07),
                      borderRadius: 10,
                      textAlign: "center",
                    }}
                  >
                    <CheckCircle sx={{ color: C.green, mb: 0.5 }} />
                    <Typography sx={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                      Aucune tâche urgente 🎉
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {urgentTasks.map((t) => {
                      const isOverdue = t.due_date && new Date(t.due_date) < new Date();
                      return (
                        <Box
                          key={t.id}
                          sx={{
                            p: 1.5,
                            bgcolor: isOverdue ? alpha(C.red, 0.05) : alpha(C.amber, 0.05),
                            borderRadius: 10,
                            borderLeft: `3px solid ${isOverdue ? C.red : C.amber}`,
                          }}
                        >
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.n800 }}>
                            {t.title}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: isOverdue ? C.red : C.n400 }}>
                            {t.due_date
                              ? new Date(t.due_date).toLocaleDateString("fr-FR")
                              : "Pas d'échéance"}
                            {isOverdue ? " ⚠️ En retard" : ""}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </AccentCard>
            </Grid>

            {/* Recent prospects */}
            <Grid item xs={12} md={6}>
              <AccentCard accent={C.blue}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <PersonAdd sx={{ color: C.blue, fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                    Prospects récents
                  </Typography>
                </Stack>
                <Stack spacing={0}>
                  {[...prospects]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 5)
                    .map((p, i, arr) => {
                      const sc =
                        {
                          new: C.blue,
                          contacted: C.amber,
                          qualified: C.green,
                          lost: C.red,
                          won: C.purple,
                        }[p.status] || C.blue;
                      return (
                        <Box key={p.id}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            py={1.2}
                          >
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: alpha(C.blue, 0.1),
                                  fontSize: 12,
                                  color: C.blue,
                                  fontWeight: 700,
                                }}
                              >
                                {p.first_name?.[0]?.toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.n800 }}>
                                  {p.first_name} {p.last_name}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: C.n400 }}>
                                  {p.email}
                                </Typography>
                              </Box>
                            </Stack>
                            <Chip
                              size="small"
                              label={p.status}
                              sx={{
                                fontSize: 10,
                                bgcolor: alpha(sc, 0.1),
                                color: sc,
                                fontWeight: 600,
                                border: `1px solid ${alpha(sc, 0.2)}`,
                              }}
                            />
                          </Stack>
                          {i < arr.length - 1 && <Divider />}
                        </Box>
                      );
                    })}
                </Stack>
              </AccentCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ── PERFORMANCE TAB ── */}
      {activeTab === 1 && <PerformanceTab />}
    </Box>
  );
}

CommercialDashboard.propTypes = { data: PropTypes.object };
CommercialDashboard.defaultProps = { data: {} };
