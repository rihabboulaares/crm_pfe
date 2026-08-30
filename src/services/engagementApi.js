import { createApiClient } from "./axiosConfig";
const api = createApiClient("/api/engagement");
const salesApi = createApiClient("/api/sales");

export const getEngagementDashboard = () => api.get("/dashboard/");

export const getEngagementProspects = (params = {}) => api.get("/prospects/", { params });

export const getEmailConnections = () => api.get("/connections/email/");

export const connectGoogleEmail = () => api.post("/connections/gmail/connect/");

export const connectMicrosoftEmail = () => api.post("/connections/microsoft/connect/");

export const disconnectEmail = (provider = "") =>
  api.post("/connections/email/disconnect/", provider ? { provider } : {});

export const testEmailConnection = () => api.post("/connections/email/test/");

export const startInitialEngagementPlan = (prospectId) =>
  api.post(`/prospects/${prospectId}/initial-plan/`, {});

export const getEngagementLogs = (prospectId) => api.get(`/prospects/${prospectId}/logs/`);

export const getInteractionOptions = () => api.get("/interactions/options/");

export const getInteractions = (prospectId) => api.get(`/prospects/${prospectId}/interactions/`);

export const recordInteraction = (prospectId, payload) =>
  api.post(`/prospects/${prospectId}/interactions/`, payload);

export const analyzeInteraction = (prospectId, interactionId) =>
  api.post(`/prospects/${prospectId}/interactions/${interactionId}/analyze/`, {});

export const continueInteraction = (prospectId, interactionId) =>
  api.post(`/prospects/${prospectId}/interactions/${interactionId}/continue/`, {});

export const createFollowUpTask = (prospectId, payload = {}) =>
  api.post(`/prospects/${prospectId}/create-follow-up-task/`, payload);

export const getProspectTasks = (prospectId) => salesApi.get(`/prospects/${prospectId}/tasks/`);

export const completeCrmTask = (taskId, payload = {}) =>
  salesApi.post(`/tasks/${taskId}/complete/`, payload);

export default api;
