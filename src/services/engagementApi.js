import axios from "axios";

const api = axios.create({ baseURL: "/api/engagement" });
const salesApi = axios.create({ baseURL: "/api/sales" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

salesApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getEngagementDashboard = () => api.get("/dashboard/");

export const launchEngagementAgent = (payload = {}) => api.post("/launch/", payload);

export const getEngagementProspects = (params = {}) => api.get("/prospects/", { params });

export const getEmailConnections = () => api.get("/connections/email/");

export const connectGoogleEmail = () => api.post("/connections/gmail/connect/");

export const connectMicrosoftEmail = () => api.post("/connections/microsoft/connect/");

export const disconnectEmail = (provider = "") =>
  api.post("/connections/email/disconnect/", provider ? { provider } : {});

export const testEmailConnection = () => api.post("/connections/email/test/");

export const prepareEngagementMessage = (prospectId) =>
  api.post(`/prospects/${prospectId}/prepare/`, { scrape: true });

export const saveEngagementMessage = (prospectId, payload) =>
  api.patch(`/prospects/${prospectId}/message/`, payload);

export const sendEngagementMessage = (prospectId, payload) =>
  api.post(`/prospects/${prospectId}/send/`, payload);

export const rejectEngagementMessage = (prospectId, payload = {}) =>
  api.post(`/prospects/${prospectId}/reject/`, payload);

export const getEngagementLogs = (prospectId) => api.get(`/prospects/${prospectId}/logs/`);

export const analyzeSocialProfile = (prospectId) =>
  api.post(`/prospects/${prospectId}/analyze-social/`, {});

export const markEngagementReplied = (prospectId) =>
  api.post(`/prospects/${prospectId}/mark-replied/`);

export const checkEngagementReply = (prospectId) =>
  api.post(`/prospects/${prospectId}/check-reply/`);

export const createFollowUpTask = (prospectId, payload = {}) =>
  api.post(`/prospects/${prospectId}/create-follow-up-task/`, payload);

export const startSocialLogin = (platform) => api.post("/social-login/", { platform });

export const checkSocialSession = (platform) =>
  api.get("/social-session/check/", { params: { platform } });

export const resetSocialSession = (platform) => api.post("/social-session/reset/", { platform });

export const getProspectTasks = (prospectId) => salesApi.get(`/prospects/${prospectId}/tasks/`);

export const completeCrmTask = (taskId, payload = {}) =>
  salesApi.post(`/tasks/${taskId}/complete/`, payload);

export default api;
