/* eslint-disable prettier/prettier */
// src/components/marketing/MarketingWidgets.jsx
// Ces composants s'affichent côté utilisateur (après login ou dans le profil)

import React, { useEffect, useState } from "react";
import axios from "axios";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  IconButton,
  alpha,
} from "@mui/material";
import {
  Star as StarIcon,
  Close as CloseIcon,
  Feedback as FeedbackIcon,
  Campaign as CampaignIcon,
} from "@mui/icons-material";

const API = "http://127.0.0.1:8000/api/superadmin";
const RED = "#d32f2f";

// ══════════════════════════════════════════════════════════════
// 1. POPUP SOURCE D'ACQUISITION (s'affiche une seule fois)
// ══════════════════════════════════════════════════════════════
export function AcquisitionSourcePopup() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const token = localStorage.getItem("token");

  const api = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    const checkSource = async () => {
      try {
        const res = await api.get("/acquisition-source/");
        if (!res.data) {
          setTimeout(() => setOpen(true), 3000);
        }
      } catch {
        setTimeout(() => setOpen(true), 3000);
      }
    };
    if (token) checkSource();
  }, []);

  const handleSubmit = async () => {
    if (!source) return;
    try {
      await api.post("/acquisition-source/", { source });
      setSubmitted(true);
      setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const sources = [
    { value: "google", label: "🔍 Google Search" },
    { value: "social_media", label: "📱 Réseaux sociaux" },
    { value: "recommendation", label: "👥 Recommandation d'un ami" },
    { value: "advertising", label: "📢 Publicité" },
    { value: "linkedin", label: "💼 LinkedIn" },
    { value: "event", label: "🎤 Événement / Conférence" },
    { value: "other", label: "✨ Autre" },
  ];

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${alpha(RED, 0.1)}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <CampaignIcon sx={{ color: RED }} />
            <Typography fontWeight={600}>Comment nous avez-vous connu ?</Typography>
          </Stack>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {submitted ? (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            Merci pour votre réponse ! 🎉
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Aidez-nous à comprendre comment vous avez découvert notre CRM.
            </Typography>
            {sources.map((s) => (
              <Paper
                key={s.value}
                onClick={() => setSource(s.value)}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: "pointer",
                  border: `2px solid ${source === s.value ? RED : alpha(RED, 0.15)}`,
                  bgcolor: source === s.value ? alpha(RED, 0.04) : "white",
                  transition: "all 0.2s",
                  "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.02) },
                }}
              >
                <Typography variant="body2">{s.label}</Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>

      {!submitted && (
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} size="small">
            Plus tard
          </Button>
          <Button
            variant="contained"
            disabled={!source}
            onClick={handleSubmit}
            sx={{
              background: RED,
              borderRadius: 2,
              textTransform: "none",
              "&:hover": { background: "#b71c1c" },
            }}
          >
            Confirmer
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

// ✅ Petit composant Paper avec PropTypes corrigés
function Paper({ children, sx, onClick }) {
  return (
    <Box component="div" sx={sx} onClick={onClick}>
      {children}
    </Box>
  );
}

// ✅ Validation PropTypes complète — corrige l'erreur ESLint ligne 164
Paper.propTypes = {
  children: PropTypes.node.isRequired,
  sx: PropTypes.object,
  onClick: PropTypes.func,
};

Paper.defaultProps = {
  sx: {},
  onClick: undefined,
};

// ══════════════════════════════════════════════════════════════
// 2. POPUP RATING (s'affiche après 7 jours d'utilisation)
// ══════════════════════════════════════════════════════════════
export function AppRatingPopup() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const token = localStorage.getItem("token");

  const api = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    const checkRating = async () => {
      try {
        const res = await api.get("/rating/");
        if (!res.data) {
          setTimeout(() => setOpen(true), 10000);
        }
      } catch {
        setTimeout(() => setOpen(true), 10000);
      }
    };
    if (token) checkRating();
  }, []);

  const handleSubmit = async () => {
    if (!rating) return;
    try {
      await api.post("/rating/", { rating, comment });
      setSubmitted(true);
      setTimeout(() => setOpen(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${alpha(RED, 0.1)}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={1}>
            <StarIcon sx={{ color: "#ff9800" }} />
            <Typography fontWeight={600}>Évaluez notre CRM</Typography>
          </Stack>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {submitted ? (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            Merci pour votre évaluation ! ⭐
          </Alert>
        ) : (
          <Stack spacing={3} alignItems="center">
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Comment évaluez-vous votre expérience avec notre CRM ?
            </Typography>
            <Rating
              value={rating}
              onChange={(_, val) => setRating(val)}
              size="large"
              sx={{ "& .MuiRating-iconFilled": { color: "#ff9800" } }}
            />
            {rating > 0 && (
              <Typography variant="caption" color="text.secondary">
                {
                  ["", "Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"][
                    rating
                  ]
                }
              </Typography>
            )}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Commentaire (optionnel)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              size="small"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Stack>
        )}
      </DialogContent>

      {!submitted && (
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} size="small">
            Plus tard
          </Button>
          <Button
            variant="contained"
            disabled={!rating}
            onClick={handleSubmit}
            sx={{
              background: "#ff9800",
              borderRadius: 2,
              textTransform: "none",
              "&:hover": { background: "#f57c00" },
            }}
          >
            Envoyer
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// 3. BOUTON FEEDBACK (toujours visible dans le profil / sidebar)
// ══════════════════════════════════════════════════════════════
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const token = localStorage.getItem("token");

  const api = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
  });

  const handleSubmit = async () => {
    if (!message.trim()) return;
    try {
      await api.post("/feedback/", { category, message });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage("");
        setCategory("general");
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<FeedbackIcon />}
        onClick={() => setOpen(true)}
        size="small"
        sx={{
          borderColor: alpha(RED, 0.3),
          color: RED,
          borderRadius: 2,
          textTransform: "none",
          "&:hover": { borderColor: RED, bgcolor: alpha(RED, 0.04) },
        }}
      >
        Donner un feedback
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ borderBottom: `1px solid ${alpha(RED, 0.1)}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <FeedbackIcon sx={{ color: RED }} />
              <Typography fontWeight={600}>Votre feedback</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {submitted ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Merci pour votre feedback ! Nous l&apos;examinerons rapidement. 💬
            </Alert>
          ) : (
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={category}
                  label="Catégorie"
                  onChange={(e) => setCategory(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="suggestion">💡 Suggestion</MenuItem>
                  <MenuItem value="bug">🐛 Problème / Bug</MenuItem>
                  <MenuItem value="improvement">🚀 Amélioration</MenuItem>
                  <MenuItem value="general">💬 Général</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Votre message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre suggestion, problème ou commentaire..."
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Stack>
          )}
        </DialogContent>

        {!submitted && (
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpen(false)} size="small">
              Annuler
            </Button>
            <Button
              variant="contained"
              disabled={!message.trim()}
              onClick={handleSubmit}
              sx={{
                background: RED,
                borderRadius: 2,
                textTransform: "none",
                "&:hover": { background: "#b71c1c" },
              }}
            >
              Envoyer
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// 4. HOOK pour tracker l'activité automatiquement
// ══════════════════════════════════════════════════════════════
export function useTrackActivity(module) {
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token || !module) return;

    const track = async () => {
      try {
        await axios.post(
          `${API}/track-activity/`,
          { module, action: `visited_${module}` },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        // Silencieux — ne pas bloquer l'UX
      }
    };

    track();
  }, [module]);
}
