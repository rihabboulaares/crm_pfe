/* eslint-disable prettier/prettier */
// src/pages/modules/Dashboard.js

import React, { useEffect, useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../superadmin/Marketingwidgets";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import { CircularProgress, Box, Alert, Fade, Zoom, useTheme } from "@mui/material";
import { styled } from "@mui/material/styles";

// Imports des composants dashboard
import AdminDashboard from "pages/modules/AdminDashboard";
import ManagerDashboard from "pages/modules/ManagerDashboard";
import CommercialDashboard from "pages/modules/CommercialDashboard";

// Constantes de configuration
const API = "";
const RED_SHADES = {
  primary: "#dc2626",
  secondary: "#b91c1c",
  light: "#ef4444",
  dark: "#991b1b",
  gradient: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
  gradientLight: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
};

// Composants stylés
const StyledLoader = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  height: "60vh",
  gap: theme.spacing(2),
  "& .MuiCircularProgress-root": {
    color: RED_SHADES.primary,
    filter: "drop-shadow(0 4px 6px rgba(220, 38, 38, 0.25))",
  },
}));

const ErrorAlert = styled(Alert)(({ theme }) => ({
  backgroundColor: "rgba(220, 38, 38, 0.05)",
  border: `1px solid ${RED_SHADES.primary}`,
  borderRadius: theme.spacing(1),
  "& .MuiAlert-icon": {
    color: RED_SHADES.primary,
  },
  "& .MuiAlert-message": {
    color: theme.palette.text.primary,
  },
}));

const Dashboard = ({ forcedRole = null }) => {
  const [state, setState] = useState({
    role: null,
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const theme = useTheme();
  useTrackActivity("dashboard");

  // Configuration des en-têtes d'authentification
  const authHeader = useCallback(
    () => ({
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
    }),
    []
  );

  // Mapping des configurations de données par rôle
  const dataConfigs = useMemo(
    () => ({
      ADMIN: async () => {
        const response = await axios.get(`${API}/api/dashboard/admin/`, authHeader());
        return response.data;
      },

      MANAGER: async () => {
        const response = await axios.get(`${API}/api/dashboard/manager/`, authHeader());
        return response.data;
      },

      COMMERCIAL: async () => {
        const response = await axios.get(`${API}/api/dashboard/commercial/`, authHeader());
        return response.data;
      },
    }),
    [authHeader]
  );

  // Chargement des données utilisateur
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Récupération du rôle depuis le localStorage
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        const userRole = forcedRole || storedUser.role;

        if (!userRole) {
          setState((prev) => ({
            ...prev,
            role: null,
            loading: false,
            error: "Aucun rôle utilisateur trouvé",
          }));
          return;
        }

        setState((prev) => ({ ...prev, role: userRole }));

        // Vérification si le rôle a un gestionnaire de données
        if (!dataConfigs[userRole]) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: `Rôle non géré : ${userRole}`,
          }));
          return;
        }

        // Chargement des données spécifiques au rôle
        const dashboardData = await dataConfigs[userRole]();

        setState((prev) => ({
          ...prev,
          data: dashboardData,
          loading: false,
          error: null,
          lastUpdated: new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Erreur de chargement du dashboard:", error);

        let errorMessage = "Erreur de chargement des données";
        if (error.response) {
          errorMessage = `Erreur ${error.response.status}: ${
            error.response.data.message || "Problème serveur"
          }`;
        } else if (error.request) {
          errorMessage = "Impossible de contacter le serveur";
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          loading: false,
          data: {},
        }));
      }
    };

    loadDashboardData();
  }, [dataConfigs, forcedRole]);

  // Rafraîchissement manuel des données
  const handleRefresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (state.role && dataConfigs[state.role]) {
        const freshData = await dataConfigs[state.role]();
        setState((prev) => ({
          ...prev,
          data: freshData,
          loading: false,
          lastUpdated: new Date().toISOString(),
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: "Erreur lors du rafraîchissement",
        loading: false,
      }));
    }
  }, [state.role, dataConfigs]);

  // Rendu conditionnel basé sur l'état
  const renderContent = () => {
    const { loading, error, role, data, lastUpdated } = state;

    if (loading) {
      return (
        <Fade in={loading}>
          <StyledLoader>
            <CircularProgress size={60} thickness={4} />
            <MDBox
              component="span"
              sx={{
                color: RED_SHADES.primary,
                fontWeight: "medium",
                fontSize: "1.1rem",
              }}
            >
              Chargement de votre tableau de bord...
            </MDBox>
          </StyledLoader>
        </Fade>
      );
    }

    if (error) {
      return (
        <Zoom in={!!error}>
          <MDBox p={3}>
            <ErrorAlert
              severity="error"
              action={
                <Box
                  component="button"
                  onClick={handleRefresh}
                  sx={{
                    background: RED_SHADES.gradient,
                    color: "white",
                    border: "none",
                    borderRadius: 1,
                    padding: "6px 16px",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    "&:hover": {
                      background: RED_SHADES.gradientLight,
                    },
                  }}
                >
                  Réessayer
                </Box>
              }
            >
              {error}
            </ErrorAlert>
          </MDBox>
        </Zoom>
      );
    }

    // Sélection du dashboard approprié
    const dashboardProps = {
      data,
      lastUpdated,
      onRefresh: handleRefresh,
      colors: RED_SHADES,
    };

    switch (role) {
      case "ADMIN":
        return <AdminDashboard {...dashboardProps} />;
      case "MANAGER":
        return <ManagerDashboard {...dashboardProps} />;
      case "COMMERCIAL":
        return <CommercialDashboard {...dashboardProps} />;
      default:
        return (
          <MDBox p={3}>
            <Alert severity="info">Aucun tableau de bord configuré pour ce rôle</Alert>
          </MDBox>
        );
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar
        onRefresh={handleRefresh}
        lastUpdated={state.lastUpdated}
        sx={{
          borderBottom: `2px solid ${RED_SHADES.primary}`,
          "& .MuiTypography-root": {
            color: RED_SHADES.primary,
          },
        }}
      />

      <MDBox
        py={3}
        sx={{
          minHeight: "calc(100vh - 200px)",
          background: `radial-gradient(circle at 50% 0%, ${RED_SHADES.light}10 0%, transparent 70%)`,
        }}
      >
        {renderContent()}
      </MDBox>

      <Footer
        sx={{
          borderTop: `1px solid ${RED_SHADES.primary}20`,
          "& a": {
            color: RED_SHADES.primary,
            "&:hover": {
              color: RED_SHADES.secondary,
            },
          },
        }}
      />
    </DashboardLayout>
  );
};

Dashboard.propTypes = {
  forcedRole: PropTypes.oneOf(["ADMIN", "MANAGER", "COMMERCIAL"]),
};

Dashboard.defaultProps = {
  forcedRole: null,
};

export default React.memo(Dashboard);
