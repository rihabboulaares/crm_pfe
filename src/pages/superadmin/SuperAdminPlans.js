/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminPlans.js
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import {
  Box,
  Card,
  Typography,
  Stack,
  Avatar,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  LinearProgress,
  Paper,
  Fade,
  Alert,
} from "@mui/material";
import {
  Subscriptions,
  Add,
  Edit,
  Delete,
  People,
  Group,
  PersonSearch,
  CheckCircle,
  Business,
  TrendingUp,
  Diamond,
  Star,
  Verified,
} from "@mui/icons-material";
import { alpha, styled } from "@mui/material/styles";
import SuperAdminLayout from "./SuperAdminLayout";

// ===== STYLES INSPIRÉS DE SUBSCRIPTIONFORM =====
const StyledCard = styled(Card)(({ ispro, isenterprise }) => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  border: ispro ? "2px solid #d32f2f" : "1px solid rgba(211, 47, 47, 0.1)",
  background: ispro
    ? "linear-gradient(135deg, rgba(211, 47, 47, 0.02) 0%, rgba(255, 255, 255, 1) 100%)"
    : "#ffffff",
  boxShadow: ispro ? "0 8px 16px 0 rgba(211, 47, 47, 0.1)" : "0 4px 12px 0 rgba(0, 0, 0, 0.05)",
  overflow: "visible",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 12px 24px 0 rgba(211, 47, 47, 0.15)",
    borderColor: "#d32f2f",
  },
}));

const PopularBadge = styled(Box)({
  position: "absolute",
  top: -12,
  right: 20,
  background: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  color: "white",
  padding: "4px 12px",
  borderRadius: "16px",
  fontSize: "0.7rem",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  boxShadow: "0 4px 8px 0 rgba(211, 47, 47, 0.2)",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "4px",
});

const PlanHeader = styled(Box)(({ color }) => ({
  background:
    color === "red"
      ? "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)"
      : "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
  color: "white",
  padding: "20px",
  textAlign: "center",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: -40,
    right: -40,
    width: 80,
    height: 80,
    background: "rgba(255,255,255,0.1)",
    borderRadius: "50%",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 60,
    height: 60,
    background: "rgba(255,255,255,0.1)",
    borderRadius: "50%",
  },
}));

const FeatureItem = styled(Box)(({ included }) => ({
  display: "flex",
  alignItems: "center",
  padding: "6px 0",
  color: included ? "#1f2937" : "#9ca3af",
}));

const PriceBox = styled(Box)({
  textAlign: "center",
  padding: "16px",
  background: "rgba(211, 47, 47, 0.02)",
  borderTop: "1px solid rgba(211, 47, 47, 0.1)",
  borderBottom: "1px solid rgba(211, 47, 47, 0.1)",
});

const ActionButton = styled(Button)(({ iscurrent }) => ({
  background: iscurrent ? "transparent" : "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  color: iscurrent ? "#d32f2f" : "white",
  border: iscurrent ? `2px solid #d32f2f` : "none",
  padding: "8px 16px",
  fontSize: "0.9rem",
  fontWeight: "bold",
  textTransform: "none",
  borderRadius: "8px",
  transition: "all 0.2s ease",
  "&:hover": {
    background: iscurrent
      ? "rgba(211, 47, 47, 0.04)"
      : "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
    transform: "scale(1.02)",
    boxShadow: "0 4px 12px 0 rgba(211, 47, 47, 0.2)",
  },
}));

// ===== CONSTANTES =====
const T = {
  red: "#d32f2f",
  redLight: "rgba(211, 47, 47, 0.05)",
  redGradient: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
};

const EMPTY_PLAN = {
  name: "",
  price: "",
  duration_days: 30,
  max_users: "",
  max_teams: "",
  max_prospects: "",
  description: "",
};

// Icônes par plan
const PLAN_ICONS = {
  starter: <Business sx={{ fontSize: 32 }} />,
  pro: <TrendingUp sx={{ fontSize: 32 }} />,
  enterprise: <Diamond sx={{ fontSize: 32 }} />,
};

// ===== API =====
const api = (url) =>
  axios.get(`http://127.0.0.1:8000${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

const apiMut = (method, url, data) =>
  axios[method](`http://127.0.0.1:8000${url}`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

const apiDel = (url) =>
  axios.delete(`http://127.0.0.1:8000${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

// ===== COMPOSANT PRINCIPAL =====
export default function SuperAdminPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const r = await api("/api/superadmin/plans/");
      setPlans(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreate = () => {
    setEditPlan(null);
    setForm(EMPTY_PLAN);
    setError("");
    setFormOpen(true);
  };

  const openEdit = (plan) => {
    setEditPlan(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      duration_days: plan.duration_days || 30,
      max_users: plan.max_users ?? "",
      max_teams: plan.max_teams ?? "",
      max_prospects: plan.max_prospects ?? "",
      description: plan.description || "",
    });
    setError("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        duration_days: parseInt(form.duration_days, 10),
        max_users: form.max_users === "" ? null : parseInt(form.max_users, 10),
        max_teams: form.max_teams === "" ? null : parseInt(form.max_teams, 10),
        max_prospects: form.max_prospects === "" ? null : parseInt(form.max_prospects, 10),
      };
      if (editPlan) {
        await apiMut("put", `/api/superadmin/plans/${editPlan.id}/`, payload);
      } else {
        await apiMut("post", "/api/superadmin/plans/", payload);
      }
      setFormOpen(false);
      fetchPlans();
    } catch (e) {
      const msg = e.response?.data;
      setError(
        typeof msg === "object"
          ? Object.values(msg).flat().join(" ")
          : "Erreur lors de la sauvegarde"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce plan ?")) return;
    setDeleting(id);
    try {
      await apiDel(`/api/superadmin/plans/${id}/`);
      fetchPlans();
    } catch (e) {
      alert(e.response?.data?.error || "Impossible de supprimer ce plan");
    } finally {
      setDeleting(null);
    }
  };

  const getPlanIcon = (planName) => {
    const name = planName?.toLowerCase() || "";
    return PLAN_ICONS[name] || <Business sx={{ fontSize: 32 }} />;
  };

  const Field = ({ label, field, type, placeholder }) => (
    <TextField
      fullWidth
      label={label}
      type={type}
      value={form[field]}
      placeholder={placeholder}
      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
      size="small"
      InputProps={{ sx: { borderRadius: 1.5 } }}
    />
  );

  Field.propTypes = {
    label: PropTypes.string.isRequired,
    field: PropTypes.string.isRequired,
    type: PropTypes.string,
    placeholder: PropTypes.string,
  };

  Field.defaultProps = {
    type: "text",
    placeholder: "",
  };

  return (
    <SuperAdminLayout>
      {/* Header avec bouton Nouveau plan */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: T.gray900 }}>
              Packs d&apos;abonnement
            </Typography>
            <Typography variant="body1" sx={{ color: T.gray500, mt: 1 }}>
              Gérez les plans disponibles sur la plateforme
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              {/* Bouton Nouveau plan - AJOUTÉ ICI */}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={openCreate}
                sx={{
                  background: T.redGradient,
                  color: "white",
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  px: 3,
                  py: 1,
                  "&:hover": {
                    background: "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 16px 0 rgba(211, 47, 47, 0.3)",
                  },
                  transition: "all 0.2s",
                }}
              >
                Nouveau plan
              </Button>

              {/* Bouton Actualiser */}
              <Button
                variant="outlined"
                onClick={fetchPlans}
                startIcon={<Subscriptions />}
                disabled={loading}
                sx={{
                  borderColor: alpha(T.red, 0.3),
                  color: T.red,
                  "&:hover": {
                    borderColor: T.red,
                    bgcolor: T.redLight,
                  },
                }}
              >
                Actualiser
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Loading bar */}
      {loading && (
        <Fade in={loading}>
          <Box sx={{ width: "100%", mb: 4 }}>
            <LinearProgress
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: alpha(T.red, 0.1),
                "& .MuiLinearProgress-bar": {
                  bgcolor: T.red,
                  backgroundImage: T.redGradient,
                },
              }}
            />
            <Typography variant="body2" sx={{ color: T.gray500, textAlign: "center", mt: 2 }}>
              Chargement des données...
            </Typography>
          </Box>
        </Fade>
      )}

      {/* Grille des plans */}
      <Grid container spacing={3}>
        {plans.map((plan, index) => {
          const isPro = plan.name?.toLowerCase() === "pro";
          const isEnterprise = plan.name?.toLowerCase() === "enterprise";
          const isPopular = plan.name?.toLowerCase() === "pro";
          const icon = getPlanIcon(plan.name);

          return (
            <Grid item xs={12} md={4} key={plan.id}>
              <Fade in timeout={500 + index * 200}>
                <div>
                  <StyledCard ispro={isPro} isenterprise={isEnterprise}>
                    {/* Badge populaire */}
                    {isPopular && (
                      <PopularBadge>
                        <Star sx={{ fontSize: 12 }} />
                        POPULAIRE
                      </PopularBadge>
                    )}

                    {/* Header avec dégradé */}
                    <PlanHeader color={isEnterprise ? "darkRed" : "red"}>
                      <Box sx={{ color: "white" }}>
                        {React.cloneElement(icon, { sx: { fontSize: 40 } })}
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "white", mt: 1 }}>
                        {plan.name.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)" }}>
                        {plan.description || `Plan ${plan.name}`}
                      </Typography>
                    </PlanHeader>

                    {/* Prix */}
                    <PriceBox>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: T.red }}>
                        {plan.price}TND
                      </Typography>
                      <Typography variant="body2" sx={{ color: T.gray500 }}>
                        par mois
                      </Typography>
                    </PriceBox>

                    {/* Caractéristiques */}
                    <Box sx={{ p: 3, flexGrow: 1 }}>
                      {[
                        {
                          icon: <People />,
                          label: `${plan.max_users ?? "Illimité"} utilisateurs`,
                          included: true,
                        },
                        {
                          icon: <Group />,
                          label: `${plan.max_teams ?? "Illimité"} équipes`,
                          included: true,
                        },
                        {
                          icon: <PersonSearch />,
                          label: `${plan.max_prospects ?? "Illimité"} prospects`,
                          included: true,
                        },
                        {
                          icon: <CheckCircle />,
                          label: `Cycle de ${plan.duration_days} jours`,
                          included: true,
                        },
                        {
                          icon: <Verified />,
                          label: "Support prioritaire",
                          included: isEnterprise,
                        },
                        {
                          icon: <Verified />,
                          label: "Fonctionnalités avancées",
                          included: isPro || isEnterprise,
                        },
                      ].map(({ icon, label, included }) => (
                        <FeatureItem key={label} included={included}>
                          <Box sx={{ minWidth: 32, color: included ? T.red : T.gray400 }}>
                            {React.cloneElement(icon, { sx: { fontSize: 18 } })}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{ ml: 1, color: included ? T.gray700 : T.gray400 }}
                          >
                            {label}
                          </Typography>
                        </FeatureItem>
                      ))}
                    </Box>

                    {/* Nombre d'abonnés */}
                    <Box sx={{ px: 3, pb: 2 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          bgcolor: T.redLight,
                          borderRadius: 2,
                          textAlign: "center",
                        }}
                      >
                        <Typography variant="body2" sx={{ color: T.red, fontWeight: 600 }}>
                          {plan.subscribers_count || 0} entreprise
                          {plan.subscribers_count !== 1 ? "s" : ""} abonnée
                          {plan.subscribers_count !== 1 ? "s" : ""}
                        </Typography>
                      </Paper>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ p: 2, pt: 0, display: "flex", gap: 1 }}>
                      <ActionButton
                        fullWidth
                        iscurrent={false}
                        onClick={() => openEdit(plan)}
                        startIcon={<Edit />}
                      >
                        Modifier
                      </ActionButton>
                      <ActionButton
                        fullWidth
                        iscurrent={true}
                        onClick={() => handleDelete(plan.id)}
                        disabled={deleting === plan.id}
                        startIcon={
                          deleting === plan.id ? <CircularProgress size={16} /> : <Delete />
                        }
                      >
                        {deleting === plan.id ? "..." : "Supprimer"}
                      </ActionButton>
                    </Box>

                    {/* Badge décoratif pour le plan actif */}
                    {isPro && (
                      <Box sx={{ position: "absolute", bottom: 10, right: 10, opacity: 0.1 }}>
                        <Star sx={{ fontSize: 60, color: T.red }} />
                      </Box>
                    )}
                  </StyledCard>
                </div>
              </Fade>
            </Grid>
          );
        })}
      </Grid>

      {/* Dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            background: T.redGradient,
            color: "white",
            py: 2,
            fontWeight: 600,
          }}
        >
          {editPlan ? `Modifier ${editPlan.name}` : "Nouveau plan"}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <Field label="Nom" field="name" placeholder="starter / pro / enterprise" />
            <Field label="Prix (TND/mois)" field="price" type="number" />
            <Field label="Durée (jours)" field="duration_days" type="number" />
            <Field
              label="Max utilisateurs"
              field="max_users"
              type="number"
              placeholder="vide = illimité"
            />
            <Field
              label="Max équipes"
              field="max_teams"
              type="number"
              placeholder="vide = illimité"
            />
            <Field
              label="Max prospects"
              field="max_prospects"
              type="number"
              placeholder="vide = illimité"
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              size="small"
              InputProps={{ sx: { borderRadius: 1.5 } }}
            />
            {error && (
              <Alert severity="error" sx={{ borderRadius: 1 }}>
                {error}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setFormOpen(false)}
            sx={{
              color: T.gray500,
              textTransform: "none",
              "&:hover": { bgcolor: T.gray100 },
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="contained"
            sx={{
              background: T.redGradient,
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              "&:hover": {
                background: "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
              },
            }}
          >
            {saving ? (
              <CircularProgress size={18} sx={{ color: "white" }} />
            ) : editPlan ? (
              "Enregistrer"
            ) : (
              "Créer"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </SuperAdminLayout>
  );
}
