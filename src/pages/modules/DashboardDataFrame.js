import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";

const API = "";

const ENDPOINTS = {
  ADMIN: "/api/dashboard/admin/",
  MANAGER: "/api/dashboard/manager/",
  COMMERCIAL: "/api/dashboard/commercial/",
};

export function useOfficialDashboardData(role, providedData = null) {
  const [state, setState] = useState({
    data: providedData,
    loading: !providedData,
    error: null,
    lastUpdated: null,
  });

  const load = useCallback(async () => {
    if (providedData) {
      setState((prev) => ({ ...prev, data: providedData, loading: false, error: null }));
      return;
    }

    const endpoint = ENDPOINTS[role];
    if (!endpoint) {
      setState({
        data: {},
        loading: false,
        error: "Role dashboard non configure",
        lastUpdated: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await axios.get(`${API}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      setState({
        data: response.data,
        loading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Erreur de chargement du dashboard";
      setState({ data: {}, loading: false, error: message, lastUpdated: null });
    }
  }, [providedData, role]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}

export default function DashboardDataFrame({ children, loading, error, onRefresh, lastUpdated }) {
  return (
    <DashboardLayout>
      <DashboardNavbar onRefresh={onRefresh} lastUpdated={lastUpdated} />
      <MDBox
        py={3}
        sx={{
          minHeight: "calc(100vh - 200px)",
          px: { xs: 1, md: 0 },
          background:
            "linear-gradient(180deg, transparent 0%, rgba(148,163,184,0.08) 38%, transparent 100%)",
        }}
      >
        {loading ? (
          <Box
            minHeight="55vh"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={2}
            sx={{
              borderRadius: 4,
              border: "1px solid var(--crm-border)",
              bgcolor: "var(--crm-surface)",
              boxShadow: "var(--crm-shadow-md)",
            }}
          >
            <CircularProgress size={34} sx={{ color: "#dc2626" }} />
            <Stack spacing={0.4} textAlign="center">
              <Typography variant="body2" fontWeight={800} sx={{ color: "var(--crm-text)" }}>
                Préparation du cockpit CRM
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Synchronisation des prospects, tâches et opportunités
              </Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onRefresh}>
                Reessayer
              </Button>
            }
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha("#dc2626", 0.18)}`,
              boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
            }}
          >
            {error}
          </Alert>
        ) : (
          children
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

DashboardDataFrame.propTypes = {
  children: PropTypes.node,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func,
  lastUpdated: PropTypes.string,
};

DashboardDataFrame.defaultProps = {
  children: null,
  loading: false,
  error: null,
  onRefresh: () => {},
  lastUpdated: null,
};
