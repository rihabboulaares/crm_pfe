// src/layouts/superadmin/index.js
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import {
  Box,
  Grid,
  Card,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import {
  Business,
  People,
  TrendingUp,
  Subscriptions,
  CheckCircle,
  HourglassEmpty,
  Warning,
  AdminPanelSettings,
} from "@mui/icons-material";
import { styled, alpha } from "@mui/material/styles";

const theme = {
  primary: { main: "#dc2626", gradient: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)" },
  purple: { main: "#7c3aed", light: "#ede9fe" },
  blue: { main: "#2563eb", light: "#dbeafe" },
  green: { main: "#059669", light: "#d1fae5" },
  amber: { main: "#d97706", light: "#fef3c7" },
  neutral: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 500: "#6b7280", 800: "#1f2937" },
};

const PageWrapper = styled(Box)({
  minHeight: "100vh",
  backgroundColor: theme.neutral[100],
  padding: "32px",
});

const StatCard = styled(Card)(({ color }) => ({
  borderRadius: 16,
  padding: "24px",
  background: "white",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  borderLeft: `4px solid ${color || theme.primary.main}`,
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
  },
}));

const HeaderCard = styled(Card)({
  borderRadius: 20,
  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  padding: "32px",
  color: "white",
  boxShadow: "0 8px 32px rgba(220,38,38,0.3)",
  marginBottom: "32px",
});

const SectionCard = styled(Card)({
  borderRadius: 16,
  padding: "24px",
  background: "white",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
});

const api = (url) =>
  axios.get(`/${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

// ── StatBox avec PropTypes ────────────────────────────────────
function StatBox({ icon, label, value, color, sub }) {
  return (
    <StatCard color={color}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: theme.neutral[500],
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {label}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, color: theme.neutral[800], my: 0.5 }}>
            {value ?? <CircularProgress size={24} />}
          </Typography>
          {sub && (
            <Typography variant="caption" sx={{ color: theme.neutral[500] }}>
              {sub}
            </Typography>
          )}
        </Box>
        <Avatar
          sx={{ width: 56, height: 56, backgroundColor: alpha(color || theme.primary.main, 0.12) }}
        >
          {React.cloneElement(icon, { sx: { color: color || theme.primary.main, fontSize: 28 } })}
        </Avatar>
      </Stack>
    </StatCard>
  );
}

StatBox.propTypes = {
  icon: PropTypes.element.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  color: PropTypes.string,
  sub: PropTypes.string,
};

StatBox.defaultProps = {
  value: null,
  color: theme.primary.main,
  sub: null,
};

// ── Dashboard principal ───────────────────────────────────────
function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, companiesRes, usersRes] = await Promise.all([
          api("/api/superadmin/stats/"),
          api("/api/superadmin/companies/?page_size=5"),
          api("/api/superadmin/users/?page_size=5"),
        ]);
        setStats(statsRes.data);
        setCompanies(companiesRes.data.results || companiesRes.data);
        setUsers(usersRes.data.results || usersRes.data);
      } catch (err) {
        console.error("Erreur chargement dashboard:", err);
        setError("Impossible de charger les données.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}
      >
        <CircularProgress sx={{ color: theme.primary.main }} size={48} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}
      >
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <PageWrapper>
      {/* ── Header ─────────────────────────────────── */}
      <HeaderCard>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: "rgba(255,255,255,0.2)" }}>
            <AdminPanelSettings sx={{ fontSize: 30 }} />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Super Admin Dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Bienvenue, {user.username} · Vue globale de la plateforme
            </Typography>
          </Box>
        </Stack>
      </HeaderCard>

      {/* ── KPIs ligne 1 ───────────────────────────── */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatBox
            icon={<Business />}
            label="Entreprises"
            value={stats?.total_companies}
            color={theme.blue.main}
            sub={`+${stats?.new_companies_this_month ?? 0} ce mois`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatBox
            icon={<People />}
            label="Utilisateurs"
            value={stats?.total_users}
            color={theme.purple.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatBox
            icon={<CheckCircle />}
            label="Abonnements actifs"
            value={stats?.active_subscriptions}
            color={theme.green.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatBox
            icon={<TrendingUp />}
            label="Revenus mensuels"
            value={stats ? `${stats.total_revenue_monthly} TND` : null}
            color={theme.amber.main}
          />
        </Grid>
      </Grid>

      {/* ── KPIs ligne 2 ───────────────────────────── */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={4}>
          <StatBox
            icon={<HourglassEmpty />}
            label="En période d'essai"
            value={stats?.trial_subscriptions}
            color={theme.amber.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatBox
            icon={<Warning />}
            label="Abonnements expirés"
            value={stats?.expired_subscriptions}
            color={theme.primary.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatBox
            icon={<Subscriptions />}
            label="Total abonnements"
            value={
              stats
                ? (stats.active_subscriptions || 0) +
                  (stats.trial_subscriptions || 0) +
                  (stats.expired_subscriptions || 0)
                : null
            }
            color={theme.blue.main}
          />
        </Grid>
      </Grid>

      {/* ── Répartition par plan ────────────────────── */}
      {stats?.companies_by_plan && Object.keys(stats.companies_by_plan).length > 0 && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12}>
            <SectionCard>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.neutral[800] }}>
                Répartition par plan
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                {Object.entries(stats.companies_by_plan).map(([plan, count]) => (
                  <Chip
                    key={plan}
                    label={`${plan} : ${count} entreprise${count > 1 ? "s" : ""}`}
                    sx={{
                      fontWeight: 600,
                      backgroundColor:
                        plan === "enterprise"
                          ? theme.purple.light
                          : plan === "pro"
                          ? theme.blue.light
                          : theme.green.light,
                      color:
                        plan === "enterprise"
                          ? theme.purple.main
                          : plan === "pro"
                          ? theme.blue.main
                          : theme.green.main,
                    }}
                  />
                ))}
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      )}

      {/* ── Dernières entreprises + utilisateurs ─────── */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SectionCard>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.neutral[800] }}>
              Entreprises récentes
            </Typography>
            {companies.length === 0 ? (
              <Typography variant="body2" sx={{ color: theme.neutral[500] }}>
                Aucune entreprise
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {companies.map((c, i) => (
                  <Box key={c.id}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{ width: 36, height: 36, bgcolor: alpha(theme.blue.main, 0.12) }}
                        >
                          <Business sx={{ fontSize: 18, color: theme.blue.main }} />
                        </Avatar>
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: theme.neutral[800] }}
                          >
                            {c.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.neutral[500] }}>
                            {c.owner_email} · {c.users_count} user{c.users_count !== 1 ? "s" : ""}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip
                        size="small"
                        label={c.subscription_plan || "aucun"}
                        sx={{
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: c.subscription_active
                            ? theme.green.light
                            : theme.neutral[100],
                          color: c.subscription_active ? theme.green.main : theme.neutral[500],
                        }}
                      />
                    </Stack>
                    {i < companies.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.neutral[800] }}>
              Utilisateurs récents
            </Typography>
            {users.length === 0 ? (
              <Typography variant="body2" sx={{ color: theme.neutral[500] }}>
                Aucun utilisateur
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {users.map((u, i) => (
                  <Box key={u.id}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar
                          sx={{ width: 36, height: 36, bgcolor: alpha(theme.purple.main, 0.12) }}
                        >
                          <People sx={{ fontSize: 18, color: theme.purple.main }} />
                        </Avatar>
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: theme.neutral[800] }}
                          >
                            {u.username}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.neutral[500] }}>
                            {u.email} · {u.company_name || "sans company"}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <Chip
                          size="small"
                          label={u.role}
                          sx={{
                            fontSize: 10,
                            fontWeight: 600,
                            backgroundColor:
                              u.role === "ADMIN"
                                ? theme.blue.light
                                : u.role === "MANAGER"
                                ? theme.purple.light
                                : theme.neutral[100],
                            color:
                              u.role === "ADMIN"
                                ? theme.blue.main
                                : u.role === "MANAGER"
                                ? theme.purple.main
                                : theme.neutral[500],
                          }}
                        />
                        {!u.is_active && (
                          <Chip
                            size="small"
                            label="inactif"
                            sx={{ fontSize: 10, bgcolor: "#fee2e2", color: theme.primary.main }}
                          />
                        )}
                      </Stack>
                    </Stack>
                    {i < users.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageWrapper>
  );
}

export default SuperAdminDashboard;
