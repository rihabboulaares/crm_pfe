/* eslint-disable prettier/prettier, react/prop-types */
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Card,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { SmartToy, TravelExplore, MarkEmailRead, Timer } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import {
  apiGet,
  colorForStatus,
  formatDateTime,
  formatNumber,
  safeArray,
  SA_ENDPOINTS,
  T,
} from "./saUtils";
import SuperAdminLayout from "./SuperAdminLayout";

const pageSize = 12;

function KpiCard({ icon, label, value, color }) {
  return (
    <Card sx={{ borderRadius: 2, p: 2.5, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: `4px solid ${color}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="caption" sx={{ color: T.n500, textTransform: "uppercase", fontWeight: 700 }}>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ color: T.n800, fontWeight: 800, mt: 0.5 }}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Card>
  );
}

export default function SuperAdminAgents() {
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet(SA_ENDPOINTS.aiAgentStats),
      apiGet(`${SA_ENDPOINTS.aiAgents}?page_size=${pageSize}`),
    ])
      .then(([statsRes, runsRes]) => {
        setStats(statsRes.data);
        setRuns(safeArray(runsRes.data.results || runsRes.data));
      })
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger les agents IA.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SuperAdminLayout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: T.n800 }}>
            Supervision des agents IA
          </Typography>
          <Typography variant="body2" sx={{ color: T.n500 }}>
            Exécutions réelles, volumes générés et erreurs par entreprise.
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(T.red, 0.1), color: T.red, width: 48, height: 48 }}>
          <SmartToy />
        </Avatar>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: T.red }} />
        </Box>
      ) : (
        <>
          <Grid container spacing={2.5} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard icon={<SmartToy />} label="Runs" value={formatNumber(stats?.total_runs)} color={T.red} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard icon={<TravelExplore />} label="Prospects trouvés" value={formatNumber(stats?.prospects_found)} color={T.blue} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard icon={<MarkEmailRead />} label="Messages envoyés" value={formatNumber(stats?.messages_sent)} color={T.green} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard icon={<Timer />} label="Durée moyenne" value={`${stats?.avg_duration_seconds || 0}s`} color={T.amber} />
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Début", "Agent", "Entreprise", "Statut", "Prospects", "Messages", "Erreur"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 800, color: T.n800 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.map((run) => {
                    const c = colorForStatus(run.status);
                    return (
                      <TableRow key={run.id} hover>
                        <TableCell>{formatDateTime(run.started_at)}</TableCell>
                        <TableCell>{run.agent_type}</TableCell>
                        <TableCell>{run.company_name || "Plateforme"}</TableCell>
                        <TableCell>
                          <Chip size="small" label={run.status} sx={{ bgcolor: c.bg, color: c.text, fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>{formatNumber(run.prospects_found)} / {formatNumber(run.prospects_imported)}</TableCell>
                        <TableCell>{formatNumber(run.messages_generated)} / {formatNumber(run.messages_sent)}</TableCell>
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Typography variant="caption" sx={{ color: run.error_message ? T.red : T.n500 }}>
                            {run.error_message || "Aucune"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!runs.length && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: T.n500 }}>
                        Aucun run IA enregistré.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </SuperAdminLayout>
  );
}
