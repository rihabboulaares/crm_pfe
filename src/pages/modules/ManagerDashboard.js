/* eslint-disable prettier/prettier */
// src/pages/modules/ManagerDashboard.jsx — v2 Redesigned + Feedback intégré
import React, { useState, useCallback } from "react";
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
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Alert,
} from "@mui/material";
import {
  PersonAdd,
  CheckCircle,
  AttachMoney,
  People,
  TrendingUp,
  Warning,
  EmojiEvents,
  Add,
  Close,
  Send as SendIcon,
  Phone,
  Email,
  Groups,
  ExpandMore,
  ExpandLess,
  TrendingDown,
  BarChart as BarChartIcon,
  Timeline,
  FiberManualRecord,
  RateReview,
  Star,
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
} from "recharts";

import { ScoreRing, GoalRow, AlertRow, PerfSkeleton, scoreColor } from "./PerformanceWidgets";
import {
  useTeamKPI,
  useAlerts,
  useLeaderboard,
  useCommercialGoals,
  perfApi,
} from "../../hooks/usePerformance";
import { FeedbackButton, useTrackActivity } from "../superadmin/Marketingwidgets";
import DashboardDataFrame, { useOfficialDashboardData } from "./DashboardDataFrame";

const toList = (d) => (Array.isArray(d) ? d : d?.results || []);

const C = {
  red: "#dc2626",
  green: "#059669",
  blue: "#2563eb",
  amber: "#d97706",
  purple: "#7c3aed",
  teal: "#0d9488",
  n50: "#f8fafc",
  n100: "#f1f5f9",
  n200: "#e2e8f0",
  n400: "#94a3b8",
  n500: "#64748b",
  n600: "#475569",
  n800: "#1e293b",
  grad: "linear-gradient(135deg,#dc2626 0%,#991b1b 100%)",
};

const fadeUp = keyframes`from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}`;

const AccentCard = styled(Box)(({ accent }) => ({
  background: "#fff",
  border: `1px solid ${C.n200}`,
  borderRadius: 16,
  borderTop: `3px solid ${accent || C.red}`,
  padding: "20px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  transition: "box-shadow 0.2s",
  "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.08)" },
}));

const KpiTile = styled(Box)(({ color }) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "16px 18px",
  borderRadius: 14,
  background: "#fff",
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
  "&:hover": {
    background: "linear-gradient(135deg,#dc2626,#7f1d1d)",
    transform: "translateY(-1px)",
  },
  "&:disabled": { background: C.n200, boxShadow: "none", color: "#fff" },
  transition: "all 0.18s",
}));

const GhostBtn = styled(Button)(({ bcolor }) => ({
  border: `1.5px solid ${alpha(bcolor || C.red, 0.3)}`,
  color: bcolor || C.red,
  background: "transparent",
  borderRadius: 10,
  textTransform: "none",
  fontWeight: 600,
  fontSize: 13,
  padding: "7px 16px",
  "&:hover": { background: alpha(bcolor || C.red, 0.05), borderColor: bcolor || C.red },
  transition: "all 0.15s",
}));

const MiniBar = ({ value, color, label }) => (
  <Box sx={{ minWidth: 90 }}>
    <Stack direction="row" justifyContent="space-between" mb={0.3}>
      <Typography sx={{ fontSize: 10, color: C.n400 }}>{label}</Typography>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color }}>{Math.round(value)}%</Typography>
    </Stack>
    <Box sx={{ height: 4, borderRadius: 2, bgcolor: alpha(color, 0.12), overflow: "hidden" }}>
      <Box
        sx={{
          height: "100%",
          width: `${Math.min(100, value)}%`,
          bgcolor: color,
          borderRadius: 2,
          transition: "width 0.8s ease",
        }}
      />
    </Box>
  </Box>
);
MiniBar.propTypes = { value: PropTypes.number, color: PropTypes.string, label: PropTypes.string };

const ActivityPills = ({ calls = 0, emails = 0, meetings = 0 }) => (
  <Stack direction="row" spacing={0.5}>
    {[
      { icon: <Phone sx={{ fontSize: 10 }} />, val: calls, color: C.blue },
      { icon: <Email sx={{ fontSize: 10 }} />, val: emails, color: C.purple },
      { icon: <Groups sx={{ fontSize: 10 }} />, val: meetings, color: C.teal },
    ].map((item, i) => (
      <Box
        key={i}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.3,
          bgcolor: alpha(item.color, 0.1),
          borderRadius: 1,
          px: 0.6,
          py: 0.2,
        }}
      >
        {React.cloneElement(item.icon, { sx: { fontSize: 10, color: item.color } })}
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: item.color }}>
          {item.val}
        </Typography>
      </Box>
    ))}
  </Stack>
);
ActivityPills.propTypes = {
  calls: PropTypes.number,
  emails: PropTypes.number,
  meetings: PropTypes.number,
};
ActivityPills.defaultProps = { calls: 0, emails: 0, meetings: 0 };

// FEEDBACK SECTION
function FeedbackSection({ members }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [target, setTarget] = useState(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const commerciaux = members.filter((m) => m.role === "COMMERCIAL");
  const ratingLabel = ["", "Insuffisant", "À améliorer", "Correct", "Bien", "Excellent"];
  const ratingColor = ["", C.red, C.red, C.amber, C.green, C.green];

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await perfApi.get(
        `/feedback/?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      );
      setFeedbacks(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
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
  const filtered =
    filterUser === "all"
      ? feedbacks
      : feedbacks.filter((f) => f.commercial === parseInt(filterUser));

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: C.grad,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RateReview sx={{ color: "#fff", fontSize: 19 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: C.n800 }}>
              Feedbacks manager
            </Typography>
            <Typography sx={{ fontSize: 12, color: C.n400 }}>
              {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </Typography>
          </Box>
        </Stack>
        <PrimaryBtn
          size="small"
          startIcon={<Add sx={{ fontSize: 15 }} />}
          onClick={() => setShowModal(true)}
        >
          Nouveau feedback
        </PrimaryBtn>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            sx={{ borderRadius: 2, fontSize: 13 }}
          >
            <MenuItem value="all">Tous les commerciaux</MenuItem>
            {commerciaux.map((m) => (
              <MenuItem key={m.id} value={m.id.toString()}>
                {m.username}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.8}>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = feedbacks.filter((f) => f.rating === r).length;
            return count > 0 ? (
              <Box
                key={r}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.4,
                  bgcolor: alpha(ratingColor[r], 0.08),
                  border: `1px solid ${alpha(ratingColor[r], 0.18)}`,
                  borderRadius: 8,
                  px: 1,
                  py: 0.3,
                }}
              >
                <Typography sx={{ fontSize: 11, color: "#f59e0b" }}>{"★".repeat(r)}</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: ratingColor[r] }}>
                  {count}
                </Typography>
              </Box>
            ) : null;
          })}
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography sx={{ color: C.n400, fontSize: 13 }}>Chargement...</Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 5,
            bgcolor: C.n50,
            borderRadius: 14,
            border: `1px dashed ${C.n200}`,
          }}
        >
          <RateReview sx={{ fontSize: 36, color: C.n300, mb: 1 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.n400 }}>
            Aucun feedback ce mois
          </Typography>
          <Typography sx={{ fontSize: 12, color: C.n400, mt: 0.5, mb: 2 }}>
            Donnez du feedback à vos commerciaux pour les motiver
          </Typography>
          <GhostBtn
            size="small"
            startIcon={<Add sx={{ fontSize: 14 }} />}
            onClick={() => setShowModal(true)}
          >
            Créer un feedback
          </GhostBtn>
        </Box>
      ) : (
        <Stack spacing={1.2}>
          {filtered.slice(0, 8).map((fb, i) => {
            const u = members.find((m) => m.id === fb.commercial);
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
                  transition: "all 0.15s",
                  "&:hover": { bgcolor: alpha(col, 0.06) },
                }}
              >
                <Stack direction="row" alignItems="flex-start" gap={1.5}>
                  <Avatar
                    sx={{
                      width: 38,
                      height: 38,
                      bgcolor: alpha(C.purple, 0.12),
                      color: C.purple,
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {u?.username?.[0]?.toUpperCase() || "?"}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.3} flexWrap="wrap">
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                        {u?.username || `#${fb.commercial}`}
                      </Typography>
                      <Stack direction="row" spacing={0.1}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Typography
                            key={s}
                            sx={{ fontSize: 13, color: s <= r ? "#f59e0b" : C.n200, lineHeight: 1 }}
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
      )}

      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        PaperProps={{ sx: { borderRadius: 4, minWidth: 440 } }}
      >
        <Box sx={{ position: "relative", pt: 5 }}>
          <Box
            sx={{
              position: "absolute",
              top: -22,
              left: "50%",
              transform: "translateX(-50%)",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: C.grad,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 14px ${alpha(C.red, 0.35)}`,
            }}
          >
            <RateReview sx={{ color: "#fff", fontSize: 24 }} />
          </Box>
        </Box>
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: C.n800 }}>
            Nouveau feedback
          </Typography>
          <Typography sx={{ fontSize: 12, color: C.n400, mt: 0.3 }}>
            {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          {sentOk ? (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <Typography sx={{ fontSize: 36, mb: 1 }}>🎉</Typography>
              <Typography sx={{ fontWeight: 700, color: C.green, fontSize: 15 }}>
                Feedback envoyé avec succès !
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5} mt={0.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Commercial ciblé *</InputLabel>
                <Select
                  value={target?.id || ""}
                  label="Commercial ciblé *"
                  onChange={(e) => setTarget(commerciaux.find((m) => m.id === e.target.value))}
                  sx={{ borderRadius: 2 }}
                >
                  {commerciaux.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{
                            width: 26,
                            height: 26,
                            fontSize: 11,
                            bgcolor: alpha(C.purple, 0.15),
                            color: C.purple,
                          }}
                        >
                          {m.username?.[0]?.toUpperCase()}
                        </Avatar>
                        <span>{m.username}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n600, mb: 1.5 }}>
                  Note globale *
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Box
                      key={s}
                      onMouseEnter={() => setHover(s)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(s)}
                      sx={{
                        fontSize: 32,
                        cursor: "pointer",
                        transition: "all 0.1s",
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
                placeholder="Ex: Excellent travail ce mois-ci ! Améliorer la prospection..."
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
              {sending ? "Envoi..." : "Envoyer le feedback"}
            </PrimaryBtn>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}
FeedbackSection.propTypes = { members: PropTypes.array };
FeedbackSection.defaultProps = { members: [] };

// COMMERCIAL DETAIL PANEL
function CommercialDetailPanel({ entry, kpi, history, onFeedback, onGoal }) {
  if (!entry)
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 1.5,
          py: 6,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            bgcolor: C.n100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <People sx={{ fontSize: 26, color: C.n300 }} />
        </Box>
        <Typography sx={{ fontSize: 13, color: C.n400, textAlign: "center" }}>
          Cliquez sur un commercial{"\n"}pour voir sa fiche
        </Typography>
      </Box>
    );
  const color = scoreColor(entry.score);
  const sd = kpi || entry;
  return (
    <Box sx={{ p: 2.5, height: "100%", overflowY: "auto" }}>
      <Box
        sx={{
          p: 2,
          borderRadius: 14,
          mb: 2,
          background: `linear-gradient(135deg,${alpha(color, 0.08)},${alpha(color, 0.02)})`,
          border: `1px solid ${alpha(color, 0.2)}`,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar
              sx={{
                width: 46,
                height: 46,
                bgcolor: alpha(color, 0.15),
                color,
                fontWeight: 800,
                fontSize: 17,
              }}
            >
              {entry.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: C.n800 }}>
                {entry.username}
              </Typography>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  bgcolor: alpha(color, 0.1),
                  border: `1px solid ${alpha(color, 0.25)}`,
                  borderRadius: 20,
                  px: 1,
                  py: 0.2,
                }}
              >
                <FiberManualRecord sx={{ fontSize: 8, color }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>
                  {Math.round(entry.score)}%
                </Typography>
              </Box>
            </Box>
          </Stack>
          <ScoreRing score={entry.score} size={68} strokeWidth={7} label="KPI" />
        </Stack>
        <Grid container spacing={0.8}>
          {[
            {
              label: "Tâches",
              value: `${sd.tasks_done || 0}/${sd.tasks_total || 0}`,
              color: C.blue,
            },
            { label: "Dans les temps", value: sd.tasks_on_time || 0, color: C.green },
            { label: "Deals", value: sd.opportunities_won || 0, color: C.amber },
            {
              label: "Pénalités",
              value: `${sd.penalty_points || 0} pts`,
              color: (sd.penalty_points || 0) < 0 ? C.red : C.green,
            },
          ].map((s) => (
            <Grid item xs={6} key={s.label}>
              <Box
                sx={{ textAlign: "center", p: 0.8, bgcolor: alpha(s.color, 0.07), borderRadius: 2 }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: s.color }}>
                  {s.value}
                </Typography>
                <Typography sx={{ fontSize: 9, color: C.n400 }}>{s.label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          color: C.n400,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          mb: 1,
        }}
      >
        Activités ce mois
      </Typography>
      <Stack direction="row" spacing={0.8} mb={2}>
        {[
          { icon: <Phone />, val: sd.calls || 0, label: "Appels", color: C.blue },
          { icon: <Email />, val: sd.emails || 0, label: "Emails", color: C.purple },
          { icon: <Groups />, val: sd.meetings || 0, label: "Meetings", color: C.teal },
        ].map((item) => (
          <Box
            key={item.label}
            sx={{
              flex: 1,
              textAlign: "center",
              p: 1,
              bgcolor: alpha(item.color, 0.07),
              borderRadius: 2,
              border: `1px solid ${alpha(item.color, 0.14)}`,
            }}
          >
            {React.cloneElement(item.icon, { sx: { fontSize: 15, color: item.color, mb: 0.2 } })}
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: item.color, lineHeight: 1 }}>
              {item.val}
            </Typography>
            <Typography sx={{ fontSize: 9, color: C.n400 }}>{item.label}</Typography>
          </Box>
        ))}
      </Stack>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          color: C.n400,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          mb: 1,
        }}
      >
        Décomposition
      </Typography>
      <Stack spacing={1} mb={2}>
        {[
          { label: "Tâches", value: sd.score_tasks || 0, color: C.blue },
          { label: "Délais", value: sd.score_deadlines || 0, color: C.green },
          { label: "Activités", value: sd.score_activities || 0, color: C.purple },
          { label: "Opportunités", value: sd.score_opportunities || 0, color: C.amber },
        ].map((item) => (
          <Box key={item.label}>
            <Stack direction="row" justifyContent="space-between" mb={0.3}>
              <Typography sx={{ fontSize: 11, color: C.n600 }}>{item.label}</Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: item.color }}>
                {Math.round(item.value)}%
              </Typography>
            </Stack>
            <Box
              sx={{
                height: 4,
                borderRadius: 3,
                bgcolor: alpha(item.color, 0.1),
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${item.value}%`,
                  bgcolor: item.color,
                  borderRadius: 3,
                  transition: "width 0.8s ease",
                }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
      {history && history.length > 0 && (
        <>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: C.n400,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              mb: 1,
            }}
          >
            Évolution (6 mois)
          </Typography>
          <Box sx={{ height: 72, mb: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: C.n400 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: C.n400 }} />
                <ReTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={(v) => [`${Math.round(v)}%`, "Score"]}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#ag2)"
                  dot={{ r: 2.5, fill: color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
      <Stack direction="row" spacing={1}>
        <GhostBtn
          fullWidth
          size="small"
          startIcon={<RateReview sx={{ fontSize: 14 }} />}
          onClick={() => onFeedback(entry)}
        >
          Feedback
        </GhostBtn>
        <GhostBtn
          fullWidth
          size="small"
          bcolor={C.blue}
          startIcon={<Star sx={{ fontSize: 14 }} />}
          onClick={() => onGoal(entry)}
        >
          Objectif
        </GhostBtn>
      </Stack>
    </Box>
  );
}
CommercialDetailPanel.propTypes = {
  entry: PropTypes.object,
  kpi: PropTypes.object,
  history: PropTypes.array,
  onFeedback: PropTypes.func,
  onGoal: PropTypes.func,
};
CommercialDetailPanel.defaultProps = {
  entry: null,
  kpi: null,
  history: [],
  onFeedback: () => {},
  onGoal: () => {},
};

// PERFORMANCE TABLE
function PerformanceTable({ leaderboard, selected, onSelect }) {
  if (!leaderboard.length)
    return (
      <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>
        Aucune donnée KPI ce mois.
      </Alert>
    );
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ borderRadius: 14, border: `1px solid ${C.n200}`, overflow: "hidden" }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: C.n50 }}>
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
                  color: C.n400,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  borderBottom: `1px solid ${C.n200}`,
                  py: 1.5,
                }}
              >
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {leaderboard.map((entry) => {
            const isSel = selected?.user_id === entry.user_id;
            const color = scoreColor(entry.score);
            const taskPct =
              entry.tasks_total > 0 ? Math.round((entry.tasks_done / entry.tasks_total) * 100) : 0;
            const timePct =
              entry.tasks_done > 0
                ? Math.round(((entry.tasks_on_time || 0) / entry.tasks_done) * 100)
                : 0;
            const rank =
              entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
            return (
              <TableRow
                key={entry.user_id}
                onClick={() => onSelect(isSel ? null : entry)}
                sx={{
                  cursor: "pointer",
                  bgcolor: isSel ? alpha(C.red, 0.03) : "white",
                  borderLeft: isSel ? `3px solid ${C.red}` : "3px solid transparent",
                  transition: "all .15s",
                  "&:hover": { bgcolor: alpha(C.n100, 0.8) },
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
                        width: 28,
                        height: 28,
                        bgcolor: alpha(color, 0.15),
                        color,
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {entry.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n800 }}>
                      {entry.username}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <Stack direction="row" alignItems="center" gap={0.8}>
                    <Typography sx={{ fontSize: 17, fontWeight: 800, color, minWidth: 40 }}>
                      {Math.round(entry.score)}%
                    </Typography>
                    {entry.score >= 85 ? (
                      <TrendingUp sx={{ fontSize: 13, color: C.green }} />
                    ) : entry.score < 60 ? (
                      <TrendingDown sx={{ fontSize: 13, color: C.red }} />
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <MiniBar
                    value={taskPct}
                    color={C.blue}
                    label={`${entry.tasks_done}/${entry.tasks_total}`}
                  />
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <MiniBar
                    value={timePct}
                    color={timePct === 100 ? C.green : timePct >= 70 ? C.amber : C.red}
                    label={`${timePct}%`}
                  />
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <ActivityPills
                    calls={entry.calls || 0}
                    emails={entry.emails || 0}
                    meetings={entry.meetings || 0}
                  />
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
  );
}
PerformanceTable.propTypes = {
  leaderboard: PropTypes.array,
  selected: PropTypes.object,
  onSelect: PropTypes.func,
};
PerformanceTable.defaultProps = { leaderboard: [], selected: null, onSelect: () => {} };

// GOAL MODAL
function GoalModal({ open, onClose, members, preselected, onCreated }) {
  const [form, setForm] = useState({ commercial: "", goal_type: "calls", target_value: "" });
  const [loading, setLoading] = useState(false);
  React.useEffect(() => {
    if (preselected) setForm((f) => ({ ...f, commercial: preselected.user_id || "" }));
  }, [preselected]);
  const GOAL_TYPES = [
    { value: "calls", label: "Appels effectués" },
    { value: "emails", label: "Emails envoyés" },
    { value: "meetings", label: "Meetings réalisés" },
    { value: "opportunities_won", label: "Opportunités gagnées" },
    { value: "tasks_done", label: "Tâches terminées" },
  ];
  const handleCreate = async () => {
    if (!form.commercial || !form.target_value) return;
    setLoading(true);
    try {
      const now = new Date();
      await perfApi.post("/goals/", {
        commercial: parseInt(form.commercial),
        goal_type: form.goal_type,
        target_value: parseInt(form.target_value),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      onCreated?.();
      setForm({ commercial: "", goal_type: "calls", target_value: "" });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: 4, minWidth: 400 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Créer un objectif</Typography>
            <Typography sx={{ fontSize: 12, color: C.n400 }}>Mois en cours</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} mt={0.5}>
          <FormControl fullWidth size="small">
            <InputLabel>Commercial ciblé</InputLabel>
            <Select
              value={form.commercial}
              label="Commercial ciblé"
              sx={{ borderRadius: 2 }}
              onChange={(e) => setForm({ ...form, commercial: e.target.value })}
            >
              {members
                .filter((m) => m.role === "COMMERCIAL")
                .map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar
                        sx={{
                          width: 22,
                          height: 22,
                          fontSize: 10,
                          bgcolor: alpha(C.blue, 0.15),
                          color: C.blue,
                        }}
                      >
                        {m.username?.[0]?.toUpperCase()}
                      </Avatar>
                      <span>{m.username}</span>
                    </Stack>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Type d&apos;objectif</InputLabel>
            <Select
              value={form.goal_type}
              label="Type d'objectif"
              sx={{ borderRadius: 2 }}
              onChange={(e) => setForm({ ...form, goal_type: e.target.value })}
            >
              {GOAL_TYPES.map((g) => (
                <MenuItem key={g.value} value={g.value}>
                  {g.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Valeur cible"
            type="number"
            fullWidth
            value={form.target_value}
            inputProps={{ min: 1 }}
            onChange={(e) => setForm({ ...form, target_value: e.target.value })}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            helperText="Ex: 50 appels, 10 deals..."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <GhostBtn onClick={onClose}>Annuler</GhostBtn>
        <PrimaryBtn
          disabled={!form.commercial || !form.target_value || loading}
          onClick={handleCreate}
          startIcon={<Add sx={{ fontSize: 16 }} />}
        >
          Créer l&apos;objectif
        </PrimaryBtn>
      </DialogActions>
    </Dialog>
  );
}
GoalModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  members: PropTypes.array,
  preselected: PropTypes.object,
  onCreated: PropTypes.func,
};
GoalModal.defaultProps = {
  open: false,
  onClose: () => {},
  members: [],
  preselected: null,
  onCreated: () => {},
};

// TEAM PERFORMANCE TAB
function TeamPerformanceTab({ members }) {
  const { data: teamData, loading } = useTeamKPI();
  const { data: alertsData } = useAlerts();
  const { data: leaderboard } = useLeaderboard();
  const { data: goals, refetch: refetchGoals } = useCommercialGoals();
  const [selected, setSelected] = useState(null);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [goalModal, setGoalModal] = useState(false);
  const [goalPresel, setGoalPresel] = useState(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [subTab, setSubTab] = useState(0);
  const leaderboardList = leaderboard?.leaderboard || [];

  const fetchFullKpi = useCallback(async (userId) => {
    try {
      const res = await perfApi.get(`/kpi/${userId}/`);
      setSelectedKpi(res.data);
    } catch {
      setSelectedKpi(null);
    }
  }, []);
  const fetchHistory = useCallback(async (userId) => {
    try {
      const res = await perfApi.get(`/kpi/history/${userId}/?months=6`);
      setSelectedHistory(res.data);
    } catch {
      setSelectedHistory([]);
    }
  }, []);
  const handleSelect = (entry) => {
    setSelected(entry);
    setSelectedKpi(null);
    if (entry) {
      fetchFullKpi(entry.user_id);
      fetchHistory(entry.user_id);
    } else setSelectedHistory([]);
  };

  const allAlerts = alertsData
    ? [
        ...(alertsData.overdue_tasks || []).map((t) => ({
          type: "error",
          title: `En retard : "${t.title}"`,
          sub: `${t.commercial} · ${new Date(t.due_date).toLocaleDateString("fr-FR")}`,
        })),
        ...(alertsData.inactive_users || []).map((u) => ({
          type: "warning",
          title: `${u.username} inactif depuis 3 jours`,
          sub: "Aucune activité détectée",
        })),
        ...(alertsData.low_score_users || []).map((u) => ({
          type: "warning",
          title: `Score faible : ${u.username} — ${Math.round(u.score)}%`,
          sub: `Pénalité : ${u.penalty} pts`,
        })),
        ...(alertsData.upcoming_tasks || []).map((t) => ({
          type: "info",
          title: `Deadline 24h : "${t.title}"`,
          sub: t.commercial,
        })),
      ]
    : [];

  if (loading) return <PerfSkeleton rows={6} />;
  const avgScore = teamData?.avg_score || 0;

  return (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
      <Grid container spacing={2} mb={3}>
        {[
          {
            label: "Score moyen",
            value: `${Math.round(avgScore)}%`,
            color: scoreColor(avgScore),
            icon: <BarChartIcon />,
          },
          {
            label: "Commerciaux",
            value: teamData?.team_count || leaderboardList.length,
            color: C.blue,
            icon: <People />,
          },
          {
            label: "En difficulté",
            value: (teamData?.in_difficulty || []).length,
            color: C.red,
            icon: <Warning />,
          },
          {
            label: "Alertes",
            value: allAlerts.length,
            color: allAlerts.length > 0 ? C.amber : C.green,
            icon: <Timeline />,
          },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <KpiTile color={s.color}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  bgcolor: alpha(s.color, 0.1),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {React.cloneElement(s.icon, { sx: { fontSize: 18, color: s.color } })}
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontSize: 10,
                    color: C.n400,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    fontWeight: 700,
                  }}
                >
                  {s.label}
                </Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>
                  {s.value}
                </Typography>
              </Box>
            </KpiTile>
          </Grid>
        ))}
      </Grid>

      {allAlerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
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
              🚨 Alertes ({allAlerts.length})
            </Typography>
            {showAlerts ? (
              <ExpandLess sx={{ fontSize: 16, color: C.n400 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 16, color: C.n400 }} />
            )}
          </Stack>
          <Collapse in={showAlerts}>
            <Grid container spacing={1}>
              {allAlerts.slice(0, 6).map((a, i) => (
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
          bgcolor: "#fff",
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                🏆 Classement —{" "}
                {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </Typography>
              <PrimaryBtn
                size="small"
                startIcon={<Add sx={{ fontSize: 14 }} />}
                onClick={() => {
                  setGoalPresel(null);
                  setGoalModal(true);
                }}
              >
                Objectif
              </PrimaryBtn>
            </Stack>
            <PerformanceTable
              leaderboard={leaderboardList}
              selected={selected}
              onSelect={handleSelect}
            />
            {goals.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 1.5 }}>
                  🎯 Objectifs équipe
                </Typography>
                <Grid container spacing={1.5}>
                  {goals.slice(0, 6).map((g) => (
                    <Grid item xs={12} sm={6} key={g.id}>
                      <Box
                        sx={{
                          p: 1.5,
                          bgcolor: "#fff",
                          borderRadius: 10,
                          border: `1px solid ${C.n200}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 11, color: C.n400, mb: 0.5 }}>
                          {g.commercial_username}
                        </Typography>
                        <GoalRow goal={g} />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: 290,
              flexShrink: 0,
              bgcolor: "#fff",
              borderRadius: 16,
              border: `1px solid ${C.n200}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              minHeight: 480,
              position: "sticky",
              top: 20,
            }}
          >
            <CommercialDetailPanel
              entry={selected}
              kpi={selectedKpi}
              history={selectedHistory}
              onFeedback={(e) => {
                setSelected(e);
                setSubTab(1);
              }}
              onGoal={(e) => {
                setGoalPresel(e);
                setGoalModal(true);
              }}
            />
          </Box>
        </Box>
      )}

      {subTab === 1 && (
        <AccentCard accent={C.purple}>
          <FeedbackSection members={members} />
        </AccentCard>
      )}
      <GoalModal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        members={members}
        preselected={goalPresel}
        onCreated={refetchGoals}
      />
    </Box>
  );
}
TeamPerformanceTab.propTypes = { members: PropTypes.array };
TeamPerformanceTab.defaultProps = { members: [] };

// MAIN
export default function ManagerDashboard({ data }) {
  const remote = useOfficialDashboardData("MANAGER", data);
  const [activeTab, setActiveTab] = useState(0);
  useTrackActivity("dashboard");
  const effectiveData = data || remote.data || {};
  const prospects = toList(effectiveData?.prospects);
  const tasks = toList(effectiveData?.tasks);
  const opportunities = toList(effectiveData?.opportunities);
  const members = toList(effectiveData?.members);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const standaloneBlocked = !data && (remote.loading || remote.error);
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "cancelled" &&
      t.due_date &&
      new Date(t.due_date) < new Date()
  );
  const activeTasks = tasks.filter((t) => t.status === "in_progress");
  const wonOpps = opportunities.filter((o) => o.stage === "won");
  const pipeline = opportunities.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  const statusColor = { todo: C.n400, in_progress: C.blue, done: C.green, cancelled: C.red };
  const statusLabel = {
    todo: "À faire",
    in_progress: "En cours",
    done: "Terminé",
    cancelled: "Annulé",
  };
  const barData = members.map((m) => ({
    name: m.username,
    Prospects: prospects.filter((p) => p.assigned_to === m.id).length,
    Tâches: tasks.filter((t) => t.assigned_to === m.id && t.status === "done").length,
  }));
  const teamTasks = tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => new Date(a.due_date || "9999") - new Date(b.due_date || "9999"))
    .slice(0, 6);
  const tabs = [
    { label: "Mon équipe CRM", icon: <People sx={{ fontSize: 15 }} /> },
    { label: "Performance & KPIs", icon: <EmojiEvents sx={{ fontSize: 15 }} /> },
  ];

  const body = (
    <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
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
                Tableau de bord Manager
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
              <People sx={{ fontSize: 14, color: "#fff" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {members.length} membres
              </Typography>
            </Box>
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
          <TabPill key={i} active={activeTab === i ? 1 : 0} onClick={() => setActiveTab(i)}>
            {React.cloneElement(tab.icon, {
              sx: { fontSize: 15, color: activeTab === i ? C.red : C.n400 },
            })}
            <span className="lbl">{tab.label}</span>
          </TabPill>
        ))}
      </Stack>

      {activeTab === 0 && (
        <Box sx={{ animation: `${fadeUp} 0.2s ease` }}>
          <Grid container spacing={2.5} mb={3}>
            {[
              {
                label: "Membres équipe",
                value: members.length,
                color: C.blue,
                icon: <People />,
                sub: null,
              },
              {
                label: "Prospects équipe",
                value: prospects.length,
                color: C.purple,
                icon: <PersonAdd />,
                sub: `${prospects.filter((p) => p.status === "new").length} nouveaux`,
              },
              {
                label: "Tâches actives",
                value: activeTasks.length,
                color: C.amber,
                icon: <CheckCircle />,
                sub: `${overdueTasks.length} en retard`,
              },
              {
                label: "Pipeline équipe",
                value: `${(pipeline / 1000).toFixed(1)}k TND`,
                color: C.green,
                icon: <AttachMoney />,
                sub: `${wonOpps.length} gagnées`,
              },
            ].map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.label}>
                <AccentCard accent={s.color}>
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
                        {s.label}
                      </Typography>
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: C.n800 }}>
                        {s.value}
                      </Typography>
                      {s.sub && (
                        <Typography sx={{ fontSize: 11, color: C.n400 }}>{s.sub}</Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        bgcolor: alpha(s.color, 0.1),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 22 } })}
                    </Box>
                  </Stack>
                </AccentCard>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} md={7}>
              <AccentCard accent={C.blue}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <TrendingUp sx={{ color: C.blue, fontSize: 18 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                    Performance équipe
                  </Typography>
                </Stack>
                {barData.length === 0 ? (
                  <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune donnée</Typography>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.n200} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.n400 }} />
                      <YAxis tick={{ fontSize: 11, fill: C.n400 }} allowDecimals={false} />
                      <ReTooltip />
                      <Bar dataKey="Prospects" fill={C.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Tâches" fill={C.green} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </AccentCard>
            </Grid>
            <Grid item xs={12} md={5}>
              <AccentCard accent={C.purple}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 2 }}>
                  Membres de l&apos;équipe
                </Typography>
                <Stack spacing={1.2}>
                  {members.map((m, i) => {
                    const mt = tasks.filter((t) => t.assigned_to === m.id);
                    const md = mt.filter((t) => t.status === "done");
                    const pct = mt.length > 0 ? Math.round((md.length / mt.length) * 100) : 0;
                    return (
                      <Box key={m.id}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          mb={0.5}
                        >
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                bgcolor: alpha(C.blue, 0.12),
                                fontSize: 11,
                              }}
                            >
                              {m.username?.[0]?.toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                                {m.username}
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: C.n400 }}>{m.role}</Typography>
                            </Box>
                          </Stack>
                          <Chip
                            size="small"
                            label={`${md.length}/${mt.length}`}
                            sx={{
                              fontSize: 10,
                              bgcolor: alpha(C.green, 0.1),
                              color: C.green,
                              fontWeight: 700,
                            }}
                          />
                        </Stack>
                        {mt.length > 0 && (
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 3,
                              borderRadius: 2,
                              bgcolor: C.n100,
                              "& .MuiLinearProgress-bar": { bgcolor: C.green },
                            }}
                          />
                        )}
                        {i < members.length - 1 && <Divider sx={{ mt: 1.2 }} />}
                      </Box>
                    );
                  })}
                </Stack>
              </AccentCard>
            </Grid>
          </Grid>
          <AccentCard accent={C.amber}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <CheckCircle sx={{ color: C.amber, fontSize: 18 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                Tâches équipe en cours
              </Typography>
            </Stack>
            {teamTasks.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune tâche en cours</Typography>
            ) : (
              <Grid container spacing={1.2}>
                {teamTasks.map((t) => {
                  const isOverdue = t.due_date && new Date(t.due_date) < new Date();
                  const sc = isOverdue ? C.red : statusColor[t.status] || C.n400;
                  return (
                    <Grid item xs={12} sm={6} key={t.id}>
                      <Box
                        sx={{
                          p: 1.5,
                          bgcolor: isOverdue ? alpha(C.red, 0.04) : C.n50,
                          borderRadius: 10,
                          borderLeft: `3px solid ${sc}`,
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Box sx={{ flex: 1, overflow: "hidden" }}>
                            <Typography
                              sx={{
                                fontSize: 12,
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.title}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: C.n400 }}>
                              {t.assigned_to_detail?.username || "—"} ·{" "}
                              {t.due_date
                                ? new Date(t.due_date).toLocaleDateString("fr-FR")
                                : "Pas d'échéance"}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={statusLabel[t.status]}
                            sx={{
                              fontSize: 10,
                              ml: 1,
                              bgcolor: alpha(statusColor[t.status] || C.n400, 0.1),
                              color: statusColor[t.status] || C.n400,
                            }}
                          />
                        </Stack>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </AccentCard>
        </Box>
      )}
      {activeTab === 1 && <TeamPerformanceTab members={members} />}
    </Box>
  );

  if (!data) {
    return (
      <DashboardDataFrame
        loading={standaloneBlocked && remote.loading}
        error={standaloneBlocked ? remote.error : null}
        onRefresh={remote.refresh}
        lastUpdated={remote.lastUpdated}
      >
        {standaloneBlocked ? null : body}
      </DashboardDataFrame>
    );
  }

  return body;
}
ManagerDashboard.propTypes = { data: PropTypes.object };
ManagerDashboard.defaultProps = { data: null };
