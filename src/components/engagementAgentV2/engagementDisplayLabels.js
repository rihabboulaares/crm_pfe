export const CHANNEL_LABELS = {
  email: "Email",
  phone: "Téléphone",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  other: "Autre",
  EMAIL: "Email",
  PHONE: "Téléphone",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  OTHER: "Autre",
};
export const STRATEGY_LABELS = {
  DIRECT_OUTREACH: "Prise de contact directe",
  VALUE_FIRST: "Approche par la valeur",
  DISCOVERY: "Découverte du besoin",
  FOLLOW_UP: "Relance",
  OBJECTION_HANDLING: "Traitement de l'objection",
  NURTURING: "Maintien de la relation",
  MEETING_CONVERSION: "Proposition de rendez-vous",
  REACTIVATION: "Réactivation",
  CLOSING: "Finalisation",
  WAIT: "Attendre",
  STOP_ENGAGEMENT: "Arrêter les sollicitations",
};

export const OBJECTIVE_LABELS = {
  START_CONVERSATION: "Initier un échange",
  QUALIFY_NEED: "Comprendre le besoin",
  DISCOVER_PAIN_POINTS: "Identifier les difficultés",
  FOLLOW_UP: "Relancer le contact",
  HANDLE_OBJECTION: "Répondre à une objection",
  PROVIDE_INFORMATION: "Fournir des informations",
  PROPOSE_MEETING: "Proposer un rendez-vous",
  REACTIVATE: "Reprendre contact",
  NURTURE: "Maintenir la relation",
  CLOSE_CONVERSATION: "Finaliser l'échange",
  WAIT: "Attendre",
};

export const TEMPERATURE_LABELS = {
  COLD: "Faible",
  WARM: "Modéré",
  HOT: "Élevé",
  UNKNOWN: "Non déterminé",
};

export const INTEREST_LABELS = {
  LOW: "Faible",
  MEDIUM: "Moyen",
  HIGH: "Élevé",
  VERY_HIGH: "Très élevé",
  UNKNOWN: "Non déterminé",
};

export const INTENT_LABELS = {
  VERY_INTERESTED: "Très intéressé",
  INTERESTED: "Intéressé",
  NOT_INTERESTED: "Pas intéressé",
  CALL_LATER: "À rappeler plus tard",
  OBJECTION: "Objection exprimée",
  QUESTION: "Question",
  PRICING_REQUEST: "Demande de tarif",
  INFORMATION_REQUEST: "Demande d'information",
  REQUEST_INFORMATION: "Demande d'information",
  MEETING_REQUEST: "Demande de rendez-vous",
  WRONG_CONTACT: "Mauvais contact",
  UNSUBSCRIBE: "Ne plus contacter",
  NO_RESPONSE: "Pas de réponse",
  UNKNOWN: "Non déterminé",
};

export const SENTIMENT_LABELS = {
  POSITIVE: "Positif",
  NEUTRAL: "Neutre",
  NEGATIVE: "Négatif",
  MIXED: "Mitigé",
  UNKNOWN: "Non déterminé",
};

export const ACTION_TYPE_LABELS = {
  EMAIL_SENT: "Email envoyé",
  PHONE_CALL: "Appel effectué",
  SOCIAL_MESSAGE_SENT: "Message social envoyé",
  FOLLOW_UP: "Relance",
  OTHER: "Autre",
};

export const OUTCOME_LABELS = {
  SENT: "Envoyé",
  NO_RESPONSE: "Pas de réponse",
  INTERESTED: "Intéressé",
  NOT_INTERESTED: "Pas intéressé",
  CALL_LATER: "Rappeler plus tard",
  OBJECTION: "Objection",
  REQUEST_INFORMATION: "Demande d'information",
  MEETING_REQUEST: "Demande de rendez-vous",
  WRONG_CONTACT: "Mauvais contact",
  UNSUBSCRIBE: "Ne plus contacter",
  OTHER: "Autre",
};

export const POLICY_LABELS = {
  DO_NOT_CONTACT: "Le prospect ne doit plus être contacté.",
  UNSUBSCRIBE: "Le prospect a demandé à ne plus être contacté.",
  PROSPECT_STATUS_TERMINAL: "Le prospect est dans un statut commercial terminal.",
  ENGAGEMENT_STATUS_TERMINAL: "La séquence est déjà clôturée.",
  PRIMARY_CHANNEL_UNAVAILABLE: "Le canal recommandé n'est pas disponible.",
  PRIMARY_CHANNEL_UNSUPPORTED: "Le canal recommandé n'est pas pris en charge.",
  PRIMARY_CHANNEL_REQUIRED: "Aucun canal principal n'a été fourni.",
  PROSPECT_ACCESS_DENIED: "Vous n'avez pas accès à ce prospect.",
  DUPLICATE_IDEMPOTENCY_KEY: "Cette action a déjà été enregistrée.",
  RECENT_DUPLICATE_ACTION: "Une action similaire a déjà été enregistrée récemment.",
  EMAIL_PROVIDER_NOT_READY: "Aucun compte email actif n'est connecté.",
};

const DEFAULT_LABELS = {
  PRICE: "Prix",
  NO_BUDGET: "Budget non disponible",
  TIMING: "Calendrier",
  ALREADY_HAVE_SOLUTION: "Solution déjà en place",
  NO_NEED: "Pas de besoin exprimé",
  NO_TIME: "Manque de temps",
  NOT_PRIORITY: "Pas prioritaire",
  NEED_MANAGER_APPROVAL: "Validation hiérarchique nécessaire",
  MISSING_FEATURE: "Fonctionnalité manquante",
  SECURITY_CONCERN: "Point de sécurité",
  COMPETITOR: "Concurrent mentionné",
  requests_follow_up: "Demande de suivi",
  asks_for_pricing: "Demande de tarif",
  asks_for_demo: "Demande de démonstration",
  asks_for_meeting: "Demande de rendez-vous",
  asks_for_proposal: "Demande de proposition",
  mentions_active_need: "Besoin actif mentionné",
  mentions_project: "Projet mentionné",
  manual_prospecting: "Tâches manuelles",
  presentation: "Présentation",
  documentation: "Documentation",
  pricing: "Tarifs",
  demo: "Démonstration",
  meeting: "Rendez-vous",
  callback: "Rappel",
  technical_information: "Informations techniques",
  proposal: "Proposition",
  Interet: "Intérêt",
  interest: "Intérêt",
  interest_level: "Niveau d'intérêt",
};

export function labelFromEnum(value, dictionary = {}) {
  if (!value) return "Non déterminé";
  if (dictionary[value]) return dictionary[value];
  if (DEFAULT_LABELS[value]) return DEFAULT_LABELS[value];
  if (String(value).toLowerCase().startsWith("crm ")) return `CRM ${String(value).slice(4)}`;
  const normalized = String(value).toLowerCase().replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function confidenceLevel(value) {
  const percent = Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
  if (percent >= 90) return { percent, label: "Très élevée" };
  if (percent >= 75) return { percent, label: "Élevée" };
  if (percent >= 50) return { percent, label: "Moyenne" };
  return { percent, label: "Faible" };
}
