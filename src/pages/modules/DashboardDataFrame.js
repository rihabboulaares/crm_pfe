import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
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
      <MDBox py={3} sx={{ minHeight: "calc(100vh - 200px)" }}>
        {loading ? (
          <Box
            minHeight="55vh"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={2}
          >
            <CircularProgress sx={{ color: "#dc2626" }} />
            <Typography variant="body2" color="textSecondary">
              Chargement du tableau de bord...
            </Typography>
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={onRefresh}>
                Reessayer
              </Button>
            }
            sx={{ borderRadius: 2 }}
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
