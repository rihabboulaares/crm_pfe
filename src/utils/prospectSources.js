const SOURCE_ALIASES = {
  "Meta Ads Library": {
    shortLabel: "Meta Ads",
    fullLabel: "Meta Ads Library",
    color: "#5e35b1",
  },
  meta_ads_library: {
    shortLabel: "Meta Ads",
    fullLabel: "Meta Ads Library",
    color: "#5e35b1",
  },
  ads_library_search: {
    shortLabel: "Meta Ads",
    fullLabel: "Meta Ads Library",
    color: "#5e35b1",
  },

  "Serper Facebook": {
    shortLabel: "Facebook",
    fullLabel: "Serper Facebook",
    color: "#1877f2",
  },
  serper_facebook: {
    shortLabel: "Facebook",
    fullLabel: "Serper Facebook",
    color: "#1877f2",
  },
  facebook: {
    shortLabel: "Facebook",
    fullLabel: "Serper Facebook",
    color: "#1877f2",
  },

  "Serper Instagram": {
    shortLabel: "Instagram",
    fullLabel: "Serper Instagram",
    color: "#e1306c",
  },
  serper_instagram: {
    shortLabel: "Instagram",
    fullLabel: "Serper Instagram",
    color: "#e1306c",
  },
  instagram: {
    shortLabel: "Instagram",
    fullLabel: "Serper Instagram",
    color: "#e1306c",
  },

  "Serper LinkedIn": {
    shortLabel: "LinkedIn",
    fullLabel: "Serper LinkedIn",
    color: "#0077b5",
  },
  serper_linkedin: {
    shortLabel: "LinkedIn",
    fullLabel: "Serper LinkedIn",
    color: "#0077b5",
  },
  linkedin: {
    shortLabel: "LinkedIn",
    fullLabel: "Serper LinkedIn",
    color: "#0077b5",
  },

  "Serper General": {
    shortLabel: "IA",
    fullLabel: "Serper General",
    color: "#546e7a",
  },
  serper_general: {
    shortLabel: "IA",
    fullLabel: "Serper General",
    color: "#546e7a",
  },

  "Google Maps": {
    shortLabel: "Maps",
    fullLabel: "Google Maps",
    color: "#d32f2f",
  },
  google_maps: {
    shortLabel: "Maps",
    fullLabel: "Google Maps",
    color: "#d32f2f",
  },
  maps_search: {
    shortLabel: "Maps",
    fullLabel: "Google Maps",
    color: "#d32f2f",
  },

  Manuel: {
    shortLabel: "Manuel",
    fullLabel: "Manuel",
    color: "#6d4c41",
  },
  manual: {
    shortLabel: "Manuel",
    fullLabel: "Manuel",
    color: "#6d4c41",
  },
  commercial: {
    shortLabel: "Manuel",
    fullLabel: "Manuel",
    color: "#6d4c41",
  },

  agent_prospection: {
    shortLabel: "IA",
    fullLabel: "Agent de prospection",
    color: "#8e0000",
  },
};

const toKey = (value) => String(value || "").trim();

export function getSourceDisplay(value) {
  const key = toKey(value);

  return (
    SOURCE_ALIASES[key] ||
    SOURCE_ALIASES[key.toLowerCase().replace(/\s+/g, "_")] || {
      shortLabel: key || "Manuel",
      fullLabel: key || "Manuel",
      color: "#78909c",
    }
  );
}

export function normalizeProspectSources(prospect = {}) {
  const raw = Array.isArray(prospect.discovery_sources) ? prospect.discovery_sources : [];

  const fallbacks = [
    prospect.source_label,
    prospect.source_display,
    prospect.source,
    prospect.origin,
    prospect.lead_origin,
  ];

  const values = raw.length ? raw : fallbacks;
  const labels = [];

  values.filter(Boolean).forEach((value) => {
    const display = getSourceDisplay(value);

    if (display.fullLabel && !labels.some((item) => item.fullLabel === display.fullLabel)) {
      labels.push(display);
    }
  });

  return labels.length ? labels : [getSourceDisplay("manual")];
}

export function discoverySummarySources(result = {}) {
  const values = Array.isArray(result.sources_used) ? result.sources_used : [];

  return values.map(getSourceDisplay);
}

export function formatDiscoveryMessage(error) {
  if (!error) return "";

  if (typeof error === "string") {
    return error;
  }

  if (typeof error !== "object") {
    return String(error);
  }

  const direct =
    error.message || error.error || error.reason || error.detail || error.status || error.step;

  if (direct && typeof direct !== "object") {
    return String(direct);
  }

  if (direct && typeof direct === "object") {
    return formatDiscoveryMessage(direct);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur Discovery non lisible";
  }
}

export function discoveryImportedCount(result = {}) {
  if (result.imported_count !== undefined || result.imported !== undefined) {
    return Number(result.imported_count ?? result.imported ?? 0);
  }

  const stats = result.import_stats || {};

  return (
    Number(stats.persons_created || 0) +
    Number(stats.persons_updated || 0) +
    Number(stats.companies_created || 0) +
    Number(stats.companies_updated || 0)
  );
}

export function discoveryFailedCount(result = {}) {
  if (result.import_failed_count !== undefined) {
    return Number(result.import_failed_count || 0);
  }

  const stats = result.import_stats || {};

  return Number(stats.persons_failed || 0) + Number(stats.companies_failed || 0);
}

export function discoveryResultMessage(result = {}) {
  if (result.stop_reason === "import_failed") {
    return "Recherche terminée, mais l'import CRM a rencontré une erreur.";
  }

  const hasUnavailableSource = (result.errors || []).some((item) =>
    String(formatDiscoveryMessage(item)).toLowerCase().includes("unavailable")
  );

  if (hasUnavailableSource) {
    return "Recherche terminée avec une source indisponible.";
  }

  return "Recherche terminée.";
}

export function containsSecret(value) {
  return /META_ACCESS_TOKEN|access_token|META_APP_SECRET|SERPER_API_KEY|GOOGLE_API_KEY/i.test(
    JSON.stringify(value || "")
  );
}
