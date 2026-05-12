/* eslint-disable prettier/prettier */
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AcUnit as ColdIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Language as WebsiteIcon,
  LinkedIn as LinkedInIcon,
  Map as MapIcon,
  People as PeopleIcon,
  Place as PlaceIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Storefront as StoreIcon,
  Whatshot as HotIcon,
  FlashOn as WarmIcon,
} from "@mui/icons-material";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import { useTrackActivity } from "../pages/superadmin/Marketingwidgets";
import { importProspectionResult, searchProspectsAgent } from "../services/prospectAgentApi";

const SECTEURS = [
  "restaurant",
  "cafe",
  "hotel",
  "it",
  "informatique",
  "startup",
  "marketing",
  "agence",
  "clinique",
  "pharmacie",
  "medecin",
  "dentiste",
  "supermarche",
  "banque",
  "coiffeur",
  "gym",
  "garage",
  "boulangerie",
];

const VILLES = [
  "tunis",
  "sfax",
  "sousse",
  "kairouan",
  "bizerte",
  "gabes",
  "ariana",
  "gafsa",
  "monastir",
  "nabeul",
  "ben arous",
  "la marsa",
  "la goulette",
  "hammamet",
  "mahdia",
  "djerba",
];

const CITY_CENTER = {
  tunis: [36.8189, 10.1658],
  sfax: [34.7406, 10.7603],
  sousse: [35.8245, 10.6346],
  kairouan: [35.6781, 10.0964],
  bizerte: [37.2746, 9.8739],
  gabes: [33.8815, 10.0982],
  ariana: [36.8663, 10.1647],
  gafsa: [34.425, 8.7842],
  monastir: [35.7643, 10.8113],
  nabeul: [36.4561, 10.7376],
  "ben arous": [36.7533, 10.2281],
  "la marsa": [36.8784, 10.3249],
  "la goulette": [36.818, 10.305],
  hammamet: [36.4, 10.6167],
  mahdia: [35.5047, 11.0622],
  djerba: [33.8076, 10.8451],
};

const C = {
  red: "#dc2626",
  redDark: "#b91c1c",
  redSoft: "#fef2f2",
  white: "#ffffff",
  text: "#262626",
  muted: "#737373",
  line: "#e5e5e5",
  soft: "#f5f5f5",
  green: "#10b981",
  blue: "#2563eb",
  amber: "#f59e0b",
  slate: "#64748b",
  grad: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
};

const EVAL = {
  hot: { label: "Hot", color: "#ef4444", bg: "#fef2f2", icon: HotIcon },
  warm: { label: "Warm", color: "#f59e0b", bg: "#fffbeb", icon: WarmIcon },
  cold: { label: "Cold", color: "#64748b", bg: "#f8fafc", icon: ColdIcon },
};

const SOURCE_OPTIONS = [
  { id: "osm", label: "OSM", icon: StoreIcon },
  { id: "website", label: "Web", icon: WebsiteIcon },
  { id: "facebook", label: "Facebook", icon: FacebookIcon },
  { id: "instagram", label: "Instagram", icon: InstagramIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon },
];

const SEARCH_MODES = [
  { id: "company", label: "Entreprises", icon: BusinessIcon },
  { id: "prospect", label: "Prospects", icon: PeopleIcon },
];

const SENIORITY_OPTIONS = [
  { value: "", label: "Tous niveaux" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Directeur" },
  { value: "head", label: "Head / Lead" },
  { value: "executive", label: "C-level" },
];

function NativeButton({ children, disabled, onClick, fullWidth, variant }) {
  const ghost = variant === "ghost";
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      sx={{
        width: fullWidth ? "100%" : "auto",
        minHeight: 38,
        px: 2,
        py: 1,
        border: ghost ? `1px solid ${C.line}` : "none",
        borderRadius: 2,
        background: disabled ? "#d4d4d4" : ghost ? C.white : C.grad,
        color: disabled ? C.muted : ghost ? C.red : C.white,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        fontFamily: "inherit",
        fontWeight: 800,
        fontSize: "0.875rem",
        lineHeight: 1,
        transition: "all 0.15s ease",
        "&:hover": {
          background: disabled ? "#d4d4d4" : ghost ? C.redSoft : C.redDark,
          borderColor: ghost ? C.red : "rgba(0,0,0,0)",
        },
      }}
    >
      {children}
    </Box>
  );
}

NativeButton.defaultProps = {
  disabled: false,
  fullWidth: false,
  onClick: undefined,
  variant: "solid",
};

NativeButton.propTypes = {
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(["solid", "ghost"]),
};

function Pill({ active, children, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        border: `1px solid ${active ? C.red : C.line}`,
        borderRadius: "999px",
        background: active ? C.red : C.soft,
        color: active ? C.white : C.muted,
        cursor: "pointer",
        px: 1.4,
        py: 0.65,
        fontFamily: "inherit",
        fontWeight: active ? 800 : 700,
        fontSize: "0.8125rem",
      }}
    >
      {children}
    </Box>
  );
}

Pill.propTypes = {
  active: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
};

function EvaluationBadge({ value }) {
  const config = EVAL[value] || EVAL.cold;
  const Icon = config.icon;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.45,
        borderRadius: "999px",
        background: config.bg,
        color: config.color,
        fontWeight: 900,
        fontSize: "0.75rem",
      }}
    >
      <Icon sx={{ fontSize: 14 }} />
      {config.label}
    </Box>
  );
}

EvaluationBadge.defaultProps = {
  value: "cold",
};

EvaluationBadge.propTypes = {
  value: PropTypes.string,
};

function SocialLink({ type, url }) {
  if (!url) return null;
  const config = {
    facebook: { icon: FacebookIcon, color: "#1877f2" },
    instagram: { icon: InstagramIcon, color: "#c13584" },
    linkedin: { icon: LinkedInIcon, color: "#0a66c2" },
    website: { icon: WebsiteIcon, color: C.slate },
  }[type];
  const Icon = config.icon;
  return (
    <Box
      component="a"
      href={url}
      target="_blank"
      rel="noreferrer"
      sx={{ color: config.color, display: "inline-flex", alignItems: "center" }}
    >
      <Icon sx={{ fontSize: 18 }} />
    </Box>
  );
}

SocialLink.propTypes = {
  type: PropTypes.oneOf(["facebook", "instagram", "linkedin", "website"]).isRequired,
  url: PropTypes.string,
};

SocialLink.defaultProps = {
  url: "",
};

const getCompanyKey = (company) =>
  company.place_id ||
  `${company.nom || company.prospect_company_name}-${company.ville || company.city}`;

const toCoordinate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const markerColor = (evaluation) =>
  ({
    hot: "#ef4444",
    warm: "#f59e0b",
    cold: "#64748b",
  }[evaluation] || "#2563eb");

const createMarkerIcon = (evaluation, selected) =>
  L.divIcon({
    className: "crm-prospection-marker",
    html: `<span style="
      width:${selected ? 20 : 16}px;
      height:${selected ? 20 : 16}px;
      display:block;
      border-radius:999px;
      background:${markerColor(evaluation)};
      border:3px solid #ffffff;
      box-shadow:0 8px 22px rgba(0,0,0,0.28);
    "></span>`,
    iconSize: [selected ? 26 : 22, selected ? 26 : 22],
    iconAnchor: [selected ? 13 : 11, selected ? 13 : 11],
    popupAnchor: [0, -12],
  });

function MapAutoFocus({ companies, city, selectedKey }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const selected = companies.find((company) => getCompanyKey(company) === selectedKey);
    if (selected) {
      map.setView([selected.latitude, selected.longitude], 15, { animate: true });
      return;
    }

    if (companies.length > 0) {
      const bounds = L.latLngBounds(companies.map((company) => [company.latitude, company.longitude]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      return;
    }

    map.setView(CITY_CENTER[city] || CITY_CENTER.tunis, 12);
  }, [companies, city, map, selectedKey]);

  return null;
}

MapAutoFocus.defaultProps = {
  selectedKey: "",
};

MapAutoFocus.propTypes = {
  companies: PropTypes.arrayOf(PropTypes.object).isRequired,
  city: PropTypes.string.isRequired,
  selectedKey: PropTypes.string,
};

function ProspectionMap({ companies, city, onSelect, selectedKey }) {
  const mapCompanies = useMemo(
    () =>
      companies
        .map((company) => ({
          ...company,
          latitude: toCoordinate(company.latitude),
          longitude: toCoordinate(company.longitude),
        }))
        .filter((company) => company.latitude !== null && company.longitude !== null),
    [companies]
  );
  const center = CITY_CENTER[city] || CITY_CENTER.tunis;

  if (mapCompanies.length === 0) {
    return (
      <Box
        sx={{
          height: 420,
          border: `1px solid ${C.line}`,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.muted,
          textAlign: "center",
          px: 3,
        }}
      >
        <Box>
          <MapIcon sx={{ fontSize: 42, mb: 1, color: "#d4d4d4" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
            Aucune coordonnee exploitable
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: { xs: 360, md: 520 },
        border: `1px solid ${C.line}`,
        borderRadius: 2,
        overflow: "hidden",
        "& .leaflet-container": {
          height: "100%",
          width: "100%",
          fontFamily: "inherit",
        },
        "& .leaflet-popup-content-wrapper": {
          borderRadius: "8px",
        },
      }}
    >
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAutoFocus companies={mapCompanies} city={city} selectedKey={selectedKey} />
        {mapCompanies.map((company) => {
          const key = getCompanyKey(company);
          const selected = key === selectedKey;
          return (
            <Marker
              key={key}
              position={[company.latitude, company.longitude]}
              icon={createMarkerIcon(company.evaluation, selected)}
              eventHandlers={{ click: () => onSelect(company) }}
            >
              <Popup>
                <Box sx={{ minWidth: 180 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5 }}>
                    {company.nom}
                  </Typography>
                  <Typography variant="caption" sx={{ color: C.muted, display: "block" }}>
                    {company.categorie || company.secteur} - Score {company.score_ia || 0}/100
                  </Typography>
                  <Typography variant="caption" sx={{ color: C.muted, display: "block" }}>
                    {company.telephone || company.adresse || "Contact a verifier"}
                  </Typography>
                </Box>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}

ProspectionMap.defaultProps = {
  selectedKey: "",
};

ProspectionMap.propTypes = {
  companies: PropTypes.arrayOf(PropTypes.object).isRequired,
  city: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  selectedKey: PropTypes.string,
};

export default function ProspectSearch() {
  useTrackActivity("agent_prospection");

  const [searchType, setSearchType] = useState("company");
  const [query, setQuery] = useState("");
  const [secteur, setSecteur] = useState("restaurant");
  const [ville, setVille] = useState("tunis");
  const [rayon, setRayon] = useState(5);
  const [maxRes, setMaxRes] = useState(8);
  const [scoreMin, setScoreMin] = useState(0);
  const [sources, setSources] = useState(["osm", "website", "facebook", "instagram", "linkedin"]);
  const [employeesMin, setEmployeesMin] = useState("");
  const [employeesMax, setEmployeesMax] = useState("");
  const [activityType, setActivityType] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [required, setRequired] = useState({
    facebook: false,
    instagram: false,
    website: false,
    phone: false,
    email: false,
    linkedin: false,
  });
  const [keywords, setKeywords] = useState("");
  const [filterEval, setFilterEval] = useState("all");
  const [tab, setTab] = useState("entreprises");
  const [selectedCompanyKey, setSelectedCompanyKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [imported, setImported] = useState({});
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const stats = result?.stats || {};
  const companies = useMemo(() => result?.entreprises || [], [result]);
  const prospects = useMemo(() => result?.prospects || [], [result]);

  const filteredCompanies = useMemo(
    () =>
      companies.filter((item) => (filterEval === "all" ? true : item.evaluation === filterEval)),
    [companies, filterEval]
  );
  const mapCompanies = useMemo(
    () =>
      filteredCompanies.filter(
        (item) => toCoordinate(item.latitude) !== null && toCoordinate(item.longitude) !== null
      ),
    [filteredCompanies]
  );
  const selectedCompany = useMemo(
    () => companies.find((item) => getCompanyKey(item) === selectedCompanyKey),
    [companies, selectedCompanyKey]
  );

  const notify = (message, severity = "success") => {
    setToast({ open: true, message, severity });
  };

  const toggleSource = (source) => {
    setSources((current) => {
      if (current.includes(source)) {
        return current.length === 1 ? current : current.filter((item) => item !== source);
      }
      return [...current, source];
    });
  };

  const toggleRequired = (key) => {
    setRequired((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSearchTypeChange = (value) => {
    setSearchType(value);
    if (value === "prospect") {
      setSources((current) => Array.from(new Set([...current, "osm", "website", "linkedin"])));
    }
  };

  const selectCompanyOnMap = (company) => {
    setSelectedCompanyKey(getCompanyKey(company));
    setTab("carte");
  };

  const parseKeywords = (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setImported({});
    setSelectedCompanyKey("");

    try {
      const payload = {
        search_type: searchType,
        query,
        secteur,
        ville,
        rayon_km: rayon,
        max_resultats: maxRes,
        score_min: scoreMin,
        sources,
        employees_min: employeesMin || null,
        employees_max: employeesMax || null,
        activity_type: activityType,
        job_title: searchType === "prospect" ? jobTitle : "",
        seniority_level: searchType === "prospect" ? seniorityLevel : "",
        target_company: searchType === "prospect" ? targetCompany : "",
        require_facebook: required.facebook,
        require_instagram: required.instagram,
        require_website: searchType === "company" ? required.website : false,
        require_phone: searchType === "company" ? required.phone : false,
        require_email: required.email,
        require_linkedin: searchType === "prospect" ? required.linkedin : false,
        keywords: parseKeywords(keywords),
        session_id: "crm-agent-prospection",
      };
      const data = await searchProspectsAgent(payload);
      setResult(data);
      const firstMappedCompany = (data.entreprises || []).find(
        (item) => toCoordinate(item.latitude) !== null && toCoordinate(item.longitude) !== null
      );
      setSelectedCompanyKey(firstMappedCompany ? getCompanyKey(firstMappedCompany) : "");
      if (searchType === "prospect" && (data.prospects || []).length > 0) {
        setTab("prospects");
      } else {
        setTab(firstMappedCompany ? "carte" : "entreprises");
      }
      notify(
        searchType === "prospect"
          ? `${data.prospects?.length || 0} prospects valides sur ${data.stats?.total || 0} entreprises`
          : `${data.stats?.total || 0} entreprises qualifiees`,
        "success"
      );
    } catch (exc) {
      setError(exc.message);
      notify(exc.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImportCompany = async (company) => {
    const key = getCompanyKey(company);
    const linkedProspects = prospects.filter((p) => p.place_id === company.place_id);

    try {
      await importProspectionResult({
        company,
        prospects: linkedProspects,
      });
      setImported((prev) => ({ ...prev, [key]: true }));
      notify(`${company.nom} importe dans le CRM`, "success");
    } catch (exc) {
      notify(exc.message, "error");
    }
  };

  const handleImportProspect = async (prospect) => {
    const company = companies.find((item) => item.place_id === prospect.place_id) || {
      nom: prospect.prospect_company_name,
      ville: prospect.city,
      evaluation: prospect.evaluation,
      place_id: prospect.place_id,
    };

    try {
      await importProspectionResult({ company, prospects: [prospect] });
      notify(`${prospect.first_name} ${prospect.last_name} importe`, "success");
    } catch (exc) {
      notify(exc.message, "error");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Snackbar
          open={toast.open}
          autoHideDuration={3500}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          >
            {toast.message}
          </Alert>
        </Snackbar>

        <Paper sx={{ background: C.grad, color: C.white, borderRadius: 3, p: 3, mb: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Stack direction="row" gap={2} alignItems="center">
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SearchIcon sx={{ color: C.white, fontSize: 32 }} />
              </Box>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, color: C.white }}>
                  AI Prospecting Agent
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)" }}>
                  MCP pipeline: Gemini, OSM, Web, Redis, ChromaDB et CRM
                </Typography>
              </Box>
            </Stack>
            {result?.meta && (
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Pill active={false} onClick={() => {}}>
                  {result.meta.cache_hit ? "Redis cache" : "Live search"}
                </Pill>
                <Pill active={false} onClick={() => {}}>
                  {result.meta.vector_store || "chroma"}
                </Pill>
              </Stack>
            )}
          </Stack>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4} lg={3}>
            <Paper sx={{ p: 2.5, borderRadius: 3, position: "sticky", top: 24 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 900, mb: 2, display: "flex", gap: 1 }}
              >
                <SettingsIcon sx={{ color: C.red }} />
                Recherche commerciale
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: C.muted, fontWeight: 800 }}
              >
                Type de recherche
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {SEARCH_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <Pill
                      key={mode.id}
                      active={searchType === mode.id}
                      onClick={() => handleSearchTypeChange(mode.id)}
                    >
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <Icon sx={{ fontSize: 15 }} />
                        {mode.label}
                      </Box>
                    </Pill>
                  );
                })}
              </Stack>

              <TextField
                fullWidth
                multiline
                minRows={3}
                size="small"
                label="Requete naturelle"
                placeholder={
                  searchType === "prospect"
                    ? "Ex: responsables marketing dans les hotels a Tunis"
                    : "Ex: restaurants italiens actifs a Tunis avec presence Instagram"
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>{searchType === "prospect" ? "Secteur entreprise" : "Secteur"}</InputLabel>
                <Select
                  value={secteur}
                  label={searchType === "prospect" ? "Secteur entreprise" : "Secteur"}
                  onChange={(event) => setSecteur(event.target.value)}
                >
                  {SECTEURS.map((item) => (
                    <MenuItem value={item} key={item}>
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Ville</InputLabel>
                <Select
                  value={ville}
                  label="Ville"
                  onChange={(event) => setVille(event.target.value)}
                >
                  {VILLES.map((item) => (
                    <MenuItem value={item} key={item}>
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {searchType === "prospect" && (
                <>
                  <TextField
                    fullWidth
                    size="small"
                    label="Poste recherche"
                    placeholder="Ex: Responsable RH, Marketing Manager, CEO"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Niveau</InputLabel>
                    <Select
                      value={seniorityLevel}
                      label="Niveau"
                      onChange={(event) => setSeniorityLevel(event.target.value)}
                    >
                      {SENIORITY_OPTIONS.map((item) => (
                        <MenuItem value={item.value} key={item.value || "all"}>
                          {item.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    size="small"
                    label="Entreprise cible"
                    placeholder="Optionnel: nom d'une entreprise"
                    value={targetCompany}
                    onChange={(event) => setTargetCompany(event.target.value)}
                    sx={{ mb: 2 }}
                  />
                </>
              )}

              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: C.muted, fontWeight: 800 }}
              >
                Sources de recherche
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {SOURCE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Pill
                      key={option.id}
                      active={sources.includes(option.id)}
                      onClick={() => toggleSource(option.id)}
                    >
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <Icon sx={{ fontSize: 15 }} />
                        {option.label}
                      </Box>
                    </Pill>
                  );
                })}
              </Stack>

              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: C.muted, fontWeight: 800 }}
              >
                Donnees obligatoires
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {(searchType === "prospect"
                  ? [
                      ["linkedin", "LinkedIn"],
                      ["email", "Email"],
                      ["facebook", "Facebook"],
                    ]
                  : [
                      ["phone", "Telephone"],
                      ["email", "Email"],
                      ["website", "Site"],
                      ["facebook", "Facebook"],
                      ["instagram", "Instagram"],
                    ]
                ).map(([key, label]) => (
                  <Pill key={key} active={required[key]} onClick={() => toggleRequired(key)}>
                    {label}
                  </Pill>
                ))}
              </Stack>

              <TextField
                fullWidth
                size="small"
                label={searchType === "prospect" ? "Contexte entreprise" : "Activite precise"}
                placeholder={
                  searchType === "prospect"
                    ? "Ex: fintech, hotel luxe, logiciel B2B"
                    : "Ex: italien, luxe, B2B, clinique dentaire"
                }
                value={activityType}
                onChange={(event) => setActivityType(event.target.value)}
                sx={{ mb: 2 }}
              />

              <Stack direction={{ xs: "column", sm: "row" }} gap={1.2} sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Employes min"
                  value={employeesMin}
                  onChange={(event) => setEmployeesMin(event.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Employes max"
                  value={employeesMax}
                  onChange={(event) => setEmployeesMax(event.target.value)}
                />
              </Stack>

              <TextField
                fullWidth
                size="small"
                label="Mots-cles"
                placeholder="Ex: livraison, logiciel, reservation"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: C.muted, fontWeight: 800 }}>
                  Rayon: {rayon} km
                </Typography>
                <Slider
                  value={rayon}
                  min={1}
                  max={30}
                  onChange={(_, value) => setRayon(value)}
                  sx={{ color: C.red }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: C.muted, fontWeight: 800 }}>
                  Resultats max: {maxRes}
                </Typography>
                <Slider
                  value={maxRes}
                  min={1}
                  max={20}
                  onChange={(_, value) => setMaxRes(value)}
                  sx={{ color: C.red }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: C.muted, fontWeight: 800 }}>
                  Score minimum: {scoreMin}
                </Typography>
                <Slider
                  value={scoreMin}
                  min={0}
                  max={90}
                  step={5}
                  onChange={(_, value) => setScoreMin(value)}
                  sx={{ color: C.red }}
                />
              </Box>

              <Typography
                variant="caption"
                sx={{ display: "block", mb: 1, color: C.muted, fontWeight: 800 }}
              >
                Evaluation
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
                {["all", "hot", "warm", "cold"].map((item) => (
                  <Pill key={item} active={filterEval === item} onClick={() => setFilterEval(item)}>
                    {item === "all" ? "Tous" : item}
                  </Pill>
                ))}
              </Stack>

              <NativeButton fullWidth onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <CircularProgress size={18} sx={{ color: C.white }} />
                ) : (
                  <SearchIcon sx={{ fontSize: 18 }} />
                )}
                {loading ? "Agent en cours..." : "Lancer l'agent"}
              </NativeButton>
            </Paper>
          </Grid>

          <Grid item xs={12} md={8} lg={9}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {!result && !loading && (
              <Paper sx={{ p: 6, textAlign: "center", borderRadius: 3 }}>
                <SearchIcon sx={{ fontSize: 64, color: "#d4d4d4", mb: 2 }} />
                <Typography variant="h5" sx={{ fontWeight: 900, color: C.muted }}>
                  Pret a prospecter
                </Typography>
              </Paper>
            )}

            {loading && (
              <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                <CircularProgress sx={{ color: C.red, mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Pipeline MCP en cours
                </Typography>
                <Typography variant="body2" sx={{ color: C.muted }}>
                  Planning, sources, enrichissement, scoring Gemini, memoire Redis et ChromaDB
                </Typography>
              </Paper>
            )}

            {result && !loading && (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { label: "Entreprises", value: stats.total, icon: StoreIcon, color: C.red },
                    {
                      label: "Prospects",
                      value: prospects.length,
                      icon: PeopleIcon,
                      color: C.blue,
                    },
                    {
                      label: "Carte",
                      value: mapCompanies.length,
                      icon: MapIcon,
                      color: C.green,
                    },
                    { label: "Hot", value: stats.hot, icon: HotIcon, color: "#ef4444" },
                    { label: "Warm", value: stats.warm, icon: WarmIcon, color: C.amber },
                    { label: "Telephone", value: stats.avec_tel, icon: PhoneIcon, color: C.green },
                    {
                      label: searchType === "prospect" ? "LinkedIn" : "Email",
                      value: searchType === "prospect" ? stats.prospects_avec_linkedin : stats.avec_email,
                      icon: searchType === "prospect" ? LinkedInIcon : EmailIcon,
                      color: C.blue,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Grid item xs={6} sm={4} md={2} key={item.label}>
                        <Paper
                          sx={{ p: 2, borderRadius: 2, border: `1px solid ${C.line}` }}
                          elevation={0}
                        >
                          <Icon sx={{ color: item.color, mb: 1 }} />
                          <Typography variant="h4" sx={{ color: item.color, fontWeight: 900 }}>
                            {item.value || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: C.muted, fontWeight: 800 }}>
                            {item.label}
                          </Typography>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>

                <Paper sx={{ borderRadius: 3, overflow: "hidden" }}>
                  <Stack direction="row" sx={{ borderBottom: `1px solid ${C.line}` }}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setTab("entreprises")}
                      sx={{
                        border: "none",
                        borderBottom:
                          tab === "entreprises" ? `2px solid ${C.red}` : "2px solid rgba(0,0,0,0)",
                        background: C.white,
                        color: tab === "entreprises" ? C.red : C.muted,
                        px: 2,
                        py: 1.4,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      <BusinessIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
                      Entreprises ({companies.length})
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setTab("carte")}
                      sx={{
                        border: "none",
                        borderBottom:
                          tab === "carte" ? `2px solid ${C.red}` : "2px solid rgba(0,0,0,0)",
                        background: C.white,
                        color: tab === "carte" ? C.red : C.muted,
                        px: 2,
                        py: 1.4,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      <MapIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
                      Carte ({mapCompanies.length})
                    </Box>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setTab("prospects")}
                      sx={{
                        border: "none",
                        borderBottom:
                          tab === "prospects" ? `2px solid ${C.red}` : "2px solid rgba(0,0,0,0)",
                        background: C.white,
                        color: tab === "prospects" ? C.red : C.muted,
                        px: 2,
                        py: 1.4,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      <PeopleIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
                      Prospects ({prospects.length})
                    </Box>
                  </Stack>

                  <Box sx={{ p: 2.5 }}>
                    {tab === "carte" && (
                      <Grid container spacing={2}>
                        <Grid item xs={12} lg={8}>
                          <ProspectionMap
                            companies={filteredCompanies}
                            city={ville}
                            selectedKey={selectedCompanyKey}
                            onSelect={(company) => setSelectedCompanyKey(getCompanyKey(company))}
                          />
                        </Grid>
                        <Grid item xs={12} lg={4}>
                          <Stack spacing={1.5}>
                            {(selectedCompany ? [selectedCompany] : mapCompanies.slice(0, 5)).map(
                              (company) => {
                                const key = getCompanyKey(company);
                                return (
                                  <Paper
                                    key={key}
                                    sx={{
                                      p: 2,
                                      border: `1px solid ${
                                        selectedCompanyKey === key ? C.red : C.line
                                      }`,
                                      borderRadius: 2,
                                    }}
                                    elevation={0}
                                  >
                                    <Stack direction="row" justifyContent="space-between" gap={2}>
                                      <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                          {company.nom}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: C.muted }}>
                                          {company.adresse || company.ville}
                                        </Typography>
                                      </Box>
                                      <EvaluationBadge value={company.evaluation} />
                                    </Stack>
                                    <Stack spacing={0.6} sx={{ mt: 1.2 }}>
                                      <Typography variant="caption" sx={{ color: C.muted }}>
                                        <PlaceIcon sx={{ fontSize: 15, mr: 0.5, verticalAlign: "middle" }} />
                                        {company.distance_km !== null && company.distance_km !== undefined
                                          ? `${company.distance_km} km`
                                          : "Distance non calculee"}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: C.muted }}>
                                        Qualite donnees: {company.data_quality || 0}/100
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: C.muted }}>
                                        {company.telephone || company.site_web || "Contact a enrichir"}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
                                      <NativeButton
                                        variant="ghost"
                                        onClick={() => setSelectedCompanyKey(key)}
                                      >
                                        Centrer
                                      </NativeButton>
                                      <NativeButton
                                        disabled={!!imported[key]}
                                        onClick={() => handleImportCompany(company)}
                                      >
                                        {imported[key] ? "Importe" : "Importer CRM"}
                                      </NativeButton>
                                    </Stack>
                                  </Paper>
                                );
                              }
                            )}
                            {!selectedCompany && mapCompanies.length > 5 && (
                              <Typography variant="caption" sx={{ color: C.muted }}>
                                {mapCompanies.length - 5} autres entreprises visibles sur la carte.
                              </Typography>
                            )}
                          </Stack>
                        </Grid>
                      </Grid>
                    )}

                    {tab === "entreprises" && (
                      <Grid container spacing={2}>
                        {filteredCompanies.map((company) => {
                          const key = getCompanyKey(company);
                          return (
                            <Grid item xs={12} md={6} key={key}>
                              <Card sx={{ borderRadius: 2, border: `1px solid ${C.line}` }}>
                                <CardContent>
                                  <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    gap={2}
                                    sx={{ mb: 1 }}
                                  >
                                    <Box>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        {company.nom}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: C.muted }}>
                                        {company.categorie || company.secteur} - {company.ville}
                                      </Typography>
                                    </Box>
                                    <EvaluationBadge value={company.evaluation} />
                                  </Stack>

                                  <Stack spacing={0.75} sx={{ my: 1.5 }}>
                                    <Typography variant="body2">
                                      <PhoneIcon sx={{ fontSize: 15, color: C.muted, mr: 0.5 }} />
                                      {company.telephone || "Telephone non trouve"}
                                    </Typography>
                                    <Typography variant="body2">
                                      <EmailIcon sx={{ fontSize: 15, color: C.muted, mr: 0.5 }} />
                                      {company.email || "Email non trouve"}
                                    </Typography>
                                  </Stack>

                                  <Stack
                                    direction="row"
                                    gap={1}
                                    alignItems="center"
                                    sx={{ mb: 1.5 }}
                                  >
                                    <SocialLink type="website" url={company.site_web} />
                                    <SocialLink type="facebook" url={company.facebook_url} />
                                    <SocialLink type="instagram" url={company.instagram_url} />
                                    <SocialLink type="linkedin" url={company.linkedin_url} />
                                  </Stack>

                                  <Typography
                                    variant="caption"
                                    sx={{ color: C.muted, display: "block", minHeight: 36 }}
                                  >
                                    {company.raison_score ||
                                      company.besoin_probable ||
                                      "Analyse IA disponible apres scoring."}
                                  </Typography>

                                  <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    sx={{ mt: 2 }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{ color: C.red, fontWeight: 900 }}
                                    >
                                      Score {company.score_ia || 0}/100
                                    </Typography>
                                    <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
                                      {toCoordinate(company.latitude) !== null &&
                                        toCoordinate(company.longitude) !== null && (
                                          <NativeButton
                                            variant="ghost"
                                            onClick={() => selectCompanyOnMap(company)}
                                          >
                                            <MapIcon sx={{ fontSize: 17 }} />
                                            Carte
                                          </NativeButton>
                                        )}
                                      <NativeButton
                                        disabled={!!imported[key]}
                                        onClick={() => handleImportCompany(company)}
                                      >
                                        {imported[key] ? "Importe" : "Importer CRM"}
                                      </NativeButton>
                                    </Stack>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}

                    {tab === "prospects" && (
                      <Stack spacing={1.5}>
                        {prospects.length === 0 && (
                          <Typography sx={{ textAlign: "center", py: 6, color: C.muted }}>
                            Aucun prospect personne fiable trouve. Les entreprises restent
                            importables.
                          </Typography>
                        )}
                        {prospects.map((prospect) => (
                          <Paper
                            key={`${prospect.linkedin_url || prospect.email}-${prospect.prospect_company_name}`}
                            sx={{ p: 2, border: `1px solid ${C.line}`, borderRadius: 2 }}
                            elevation={0}
                          >
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              justifyContent="space-between"
                              gap={2}
                            >
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                  {prospect.first_name} {prospect.last_name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: C.muted }}>
                                  {prospect.title || "Contact"} - {prospect.prospect_company_name}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {prospect.email || "Email manquant"}{" "}
                                  {prospect.phone ? `- ${prospect.phone}` : ""}
                                </Typography>
                                <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1 }}>
                                  <SocialLink type="linkedin" url={prospect.linkedin_url} />
                                  <SocialLink type="facebook" url={prospect.facebook_url} />
                                  <Typography variant="caption" sx={{ color: C.muted }}>
                                    Score {prospect.score_ia || 0}/100 - validation{" "}
                                    {prospect.validation_score || 0}/100
                                  </Typography>
                                </Stack>
                                {prospect.raison_score && (
                                  <Typography variant="caption" sx={{ color: C.muted, display: "block", mt: 0.75 }}>
                                    {prospect.raison_score}
                                  </Typography>
                                )}
                              </Box>
                              <Stack direction="row" gap={1} alignItems="center">
                                <EvaluationBadge value={prospect.evaluation} />
                                <NativeButton onClick={() => handleImportProspect(prospect)}>
                                  Importer
                                </NativeButton>
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Paper>
              </>
            )}
          </Grid>
        </Grid>
      </Container>
    </DashboardLayout>
  );
}
