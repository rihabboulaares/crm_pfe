/* eslint-disable prettier/prettier */
// src/pages/superadmin/saUtils.js
// Utilitaires partagés entre toutes les pages SuperAdmin

import axios from "axios";
import PropTypes from "prop-types";
export const T = {
  red: "#dc2626",
  purple: "#7c3aed",
  blue: "#2563eb",
  green: "#059669",
  amber: "#d97706",
  n50: "#f9fafb",
  n100: "#f3f4f6",
  n200: "#e5e7eb",
  n500: "#6b7280",
  n800: "#1f2937",
};

export const apiGet = (url) =>
  axios.get(`http://127.0.0.1:8000${url}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

export const apiPost = (url, data = {}) =>
  axios.post(`http://127.0.0.1:8000${url}`, data, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

// Couleurs selon statut prospect
export const prospectStatusColor = (status) =>
  ({
    new: { bg: "#dbeafe", text: T.blue },
    contacted: { bg: "#fef3c7", text: T.amber },
    qualified: { bg: "#d1fae5", text: T.green },
    lost: { bg: "#fee2e2", text: T.red },
    won: { bg: "#ede9fe", text: T.purple },
  }[status] || { bg: T.n100, text: T.n500 });

// Couleurs selon stage opportunité
export const opportunityStageColor = (stage) =>
  ({
    new: { bg: "#dbeafe", text: T.blue },
    qualified: { bg: "#d1fae5", text: T.green },
    proposal: { bg: "#fef3c7", text: T.amber },
    negotiation: { bg: "#ede9fe", text: T.purple },
    won: { bg: "#d1fae5", text: T.green },
    lost: { bg: "#fee2e2", text: T.red },
  }[stage] || { bg: T.n100, text: T.n500 });

// Couleurs selon statut tâche
export const taskStatusColor = (status) =>
  ({
    todo: { bg: T.n100, text: T.n500 },
    in_progress: { bg: "#dbeafe", text: T.blue },
    done: { bg: "#d1fae5", text: T.green },
    cancelled: { bg: "#fee2e2", text: T.red },
  }[status] || { bg: T.n100, text: T.n500 });

// Couleurs selon priorité tâche
export const taskPriorityColor = (priority) =>
  ({
    low: { bg: "#d1fae5", text: T.green },
    medium: { bg: "#fef3c7", text: T.amber },
    high: { bg: "#fee2e2", text: T.red },
  }[priority] || { bg: T.n100, text: T.n500 });
