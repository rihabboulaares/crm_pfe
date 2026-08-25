/* eslint-disable prettier/prettier */
// src/pages/modules/PerformanceWidgets.js
// Composants partagés entre CommercialDashboard, ManagerDashboard, AdminDashboard

import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  Typography,
  Stack,
  Avatar,
  Chip,
  LinearProgress,
  Tooltip,
  Grid,
} from "@mui/material";
import {
  EmojiEvents,
  TrendingUp,
  Star,
  CheckCircle,
  AccessTime,
  Phone,
  Email,
  Groups,
  Bolt,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

// ─────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────
export const T = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  purple: "#7c3aed",
  teal: "#0d9488",
  n50: "#fafafa",
  n100: "#f3f4f6",
  n200: "#e5e7eb",
  n500: "#6b7280",
  n700: "#374151",
  n800: "#1f2937",
  text: "var(--crm-text)",
  muted: "var(--crm-muted)",
  surface: "var(--crm-surface)",
  border: "var(--crm-border)",
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
export function scoreColor(s) {
  if (s >= 85) return T.green;
  if (s >= 70) return T.amber;
  if (s >= 50) return T.blue;
  return T.red;
}

// ─────────────────────────────────────────────
// SCORE RING — anneau SVG animé
// ─────────────────────────────────────────────
export function ScoreRing({ score = 0, size = 110, strokeWidth = 10, label = "Score KPI" }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circ;
  const color = scoreColor(score);

  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={alpha(color, 0.12)}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
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
        <Typography sx={{ fontSize: size > 90 ? 22 : 16, fontWeight: 800, color, lineHeight: 1 }}>
          {Math.round(score)}%
        </Typography>
        <Typography sx={{ fontSize: 9, color: T.muted, mt: 0.3, textAlign: "center", px: 1 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}
ScoreRing.propTypes = {
  score: PropTypes.number,
  size: PropTypes.number,
  strokeWidth: PropTypes.number,
  label: PropTypes.string,
};

// ─────────────────────────────────────────────
// KPI BAR — barre de progression avec label
// ─────────────────────────────────────────────
export function KpiBar({ label, value = 0, color, icon }) {
  // Borne la valeur entre 0 et 100
  const safeValue = Math.min(100, Math.max(0, Math.round(value || 0)));
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {icon && React.cloneElement(icon, { sx: { fontSize: 13, color } })}
          <Typography variant="caption" sx={{ color: T.muted, fontSize: 11 }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ fontWeight: 700, color }}>
          {safeValue}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={safeValue}
        sx={{
          height: 5,
          borderRadius: 3,
          bgcolor: alpha(color, 0.12),
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
}
KpiBar.propTypes = {
  label: PropTypes.string,
  value: PropTypes.number,
  color: PropTypes.string,
  icon: PropTypes.element,
};

// ─────────────────────────────────────────────
// SCORE BREAKDOWN CARD — 4 composantes
// ─────────────────────────────────────────────
export function ScoreBreakdownCard({ kpi }) {
  if (!kpi) return null;

  // Utilise directement les valeurs de l'API sans transformation
  const components = [
    {
      label: "Tâches complétées",
      value: typeof kpi.score_tasks === "number" ? kpi.score_tasks : 0,
      color: T.blue,
      icon: <CheckCircle />,
      hint: `${kpi.tasks_done || 0}/${kpi.tasks_total || 0} tâches terminées`,
    },
    {
      label: "Respect des délais",
      value: typeof kpi.score_deadlines === "number" ? kpi.score_deadlines : 0,
      color: T.green,
      icon: <AccessTime />,
      hint: `${kpi.tasks_on_time || 0} tâche(s) dans les temps`,
    },
    {
      label: "Activités",
      value: typeof kpi.score_activities === "number" ? kpi.score_activities : 0,
      color: T.purple,
      icon: <Bolt />,
      hint: `${(kpi.calls || 0) + (kpi.emails || 0) + (kpi.meetings || 0)} activités (ref: 50)`,
    },
    {
      label: "Opportunités",
      value: typeof kpi.score_opportunities === "number" ? kpi.score_opportunities : 0,
      color: T.amber,
      icon: <TrendingUp />,
      hint: `${kpi.opportunities_won || 0}/${kpi.opportunities_total || 0} gagnées`,
    },
  ];

  const hasAnyData =
    (kpi.tasks_total || 0) > 0 ||
    (kpi.calls || 0) > 0 ||
    (kpi.emails || 0) > 0 ||
    (kpi.meetings || 0) > 0;

  return (
    <Card
      sx={{
        borderRadius: 3,
        p: 2.5,
        bgcolor: "var(--crm-surface)",
        border: "1px solid var(--crm-border)",
        boxShadow: "var(--crm-shadow-sm)",
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: T.text, mb: 2 }}>
        Décomposition du score
      </Typography>

      <Stack spacing={1.5}>
        {components.map((c) => (
          <Tooltip key={c.label} title={c.hint} placement="left">
            <Box>
              <KpiBar label={c.label} value={c.value} color={c.color} icon={c.icon} />
            </Box>
          </Tooltip>
        ))}
      </Stack>

      {/* Aucune donnée ce mois */}
      {!hasAnyData && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: alpha(T.n500, 0.05),
            borderRadius: 2,
            border: `1px solid ${alpha(T.n500, 0.12)}`,
          }}
        >
          <Typography variant="caption" sx={{ color: T.muted, fontSize: 11 }}>
            Aucune activité enregistrée ce mois — les scores apparaîtront dès la première tâche
            terminée.
          </Typography>
        </Box>
      )}

      {/* Pénalités */}
      {(kpi.penalty_points || 0) < 0 && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: alpha(T.red, 0.05),
            borderRadius: 2,
            border: `1px solid ${alpha(T.red, 0.15)}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ color: T.red }}>
              ⚠️ Pénalités appliquées
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: T.red }}>
              {kpi.penalty_points} pts
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            sx={{ color: T.muted, fontSize: 10, display: "block", mt: 0.5 }}
          >
            {(kpi.tasks_late || 0) > 0 && `${kpi.tasks_late} retard(s) × -10 pts`}
            {(kpi.tasks_late || 0) > 0 && (kpi.tasks_not_done || 0) > 0 && " · "}
            {(kpi.tasks_not_done || 0) > 0 && `${kpi.tasks_not_done} non faite(s) × -20 pts`}
          </Typography>
        </Box>
      )}
    </Card>
  );
}
ScoreBreakdownCard.propTypes = { kpi: PropTypes.object };

// ─────────────────────────────────────────────
// ACTIVITY COUNTERS
// ─────────────────────────────────────────────
export function ActivityCounters({ calls = 0, emails = 0, meetings = 0 }) {
  const items = [
    { icon: <Phone />, value: calls, label: "Appels", color: T.blue },
    { icon: <Email />, value: emails, label: "Emails", color: T.purple },
    { icon: <Groups />, value: meetings, label: "Meetings", color: T.teal },
  ];
  return (
    <Stack direction="row" spacing={1.5}>
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            flex: 1,
            textAlign: "center",
            p: 1.5,
            bgcolor: alpha(item.color, 0.06),
            borderRadius: 2,
            border: `1px solid ${alpha(item.color, 0.15)}`,
          }}
        >
          {React.cloneElement(item.icon, { sx: { fontSize: 18, color: item.color, mb: 0.5 } })}
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>
            {item.value || 0}
          </Typography>
          <Typography variant="caption" sx={{ color: T.muted, fontSize: 10 }}>
            {item.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
ActivityCounters.propTypes = {
  calls: PropTypes.number,
  emails: PropTypes.number,
  meetings: PropTypes.number,
};

// ─────────────────────────────────────────────
// BADGE CHIP
// ─────────────────────────────────────────────
const BADGE_META = {
  top_seller: { icon: "🏆", label: "Top vendeur", color: "#f59e0b" },
  on_time_100: { icon: "⏱️", label: "Délais 100%", color: T.green },
  best_closer: { icon: "🎯", label: "Best closer", color: T.blue },
  calls_100: { icon: "📞", label: "100 appels", color: T.teal },
  email_champion: { icon: "📧", label: "Email champion", color: T.purple },
  streak_3: { icon: "🔥", label: "Streak 3 mois", color: T.red },
  most_improved: { icon: "📈", label: "Meilleur progrès", color: T.amber },
};

export function BadgeChip({ badgeType, size = "medium" }) {
  const meta = BADGE_META[badgeType] || { icon: "🏅", label: badgeType, color: T.n500 };
  return (
    <Tooltip title={meta.label}>
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          bgcolor: alpha(meta.color, 0.1),
          border: `1px solid ${alpha(meta.color, 0.25)}`,
          borderRadius: 2,
          px: size === "small" ? 0.8 : 1.2,
          py: size === "small" ? 0.3 : 0.5,
        }}
      >
        <span style={{ fontSize: size === "small" ? 12 : 16 }}>{meta.icon}</span>
        {size !== "small" && (
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: meta.color }}>
            {meta.label}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}
BadgeChip.propTypes = { badgeType: PropTypes.string, size: PropTypes.string };

// ─────────────────────────────────────────────
// GOAL ROW
// ─────────────────────────────────────────────
const GOAL_ICONS = {
  calls: <Phone />,
  emails: <Email />,
  meetings: <Groups />,
  opportunities_won: <EmojiEvents />,
  tasks_done: <CheckCircle />,
  prospects_contacted: <Star />,
};

export function GoalRow({ goal }) {
  const current = goal.current_value || 0;
  const target = goal.target_value || 1;
  const pct = goal.progress_pct ?? Math.min(100, Math.round((current / target) * 100));
  const color = pct >= 100 ? T.green : pct >= 60 ? T.amber : T.red;
  const icon = GOAL_ICONS[goal.goal_type] || <Star />;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          {React.cloneElement(icon, { sx: { fontSize: 14, color } })}
          <Typography variant="body2" sx={{ fontSize: 12, color: T.text }}>
            {goal.goal_type_display || goal.goal_type}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <Typography variant="caption" sx={{ fontWeight: 700, color }}>
            {current}/{target}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: 10, color: T.muted }}>
            ({pct}%)
          </Typography>
          {pct >= 100 && <Typography sx={{ fontSize: 12 }}>🎉</Typography>}
        </Stack>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, pct)}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: alpha(color, 0.12),
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
}
GoalRow.propTypes = { goal: PropTypes.object };

// ─────────────────────────────────────────────
// SPARKLINE — mini histogramme
// ─────────────────────────────────────────────
export function Sparkline({ data = [], color = T.red }) {
  if (!data || !data.length)
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44 }}>
        <Typography variant="caption" sx={{ color: T.muted, fontSize: 10 }}>
          Pas encore de données historiques
        </Typography>
      </Box>
    );

  const max = Math.max(...data.map((d) => d.score || 0), 1);
  const labels = data.map((d) => d.label || `${d.month}/${d.year}`);

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", height: 44 }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round(((d.score || 0) / max) * 40));
        const isLast = i === data.length - 1;
        return (
          <Tooltip key={i} title={`${labels[i]} : ${Math.round(d.score || 0)}%`}>
            <Box
              sx={{
                flex: 1,
                height: h,
                borderRadius: "2px 2px 0 0",
                bgcolor: isLast ? color : alpha(color, 0.3),
                cursor: "default",
                transition: "height 0.5s ease",
                "&:hover": { bgcolor: color },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
Sparkline.propTypes = { data: PropTypes.array, color: PropTypes.string };

// ─────────────────────────────────────────────
// ALERT ROW
// ─────────────────────────────────────────────
export function AlertRow({ type = "error", title, sub, action }) {
  const colors = { error: T.red, warning: T.amber, info: T.blue, success: T.green };
  const icons = { error: "🔴", warning: "🟡", info: "🔵", success: "🟢" };
  const c = colors[type] || T.red;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: alpha(c, 0.05),
        borderLeft: `3px solid ${c}`,
        mb: 1,
      }}
    >
      <Typography sx={{ fontSize: 14, flexShrink: 0 }}>{icons[type]}</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: T.text, fontSize: 12 }} noWrap>
          {title}
        </Typography>
        {sub && (
          <Typography variant="caption" sx={{ color: T.muted, fontSize: 11 }}>
            {sub}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
AlertRow.propTypes = {
  type: PropTypes.string,
  title: PropTypes.string,
  sub: PropTypes.string,
  action: PropTypes.node,
};

// ─────────────────────────────────────────────
// LEADERBOARD ROW
// ─────────────────────────────────────────────
export function LeaderboardRow({ entry, isMe = false }) {
  const {
    rank = 0,
    username = "—",
    score = 0,
    tasks_done = 0,
    tasks_total = 0,
    opportunities_won = 0,
    badges = [],
  } = entry || {};

  const color = scoreColor(score);
  const rankDisplay = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: isMe ? alpha(T.red, 0.05) : "transparent",
        border: isMe ? `1px solid ${alpha(T.red, 0.2)}` : "1px solid transparent",
        "&:hover": { bgcolor: alpha(T.n100, 0.8) },
      }}
    >
      <Typography
        sx={{
          fontSize: rank <= 3 ? 20 : 13,
          width: 28,
          textAlign: "center",
          fontWeight: 700,
          color: T.muted,
        }}
      >
        {rankDisplay}
      </Typography>
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: alpha(color, 0.15),
          color,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {username?.[0]?.toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
            {username}
          </Typography>
          {isMe && (
            <Chip
              label="Vous"
              size="small"
              sx={{ height: 16, fontSize: 9, bgcolor: alpha(T.red, 0.1), color: T.red }}
            />
          )}
        </Stack>
        <Typography variant="caption" sx={{ color: T.muted, fontSize: 10 }}>
          {tasks_done}/{tasks_total} tâches · {opportunities_won} deals
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        {(badges || []).slice(0, 2).map((b) => (
          <BadgeChip key={b} badgeType={b} size="small" />
        ))}
      </Box>
      <Typography sx={{ fontSize: 17, fontWeight: 800, color, minWidth: 44, textAlign: "right" }}>
        {Math.round(score)}%
      </Typography>
    </Box>
  );
}
LeaderboardRow.propTypes = { entry: PropTypes.object, isMe: PropTypes.bool };

// ─────────────────────────────────────────────
// FEEDBACK CARD
// ─────────────────────────────────────────────
export function FeedbackCard({ feedback }) {
  if (!feedback) return null;
  const rating = feedback.rating || 0;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const starColor = rating >= 4 ? T.amber : rating >= 3 ? T.blue : T.red;

  return (
    <Box sx={{ p: 2, bgcolor: T.surface, borderRadius: 2, border: `1px solid ${T.border}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Typography sx={{ fontSize: 16, color: starColor, letterSpacing: 1 }}>{stars}</Typography>
        <Typography variant="caption" sx={{ color: T.muted, fontSize: 10 }}>
          {feedback.period_label || ""}
          {feedback.given_by_username ? ` · ${feedback.given_by_username}` : ""}
        </Typography>
      </Stack>
      {feedback.comment && (
        <Typography
          variant="body2"
          sx={{ color: T.text, fontStyle: "italic", fontSize: 12, lineHeight: 1.5 }}
        >
          &ldquo;{feedback.comment}&rdquo;
        </Typography>
      )}
    </Box>
  );
}
FeedbackCard.propTypes = { feedback: PropTypes.object };

// ─────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────
export function PerfSkeleton({ rows = 3 }) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            height: 48,
            bgcolor: alpha(T.red, 0.05),
            borderRadius: 2,
            animation: "pulse 1.5s ease-in-out infinite",
            "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
          }}
        />
      ))}
    </Stack>
  );
}
PerfSkeleton.propTypes = { rows: PropTypes.number };

// ─────────────────────────────────────────────
// SCORE BADGE — inline dans tableaux
// ─────────────────────────────────────────────
export function ScoreBadge({ score = 0 }) {
  const color = scoreColor(score);
  return (
    <Chip
      label={`${Math.round(score)}%`}
      size="small"
      sx={{
        bgcolor: alpha(color, 0.1),
        color,
        fontWeight: 700,
        fontSize: 11,
        border: `1px solid ${alpha(color, 0.3)}`,
        borderRadius: 1,
      }}
    />
  );
}
ScoreBadge.propTypes = { score: PropTypes.number };
