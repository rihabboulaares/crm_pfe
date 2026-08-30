import { createApiClient } from "./axiosConfig";
const api = createApiClient("/api/qualification");

export const runProspectQualification = (prospectId) => api.post(`/prospects/${prospectId}/run/`);

export const getLatestProspectQualification = (prospectId) =>
  api.get(`/prospects/${prospectId}/latest/`);

export const getProspectQualificationHistory = (prospectId) =>
  api.get(`/prospects/${prospectId}/history/`);

export const getQualificationDetail = (qualificationId) => api.get(`/${qualificationId}/`);

export default api;
