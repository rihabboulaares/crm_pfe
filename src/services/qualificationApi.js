import axios from "axios";

const api = axios.create({ baseURL: "/api/qualification" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const runProspectQualification = (prospectId) => api.post(`/prospects/${prospectId}/run/`);

export const getLatestProspectQualification = (prospectId) =>
  api.get(`/prospects/${prospectId}/latest/`);

export const getProspectQualificationHistory = (prospectId) =>
  api.get(`/prospects/${prospectId}/history/`);

export const getQualificationDetail = (qualificationId) => api.get(`/${qualificationId}/`);

export default api;
