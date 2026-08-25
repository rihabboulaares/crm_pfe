import api from "./salesApi";

export const analyzeProspect = (prospectId, payload = {}) =>
  api.post(`/api/prospection/prospects/${prospectId}/analyze-profile/`, payload);

export const getProspectAnalysis = (prospectId) =>
  api.get(`/api/prospection/prospects/${prospectId}/analysis/`);

export const getProspectAnalysisHistory = (prospectId) =>
  api.get(`/api/prospection/prospects/${prospectId}/analysis-history/`);
