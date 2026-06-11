/* eslint-disable prettier/prettier, react/prop-types */
/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { BarChart as BarIcon, Map, People, TrendingUp } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  apiGet,
  formatCurrency,
  formatDateTime,
  formatNumber,
  safeArray,
  SA_ENDPOINTS,
  T,
} from "./saUtils";
import SuperAdminLayout from "./SuperAdminLayout";

const colors = [T.red, T.blue, T.green, T.amber, T.purple];

function ChartCard({ title, children, height = 280 }) {
  return (
    <Card sx={{ borderRadius: 2, p: 2.5, height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: T.n800, mb: 2 }}>
        {title}
      </Typography>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </Card>
  );
}

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  height: PropTypes.number,
};

ChartCard.defaultProps = {
  height: 280,
};

function KpiCard({ label, value, color }) {
  return (
    <Card sx={{ borderRadius: 2, p: 2.5, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderTop: `3px solid ${color}` }}>
      <Typography variant="caption" sx={{ color: T.n500, textTransform: "uppercase", fontWeight: 800 }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color: T.n800, fontWeight: 800, mt: 0.5 }}>
        {value}
      </Typography>
    </Card>
  );
}

KpiCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string.isRequired,
};

export default function SuperAdminStats() {
  const [data, setData] = useState({
    stats: null,
    growth: [],
    funnel: null,
    geo: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet(SA_ENDPOINTS.stats),
      apiGet(SA_ENDPOINTS.dashboardGrowth),
      apiGet(SA_ENDPOINTS.crmFunnel),
      apiGet(SA_ENDPOINTS.geoStats),
      apiGet(SA_ENDPOINTS.usersPerformance),
    ])
      .then(([stats, growth, funnel, geo, users]) => {
        setData({
          stats: stats.data,
          growth: safeArray(growth.data),
          funnel: funnel.data,
          geo: safeArray(geo.data),
          users: safeArray(users.data).slice(0, 10),
        });
      })
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger les statistiques globales.");
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = data.stats || {};
  const planData = Object.entries(stats.companies_by_plan || {}).map(([name, value]) => ({ name, value }));
  const funnelData = data.funnel
    ? [
        { name: "Prospects", value: data.funnel.prospects },
        { name: "Contactés", value: data.funnel.contacted },
        { name: "Qualifiés", value: data.funnel.qualified },
        { name: "Opportunités", value: data.funnel.opportunities },
        { name: "Gagnés", value: data.funnel.won },
      ]
    : [];

  return (
    <SuperAdminLayout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: T.n800 }}>
            Statistiques globales
          </Typography>
          <Typography variant="body2" sx={{ color: T.n500 }}>
            Données consolidées depuis les endpoints SuperAdmin dédiés.
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(T.red, 0.1), color: T.red, width: 48, height: 48 }}>
          <BarIcon />
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
              <KpiCard label="Entreprises" value={formatNumber(stats.total_companies)} color={T.blue} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Utilisateurs" value={formatNumber(stats.total_users)} color={T.purple} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Revenus mensuels" value={formatCurrency(stats.total_revenue_monthly)} color={T.green} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Runs IA" value={formatNumber(stats.ai_total_runs)} color={T.red} />
            </Grid>
          </Grid>

          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} lg={8}>
              <ChartCard title="Croissance mensuelle réelle">
                <AreaChart data={data.growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: T.n500 }} />
                  <YAxis tick={{ fontSize: 12, fill: T.n500 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="companies" name="Entreprises" stroke={T.red} fill={alpha(T.red, 0.12)} strokeWidth={2} />
                  <Area type="monotone" dataKey="prospects" name="Prospects" stroke={T.blue} fill={alpha(T.blue, 0.1)} strokeWidth={2} />
                  <Area type="monotone" dataKey="opportunities" name="Opportunités" stroke={T.green} fill={alpha(T.green, 0.1)} strokeWidth={2} />
                </AreaChart>
              </ChartCard>
            </Grid>
            <Grid item xs={12} lg={4}>
              <ChartCard title="Entreprises par plan">
                <PieChart>
                  <Pie data={planData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} label>
                    {planData.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartCard>
            </Grid>
          </Grid>

          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} md={7}>
              <ChartCard title="Funnel CRM">
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.n500 }} />
                  <YAxis tick={{ fontSize: 12, fill: T.n500 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card sx={{ borderRadius: 2, p: 2.5, height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <TrendingUp sx={{ color: T.red }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: T.n800 }}>
                    Conversions
                  </Typography>
                </Stack>
                {[
                  ["Prospect vers opportunité", data.funnel?.conversion_prospect_to_opportunity || 0],
                  ["Opportunité gagnée", data.funnel?.conversion_opportunity_to_won || 0],
                  ["Abonnements actifs", stats.active_subscriptions || 0],
                  ["Essais", stats.trial_subscriptions || 0],
                ].map(([label, value], index) => (
                  <Box key={label} mb={2}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2" sx={{ color: T.n500 }}>{label}</Typography>
                      <Typography variant="body2" sx={{ color: T.n800, fontWeight: 800 }}>{value}{index < 2 ? "%" : ""}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={Math.min(Number(value), 100)} sx={{ height: 8, borderRadius: 4, bgcolor: alpha(colors[index], 0.12), "& .MuiLinearProgress-bar": { bgcolor: colors[index] } }} />
                  </Box>
                ))}
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Card sx={{ borderRadius: 2, p: 2.5, height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <Map sx={{ color: T.red }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: T.n800 }}>
                    Géographie
                  </Typography>
                </Stack>
                <Stack spacing={1.4}>
                  {data.geo.slice(0, 8).map((row, index) => (
                    <Box key={`${row.country}-${row.city}`}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ color: T.n800 }}>
                          {row.city}, {row.country}
                        </Typography>
                        <Typography variant="body2" sx={{ color: T.n500 }}>
                          {formatNumber(row.companies_count)} ent. / {formatNumber(row.users_count)} users
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={Math.min(row.companies_count * 10, 100)} sx={{ height: 6, borderRadius: 3, bgcolor: alpha(colors[index % colors.length], 0.1), "& .MuiLinearProgress-bar": { bgcolor: colors[index % colors.length] } }} />
                    </Box>
                  ))}
                  {!data.geo.length && <Typography variant="body2" sx={{ color: T.n500 }}>Aucune donnée géographique.</Typography>}
                </Stack>
              </Card>
            </Grid>
            <Grid item xs={12} md={7}>
              <Card sx={{ borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2.5, pb: 0 }}>
                  <People sx={{ color: T.red }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: T.n800 }}>
                    Performance utilisateurs
                  </Typography>
                </Stack>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Utilisateur", "Entreprise", "Prospects", "Opportunités", "Conversion", "Dernière activité"].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 800 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.users.map((user) => (
                        <TableRow key={user.id} hover>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.company_name || "-"}</TableCell>
                          <TableCell>{formatNumber(user.prospects_count)}</TableCell>
                          <TableCell>{formatNumber(user.opportunities_count)}</TableCell>
                          <TableCell>{user.conversion_rate}%</TableCell>
                          <TableCell>{formatDateTime(user.last_activity_at)}</TableCell>
                        </TableRow>
                      ))}
                      {!data.users.length && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4, color: T.n500 }}>
                            Aucune performance utilisateur disponible.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </SuperAdminLayout>
  );
}
