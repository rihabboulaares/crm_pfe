import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  Apartment,
  AutoFixHigh,
  CheckCircle,
  Insights,
  Launch,
  LocationOn,
  ManageSearch,
  OpenInNew,
  PeopleAlt,
  PersonSearch,
  RestartAlt,
  Search,
  Verified,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import { normalizeProspectionResult, searchProspectsAgent } from "../../services/prospectAgentApi";
import "./prospectionWorkspace.css";

const SUGGESTIONS = [
  "Responsables RH à Tunis",
  "Responsables marketing",
  "Entreprises SaaS",
  "Agences immobilières",
  "Hôtels en Tunisie",
  "Décideurs commerciaux",
];
const PROGRESS_STEPS = [
  "Analyse de la demande",
  "Recherche des opportunités",
  "Vérification des informations",
  "Préparation CRM",
  "Finalisation",
];

const SOURCE_LABELS = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  general: "Web",
  maps: "Google Maps",
  meta_ads: "Meta Ads",
};

function hasContact(item) {
  return Boolean(
    item.email ||
      item.phone ||
      item.website ||
      item.linkedin_url ||
      item.facebook_url ||
      item.instagram_url
  );
}

function locationText(item) {
  return [item.city, item.country].filter(Boolean).join(", ");
}

function sourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

function cleanErrorMessage() {
  return "La recherche n'a pas pu être finalisée.";
}

function allOpportunities(result) {
  if (!result) return [];
  return [...result.companies, ...result.persons];
}

function contactCoverage(result) {
  const items = allOpportunities(result);
  if (!items.length) return 0;
  const contactable = items.filter(hasContact).length;
  return Math.round((contactable / items.length) * 100);
}

function radarPoints(result) {
  return allOpportunities(result)
    .slice(0, 12)
    .map((item, index) => {
      const complete = hasContact(item);
      const angle = index * 137.5;
      const radius = 24 + (complete ? 6 : 22) + (index % 3) * 7;
      return {
        id: `${item.type}-${item.displayName}-${index}`,
        label: item.displayName,
        high: complete,
        left: 50 + Math.cos((angle * Math.PI) / 180) * radius,
        top: 50 + Math.sin((angle * Math.PI) / 180) * radius,
      };
    });
}

export function ProspectionHeader({ onNewSearch }) {
  return (
    <Paper className="prospection-header" elevation={0}>
      <Box>
        <Typography variant="h4" fontWeight={900} className="prospection-title">
          Assistant de prospection
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Identifiez et centralisez de nouvelles opportunités commerciales.
        </Typography>
      </Box>
      <Button
        variant="outlined"
        startIcon={<RestartAlt />}
        onClick={onNewSearch}
        aria-label="Démarrer une nouvelle recherche"
        sx={{ borderRadius: 1, textTransform: "none", fontWeight: 800 }}
      >
        Nouvelle recherche
      </Button>
    </Paper>
  );
}

ProspectionHeader.propTypes = { onNewSearch: PropTypes.func.isRequired };

export function ProspectionSearchBox({ value, loading, onChange, onSubmit, onSuggestion }) {
  return (
    <Paper className="prospection-search" elevation={0}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box className="prospection-search-icon">
            <AutoFixHigh fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={900}>
              Que recherchez-vous ?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Décrivez votre cible en langage naturel.
            </Typography>
          </Box>
        </Stack>
        <TextField
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ex. Je cherche 15 responsables RH dans des entreprises technologiques en Tunisie."
          multiline
          minRows={3}
          fullWidth
          disabled={loading}
          inputProps={{ "aria-label": "Demande de prospection" }}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress color="inherit" size={18} /> : <Search />}
            disabled={loading || !value.trim()}
            onClick={onSubmit}
            aria-label="Lancer la recherche de prospection"
            sx={{
              bgcolor: "#C8102E",
              borderRadius: 1,
              textTransform: "none",
              fontWeight: 900,
              "&:hover": { bgcolor: "#9B0D22" },
            }}
          >
            Lancer la recherche
          </Button>
          <Typography variant="caption" color="text.secondary">
            Les prospects valides seront centralisés dans le CRM.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
          {SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion}
              label={suggestion}
              clickable
              onClick={() => onSuggestion(suggestion)}
              sx={{ borderRadius: 1, fontWeight: 700 }}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

ProspectionSearchBox.propTypes = {
  value: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onSuggestion: PropTypes.func.isRequired,
};

function ProspectionSignalPanel({ loading, result, progressStep, lastQuery }) {
  const points = radarPoints(result);
  const hasResult = Boolean(result);
  const statusLabel = loading
    ? "Recherche en cours"
    : hasResult
    ? "Recherche finalisée"
    : "Prêt à prospecter";
  const coverage = contactCoverage(result);
  const activeStep = Math.min(progressStep, PROGRESS_STEPS.length - 1);
  const activity = loading
    ? PROGRESS_STEPS.slice(0, activeStep + 1)
    : hasResult
    ? [
        `${result.total} opportunité${result.total > 1 ? "s" : ""} identifiée${
          result.total > 1 ? "s" : ""
        }`,
        `${result.importedCount} ajoutée${result.importedCount > 1 ? "s" : ""} au CRM`,
        result.total > 0 ? "Contacts prêts pour vérification" : "Critères à ajuster",
      ]
    : ["Définissez une cible", "Lancez la recherche", "Consultez les opportunités"];

  return (
    <Paper className="prospection-signal" elevation={0}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={900}>
              Signal de prospection
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {statusLabel}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={
              hasResult ? `${result.total} trouvé${result.total > 1 ? "s" : ""}` : "Assistant IA"
            }
            sx={{ borderRadius: 1, fontWeight: 800 }}
          />
        </Stack>

        <Box className={`prospection-radar ${loading ? "scanning" : ""}`} aria-hidden="true">
          <span className="prospection-radar-ring ring-one" />
          <span className="prospection-radar-ring ring-two" />
          <span className="prospection-radar-axis horizontal" />
          <span className="prospection-radar-axis vertical" />
          <span className="prospection-radar-sweep" />
          <span className="prospection-radar-center" />
          {points.length
            ? points.map((point) => (
                <span
                  key={point.id}
                  className={`prospection-radar-point ${point.high ? "high" : ""}`}
                  title={point.label}
                  style={{ left: `${point.left}%`, top: `${point.top}%` }}
                />
              ))
            : [0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="prospection-radar-point muted"
                  style={{
                    left: `${36 + index * 14}%`,
                    top: `${42 + (index % 2) * 16}%`,
                  }}
                />
              ))}
        </Box>

        <Grid container spacing={1}>
          <Grid item xs={4}>
            <Box className="prospection-mini-metric">
              <Typography variant="caption" color="text.secondary">
                Cible
              </Typography>
              <Typography variant="body2" fontWeight={900} noWrap>
                {lastQuery || "À définir"}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box className="prospection-mini-metric">
              <Typography variant="caption" color="text.secondary">
                Contacts
              </Typography>
              <Typography variant="body2" fontWeight={900}>
                {coverage ? `${coverage} %` : "-"}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box className="prospection-mini-metric">
              <Typography variant="caption" color="text.secondary">
                CRM
              </Typography>
              <Typography variant="body2" fontWeight={900}>
                {result?.importedCount || 0}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Stack spacing={0.75}>
          {activity.map((item, index) => (
            <Box key={`${item}-${index}`} className="prospection-activity-row">
              <CheckCircle fontSize="small" />
              <Typography variant="caption" fontWeight={800}>
                {item}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

ProspectionSignalPanel.propTypes = {
  loading: PropTypes.bool.isRequired,
  result: PropTypes.object,
  progressStep: PropTypes.number.isRequired,
  lastQuery: PropTypes.string,
};

ProspectionSignalPanel.defaultProps = {
  result: null,
  lastQuery: "",
};

export function ProspectionEmptyState() {
  const capabilities = [
    { icon: <ManageSearch />, title: "Recherche ciblée" },
    { icon: <Insights />, title: "Vérification des données" },
    { icon: <Verified />, title: "Centralisation CRM" },
  ];

  return (
    <Paper className="prospection-empty" elevation={0}>
      <Typography variant="h5" fontWeight={900}>
        Transformez une demande en opportunités commerciales.
      </Typography>
      <Typography variant="body2" color="text.secondary" className="prospection-empty-text">
        {
          "Décrivez le type d'entreprises ou de décideurs que vous recherchez. L'assistant identifiera les correspondances les plus pertinentes et les intégrera à votre espace CRM."
        }
      </Typography>
      <Grid container spacing={1.5}>
        {capabilities.map((item) => (
          <Grid item xs={12} md={4} key={item.title}>
            <Box className="prospection-capability">
              {item.icon}
              <Typography variant="body2" fontWeight={800}>
                {item.title}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export function ProspectionProgress({ step }) {
  const activeStep = Math.min(step, PROGRESS_STEPS.length - 1);

  return (
    <Paper className="prospection-progress" elevation={0} role="status" aria-live="polite">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={900}>
            Recherche de prospects en cours
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nous recherchons les opportunités correspondant à vos critères.
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={((activeStep + 1) / PROGRESS_STEPS.length) * 100}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: "#F3F4F6",
            "& .MuiLinearProgress-bar": { bgcolor: "#C8102E" },
          }}
        />
        <Grid container spacing={1}>
          {PROGRESS_STEPS.map((label, index) => (
            <Grid item xs={12} sm={6} md key={label}>
              <Box className={`prospection-step ${index <= activeStep ? "active" : ""}`}>
                <span>{index + 1}</span>
                <Typography variant="caption" fontWeight={800}>
                  {label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  );
}

ProspectionProgress.propTypes = { step: PropTypes.number.isRequired };

function BusinessSummary({ result }) {
  const location = [...result.companies, ...result.persons].map(locationText).find(Boolean);
  const sourceText = result.sources.map(sourceLabel).join(", ");
  const hasResults = result.total > 0;
  const text = hasResults
    ? `L'assistant a identifié ${result.total} opportunité${
        result.total > 1 ? "s" : ""
      } correspondant aux critères saisis${
        location ? `, notamment autour de ${location}` : ""
      }. Les profils disposant des informations les plus complètes sont présentés en priorité.`
    : "Aucune correspondance exacte n'a été identifiée avec les critères actuels.";

  return (
    <Paper className="prospection-panel" elevation={0}>
      <Typography variant="h6" fontWeight={900}>
        Résumé de la recherche
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {text}
      </Typography>
      {sourceText && (
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1, mt: 1.5 }}>
          {result.sources.map((source) => (
            <Chip key={source} size="small" label={sourceLabel(source)} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

BusinessSummary.propTypes = { result: PropTypes.object.isRequired };

function StatCard({ icon, label, value }) {
  return (
    <Paper className="prospection-stat" elevation={0}>
      <Box className="prospection-stat-icon">{icon}</Box>
      <Box>
        <Typography variant="h5" fontWeight={900}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
};

function ProspectionStats({ result }) {
  const cards = [
    { label: "Prospects trouvés", value: result.total, icon: <PersonSearch /> },
    { label: "Entreprises", value: result.companies.length, icon: <Apartment /> },
    { label: "Décideurs", value: result.persons.length, icon: <PeopleAlt /> },
    { label: "Ajoutés au CRM", value: result.importedCount, icon: <CheckCircle /> },
  ];

  return (
    <Grid container spacing={1.5}>
      {cards.map((card) => (
        <Grid item xs={12} sm={6} lg={3} key={card.label}>
          <StatCard {...card} />
        </Grid>
      ))}
    </Grid>
  );
}

ProspectionStats.propTypes = { result: PropTypes.object.isRequired };

function ContactLinks({ item }) {
  const links = [
    item.phone && { label: item.phone, href: `tel:${item.phone}`, type: "Téléphone" },
    item.email && { label: item.email, href: `mailto:${item.email}`, type: "Email" },
    item.website && { label: "Site web", href: item.website, type: "Site web" },
    item.linkedin_url && { label: "LinkedIn", href: item.linkedin_url, type: "LinkedIn" },
    item.facebook_url && { label: "Facebook", href: item.facebook_url, type: "Facebook" },
    item.instagram_url && { label: "Instagram", href: item.instagram_url, type: "Instagram" },
  ].filter(Boolean);

  if (!links.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Informations de contact à compléter.
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
      {links.map((link) => (
        <Button
          key={`${link.type}-${link.href}`}
          component="a"
          href={link.href}
          target={link.href.startsWith("http") ? "_blank" : undefined}
          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
          size="small"
          variant="outlined"
          endIcon={link.href.startsWith("http") ? <OpenInNew fontSize="small" /> : null}
          aria-label={`${link.type} ${link.label}`}
          sx={{ borderRadius: 1, textTransform: "none", fontWeight: 800 }}
        >
          {link.label}
        </Button>
      ))}
    </Stack>
  );
}

ContactLinks.propTypes = { item: PropTypes.object.isRequired };

function CrmStatus({ result }) {
  const label =
    result.importedCount > 0
      ? "Ajouté au CRM"
      : result.existingCount > 0
      ? "Déjà dans le CRM"
      : "Vérifié pour le CRM";

  return (
    <Chip
      icon={<CheckCircle />}
      label={label}
      color="success"
      variant="outlined"
      sx={{ borderRadius: 1, fontWeight: 800 }}
    />
  );
}

CrmStatus.propTypes = { result: PropTypes.object.isRequired };

function OpportunityReason({ item }) {
  const fallback = hasContact(item)
    ? "Cette opportunité correspond aux critères recherchés et dispose d'informations utiles pour une prise de contact."
    : "Cette opportunité correspond aux critères recherchés. Les informations de contact devront être complétées avant action.";

  return (
    <Box className="prospection-reason">
      <Typography variant="caption" color="text.secondary" fontWeight={900}>
        Pourquoi cette opportunité ?
      </Typography>
      <Typography variant="body2">{item.reason || fallback}</Typography>
    </Box>
  );
}

OpportunityReason.propTypes = { item: PropTypes.object.isRequired };

function CompanyProspectCard({ company, result, onOpenCrm }) {
  const address = [company.address, locationText(company)].filter(Boolean).join(", ");

  return (
    <Paper className="prospection-card" elevation={0}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={900} noWrap>
              {company.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[company.sector, locationText(company)].filter(Boolean).join(" · ") || "Entreprise"}
            </Typography>
          </Box>
          <Chip label="Trouvé" sx={{ borderRadius: 1, fontWeight: 900 }} />
        </Stack>
        <ContactLinks item={company} />
        {address && (
          <Button
            component="a"
            href={
              company.google_maps_url ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<LocationOn />}
            size="small"
            sx={{ alignSelf: "flex-start", color: "#C8102E", textTransform: "none" }}
          >
            Voir sur la carte
          </Button>
        )}
        <OpportunityReason item={company} />
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <CrmStatus result={result} />
          <Button
            variant="text"
            endIcon={<Launch />}
            onClick={onOpenCrm}
            sx={{ color: "#C8102E", textTransform: "none", fontWeight: 900 }}
          >
            Voir dans le CRM
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

CompanyProspectCard.propTypes = {
  company: PropTypes.object.isRequired,
  result: PropTypes.object.isRequired,
  onOpenCrm: PropTypes.func.isRequired,
};

function PersonProspectCard({ person, result, onOpenCrm }) {
  return (
    <Paper className="prospection-card" elevation={0}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={900} noWrap>
              {person.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[person.title, person.companyName, locationText(person)]
                .filter(Boolean)
                .join(" · ") || "Décideur"}
            </Typography>
          </Box>
          <Chip label="Trouvé" sx={{ borderRadius: 1, fontWeight: 900 }} />
        </Stack>
        <ContactLinks item={person} />
        <OpportunityReason item={person} />
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <CrmStatus result={result} />
          <Button
            variant="text"
            endIcon={<Launch />}
            onClick={onOpenCrm}
            sx={{ color: "#C8102E", textTransform: "none", fontWeight: 900 }}
          >
            Voir dans le CRM
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

PersonProspectCard.propTypes = {
  person: PropTypes.object.isRequired,
  result: PropTypes.object.isRequired,
  onOpenCrm: PropTypes.func.isRequired,
};

export function ProspectionErrorState({ query, onRetry, onModify }) {
  return (
    <Paper className="prospection-error" elevation={0}>
      <Alert severity="warning" sx={{ borderRadius: 1 }}>
        <Typography variant="body2" fontWeight={900}>
          {cleanErrorMessage()}
        </Typography>
        <Typography variant="body2">
          Vous pouvez réessayer dans quelques instants ou modifier vos critères.
        </Typography>
      </Alert>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="contained" onClick={() => onRetry(query)} sx={{ bgcolor: "#C8102E" }}>
          Réessayer
        </Button>
        <Button variant="outlined" onClick={onModify}>
          Modifier la recherche
        </Button>
      </Stack>
    </Paper>
  );
}

ProspectionErrorState.propTypes = {
  query: PropTypes.string.isRequired,
  onRetry: PropTypes.func.isRequired,
  onModify: PropTypes.func.isRequired,
};

function EmptyResults({ onModify, onNewSearch }) {
  return (
    <Paper className="prospection-empty-results" elevation={0}>
      <Typography variant="h6" fontWeight={900}>
        {"Aucun prospect correspondant exactement à votre recherche n'a été identifié."}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {"Essayez d'élargir vos critères ou de modifier la localisation recherchée."}
      </Typography>
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={onModify}>
          Modifier la recherche
        </Button>
        <Button variant="contained" onClick={onNewSearch} sx={{ bgcolor: "#C8102E" }}>
          Nouvelle recherche
        </Button>
      </Stack>
    </Paper>
  );
}

EmptyResults.propTypes = {
  onModify: PropTypes.func.isRequired,
  onNewSearch: PropTypes.func.isRequired,
};

function ProspectionResults({ result, filter, onFilter, onModify, onNewSearch, onOpenCrm }) {
  const cards = [
    ...result.companies.map((item) => ({ item, type: "company" })),
    ...result.persons.map((item) => ({ item, type: "person" })),
  ].filter((entry) => filter === "all" || entry.type === filter);

  const lowResults = result.total > 0 && result.total < 3;

  return (
    <Stack spacing={2.5}>
      <Paper className="prospection-result-head" elevation={0}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="h5" fontWeight={900}>
              Prospection terminée
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {result.total} opportunité{result.total > 1 ? "s" : ""} correspondant à votre
              recherche {result.total > 1 ? "ont été identifiées" : "a été identifiée"}.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            endIcon={<Launch />}
            onClick={onOpenCrm}
            sx={{ alignSelf: { xs: "flex-start", md: "center" }, textTransform: "none" }}
          >
            Ouvrir les prospects CRM
          </Button>
        </Stack>
      </Paper>

      <ProspectionStats result={result} />
      <BusinessSummary result={result} />

      {lowResults && (
        <Alert severity="info" sx={{ borderRadius: 1 }}>
          <Typography variant="body2" fontWeight={900}>
            Peu de correspondances ont été trouvées avec ces critères.
          </Typography>
          <Typography variant="body2">
            Vous pouvez élargir la zone géographique, retirer un critère trop précis, rechercher un
            secteur proche ou relancer la recherche.
          </Typography>
        </Alert>
      )}

      {result.total === 0 ? (
        <EmptyResults onModify={onModify} onNewSearch={onNewSearch} />
      ) : (
        <Paper className="prospection-panel" elevation={0}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between">
              <Typography variant="h6" fontWeight={900}>
                Résultats
              </Typography>
              <Tabs value={filter} onChange={(_, value) => onFilter(value)} aria-label="Filtres">
                <Tab value="all" label="Tous" />
                <Tab value="company" label="Entreprises" />
                <Tab value="person" label="Personnes" />
              </Tabs>
            </Stack>
            <Grid container spacing={1.5}>
              {cards.map(({ item, type }, index) => (
                <Grid
                  item
                  xs={12}
                  lg={6}
                  key={`${type}-${item.sourceUrl || item.displayName}-${index}`}
                >
                  {type === "company" ? (
                    <CompanyProspectCard company={item} result={result} onOpenCrm={onOpenCrm} />
                  ) : (
                    <PersonProspectCard person={item} result={result} onOpenCrm={onOpenCrm} />
                  )}
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

ProspectionResults.propTypes = {
  result: PropTypes.object.isRequired,
  filter: PropTypes.string.isRequired,
  onFilter: PropTypes.func.isRequired,
  onModify: PropTypes.func.isRequired,
  onNewSearch: PropTypes.func.isRequired,
  onOpenCrm: PropTypes.func.isRequired,
};

export default function ProspectionWorkspace() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [filter, setFilter] = useState("all");
  const progressTimerRef = useRef(null);

  const normalizedResult = useMemo(
    () => (result ? normalizeProspectionResult(result) : null),
    [result]
  );

  useEffect(
    () => () => {
      clearInterval(progressTimerRef.current);
    },
    []
  );

  const reset = useCallback(() => {
    setQuery("");
    setLastQuery("");
    setResult(null);
    setError(null);
    setFilter("all");
    setProgressStep(0);
  }, []);

  const submitSearch = useCallback(
    async (forcedQuery) => {
      const searchText = String(forcedQuery || query || "").trim();
      if (!searchText || loading) return;

      setLoading(true);
      setError(null);
      setResult(null);
      setLastQuery(searchText);
      setFilter("all");
      setProgressStep(0);

      clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        setProgressStep((current) => Math.min(current + 1, PROGRESS_STEPS.length - 1));
      }, 1800);

      try {
        const response = await searchProspectsAgent({ query: searchText });
        setResult(response);
      } catch {
        setError({ query: searchText, message: cleanErrorMessage() });
      } finally {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
        setProgressStep(PROGRESS_STEPS.length - 1);
        setLoading(false);
      }
    },
    [loading, query]
  );

  const modifySearch = useCallback(() => {
    setQuery(lastQuery);
    setError(null);
  }, [lastQuery]);

  const openCrm = useCallback(() => {
    navigate("/prospects");
  }, [navigate]);

  return (
    <Box className="prospection-workspace">
      <Stack spacing={2.5}>
        <ProspectionHeader onNewSearch={reset} />
        <Grid container spacing={2.5} alignItems="stretch">
          <Grid item xs={12} lg={8}>
            <ProspectionSearchBox
              value={query}
              loading={loading}
              onChange={setQuery}
              onSubmit={() => submitSearch()}
              onSuggestion={setQuery}
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <ProspectionSignalPanel
              loading={loading}
              result={normalizedResult}
              progressStep={progressStep}
              lastQuery={lastQuery || query}
            />
          </Grid>
        </Grid>
        {loading && <ProspectionProgress step={progressStep} />}
        {!loading && error && (
          <ProspectionErrorState
            query={error.query}
            onRetry={submitSearch}
            onModify={modifySearch}
          />
        )}
        {!loading && !error && !normalizedResult && <ProspectionEmptyState />}
        {!loading && !error && normalizedResult && (
          <ProspectionResults
            result={normalizedResult}
            filter={filter}
            onFilter={setFilter}
            onModify={modifySearch}
            onNewSearch={reset}
            onOpenCrm={openCrm}
          />
        )}
      </Stack>
    </Box>
  );
}
