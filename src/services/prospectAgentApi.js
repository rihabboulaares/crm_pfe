/**
 * Service API pour l'agent de prospection.
 *
 * Toutes les requêtes vers le backend Django passent par ce fichier.
 * Authentification via Bearer token (localStorage).
 */

const API_BASE = process.env.REACT_APP_API_BASE_URL || "/";

function authHeaders() {
  const token =
    window.localStorage.getItem("accessToken") ||
    window.localStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("access");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
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
    const message =
      payload?.detail || payload?.error || payload?.message || `Erreur serveur ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

/**
 * Lance l'agent de prospection.
 *
 * Exemples d'appels :
 *
 * // Mode agent IA (recommandé) — requête naturelle
 * searchProspectsAgent({ query: "restaurants à Tunis avec Facebook" })
 * searchProspectsAgent({ query: "foodbloggers à Sousse" })
 * searchProspectsAgent({ query: "responsables RH hôtels Tunis" })
 */
export function searchProspectsAgent(criteria) {
  const query = typeof criteria === "string" ? criteria : criteria?.query;

  return request("/api/agent/prospect/", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function runProspectionAgent(query) {
  return searchProspectsAgent({ query });
}

/**
 * Importe un résultat de prospection dans le CRM.
 *
 * payload = { company: {...}, prospects: [...] }
 */
export function importProspectionResult(payload) {
  return request("/agentProspection/importer/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
