import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import {
  ArrowForward,
  AutoGraph,
  BusinessCenter,
  CheckCircle,
  Dashboard,
  Groups,
  Login,
  PersonAdd,
  Psychology,
  Schedule,
  TrackChanges,
} from "@mui/icons-material";

import { useMaterialUIController, setLayout } from "context";
import { getSubscriptionPlans } from "services/subscriptionApi";

const stats = [
  ["+500", "Entreprises suivies"],
  ["98 %", "Satisfaction client"],
  ["4,1 M TND", "Revenus suivis"],
];

const metrics = [
  ["284 k TND", "Chiffre d'affaires"],
  ["1 248", "Leads actifs"],
  ["67 %", "Taux de conversion"],
  ["42", "Deals conclus"],
];

const pipeline = [
  ["Prospect", 82],
  ["Qualifié", 65],
  ["Proposition", 48],
  ["Gagné", 34],
];

const features = [
  {
    icon: <TrackChanges />,
    title: "Gestion des prospects",
    description:
      "Centralisez vos prospects, leurs coordonnées, leurs sources et leur statut commercial.",
  },
  {
    icon: <BusinessCenter />,
    title: "Opportunités commerciales",
    description:
      "Transformez les prospects qualifiés en opportunités et suivez chaque étape du pipeline.",
  },
  {
    icon: <Groups />,
    title: "Suivi des clients",
    description: "Gardez une vision claire sur vos clients, leurs interactions et leur historique.",
  },
  {
    icon: <Psychology />,
    title: "Agents IA",
    description:
      "Automatisez la prospection, l'analyse des profils et la préparation des messages personnalisés.",
  },
  {
    icon: <Schedule />,
    title: "Tâches et relances",
    description: "Planifiez les appels, relances, suivis et actions commerciales à ne pas oublier.",
  },
  {
    icon: <Dashboard />,
    title: "Tableaux de bord",
    description: "Suivez les performances, les revenus, les conversions et l'activité des agents.",
  },
];

const aboutCards = ["CRM tunisien", "Automatisation IA", "Suivi commercial complet"];

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const formatCycle = (plan) => {
  const cycle = plan.billing_cycle || plan.cycle || plan.duree;
  if (cycle) return cycle;
  if (plan.duration_days) return `${plan.duration_days} jours`;
  return "mois";
};

const normalizePlan = (plan) => {
  const featuresList = asArray(plan.features || plan.fonctionnalites || plan.avantages);

  if (plan.premium_features !== undefined) {
    featuresList.push(plan.premium_features ? "Agents IA inclus" : "Agents IA non inclus");
  }

  return {
    ...plan,
    id: plan.id,
    name: plan.name || plan.nom || plan.title || "Offre",
    price: plan.price ?? plan.prix ?? plan.amount ?? 0,
    currency: plan.currency || plan.devise || "TND",
    cycle: formatCycle(plan),
    description: plan.description || "",
    features: featuresList,
    maxUsers: plan.max_users,
    maxProspects: plan.max_prospects,
    maxClients: plan.max_clients,
  };
};

const formatPrice = (price, currency) => {
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice)) return `${price} ${currency}`;

  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency,
    minimumFractionDigits: numericPrice % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericPrice);
};

function Welcome() {
  const [, dispatch] = useMaterialUIController();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState("");

  const normalizedPlans = useMemo(() => plans.map(normalizePlan), [plans]);

  useEffect(() => {
    setLayout(dispatch, "page");
  }, [dispatch]);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoadingPlans(true);
        setPlansError("");
        const data = await getSubscriptionPlans();
        setPlans(Array.isArray(data) ? data : data.results || data.plans || []);
      } catch (error) {
        console.error("Erreur chargement abonnements:", error);
        setPlansError("Impossible de charger les abonnements pour le moment.");
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
  }, []);

  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isAuthenticated = Boolean(
    localStorage.getItem("token") ||
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken")
  );

  const handleChoosePlan = (plan) => {
    const query = plan.id ? `?planId=${plan.id}` : "";
    navigate(isAuthenticated ? `/subscriptions${query}` : `/register${query}`);
  };

  return (
    <Box className="public-shell">
      <Container maxWidth="xl" className="public-container">
        <Box className="public-header">
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Box className="public-logo-mark">V</Box>
            <Typography className="public-logo-text">ViewiseCRM</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.2} className="public-nav">
            <Button variant="text" onClick={() => scrollToSection("fonctionnalites")}>
              Fonctionnalités
            </Button>
            <Button variant="text" onClick={() => scrollToSection("tarifs")}>
              Tarifs
            </Button>
            <Button variant="text" onClick={() => scrollToSection("a-propos")}>
              À propos
            </Button>
            <Button variant="text" startIcon={<Login />} onClick={() => navigate("/login")}>
              Connexion
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              className="public-primary-button"
              onClick={() => navigate("/register")}
            >
              Essai gratuit
            </Button>
          </Stack>
        </Box>

        <Box className="public-hero">
          <Box className="public-hero-left">
            <Box className="public-badge">CRM tunisien pour équipes commerciales</Box>
            <Typography component="h1" className="public-title">
              Gérez chaque relation, <span>concluez</span> chaque opportunité.
            </Typography>
            <Typography className="public-description">
              ViewiseCRM aide les équipes commerciales en Tunisie à organiser leurs prospects,
              suivre leurs clients et piloter leur croissance.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4} className="public-actions">
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                className="public-primary-button"
                onClick={() => navigate("/register")}
              >
                Démarrer gratuitement
              </Button>
              <Button
                variant="outlined"
                size="large"
                className="public-secondary-button"
                onClick={() => navigate("/login")}
              >
                Se connecter
              </Button>
            </Stack>
            <Box className="public-stats">
              {stats.map(([value, label]) => (
                <Box key={label}>
                  <Typography>{value}</Typography>
                  <span>{label}</span>
                </Box>
              ))}
            </Box>
          </Box>

          <Box className="public-hero-right">
            <Box className="public-red-panel">
              <Box className="dashboard-preview-card">
                <Typography className="dashboard-preview-title">
                  Tableau de bord - Tunis, 2026
                </Typography>
                <Box className="dashboard-preview-metrics">
                  {metrics.map(([value, label]) => (
                    <Box key={label}>
                      <Typography>{value}</Typography>
                      <span>{label}</span>
                    </Box>
                  ))}
                </Box>
                <Box className="dashboard-pipeline">
                  {pipeline.map(([label, value]) => (
                    <Box key={label} className="dashboard-pipeline-row">
                      <Stack direction="row" justifyContent="space-between">
                        <Typography>{label}</Typography>
                        <Typography>{value} %</Typography>
                      </Stack>
                      <Box className="dashboard-pipeline-track">
                        <Box sx={{ width: `${value}%` }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box component="section" id="fonctionnalites" className="welcome-section">
          <Box className="section-header">
            <Typography component="h2">
              Tout ce qu&apos;il faut pour gérer votre activité commerciale
            </Typography>
          </Box>
          <Box className="features-grid">
            {features.map((feature) => (
              <Box key={feature.title} className="feature-card">
                <Box className="feature-icon">{feature.icon}</Box>
                <Typography component="h3">{feature.title}</Typography>
                <Typography>{feature.description}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="section" id="tarifs" className="welcome-section pricing-section">
          <Box className="section-header">
            <Typography component="h2">Des offres adaptées à votre équipe</Typography>
            <Typography>
              Choisissez l&apos;abonnement qui correspond à votre activité commerciale.
            </Typography>
          </Box>

          {loadingPlans && <Box className="pricing-state">Chargement des offres...</Box>}
          {!loadingPlans && plansError && <Box className="pricing-state error">{plansError}</Box>}
          {!loadingPlans && !plansError && normalizedPlans.length === 0 && (
            <Box className="pricing-state">Aucun abonnement disponible pour le moment.</Box>
          )}

          {!loadingPlans && !plansError && normalizedPlans.length > 0 && (
            <Box className="pricing-grid">
              {normalizedPlans.map((plan) => (
                <Box key={plan.id || plan.name} className="pricing-card">
                  <Box>
                    <Typography component="h3">{plan.name}</Typography>
                    {plan.description && (
                      <Typography className="pricing-description">{plan.description}</Typography>
                    )}
                    <Box className="pricing-price">
                      <span>{formatPrice(plan.price, plan.currency)}</span>
                      <small>/ {plan.cycle}</small>
                    </Box>
                    <Box className="pricing-limits">
                      {plan.maxUsers !== undefined && plan.maxUsers !== null && (
                        <span>{plan.maxUsers} utilisateurs</span>
                      )}
                      {plan.maxProspects !== undefined && plan.maxProspects !== null && (
                        <span>{plan.maxProspects} prospects</span>
                      )}
                      {plan.maxClients !== undefined && plan.maxClients !== null && (
                        <span>{plan.maxClients} clients</span>
                      )}
                    </Box>
                    {plan.features.length > 0 && (
                      <Box className="pricing-features">
                        {plan.features.map((feature) => (
                          <Box key={feature}>
                            <CheckCircle />
                            <span>{feature}</span>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                  <Button
                    variant="contained"
                    className="public-primary-button pricing-button"
                    onClick={() => handleChoosePlan(plan)}
                  >
                    Choisir ce plan
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box component="section" id="a-propos" className="welcome-section about-section">
          <Box className="section-header">
            <Typography component="h2">À propos de ViewiseCRM</Typography>
            <Typography>
              ViewiseCRM est un CRM intelligent conçu pour les équipes commerciales en Tunisie. Il
              aide à centraliser les prospects, suivre les clients, piloter les opportunités et
              automatiser les actions commerciales grâce à des agents IA.
            </Typography>
          </Box>
          <Box className="about-grid">
            {aboutCards.map((card) => (
              <Box key={card} className="about-card">
                <AutoGraph />
                <Typography>{card}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default Welcome;
