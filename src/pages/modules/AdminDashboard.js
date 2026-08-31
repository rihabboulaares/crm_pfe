/* eslint-disable prettier/prettier */
// src/pages/modules/AdminDashboard.jsx  — v4 Pipedrive CRM Pro

import React, { useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  Grid,
  Typography,
  Box,
  Stack,
  Avatar,
  Chip,
  Divider,
  LinearProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Alert,
  Tooltip,
} from "@mui/material";
import {
  PersonAdd,
  Contacts,
  AttachMoney,
  CheckCircle,
  People,
  TrendingUp,
  TrendingDown,
  Warning,
  EmojiEvents,
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  Phone,
  Email,
  Groups,
  Add,
  Send as SendIcon,
  RateReview,
  Refresh,
  ArrowUpward,
  ArrowDownward,
  Circle,
  FiberManualRecord,
  ExpandMore,
  ExpandLess,
  LocationOn,
  NotificationsActive,
  CalendarToday,
  FlashOn,
  Public,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTip,
  ResponsiveContainer,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

import {
  C,
  GRAD,
  SHADOW,
  fadeUp,
  scaleIn,
  pulseRed,
  sweepBar,
  Card,
  KpiCard,
  HeroBanner,
  PrimaryBtn,
  GhostBtn,
  TabPill,
  StatusBadge,
  Skeleton,
  COLORS,
  STAGE_LABELS,
  STAGE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  TooltipBox,
  toList,
  fmtDate,
  isOverdue,
  isToday,
  getInit,
  monthLabel,
  scoreColor,
} from "./theme";

import { ScoreRing, AlertRow, PerfSkeleton } from "./PerformanceWidgets";
import { useTeamKPI, useAlerts, useLeaderboard, perfApi } from "../../hooks/usePerformance";
import { FeedbackButton, useTrackActivity } from "../superadmin/Marketingwidgets";
import DashboardDataFrame, { useOfficialDashboardData } from "./DashboardDataFrame";

// ─── FONCTION LOCALE POUR FORMATER EN DINAR TUNISIEN ────────────────
const fmtTND = (n) => {
  if (n == null) return "—";
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return formatter.format(n);
};

// ─── COMPOSANT : JAUGE KPI ANIMÉE ────────────────────────────────
function KpiGauge({ value = 0, color = C.red, size = 110, label = "Score" }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const offset = arcLen - (Math.min(100, value) / 100) * arcLen;
  const col = scoreColor(value);

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={alpha(col, 0.12)}
          strokeWidth={10}
          strokeDasharray={`${arcLen} ${circ}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={10}
          strokeDasharray={`${arcLen - offset} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          sx={{ fontSize: size > 90 ? 22 : 16, fontWeight: 900, color: col, lineHeight: 1 }}
        >
          {Math.round(value)}%
        </Typography>
        <Typography sx={{ fontSize: 10, color: C.n400, mt: 0.3 }}>{label}</Typography>
      </Box>
    </Box>
  );
}
KpiGauge.propTypes = {
  value: PropTypes.number,
  color: PropTypes.string,
  size: PropTypes.number,
  label: PropTypes.string,
};

// ─── COMPOSANT : FUNNEL DE CONVERSION ─────────────────────────────
function ConversionFunnel({ opportunities = [] }) {
  const stages = ["new", "qualified", "proposal", "negotiation", "won"];
  const counts = stages.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s],
    count: opportunities.filter((o) => o.stage === s).length,
    color: STAGE_COLORS[s],
    amount: opportunities
      .filter((o) => o.stage === s)
      .reduce((a, o) => a + parseFloat(o.amount || 0), 0),
  }));
  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return (
    <Box>
      <Stack spacing={1}>
        {counts.map((c, i) => {
          const pct = Math.round((c.count / maxCount) * 100);
          const conv =
            i > 0 && counts[i - 1].count > 0
              ? Math.round((c.count / counts[i - 1].count) * 100)
              : null;
          return (
            <Box key={c.stage}>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={0.6}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: c.color,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n700, minWidth: 90 }}>
                  {c.label}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    height: 28,
                    bgcolor: alpha(c.color, 0.08),
                    borderRadius: 6,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      bgcolor: c.color,
                      borderRadius: 6,
                      opacity: 0.85,
                      width: `${pct}%`,
                      animation: `${sweepBar} 1s cubic-bezier(.4,0,.2,1) forwards`,
                      display: "flex",
                      alignItems: "center",
                      px: 1,
                    }}
                  >
                    {pct > 20 && (
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                        {c.count}
                      </Typography>
                    )}
                  </Box>
                  {pct <= 20 && (
                    <Typography
                      sx={{
                        position: "absolute",
                        left: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: c.color,
                      }}
                    >
                      {c.count}
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: 11, color: C.n500, minWidth: 80, textAlign: "right" }}>
                  {fmtTND(c.amount)}
                </Typography>
                {conv !== null && (
                  <Box sx={{ minWidth: 38, textAlign: "right" }}>
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: conv >= 50 ? C.green : conv >= 25 ? C.amber : C.red,
                      }}
                    >
                      {conv}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="flex-end" mt={1}>
        <Typography sx={{ fontSize: 10, color: C.n400 }}>taux de conversion par étape</Typography>
      </Stack>
    </Box>
  );
}
ConversionFunnel.propTypes = { opportunities: PropTypes.array };
ConversionFunnel.defaultProps = { opportunities: [] };

// ─── COMPOSANT : TIMELINE D'ACTIVITÉ ─────────────────────────────
function ActivityTimeline({ tasks = [], prospects = [], opportunities = [] }) {
  const events = [
    ...tasks.slice(0, 4).map((t) => ({
      id: `t-${t.id}`,
      type: "task",
      icon: <CheckCircle />,
      color: isOverdue(t) ? C.red : STATUS_COLORS[t.status] || C.n400,
      title: t.title,
      sub: `${t.assigned_to_detail?.username || "—"} · ${fmtDate(t.due_date)}`,
      badge: isOverdue(t) ? "retard" : STATUS_LABELS[t.status],
      badgeS: isOverdue(t) ? "cancelled" : t.status,
      time: t.created_at,
    })),
    ...prospects.slice(0, 3).map((p) => ({
      id: `p-${p.id}`,
      type: "prospect",
      icon: <PersonAdd />,
      color: C.blue,
      title: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email,
      sub: p.email,
      badge: p.status,
      badgeS: p.status,
      time: p.created_at,
    })),
    ...opportunities.slice(0, 3).map((o) => ({
      id: `o-${o.id}`,
      type: "deal",
      icon: <AttachMoney />,
      color: STAGE_COLORS[o.stage] || C.amber,
      title: o.name || o.title || "Opportunité",
      sub: fmtTND(parseFloat(o.amount || 0)),
      badge: STAGE_LABELS[o.stage] || o.stage,
      badgeS: o.stage,
      time: o.created_at,
    })),
  ]
    .filter((e) => e.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 8);

  if (!events.length)
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography sx={{ fontSize: 13, color: C.n400 }}>Aucune activité récente</Typography>
      </Box>
    );

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          position: "absolute",
          left: 15,
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: alpha(C.red, 0.1),
          borderRadius: 1,
        }}
      />
      <Stack spacing={0}>
        {events.map((e, i) => (
          <Box key={e.id} sx={{ display: "flex", gap: 2, pb: i < events.length - 1 ? 2 : 0 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                flexShrink: 0,
                bgcolor: alpha(e.color, 0.1),
                border: `2px solid ${alpha(e.color, 0.25)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                position: "relative",
              }}
            >
              {React.cloneElement(e.icon, { sx: { fontSize: 14, color: e.color } })}
            </Box>
            <Box sx={{ flex: 1, pt: 0.3 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box>
                  <Typography
                    sx={{ fontSize: 12, fontWeight: 600, color: C.n800, lineHeight: 1.3 }}
                  >
                    {e.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: C.n400, mt: 0.2 }}>{e.sub}</Typography>
                </Box>
                <StatusBadge s={e.badgeS} sx={{ flexShrink: 0, mt: 0.2 }}>
                  {e.badge}
                </StatusBadge>
              </Stack>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
ActivityTimeline.propTypes = {
  tasks: PropTypes.array,
  prospects: PropTypes.array,
  opportunities: PropTypes.array,
};
ActivityTimeline.defaultProps = { tasks: [], prospects: [], opportunities: [] };

// ─── GOOGLE MAPS HELPERS ─────────────────────────────────────────────
const getGoogleMapsApiKey = () => {
  // Create React App lit uniquement les variables qui commencent par REACT_APP_
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
};

let googleMapsLoaderPromise = null;
const loadGoogleMapsScript = (apiKey) => {
  if (typeof window === "undefined") return Promise.reject(new Error("window indisponible"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!apiKey) return Promise.reject(new Error("GOOGLE_MAPS_API_KEY manquante"));
  if (googleMapsLoaderPromise) return googleMapsLoaderPromise;

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    window.gm_authFailure = () => {
      googleMapsLoaderPromise = null;
      reject(new Error("Clé Google Maps invalide ou projet Google supprimé"));
    };

    const existing = document.querySelector('script[data-google-maps="crm-dashboard"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", () =>
        reject(new Error("Chargement Google Maps impossible"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "crm-dashboard";
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Chargement Google Maps impossible"));
    document.head.appendChild(script);
  });

  return googleMapsLoaderPromise;
};

const TUNISIA_CITY_COORDS = {
  tunis: { lat: 36.8065, lng: 10.1815 },
  ariana: { lat: 36.8665, lng: 10.1647 },
  ben_arous: { lat: 36.7468, lng: 10.2319 },
  manouba: { lat: 36.808, lng: 10.0972 },
  nabeul: { lat: 36.4561, lng: 10.7376 },
  hammamet: { lat: 36.4, lng: 10.6167 },
  sousse: { lat: 35.8256, lng: 10.63699 },
  monastir: { lat: 35.7643, lng: 10.8113 },
  mahdia: { lat: 35.5047, lng: 11.0622 },
  sfax: { lat: 34.7406, lng: 10.7603 },
  gabes: { lat: 33.8815, lng: 10.0982 },
  medenine: { lat: 33.3549, lng: 10.5055 },
  djerba: { lat: 33.8076, lng: 10.8451 },
  tataouine: { lat: 32.9297, lng: 10.4518 },
  kairouan: { lat: 35.6781, lng: 10.0963 },
  kasserine: { lat: 35.1676, lng: 8.8365 },
  sidi_bouzid: { lat: 35.0382, lng: 9.4849 },
  gafsa: { lat: 34.425, lng: 8.7842 },
  tozeur: { lat: 33.9197, lng: 8.1335 },
  kebili: { lat: 33.705, lng: 8.965 },
  beja: { lat: 36.7256, lng: 9.1817 },
  jendouba: { lat: 36.5011, lng: 8.7802 },
  kef: { lat: 36.1742, lng: 8.7049 },
  siliana: { lat: 36.0833, lng: 9.3667 },
  bizerte: { lat: 37.2744, lng: 9.8739 },
  zaghouan: { lat: 36.4029, lng: 10.1429 },
};

const normalizeLocationKey = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const getProspectName = (p) =>
  p.name ||
  p.full_name ||
  `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
  p.company_name ||
  p.email ||
  `Prospect #${p.id || ""}`;

const parseCoordinate = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const getProspectCoordinates = (p) => {
  const lat = parseCoordinate(p.latitude ?? p.lat ?? p.location_latitude);
  const lng = parseCoordinate(p.longitude ?? p.lng ?? p.location_longitude);
  if (lat !== null && lng !== null) return { lat, lng, source: "exact" };

  const cityKey = normalizeLocationKey(p.city || p.ville || p.region || p.country || "");
  if (cityKey && TUNISIA_CITY_COORDS[cityKey]) {
    return { ...TUNISIA_CITY_COORDS[cityKey], source: "city" };
  }

  return null;
};

// ─── COMPOSANT : CARTE GÉOGRAPHIQUE GOOGLE MAPS ────────────────────────────
function GeoProspects({ prospects = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");

  const apiKey = getGoogleMapsApiKey();

  const geoProspects = prospects
    .map((p) => ({ ...p, coordinates: getProspectCoordinates(p) }))
    .filter((p) => p.coordinates);

  const missingLocation = prospects.length - geoProspects.length;

  const cityStats = geoProspects.reduce((acc, p) => {
    const city = p.city || p.ville || p.region || p.country || "Localisation détectée";
    if (!acc[city]) {
      acc[city] = { city, count: 0, prospects: [], color: C.red };
    }
    acc[city].count += 1;
    acc[city].prospects.push(p);
    return acc;
  }, {});

  const cities = Object.values(cityStats).sort((a, b) => b.count - a.count);
  const visibleProspects =
    selectedCity === "all"
      ? geoProspects
      : geoProspects.filter(
          (p) =>
            (p.city || p.ville || p.region || p.country || "Localisation détectée") === selectedCity
        );

  useEffect(() => {
    if (!prospects.length) return;
    if (!apiKey) {
      setMapError(
        "Ajoute REACT_APP_GOOGLE_MAPS_API_KEY dans le fichier .env du frontend pour afficher Google Maps."
      );
      return;
    }

    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled) {
          setMapsReady(true);
          setMapError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message || "Google Maps indisponible");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, prospects.length]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !window.google?.maps) return;

    try {
      const googleMaps = window.google.maps;
      const defaultCenter = { lat: 34.0, lng: 9.5 };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new googleMaps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: 6,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        infoWindowRef.current = new googleMaps.InfoWindow();
      }

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      if (!visibleProspects.length) return;

      const bounds = new googleMaps.LatLngBounds();

      visibleProspects.forEach((p) => {
        const position = { lat: p.coordinates.lat, lng: p.coordinates.lng };
        const title = getProspectName(p);
        const marker = new googleMaps.Marker({
          position,
          map: mapInstanceRef.current,
          title,
          animation: googleMaps.Animation.DROP,
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            fillColor: p.coordinates.source === "exact" ? C.red : C.blue,
            fillOpacity: 0.95,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: p.coordinates.source === "exact" ? 8 : 7,
          },
        });

        marker.addListener("click", () => {
          const source = p.source || p.origin || p.channel || "Non précisée";
          const score = p.ai_score ?? p.score ?? p.relevance ?? null;
          const city = p.city || p.ville || p.region || p.country || "—";
          const owner =
            p.assigned_to_detail?.username || p.owner?.username || p.created_by_name || "—";

          infoWindowRef.current.setContent(`
          <div style="min-width:220px;font-family:Arial,sans-serif">
            <div style="font-weight:800;font-size:14px;color:#111827;margin-bottom:6px">${title}</div>
            <div style="font-size:12px;color:#4b5563;margin-bottom:4px"><b>Ville :</b> ${city}</div>
            <div style="font-size:12px;color:#4b5563;margin-bottom:4px"><b>Source :</b> ${source}</div>
            <div style="font-size:12px;color:#4b5563;margin-bottom:4px"><b>Commercial :</b> ${owner}</div>
            ${
              score !== null
                ? `<div style="font-size:12px;color:#4b5563;margin-bottom:4px"><b>Score IA :</b> ${Math.round(
                    score
                  )}%</div>`
                : ""
            }
            <div style="font-size:11px;color:${
              p.coordinates.source === "exact" ? "#16a34a" : "#2563eb"
            };margin-top:6px">
              ${
                p.coordinates.source === "exact"
                  ? "Coordonnées exactes"
                  : "Position estimée depuis la ville"
              }
            </div>
          </div>
        `);
          infoWindowRef.current.open({ anchor: marker, map: mapInstanceRef.current });
        });

        markersRef.current.push(marker);
        bounds.extend(position);
      });

      mapInstanceRef.current.fitBounds(bounds);
      if (visibleProspects.length === 1) {
        mapInstanceRef.current.setZoom(13);
      }
    } catch (error) {
      setMapError(error.message || "Google Maps indisponible");
      setMapsReady(false);
    }
  }, [mapsReady, visibleProspects]);

  if (!prospects.length) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Public sx={{ fontSize: 48, color: C.n300, mb: 2 }} />
        <Typography sx={{ fontSize: 13, color: C.n400 }}>Pas de données géographiques</Typography>
        <Typography sx={{ fontSize: 11, color: C.n400, mt: 0.5 }}>
          Ajoutez ville, pays, latitude ou longitude aux prospects.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1.5}>
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.n800 }}>
            Google Maps CRM
          </Typography>
          <Typography sx={{ fontSize: 10.5, color: C.n400 }}>
            {geoProspects.length} prospects localisés · {missingLocation} sans coordonnées
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 145 }}>
          <Select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            sx={{ borderRadius: 2, fontSize: 12, height: 34 }}
          >
            <MenuItem value="all">Toutes les villes</MenuItem>
            {cities.map((c) => (
              <MenuItem key={c.city} value={c.city}>
                {c.city} ({c.count})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {mapError ? (
        <Alert severity="warning" sx={{ borderRadius: 2, mb: 1.5, fontSize: 12 }}>
          {mapError}
        </Alert>
      ) : null}

      <Box
        ref={mapRef}
        sx={{
          width: "100%",
          height: 370,
          borderRadius: 3,
          overflow: "hidden",
          border: `1px solid ${alpha(C.n400, 0.15)}`,
          bgcolor: alpha(C.blue, 0.04),
          position: "relative",
        }}
      >
        {!mapError && !mapsReady && (
          <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }} spacing={1}>
            <LinearProgress sx={{ width: 170, borderRadius: 5 }} />
            <Typography sx={{ fontSize: 12, color: C.n400 }}>Chargement Google Maps...</Typography>
          </Stack>
        )}
        {mapError && (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ height: "100%", p: 3, textAlign: "center" }}
            spacing={1}
          >
            <LocationOn sx={{ fontSize: 42, color: C.amber }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n700 }}>
              Google Maps n&apos;est pas encore configuré
            </Typography>
            <Typography sx={{ fontSize: 11, color: C.n400 }}>
              Mets la clé dans <b>.env</b> puis redémarre le frontend.
            </Typography>
          </Stack>
        )}
      </Box>

      <Stack spacing={1.1} sx={{ mt: 1.5 }}>
        {cities.slice(0, 5).map((city) => {
          const pct = Math.round((city.count / Math.max(geoProspects.length, 1)) * 100);
          const active = selectedCity === city.city;
          return (
            <Box
              key={city.city}
              onClick={() => setSelectedCity(active ? "all" : city.city)}
              sx={{
                p: 1,
                borderRadius: 2,
                cursor: "pointer",
                bgcolor: active ? alpha(C.red, 0.08) : alpha(C.n400, 0.04),
                border: `1px solid ${active ? alpha(C.red, 0.2) : alpha(C.n400, 0.08)}`,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Stack direction="row" alignItems="center" spacing={0.8}>
                  <LocationOn sx={{ fontSize: 14, color: active ? C.red : C.n500 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n700 }}>
                    {city.city}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: active ? C.red : C.n500 }}>
                  {city.count} · {pct}%
                </Typography>
              </Stack>
              <Box
                sx={{
                  height: 5,
                  borderRadius: 8,
                  bgcolor: alpha(C.n400, 0.12),
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 8,
                    bgcolor: active ? C.red : C.blue,
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Stack>

      {missingLocation > 0 && (
        <Paper
          elevation={0}
          sx={{
            mt: 1.5,
            p: 1.2,
            borderRadius: 2,
            bgcolor: alpha(C.amber, 0.06),
            border: `1px solid ${alpha(C.amber, 0.18)}`,
          }}
        >
          <Typography sx={{ fontSize: 11, color: C.n600 }}>
            {missingLocation} prospects ne sont pas affichés sur la carte. Ajoute <b>latitude</b> et{" "}
            <b>longitude</b>, ou au minimum une ville tunisienne connue.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
GeoProspects.propTypes = { prospects: PropTypes.array };
GeoProspects.defaultProps = { prospects: [] };

// ─── COMPOSANT : SCORE KPI TEAM CARD ─────────────────────────────
function TeamScoreCard({ leaderboard = [] }) {
  const avgScore = leaderboard.length
    ? Math.round(leaderboard.reduce((s, e) => s + e.score, 0) / leaderboard.length)
    : 0;
  const top3 = leaderboard.slice(0, 3);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
        <KpiGauge value={avgScore} size={100} label="Équipe" />
        <Stack spacing={1} flex={1} ml={2.5}>
          {[
            {
              label: "Score moyen",
              value: `${Math.round(avgScore)}%`,
              color: scoreColor(avgScore),
            },
            { label: "Commerciaux", value: leaderboard.length, color: C.blue },
            {
              label: "En difficulté",
              value: leaderboard.filter((e) => e.score < 70).length,
              color: C.red,
            },
          ].map((s) => (
            <Stack key={s.label} direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 11, color: C.n500 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: s.color }}>
                {s.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
      {top3.length > 0 && (
        <Box>
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 700,
              color: C.n400,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              mb: 1.2,
            }}
          >
            Top performers
          </Typography>
          <Stack spacing={1}>
            {top3.map((e, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const col = scoreColor(e.score);
              return (
                <Stack key={e.user_id} direction="row" alignItems="center" spacing={1.2}>
                  <Typography sx={{ fontSize: 15, lineHeight: 1 }}>{medals[i]}</Typography>
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: alpha(col, 0.15),
                      color: col,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {getInit(e.username)}
                  </Avatar>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n800, flex: 1 }}>
                    {e.username}
                  </Typography>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: 8,
                      bgcolor: alpha(col, 0.1),
                      border: `1px solid ${alpha(col, 0.2)}`,
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: col }}>
                      {Math.round(e.score)}%
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
TeamScoreCard.propTypes = { leaderboard: PropTypes.array };
TeamScoreCard.defaultProps = { leaderboard: [] };

// ─── COMPOSANT : CENTRE IA CRM ────────────────────────────────────────────
function AiCenter({ data = {}, prospects = [], opportunities = [], tasks = [] }) {
  const aiStats = data.ai_stats || data.agents || data.agent_stats || {};

  const isAiProspect = (p) => {
    const raw = `${p.source || ""} ${p.origin || ""} ${p.created_by_type || ""} ${
      p.created_by || ""
    }`.toLowerCase();
    return (
      raw.includes("ia") ||
      raw.includes("ai") ||
      raw.includes("agent") ||
      raw.includes("prospection")
    );
  };

  const aiProspects = prospects.filter(isAiProspect);
  const qualifiedProspects = prospects.filter((p) => {
    const s = `${p.status || ""} ${p.qualification_status || ""}`.toLowerCase();
    const score = Number(p.score || p.ai_score || p.relevance || 0);
    return s.includes("qualified") || s.includes("qualifié") || score >= 70;
  });
  const messagesReady = prospects.filter((p) =>
    `${p.engagement_status || p.status || ""}`.toLowerCase().includes("message_ready")
  );
  const repliedProspects = prospects.filter((p) =>
    `${p.engagement_status || p.status || ""}`.toLowerCase().includes("replied")
  );

  const cards = [
    {
      label: "Prospects IA",
      value: aiStats.prospects_found ?? aiStats.prospects_detected ?? aiProspects.length,
      sub: `${aiStats.prospects_imported ?? aiProspects.length} importés CRM`,
      color: C.red,
      icon: <FlashOn />,
    },
    {
      label: "Messages générés",
      value: aiStats.messages_generated ?? messagesReady.length,
      sub: `${aiStats.messages_sent ?? 0} envoyés`,
      color: C.blue,
      icon: <SendIcon />,
    },
    {
      label: "Réponses détectées",
      value: aiStats.replies_detected ?? repliedProspects.length,
      sub: "à traiter par commercial",
      color: C.green,
      icon: <Email />,
    },
    {
      label: "Qualification IA",
      value: `${Math.round(
        aiStats.qualification_rate ??
          (prospects.length ? (qualifiedProspects.length / prospects.length) * 100 : 0)
      )}%`,
      sub: `${qualifiedProspects.length} prospects qualifiés`,
      color: C.purple,
      icon: <EmojiEvents />,
    },
  ];

  return (
    <Card accent={C.red}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 8, height: 24, bgcolor: C.red, borderRadius: 2 }} />
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: C.n800 }}>
              Centre IA CRM
            </Typography>
            <Typography sx={{ fontSize: 11, color: C.n400 }}>
              Supervision agent de prospection et agent d&apos;engagement
            </Typography>
          </Box>
        </Stack>
        <Chip
          size="small"
          icon={
            <FiberManualRecord
              sx={{ fontSize: "10px !important", color: `${C.green} !important` }}
            />
          }
          label="Actif"
          sx={{ bgcolor: alpha(C.green, 0.1), color: C.green, fontSize: 11, fontWeight: 700 }}
        />
      </Stack>
      <Grid container spacing={1.5}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: alpha(c.color, 0.045),
                border: `1px solid ${alpha(c.color, 0.16)}`,
                minHeight: 118,
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box>
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: C.n400,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                    }}
                  >
                    {c.label}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 28, fontWeight: 900, color: c.color, lineHeight: 1.1, mt: 0.7 }}
                  >
                    {c.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: C.n500, mt: 0.6 }}>{c.sub}</Typography>
                </Box>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    bgcolor: alpha(c.color, 0.13),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {React.cloneElement(c.icon, { sx: { fontSize: 20, color: c.color } })}
                </Box>
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Card>
  );
}
AiCenter.propTypes = {
  data: PropTypes.object,
  prospects: PropTypes.array,
  opportunities: PropTypes.array,
  tasks: PropTypes.array,
};
AiCenter.defaultProps = { data: {}, prospects: [], opportunities: [], tasks: [] };

// ─── COMPOSANT : SOURCES DES PROSPECTS ────────────────────────────────────
function SourceDistribution({ prospects = [] }) {
  const sourceColor = {
    "google maps": C.green,
    maps: C.green,
    linkedin: C.blue,
    instagram: C.purple,
    facebook: C.blue,
    web: C.amber,
    website: C.amber,
    manuel: C.n500,
    manual: C.n500,
    autre: C.n400,
  };

  const normalizeSource = (value) => {
    const v = `${value || "Autre"}`.toLowerCase();
    if (v.includes("map") || v.includes("google")) return "Google Maps";
    if (v.includes("linkedin")) return "LinkedIn";
    if (v.includes("instagram")) return "Instagram";
    if (v.includes("facebook")) return "Facebook";
    if (v.includes("web") || v.includes("site")) return "Web";
    if (v.includes("manual") || v.includes("manuel")) return "Manuel";
    return "Autre";
  };

  const data = Object.values(
    prospects.reduce((acc, p) => {
      const name = normalizeSource(p.source || p.origin || p.channel);
      if (!acc[name])
        acc[name] = { name, value: 0, color: sourceColor[name.toLowerCase()] || C.n400 };
      acc[name].value += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  if (!data.length) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Public sx={{ fontSize: 42, color: C.n300, mb: 1 }} />
        <Typography sx={{ fontSize: 12, color: C.n400 }}>Aucune source détectée</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={76}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <ReTip content={<TooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <Stack spacing={0.8}>
        {data.slice(0, 6).map((s) => (
          <Stack key={s.name} direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: s.color }} />
              <Typography sx={{ fontSize: 12, color: C.n700, fontWeight: 600 }}>
                {s.name}
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 12, color: s.color, fontWeight: 800 }}>
              {s.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
SourceDistribution.propTypes = { prospects: PropTypes.array };
SourceDistribution.defaultProps = { prospects: [] };

// ─── COMPOSANT : PRÉVISION CA ─────────────────────────────────────────────
function RevenueForecast({ opportunities = [] }) {
  const probability = {
    new: 0.1,
    qualified: 0.25,
    proposal: 0.45,
    negotiation: 0.7,
    won: 1,
    lost: 0,
  };
  const total = opportunities.reduce((s, o) => s + Number(o.amount || 0), 0);
  const forecast = opportunities.reduce(
    (s, o) => s + Number(o.amount || 0) * (probability[o.stage] ?? 0.25),
    0
  );
  const won = opportunities
    .filter((o) => o.stage === "won")
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  const ratio = total > 0 ? Math.round((forecast / total) * 100) : 0;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography
            sx={{
              fontSize: 11,
              color: C.n400,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.7,
            }}
          >
            Prévision CA pondérée
          </Typography>
          <Typography
            sx={{ fontSize: 28, fontWeight: 900, color: C.amber, lineHeight: 1.1, mt: 0.5 }}
          >
            {fmtTND(forecast)}
          </Typography>
        </Box>
        <KpiGauge value={ratio} size={84} label="Fiabilité" />
      </Stack>
      <Stack spacing={1.2}>
        {[
          { label: "Pipeline total", value: total, color: C.blue },
          { label: "Déjà gagné", value: won, color: C.green },
          { label: "Risque pipeline", value: Math.max(total - forecast, 0), color: C.red },
        ].map((x) => (
          <Box key={x.label}>
            <Stack direction="row" justifyContent="space-between" mb={0.4}>
              <Typography sx={{ fontSize: 11, color: C.n500 }}>{x.label}</Typography>
              <Typography sx={{ fontSize: 12, color: x.color, fontWeight: 800 }}>
                {fmtTND(x.value)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={total > 0 ? Math.min(100, (x.value / total) * 100) : 0}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(x.color, 0.1),
                "& .MuiLinearProgress-bar": { bgcolor: x.color, borderRadius: 3 },
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
RevenueForecast.propTypes = { opportunities: PropTypes.array };
RevenueForecast.defaultProps = { opportunities: [] };

// ─── COMPOSANT : RECOMMANDATIONS INTELLIGENTES ────────────────────────────
function SmartRecommendations({ prospects = [], opportunities = [], tasks = [] }) {
  const recs = [];

  prospects.forEach((p) => {
    const score = Number(p.score || p.ai_score || p.relevance || 0);
    const name =
      `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.name || p.email || "Prospect";
    const hasTask = tasks.some((t) => `${t.prospect || t.prospect_id || ""}` === `${p.id}`);
    const hasOpportunity = opportunities.some(
      (o) => `${o.prospect || o.prospect_id || ""}` === `${p.id}`
    );
    const engagementStatus = `${p.engagement_status || p.status || ""}`.toLowerCase();

    if (score >= 80 && !hasTask) {
      recs.push({
        type: "hot",
        color: C.red,
        title: name,
        sub: `Score IA ${score}%`,
        action: "Créer une tâche de contact aujourd’hui",
      });
    }
    if (
      (engagementStatus.includes("message_ready") || engagementStatus.includes("ready")) &&
      recs.length < 8
    ) {
      recs.push({
        type: "message",
        color: C.blue,
        title: name,
        sub: "Message IA prêt",
        action: "Valider et envoyer le message",
      });
    }
    if (engagementStatus.includes("replied") && recs.length < 8) {
      recs.push({
        type: "reply",
        color: C.green,
        title: name,
        sub: "Réponse prospect détectée",
        action: "Analyser la conversation et répondre",
      });
    }
    if (score >= 70 && !hasOpportunity && recs.length < 8) {
      recs.push({
        type: "deal",
        color: C.amber,
        title: name,
        sub: "Prospect qualifié",
        action: "Créer une opportunité commerciale",
      });
    }
  });

  opportunities.forEach((o) => {
    const updated = new Date(o.updated_at || o.created_at || Date.now());
    const inactiveDays = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
    if (!["won", "lost"].includes(o.stage) && inactiveDays >= 7 && recs.length < 8) {
      recs.push({
        type: "risk",
        color: C.purple,
        title: o.name || o.title || "Opportunité",
        sub: `Inactive depuis ${inactiveDays} jours`,
        action: "Planifier une relance",
      });
    }
  });

  const unique = recs
    .filter(
      (r, i, arr) => i === arr.findIndex((x) => `${x.type}-${x.title}` === `${r.type}-${r.title}`)
    )
    .slice(0, 6);

  if (!unique.length) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <CheckCircle sx={{ fontSize: 38, color: C.green, mb: 1 }} />
        <Typography sx={{ fontSize: 12, color: C.n400 }}>Aucune recommandation critique</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.2}>
      {unique.map((r, i) => (
        <Box
          key={`${r.type}-${i}`}
          sx={{
            p: 1.5,
            borderRadius: 3,
            bgcolor: alpha(r.color, 0.045),
            border: `1px solid ${alpha(r.color, 0.16)}`,
            borderLeft: `3px solid ${r.color}`,
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1.2}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 10,
                bgcolor: alpha(r.color, 0.12),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FlashOn sx={{ fontSize: 16, color: r.color }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.n800 }}>
                {r.title}
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: C.n400, mt: 0.1 }}>{r.sub}</Typography>
              <Typography sx={{ fontSize: 11.5, color: r.color, fontWeight: 800, mt: 0.6 }}>
                {r.action}
              </Typography>
            </Box>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
SmartRecommendations.propTypes = {
  prospects: PropTypes.array,
  opportunities: PropTypes.array,
  tasks: PropTypes.array,
};
SmartRecommendations.defaultProps = { prospects: [], opportunities: [], tasks: [] };

// ─── COMPOSANT : HEATMAP VILLES ───────────────────────────────────────────
function ProspectHeatmap({ prospects = [] }) {
  const rows = Object.values(
    prospects.reduce((acc, p) => {
      const city = p.city || p.region || p.country || "Non renseigné";
      if (!acc[city]) acc[city] = { city, count: 0, hot: 0 };
      acc[city].count += 1;
      if (Number(p.score || p.ai_score || p.relevance || 0) >= 70) acc[city].hot += 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
  const max = Math.max(...rows.map((r) => r.count), 1);

  if (!rows.length) {
    return (
      <Typography sx={{ fontSize: 12, color: C.n400, textAlign: "center", py: 4 }}>
        Aucune ville disponible
      </Typography>
    );
  }

  return (
    <Stack spacing={1.1}>
      {rows.map((r) => {
        const pct = Math.round((r.count / max) * 100);
        return (
          <Box key={r.city}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.4}>
              <Stack direction="row" alignItems="center" spacing={0.7}>
                <LocationOn sx={{ fontSize: 13, color: C.red }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n700 }}>
                  {r.city}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: C.red }}>
                {r.count}
              </Typography>
            </Stack>
            <Box
              sx={{ height: 8, bgcolor: alpha(C.red, 0.08), borderRadius: 4, overflow: "hidden" }}
            >
              <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: C.red, borderRadius: 4 }} />
            </Box>
            <Typography sx={{ fontSize: 10, color: C.n400, mt: 0.25 }}>
              {r.hot} prospects chauds
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
ProspectHeatmap.propTypes = { prospects: PropTypes.array };
ProspectHeatmap.defaultProps = { prospects: [] };

// ─── PERFORMANCE TAB ─────────────────────────────────────────────
function AdminPerformanceTab({ allUsers }) {
  const { data: teamData, loading } = useTeamKPI();
  const { data: alertsData } = useAlerts();
  const { data: leaderboard } = useLeaderboard();
  const [selected, setSelected] = useState(null);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [subTab, setSubTab] = useState(0);
  const [feedbacks, setFeedbacks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [target, setTarget] = useState(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [filterUser, setFilterUser] = useState("all");

  const leaderboardList = leaderboard?.leaderboard || [];
  const commerciaux = allUsers.filter((m) => m.role === "COMMERCIAL" || m.role === "MANAGER");
  const ratingLabel = ["", "Insuffisant", "À améliorer", "Correct", "Bien", "Excellent"];
  const ratingColor = ["", C.red, C.red, C.amber, C.green, C.green];

  const fetchFullKpi = useCallback(async (uid) => {
    try {
      const r = await perfApi.get(`/kpi/${uid}/`);
      setSelectedKpi(r.data);
    } catch {
      setSelectedKpi(null);
    }
  }, []);
  const fetchHistory = useCallback(async (uid) => {
    try {
      const r = await perfApi.get(`/kpi/history/${uid}/?months=6`);
      setSelectedHistory(r.data);
    } catch {
      setSelectedHistory([]);
    }
  }, []);
  const handleSelect = (e) => {
    setSelected(e);
    setSelectedKpi(null);
    if (e) {
      fetchFullKpi(e.user_id);
      fetchHistory(e.user_id);
    } else setSelectedHistory([]);
  };
  const fetchFeedbacks = useCallback(async () => {
    try {
      const now = new Date();
      const r = await perfApi.get(
        `/feedback/?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      );
      setFeedbacks(Array.isArray(r.data) ? r.data : r.data.results || []);
    } catch {
      setFeedbacks([]);
    }
  }, []);
  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleSend = async () => {
    if (!rating || !comment.trim() || !target) return;
    setSending(true);
    try {
      const now = new Date();
      await perfApi.post("/feedback/", {
        commercial: target.id,
        rating,
        comment,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      setSentOk(true);
      setTimeout(() => {
        setSentOk(false);
        setShowModal(false);
        setRating(0);
        setComment("");
        setTarget(null);
        fetchFeedbacks();
      }, 1500);
    } catch {
      console.error("feedback error");
    } finally {
      setSending(false);
    }
  };

  const allAlerts = alertsData
    ? [
        ...(alertsData.overdue_tasks || []).map((t) => ({
          type: "error",
          title: `En retard : "${t.title}"`,
          sub: `${t.commercial} · ${fmtDate(t.due_date)}`,
        })),
        ...(alertsData.inactive_users || []).map((u) => ({
          type: "warning",
          title: `${u.username} inactif 3 jours`,
          sub: "Aucune activité",
        })),
        ...(alertsData.low_score_users || []).map((u) => ({
          type: "warning",
          title: `Score faible : ${u.username}`,
          sub: `${Math.round(u.score)}% · pénalité ${u.penalty}pts`,
        })),
        ...(alertsData.upcoming_tasks || []).map((t) => ({
          type: "info",
          title: `Deadline 24h : "${t.title}"`,
          sub: t.commercial,
        })),
      ]
    : [];

  if (loading) return <PerfSkeleton rows={6} />;
  const avgScore =
    teamData?.avg_score ??
    (leaderboardList.length
      ? Math.round(leaderboardList.reduce((s, e) => s + e.score, 0) / leaderboardList.length)
      : 0);
  const topPerformer = leaderboardList[0] || null;

  return (
    <Box sx={{ animation: `${fadeUp} .2s ease` }}>
      <Grid container spacing={2} mb={3}>
        {[
          {
            label: "Score équipe",
            value: `${Math.round(avgScore)}%`,
            color: scoreColor(avgScore),
            icon: <EmojiEvents />,
          },
          {
            label: "Commerciaux",
            value: teamData?.team_count ?? leaderboardList.length,
            color: C.blue,
            icon: <People />,
          },
          {
            label: "En difficulté",
            value:
              (teamData?.in_difficulty || []).length ||
              leaderboardList.filter((e) => e.score < 70).length,
            color: C.red,
            icon: <Warning />,
          },
          {
            label: "Alertes",
            value: allAlerts.length,
            color: allAlerts.length > 0 ? C.amber : C.green,
            icon: <NotificationsActive />,
          },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <KpiCard color={s.color}>
              <Stack direction="row" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    bgcolor: alpha(s.color, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {React.cloneElement(s.icon, { sx: { fontSize: 20, color: s.color } })}
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: C.n400,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      fontWeight: 700,
                    }}
                  >
                    {s.label}
                  </Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                    {s.value}
                  </Typography>
                </Box>
              </Stack>
            </KpiCard>
          </Grid>
        ))}
      </Grid>

      {topPerformer && (
        <Card
          sx={{
            mb: 3,
            background: `linear-gradient(135deg,${alpha("#f59e0b", 0.08)},${alpha(
              "#f59e0b",
              0.03
            )})`,
            border: `1px solid ${alpha("#f59e0b", 0.25)}`,
          }}
        >
          <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
            <Typography sx={{ fontSize: 32 }}>🥇</Typography>
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: alpha("#f59e0b", 0.2),
                color: "#b45309",
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              {getInit(topPerformer.username)}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontSize: 10,
                  color: "#92400e",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Top performer du mois
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: C.n800 }}>
                {topPerformer.username}
              </Typography>
            </Box>
            <Box sx={{ ml: "auto", textAlign: "center" }}>
              <Typography sx={{ fontSize: 42, fontWeight: 900, color: "#b45309", lineHeight: 1 }}>
                {Math.round(topPerformer.score)}%
              </Typography>
              <Typography sx={{ fontSize: 10, color: "#92400e" }}>Score KPI</Typography>
            </Box>
          </Stack>
        </Card>
      )}

      {allAlerts.length > 0 && (
        <Box mb={3}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setShowAlerts(!showAlerts)}
            sx={{ cursor: "pointer", mb: 1 }}
          >
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: C.n600,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              🚨 Alertes actives ({allAlerts.length})
            </Typography>
            {showAlerts ? (
              <ExpandLess sx={{ fontSize: 16, color: C.n400 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 16, color: C.n400 }} />
            )}
          </Stack>
          <Collapse in={showAlerts}>
            <Grid container spacing={1}>
              {allAlerts.slice(0, 8).map((a, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <AlertRow {...a} />
                </Grid>
              ))}
            </Grid>
          </Collapse>
        </Box>
      )}

      <Stack
        direction="row"
        spacing={1}
        mb={2.5}
        sx={{
          bgcolor: C.white,
          p: 0.8,
          borderRadius: 12,
          border: `1px solid ${C.n200}`,
          width: "fit-content",
        }}
      >
        {[
          { label: "Classement & KPIs", icon: <BarChartIcon sx={{ fontSize: 14 }} /> },
          { label: "Feedbacks équipe", icon: <RateReview sx={{ fontSize: 14 }} /> },
        ].map((tab, i) => (
          <TabPill key={i} active={subTab === i ? 1 : 0} onClick={() => setSubTab(i)}>
            {React.cloneElement(tab.icon, {
              sx: { fontSize: 14, color: subTab === i ? C.red : C.n400 },
            })}
            <span className="lbl">{tab.label}</span>
          </TabPill>
        ))}
      </Stack>

      {subTab === 0 && (
        <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800, mb: 1.5 }}>
              🏆 Classement — {monthLabel()}
            </Typography>
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{ borderRadius: 14, border: `1px solid ${C.n200}`, overflow: "hidden" }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: C.redSoft }}>
                    {[
                      "#",
                      "Commercial",
                      "Score KPI",
                      "Tâches",
                      "Délais",
                      "Activités",
                      "Deals",
                      "Pénalité",
                    ].map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.redDark,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: `1px solid ${C.redBorder}`,
                          py: 1.5,
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leaderboardList.map((entry) => {
                    const isSel = selected?.user_id === entry.user_id;
                    const col = scoreColor(entry.score);
                    const tp =
                      entry.tasks_total > 0
                        ? Math.round((entry.tasks_done / entry.tasks_total) * 100)
                        : 0;
                    const trp =
                      entry.tasks_done > 0
                        ? Math.round(((entry.tasks_on_time || 0) / entry.tasks_done) * 100)
                        : 0;
                    const rank =
                      entry.rank === 1
                        ? "🥇"
                        : entry.rank === 2
                        ? "🥈"
                        : entry.rank === 3
                        ? "🥉"
                        : null;
                    return (
                      <TableRow
                        key={entry.user_id}
                        onClick={() => handleSelect(isSel ? null : entry)}
                        sx={{
                          cursor: "pointer",
                          bgcolor: isSel ? alpha(C.red, 0.04) : C.white,
                          borderLeft: isSel ? `3px solid ${C.red}` : "3px solid transparent",
                          transition: "all .15s",
                          "&:hover": { bgcolor: alpha(C.redSoft, 0.5) },
                          "&:last-child td": { border: 0 },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          {rank ? (
                            <Typography sx={{ fontSize: 17 }}>{rank}</Typography>
                          ) : (
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.n400 }}>
                              #{entry.rank}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Stack direction="row" alignItems="center" spacing={1.2}>
                            <Avatar
                              sx={{
                                width: 30,
                                height: 30,
                                bgcolor: alpha(col, 0.15),
                                color: col,
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {getInit(entry.username)}
                            </Avatar>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n800 }}>
                              {entry.username}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Stack direction="row" alignItems="center" gap={0.8}>
                            <Typography
                              sx={{ fontSize: 18, fontWeight: 800, color: col, minWidth: 44 }}
                            >
                              {Math.round(entry.score)}%
                            </Typography>
                            {entry.score >= 85 ? (
                              <TrendingUp sx={{ fontSize: 14, color: C.green }} />
                            ) : entry.score < 60 ? (
                              <TrendingDown sx={{ fontSize: 14, color: C.red }} />
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ minWidth: 90 }}>
                            <Stack direction="row" justifyContent="space-between" mb={0.3}>
                              <Typography sx={{ fontSize: 10, color: C.n400 }}>
                                {entry.tasks_done}/{entry.tasks_total}
                              </Typography>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.blue }}>
                                {tp}%
                              </Typography>
                            </Stack>
                            <Box
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: alpha(C.blue, 0.12),
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${Math.min(100, tp)}%`,
                                  bgcolor: C.blue,
                                  borderRadius: 2,
                                  transition: "width .8s ease",
                                }}
                              />
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ minWidth: 70 }}>
                            <Stack direction="row" justifyContent="space-between" mb={0.3}>
                              <Typography sx={{ fontSize: 10, color: C.n400 }}>{trp}%</Typography>
                            </Stack>
                            <Box
                              sx={{
                                height: 4,
                                borderRadius: 2,
                                bgcolor: alpha(
                                  trp === 100 ? C.green : trp >= 70 ? C.amber : C.red,
                                  0.12
                                ),
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  height: "100%",
                                  width: `${Math.min(100, trp)}%`,
                                  bgcolor: trp === 100 ? C.green : trp >= 70 ? C.amber : C.red,
                                  borderRadius: 2,
                                  transition: "width .8s ease",
                                }}
                              />
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Stack direction="row" spacing={0.5}>
                            {[
                              {
                                icon: <Phone sx={{ fontSize: 10 }} />,
                                val: entry.calls || 0,
                                color: C.blue,
                              },
                              {
                                icon: <Email sx={{ fontSize: 10 }} />,
                                val: entry.emails || 0,
                                color: C.purple,
                              },
                              {
                                icon: <Groups sx={{ fontSize: 10 }} />,
                                val: entry.meetings || 0,
                                color: C.teal,
                              },
                            ].map((it, ix) => (
                              <Box
                                key={ix}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.3,
                                  bgcolor: alpha(it.color, 0.1),
                                  borderRadius: 1,
                                  px: 0.6,
                                  py: 0.2,
                                }}
                              >
                                {React.cloneElement(it.icon, {
                                  sx: { fontSize: 10, color: it.color },
                                })}
                                <Typography sx={{ fontSize: 10, fontWeight: 600, color: it.color }}>
                                  {it.val}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.teal }}>
                            {entry.opportunities_won || 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography
                            sx={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: (entry.penalty_points || 0) < 0 ? C.red : C.green,
                            }}
                          >
                            {entry.penalty_points || 0} pts
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          {selected && (
            <Box
              sx={{
                width: 280,
                flexShrink: 0,
                bgcolor: C.white,
                borderRadius: 16,
                border: `1px solid ${C.n200}`,
                boxShadow: SHADOW.card,
                minHeight: 400,
                position: "sticky",
                top: 20,
                overflow: "hidden",
              }}
            >
              <Box sx={{ p: 2, background: GRAD.redGlow, textAlign: "center" }}>
                <Avatar
                  sx={{
                    width: 52,
                    height: 52,
                    bgcolor: "rgba(255,255,255,.2)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 20,
                    mx: "auto",
                    mb: 1,
                  }}
                >
                  {getInit(selected.username)}
                </Avatar>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  {selected.username}
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Box sx={{ textAlign: "center", mb: 2 }}>
                  <KpiGauge value={selected.score} size={90} label="KPI" />
                </Box>
                {selectedHistory.length > 0 && (
                  <Box sx={{ height: 70 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selectedHistory}
                        margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                      >
                        <defs>
                          <linearGradient id="shg" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={scoreColor(selected.score)}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={scoreColor(selected.score)}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" tick={{ fontSize: 8, fill: C.n400 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: C.n400 }} />
                        <ReTip
                          contentStyle={{ fontSize: 11, borderRadius: 6 }}
                          formatter={(v) => [`${Math.round(v)}%`, "Score"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke={scoreColor(selected.score)}
                          strokeWidth={2}
                          fill="url(#shg)"
                          dot={{ r: 2.5, fill: scoreColor(selected.score) }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {subTab === 1 && (
        <Card accent={C.purple}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: GRAD.red,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <RateReview sx={{ color: "#fff", fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: C.n800 }}>
                  Feedbacks — {monthLabel()}
                </Typography>
              </Box>
            </Stack>
            <PrimaryBtn
              size="small"
              startIcon={<Add sx={{ fontSize: 15 }} />}
              onClick={() => setShowModal(true)}
            >
              Nouveau
            </PrimaryBtn>
          </Stack>

          <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
            <Select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              sx={{ borderRadius: 2, fontSize: 13 }}
            >
              <MenuItem value="all">Tous les collaborateurs</MenuItem>
              {commerciaux.map((m) => (
                <MenuItem key={m.id} value={m.id.toString()}>
                  {m.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack spacing={1.2}>
            {(filterUser === "all"
              ? feedbacks
              : feedbacks.filter((f) => f.commercial === parseInt(filterUser))
            )
              .slice(0, 8)
              .map((fb, i) => {
                const u = allUsers.find((m) => m.id === fb.commercial);
                const r = fb.rating || 0;
                const col = ratingColor[r] || C.amber;
                return (
                  <Box
                    key={fb.id || i}
                    sx={{
                      p: 2,
                      borderRadius: 12,
                      bgcolor: alpha(col, 0.03),
                      border: `1px solid ${alpha(col, 0.14)}`,
                      borderLeft: `3px solid ${col}`,
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" gap={1.5}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: alpha(C.purple, 0.12),
                          color: C.purple,
                          fontSize: 13,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {getInit(u?.username || "?")}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          mb={0.3}
                          flexWrap="wrap"
                        >
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.n800 }}>
                            {u?.username || `#${fb.commercial}`}
                          </Typography>
                          <Stack direction="row" spacing={0.1}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Typography
                                key={s}
                                sx={{
                                  fontSize: 13,
                                  color: s <= r ? "#f59e0b" : C.n200,
                                  lineHeight: 1,
                                }}
                              >
                                ★
                              </Typography>
                            ))}
                          </Stack>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: col }}>
                            {ratingLabel[r]}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 13, color: C.n600, lineHeight: 1.5 }}>
                          {fb.comment}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{ fontSize: 11, color: C.n400, whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        {fb.month}/{fb.year}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
          </Stack>
        </Card>
      )}

      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        PaperProps={{ sx: { borderRadius: 4, minWidth: 460, overflow: "visible" } }}
      >
        <Box sx={{ position: "relative", pt: 5 }}>
          <Box
            sx={{
              position: "absolute",
              top: -28,
              left: "50%",
              transform: "translateX(-50%)",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: GRAD.red,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: SHADOW.red,
            }}
          >
            <RateReview sx={{ color: "#fff", fontSize: 26 }} />
          </Box>
        </Box>
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: C.n800 }}>
            Nouveau feedback
          </Typography>
          <Typography sx={{ fontSize: 12, color: C.n400 }}>{monthLabel()}</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          {sentOk ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ fontSize: 42, mb: 1.5 }}>🎉</Typography>
              <Typography sx={{ fontWeight: 800, color: C.green, fontSize: 16 }}>
                Envoyé !
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5} mt={0.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Collaborateur *</InputLabel>
                <Select
                  value={target?.id || ""}
                  label="Collaborateur *"
                  onChange={(e) => setTarget(commerciaux.find((m) => m.id === e.target.value))}
                  sx={{ borderRadius: 2 }}
                >
                  {commerciaux.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.n600, mb: 1.5 }}>
                  Note *
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Box
                      key={s}
                      onMouseEnter={() => setHover(s)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(s)}
                      sx={{
                        fontSize: 34,
                        cursor: "pointer",
                        transition: "all .1s",
                        lineHeight: 1,
                        userSelect: "none",
                        color: s <= (hover || rating) ? "#f59e0b" : C.n200,
                        transform: s <= (hover || rating) ? "scale(1.2)" : "scale(1)",
                      }}
                    >
                      ★
                    </Box>
                  ))}
                  {rating > 0 && (
                    <Typography
                      sx={{ fontSize: 13, fontWeight: 700, color: ratingColor[rating], ml: 1 }}
                    >
                      {ratingLabel[rating]}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Commentaire *"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: 2 },
                  "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: C.red },
                  "& label.Mui-focused": { color: C.red },
                }}
              />
            </Stack>
          )}
        </DialogContent>
        {!sentOk && (
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <GhostBtn onClick={() => setShowModal(false)}>Annuler</GhostBtn>
            <PrimaryBtn
              disabled={!rating || !comment.trim() || !target || sending}
              onClick={handleSend}
              startIcon={<SendIcon sx={{ fontSize: 16 }} />}
            >
              {sending ? "Envoi..." : "Envoyer"}
            </PrimaryBtn>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
}
AdminPerformanceTab.propTypes = { allUsers: PropTypes.array };
AdminPerformanceTab.defaultProps = { allUsers: [] };

// ─── MAIN ADMIN DASHBOARD ────────────────────────────────────────
export default function AdminDashboard({ data, onRefresh }) {
  const remote = useOfficialDashboardData("ADMIN", data);
  const [activeTab, setActiveTab] = useState(0);
  useTrackActivity("dashboard");

  const effectiveData = data || remote.data || {};
  const effectiveRefresh = onRefresh || remote.refresh;
  const prospects = toList(effectiveData?.prospects);
  const contacts = toList(effectiveData?.contacts);
  const opportunities = toList(effectiveData?.opportunities);
  const tasks = toList(effectiveData?.tasks);
  const users = toList(effectiveData?.users);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const standaloneBlocked = !data && (remote.loading || remote.error);

  const totalPipeline = opportunities.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  const wonOpps = opportunities.filter((o) => o.stage === "won");
  const overdueTasks = tasks.filter(isOverdue);
  const commerciaux = users.filter((u) => u.role === "COMMERCIAL");
  const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const monthlyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6 + i);
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return {
      month: label,
      Prospects: prospects.filter((p) => {
        const c = new Date(p.created_at);
        return c.getMonth() + 1 === month && c.getFullYear() === year;
      }).length,
      Deals: opportunities.filter((o) => {
        const c = new Date(o.created_at);
        return c.getMonth() + 1 === month && c.getFullYear() === year;
      }).length,
    };
  });

  const kpiCards = [
    {
      label: "Prospects",
      value: prospects.length,
      color: C.red,
      icon: <PersonAdd />,
      sub: `${prospects.filter((p) => p.status === "new").length} nouveaux`,
      diff: 12,
    },
    {
      label: "Contacts",
      value: contacts.length,
      color: C.blue,
      icon: <Contacts />,
      sub: `${contacts.length} actifs`,
      diff: 5,
    },
    {
      label: "Pipeline",
      value: fmtTND(totalPipeline),
      color: C.amber,
      icon: <AttachMoney />,
      sub: `${wonOpps.length} deals gagnés`,
      diff: 23,
    },
    {
      label: "Tâches actives",
      value: activeTasks.length,
      color: C.purple,
      icon: <CheckCircle />,
      sub: overdueTasks.length > 0 ? `⚠️ ${overdueTasks.length} en retard` : "Tout à jour",
      diff: overdueTasks.length > 0 ? -overdueTasks.length : 0,
    },
  ];

  const tabs = [
    { label: "Vue CRM", icon: <BarChartIcon sx={{ fontSize: 15 }} /> },
    { label: "Performance", icon: <EmojiEvents sx={{ fontSize: 15 }} /> },
  ];

  const { data: leaderboard } = useLeaderboard();
  const leaderboardList = leaderboard?.leaderboard || [];

  const body = (
    <Box sx={{ animation: `${fadeUp} .25s ease` }}>
      <HeroBanner>
        <Box
          sx={{
            position: "absolute",
            top: -70,
            right: -70,
            width: 240,
            height: 240,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,.05)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: -50,
            left: "20%",
            width: 160,
            height: 160,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,.04)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: "55%",
            width: 90,
            height: 90,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,.03)",
            pointerEvents: "none",
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
          sx={{ position: "relative", zIndex: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                bgcolor: "rgba(255,255,255,.18)",
                fontSize: 24,
                fontWeight: 900,
                border: "2.5px solid rgba(255,255,255,.3)",
              }}
            >
              {getInit(user.username || "A")}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontSize: 11,
                  color: "rgba(255,255,255,.65)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  mb: 0.3,
                }}
              >
                Administrateur CRM
              </Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
                Bonjour, {user.username} 👋
              </Typography>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,.65)", mt: 0.4 }}>
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.8}>
            {overdueTasks.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  bgcolor: "rgba(255,255,255,.15)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: 20,
                  px: 1.8,
                  py: 0.7,
                  animation: `${pulseRed} 2s infinite`,
                }}
              >
                <Warning sx={{ fontSize: 14, color: "#fcd34d" }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                  {overdueTasks.length} en retard
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                bgcolor: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 20,
                px: 1.8,
                py: 0.7,
              }}
            >
              <People sx={{ fontSize: 14, color: "#fff" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {users.length} membres
              </Typography>
            </Box>
            <Box
              onClick={effectiveRefresh}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                bgcolor: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 20,
                px: 1.8,
                py: 0.7,
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(255,255,255,.2)" },
              }}
            >
              <Refresh sx={{ fontSize: 14, color: "#fff" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                Actualiser
              </Typography>
            </Box>
            <Box
              sx={{
                "& .MuiButton-root": {
                  borderColor: "rgba(255,255,255,.55)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 20,
                  textTransform: "none",
                  px: 1.8,
                  py: 0.5,
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,.15)" },
                },
              }}
            >
              <FeedbackButton />
            </Box>
          </Stack>
        </Stack>
      </HeroBanner>

      <Stack
        direction="row"
        spacing={1}
        mb={3}
        sx={{
          bgcolor: C.white,
          p: 1,
          borderRadius: 14,
          border: `1px solid ${C.n200}`,
          width: "fit-content",
        }}
      >
        {tabs.map((tab, i) => (
          <TabPill key={i} active={activeTab === i ? 1 : 0} onClick={() => setActiveTab(i)}>
            {React.cloneElement(tab.icon, {
              sx: { fontSize: 15, color: activeTab === i ? C.red : C.n400 },
            })}
            <span className="lbl">{tab.label}</span>
          </TabPill>
        ))}
      </Stack>

      {activeTab === 0 && (
        <Box sx={{ animation: `${fadeUp} .2s ease` }}>
          <Grid container spacing={2.5} mb={3}>
            {kpiCards.map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.label}>
                <KpiCard color={s.color}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box>
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.n400,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          mb: 0.6,
                        }}
                      >
                        {s.label}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 30, fontWeight: 900, color: C.n800, lineHeight: 1.05 }}
                      >
                        {s.value}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: C.n400, mt: 0.5 }}>{s.sub}</Typography>
                      {s.diff !== 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.4} mt={0.8}>
                          {s.diff > 0 ? (
                            <ArrowUpward sx={{ fontSize: 12, color: C.green }} />
                          ) : (
                            <ArrowDownward sx={{ fontSize: 12, color: C.red }} />
                          )}
                          <Typography
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: s.diff > 0 ? C.green : C.red,
                            }}
                          >
                            {Math.abs(s.diff)} ce mois
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                    <Box
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: 13,
                        bgcolor: alpha(s.color, 0.1),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {React.cloneElement(s.icon, { sx: { color: s.color, fontSize: 23 } })}
                    </Box>
                  </Stack>
                </KpiCard>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12}>
              <AiCenter
                data={effectiveData}
                prospects={prospects}
                opportunities={opportunities}
                tasks={tasks}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Card accent={C.blue} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.blue, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Sources prospects
                  </Typography>
                </Stack>
                <SourceDistribution prospects={prospects} />
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card accent={C.amber} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.amber, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Prévision commerciale
                  </Typography>
                </Stack>
                <RevenueForecast opportunities={opportunities} />
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card accent={C.red} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.red, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Suggestions intelligentes
                  </Typography>
                </Stack>
                <SmartRecommendations
                  prospects={prospects}
                  opportunities={opportunities}
                  tasks={tasks}
                />
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} md={5}>
              <Card accent={C.red}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.red, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Funnel de conversion
                  </Typography>
                </Stack>
                <ConversionFunnel opportunities={opportunities} />
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: C.green }}>
                      {wonOpps.length}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.n400 }}>Deals gagnés</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: C.red }}>
                      {opportunities.filter((o) => o.stage === "lost").length}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.n400 }}>Perdus</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: C.amber }}>
                      {fmtTND(totalPipeline)}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.n400 }}>Pipeline total</Typography>
                  </Box>
                </Stack>
              </Card>
            </Grid>

            <Grid item xs={12} md={7}>
              <Card accent={C.blue}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.blue, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Évolution mensuelle
                  </Typography>
                </Stack>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.red} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.red} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.n200} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: C.n400 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.n400 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <ReTip content={<TooltipBox />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="Prospects"
                      stroke={C.red}
                      strokeWidth={2.5}
                      fill="url(#gp)"
                      dot={{ r: 4, fill: C.red, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Deals"
                      stroke={C.blue}
                      strokeWidth={2.5}
                      fill="url(#gd)"
                      dot={{ r: 4, fill: C.blue, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2.5} mb={2.5}>
            <Grid item xs={12} md={4}>
              <Card accent={C.purple} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.purple, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Activité récente
                  </Typography>
                </Stack>
                <ActivityTimeline
                  tasks={tasks}
                  prospects={prospects}
                  opportunities={opportunities}
                />
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card accent={C.teal} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.teal, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Répartition géographique
                  </Typography>
                </Stack>
                <GeoProspects prospects={prospects} />
                <Divider sx={{ my: 2 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: C.n700, mb: 1.5 }}>
                  Heatmap prospection par ville
                </Typography>
                <ProspectHeatmap prospects={prospects} />
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card accent={C.amber} sx={{ height: "100%" }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 24, bgcolor: C.amber, borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                    Score KPI équipe
                  </Typography>
                </Stack>
                <TeamScoreCard leaderboard={leaderboardList} />
              </Card>
            </Grid>
          </Grid>

          <Card accent={C.redDark}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 8, height: 24, bgcolor: C.red, borderRadius: 2 }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.n800 }}>
                  Tâches équipe
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 11, color: C.n400 }}>
                {activeTasks.length} actives · {overdueTasks.length} en retard
              </Typography>
            </Stack>
            {activeTasks.length === 0 ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CheckCircle sx={{ fontSize: 36, color: C.green, mb: 1 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.green }}>
                  Toutes les tâches sont à jour !
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {[...activeTasks]
                  .sort((a, b) => (isOverdue(a) ? -1 : isOverdue(b) ? 1 : 0))
                  .slice(0, 8)
                  .map((t) => {
                    const overdue = isOverdue(t);
                    const today = isToday(t.due_date);
                    const borderCol = overdue
                      ? C.red
                      : today
                      ? C.amber
                      : STATUS_COLORS[t.status] || C.n300;
                    return (
                      <Grid item xs={12} sm={6} md={3} key={t.id}>
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: overdue ? alpha(C.red, 0.03) : alpha(borderCol, 0.03),
                            borderRadius: 12,
                            border: `1px solid ${alpha(borderCol, 0.2)}`,
                            borderLeft: `3px solid ${borderCol}`,
                            transition: "all .15s",
                            "&:hover": { boxShadow: SHADOW.sm },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.n800,
                              mb: 0.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.title}
                          </Typography>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography sx={{ fontSize: 11, color: C.n400 }}>
                              {t.assigned_to_detail?.username || "—"}
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <CalendarToday
                                sx={{ fontSize: 10, color: overdue ? C.red : C.n400 }}
                              />
                              <Typography
                                sx={{
                                  fontSize: 10,
                                  color: overdue ? C.red : C.n400,
                                  fontWeight: overdue ? 700 : 400,
                                }}
                              >
                                {fmtDate(t.due_date)}
                                {overdue ? " ⚠️" : ""}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      </Grid>
                    );
                  })}
              </Grid>
            )}
          </Card>
        </Box>
      )}

      {activeTab === 1 && <AdminPerformanceTab allUsers={users} />}
    </Box>
  );

  if (!data) {
    return (
      <DashboardDataFrame
        loading={standaloneBlocked && remote.loading}
        error={standaloneBlocked ? remote.error : null}
        onRefresh={remote.refresh}
        lastUpdated={remote.lastUpdated}
      >
        {standaloneBlocked ? null : body}
      </DashboardDataFrame>
    );
  }

  return body;
}

AdminDashboard.propTypes = { data: PropTypes.object, onRefresh: PropTypes.func };
AdminDashboard.defaultProps = { data: null, onRefresh: null };
