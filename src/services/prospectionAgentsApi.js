import { API_BASE_URL, getAuthToken } from "./axiosConfig";

const API_BASE = API_BASE_URL;

function buildUrl(path) {
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;
  const normalizedBase = String(API_BASE || "").replace(/\/+$/, "");
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
}

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || payload?.detail || payload?.details || "Erreur serveur");
  }
  return payload;
}

export function runProspectionSubAgent(agentType, payload) {
  return request(`/api/agents/prospection-agents/${agentType}/run/`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export function listProspectionExecutions(agentType) {
  const suffix = agentType ? `?agent_type=${encodeURIComponent(agentType)}` : "";
  return request(`/api/agents/prospection-agents/executions/${suffix}`);
}

export function getProspectionExecution(id) {
  return request(`/api/agents/prospection-agents/executions/${id}/`);
}

export function retryProspectionExecution(id) {
  return request(`/api/agents/prospection-agents/executions/${id}/retry/`, { method: "POST" });
}

export function cancelProspectionExecution(id) {
  return request(`/api/agents/prospection-agents/executions/${id}/cancel/`, { method: "POST" });
}
