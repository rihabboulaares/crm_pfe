/* eslint-disable prettier/prettier */
// src/pages/superadmin/saUtils.js
import axios from "axios";

export const API_BASE_URL = "";

export const api = axios.create();

export const getAuthToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("access") ||
  localStorage.getItem("access_token") ||
  localStorage.getItem("accessToken");

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const apiGet = (url, config = {}) => api.get(url, config);
export const apiPost = (url, data = {}, config = {}) => api.post(url, data, config);
export const apiPut = (url, data = {}, config = {}) => api.put(url, data, config);
export const apiPatch = (url, data = {}, config = {}) => api.patch(url, data, config);
export const apiDelete = (url, config = {}) => api.delete(url, config);

export const SA_ENDPOINTS = {
  stats: "/api/superadmin/stats/",
  dashboardGrowth: "/api/superadmin/dashboard-growth/",
  crmFunnel: "/api/superadmin/crm-funnel/",
  geoStats: "/api/superadmin/geo-stats/",
  usersPerformance: "/api/superadmin/users-performance/",
  companiesStats: "/api/superadmin/companies/stats/",
  prospectsStats: "/api/superadmin/prospects/stats/",
  opportunitiesStats: "/api/superadmin/opportunities/stats/",
  tasksStats: "/api/superadmin/tasks/stats/",
  contactsStats: "/api/superadmin/contacts/stats/",
  teamsStats: "/api/superadmin/teams/stats/",
  invitationsStats: "/api/superadmin/invitations/stats/",
  agents: "/api/superadmin/agents/",
  aiAgents: "/api/superadmin/agents/",
  aiAgentStats: "/api/superadmin/ai-agents/stats/",
  logs: "/api/superadmin/logs/",
  auditLogs: "/api/superadmin/logs/",
  systemHealth: "/api/superadmin/system-health/",
  marketingDashboard: "/api/superadmin/marketing-dashboard/",
  feedback: (id) => `/api/superadmin/feedbacks/${id}/`,
};

export const T = {
  red: "#dc2626",
  purple: "#7c3aed",
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
  n50: "#f9fafb",
  n100: "#f3f4f6",
  n200: "#e5e7eb",
  n500: "#6b7280",
  n800: "#1f2937",
};

export const safeArray = (value) => (Array.isArray(value) ? value : []);
export const getListPayload = (data) => safeArray(data?.results || data);
export const getListCount = (data) => Number(data?.count ?? getListPayload(data).length ?? 0);
export const getApiErrorMessage = (error, fallback = "Impossible de charger les donnees.") =>
  error?.response?.data?.detail ||
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  fallback;
export const formatNumber = (value) => Number(value || 0).toLocaleString("fr-FR");
export const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} TND`;
export const percent = (value, total) =>
  `${total ? Math.round((Number(value || 0) / total) * 100) : 0}%`;
export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "—");
export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const statusColors = {
  online: { bg: "#dcfce7", text: T.green },
  success: { bg: "#dcfce7", text: T.green },
  warning: { bg: "#fef3c7", text: T.amber },
  slow: { bg: "#fef3c7", text: T.amber },
  failed: { bg: "#fee2e2", text: T.red },
  offline: { bg: "#fee2e2", text: T.red },
  running: { bg: "#dbeafe", text: T.blue },
  partial: { bg: "#ede9fe", text: T.purple },
};

export const colorForStatus = (status) => statusColors[status] || { bg: T.n100, text: T.n500 };

export const prospectStatusColor = (status) =>
  ({
    new: { bg: "#dbeafe", text: T.blue },
    contacted: { bg: "#fef3c7", text: T.amber },
    qualified: { bg: "#d1fae5", text: T.green },
    lost: { bg: "#fee2e2", text: T.red },
    won: { bg: "#ede9fe", text: T.purple },
  }[status] || { bg: T.n100, text: T.n500 });

export const opportunityStageColor = (stage) =>
  ({
    new: { bg: "#dbeafe", text: T.blue },
    qualified: { bg: "#d1fae5", text: T.green },
    proposal: { bg: "#fef3c7", text: T.amber },
    negotiation: { bg: "#ede9fe", text: T.purple },
    won: { bg: "#d1fae5", text: T.green },
    lost: { bg: "#fee2e2", text: T.red },
  }[stage] || { bg: T.n100, text: T.n500 });

export const taskStatusColor = (status) =>
  ({
    todo: { bg: T.n100, text: T.n500 },
    in_progress: { bg: "#dbeafe", text: T.blue },
    done: { bg: "#d1fae5", text: T.green },
    completed: { bg: "#d1fae5", text: T.green },
    cancelled: { bg: "#fee2e2", text: T.red },
  }[status] || { bg: T.n100, text: T.n500 });

export const taskPriorityColor = (priority) =>
  ({
    low: { bg: "#d1fae5", text: T.green },
    medium: { bg: "#fef3c7", text: T.amber },
    high: { bg: "#fee2e2", text: T.red },
  }[priority] || { bg: T.n100, text: T.n500 });
