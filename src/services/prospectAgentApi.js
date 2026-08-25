import api from "./salesApi";

export function searchProspectsAgent(criteria) {
  const query = typeof criteria === "string" ? criteria : criteria?.query;
  return api.post("/api/agent/prospect/", { query }).then((response) => response.data);
}

export function runProspectionAgent(query) {
  return searchProspectsAgent({ query });
}

export function runDiscovery(payload) {
  return api.post("/api/agent/prospect/", payload).then((response) => response.data);
}

export function runProspectDiscovery(payload) {
  return runDiscovery(payload);
}

export function getProspectSources(prospectId) {
  return api.get(`/api/prospects/${prospectId}/sources/`).then((response) => response.data);
}

export function calculateProspectScore(prospectId) {
  return api.post(`/api/prospects/${prospectId}/score/`).then((response) => response.data);
}

export function getDiscoveryReportBlob(reportUrl) {
  return api.get(reportUrl, { responseType: "blob" }).then((response) => response.data);
}

export function importProspectionResult(payload) {
  return api.post("/agentProspection/importer/", payload).then((response) => response.data);
}
