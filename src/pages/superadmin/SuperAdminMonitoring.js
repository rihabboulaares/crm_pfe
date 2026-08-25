/* eslint-disable prettier/prettier, react/no-unescaped-entities */
/* eslint-disable react/no-unescaped-entities */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { MonitorHeart, Refresh, Storage, Api, Bolt } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { apiGet, colorForStatus, formatDateTime, SA_ENDPOINTS, safeArray, T } from "./saUtils";
import SuperAdminLayout from "./SuperAdminLayout";

const serviceIcon = {
  backend: <Api />,
  database: <Storage />,
  redis: <Bolt />,
};

export default function SuperAdminMonitoring() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    apiGet(SA_ENDPOINTS.systemHealth)
      .then((res) => setServices(safeArray(res.data)))
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger l'état système.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SuperAdminLayout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: T.n800 }}>
            Monitoring système
          </Typography>
          <Typography variant="body2" sx={{ color: T.n500 }}>
            Backend, base de données, cache, clés IA et dépendances d&apos;automatisation.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={load}
          sx={{ bgcolor: T.red, textTransform: "none", "&:hover": { bgcolor: "#b91c1c" } }}
        >
          Vérifier
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: T.red }} />
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {services.map((service) => {
            const c = colorForStatus(service.status);
            return (
              <Grid item xs={12} sm={6} md={4} key={service.service}>
                <Card
                  sx={{
                    borderRadius: 2,
                    p: 2.5,
                    height: "100%",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    mb={2}
                  >
                    <Avatar sx={{ bgcolor: alpha(c.text, 0.12), color: c.text }}>
                      {serviceIcon[service.service] || <MonitorHeart />}
                    </Avatar>
                    <Chip
                      size="small"
                      label={service.status}
                      sx={{ bgcolor: c.bg, color: c.text, fontWeight: 800 }}
                    />
                  </Stack>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: T.n800, textTransform: "capitalize" }}
                  >
                    {service.service}
                  </Typography>
                  <Typography variant="body2" sx={{ color: T.n500, minHeight: 40, mt: 0.5 }}>
                    {service.message || "Aucun message"}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" mt={2}>
                    <Typography variant="caption" sx={{ color: T.n500 }}>
                      Latence
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: T.n800 }}>
                      {service.response_time_ms ?? 0} ms
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ display: "block", color: T.n500, mt: 1 }}>
                    {formatDateTime(service.checked_at)}
                  </Typography>
                </Card>
              </Grid>
            );
          })}
          {!services.length && (
            <Grid item xs={12}>
              <Card sx={{ borderRadius: 2, p: 4, textAlign: "center", color: T.n500 }}>
                Aucun contrôle système enregistré.
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </SuperAdminLayout>
  );
}
