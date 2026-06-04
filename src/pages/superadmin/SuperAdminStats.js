/* eslint-disable prettier/prettier */
// src/pages/superadmin/SuperAdminStats.js
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Box, Card, Typography, Stack, Avatar, Grid, CircularProgress } from "@mui/material";
import { BarChart as BarIcon } from "@mui/icons-material";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { alpha } from "@mui/material/styles";
import SuperAdminLayout from "./SuperAdminLayout";

const T = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  purple: "#7c3aed",
  n100: "#f3f4f6",
  n200: "#e5e7eb",
  n500: "#6b7280",
  n800: "#1f2937",
};

const api = (url) =>
  axios.get(`http://127.0.0.1:8000${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

const ChartCard = ({ title, children, height }) => (
  <Card sx={{ borderRadius: 3, p: 3, bgcolor: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: T.n800 }}>
      {title}
    </Typography>
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  </Card>
);

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  height: PropTypes.number,
};

ChartCard.defaultProps = {
  height: 260,
};

export default function SuperAdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/superadmin/stats/")
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <SuperAdminLayout>
        <Box
          sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}
        >
          <CircularProgress sx={{ color: T.red }} size={48} />
        </Box>
      </SuperAdminLayout>
    );

  // Données pour les graphiques
  const subscriptionData = [
    { name: "Actifs", value: stats?.active_subscriptions || 0, color: T.green },
    { name: "Essai", value: stats?.trial_subscriptions || 0, color: T.amber },
    { name: "Expirés", value: stats?.expired_subscriptions || 0, color: T.red },
  ];

  const planData = Object.entries(stats?.companies_by_plan || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    Entreprises: value,
    color: name === "enterprise" ? T.purple : name === "pro" ? T.blue : T.green,
  }));

  const kpiData = [
    { name: "Entreprises", value: stats?.total_companies, color: T.blue },
    { name: "Utilisateurs", value: stats?.total_users, color: T.purple },
    { name: "Revenus (TND)", value: stats?.total_revenue_monthly, color: T.amber },
    { name: "Nouveaux", value: stats?.new_companies_this_month, color: T.green },
  ];

  // Données simulées pour area chart (évolution — en prod tu ferais des vraies API)
  const areaData = [
    {
      mois: "Oct",
      entreprises: Math.max(0, (stats?.total_companies || 0) - 8),
      revenus: Math.max(0, (stats?.total_revenue_monthly || 0) - 300),
    },
    {
      mois: "Nov",
      entreprises: Math.max(0, (stats?.total_companies || 0) - 5),
      revenus: Math.max(0, (stats?.total_revenue_monthly || 0) - 180),
    },
    {
      mois: "Déc",
      entreprises: Math.max(0, (stats?.total_companies || 0) - 3),
      revenus: Math.max(0, (stats?.total_revenue_monthly || 0) - 90),
    },
    {
      mois: "Jan",
      entreprises: Math.max(0, (stats?.total_companies || 0) - 1),
      revenus: Math.max(0, (stats?.total_revenue_monthly || 0) - 30),
    },
    {
      mois: "Fév",
      entreprises: stats?.total_companies || 0,
      revenus: stats?.total_revenue_monthly || 0,
    },
  ];

  return (
    <SuperAdminLayout>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: T.n800 }}>
            Statistiques avancées
          </Typography>
          <Typography variant="body2" sx={{ color: T.n500 }}>
            Vue analytique complète de la plateforme
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(T.amber, 0.1), width: 48, height: 48 }}>
          <BarIcon sx={{ color: T.amber }} />
        </Avatar>
      </Stack>

      {/* KPI Cards */}
      <Grid container spacing={2.5} mb={4}>
        {kpiData.map(({ name, value, color }) => (
          <Grid item xs={6} md={3} key={name}>
            <Card
              sx={{
                borderRadius: 3,
                p: 2.5,
                bgcolor: "white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                borderTop: `3px solid ${color}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: T.n500,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  fontWeight: 500,
                }}
              >
                {name}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: T.n800, mt: 0.5 }}>
                {value ?? "—"}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Graphiques ligne 1 */}
      <Grid container spacing={3} mb={3}>
        {/* Area — évolution */}
        <Grid item xs={12} md={7}>
          <ChartCard title="Évolution (5 derniers mois)">
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.blue} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.green} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: T.n500 }} />
              <YAxis tick={{ fontSize: 12, fill: T.n500 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="entreprises"
                name="Entreprises"
                stroke={T.blue}
                fill="url(#gEnt)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="revenus"
                name="Revenus (TND)"
                stroke={T.green}
                fill="url(#gRev)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </AreaChart>
          </ChartCard>
        </Grid>

        {/* Pie — statut abonnements */}
        <Grid item xs={12} md={5}>
          <ChartCard title="Statut des abonnements">
            <PieChart>
              <Pie
                data={subscriptionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {subscriptionData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Graphiques ligne 2 */}
      <Grid container spacing={3}>
        {/* Bar — par plan */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Entreprises par plan">
            <BarChart data={planData} barSize={50}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.n200} />
              <XAxis dataKey="name" tick={{ fontSize: 13, fill: T.n500 }} />
              <YAxis tick={{ fontSize: 13, fill: T.n500 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Entreprises" radius={[6, 6, 0, 0]}>
                {planData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        </Grid>

        {/* Résumé financier */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              borderRadius: 3,
              p: 3,
              bgcolor: "white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              height: "100%",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2.5, color: T.n800 }}>
              Résumé financier
            </Typography>
            <Stack spacing={2}>
              {[
                {
                  label: "Revenus mensuels",
                  value: `${stats?.total_revenue_monthly || 0} TND`,
                  color: T.green,
                },
                {
                  label: "Abonnements actifs (payants)",
                  value: stats?.active_subscriptions || 0,
                  color: T.blue,
                },
                {
                  label: "En période d'essai",
                  value: stats?.trial_subscriptions || 0,
                  color: T.amber,
                },
                {
                  label: "Abonnements expirés",
                  value: stats?.expired_subscriptions || 0,
                  color: T.red,
                },
                {
                  label: "Taux de conversion (essai→payant)",
                  value: stats?.trial_subscriptions
                    ? `${Math.round(
                        (stats.active_subscriptions /
                          (stats.active_subscriptions + stats.trial_subscriptions)) *
                          100
                      )}%`
                    : "—",
                  color: T.purple,
                },
              ].map(({ label, value, color }) => (
                <Box
                  key={label}
                  sx={{ p: 2, bgcolor: T.n100, borderRadius: 2, borderLeft: `3px solid ${color}` }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ color: T.n500 }}>
                      {label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color }}>
                      {value}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </SuperAdminLayout>
  );
}
