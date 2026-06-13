/* eslint-disable prettier/prettier, react/no-unescaped-entities */
/* eslint-disable react/no-unescaped-entities */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Card,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { FactCheck, Search } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { apiGet, formatDateTime, getApiErrorMessage, getListCount, getListPayload, SA_ENDPOINTS, T } from "./saUtils";
import SuperAdminLayout from "./SuperAdminLayout";

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      apiGet(`${SA_ENDPOINTS.auditLogs}?page_size=25${search ? `&search=${encodeURIComponent(search)}` : ""}`)
        .then((res) => {
          setLogs(getListPayload(res.data));
          setTotalLogs(getListCount(res.data));
          setError("");
        })
        .catch((err) => {
          console.error(err);
          setError(getApiErrorMessage(err, "Impossible de charger les journaux d'audit."));
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <SuperAdminLayout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: T.n800 }}>
            Audit Logs
          </Typography>
          <Typography variant="body2" sx={{ color: T.n500 }}>
            {totalLogs
              ? `${totalLogs.toLocaleString("fr-FR")} action(s) critique(s) enregistrée(s).`
              : "Historique des actions SuperAdmin et des changements critiques."}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(T.red, 0.1), color: T.red, width: 48, height: 48 }}>
          <FactCheck />
        </Avatar>
      </Stack>

      <Card sx={{ borderRadius: 2, p: 2, mb: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <TextField
          fullWidth
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par module, action, entreprise, utilisateur..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: T.red }} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Date", "Action", "Module", "Objet", "Acteur", "Entreprise", "Détail"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 800, color: T.n800 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{formatDateTime(log.created_at)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={log.action} sx={{ bgcolor: alpha(T.red, 0.08), color: T.red, fontWeight: 800 }} />
                    </TableCell>
                    <TableCell>{log.module || "-"}</TableCell>
                    <TableCell>{log.object_repr || log.object_id || "-"}</TableCell>
                    <TableCell>{log.actor_username || log.actor_email || "Système"}</TableCell>
                    <TableCell>{log.company_name || "Plateforme"}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="caption" sx={{ color: T.n500 }}>
                        {log.description || "-"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {!logs.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: T.n500 }}>
                      Aucun log d&apos;audit enregistré dans la base pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </SuperAdminLayout>
  );
}
