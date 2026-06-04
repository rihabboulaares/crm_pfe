import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { ArrowForward, Login, PersonAdd } from "@mui/icons-material";

import { useMaterialUIController, setLayout } from "context";

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

function Welcome() {
  const [, dispatch] = useMaterialUIController();
  const navigate = useNavigate();

  useEffect(() => {
    setLayout(dispatch, "page");

    if (localStorage.getItem("token")) {
      navigate("/dashboard", { replace: true });
    }
  }, [dispatch, navigate]);

  return (
    <Box className="public-shell">
      <Container maxWidth="xl" className="public-container">
        <Box className="public-header">
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Box className="public-logo-mark">V</Box>
            <Typography className="public-logo-text">ViewiseCRM</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.2} className="public-nav">
            <Button variant="text">Fonctionnalités</Button>
            <Button variant="text">Tarifs</Button>
            <Button variant="text">À propos</Button>
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
                  Tableau de bord — Tunis, 2026
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
      </Container>
    </Box>
  );
}

export default Welcome;
