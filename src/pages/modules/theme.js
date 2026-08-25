/* eslint-disable prettier/prettier */
// src/pages/modules/theme.js

import PropTypes from "prop-types"; // AJOUTEZ CETTE LIGNE
import { alpha, keyframes } from "@mui/material/styles";
import { styled, Box, Button } from "@mui/material";

// ─── PALETTE ──────────────────────────────────────────────────────
export const C = {
  red: "#dc2626",
  redDark: "#991b1b",
  redDeep: "#7f1d1d",
  redLight: "#ef4444",
  redSoft: "rgba(220, 38, 38, 0.1)",
  redMist: "rgba(220, 38, 38, 0.06)",
  redPale: "rgba(220, 38, 38, 0.14)",
  redBorder: "rgba(220, 38, 38, 0.32)",
  green: "#059669",
  greenBg: "rgba(5, 150, 105, 0.1)",
  blue: "#2563eb",
  blueBg: "rgba(37, 99, 235, 0.1)",
  amber: "#d97706",
  amberBg: "rgba(217, 119, 6, 0.1)",
  purple: "#7c3aed",
  purpleBg: "rgba(124, 58, 237, 0.1)",
  teal: "#0d9488",
  tealBg: "rgba(13, 148, 136, 0.1)",
  rose: "#e11d48",
  roseBg: "rgba(225, 29, 72, 0.1)",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n300: "#cbd5e1",
  n400: "#94a3b8",
  n500: "var(--crm-muted)",
  n600: "var(--crm-muted)",
  n700: "var(--crm-text)",
  n800: "var(--crm-text)",
  n900: "#0f172a",
  white: "var(--crm-surface)",
  surface: "var(--crm-surface)",
  bg: "var(--crm-bg)",
  border: "var(--crm-border)",
  text: "var(--crm-text)",
  muted: "var(--crm-muted)",
};

// ─── GRADIENTS ────────────────────────────────────────────────────
export const GRAD = {
  red: "linear-gradient(135deg,#dc2626 0%,#991b1b 100%)",
  redGlow: "linear-gradient(135deg,#ef4444 0%,#dc2626 60%,#7f1d1d 100%)",
  page: "linear-gradient(160deg,#fff5f5 0%,#ffffff 40%,#fef2f2 100%)",
  dark: "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)",
  darkRed: "linear-gradient(135deg,#1e0a0a 0%,#450a0a 100%)",
};

// ─── SHADOWS ──────────────────────────────────────────────────────
export const SHADOW = {
  red: `0 8px 30px ${alpha("#dc2626", 0.22)}`,
  redSm: `0 4px 14px ${alpha("#dc2626", 0.18)}`,
  card: "var(--crm-shadow-sm)",
  cardHov: "var(--crm-shadow-md)",
  sm: "var(--crm-shadow-sm)",
};

// ─── ANIMATIONS ───────────────────────────────────────────────────
export const fadeUp = keyframes`from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}`;
export const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
export const scaleIn = keyframes`from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}`;
export const shimmer = keyframes`0%{background-position:-400px 0}100%{background-position:400px 0}`;
export const sweepBar = keyframes`from{width:0}`;
export const pulseRed = keyframes`0%,100%{box-shadow:0 0 0 0 ${alpha(
  "#dc2626",
  0.35
)}}50%{box-shadow:0 0 0 8px ${alpha("#dc2626", 0)}}`;

// ─── STYLED COMPONENTS ────────────────────────────────────────────
export const Card = styled(Box, {
  shouldForwardProp: (p) => !["noPad", "accent"].includes(p),
})(({ noPad, accent }) => ({
  background: C.white,
  borderRadius: 3,
  padding: noPad ? 0 : "22px 24px",
  boxShadow: SHADOW.card,
  border: `1px solid ${C.border}`,
  color: C.text,
  transition: "box-shadow .2s,transform .2s",
  position: "relative",
  overflow: "hidden",
  ...(accent && { borderTop: `3px solid ${accent}` }),
  "&:hover": { boxShadow: SHADOW.cardHov },
}));

export const KpiCard = styled(Box, {
  shouldForwardProp: (p) => p !== "color",
})(({ color = C.red }) => ({
  background: C.white,
  borderRadius: 3,
  padding: "20px 22px",
  boxShadow: SHADOW.card,
  border: `1px solid ${alpha(color, 0.18)}`,
  borderTop: `3px solid ${color}`,
  color: C.text,
  position: "relative",
  overflow: "hidden",
  transition: "box-shadow .2s,transform .2s",
  "&::after": {
    content: '""',
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 6,
    background: alpha(color, 0.12),
    pointerEvents: "none",
  },
  "&:hover": { boxShadow: SHADOW.cardHov, transform: "translateY(-2px)" },
}));

export const HeroBanner = styled(Box)(() => ({
  borderRadius: 3,
  padding: "26px 30px",
  marginBottom: 28,
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(135deg,#0f172a 0%,#7f1d1d 54%,#dc2626 100%)",
  boxShadow: `0 18px 42px ${alpha("#7f1d1d", 0.26)}`,
  border: "1px solid rgba(255,255,255,0.12)",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    pointerEvents: "none",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.10), transparent 36%), linear-gradient(180deg, transparent, rgba(15,23,42,0.18))",
    pointerEvents: "none",
  },
}));

export const PrimaryBtn = styled(Button)(() => ({
  background: GRAD.red,
  color: "#fff",
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 700,
  fontSize: 13,
  padding: "8px 20px",
  boxShadow: SHADOW.redSm,
  transition: "all .18s",
  "&:hover": { background: GRAD.redGlow, transform: "translateY(-1px)", boxShadow: SHADOW.red },
  "&:active": { transform: "translateY(0)" },
  "&:disabled": { background: C.n200, boxShadow: "none", color: C.n400 },
}));

export const GhostBtn = styled(Button, {
  shouldForwardProp: (p) => p !== "bcolor",
})(({ bcolor = C.red }) => ({
  border: `1.5px solid ${alpha(bcolor, 0.3)}`,
  color: bcolor,
  background: "transparent",
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 600,
  fontSize: 13,
  padding: "7px 16px",
  transition: "all .15s",
  "&:hover": {
    background: alpha(bcolor, 0.06),
    borderColor: bcolor,
    transform: "translateY(-1px)",
  },
}));

export const TabPill = styled(Box, {
  shouldForwardProp: (p) => p !== "active",
})(({ active }) => ({
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 20px",
  borderRadius: 10,
  cursor: "pointer",
  background: active ? alpha(C.red, 0.08) : "transparent",
  border: active ? `1.5px solid ${alpha(C.red, 0.3)}` : "1.5px solid transparent",
  transition: "all .15s",
  "& .lbl": { fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.red : C.n500 },
}));

export const StatusBadge = styled(Box, {
  shouldForwardProp: (p) => p !== "s",
})(({ s = "todo" }) => {
  const map = {
    done: { bg: alpha(C.green, 0.1), color: "#065f46", border: alpha(C.green, 0.2) },
    in_progress: { bg: alpha(C.blue, 0.1), color: "#1e40af", border: alpha(C.blue, 0.2) },
    todo: { bg: alpha(C.n400, 0.1), color: C.n600, border: alpha(C.n400, 0.2) },
    cancelled: { bg: alpha(C.red, 0.1), color: "#991b1b", border: alpha(C.red, 0.2) },
    won: { bg: alpha(C.green, 0.1), color: "#065f46", border: alpha(C.green, 0.2) },
    lost: { bg: alpha(C.red, 0.1), color: "#991b1b", border: alpha(C.red, 0.2) },
    new: { bg: alpha(C.blue, 0.1), color: "#1e40af", border: alpha(C.blue, 0.2) },
    qualified: { bg: alpha(C.purple, 0.1), color: "#5b21b6", border: alpha(C.purple, 0.2) },
    proposal: { bg: alpha(C.amber, 0.1), color: "#92400e", border: alpha(C.amber, 0.2) },
    negotiation: { bg: alpha(C.teal, 0.1), color: "#134e4a", border: alpha(C.teal, 0.2) },
  };
  const t = map[s] || map.todo;
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: t.bg,
    color: t.color,
    border: `1px solid ${t.border}`,
    whiteSpace: "nowrap",
  };
});

export const Skeleton = styled(Box, {
  shouldForwardProp: (p) => !["w", "h", "r"].includes(p),
})(({ w = "100%", h = 16, r = 6 }) => ({
  width: w,
  height: h,
  borderRadius: r,
  background: `linear-gradient(90deg,${C.n100} 25%,${C.n200} 50%,${C.n100} 75%)`,
  backgroundSize: "800px 100%",
  animation: `${shimmer} 1.5s infinite`,
}));

// ─── HELPERS ──────────────────────────────────────────────────────
export const toList = (d) => (Array.isArray(d) ? d : d?.results || []);
export const fmtCurrency = (v) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}MTND` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}kTND` : `${v}TND`;
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";
export const isOverdue = (t) =>
  t.status !== "done" &&
  t.status !== "cancelled" &&
  t.due_date &&
  new Date(t.due_date) < new Date();
export const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();
export const getInit = (n = "") =>
  n
    .split(" ")
    .map((x) => x[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
export const monthLabel = () =>
  new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
export const scoreColor = (s) => (s >= 85 ? C.green : s >= 65 ? C.amber : C.red);

export const COLORS = [C.red, C.blue, C.green, C.amber, C.purple, C.teal, C.rose];
export const STAGE_LABELS = {
  new: "Nouveau",
  qualified: "Qualifié",
  proposal: "Proposition",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};
export const STAGE_COLORS = {
  new: C.blue,
  qualified: C.purple,
  proposal: C.amber,
  negotiation: C.teal,
  won: C.green,
  lost: C.red,
};
export const STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
  cancelled: "Annulé",
};
export const STATUS_COLORS = { todo: C.n400, in_progress: C.blue, done: C.green, cancelled: C.red };

export function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box
      sx={{
        bgcolor: C.white,
        border: `1px solid ${C.n200}`,
        borderRadius: 2,
        p: "8px 12px",
        boxShadow: SHADOW.card,
      }}
    >
      {label && <Box sx={{ fontSize: 11, fontWeight: 700, color: C.n500, mb: 0.5 }}>{label}</Box>}
      {payload.map((p, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: p.color || p.fill }} />
          <Box sx={{ fontSize: 11, color: C.n500 }}>{p.name}:</Box>
          <Box sx={{ fontSize: 11, fontWeight: 700, color: C.n800 }}>{p.value}</Box>
        </Box>
      ))}
    </Box>
  );
}

// Ajoutez la validation PropTypes pour TooltipBox
TooltipBox.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
};
