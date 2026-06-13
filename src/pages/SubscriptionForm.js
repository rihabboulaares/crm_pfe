// src/pages/SubscriptionForm.jsx
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import {
  Card,
  CardContent,
  CardActions,
  Grid,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Chip,
  Divider,
  Box,
  LinearProgress,
  Paper,
  Tooltip,
  Zoom,
  Fade,
  Grow,
  Collapse,
  IconButton,
  Avatar,
  Container,
  Stack,
} from "@mui/material";

import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Star as StarIcon,
  Verified as VerifiedIcon,
  Support as SupportIcon,
  Security as SecurityIcon,
  AutoGraph as AutoGraphIcon,
  Diamond as DiamondIcon,
  CalendarToday as CalendarIcon,
  Event as EventIcon,
  HourglassEmpty as HourglassIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
  Assessment as AssessmentIcon,
  Restore as RestoreIcon,
  Payment as PaymentIcon,
} from "@mui/icons-material";

import { styled } from "@mui/material/styles";

// ── Styled Components ────────────────────────────────────────
const StyledCard = styled(Card)(({ iscurrent }) => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  border: iscurrent ? "2px solid #d32f2f" : "1px solid rgba(211, 47, 47, 0.1)",
  background: iscurrent
    ? "linear-gradient(135deg, rgba(211, 47, 47, 0.02) 0%, rgba(255, 255, 255, 1) 100%)"
    : "#ffffff",
  boxShadow: iscurrent ? "0 8px 16px 0 rgba(211, 47, 47, 0.1)" : "0 4px 12px 0 rgba(0, 0, 0, 0.05)",
  overflow: "visible",
  "&:hover": {
    transform: "translateY(-8px)",
    boxShadow: "0 12px 24px 0 rgba(211, 47, 47, 0.2)",
    borderColor: "#d32f2f",
  },
}));

const PopularBadge = styled(Box)({
  position: "absolute",
  top: -12,
  right: 20,
  background: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
  color: "white",
  padding: "6px 16px",
  borderRadius: "20px",
  fontSize: "0.75rem",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "1px",
  boxShadow: "0 8px 16px 0 rgba(211, 47, 47, 0.1)",
  zIndex: 1,
});

const PlanHeader = styled(Box)(({ color }) => ({
  background:
    color === "red"
      ? "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)"
      : "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
  color: "white",
  padding: "24px",
  textAlign: "center",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: -50,
    right: -50,
    width: 100,
    height: 100,
    background: "rgba(255,255,255,0.1)",
    borderRadius: "50%",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 80,
    height: 80,
    background: "rgba(255,255,255,0.1)",
    borderRadius: "50%",
  },
}));

const FeatureItem = styled(ListItem)(({ included }) => ({
  padding: "8px 16px",
  "& .MuiListItemIcon-root": {
    minWidth: 36,
    color: included ? "#d32f2f" : "#9e9e9e",
  },
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
  padding: "10px 24px",
  fontSize: "1rem",
  fontWeight: "bold",
  textTransform: "none",
  borderRadius: "8px",
  transition: "all 0.2s ease",
  "&:hover": {
    background: iscurrent
      ? "rgba(211, 47, 47, 0.04)"
      : "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
    transform: "scale(1.05)",
    boxShadow: "0 8px 16px 0 rgba(211, 47, 47, 0.1)",
  },
  "&:disabled": {
    background: "#e0e0e0",
    color: "#9e9e9e",
    border: "none",
  },
}));

const StatusChip = styled(Chip)(({ status }) => ({
  fontWeight: "bold",
  ...(status === "active" && { background: "#4caf50", color: "white" }),
  ...(status === "expiring" && { background: "#ff9800", color: "white" }),
  ...(status === "expired" && { background: "#f44336", color: "white" }),
  ...(status === "trial" && { background: "#ffb300", color: "#000" }),
}));

// ── Fonction de formatage des prix en DT ───────────────────────
const formatPrice = (price) => {
  if (!price && price !== 0) return "—";
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(price);
};

// ── Composant principal ───────────────────────────────────────
const formatLimit = (value) => (value === null || value === undefined ? "Illimité" : value);

const usagePercent = (currentValue, maxValue) => {
  if (maxValue === null || maxValue === undefined || Number(maxValue) === 0) return 0;
  return Math.min(100, Math.round((Number(currentValue || 0) / Number(maxValue)) * 100));
};

const featureLabels = {
  crm_agent: "Agent CRM",
  prospection_agent: "Agent de prospection",
  engagement_agent: "Agent d'engagement",
  exports: "Exports PDF/Excel",
};

const comparisonRows = [
  ["Dashboard", "Oui", "Oui", "Oui"],
  ["Prospects", "Oui", "Oui", "Oui"],
  ["Opportunités", "Oui", "Oui", "Oui"],
  ["Tâches", "Oui", "Oui", "Oui"],
  ["Agent CRM", "Oui", "Oui", "Oui"],
  ["Agent de prospection", "Non", "Oui", "Oui"],
  ["Agent d'engagement", "Non", "Non", "Oui"],
  ["Exports PDF/Excel", "Non", "Oui", "Oui"],
  ["Utilisateurs", "3", "10", "Illimité"],
  ["Équipes", "1", "5", "Illimité"],
  ["Prospects max", "50", "500", "Illimité"],
];

const API_BASE = "http://127.0.0.1:8000/api";

const SubscriptionForm = () => {
  const location = useLocation();

  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  const token = localStorage.getItem("token");

  const publicApi = axios.create({
    baseURL: API_BASE,
    headers: {
      "Content-Type": "application/json",
    },
  });

  publicApi.interceptors.request.use((config) => {
    if (config.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
    return config;
  });

  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // ── Retour depuis Stripe ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("success") === "true") {
      const planName = params.get("plan") || "";
      showNotification(
        `✅ Paiement confirmé ! Abonnement ${planName.toUpperCase()} activé.`,
        "success"
      );
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("cancelled") === "true") {
      showNotification("Paiement annulé. Vous pouvez réessayer à tout moment.", "warning");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location.search]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, currentRes] = await Promise.all([
        publicApi.get("/subscriptions/plans/"),
        api.get("/subscriptions/current/").catch(() => ({ data: null })),
      ]);
      setPlans(plansRes.data);
      setCurrent(currentRes.data);
    } catch (error) {
      console.error("Erreur chargement", error);
      showNotification("Erreur de chargement", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 6000);
  };

  // ── Sélectionner un plan ──────────────────────────────────
  const handleSelectPlan = async (planName) => {
    const isExpired = current?.expired === true;
    const isCurrentPlan = current?.plan === planName;

    // Vérifications
    if (!isExpired && isCurrentPlan) {
      showNotification("Vous êtes déjà abonné à ce plan", "info");
      return;
    }

    if (!isExpired && !isCurrentPlan && current && !current.can_change_plan && current.plan) {
      showNotification(`Vous pourrez changer dans ${current.days_until_expiry} jours`, "warning");
      return;
    }

    setUpgrading(true);
    try {
      const selectedPlan = plans.find((p) => p.name === planName);

      // Essayer Stripe si configuré
      if (selectedPlan?.stripe_price_id) {
        try {
          const res = await api.post("/subscriptions/create-checkout-session/", {
            plan: planName,
          });

          // Redirection vers Stripe
          window.location.href = res.data.checkout_url;
          return;
        } catch (stripeErr) {
          console.error("Erreur Stripe:", stripeErr.response?.data);

          // Si l'erreur indique qu'on peut utiliser le fallback
          if (stripeErr.response?.data?.fallback) {
            showNotification("Mode hors ligne activé", "info");
            await upgradeDirect(planName, isExpired, isCurrentPlan);
          } else {
            showNotification(stripeErr.response?.data?.error || "Erreur de paiement", "error");
          }
        }
      } else {
        // Pas de Stripe configuré, utiliser le fallback
        await upgradeDirect(planName, isExpired, isCurrentPlan);
      }
    } finally {
      setUpgrading(false);
    }
  };

  const upgradeDirect = async (planName, isExpired, isCurrentPlan) => {
    try {
      const response = await api.post("/subscriptions/upgrade/", {
        plan: planName,
      });
      const message =
        isExpired && isCurrentPlan
          ? "Abonnement renouvelé avec succès !"
          : response.data.message || "Abonnement mis à jour avec succès !";
      showNotification(message, "success");
      await loadData();
    } catch (error) {
      console.error("Erreur upgrade:", error);
      if (error.response) {
        const { status, data } = error.response;
        if (status === 500) {
          showNotification("Vérification en cours...", "info");
          setTimeout(async () => {
            try {
              await loadData();
              showNotification("Abonnement mis à jour !", "success");
            } catch {
              showNotification("Erreur lors de la vérification", "error");
            }
          }, 1500);
          return;
        }
        showNotification(data?.error || data?.detail || `Erreur ${status}`, "error");
      } else if (error.request) {
        showNotification("Impossible de contacter le serveur", "error");
      } else {
        showNotification("Erreur lors de la requête", "error");
      }
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  const getPlanIcon = (planName) => {
    const icons = {
      starter: <BusinessIcon sx={{ fontSize: 40 }} />,
      pro: <TrendingUpIcon sx={{ fontSize: 40 }} />,
      enterprise: <DiamondIcon sx={{ fontSize: 40 }} />,
    };
    return icons[planName] || <BusinessIcon sx={{ fontSize: 40 }} />;
  };

  const formatDate = (d) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const canSelectPlan = (planName) => {
    if (!current) return true;
    if (current.expired) return true;
    const isCurrentPlan = current.plan === planName;
    return !isCurrentPlan && current.can_change_plan !== false;
  };

  const getButtonLabel = (planName) => {
    if (!current) return "Choisir ce plan";
    const isExpired = current.expired === true;
    const isCurrentPlan = current.plan === planName;
    if (isCurrentPlan) return isExpired ? "Renouveler" : "Plan actuel";
    const plan = plans.find((p) => p.name === planName);
    if (plan?.stripe_price_id) return isExpired ? "Payer" : "Payer & changer";
    return isExpired ? "Choisir ce plan" : "Changer pour ce plan";
  };

  const getButtonIcon = (planName) => {
    if (!current) return null;
    const isExpired = current.expired === true;
    const isCurrentPlan = current.plan === planName;
    if (isCurrentPlan && isExpired) return <RestoreIcon sx={{ mr: 1 }} />;
    if (isCurrentPlan) return <VerifiedIcon sx={{ mr: 1 }} />;
    const plan = plans.find((p) => p.name === planName);
    if (plan?.stripe_price_id) return <PaymentIcon sx={{ mr: 1 }} />;
    return null;
  };

  const isLoading = loading || upgrading;

  // ── Render ────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <DashboardNavbar />

      {/* Notification */}
      <Collapse in={notification.show}>
        <Alert
          severity={notification.type}
          sx={{
            position: "fixed",
            top: 80,
            right: 20,
            zIndex: 9999,
            minWidth: 320,
            boxShadow: "0 8px 16px 0 rgba(0,0,0,0.12)",
            borderRadius: 2,
          }}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setNotification({ show: false, message: "", type: "" })}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {notification.message}
        </Alert>
      </Collapse>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <MDBox mb={4}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <MDTypography variant="h3" fontWeight="bold" color="dark">
                Gestion des abonnements
              </MDTypography>
              <MDTypography variant="body1" color="text" mt={1}>
                Choisissez le plan qui correspond le mieux à vos besoins
              </MDTypography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  background: "rgba(211,47,47,0.02)",
                  border: "1px solid rgba(211,47,47,0.1)",
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: "#d32f2f", width: 48, height: 48 }}>
                    {current ? <VerifiedIcon /> : <BusinessIcon />}
                  </Avatar>
                  <Box>
                    <MDTypography variant="caption" color="text">
                      Plan actuel
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {current?.plan ? current.plan.toUpperCase() : "Aucun abonnement"}
                    </MDTypography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={loadData}
                    startIcon={<RefreshIcon />}
                    disabled={isLoading}
                    sx={{ ml: "auto" }}
                  >
                    Actualiser
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </MDBox>

        {/* Loading bar */}
        {isLoading && (
          <Fade in={isLoading}>
            <Box sx={{ width: "100%", mb: 4 }}>
              <LinearProgress color="error" />
              <MDTypography variant="body2" color="text" align="center" mt={2}>
                {upgrading ? "Redirection vers le paiement..." : "Chargement des données..."}
              </MDTypography>
            </Box>
          </Fade>
        )}

        {/* Bannière expiration */}
        {current?.expired && !loading && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} icon={<WarningIcon />}>
            <strong>Votre abonnement a expiré le {formatDate(current.end_date)}.</strong> Renouvelez
            ou choisissez un nouveau plan ci-dessous pour restaurer l&apos;accès.
          </Alert>
        )}

        {/* Abonnement actuel */}
        {current && !loading && (
          <Grow in timeout={500}>
            <Grid item xs={12} sx={{ mb: 4 }}>
              <StyledCard iscurrent={!current.expired}>
                <CardContent>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Avatar sx={{ bgcolor: "#d32f2f", mr: 2 }}>
                          {current.is_trial ? (
                            <HourglassIcon />
                          ) : current.expired ? (
                            <WarningIcon />
                          ) : (
                            <VerifiedIcon />
                          )}
                        </Avatar>
                        <Box>
                          <MDTypography variant="h5" fontWeight="bold">
                            {current.plan?.toUpperCase() || "Plan non défini"}
                          </MDTypography>
                          <Stack direction="row" spacing={1} mt={0.5}>
                            <StatusChip
                              size="small"
                              status={
                                current.expired ? "expired" : current.is_trial ? "trial" : "active"
                              }
                              label={
                                current.expired
                                  ? "Expiré"
                                  : current.is_trial
                                  ? "Essai gratuit"
                                  : "Actif"
                              }
                            />
                            {current.days_until_expiry <= 7 && !current.expired && (
                              <StatusChip
                                status="expiring"
                                size="small"
                                label={`Expire dans ${current.days_until_expiry}j`}
                              />
                            )}
                          </Stack>
                        </Box>
                      </Box>

                      <Grid container spacing={2}>
                        {[
                          {
                            label: "Début",
                            icon: <EventIcon sx={{ fontSize: 16, mr: 0.5, color: "#d32f2f" }} />,
                            value: formatDate(current.start_date),
                          },
                          {
                            label: "Fin",
                            icon: <CalendarIcon sx={{ fontSize: 16, mr: 0.5, color: "#d32f2f" }} />,
                            value: formatDate(current.end_date),
                          },
                          {
                            label: "Jours restants",
                            icon: (
                              <HourglassIcon sx={{ fontSize: 16, mr: 0.5, color: "#d32f2f" }} />
                            ),
                            value: `${current.days_until_expiry || 0} jours`,
                          },
                          {
                            label: "Prix",
                            icon: null,
                            value: `${current.price || 0} DT / mois`,
                          },
                        ].map(({ label, icon, value }) => (
                          <Grid item xs={6} sm={3} key={label}>
                            <MDTypography variant="caption" color="text">
                              {label}
                            </MDTypography>
                            <Box display="flex" alignItems="center">
                              {icon}
                              <MDTypography
                                variant="body2"
                                fontWeight={label === "Prix" ? "bold" : "regular"}
                              >
                                {value}
                              </MDTypography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>

                      {current.is_trial && current.trial_end_date && (
                        <Alert severity="warning" sx={{ mt: 2 }} icon={<HourglassIcon />}>
                          Votre période d&apos;essai se termine le{" "}
                          {formatDate(current.trial_end_date)}. Choisissez un plan pour continuer.
                        </Alert>
                      )}

                      {current.expired && (
                        <Alert
                          severity="error"
                          sx={{ mt: 2 }}
                          icon={<WarningIcon />}
                          action={
                            <Button
                              color="error"
                              size="small"
                              disabled={upgrading}
                              onClick={() =>
                                current.plan ? handleSelectPlan(current.plan) : setShowDetails(true)
                              }
                              startIcon={<RestoreIcon />}
                            >
                              Renouveler
                            </Button>
                          }
                        >
                          Votre abonnement a expiré. Renouvelez ou choisissez un nouveau plan.
                        </Alert>
                      )}

                      <Box sx={{ mt: 2 }}>
                        <MDTypography variant="subtitle2" fontWeight="bold" gutterBottom>
                          Fonctionnalités incluses
                        </MDTypography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {(current.allowed_features || []).length > 0 ? (
                            current.allowed_features.map((feature) => (
                              <Chip
                                key={feature}
                                size="small"
                                color="success"
                                variant="outlined"
                                label={featureLabels[feature] || feature}
                              />
                            ))
                          ) : (
                            <Chip
                              size="small"
                              color="default"
                              label="Aucune fonctionnalité active"
                            />
                          )}
                        </Stack>
                      </Box>

                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        {[
                          {
                            label: "Utilisateurs",
                            currentValue: current.users_count,
                            maxValue: current.max_users,
                          },
                          {
                            label: "Équipes",
                            currentValue: current.teams_count,
                            maxValue: current.max_teams,
                          },
                          {
                            label: "Prospects",
                            currentValue: current.prospects_count,
                            maxValue: current.max_prospects,
                          },
                        ].map(({ label, currentValue, maxValue }) => (
                          <Grid item xs={12} md={4} key={label}>
                            <Box
                              sx={{
                                p: 1.5,
                                border: "1px solid rgba(211,47,47,0.1)",
                                borderRadius: 2,
                                bgcolor: "rgba(211,47,47,0.02)",
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" mb={1}>
                                <MDTypography variant="caption" fontWeight="bold">
                                  {label}
                                </MDTypography>
                                <MDTypography variant="caption" color="text">
                                  {currentValue || 0} / {formatLimit(maxValue)}
                                </MDTypography>
                              </Stack>
                              <LinearProgress
                                variant={
                                  maxValue === null || maxValue === undefined
                                    ? "indeterminate"
                                    : "determinate"
                                }
                                value={usagePercent(currentValue, maxValue)}
                                color="error"
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Box
                        sx={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          borderLeft: { md: "1px solid rgba(211,47,47,0.1)" },
                          pl: { md: 3 },
                        }}
                      >
                        <MDTypography variant="h3" color="error" fontWeight="bold">
                          {current.price || 0} DT
                        </MDTypography>
                        <MDTypography variant="body2" color="text" gutterBottom>
                          par mois
                        </MDTypography>
                        <Button
                          variant="contained"
                          color="error"
                          fullWidth
                          sx={{ mt: 2 }}
                          onClick={() => setShowDetails((v) => !v)}
                        >
                          {showDetails ? "Masquer les plans" : "Voir tous les plans"}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </StyledCard>
            </Grid>
          </Grow>
        )}

        {/* Titre plans */}
        <MDBox mb={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <MDTypography variant="h4" fontWeight="bold">
              Nos formules
            </MDTypography>
            <Chip
              icon={<PaymentIcon />}
              label={current?.expired ? "Renouvellement possible" : "Paiement sécurisé via Stripe"}
              variant="outlined"
              color="error"
            />
          </Stack>
        </MDBox>

        {/* Cartes plans */}
        <Grid container spacing={3}>
          {plans.map((plan, index) => {
            const isCurrentPlan = current && current.plan === plan.name;
            const canSelect = canSelectPlan(plan.name);
            const isPopular = plan.name === "pro";
            const isEnterprise = plan.name === "enterprise";
            const buttonLabel = getButtonLabel(plan.name);
            const isExpired = current?.expired === true;
            const hasStripe = !!plan.stripe_price_id;

            return (
              <Grid item xs={12} md={4} key={plan.name}>
                <Fade in timeout={500 + index * 200}>
                  <div>
                    <StyledCard iscurrent={isCurrentPlan && !isExpired}>
                      {isPopular && !isCurrentPlan && (
                        <PopularBadge>
                          <StarIcon sx={{ fontSize: 14, mr: 0.5 }} />
                          POPULAIRE
                        </PopularBadge>
                      )}

                      <PlanHeader color={isEnterprise ? "darkRed" : "red"}>
                        {getPlanIcon(plan.name)}
                        <MDTypography variant="h4" fontWeight="bold" color="white" mt={1}>
                          {plan.name.toUpperCase()}
                        </MDTypography>
                        <MDTypography variant="body2" color="rgba(255,255,255,0.8)">
                          {plan.description || `Plan ${plan.name}`}
                        </MDTypography>
                      </PlanHeader>

                      <PriceBox>
                        <MDTypography variant="h2" color="error" fontWeight="bold">
                          {plan.price} DT
                        </MDTypography>
                        <MDTypography variant="body2" color="text">
                          par mois
                        </MDTypography>
                        {hasStripe ? (
                          <Chip
                            label="💳 Stripe"
                            size="small"
                            sx={{
                              mt: 0.5,
                              bgcolor: "rgba(99,91,255,0.08)",
                              color: "#6356ff",
                              fontSize: "0.7rem",
                            }}
                          />
                        ) : (
                          <MDTypography variant="caption" color="text">
                            Facturé mensuellement
                          </MDTypography>
                        )}
                      </PriceBox>

                      <CardContent sx={{ flexGrow: 1 }}>
                        <List dense>
                          <FeatureItem included={plan.premium_features?.priority_support}>
                            <ListItemIcon>
                              {plan.premium_features?.priority_support ? (
                                <CheckCircleIcon />
                              ) : (
                                <CancelIcon />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary="Support prioritaire"
                              secondary={
                                plan.premium_features?.priority_support ? "Inclus" : "Standard"
                              }
                            />
                          </FeatureItem>
                          <FeatureItem included={true}>
                            <ListItemIcon>
                              <PeopleIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Utilisateurs"
                              secondary={plan.max_users ? `${plan.max_users} max` : "Illimité"}
                            />
                          </FeatureItem>
                          <FeatureItem included={true}>
                            <ListItemIcon>
                              <GroupIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Équipes"
                              secondary={plan.max_teams ? `${plan.max_teams} max` : "Illimité"}
                            />
                          </FeatureItem>
                          <FeatureItem included={true}>
                            <ListItemIcon>
                              <AssessmentIcon />
                            </ListItemIcon>
                            <ListItemText
                              primary="Prospects"
                              secondary={
                                plan.max_prospects ? `${plan.max_prospects} max` : "Illimité"
                              }
                            />
                          </FeatureItem>
                          <FeatureItem included={plan.premium_features?.reports}>
                            <ListItemIcon>
                              {plan.premium_features?.reports ? (
                                <CheckCircleIcon />
                              ) : (
                                <CancelIcon />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary="Rapports avancés"
                              secondary={plan.premium_features?.reports ? "Inclus" : "Non inclus"}
                            />
                          </FeatureItem>
                        </List>
                      </CardContent>

                      <CardActions sx={{ justifyContent: "center", pb: 3, px: 2 }}>
                        <Tooltip
                          title={
                            !canSelect && !isCurrentPlan
                              ? "Disponible en fin d'abonnement actuel"
                              : isCurrentPlan && isExpired
                              ? "Renouveler votre abonnement"
                              : ""
                          }
                          arrow
                          TransitionComponent={Zoom}
                        >
                          <span style={{ width: "100%" }}>
                            <ActionButton
                              fullWidth
                              iscurrent={isCurrentPlan && !isExpired}
                              disabled={(!canSelect && !isCurrentPlan) || upgrading}
                              onClick={() => handleSelectPlan(plan.name)}
                            >
                              {getButtonIcon(plan.name)}
                              {buttonLabel}
                              {!getButtonIcon(plan.name) && <ArrowForwardIcon sx={{ ml: 1 }} />}
                            </ActionButton>
                          </span>
                        </Tooltip>
                      </CardActions>

                      {isCurrentPlan && !isExpired && (
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 10,
                            right: 10,
                            opacity: 0.1,
                          }}
                        >
                          <VerifiedIcon sx={{ fontSize: 60 }} />
                        </Box>
                      )}
                    </StyledCard>
                  </div>
                </Fade>
              </Grid>
            );
          })}
        </Grid>

        {/* Comparaison */}
        <Collapse in={showDetails}>
          <Paper
            sx={{
              mt: 4,
              p: 3,
              background: "linear-gradient(135deg, rgba(211,47,47,0.02) 0%, #fff 100%)",
              border: "1px solid rgba(211,47,47,0.1)",
              borderRadius: 2,
            }}
          >
            <MDTypography variant="h5" fontWeight="bold" gutterBottom>
              Comparaison détaillée
            </MDTypography>
            <List>
              <ListItem>
                <Grid container spacing={2}>
                  {["Fonctionnalité", "Starter", "Pro", "Enterprise"].map((h) => (
                    <Grid item xs={3} key={h}>
                      <MDTypography
                        variant="body2"
                        fontWeight="bold"
                        color={h !== "Fonctionnalité" ? "error" : "dark"}
                      >
                        {h}
                      </MDTypography>
                    </Grid>
                  ))}
                </Grid>
              </ListItem>
              <Divider />
              {comparisonRows.map(([name, ...values]) => (
                <ListItem key={`new-${name}`}>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <MDTypography variant="body2">{name}</MDTypography>
                    </Grid>
                    {values.map((v, i) => (
                      <Grid item xs={3} key={i}>
                        <MDTypography
                          variant="body2"
                          color={v === "Non" ? "text" : v === "Oui" ? "success" : "dark"}
                          fontWeight={v === "Oui" ? "bold" : "regular"}
                        >
                          {v}
                        </MDTypography>
                      </Grid>
                    ))}
                  </Grid>
                </ListItem>
              ))}
              {[
                ["Prix mensuel", "20 DT", "50 DT", "100 DT"],
                ["Utilisateurs max", "3", "10", "Illimité"],
                ["Équipes max", "1", "5", "Illimité"],
                ["Prospects max", "50", "500", "Illimité"],
                ["Rapports avancés", "❌", "✅", "✅"],
                ["Support prioritaire", "❌", "❌", "✅"],
              ].map(([name, ...values]) => (
                <ListItem key={name}>
                  <Grid container spacing={2}>
                    <Grid item xs={3}>
                      <MDTypography variant="body2">{name}</MDTypography>
                    </Grid>
                    {values.map((v, i) => (
                      <Grid item xs={3} key={i}>
                        <MDTypography variant="body2">{v}</MDTypography>
                      </Grid>
                    ))}
                  </Grid>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Collapse>

        {/* Garanties */}
        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Grid container spacing={3}>
            {[
              {
                Icon: SecurityIcon,
                title: "Paiement sécurisé",
                desc: "Transactions chiffrées via Stripe",
              },
              {
                Icon: SupportIcon,
                title: "Support 24/7",
                desc: "Notre équipe est disponible à tout moment",
              },
              {
                Icon: AutoGraphIcon,
                title: "Sans engagement",
                desc: "Changez ou résiliez à tout moment",
              },
            ].map(({ Icon, title, desc }) => (
              <Grid item xs={12} md={4} key={title}>
                <Paper sx={{ p: 3, height: "100%" }}>
                  <Icon sx={{ fontSize: 40, color: "#d32f2f", mb: 2 }} />
                  <MDTypography variant="h6" gutterBottom>
                    {title}
                  </MDTypography>
                  <MDTypography variant="body2" color="text">
                    {desc}
                  </MDTypography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </DashboardLayout>
  );
};

export default SubscriptionForm;
