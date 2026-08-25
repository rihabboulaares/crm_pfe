export const normalizeProfileUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
};

export const classifyProfileUrl = (url) => {
  const normalized = normalizeProfileUrl(url);
  if (!normalized) return null;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.com" ||
      host.endsWith(".fb.com")
    ) {
      return "facebook";
    }
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    return "website";
  } catch {
    return null;
  }
};

export const readableAnalysisError = (source, code, evidenceUsed) => {
  if (source === "linkedin" && code === "PAGE_NOT_PUBLIC" && evidenceUsed) {
    return "LinkedIn n'est pas accessible publiquement. L'analyse a utilise les informations deja decouvertes.";
  }
  if (code === "LOGIN_REQUIRED") return "Connexion requise, source ignoree sans contournement.";
  if (code === "PAGE_NOT_PUBLIC") return "Page non accessible publiquement.";
  if (code === "HTTP_FORBIDDEN") return "Acces public refuse.";
  if (code === "RATE_LIMITED") return "Source temporairement limitee.";
  return code || "";
};

export const normalizeStringList = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? "" : String(item).trim())).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const text = String(value).trim();
  return text ? [text] : [];
};

export const normalizeAnalysisPayload = (result) => {
  const summary = result?.summary || {};
  return {
    missingInformation: normalizeStringList(summary.missing_information),
    services: normalizeStringList(summary.services),
    visibleExpertise: normalizeStringList(summary.visible_expertise),
    confidenceNotes: normalizeStringList(summary.confidence_notes),
    executedActions: normalizeStringList(result?.executed_actions),
    executedSources: normalizeStringList(result?.executed_sources),
    conflicts: Array.isArray(result?.conflicts) ? result.conflicts : [],
    errors: Array.isArray(result?.errors) ? result.errors : [],
    sourceDetails: Array.isArray(result?.source_details) ? result.source_details : [],
  };
};
