/* eslint-disable prettier/prettier */
/**
 * ProspectAgent — Agent de prospection conversationnel
 * Design : Light, rouge industriel, style ChatGPT
 * Architecture : Chat-first, résultats inline, sidebar stats simplifiée
 * Features : Google Maps intégré pour chaque carte
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import SocialConnectionBox, { isSessionReady } from "../components/social/SocialConnectionBox";
import { importProspectionResult, searchProspectsAgent } from "../services/prospectAgentApi";

// Google Maps API Key (depuis .env)
const GOOGLE_MAPS_API_KEY =
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyCmPiP8lvIaxxcOZVjrxKNdAWyqYo5f94M";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  red: "#C8102E",
  redDeep: "#9B0D22",
  redLight: "#FDEEF1",
  redMid: "#F5C6CE",
  bg: "#F7F8FA",
  white: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F5",
  border: "#E4E7ED",
  borderFocus: "#C8102E",
  text: "#111827",
  textSub: "#4B5563",
  textMuted: "#9CA3AF",
  green: "#059669",
  greenBg: "#ECFDF5",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  blue: "#2563EB",
  blueBg: "#EFF6FF",
  shadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 24px rgba(0,0,0,0.12)",
};

// ─── Static styles ─────────────────────────────────────────────────────────────
const STYLE_ID = "pa-styles-v4";
if (!document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    .pa-root {
      font-family: 'Sora', sans-serif;
      background: ${T.bg};
      min-height: 100vh;
      color: ${T.text};
    }

    /* ── Layout principal ── */
    .pa-layout {
      display: grid;
      grid-template-columns: 1fr 260px;
      gap: 0;
      height: calc(100vh - 64px);
    }
    @media (max-width: 960px) {
      .pa-layout { grid-template-columns: 1fr; }
      .pa-sidebar { display: none; }
    }

    /* ── Zone chat (colonne gauche) ── */
    .pa-chat-col {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid ${T.border};
    }

    /* Header chat */
    .pa-chat-header {
      padding: 16px 24px;
      background: ${T.white};
      border-bottom: 1px solid ${T.border};
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .pa-agent-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: ${T.redLight};
      border: 1px solid ${T.redMid};
      border-radius: 20px;
      padding: 4px 12px 4px 8px;
    }
    .pa-agent-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: ${T.red};
      animation: pa-pulse 2s ease-in-out infinite;
    }
    @keyframes pa-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
    .pa-agent-label {
      font-size: 12px;
      font-weight: 600;
      color: ${T.red};
      letter-spacing: 0.3px;
    }
    .pa-clear-btn {
      margin-left: auto;
      padding: 5px 12px;
      border: 1px solid ${T.border};
      border-radius: 6px;
      background: transparent;
      font-family: 'Sora', sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: ${T.textSub};
      cursor: pointer;
      transition: all 0.12s;
    }
    .pa-clear-btn:hover { border-color: ${T.red}; color: ${T.red}; background: ${T.redLight}; }

    /* Messages scroll */
    .pa-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .pa-messages::-webkit-scrollbar { width: 4px; }
    .pa-messages::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }

    /* ── Messages ── */
    .pa-msg { display: flex; gap: 10px; animation: pa-fade-in 0.2s ease; }
    @keyframes pa-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    .pa-msg.user { flex-direction: row-reverse; }

    .pa-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700;
    }
    .pa-avatar.agent { background: ${T.red}; color: ${T.white}; font-size: 12px; }
    .pa-avatar.user { background: ${T.surfaceAlt}; border: 1px solid ${T.border}; }

    .pa-bubble {
      max-width: 72%;
      padding: 12px 16px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.55;
    }
    .pa-bubble.agent {
      background: ${T.white};
      border: 1px solid ${T.border};
      border-top-left-radius: 4px;
      box-shadow: ${T.shadow};
      color: ${T.text};
    }
    .pa-bubble.user {
      background: ${T.red};
      color: ${T.white};
      border-top-right-radius: 4px;
    }

    /* ── Logs agent (thinking) ── */
    .pa-thinking {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 14px;
      background: ${T.white};
      border: 1px solid ${T.border};
      border-left: 3px solid ${T.red};
      border-radius: 10px;
      max-width: 72%;
    }
    .pa-log-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: ${T.textSub};
    }
    .pa-log-item.active { color: ${T.red}; font-weight: 500; }
    .pa-log-item.done { color: ${T.green}; }
    .pa-log-icon { font-size: 11px; width: 16px; text-align: center; }
    .pa-spinner-sm {
      width: 12px; height: 12px;
      border: 2px solid ${T.redMid};
      border-top-color: ${T.red};
      border-radius: 50%;
      animation: pa-spin 0.7s linear infinite;
    }
    @keyframes pa-spin { to { transform: rotate(360deg); } }

    /* ── Cards résultats modernes ── */
    .pa-results-block {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .pa-results-summary {
      font-size: 13px;
      font-weight: 600;
      color: ${T.textSub};
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    /* Card entreprise moderne */
    .pa-card {
      background: ${T.white};
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.2s ease;
      cursor: default;
      box-shadow: ${T.shadow};
    }
    .pa-card:hover { 
      transform: translateY(-2px); 
      box-shadow: ${T.shadowLg}; 
    }
    .pa-card.hot  { border-left: 4px solid ${T.red}; }
    .pa-card.warm { border-left: 4px solid ${T.amber}; }
    .pa-card.cold { border-left: 4px solid ${T.border}; }

    .pa-card-content {
      padding: 16px;
    }

    .pa-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pa-card-title h3 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 4px 0;
      color: ${T.text};
    }
    .pa-card-subtitle {
      font-size: 12px;
      color: ${T.textMuted};
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pa-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 700; white-space: nowrap;
    }
    .pa-badge.hot  { background: ${T.redLight};   color: ${T.red};   }
    .pa-badge.warm { background: ${T.amberBg};     color: ${T.amber}; }
    .pa-badge.cold { background: ${T.surfaceAlt};  color: ${T.textMuted}; }

    /* Google Maps intégré */
    .pa-map-container {
      margin: 12px 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid ${T.border};
      background: ${T.surfaceAlt};
      min-height: 180px;
    }
    .pa-map-placeholder {
      height: 180px;
      background: linear-gradient(135deg, ${T.surfaceAlt} 0%, ${T.bg} 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 8px;
      color: ${T.textMuted};
      font-size: 12px;
    }
    .pa-map-iframe {
      width: 100%;
      height: 200px;
      border: none;
    }
    .pa-contacts {
      display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0;
    }
    .pa-contact-chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px; padding: 4px 10px;
      border-radius: 8px;
      border: 1px solid ${T.border};
      background: ${T.surfaceAlt};
      color: ${T.textSub};
    }
    .pa-contact-chip.filled { background: ${T.white}; border-color: ${T.border}; color: ${T.text}; }

    /* Barre score améliorée */
    .pa-score-section {
      margin: 12px 0;
    }
    .pa-score-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .pa-score-lbl { font-size: 11px; color: ${T.textMuted}; font-weight: 500; }
    .pa-score-val { font-size: 11px; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
    .pa-score-track { height: 6px; border-radius: 3px; background: ${T.border}; overflow: hidden; }
    .pa-score-fill  { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

    /* Raison score */
    .pa-score-reason {
      font-size: 11px;
      color: ${T.textMuted};
      margin: 8px 0 0 0;
      padding: 8px;
      background: ${T.surfaceAlt};
      border-radius: 8px;
      line-height: 1.4;
    }

    /* Socials */
    .pa-socials { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .pa-social {
      width: 30px; height: 30px;
      border-radius: 8px; border: 1px solid ${T.border};
      display: inline-flex; align-items: center; justify-content: center;
      text-decoration: none; font-size: 14px; transition: all 0.12s;
    }
    .pa-social:hover { border-color: ${T.red}; background: ${T.redLight}; transform: translateY(-2px); }

    /* Card footer */
    .pa-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid ${T.border};
      gap: 12px;
      flex-wrap: wrap;
    }
    .pa-next-action {
      font-size: 11px;
      color: ${T.textMuted};
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pa-import-btn {
      padding: 6px 16px;
      border: none;
      border-radius: 8px;
      font-family: 'Sora', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.12s;
    }
    .pa-import-btn.primary {
      background: ${T.red};
      color: ${T.white};
    }
    .pa-import-btn.primary:hover {
      background: ${T.redDeep};
      transform: scale(1.02);
    }
    .pa-import-btn.done {
      background: ${T.greenBg};
      color: ${T.green};
      border: 1px solid #BBF7D0;
      cursor: default;
    }

    /* Card prospect */
    .pa-prospect {
      background: ${T.white};
      border-radius: 16px;
      padding: 16px;
      box-shadow: ${T.shadow};
      transition: all 0.2s ease;
    }
    .pa-prospect:hover { 
      transform: translateY(-2px); 
      box-shadow: ${T.shadowLg}; 
    }
    .pa-prospect.hot  { border-left: 4px solid ${T.red}; }
    .pa-prospect.warm { border-left: 4px solid ${T.amber}; }
    .pa-prospect-content {
      display: flex;
      gap: 14px;
    }
    .pa-prospect-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: ${T.redLight}; border: 2px solid ${T.redMid};
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: ${T.red}; flex-shrink: 0;
    }
    .pa-prospect-body { flex: 1; min-width: 0; }
    .pa-prospect-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pa-prospect-name { font-size: 16px; font-weight: 700; margin: 0; }
    .pa-prospect-title { font-size: 12px; color: ${T.textMuted}; margin-top: 2px; }

    /* Tabs résultats */
    .pa-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      background: ${T.surfaceAlt};
      border-radius: 12px;
      padding: 4px;
    }
    .pa-tab-btn {
      flex: 1; padding: 8px 12px; border: none; border-radius: 8px;
      font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.12s;
    }
    .pa-tab-btn.active { background: ${T.white}; color: ${T.red}; box-shadow: ${T.shadow}; }
    .pa-tab-btn:not(.active) { background: transparent; color: ${T.textMuted}; }

    /* Stats chips */
    .pa-stats-chips {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
    }
    .pa-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
      background: ${T.white};
      border: 1px solid ${T.border};
    }
    .pa-chip.red   { background: ${T.redLight};  color: ${T.red};        border-color: ${T.redMid}; }
    .pa-chip.green { background: ${T.greenBg};   color: ${T.green};      border-color: #BBF7D0; }
    .pa-chip.amber { background: ${T.amberBg};   color: ${T.amber};      border-color: #FDE68A; }
    .pa-chip.blue  { background: ${T.blueBg};    color: ${T.blue};       border-color: #BFDBFE; }
    .pa-chip.gray  { background: ${T.surfaceAlt}; color: ${T.textMuted}; border-color: ${T.border}; }

    /* Suggestions */
    .pa-suggestions {
      display: flex; flex-wrap: wrap; gap: 8px;
      padding: 0 24px 16px;
    }
    .pa-suggestion {
      padding: 8px 16px; border-radius: 24px;
      border: 1px solid ${T.border}; background: ${T.white};
      font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500;
      color: ${T.textSub}; cursor: pointer; transition: all 0.12s;
      box-shadow: ${T.shadow};
    }
    .pa-suggestion:hover { border-color: ${T.red}; color: ${T.red}; background: ${T.redLight}; transform: translateY(-1px); }

    /* Input zone */
    .pa-input-zone {
      padding: 16px 24px;
      background: ${T.white};
      border-top: 1px solid ${T.border};
      flex-shrink: 0;
    }
    .pa-input-row {
      display: flex; gap: 8px; align-items: flex-end;
      background: ${T.surfaceAlt};
      border: 1.5px solid ${T.border};
      border-radius: 16px;
      padding: 8px 8px 8px 16px;
      transition: border-color 0.15s;
    }
    .pa-input-row:focus-within { border-color: ${T.red}; background: ${T.white}; }
    .pa-textarea {
      flex: 1; border: none; background: transparent;
      font-family: 'Sora', sans-serif; font-size: 14px;
      color: ${T.text}; resize: none; outline: none;
      min-height: 22px; max-height: 120px; line-height: 1.5;
    }
    .pa-textarea::placeholder { color: ${T.textMuted}; }
    .pa-send-btn {
      width: 38px; height: 38px; border: none; border-radius: 12px;
      background: ${T.red}; color: ${T.white};
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.12s; flex-shrink: 0; font-size: 16px;
    }
    .pa-send-btn:hover:not(:disabled) { background: ${T.redDeep}; transform: scale(1.02); }
    .pa-send-btn:disabled { background: ${T.textMuted}; cursor: not-allowed; }
    .pa-input-hint {
      font-size: 11px; color: ${T.textMuted};
      margin-top: 8px; text-align: center;
    }

    /* Sidebar droite simplifiée */
    .pa-sidebar {
      background: ${T.white};
      overflow-y: auto;
      padding: 20px 16px;
      display: flex; flex-direction: column; gap: 20px;
    }
    .pa-sidebar-section {
      background: ${T.surfaceAlt};
      border-radius: 16px;
      padding: 16px;
    }
    .pa-sidebar-title {
      font-size: 11px; font-weight: 700; letter-spacing: 1px;
      text-transform: uppercase; color: ${T.textMuted};
      margin-bottom: 12px;
    }
    .pa-stat-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0;
    }
    .pa-stat-row + .pa-stat-row { border-top: 1px solid ${T.border}; }
    .pa-stat-lbl { font-size: 13px; color: ${T.textSub}; }
    .pa-stat-val {
      font-size: 14px; font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .pa-stat-val.red   { color: ${T.red}; }
    .pa-stat-val.green { color: ${T.green}; }
    .pa-stat-val.amber { color: ${T.amber}; }
    .pa-stat-val.blue  { color: ${T.blue}; }

    /* Empty state */
    .pa-empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px; padding: 48px 24px; text-align: center;
    }
    .pa-empty-icon {
      width: 80px; height: 80px; border-radius: 50%;
      background: ${T.redLight}; display: flex; align-items: center; justify-content: center;
      font-size: 36px;
    }
    .pa-empty-title { font-size: 20px; font-weight: 700; margin: 0; }
    .pa-empty-sub { font-size: 14px; color: ${T.textSub}; max-width: 320px; line-height: 1.5; margin: 0; }

    /* Toast */
    .pa-toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      padding: 12px 20px; border-radius: 12px;
      font-size: 13px; font-weight: 600;
      display: flex; align-items: center; gap: 10px;
      animation: pa-fade-in 0.2s ease;
      box-shadow: ${T.shadowLg};
    }
    .pa-toast.success { background: ${T.greenBg}; color: ${T.green}; border: 1px solid #BBF7D0; }
    .pa-toast.error   { background: ${T.redLight};  color: ${T.red};   border: 1px solid ${T.redMid}; }

    * { box-sizing: border-box; }
  `;
  document.head.appendChild(el);
}

// ─── Suggestions ──────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Restaurants a Tunis avec telephone et site web",
  "Food bloggers cuisine tunisienne sur Instagram",
  "Responsables RH dans les societes IT a Tunis sur LinkedIn",
  "Hotels a Sousse avec email et site web",
  "Fondateurs de startups tech a Tunis",
  "Salons de beaute a Ariana avec Instagram",
];

// ─── Logs simulés pendant le chargement ───────────────────────────────────────
const THINKING_STEPS = [
  { icon: "1", label: "Analyse de la requete" },
  { icon: "2", label: "Detection du secteur, de la ville et des sources" },
  { icon: "3", label: "Recherche publique" },
  { icon: "4", label: "Enrichissement et dedoublonnage" },
  { icon: "5", label: "Scoring et classement" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (v) => (v >= 70 ? T.red : v >= 50 ? T.amber : T.textMuted);
const cap = (v) => Math.max(0, Math.min(100, Number(v || 0)));

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function rankItems(items) {
  return [...(items || [])].sort((a, b) => {
    const scoreA = Number(a.score_ia || a.score || 0);
    const scoreB = Number(b.score_ia || b.score || 0);
    const contactA = [
      "telephone",
      "phone",
      "email",
      "site_web",
      "linkedin_url",
      "facebook_url",
      "instagram_url",
    ].filter((k) => a[k]).length;
    const contactB = [
      "telephone",
      "phone",
      "email",
      "site_web",
      "linkedin_url",
      "facebook_url",
      "instagram_url",
    ].filter((k) => b[k]).length;
    return scoreB - scoreA || contactB - contactA;
  });
}

function leadQuality(item) {
  const contacts = [
    "telephone",
    "phone",
    "email",
    "site_web",
    "linkedin_url",
    "facebook_url",
    "instagram_url",
  ].filter((k) => item?.[k]).length;
  if (Number(item?.score_ia || 0) >= 70 || contacts >= 3) return "Prioritaire";
  if (Number(item?.score_ia || 0) >= 50 || contacts >= 1) return "A verifier";
  return "Faible signal";
}

// ─── Composant Google Maps ───────────────────────────────────────────────────
function GoogleMapEmbed({ address, placeName }) {
  const [mapError, setMapError] = useState(false);

  if (!address || mapError) {
    return (
      <div className="pa-map-placeholder">
        <span>🗺️</span>
        <span>Adresse non disponible</span>
      </div>
    );
  }

  const encodedAddress = encodeURIComponent(address);
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${encodedAddress}&zoom=15&maptype=roadmap`;

  return (
    <div className="pa-map-container">
      <iframe
        className="pa-map-iframe"
        title={`Carte - ${placeName || address}`}
        src={mapUrl}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        onError={() => setMapError(true)}
      />
    </div>
  );
}

GoogleMapEmbed.propTypes = {
  address: PropTypes.string,
  placeName: PropTypes.string,
};
GoogleMapEmbed.defaultProps = { address: null, placeName: null };

function Badge({ eval: ev }) {
  const labels = { hot: "Hot", warm: "Warm", cold: "Cold" };
  return <span className={`pa-badge ${ev || "cold"}`}>{labels[ev] || "Cold"}</span>;
}
Badge.propTypes = { eval: PropTypes.string };
Badge.defaultProps = { eval: "cold" };

function ScoreBar({ score }) {
  const v = cap(score);
  return (
    <div className="pa-score-section">
      <div className="pa-score-row">
        <span className="pa-score-lbl">Score de pertinence</span>
        <span className="pa-score-val" style={{ color: scoreColor(v) }}>
          {v}/100
        </span>
      </div>
      <div className="pa-score-track">
        <div className="pa-score-fill" style={{ width: `${v}%`, background: scoreColor(v) }} />
      </div>
    </div>
  );
}
ScoreBar.propTypes = { score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) };
ScoreBar.defaultProps = { score: 0 };

function SocialLinks({ website, facebook, instagram, linkedin }) {
  const links = [
    { url: website, icon: "Web", title: "Site web" },
    { url: facebook, icon: "Fb", title: "Facebook" },
    { url: instagram, icon: "Ig", title: "Instagram" },
    { url: linkedin, icon: "In", title: "LinkedIn" },
  ].filter((l) => l.url);
  if (!links.length) return null;
  return (
    <div className="pa-socials">
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="pa-social"
          title={l.title}
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}
SocialLinks.propTypes = {
  website: PropTypes.string,
  facebook: PropTypes.string,
  instagram: PropTypes.string,
  linkedin: PropTypes.string,
};
SocialLinks.defaultProps = { website: "", facebook: "", instagram: "", linkedin: "" };

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`pa-toast ${type}`}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
    </div>
  );
}
Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(["success", "error"]).isRequired,
  onClose: PropTypes.func.isRequired,
};

// ─── CompanyCard avec Maps ───────────────────────────────────────────────────
function CompanyCard({ company, onImport, imported }) {
  const ev = company.evaluation || "cold";
  const fullAddress = [company.adresse, company.ville, company.code_postal, company.pays]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`pa-card ${ev}`}>
      <div className="pa-card-content">
        <div className="pa-card-header">
          <div className="pa-card-title">
            <h3>{company.nom}</h3>
            <div className="pa-card-subtitle">
              {company.categorie || company.secteur}
              {fullAddress && <span>• {company.ville || company.adresse?.split(",")[0]}</span>}
            </div>
          </div>
          <Badge eval={ev} />
        </div>

        {/* Google Maps intégré */}
        <GoogleMapEmbed address={fullAddress} placeName={company.nom} />

        <div className="pa-contacts">
          {company.telephone && (
            <a
              href={`tel:${company.telephone}`}
              className="pa-contact-chip filled"
              style={{ textDecoration: "none" }}
            >
              📞 {company.telephone}
            </a>
          )}
          {company.email && (
            <a
              href={`mailto:${company.email}`}
              className="pa-contact-chip filled"
              style={{ textDecoration: "none" }}
            >
              ✉ {company.email}
            </a>
          )}
          {company.site_web && (
            <a
              href={company.site_web}
              target="_blank"
              rel="noreferrer"
              className="pa-contact-chip filled"
              style={{ textDecoration: "none" }}
            >
              🌐 Site web
            </a>
          )}
          {!company.telephone && !company.email && !company.site_web && (
            <span className="pa-contact-chip">📋 Contact à vérifier</span>
          )}
        </div>

        <ScoreBar score={company.score_ia} />

        <div className="pa-score-reason">Qualification: {leadQuality(company)}</div>

        {company.raison_score && <div className="pa-score-reason">💡 {company.raison_score}</div>}

        <div className="pa-card-footer">
          <SocialLinks
            website={company.site_web}
            facebook={company.facebook_url}
            instagram={company.instagram_url}
            linkedin={company.linkedin_url}
          />
          {company.next_action && <span className="pa-next-action">🎯 {company.next_action}</span>}
          <button
            className={`pa-import-btn ${imported ? "done" : "primary"}`}
            onClick={!imported ? onImport : undefined}
          >
            {imported ? "✓ Importé" : "+ Importer"}
          </button>
        </div>
      </div>
    </div>
  );
}
CompanyCard.propTypes = {
  company: PropTypes.object.isRequired,
  onImport: PropTypes.func.isRequired,
  imported: PropTypes.bool,
};
CompanyCard.defaultProps = { imported: false };

// ─── ProspectCard avec Maps ───────────────────────────────────────────────────
function ProspectCard({ prospect, onImport }) {
  const ev = prospect.evaluation || "cold";
  const name = `${prospect.first_name || ""} ${prospect.last_name || ""}`.trim() || "—";
  const companyName = prospect.prospect_company_name || prospect.company_name || "";
  const fullAddress = [prospect.adresse, prospect.ville, prospect.pays].filter(Boolean).join(", ");

  return (
    <div className={`pa-prospect ${ev}`}>
      <div className="pa-prospect-content">
        <div className="pa-prospect-avatar">{initials(name)}</div>
        <div className="pa-prospect-body">
          <div className="pa-prospect-header">
            <div>
              <div className="pa-prospect-name">{name}</div>
              {(prospect.title || companyName) && (
                <div className="pa-prospect-title">
                  {prospect.title}
                  {prospect.title && companyName && " @ "}
                  {companyName}
                </div>
              )}
            </div>
            <Badge eval={ev} />
          </div>

          <div className="pa-contacts">
            {prospect.email && (
              <a
                href={`mailto:${prospect.email}`}
                className="pa-contact-chip filled"
                style={{ textDecoration: "none" }}
              >
                ✉ {prospect.email}
              </a>
            )}
            {prospect.phone && (
              <a
                href={`tel:${prospect.phone}`}
                className="pa-contact-chip filled"
                style={{ textDecoration: "none" }}
              >
                📞 {prospect.phone}
              </a>
            )}
            {!prospect.email && !prospect.phone && (
              <span className="pa-contact-chip">📋 Contact à vérifier</span>
            )}
          </div>

          {/* Google Maps pour le prospect (adresse de son entreprise) */}
          {fullAddress && <GoogleMapEmbed address={fullAddress} placeName={companyName || name} />}

          <div className="pa-score-reason">Qualification: {leadQuality(prospect)}</div>

          <div className="pa-card-footer" style={{ marginTop: 12, paddingTop: 12 }}>
            <SocialLinks
              linkedin={prospect.linkedin_url}
              facebook={prospect.facebook_url}
              instagram={prospect.instagram_url}
            />
            <button className="pa-import-btn primary" onClick={onImport}>
              + Importer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
ProspectCard.propTypes = {
  prospect: PropTypes.object.isRequired,
  onImport: PropTypes.func.isRequired,
};

// ─── Bloc de résultats inline ────────────────────────────────────────────────
const getResultCompanies = (result) =>
  result?.prospect_companies || result?.entreprises || result?.companies || [];

const getResultProspects = (result) => result?.prospect_persons || result?.prospects || [];

const getResultTotal = (result) =>
  Number(result?.companies_found || 0) + Number(result?.persons_found || 0);

function ResultsBlock({ result, onImport, imported }) {
  const [tab, setTab] = useState("companies");
  const companies = useMemo(() => rankItems(getResultCompanies(result)), [result]);
  const prospects = useMemo(() => rankItems(getResultProspects(result)), [result]);
  const stats = result?.stats || {};
  const importStats = result?.import_stats || {};
  const meta = result?.meta || {};
  const activeTab = companies.length === 0 && prospects.length > 0 ? "prospects" : tab;
  const total = companies.length + prospects.length || getResultTotal(result);
  const technicalDetails = {
    logs: result?.logs || [],
    gemini_decisions: result?.gemini_decisions || [],
    scraping_debug: result?.scraping_debug || [],
    errors: result?.errors || [],
  };
  const hasTechnicalDetails = Object.values(technicalDetails).some((items) => items.length > 0);
  const loginRequired = Boolean(
    result?.logs?.some((item) => item.step === "login_required") ||
      result?.scrape_debug_events?.some((item) => item.requires_login) ||
      result?.errors?.some((item) => item.step === "login_required")
  );
  const loginPlatforms = [
    ...new Set(
      [
        ...(result?.logs || [])
          .filter((item) => item.step === "login_required")
          .map((item) => item.platform),
        ...(result?.scrape_debug_events || [])
          .filter((item) => item.requires_login)
          .map((item) => item.platform),
      ].filter(Boolean)
    ),
  ];

  return (
    <div className="pa-results-block">
      <div className="pa-results-summary">
        <span>
          {total} resultat{total > 1 ? "s" : ""}
        </span>
        {meta.intent_summary && <span> - {meta.intent_summary}</span>}
      </div>

      <div className="pa-stats-chips">
        <span className="pa-chip red">
          {result?.companies_found || companies.length || 0} entreprises
        </span>
        <span className="pa-chip blue">
          {result?.persons_found || prospects.length || 0} personnes
        </span>
        <span className="pa-chip green">{importStats.companies_created || 0} societes creees</span>
        <span className="pa-chip amber">{importStats.companies_updated || 0} societes maj</span>
        <span className="pa-chip green">{importStats.persons_created || 0} prospects crees</span>
        <span className="pa-chip amber">{importStats.persons_updated || 0} prospects maj</span>
        <span className="pa-chip gray">{result?.crawled_pages || 0} pages crawlees</span>
        <span className="pa-chip gray">{result?.rejected_results || 0} rejetes</span>
        {stats.hot > 0 && <span className="pa-chip red">{stats.hot} hot</span>}
        {stats.warm > 0 && <span className="pa-chip amber">{stats.warm} warm</span>}
        {result.execution_time && <span className="pa-chip gray">{result.execution_time}</span>}
      </div>

      {meta.errors?.length > 0 && (
        <div
          style={{
            padding: 12,
            fontSize: 12,
            color: T.amber,
            background: T.amberBg,
            border: "1px solid #FDE68A",
            borderRadius: 10,
          }}
        >
          Certains modeles ou outils etaient indisponibles. L&apos;agent a utilise les fallbacks
          disponibles.
        </div>
      )}

      {loginRequired && (
        <div
          style={{
            padding: 12,
            fontSize: 12,
            color: T.amber,
            background: T.amberBg,
            border: "1px solid #FDE68A",
            borderRadius: 10,
          }}
        >
          Connexion {loginPlatforms.join(", ") || "reseau social"} requise. Utilisez le panneau
          Connexions sociales pour ouvrir la fenetre de connexion, puis cliquez sur Verifier session.
        </div>
      )}

      {companies.length > 0 && prospects.length > 0 && (
        <div className="pa-tabs">
          <button
            className={`pa-tab-btn ${activeTab === "companies" ? "active" : ""}`}
            onClick={() => setTab("companies")}
          >
            Entreprises ({companies.length})
          </button>
          <button
            className={`pa-tab-btn ${activeTab === "prospects" ? "active" : ""}`}
            onClick={() => setTab("prospects")}
          >
            Prospects ({prospects.length})
          </button>
        </div>
      )}

      {activeTab === "companies" &&
        companies.length > 0 &&
        companies.map((c) => {
          const key = c.place_id || c.nom;
          return (
            <CompanyCard
              key={key}
              company={c}
              imported={!!imported[key]}
              onImport={() => onImport(c, prospects)}
            />
          );
        })}

      {activeTab === "prospects" &&
        prospects.length > 0 &&
        prospects.map((p, i) => (
          <ProspectCard
            key={p.linkedin_url || p.instagram_url || p.email || `p-${i}`}
            prospect={p}
            onImport={() => onImport(null, [p])}
          />
        ))}

      {activeTab === "companies" && companies.length === 0 && (
        <div
          style={{
            padding: 20,
            fontSize: 13,
            color: T.textMuted,
            textAlign: "center",
            background: T.surfaceAlt,
            borderRadius: 12,
          }}
        >
          Aucune entreprise trouvee. Essayez une requete avec ville, secteur et source.
        </div>
      )}
      {activeTab === "prospects" && prospects.length === 0 && (
        <div
          style={{
            padding: 20,
            fontSize: 13,
            color: T.textMuted,
            textAlign: "center",
            background: T.surfaceAlt,
            borderRadius: 12,
          }}
        >
          Aucun prospect trouve. Essayez avec un poste precis, par exemple Responsable RH a Tunis
          sur LinkedIn.
        </div>
      )}

      {hasTechnicalDetails && (
        <details
          style={{
            padding: 12,
            background: T.surfaceAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
          }}
        >
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.textSub }}>
            Details techniques
          </summary>
          <pre
            style={{
              marginTop: 12,
              whiteSpace: "pre-wrap",
              fontSize: 11,
              color: T.textSub,
              maxHeight: 260,
              overflow: "auto",
            }}
          >
            {JSON.stringify(technicalDetails, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
ResultsBlock.propTypes = {
  result: PropTypes.object.isRequired,
  onImport: PropTypes.func.isRequired,
  imported: PropTypes.object.isRequired,
};

// ─── Thinking Indicator ───────────────────────────────────────────────────────
function ThinkingIndicator({ step }) {
  return (
    <div className="pa-msg">
      <div className="pa-avatar agent">AI</div>
      <div className="pa-thinking">
        {THINKING_STEPS.map((s, i) => {
          const isDone = i < step;
          const isActive = i === step;
          return (
            <div key={i} className={`pa-log-item ${isActive ? "active" : isDone ? "done" : ""}`}>
              <span className="pa-log-icon">
                {isDone ? "✓" : isActive ? <span className="pa-spinner-sm" /> : s.icon}
              </span>
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
ThinkingIndicator.propTypes = { step: PropTypes.number.isRequired };

// ─── Sidebar stats simplifiée ─────────────────────────────────────────────────
function Sidebar({ lastResult, sessionCount }) {
  const stats = lastResult?.stats || {};
  const importStats = lastResult?.import_stats || {};
  const totalResults =
    getResultTotal(lastResult) ||
    getResultCompanies(lastResult).length + getResultProspects(lastResult).length;

  return (
    <aside className="pa-sidebar">
      {/* Statistiques de recherche */}
      <div className="pa-sidebar-section">
        <div className="pa-sidebar-title">📊 Statistiques</div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Recherches effectuées</span>
          <span className="pa-stat-val blue">{sessionCount}</span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Derniers résultats</span>
          <span className="pa-stat-val red">{totalResults}</span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Societes creees/maj</span>
          <span className="pa-stat-val green">
            {(importStats.companies_created || 0) + (importStats.companies_updated || 0)}
          </span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Prospects crees/maj</span>
          <span className="pa-stat-val green">
            {(importStats.persons_created || 0) + (importStats.persons_updated || 0)}
          </span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Hot leads</span>
          <span className="pa-stat-val red">{stats.hot || 0}</span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Warm leads</span>
          <span className="pa-stat-val amber">{stats.warm || 0}</span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Avec téléphone</span>
          <span className="pa-stat-val green">{stats.avec_tel || 0}</span>
        </div>
        <div className="pa-stat-row">
          <span className="pa-stat-lbl">Avec email</span>
          <span className="pa-stat-val green">{stats.avec_email || 0}</span>
        </div>
      </div>

      {/* Outils utilisés */}
      {lastResult?.meta?.tools_used?.length > 0 && (
        <div className="pa-sidebar-section">
          <div className="pa-sidebar-title">⚙️ Outils utilisés</div>
          {(lastResult.meta.tools_used || []).map((tool, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: T.textSub,
                padding: "6px 0",
                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🔧</span> {tool}
            </div>
          ))}
        </div>
      )}

      {/* Dernière recherche */}
      {lastResult && (
        <div className="pa-sidebar-section">
          <div className="pa-sidebar-title">🕐 Dernière recherche</div>
          <div className="pa-stat-row">
            <span className="pa-stat-lbl">Temps execution</span>
            <span className="pa-stat-val">{lastResult.execution_time || "—"}</span>
          </div>
          <div className="pa-stat-row">
            <span className="pa-stat-lbl">Sources actives</span>
            <span className="pa-stat-val green">
              {lastResult?.meta?.executed_sources?.length || 0}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
Sidebar.propTypes = {
  lastResult: PropTypes.object,
  sessionCount: PropTypes.number.isRequired,
};
Sidebar.defaultProps = { lastResult: null };

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ProspectAgent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkStep, setThinkStep] = useState(0);
  const [imported, setImported] = useState({});
  const [toast, setToast] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [socialSessions, setSocialSessions] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const thinkTimerRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  // Animation du thinking
  const startThinking = useCallback(() => {
    setThinkStep(0);
    let step = 0;
    thinkTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, THINKING_STEPS.length - 1);
      setThinkStep(step);
    }, 2800);
  }, []);

  const stopThinking = useCallback(() => {
    clearInterval(thinkTimerRef.current);
  }, []);

  const requiredSocialPlatforms = useMemo(() => {
    const query = input.toLowerCase();
    const required = [];
    if (query.includes("linkedin")) required.push("linkedin");
    if (query.includes("facebook")) required.push("facebook");
    if (query.includes("instagram")) required.push("instagram");
    return required.length ? required : ["linkedin"];
  }, [input]);

  const missingRequiredPlatforms = useCallback(
    (queryText) => {
      const query = (queryText || input).toLowerCase();
      const required = [];
      if (query.includes("linkedin")) required.push("linkedin");
      if (query.includes("facebook")) required.push("facebook");
      if (query.includes("instagram")) required.push("instagram");
      const platforms = required.length ? required : ["linkedin"];
      return platforms.filter((platform) => !isSessionReady(socialSessions?.[platform]));
    },
    [input, socialSessions]
  );

  // Envoi d'une requête
  const handleSend = useCallback(
    async (queryText) => {
      const text = (queryText || input).trim();
      if (!text || loading) return;

      const missing = missingRequiredPlatforms(text);
      if (missing.length > 0) {
        notify(`Connectez d'abord : ${missing.join(", ")}`, "error");
        return;
      }

      setInput("");

      // Ajouter message utilisateur
      const userMsg = { type: "user", content: text, id: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      startThinking();

      try {
        const result = await searchProspectsAgent({ query: text });
        stopThinking();

        const companies = getResultCompanies(result);
        const prospects = getResultProspects(result);
        const total = companies.length + prospects.length || getResultTotal(result);

        // Message agent avec résultats
        const agentMsg = {
          type: "agent",
          id: Date.now() + 1,
          text:
            total > 0
              ? `✅ J'ai trouvé ${total} résultat${total > 1 ? "s" : ""} pour "${text}".`
              : `🔍 Aucun résultat trouvé pour "${text}". Essayez une requête plus précise.`,
          result,
        };

        setMessages((prev) => [...prev, agentMsg]);
        setLastResult(result);
        setSessionCount((c) => c + 1);

        if (total > 0)
          notify(
            `${total} résultat${total > 1 ? "s" : ""} trouvé${total > 1 ? "s" : ""}`,
            "success"
          );
      } catch (err) {
        stopThinking();
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            id: Date.now() + 1,
            text: `❌ Erreur : ${err.message}`,
            isError: true,
          },
        ]);
        notify(err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, missingRequiredPlatforms, startThinking, stopThinking, notify]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleImport = useCallback(
    async (company, prospects) => {
      const companyData = company || {
        nom: prospects[0]?.prospect_company_name || "Entreprise inconnue",
        evaluation: prospects[0]?.evaluation,
        place_id: prospects[0]?.place_id,
      };
      try {
        await importProspectionResult({ company: companyData, prospects: prospects || [] });
        const key = companyData.place_id || companyData.nom;
        setImported((prev) => ({ ...prev, [key]: true }));
        notify(`${companyData.nom} importé dans le CRM`, "success");
      } catch (err) {
        notify(err.message, "error");
      }
    },
    [notify]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setLastResult(null);
    setImported({});
  }, []);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <div className="pa-root">
        <div className="pa-layout">
          {/* ── Colonne chat ── */}
          <div className="pa-chat-col">
            {/* Header */}
            <div className="pa-chat-header">
              <div className="pa-agent-badge">
                <div className="pa-agent-dot" />
                <span className="pa-agent-label">Agent de prospection</span>
              </div>
              {messages.length > 0 && (
                <button className="pa-clear-btn" onClick={handleClear}>
                  ✨ Nouvelle conversation
                </button>
              )}
            </div>

            <div style={{ padding: "16px 24px", background: T.white, borderBottom: `1px solid ${T.border}` }}>
              <SocialConnectionBox
                title="Connexions requises pour l'agent de prospection"
                requiredPlatforms={requiredSocialPlatforms}
                compact
                onStatusChange={setSocialSessions}
              />
              {missingRequiredPlatforms().length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #FDE68A",
                    background: "#FFFBEB",
                    color: "#92400E",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 13,
                  }}
                >
                  Connectez les plateformes suivantes avant de lancer l&apos;agent :{" "}
                  {missingRequiredPlatforms().join(", ")}
                </div>
              )}
            </div>

            {/* Zone messages */}
            <div className="pa-messages">
              {isEmpty ? (
                <div className="pa-empty">
                  <div className="pa-empty-icon">🎯</div>
                  <div className="pa-empty-title">Agent de prospection</div>
                  <div className="pa-empty-sub">
                    Décrivez ce que vous cherchez en langage naturel.
                    <br />
                    L&apos;agent choisit automatiquement les meilleures sources.
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.type === "user" ? (
                      <div className="pa-msg user">
                        <div className="pa-avatar user">👤</div>
                        <div className="pa-bubble user">{msg.content}</div>
                      </div>
                    ) : (
                      <div className="pa-msg">
                        <div className="pa-avatar agent">AI</div>
                        <div style={{ flex: 1, maxWidth: "80%" }}>
                          <div
                            className="pa-bubble agent"
                            style={{
                              borderColor: msg.isError ? "#FECACA" : undefined,
                              background: msg.isError ? "#FFF5F5" : undefined,
                              color: msg.isError ? T.red : undefined,
                              maxWidth: "none",
                            }}
                          >
                            {msg.text}
                          </div>
                          {msg.result && (
                            <div style={{ marginTop: 16 }}>
                              <ResultsBlock
                                result={msg.result}
                                onImport={handleImport}
                                imported={imported}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Thinking en cours */}
              {loading && <ThinkingIndicator step={thinkStep} />}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions (état vide seulement) */}
            {isEmpty && (
              <div className="pa-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="pa-suggestion" onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="pa-input-zone">
              <div className="pa-input-row">
                <textarea
                  ref={textareaRef}
                  className="pa-textarea"
                  placeholder="Ex: restaurants a Tunis avec telephone, responsables RH IT sur LinkedIn..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={loading}
                />
                <button
                  className="pa-send-btn"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  title="Envoyer (Entrée)"
                >
                  {loading ? (
                    <span
                      className="pa-spinner-sm"
                      style={{ borderColor: "#fff5", borderTopColor: "#fff" }}
                    />
                  ) : (
                    "↑"
                  )}
                </button>
              </div>
              <p className="pa-input-hint">⏎ Entrée pour envoyer · ⇧ Entrée pour nouvelle ligne</p>
            </div>
          </div>

          {/* ── Sidebar stats simplifiée ── */}
          <Sidebar lastResult={lastResult} sessionCount={sessionCount} />
        </div>

        {/* Toast */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </DashboardLayout>
  );
}
