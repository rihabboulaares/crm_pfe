export const SOURCE_CONFIG = {
  google_maps: { label: "Google Maps", color: "#d32f2f" },
  maps_search: { label: "Google Maps", color: "#d32f2f" },
  linkedin: { label: "LinkedIn", color: "#0077b5" },
  serper_linkedin: { label: "LinkedIn", color: "#0077b5" },
  instagram: { label: "Instagram", color: "#e1306c" },
  serper_instagram: { label: "Instagram", color: "#e1306c" },
  facebook: { label: "Facebook", color: "#1877f2" },
  serper_facebook: { label: "Facebook", color: "#1877f2" },
  meta_ads_library: { label: "Meta Ads", color: "#5e35b1" },
  ads_library_search: { label: "Meta Ads", color: "#5e35b1" },
  serper_general: { label: "IA", color: "#546e7a" },
  web: { label: "Web", color: "#c62828" },
  other: { label: "Autre", color: "#6d4c41" },
  commercial: { label: "Commercial", color: "#b71c1c" },
  agent_prospection: { label: "Agent de prospection", color: "#8e0000" },
};

export const PROFILE_STATUS_CONFIG = {
  running: { label: "En cours", color: "#f9a825" },
  completed: { label: "Analyse", color: "#2e7d32" },
  partial: { label: "Partiel", color: "#ef6c00" },
  failed: { label: "Echec", color: "#c62828" },
  completed_without_sources: { label: "Sans sources", color: "#607d8b" },
};

export const PROSPECT_SOURCE_OPTIONS = [
  ["google_maps", "Google Maps"],
  ["linkedin", "LinkedIn"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["web", "Web"],
  ["other", "Autre"],
];

export const TASK_TYPE_OPTIONS = [
  ["classic", "Tache classique"],
  ["call", "Appel"],
  ["linkedin_message", "Message LinkedIn"],
  ["email", "Email"],
  ["facebook_message", "Message Facebook"],
  ["instagram_message", "Message Instagram"],
  ["follow_up", "Relance"],
  ["meeting", "RDV"],
  ["note", "Note"],
  ["other", "Autre"],
];

export const getProfileStatus = (prospect) => {
  const status = prospect?.profile_analysis_status;
  return PROFILE_STATUS_CONFIG[status] || { label: "Non analyse", color: "#78909c" };
};

export const getProspectDisplayName = (prospect) =>
  [prospect?.first_name, prospect?.last_name].filter(Boolean).join(" ").trim() || "Sans nom";

export const getProspectInitials = (prospect) => {
  const name = getProspectDisplayName(prospect);
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};
