/* eslint-disable prettier/prettier */
// src/pages/modules/AdminDashboard.jsx  — v4 Pipedrive CRM Pro

import React, { useState, useCallback, useEffect, useRef } from "react";
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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Alert,
  Tooltip,
} from "@mui/material";
import {
  PersonAdd,
  Contacts,
  AttachMoney,
  CheckCircle,
  People,
  TrendingUp,
  TrendingDown,
  Warning,
  EmojiEvents,
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  Phone,
  Email,
  Groups,
  Add,
  Send as SendIcon,
  RateReview,
  Refresh,
  ArrowUpward,
  ArrowDownward,
  Circle,
  FiberManualRecord,
  ExpandMore,
  ExpandLess,
  LocationOn,
  NotificationsActive,
  CalendarToday,
  FlashOn,
  Public,
  ZoomIn,
  ZoomOut,
  Navigation,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTip,
  ResponsiveContainer,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

import {
  C,
  GRAD,
  SHADOW,
  fadeUp,
  scaleIn,
  pulseRed,
  sweepBar,
  Card,
  KpiCard,
  HeroBanner,
  PrimaryBtn,
  GhostBtn,
  TabPill,
  StatusBadge,
  Skeleton,
  COLORS,
  STAGE_LABELS,
  STAGE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  TooltipBox,
  toList,
  fmtDate,
  isOverdue,
  isToday,
  getInit,
  monthLabel,
  scoreColor,
} from "./theme";

import { ScoreRing, AlertRow, PerfSkeleton } from "./PerformanceWidgets";
import { useTeamKPI, useAlerts, useLeaderboard, perfApi } from "../../hooks/usePerformance";
import { FeedbackButton, useTrackActivity } from "../superadmin/Marketingwidgets";

// ─── FONCTION LOCALE POUR FORMATER EN DINAR TUNISIEN ────────────────
const fmtTND = (n) => {
  if (n == null) return "—";
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return formatter.format(n);
};

// ─── COMPOSANT : JAUGE KPI ANIMÉE ────────────────────────────────
function KpiGauge({ value = 0, color = C.red, size = 110, label = "Score" }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const offset = arcLen - (Math.min(100, value) / 100) * arcLen;
  const col = scoreColor(value);

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={alpha(col, 0.12)}
          strokeWidth={10}
          strokeDasharray={`${arcLen} ${circ}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={10}
          strokeDasharray={`${arcLen - offset} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{ fontSize: size > 90 ? 22 : 16, fontWeight: 900, color: col, lineHeight: 1 }}
        >
          {Math.round(value)}%
        </Typography>
        <Typography sx={{ fontSize: 10, color: C.n400, mt: 0.3 }}>{label}</Typography>
      </Box>
    </Box>
  );
}
KpiGauge.propTypes = {
  value: PropTypes.number,
  color: PropTypes.string,
  size: PropTypes.number,
  label: PropTypes.string,
};

// ─── COMPOSANT : FUNNEL DE CONVERSION ─────────────────────────────
function ConversionFunnel({ opportunities = [] }) {
  const stages = ["new", "qualified", "proposal", "negotiation", "won"];
  const counts = stages.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s],
    count: opportunities.filter((o) => o.stage === s).length,
    color: STAGE_COLORS[s],
    amount: opportunities
      .filter((o) => o.stage === s)
      .reduce((a, o) => a + parseFloat(o.amount || 0), 0),
  }));
  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return (
    <Box>
      <Stack spacing={1}>
        {counts.map((c, i) => {
          const pct = Math.round((c.count / maxCount) * 100);
          const conv =
            i > 0 && counts[i - 1].count > 0
              ? Math.round((c.count / counts[i - 1].count) * 100)
              : null;
          return (
            <Box key={c.stage}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={0.6}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: c.color,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n700, minWidth: 90 }}>
                  {c.label}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    height: 28,
                    bgcolor: alpha(c.color, 0.08),
                    borderRadius: 6,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      bgcolor: c.color,
                      borderRadius: 6,
                      opacity: 0.85,
                      width: `${pct}%`,
                      animation: `${sweepBar} 1s cubic-bezier(.4,0,.2,1) forwards`,
                      display: "flex",
                      alignItems: "center",
                      px: 1,
                    }}
                  >
                    {pct > 20 && (
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                        {c.count}
                      </Typography>
                    )}
                  </Box>
                  {pct <= 20 && (
                    <Typography
                      sx={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: c.color,
                      }}
                    >
                      {c.count}
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: 11, color: C.n500, minWidth: 80, textAlign: "right" }}>
                  {fmtTND(c.amount)}
                </Typography>
                {conv !== null && (
                  <Box sx={{ minWidth: 38, textAlign: "right" }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: conv >= 50 ? C.green : conv >= 25 ? C.amber : C.red,
                      }}
                    >
                      {conv}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="flex-end" mt={1}>
        <Typography sx={{ fontSize: 10, color: C.n400 }}>taux de conversion par étape</Typography>
      </Stack>
    </Box>
  );
}
ConversionFunnel.propTypes = { opportunities: PropTypes.array };
ConversionFunnel.defaultProps = { opportunities: [] };

// ─── COMPOSANT : TIMELINE D'ACTIVITÉ ─────────────────────────────
function ActivityTimeline({ tasks = [], prospects = [], opportunities = [] }) {
  const events = [
    ...tasks.slice(0, 4).map((t) => ({
      id: `t-${t.id}`,
      type: "task",
      icon: <CheckCircle />,
      color: isOverdue(t) ? C.red : STATUS_COLORS[t.status] || C.n400,
      title: t.title,
      sub: `${t.assigned_to_detail?.username || "—"} · ${fmtDate(t.due_date)}`,
      badge: isOverdue(t) ? "retard" : STATUS_LABELS[t.status],
      badgeS: isOverdue(t) ? "cancelled" : t.status,
      time: t.created_at,
    })),
    ...prospects.slice(0, 3).map((p) => ({
      id: `p-${p.id}`,
      type: "prospect",
      icon: <PersonAdd />,
      color: C.blue,
      title: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email,
      sub: p.email,
      badge: p.status,
      badgeS: p.status,
      time: p.created_at,
    })),
    ...opportunities.slice(0, 3).map((o) => ({
      id: `o-${o.id}`,
      type: "deal",
      icon: <AttachMoney />,
      color: STAGE_COLORS[o.stage] || C.amber,
      title: o.name || o.title || "Opportunité",
      sub: fmtTND(parseFloat(o.amount || 0)),
      badge: STAGE_LABELS[o.stage] || o.stage,
      badgeS: o.stage,
      time: o.created_at,
    })),
  ]
    .filter((e) => e.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 8);

  if (!events.length)
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune activité récente</Typography>
      </Box>
    );

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          position: "absolute",
          left: 15,
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: alpha(C.red, 0.1),
          borderRadius: 1,
        }}
      />
      <Stack spacing={0}>
        {events.map((e, i) => (
          <Box key={e.id} sx={{ display: "flex", gap: 2, pb: i < events.length - 1 ? 2 : 0 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                flexShrink: 0,
                bgcolor: alpha(e.color, 0.1),
                border: `2px solid ${alpha(e.color, 0.25)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                position: "relative",
              }}
            >
              {React.cloneElement(e.icon, { sx: { fontSize: 14, color: e.color } })}
            </Box>
            <Box sx={{ flex: 1, pt: 0.3 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box>
                  <Typography
                    sx={{ fontSize: 12, fontWeight: 600, color: C.n800, lineHeight: 1.3 }}
                  >
                    {e.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: C.n400, mt: 0.2 }}>{e.sub}</Typography>
                </Box>
                <StatusBadge s={e.badgeS} sx={{ flexShrink: 0, mt: 0.2 }}>
                  {e.badge}
                </StatusBadge>
              </Stack>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
ActivityTimeline.propTypes = {
  tasks: PropTypes.array,
  prospects: PropTypes.array,
  opportunities: PropTypes.array,
};
ActivityTimeline.defaultProps = { tasks: [], prospects: [], opportunities: [] };

// ─── COMPOSANT : CARTE GÉOGRAPHIQUE INTERACTIVE ────────────────────────────
function GeoProspects({ prospects = [] }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [zoom, setZoom] = useState(1);

  // Regrouper les prospects par pays/région
  const regionData = prospects.reduce((acc, p) => {
    let region = p.country || p.city || p.source || "Autre";

    const countryMap = {
      France: "France",
      "États-Unis": "USA",
      USA: "USA",
      "United States": "USA",
      "Royaume-Uni": "UK",
      UK: "UK",
      Allemagne: "Germany",
      Germany: "Germany",
      Espagne: "Spain",
      Spain: "Spain",
      Italie: "Italy",
      Italy: "Italy",
      Canada: "Canada",
      Belgique: "Belgium",
      Belgium: "Belgium",
      Suisse: "Switzerland",
      Switzerland: "Switzerland",
    };

    region = countryMap[region] || region;

    if (!acc[region]) {
      acc[region] = {
        name: region,
        count: 0,
        prospects: [],
        amount: 0,
        color: getRegionColor(region),
      };
    }
    acc[region].count++;
    acc[region].prospects.push(p);
    acc[region].amount += parseFloat(p.amount || 0);
    return acc;
  }, {});

  const regions = Object.values(regionData).sort((a, b) => b.count - a.count);
  const totalProspects = prospects.length;
  const totalAmount = prospects.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  function getRegionColor(region) {
    const colors = {
      France: C.blue,
      USA: C.red,
      UK: C.purple,
      Germany: C.green,
      Spain: C.amber,
      Italy: C.teal,
      Canada: C.redDark,
      Belgium: C.purpleDark,
      Switzerland: C.redSoft,
    };
    return colors[region] || C.n400;
  }

  const getPointCoordinates = (region) => {
    const coords = {
      France: { x: 500, y: 280 },
      USA: { x: 250, y: 230 },
      UK: { x: 470, y: 250 },
      Germany: { x: 520, y: 260 },
      Spain: { x: 475, y: 310 },
      Italy: { x: 530, y: 300 },
      Canada: { x: 280, y: 150 },
      Belgium: { x: 505, y: 265 },
      Switzerland: { x: 515, y: 285 },
    };
    const base = coords[region] || { x: 500, y: 300 };
    return {
      x: base.x + (Math.random() - 0.5) * 20,
      y: base.y + (Math.random() - 0.5) * 20,
    };
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setSelectedRegion(null);
  };

  if (!prospects.length) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Public sx={{ fontSize: 48, color: C.n300, mb: 2 }} />
        <Typography sx={{ fontSize: 13, color: C.n400 }}>Pas de données géographiques</Typography>
        <Typography sx={{ fontSize: 11, color: C.n400, mt: 0.5 }}>
          Ajoutez le champ &quot;pays&quot; ou &quot;ville&quot; aux prospects
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2, justifyContent: "flex-end" }}>
        <Tooltip title="Zoom avant">
          <Box
            onClick={handleZoomIn}
            sx={{
              p: 0.5,
              borderRadius: 1,
              cursor: "pointer",
              bgcolor: alpha(C.n400, 0.1),
              "&:hover": { bgcolor: alpha(C.n400, 0.2) },
            }}
          >
            <ZoomIn sx={{ fontSize: 20, color: C.n600 }} />
          </Box>
        </Tooltip>
        <Tooltip title="Zoom arrière">
          <Box
            onClick={handleZoomOut}
            sx={{
              p: 0.5,
              borderRadius: 1,
              cursor: "pointer",
              bgcolor: alpha(C.n400, 0.1),
              "&:hover": { bgcolor: alpha(C.n400, 0.2) },
            }}
          >
            <ZoomOut sx={{ fontSize: 20, color: C.n600 }} />
          </Box>
        </Tooltip>
        <Tooltip title="Réinitialiser">
          <Box
            onClick={handleReset}
            sx={{
              p: 0.5,
              borderRadius: 1,
              cursor: "pointer",
              bgcolor: alpha(C.n400, 0.1),
              "&:hover": { bgcolor: alpha(C.n400, 0.2) },
            }}
          >
            <Navigation sx={{ fontSize: 20, color: C.n600 }} />
          </Box>
        </Tooltip>
      </Stack>

      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: 350,
          overflow: "hidden",
          borderRadius: 2,
          bgcolor: alpha(C.blue, 0.02),
          border: `1px solid ${alpha(C.n400, 0.1)}`,
        }}
      >
        <svg
          viewBox="0 0 1000 600"
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.3s ease",
          }}
        >
          <rect width="1000" height="600" fill={alpha(C.blue, 0.05)} />

          {/* Carte du monde simplifiée */}
          <path
            d="M200 100 L250 80 L300 100 L350 90 L400 110 L450 100 L500 120 L550 110 L600 130 L650 120 L700 140 L750 130 L800 150 L850 140 L900 160 L850 180 L800 170 L750 190 L700 180 L650 200 L600 190 L550 210 L500 200 L450 220 L400 210 L350 230 L300 220 L250 240 L200 230 L150 250 L100 240 L50 260 L30 280 L50 300 L100 310 L150 300 L200 310 L250 320 L300 310 L350 330 L400 320 L450 340 L500 330 L550 350 L600 340 L650 360 L700 350 L750 370 L800 360 L850 380 L900 370 L950 390 L950 450 L900 440 L850 460 L800 450 L750 470 L700 460 L650 480 L600 470 L550 490 L500 480 L450 500 L400 490 L350 510 L300 500 L250 520 L200 510 L150 530 L100 520 L50 540 L30 500 L50 460 L100 450 L150 430 L200 420 L250 400 L300 390 L350 370 L400 360 L450 340 L500 330 L550 310 L600 300 L650 280 L700 270 L750 250 L800 240 L850 220 L900 210 L950 190 L950 150 L900 140 L850 120 L800 110 L750 90 L700 80 L650 60 L600 50 L550 70 L500 80 L450 60 L400 70 L350 50 L300 60 L250 40 L200 50 L150 70 L100 60 L50 80 L30 100 L50 120 L100 110 L150 90 L200 100Z"
            fill="none"
            stroke={alpha(C.n400, 0.3)}
            strokeWidth="2"
          />

          {regions.map((region) => {
            const point = getPointCoordinates(region.name);
            const size = Math.min(20 + region.count * 2, 40);
            const opacity = selectedRegion === region.name ? 1 : 0.6;

            return (
              <g
                key={region.name}
                onClick={() =>
                  setSelectedRegion(selectedRegion === region.name ? null : region.name)
                }
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={size / 2}
                  fill={region.color}
                  fillOpacity={opacity}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y={point.y - size / 2 - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill={region.color}
                  fontWeight="bold"
                >
                  {region.count}
                </text>
                {selectedRegion === region.name && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={size / 2 + 5}
                    fill="none"
                    stroke={region.color}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </Box>

      <Stack spacing={2} sx={{ mt: 2 }}>
        <Stack spacing={1}>
          {regions.slice(0, 6).map((region) => {
            const percentage = Math.round((region.count / totalProspects) * 100);
            const isSelected = selectedRegion === region.name;

            return (
              <Box
                key={region.name}
                onClick={() => setSelectedRegion(isSelected ? null : region.name)}
                sx={{
                  cursor: "pointer",
                  p: 1,
                  borderRadius: 1,
                  bgcolor: isSelected ? alpha(region.color, 0.1) : "transparent",
                  transition: "all 0.2s",
                  "&:hover": { bgcolor: alpha(region.color, 0.05) },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: region.color }}
                    />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n700 }}>
                      {region.name}
                    </Typography>
                    <Chip
                      label={`${region.count} prospects`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        bgcolor: alpha(region.color, 0.1),
                        color: region.color,
                      }}
                    />
                  </Stack>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: region.color }}>
                    {percentage}%
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    height: 6,
                    bgcolor: alpha(region.color, 0.1),
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      bgcolor: region.color,
                      borderRadius: 3,
                      width: `${percentage}%`,
                      transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </Box>

                {isSelected && (
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ mt: 1, pt: 1, borderTop: `1px solid ${alpha(C.n400, 0.1)}` }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 10, color: C.n400 }}>Valeur totale</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: region.color }}>
                        {fmtTND(region.amount)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: C.n400 }}>Valeur moyenne</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: region.color }}>
                        {fmtTND(region.amount / region.count)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: C.n400 }}>Prospects</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: region.color }}>
                        {region.count}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            bgcolor: alpha(C.n400, 0.05),
            borderRadius: 2,
            border: `1px solid ${alpha(C.n400, 0.1)}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Public sx={{ fontSize: 16, color: C.n500 }} />
              <Typography sx={{ fontSize: 11, color: C.n500 }}>
                {regions.length} régions représentées
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: C.n600 }}>
              {totalProspects} prospects · {fmtTND(totalAmount)}
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
GeoProspects.propTypes = { prospects: PropTypes.array };
GeoProspects.defaultProps = { prospects: [] };

// ─── COMPOSANT : SCORE KPI TEAM CARD ─────────────────────────────
function TeamScoreCard({ leaderboard = [] }) {
  const avgScore = leaderboard.length
    ? Math.round(leaderboard.reduce((s, e) => s + e.score, 0) / leaderboard.length)
    : 0;
  const top3 = leaderboard.slice(0, 3);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
        <KpiGauge value={avgScore} size={100} label="Équipe" />
        <Stack spacing={1} flex={1} ml={2.5}>
          {[
            {
              label: "Score moyen",
              value: `${Math.round(avgScore)}%`,
              color: scoreColor(avgScore),
            },
            { label: "Commerciaux", value: leaderboard.length, color: C.blue },
            {
              label: "En difficulté",
              value: leaderboard.filter((e) => e.score < 70).length,
              color: C.red,
            },
          ].map((s) => (
            <Stack key={s.label} direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 11, color: C.n500 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>
                {s.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
      {top3.length > 0 && (
        <Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: C.n400,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              mb: 1.2,
            }}
          >
            Top performers
          </Typography>
          <Stack spacing={1}>
            {top3.map((e, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const col = scoreColor(e.score);
              return (
                <Stack key={e.user_id} direction="row" alignItems="center" spacing={1.2}>
                  <Typography sx={{ fontSize: 15, lineHeight: 1 }}>{medals[i]}</Typography>
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: alpha(col, 0.15),
                      color: col,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {getInit(e.username)}
                  </Avatar>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n800, flex: 1 }}>
                    {e.username}
                  </Typography>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: 8,
                      bgcolor: alpha(col, 0.1),
                      border: `1px solid ${alpha(col, 0.2)}`,
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: col }}>
                      {Math.round(e.score)}%
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
TeamScoreCard.propTypes = { leaderboard: PropTypes.array };
TeamScoreCard.defaultProps = { leaderboard: [] };

// ─── PERFORMANCE TAB ─────────────────────────────────────────────
function AdminPerformanceTab({ allUsers }) {
  const { data: teamData, loading } = useTeamKPI();
  const { data: alertsData } = useAlerts();
  const { data: leaderboard } = useLeaderboard();
  const [selected, setSelected] = useState(null);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [subTab, setSubTab] = useState(0);
  const [feedbacks, setFeedbacks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [target, setTarget] = useState(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [filterUser, setFilterUser] = useState("all");

  const leaderboardList = leaderboard?.leaderboard || [];
  const commerciaux = allUsers.filter((m) => m.role === "COMMERCIAL" || m.role === "MANAGER");
  const ratingLabel = ["", "Insuffisant", "À améliorer", "Correct", "Bien", "Excellent"];
  const ratingColor = ["", C.red, C.red, C.amber, C.green, C.green];

  const fetchFullKpi = useCallback(async (uid) => {
    try {
      const r = await perfApi.get(`/kpi/${uid}/`);
      setSelectedKpi(r.data);
    } catch {
      setSelectedKpi(null);
    }
  }, []);
  const fetchHistory = useCallback(async (uid) => {
    try {
      const r = await perfApi.get(`/kpi/history/${uid}/?months=6`);
      setSelectedHistory(r.data);
    } catch {
      setSelectedHistory([]);
    }
  }, []);
  const handleSelect = (e) => {
    setSelected(e);
    setSelectedKpi(null);
    if (e) {
      fetchFullKpi(e.user_id);
      fetchHistory(e.user_id);
    } else setSelectedHistory([]);
  };
  const fetchFeedbacks = useCallback(async () => {
    try {
      const now = new Date();
      const r = await perfApi.get(
        `/feedback/?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      );
      setFeedbacks(Array.isArray(r.data) ? r.data : r.data.results || []);
    } catch {
      setFeedbacks([]);
    }
  }, []);
  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleSend = async () => {
    if (!rating || !comment.trim() || !target) return;
    setSending(true);
    try {
      const now = new Date();
      await perfApi.post("/feedback/", {
        commercial: target.id,
        rating,
        comment,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      setSentOk(true);
      setTimeout(() => {
        setSentOk(false);
        setShowModal(false);
        setRating(0);
        setComment("");
        setTarget(null);
        fetchFeedbacks();
      }, 1500);
    } catch {
      console.error("feedback error");
    } finally {
      setSending(false);
    }
  };

  const allAlerts = alertsData
    ? [
        ...(alertsData.overdue_tasks || []).map((t) => ({
          type: "error",
          title: `En retard : "${t.title}"`,
          sub: `${t.commercial} · ${fmtDate(t.due_date)}`,
        })),
        ...(alertsData.inactive_users || []).map((u) => ({
          type: "warning",
          title: `${u.username} inactif 3 jours`,
          sub: "Aucune activité",
        })),
        ...(alertsData.low_score_users || []).map((u) => ({
          type: "warning",
          title: `Score faible : ${u.username}`,
          sub: `${Math.round(u.score)}% · pénalité ${u.penalty}pts`,
        })),
        ...(alertsData.upcoming_tasks || []).map((t) => ({
          type: "info",
          title: `Deadline 24h : "${t.title}"`,
          sub: t.commercial,
        })),
      ]
    : [];

  if (loading) return <PerfSkeleton rows={6} />;
  const avgScore =
    teamData?.avg_score ??
    (leaderboardList.length
      ? Math.round(leaderboardList.reduce((s, e) => s + e.score, 0) / leaderboardList.length)
      : 0);
  const topPerformer = leaderboardList[0] || null;

  return (
    <Box sx={{ animation: `${fadeUp} .2s ease` }}>
      <Grid container spacing={2} mb={3}>
        {[
          {
            label: "Score équipe",
            value: `${Math.round(avgScore)}%`,
            color: scoreColor(avgScore),
            icon: <EmojiEvents />,
          },
          {
            label: "Commerciaux",
            value: teamData?.team_count ?? leaderboardList.length,
            color: C.blue,
            icon: <People />,
          },
          {
            label: "En difficulté",
            value:
              (teamData?.in_difficulty || []).length ||
              leaderboardList.filter((e) => e.score < 70).length,
            color: C.red,
            icon: <Warning />,
          },
          {
            label: "Alertes",
            value: allAlerts.length,
            color: allAlerts.length > 0 ? C.amber : C.green,
            icon: <NotificationsActive />,
          },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <KpiCard color={s.color}>
              <Stack direction="row" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    bgcolor: alpha(s.color, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {React.cloneElement(s.icon, { sx: { fontSize: 20, color: s.color } })}
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: C.n400,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      fontWeight: 700,
                    }}
                  >
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                    {s.value}
                  </Typography>
                </Box>
              </Stack>
            </KpiCard>
          </Grid>
        ))}
      </Grid>

      {topPerformer && (
        <Card
          sx={{
            mb: 3,
            background: `linear-gradient(135deg,${alpha("#f59e0b", 0.08)},${alpha(
              "#f59e0b",
              0.03
            )})`,
            border: `1px solid ${alpha("#f59e0b", 0.25)}`,
          }}
        >
          <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
            <Typography sx={{ fontSize: 32 }}>🥇</Typography>
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: alpha("#f59e0b", 0.2),
                color: "#b45309",
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              {getInit(topPerformer.username)}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontSize: 10,
                  color: "#92400e",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Top performer du mois
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: C.n800 }}>
                {topPerformer.username}
              </Typography>
            </Box>
            <Box sx={{ ml: "auto", textAlign: "center" }}>
              <Typography sx={{ fontSize: 42, fontWeight: 900, color: "#b45309", lineHeight: 1 }}>
                {Math.round(topPerformer.score)}%
              </Typography>
              <Typography sx={{ fontSize: 10, color: "#92400e" }}>Score KPI</Typography>
            </Box>
          </Stack>
        </Card>
      )}

      {allAlerts.length > 0 && (
        <Box mb={3}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setShowAlerts(!showAlerts)}
            sx={{ cursor: "pointer", mb: 1 }}
          >
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: C.n600,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              🚨 Alertes actives ({allAlerts.length})
            </Typography>
            {showAlerts ? (
              <ExpandLess sx={{ fontSize: 16, color: C.n400 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 16, color: C.n400 }} />
            )}
          </Stack>
          <Collapse in={showAlerts}>
            <Grid container spacing={1}>
              {allAlerts.slice(0, 8).map((a, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <AlertRow {...a} />
                </Grid>
              ))}
            </Grid>
          </Collapse>
        </Box>
      )}

      <Stack
        direction="row"
        spacing={1}
        mb={2.5}
        sx={{
          bgcolor: C.white,
          p: 0.8,
          borderRadius: 12,
          border: `1px solid ${C.n200}`,
          width: "fit-content",
        }}
      >
        {[
          { label: "Classement & KPIs", icon: <BarChartIcon sx={{ fontSize: 14 }} /> },
          { label: "Feedbacks équipe", icon: <RateReview sx={{ fontSize: 14 }} /> },
        ].map((tab, i) => (
          <TabPill key={i} active={subTab === i ? 1 : 0} onClick={() => setSubTab(i)}>
            {React.cloneElement(tab.icon, {
              sx: { fontSize: 14, color: subTab === i ? C.red : C.n400 },
            })}
            <span className="lbl">{tab.label}</span>
          </TabPill>
        ))}
      </Stack>

      {subTab === 0 && (
        <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 1.5 }}>
              🏆 Classement — {monthLabel()}
            </Typography>
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ borderRadius: 14, border: `1px solid ${C.n200}`, overflow: "hidden" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: C.redSoft }}>
                    {[
                      "#",
                      "Commercial",
                      "Score KPI",
                      "Tâches",
                      "Délais",
                      "Activités",
                      "Deals",
                      "Pénalité",
                    ].map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.redDark,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: `1px solid ${C.redBorder}`,
                          py: 1.5,
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderboardList.map((entry) => {
                    const isSel = selected?.user_id === entry.user_id;
                    const col = scoreColor(entry.score);
                    const tp =
                      entry.tasks_total > 0
                        ? Math.round((entry.tasks_done / entry.tasks_total) * 100)
                        : 0;
                    const trp =
                      entry.tasks_done > 0
                        ? Math.round(((entry.tasks_on_time || 0) / entry.tasks_done) * 100)
                        : 0;
                    const rank =
                      entry.rank === 1
                        ? "🥇"
                        : entry.rank === 2
                        ? "🥈"
                        : entry.rank === 3
                        ? "🥉"
                        : null;
                    return (
                      <TableRow
                        key={entry.user_id}
                        onClick={() => handleSelect(isSel ? null : entry)}
                        sx={{
                          cursor: "pointer",
                          bgcolor: isSel ? alpha(C.red, 0.04) : C.white,
                          borderLeft: isSel ? `3px solid ${C.red}` : "3px solid transparent",
                          transition: "all .15s",
                          "&:hover": { bgcolor: alpha(C.redSoft, 0.5) },
                          "&:last-child td": { border: 0 },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          {rank ? (
                            <Typography sx={{ fontSize: 17 }}>{rank}</Typography>
                          ) : (
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n400 }}>
                              #{entry.rank}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Stack direction="row" alignItems="center" spacing={1.2}>
                            <Avatar
                              sx={{
                                width: 30,
                                height: 30,
                                bgcolor: alpha(col, 0.15),
                                color: col,
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {getInit(entry.username)}
                            </Avatar>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n800 }}>
                              {entry.username}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Stack direction="row" alignItems="center" gap={0.8}>
                            <Typography
                              sx={{ fontSize: 18, fontWeight: 800, color: col, minWidth: 44 }}
                            >
                              {Math.round(entry.score)}%
                            </Typography>
                            {entry.score >= 85 ? (
                              <TrendingUp sx={{ fontSize: 14, color: C.green }} />
                            ) : entry.score < 60 ? (
                              <TrendingDown sx={{ fontSize: 14, color: C.red }} />
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ minWidth: 90 }}>
                            <Stack direction="row" justifyContent="space-between" mb={0.3}>
                              <Typography sx={{ fontSize: 10, color: C.n400 }}>
                                {entry.tasks_done}/{entry.tasks_total}
                              </Typography>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.blue }}>
                                {tp}%
                              </Typography>
                            </Stack>
                            <Box
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: alpha(C.blue, 0.12),
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${Math.min(100, tp)}%`,
                                  bgcolor: C.blue,
                                  borderRadius: 2,
                                  transition: "width .8s ease",
                                }}
                              />
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ minWidth: 70 }}>
                            <Stack direction="row" justifyContent="space-between" mb={0.3}>
                              <Typography sx={{ fontSize: 10, color: C.n400 }}>{trp}%</Typography>
                            </Stack>
                            <Box
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: alpha(
                                  trp === 100 ? C.green : trp >= 70 ? C.amber : C.red,
                                  0.12
                                ),
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${Math.min(100, trp)}%`,
                                  bgcolor: trp === 100 ? C.green : trp >= 70 ? C.amber : C.red,
                                  borderRadius: 2,
                                  transition: "width .8s ease",
                                }}
                              />
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Stack direction="row" spacing={0.5}>
                            {[
                              {
                                icon: <Phone sx={{ fontSize: 10 }} />,
                                val: entry.calls || 0,
                                color: C.blue,
                              },
                              {
                                icon: <Email sx={{ fontSize: 10 }} />,
                                val: entry.emails || 0,
                                color: C.purple,
                              },
                              {
                                icon: <Groups sx={{ fontSize: 10 }} />,
                                val: entry.meetings || 0,
                                color: C.teal,
                              },
                            ].map((it, ix) => (
                              <Box
                                key={ix}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.3,
                                  bgcolor: alpha(it.color, 0.1),
                                  borderRadius: 1,
                                  px: 0.6,
                                  py: 0.2,
                                }}
                              >
                                {React.cloneElement(it.icon, {
                                  sx: { fontSize: 10, color: it.color },
                                })}
                                <Typography sx={{ fontSize: 10, fontWeight: 600, color: it.color }}>
                                  {it.val}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.teal }}>
                            {entry.opportunities_won || 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography
                            sx={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: (entry.penalty_points || 0) < 0 ? C.red : C.green,
                            }}
                          >
                            {entry.penalty_points || 0} pts
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {selected && (
            <Box
              sx={{
                width: 280,
                flexShrink: 0,
                bgcolor: C.white,
                borderRadius: 16,
                border: `1px solid ${C.n200}`,
                boxShadow: SHADOW.card,
                minHeight: 400,
                position: "sticky",
                top: 20,
                overflow: "hidden",
              }}
            >
              <Box sx={{ p: 2, background: GRAD.redGlow, textAlign: "center" }}>
                <Avatar
                  sx={{
                    width: 52,
                    height: 52,
                    bgcolor: "rgba(255,255,255,.2)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 20,
                    mx: "auto",
                    mb: 1,
                  }}
                >
                  {getInit(selected.username)}
                </Avatar>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  {selected.username}
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Box sx={{ textAlign: "center", mb: 2 }}>
                  <KpiGauge value={selected.score} size={90} label="KPI" />
                </Box>
                {selectedHistory.length > 0 && (
                  <Box sx={{ height: 70 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selectedHistory}
                        margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                      >
                        <defs>
                          <linearGradient id="shg" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={scoreColor(selected.score)}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={scoreColor(selected.score)}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" tick={{ fontSize: 8, fill: C.n400 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: C.n400 }} />
                        <ReTip
                          contentStyle={{ fontSize: 11, borderRadius: 6 }}
                          formatter={(v) => [`${Math.round(v)}%`, "Score"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke={scoreColor(selected.score)}
                          strokeWidth={2}
                          fill="url(#shg)"
                          dot={{ r: 2.5, fill: scoreColor(selected.score) }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {subTab === 1 && (
        <Card accent={C.purple}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: GRAD.red,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RateReview sx={{ color: "#fff", fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: C.n800 }}>
                  Feedbacks — {monthLabel()}
                </Typography>
              </Box>
            </Stack>
            <PrimaryBtn
              size="small"
              startIcon={<Add sx={{ fontSize: 15 }} />}
              onClick={() => setShowModal(true)}
            >
              Nouveau
            </PrimaryBtn>
          </Stack>

          <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
            <Select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              sx={{ borderRadius: 2, fontSize: 13 }}
            >
              <MenuItem value="all">Tous les collaborateurs</MenuItem>
              {commerciaux.map((m) => (
                <MenuItem key={m.id} value={m.id.toString()}>
                  {m.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack spacing={1.2}>
            {(filterUser === "all"
              ? feedbacks
              : feedbacks.filter((f) => f.commercial === parseInt(filterUser))
            )
              .slice(0, 8)
              .map((fb, i) => {
                const u = allUsers.find((m) => m.id === fb.commercial);
                const r = fb.rating || 0;
                const col = ratingColor[r] || C.amber;
                return (
                  <Box
                    key={fb.id || i}
                    sx={{
                      p: 2,
                      borderRadius: 12,
                      bgcolor: alpha(col, 0.03),
                      border: `1px solid ${alpha(col, 0.14)}`,
                      borderLeft: `3px solid ${col}`,
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" gap={1.5}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: alpha(C.purple, 0.12),
                          color: C.purple,
                          fontSize: 13,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {getInit(u?.username || "?")}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          mb={0.3}
                          flexWrap="wrap"
                        >
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                            {u?.username || `#${fb.commercial}`}
                          </Typography>
                          <Stack direction="row" spacing={0.1}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Typography
                                key={s}
                                sx={{
                                  fontSize: 13,
                                  color: s <= r ? "#f59e0b" : C.n200,
                                  lineHeight: 1,
                                }}
                              >
                                ★
                              </Typography>
                            ))}
                          </Stack>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: col }}>
                            {ratingLabel[r]}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 13, color: C.n600, lineHeight: 1.5 }}>
                          {fb.comment}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{ fontSize: 11, color: C.n400, whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        {fb.month}/{fb.year}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
          </Stack>
        </Card>
      )}

      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        PaperProps={{ sx: { borderRadius: 4, minWidth: 460, overflow: "visible" } }}
      >
        <Box sx={{ position: "relative", pt: 5 }}>
          <Box
            sx={{
              position: "absolute",
              top: -28,
              left: "50%",
              transform: "translateX(-50%)",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: GRAD.red,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: SHADOW.red,
            }}
          >
            <RateReview sx={{ color: "#fff", fontSize: 26 }} />
          </Box>
        </Box>
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: C.n800 }}>
            Nouveau feedback
          </Typography>
          <Typography sx={{ fontSize: 12, color: C.n400 }}>{monthLabel()}</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          {sentOk ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ fontSize: 42, mb: 1.5 }}>🎉</Typography>
              <Typography sx={{ fontWeight: 800, color: C.green, fontSize: 16 }}>
                Envoyé !
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5} mt={0.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Collaborateur *</InputLabel>
                <Select
                  value={target?.id || ""}
                  label="Collaborateur *"
                  onChange={(e) => setTarget(commerciaux.find((m) => m.id === e.target.value))}
                  sx={{ borderRadius: 2 }}
                >
                  {commerciaux.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n600, mb: 1.5 }}>
                  Note *
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Box
                      key={s}
                      onMouseEnter={() => setHover(s)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(s)}
                      sx={{
                        fontSize: 34,
                        cursor: "pointer",
                        transition: "all .1s",
                        lineHeight: 1,
                        userSelect: "none",
                        color: s <= (hover || rating) ? "#f59e0b" : C.n200,
                        transform: s <= (hover || rating) ? "scale(1.2)" : "scale(1)",
                      }}
                    >
                      ★
                    </Box>
                  ))}
                  {rating > 0 && (
                    <Typography
                      sx={{ fontSize: 13, fontWeight: 700, color: ratingColor[rating], ml: 1 }}
                    >
                      {ratingLabel[rating]}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Commentaire *"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: 2 },
                  "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: C.red },
                  "& label.Mui-focused": { color: C.red },
                }}
              />
            </Stack>
          )}
        </DialogContent>
        {!sentOk && (
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <GhostBtn onClick={() => setShowModal(false)}>Annuler</GhostBtn>
            <PrimaryBtn
              disabled={!rating || !comment.trim() || !target || sending}
              onClick={handleSend}
              startIcon={<SendIcon sx={{ fontSize: 16 }} />}
            >
              {sending ? "Envoi..." : "Envoyer"}
            </PrimaryBtn>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}
AdminPerformanceTab.propTypes = { allUsers: PropTypes.array };
AdminPerformanceTab.defaultProps = { allUsers: [] };

// ─── MAIN ADMIN DASHBOARD ────────────────────────────────────────
export default function AdminDashboard({ data, onRefresh }) {
  const [activeTab, setActiveTab] = useState(0);
  useTrackActivity("dashboard");

  const prospects = toList(data?.prospects);
  const contacts = toList(data?.contacts);
  const opportunities = toList(data?.opportunities);
  const tasks = toList(data?.tasks);
  const users = toList(data?.users);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const totalPipeline = opportunities.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  const wonOpps = opportunities.filter((o) => o.stage === "won");
  const overdueTasks = tasks.filter(isOverdue);
  const commerciaux = users.filter((u) => u.role === "COMMERCIAL");
  const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const monthlyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6 + i);
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return {
      month: label,
      Prospects: prospects.filter((p) => {
        const c = new Date(p.created_at);
        return c.getMonth() + 1 === month && c.getFullYear() === year;
      }).length,
      Deals: opportunities.filter((o) => {
        const c = new Date(o.created_at);
        return c.getMonth() + 1 === month && c.getFullYear() === year;
      }).length,
    };
  });

  const kpiCards = [
    {
      label: "Prospects",
      value: prospects.length,
      color: C.red,
      icon: <PersonAdd />,
      sub: `${prospects.filter((p) => p.status === "new").length} nouveaux`,
      diff: 12,
    },
    {
      label: "Contacts",
      value: contacts.length,
      color: C.blue,
      icon: <Contacts />,
      sub: `${contacts.length} actifs`,
      diff: 5,
    },
    {
      label: "Pipeline",
      value: fmtTND(totalPipeline),
      color: C.amber,
      icon: <AttachMoney />,
      sub: `${wonOpps.length} deals gagnés`,
      diff: 23,
    },
    {
      label: "Tâches actives",
      value: activeTasks.length,
      color: C.purple,
      icon: <CheckCircle />,
      sub: overdueTasks.length > 0 ? `⚠️ ${overdueTasks.length} en retard` : "Tout à jour",
      diff: overdueTasks.length > 0 ? -overdueTasks.length : 0,
    },
  ];

  const tabs = [
    { label: "Vue CRM", icon: <BarChartIcon sx={{ fontSize: 15 }} /> },
    { label: "Performance", icon: <EmojiEvents sx={{ fontSize: 15 }} /> },
  ];

  const { data: leaderboard } = useLeaderboard();
  const leaderboardList = leaderboard?.leaderboard || [];

  return (
    <Box sx={{ animation: `${fadeUp} .25s ease` }}>
      <HeroBanner>
        <Box
          sx={{
            position: "absolute",
            top: -70,
            right: -70,
            width: 240,
            height: 240,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,.05)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: -50,
            left: "20%",
            width: 160,
            height: 160,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,.04)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: "55%",
            width: 90,
            height: 90,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,.03)",
            pointerEvents: "none",
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
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                bgcolor: "rgba(255,255,255,.18)",
                fontSize: 24,
                fontWeight: 900,
                border: "2.5px solid rgba(255,255,255,.3)",
              }}
            >
              {getInit(user.username || "A")}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontSize: 11,
                  color: "rgba(255,255,255,.65)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  mb: 0.3,
                }}
              >
                Administrateur CRM
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
                Bonjour, {user.username} 👋
              </Typography>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,.65)", mt: 0.4 }}>
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.8}>
            {overdueTasks.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  bgcolor: "rgba(255,255,255,.15)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: 20,
                  px: 1.8,
                  py: 0.7,
                  animation: `${pulseRed} 2s infinite`,
                }}
              >
                <Warning sx={{ fontSize: 14, color: "#fcd34d" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {overdueTasks.length} en retard
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                bgcolor: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 20,
                px: 1.8,
                py: 0.7,
              }}
            >
              <People sx={{ fontSize: 14, color: "#fff" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {users.length} membres
              </Typography>
            </Box>
            <Box
              onClick={onRefresh}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                bgcolor: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 20,
                px: 1.8,
                py: 0.7,
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(255,255,255,.2)" },
              }}
            >
              <Refresh sx={{ fontSize: 14, color: "#fff" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                Actualiser
              </Typography>
            </Box>
            <Box
              sx={{
                "& .MuiButton-root": {
                  borderColor: "rgba(255,255,255,.55)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 20,
                  textTransform: "none",
                  px: 1.8,
                  py: 0.5,
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,.15)" },
                },
              }}
            >
              <FeedbackButton />
            </Box>
          </Stack>
        </Stack>
      </HeroBanner>

      <Stack
        direction="row"
        spacing={1}
        mb={3}
        sx={{
          bgcolor: C.white,
          p: 1,
          borderRadius: 14,
          border: `1px solid ${C.n200}`,
          width: "fit-content",
        }}
      >
        {tabs.map((tab, i) => (
          <TabPill key={i} active={activeTab === i ? 1 : 0} onClick={() => setActiveTab(i)}>
            {React.cloneElement(tab.icon, {
              sx: { fontSize: 15, color: activeTab === i ? C.red : C.n400 },
            })}
            <span className="lbl">{tab.label}</span>
          </TabPill>
        ))}
      </Stack>

      {activeTab === 0 && (
        <Box sx={{ animation: `${fadeUp} .2s ease` }}>
          <Grid container spacing={2.5} mb={3}>
            {kpiCards.map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.label}>
                <KpiCard color={s.color}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box>
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.n400,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          mb: 0.6,
                        }}
                      >
                        {s.label}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 30, fontWeight: 900, color: C.n800, lineHeight: 1.05 }}
                      >
                        {s.value}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: C.n400, mt: 0.5 }}>{s.sub}</Typography>
                      {s.diff !== 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.4} mt={0.8}>
                          {s.diff > 0 ? (
                            <ArrowUpward sx={{ fontSize: 12, color: C.green }} />
                          ) : (
                            <ArrowDownward sx={{ fontSize: 12, color: C.red }} />
                          )}
                          <Typography
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: s.diff > 0 ? C.green : C.red,
                            }}
                          >
                            {Math.abs(s.diff)} ce mois
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: 13,
                        bgcolor: alpha(s.color, 0.1),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 23 } })}
                    </Box>
                  </Stack>
                </KpiCard>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} md={5}>
              <Card accent={C.red}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.red, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Funnel de conversion
                  </Typography>
                </Stack>
                <ConversionFunnel opportunities={opportunities} />
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: C.green }}>
                      {wonOpps.length}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.n400 }}>Deals gagnés</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: C.red }}>
                      {opportunities.filter((o) => o.stage === "lost").length}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.n400 }}>Perdus</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: C.amber }}>
                      {fmtTND(totalPipeline)}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.n400 }}>Pipeline total</Typography>
                  </Box>
                </Stack>
              </Card>
            </Grid>

            <Grid item xs={12} md={7}>
              <Card accent={C.blue}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.blue, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Évolution mensuelle
                  </Typography>
                </Stack>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.red} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.red} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.n200} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: C.n400 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.n400 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <ReTip content={<TooltipBox />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="Prospects"
                      stroke={C.red}
                      strokeWidth={2.5}
                      fill="url(#gp)"
                      dot={{ r: 4, fill: C.red, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Deals"
                      stroke={C.blue}
                      strokeWidth={2.5}
                      fill="url(#gd)"
                      dot={{ r: 4, fill: C.blue, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} md={4}>
              <Card accent={C.purple} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.purple, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Activité récente
                  </Typography>
                </Stack>
                <ActivityTimeline
                  tasks={tasks}
                  prospects={prospects}
                  opportunities={opportunities}
                />
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card accent={C.teal} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.teal, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Répartition géographique
                  </Typography>
                </Stack>
                <GeoProspects prospects={prospects} />
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card accent={C.amber} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.amber, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Score KPI équipe
                  </Typography>
                </Stack>
                <TeamScoreCard leaderboard={leaderboardList} />
              </Card>
            </Grid>
          </Grid>

          <Card accent={C.redDark}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 8, height: 24, bgcolor: C.red, borderRadius: 2 }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                  Tâches équipe
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 11, color: C.n400 }}>
                {activeTasks.length} actives · {overdueTasks.length} en retard
              </Typography>
            </Stack>
            {activeTasks.length === 0 ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CheckCircle sx={{ fontSize: 36, color: C.green, mb: 1 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.green }}>
                  Toutes les tâches sont à jour !
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {[...activeTasks]
                  .sort((a, b) => (isOverdue(a) ? -1 : isOverdue(b) ? 1 : 0))
                  .slice(0, 8)
                  .map((t) => {
                    const overdue = isOverdue(t);
                    const today = isToday(t.due_date);
                    const borderCol = overdue
                      ? C.red
                      : today
                      ? C.amber
                      : STATUS_COLORS[t.status] || C.n300;
                    return (
                      <Grid item xs={12} sm={6} md={3} key={t.id}>
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: overdue ? alpha(C.red, 0.03) : alpha(borderCol, 0.03),
                            borderRadius: 12,
                            border: `1px solid ${alpha(borderCol, 0.2)}`,
                            borderLeft: `3px solid ${borderCol}`,
                            transition: "all .15s",
                            "&:hover": { boxShadow: SHADOW.sm },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.n800,
                              mb: 0.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.title}
                          </Typography>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography sx={{ fontSize: 11, color: C.n400 }}>
                              {t.assigned_to_detail?.username || "—"}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <CalendarToday
                                sx={{ fontSize: 10, color: overdue ? C.red : C.n400 }}
                              />
                              <Typography
                                sx={{
                                  fontSize: 10,
                                  color: overdue ? C.red : C.n400,
                                  fontWeight: overdue ? 700 : 400,
                                }}
                              >
                                {fmtDate(t.due_date)}
                                {overdue ? " ⚠️" : ""}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      </Grid>
                    );
                  })}
              </Grid>
            )}
          </Card>
        </Box>
      )}

      {activeTab === 1 && <AdminPerformanceTab allUsers={users} />}
    </Box>
  );
}

AdminDashboard.propTypes = { data: PropTypes.object, onRefresh: PropTypes.func };
AdminDashboard.defaultProps = { data: {}, onRefresh: () => {} };
