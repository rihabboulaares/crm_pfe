/* eslint-disable prettier/prettier */
// src/components/CRMCalendar/CRMCalendar.jsx
import React, { useState, useRef, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import {
  Box,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
  Stack,
  Typography,
  Alert,
  Badge,
  Fade,
  Paper,
  useTheme,
  alpha,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import TodayIcon from "@mui/icons-material/Today";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useCalendarEvents, COLOR_MAP, PRIORITY_LABELS } from "hooks/useCalendarEvents";
import EventModal from "./EventModal";
import CalendarFilters from "./CalendarFilters";

const CRM_RED = {
  main: "#C62828",
  accent: "#E53935",
  light: "#EF9A9A",
  dark: "#8B0000",
  surface: "#FFEBEE",
  border: "#FFCDD2",
  hover: "#FFE4E6",
  panel: "#FFF7F7",
  ink: "#241315",
  muted: "#786264",
  white: "#FFFFFF",
};

// â”TNDâ”TND Icônes par type d'événement ET par type d'activité â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
const TYPE_ICONS = {
  task: "TA",
  meeting: "RD",
  deadline: "EC",
  reminder: "RA",
  stage: "ST",
  activity: "AC",
  pipeline_alert: "AL",
  call: "AP",
  email: "EM",
  note: "NO",
  status_change: "MA",
};

const TYPE_STYLES = {
  task: { color: "#C62828", bg: "#FFF1F2", border: "#F8B4BE", label: "Tache" },
  meeting: { color: "#0F766E", bg: "#ECFDF5", border: "#99F6E4", label: "RDV" },
  deadline: { color: "#9F1239", bg: "#FFE4E6", border: "#FDA4AF", label: "Echeance" },
  reminder: { color: "#B45309", bg: "#FFFBEB", border: "#FCD34D", label: "Rappel" },
  stage: { color: "#4338CA", bg: "#EEF2FF", border: "#C7D2FE", label: "Pipeline" },
  activity: { color: "#0369A1", bg: "#EFF6FF", border: "#BFDBFE", label: "Activite" },
  pipeline_alert: { color: "#7F1D1D", bg: "#FEF2F2", border: "#FCA5A5", label: "Alerte" },
};

const VIEWS = [
  { id: "dayGridMonth", label: "Mois", icon: ViewModuleIcon },
  { id: "timeGridWeek", label: "Semaine", icon: ViewWeekIcon },
  { id: "timeGridDay", label: "Jour", icon: TodayIcon },
  { id: "listWeek", label: "Liste", icon: ViewListIcon },
];

const frLocale = {
  code: "fr",
  week: { dow: 1, doy: 4 },
  buttonText: {
    prev: "Précédent",
    next: "Suivant",
    today: "Aujourd'hui",
    month: "Mois",
    week: "Semaine",
    day: "Jour",
    list: "Agenda",
  },
  weekText: "Sem.",
  allDayText: "Toute la journée",
  moreLinkText: "en plus",
  noEventsText: "Aucun événement à afficher",
};

const RED_THEME_CSS = `
  .fc {
    --fc-border-color:#F4D4D8!important;
    --fc-page-bg-color:#FFFFFF!important;
    --fc-neutral-bg-color:#FFF7F7!important;
    --fc-today-bg-color:#FFF5F5!important;
    color:#241315!important;
  }
  .fc .fc-scrollgrid {
    border:1px solid #F0C9CE!important;
    border-radius:14px!important;
    overflow:hidden!important;
    background:#fff!important;
  }
  .fc .fc-col-header-cell {
    background:#FFF7F7!important;
    border-color:#F0C9CE!important;
    padding:10px 0!important;
  }
  .fc .fc-col-header-cell-cushion {
    color:#8B0000!important;
    font-weight:800!important;
    text-transform:uppercase!important;
    letter-spacing:0!important;
    font-size:0.72rem!important;
    text-decoration:none!important;
  }
  .fc .fc-daygrid-day,
  .fc .fc-timegrid-slot,
  .fc .fc-timegrid-axis,
  .fc .fc-timegrid-col {
    border-color:#F5DEE1!important;
  }
  .fc .fc-daygrid-day-frame { min-height:112px!important; padding:4px!important; }
  .fc .fc-daygrid-day:hover { background:#FFFBFB!important; }
  .fc .fc-day-today { background:#FFF5F5!important; box-shadow:inset 0 0 0 1px #C62828!important; }
  .fc .fc-daygrid-day-number {
    color:#6D5558!important;
    font-weight:700!important;
    font-size:0.78rem!important;
    text-decoration:none!important;
    width:28px!important;
    height:28px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    border-radius:8px!important;
    margin:4px!important;
  }
  .fc .fc-day-today .fc-daygrid-day-number {
    background:#C62828!important;
    color:#fff!important;
    box-shadow:0 6px 14px rgba(198,40,40,0.22)!important;
  }
  .fc .fc-day-other { background:#FFFDFD!important; }
  .fc .fc-day-other .fc-daygrid-day-number { color:#BBA2A5!important; }
  .fc .fc-event {
    border-radius:10px!important;
    border:1px solid rgba(36,19,21,0.08)!important;
    cursor:pointer!important;
    margin:2px 4px!important;
    padding:0!important;
    overflow:hidden!important;
    box-shadow:0 4px 10px rgba(36,19,21,0.06)!important;
    transition:transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease!important;
  }
  .fc .fc-event:hover {
    transform:translateY(-1px)!important;
    filter:brightness(1.02)!important;
    box-shadow:0 8px 18px rgba(36,19,21,0.13)!important;
  }
  .fc .fc-daygrid-event { white-space:normal!important; }
  .fc .fc-daygrid-more-link {
    color:#C62828!important;
    font-size:0.72rem!important;
    font-weight:800!important;
    padding-left:6px!important;
  }
  .fc .fc-timegrid-slot-label-cushion,
  .fc .fc-list-event-time { color:#786264!important; font-size:0.72rem!important; }
  .fc .fc-timegrid-now-indicator-line { border-color:#C62828!important; border-width:2px!important; }
  .fc .fc-timegrid-now-indicator-arrow { border-top-color:#C62828!important; border-bottom-color:#C62828!important; }
  .fc .fc-list { border-color:#F0C9CE!important; }
  .fc .fc-list-day-cushion { background:#FFF1F2!important; }
  .fc .fc-list-day-text,.fc .fc-list-day-side-text { color:#8B0000!important; font-weight:800!important; }
  .fc .fc-list-event:hover td { background-color:#FFF7F7!important; }
  @keyframes calendarFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .fc-event { animation:calendarFadeIn 0.22s ease!important; }
`;

function injectRedTheme() {
  if (document.getElementById("crm-calendar-enhanced-theme")) return;
  const style = document.createElement("style");
  style.id = "crm-calendar-enhanced-theme";
  style.textContent = RED_THEME_CSS;
  document.head.appendChild(style);
}

export default function CRMCalendar() {
  injectRedTheme();
  const theme = useTheme();
  const calendarRef = useRef(null);

  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEventDates, setNewEventDates] = useState(null);
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [currentTitle, setCurrentTitle] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    events,
    loading,
    error,
    fetchEvents,
    fetchPipelines,
    fetchStages,
    fetchUsers,
    fetchTasks,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useCalendarEvents(filters);

  const handleDatesSet = useCallback(
    async ({ startStr, endStr, view }) => {
      setCurrentTitle(view?.title || "");
      await fetchEvents(startStr, endStr);
    },
    [fetchEvents]
  );

  const handleEventClick = ({ event }) => {
    const ep = event.extendedProps;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.startStr,
      end: event.endStr,
      allDay: event.allDay,
      // Champs généraux
      eventType: ep.eventType,
      priority: ep.priority,
      description: ep.description,
      color: ep.color,
      colorResolved: ep.colorResolved,
      isSynced: ep.isSynced,
      isVirtualTaskEvent: ep.isVirtualTaskEvent,
      reminder: ep.reminder,
      // Task
      task: ep.task,
      taskTitle: ep.taskTitle,
      taskStatus: ep.taskStatus,
      taskIsOverdue: ep.taskIsOverdue,
      // Opportunity
      opportunity: ep.opportunity,
      opportunityName: ep.opportunityName,
      opportunityStage: ep.opportunityStage,
      opportunityAmount: ep.opportunityAmount,
      // Pipeline
      pipelineStage: ep.pipelineStage,
      stageName: ep.stageName,
      pipelineName: ep.pipelineName,
      // OpportunityPipeline
      opportunityPipeline: ep.opportunityPipeline,
      opStatus: ep.opStatus,
      opProgression: ep.opProgression,
      // Activity
      taskActivity: ep.taskActivity,
      activityType: ep.activityType,
      activityResult: ep.activityResult,
      meetingLocation: ep.meetingLocation,
      // Alert
      pipelineAlert: ep.pipelineAlert,
      alertType: ep.alertType,
      alertSeverity: ep.alertSeverity,
      alertIsRead: ep.alertIsRead,
      // Assigné
      assignedTo: ep.assignedTo,
      assignedName: ep.assignedName,
    });
    setModalOpen(true);
  };

  const handleDateSelect = ({ startStr, endStr, allDay }) => {
    setSelectedEvent(null);
    setNewEventDates({ start: startStr, end: endStr, allDay });
    setModalOpen(true);
  };

  const handleEventDrop = async ({ event }) => {
    try {
      await updateEvent(event.id, { start: event.startStr, end: event.endStr });
      const cal = calendarRef.current?.getApi();
      if (cal)
        await fetchEvents(cal.view.currentStart.toISOString(), cal.view.currentEnd.toISOString());
    } catch (err) {
      console.error("Failed to update event:", err);
    }
  };

  const handleEventResize = async ({ event }) => {
    try {
      await updateEvent(event.id, { start: event.startStr, end: event.endStr });
      const cal = calendarRef.current?.getApi();
      if (cal)
        await fetchEvents(cal.view.currentStart.toISOString(), cal.view.currentEnd.toISOString());
    } catch (err) {
      console.error("Failed to resize event:", err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const cal = calendarRef.current?.getApi();
    if (cal)
      await fetchEvents(cal.view.currentStart.toISOString(), cal.view.currentEnd.toISOString());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleViewChange = (viewId) => {
    setCurrentView(viewId);
    calendarRef.current?.getApi()?.changeView(viewId);
  };

  const handleNavigate = (direction) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (direction === "prev") api.prev();
    if (direction === "next") api.next();
    if (direction === "today") api.today();
  };

  // â”TNDâ”TND Rendu de chaque événement â”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TNDâ”TND
  const renderEvent = ({ event }) => {
    const {
      priority,
      eventType,
      activityType,
      assignedName,
      stageName,
      opportunityName,
      description,
      alertSeverity,
      opStatus,
      taskIsOverdue,
    } = event.extendedProps;

    const iconKey = eventType === "activity" && activityType ? activityType : eventType;
    const marker = TYPE_ICONS[iconKey] || "EV";
    const style = TYPE_STYLES[eventType] || TYPE_STYLES.task;
    const priorityLabel = PRIORITY_LABELS[priority] || priority || "Normale";

    const tooltipLines = [
      event.title,
      description && `Note: ${description.slice(0, 100)}${description.length > 100 ? "..." : ""}`,
      stageName && `Etape: ${stageName}`,
      opportunityName && `Opportunite: ${opportunityName}`,
      assignedName && `Assigne a: ${assignedName}`,
      alertSeverity && `Severite: ${alertSeverity}`,
      opStatus && `Statut pipeline: ${opStatus}`,
      taskIsOverdue && "Tache en retard",
      `Priorite: ${priorityLabel}`,
    ].filter(Boolean);

    return (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            {tooltipLines.map((line, index) => (
              <Typography
                key={line}
                variant="caption"
                display="block"
                sx={{ color: "#fff", mt: index > 0 ? 0.5 : 0 }}
              >
                {line}
              </Typography>
            ))}
          </Box>
        }
        arrow
        placement="top"
        enterDelay={350}
      >
        <Box
          sx={{
            minHeight: 28,
            px: 0.7,
            py: 0.45,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            gap: 0.7,
            lineHeight: 1.2,
            background: `linear-gradient(135deg, ${style.bg} 0%, #fff 120%)`,
            color: style.color,
            borderLeft: `3px solid ${style.color}`,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 24,
              height: 20,
              borderRadius: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              bgcolor: style.color,
              color: "#fff",
              fontSize: "0.58rem",
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            {marker}
          </Box>
          <Typography
            component="span"
            sx={{
              minWidth: 0,
              flex: 1,
              color: CRM_RED.ink,
              fontSize: "0.74rem",
              fontWeight: 750,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </Typography>
          {priority && priority !== "medium" && (
            <Box
              component="span"
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                flexShrink: 0,
                bgcolor: COLOR_MAP[priority] || CRM_RED.main,
                boxShadow: `0 0 0 3px ${alpha(COLOR_MAP[priority] || CRM_RED.main, 0.16)}`,
              }}
            />
          )}
          {taskIsOverdue && (
            <Box
              component="span"
              sx={{
                px: 0.45,
                height: 18,
                minWidth: 18,
                borderRadius: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                bgcolor: "#7F1D1D",
                color: "#fff",
                fontSize: "0.64rem",
                fontWeight: 900,
              }}
            >
              !
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };
  const refreshCalendar = useCallback(async () => {
    setModalOpen(false);
    const cal = calendarRef.current?.getApi();
    if (cal)
      await fetchEvents(cal.view.currentStart.toISOString(), cal.view.currentEnd.toISOString());
  }, [fetchEvents]);

  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).filter((v) => v && v !== "" && (!Array.isArray(v) || v.length > 0))
        .length,
    [filters]
  );

  const eventStats = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    return {
      total: events.length,
      tasks: events.filter((event) => event.extendedProps?.eventType === "task").length,
      today: events.filter((event) => String(event.start || "").slice(0, 10) === todayKey).length,
      urgent: events.filter(
        (event) => event.extendedProps?.priority === "high" || event.extendedProps?.taskIsOverdue
      ).length,
    };
  }, [events]);

  return (
    <Fade in timeout={300}>
      <Box sx={{ position: "relative" }}>
        {/* Barre d'outils */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            p: { xs: 1.5, md: 2 },
            borderRadius: 3,
            border: `1px solid ${CRM_RED.border}`,
            bgcolor: CRM_RED.white,
            boxShadow: "0 16px 42px rgba(139,0,0,0.08)",
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              alignItems={{ xs: "stretch", lg: "center" }}
              justifyContent="space-between"
              gap={1.5}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    color: CRM_RED.dark,
                    fontSize: { xs: "1.05rem", md: "1.35rem" },
                    fontWeight: 900,
                    lineHeight: 1.15,
                    textTransform: "capitalize",
                  }}
                >
                  {currentTitle || "Calendrier CRM"}
                </Typography>
                <Typography sx={{ color: CRM_RED.muted, fontSize: "0.78rem", mt: 0.4 }}>
                  Vue consolidee des taches, rendez-vous, rappels et alertes commerciales.
                </Typography>
              </Box>

              <Stack direction="row" flexWrap="wrap" gap={1}>
                {[
                  { label: "Evenements", value: eventStats.total, color: CRM_RED.main },
                  { label: "Taches", value: eventStats.tasks, color: "#C62828" },
                  { label: "Aujourd'hui", value: eventStats.today, color: "#0F766E" },
                  { label: "Urgents", value: eventStats.urgent, color: "#7F1D1D" },
                ].map((stat) => (
                  <Box
                    key={stat.label}
                    sx={{
                      minWidth: 98,
                      px: 1.25,
                      py: 0.85,
                      borderRadius: 2,
                      bgcolor: alpha(stat.color, 0.08),
                      border: `1px solid ${alpha(stat.color, 0.18)}`,
                    }}
                  >
                    <Typography sx={{ color: stat.color, fontSize: "1rem", fontWeight: 900 }}>
                      {stat.value}
                    </Typography>
                    <Typography sx={{ color: CRM_RED.muted, fontSize: "0.68rem", fontWeight: 700 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: "column", md: "row" }}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
              gap={1.25}
              sx={{
                p: 1,
                borderRadius: 2.5,
                bgcolor: CRM_RED.panel,
                border: `1px solid ${CRM_RED.border}`,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <IconButton
                  onClick={() => handleNavigate("prev")}
                  size="small"
                  sx={{
                    bgcolor: CRM_RED.white,
                    border: `1px solid ${CRM_RED.border}`,
                    color: CRM_RED.dark,
                    "&:hover": { bgcolor: CRM_RED.hover, borderColor: CRM_RED.main },
                  }}
                >
                  <ChevronLeftIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Box
                  component="button"
                  type="button"
                  onClick={() => handleNavigate("today")}
                  sx={{
                    height: 34,
                    px: 1.5,
                    border: `1px solid ${CRM_RED.border}`,
                    borderRadius: 2,
                    bgcolor: CRM_RED.white,
                    color: CRM_RED.main,
                    fontWeight: 850,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    "&:hover": { bgcolor: CRM_RED.hover, borderColor: CRM_RED.main },
                  }}
                >
                  Aujourd&apos;hui
                </Box>
                <IconButton
                  onClick={() => handleNavigate("next")}
                  size="small"
                  sx={{
                    bgcolor: CRM_RED.white,
                    border: `1px solid ${CRM_RED.border}`,
                    color: CRM_RED.dark,
                    "&:hover": { bgcolor: CRM_RED.hover, borderColor: CRM_RED.main },
                  }}
                >
                  <ChevronRightIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {VIEWS.map((view) => {
                  const Icon = view.icon;
                  const isActive = currentView === view.id;
                  return (
                    <Box
                      key={view.id}
                      component="button"
                      type="button"
                      onClick={() => handleViewChange(view.id)}
                      sx={{
                        height: 34,
                        px: 1.15,
                        borderRadius: 2,
                        border: `1px solid ${isActive ? CRM_RED.main : CRM_RED.border}`,
                        bgcolor: isActive ? CRM_RED.main : CRM_RED.white,
                        color: isActive ? "#fff" : CRM_RED.dark,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.65,
                        fontSize: "0.76rem",
                        fontWeight: 850,
                        cursor: "pointer",
                        boxShadow: isActive ? "0 8px 18px rgba(198,40,40,0.22)" : "none",
                        "&:hover": { bgcolor: isActive ? CRM_RED.dark : CRM_RED.hover },
                      }}
                    >
                      <Icon sx={{ fontSize: 16 }} />
                      {view.label}
                    </Box>
                  );
                })}
              </Stack>

              <Stack direction="row" alignItems="center" spacing={1}>
                {(loading || isRefreshing) && (
                  <CircularProgress size={20} sx={{ color: CRM_RED.main }} />
                )}
                {error && (
                  <Alert severity="error" sx={{ py: 0, px: 1, borderRadius: 2 }} icon={false}>
                    <Typography variant="caption">{error}</Typography>
                  </Alert>
                )}
                <Tooltip title="Rafraichir">
                  <IconButton
                    onClick={handleRefresh}
                    size="small"
                    sx={{
                      bgcolor: CRM_RED.white,
                      border: `1px solid ${CRM_RED.border}`,
                      color: CRM_RED.main,
                      "&:hover": { bgcolor: CRM_RED.hover },
                    }}
                  >
                    <RefreshIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={showFilters ? "Masquer les filtres" : "Afficher les filtres"}>
                  <Badge
                    badgeContent={activeFilterCount}
                    color="error"
                    invisible={activeFilterCount === 0}
                  >
                    <IconButton
                      onClick={() => setShowFilters((v) => !v)}
                      size="small"
                      sx={{
                        bgcolor: showFilters ? CRM_RED.main : CRM_RED.white,
                        color: showFilters ? "#fff" : CRM_RED.main,
                        border: `1px solid ${showFilters ? CRM_RED.main : CRM_RED.border}`,
                        "&:hover": { bgcolor: showFilters ? CRM_RED.dark : CRM_RED.hover },
                      }}
                    >
                      <FilterListIcon fontSize="small" />
                    </IconButton>
                  </Badge>
                </Tooltip>
              </Stack>
            </Stack>

            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {Object.entries(TYPE_STYLES).map(([type, item]) => (
                <Chip
                  key={type}
                  label={item.label}
                  size="small"
                  sx={{
                    height: 24,
                    borderRadius: 1.5,
                    bgcolor: item.bg,
                    color: item.color,
                    border: `1px solid ${item.border}`,
                    fontSize: "0.68rem",
                    fontWeight: 850,
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
        {/* Filtres */}
        {showFilters && (
          <Fade in={showFilters}>
            <Box sx={{ mb: 2.5 }}>
              <CalendarFilters
                filters={filters}
                onChange={setFilters}
                fetchPipelines={fetchPipelines}
                fetchStages={fetchStages}
                fetchUsers={fetchUsers}
              />
            </Box>
          </Fade>
        )}

        {/* Calendrier FullCalendar */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            border: `1px solid ${CRM_RED.border}`,
            "& .fc": { fontFamily: theme.typography.fontFamily },
            "& .fc-event": {
              borderRadius: "10px!important",
              cursor: "pointer",
            },
          }}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={currentView}
            locale={frLocale}
            headerToolbar={false}
            events={events}
            editable
            selectable
            selectMirror
            dayMaxEvents={3}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventContent={renderEvent}
            height="auto"
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            scrollTime="08:00:00"
            businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "18:00" }}
            nowIndicator
            weekends
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            eventDidMount={(info) => {
              info.el.style.backgroundColor = "transparent";
              info.el.style.borderColor = "transparent";
              info.el.style.opacity = "1";
              // Indicateur visuel si tâche en retard
              if (info.event.extendedProps?.taskIsOverdue) {
                info.el.style.outline = "2px solid #7F1D1D";
              }
            }}
          />
        </Paper>

        {/* Modale événement */}
        <EventModal
          open={modalOpen}
          event={selectedEvent}
          defaultDates={newEventDates}
          onClose={() => setModalOpen(false)}
          onCreate={createEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
          onSaved={refreshCalendar}
          fetchTasks={fetchTasks}
          fetchPipelines={fetchPipelines}
          fetchStages={fetchStages}
          fetchUsers={fetchUsers}
        />
      </Box>
    </Fade>
  );
}




