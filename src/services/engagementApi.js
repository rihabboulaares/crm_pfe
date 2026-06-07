import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:8000/api/engagement" });
const salesApi = axios.create({ baseURL: "http://127.0.0.1:8000/api/sales" });

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

export const getEngagementProspects = (params = {}) => api.get("/prospects/", { params });

export const prepareEngagementMessage = (prospectId) =>
  api.post(`/prospects/${prospectId}/prepare/`, { scrape: true });

export const saveEngagementMessage = (prospectId, payload) =>
  api.patch(`/prospects/${prospectId}/message/`, payload);

export const sendEngagementMessage = (prospectId, payload) =>
  api.post(`/prospects/${prospectId}/send/`, payload);

export const getEngagementLogs = (prospectId) => api.get(`/prospects/${prospectId}/logs/`);

export const analyzeSocialProfile = (prospectId) =>
  api.post(`/prospects/${prospectId}/analyze-social/`, {});

export const markEngagementReplied = (prospectId) =>
  api.post(`/prospects/${prospectId}/mark-replied/`);

export const createFollowUpTask = (prospectId, payload = {}) =>
  api.post(`/prospects/${prospectId}/create-follow-up-task/`, payload);

export const startSocialLogin = (platform) => api.post("/social-login/", { platform });

export const openFacebookSession = () => api.post("/facebook/open-session/");

export const checkSocialSession = (platform) =>
  api.get("/social-session/check/", { params: { platform } });

export const getProspectTasks = (prospectId) => salesApi.get(`/prospects/${prospectId}/tasks/`);

export const completeCrmTask = (taskId, payload = {}) =>
  salesApi.post(`/tasks/${taskId}/complete/`, payload);

export default api;
