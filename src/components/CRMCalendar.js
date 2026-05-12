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
  light: "#EF9A9A",
  dark: "#8B0000",
  surface: "#FFEBEE",
  border: "#FFCDD2",
  hover: "#FFE4E6",
};

// ── Icônes par type d'événement ET par type d'activité ───────────────────────
const TYPE_ICONS = {
  // Types d'événements
  task: "✅",
  meeting: "📅",
  deadline: "⏰",
  reminder: "🔔",
  stage: "🏁",
  activity: "📝", // fallback si activityType absent
  pipeline_alert: "⚠️",
  // Types d'activités CRM (utilisés quand eventType === 'activity')
  call: "📞",
  email: "📧",
  note: "📝",
  status_change: "🔄",
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
  .fc { --fc-border-color:#FFCDD2!important; --fc-today-bg-color:#FFF3F3!important;
        --fc-button-bg-color:#C62828!important; --fc-button-border-color:#C62828!important;
        --fc-button-hover-bg-color:#8B0000!important; --fc-button-hover-border-color:#8B0000!important;
        --fc-button-active-bg-color:#8B0000!important; --fc-button-active-border-color:#8B0000!important; }
  .fc .fc-toolbar-title { font-size:1.25rem!important; font-weight:700!important; color:#8B0000!important; }
  .fc .fc-button-primary { background-color:#C62828!important; border-color:#C62828!important;
        border-radius:8px!important; font-weight:600!important; text-transform:capitalize!important;
        transition:all 0.2s ease!important; }
  .fc .fc-button-primary:hover { background-color:#8B0000!important; transform:translateY(-1px)!important;
        box-shadow:0 2px 8px rgba(198,40,40,0.3)!important; }
  .fc .fc-button-primary:disabled { background-color:#EF9A9A!important; opacity:0.6!important; }
  .fc .fc-day-today { background-color:#FFF3F3!important; }
  .fc .fc-day-today .fc-daygrid-day-number { background-color:#C62828!important; color:#fff!important;
        border-radius:50%!important; width:28px!important; height:28px!important;
        display:flex!important; align-items:center!important; justify-content:center!important; font-weight:700!important; }
  .fc .fc-col-header-cell { background:linear-gradient(135deg,#FFEBEE 0%,#FFE4E6 100%)!important;
        border-color:#FFCDD2!important; padding:8px 0!important; }
  .fc .fc-col-header-cell-cushion { color:#8B0000!important; font-weight:700!important;
        text-transform:uppercase!important; letter-spacing:0.5px!important; font-size:0.75rem!important;
        text-decoration:none!important; }
  .fc .fc-daygrid-day { transition:background 0.2s ease!important; }
  .fc .fc-daygrid-day:hover { background:#FFF9F9!important; }
  .fc .fc-daygrid-day-number { color:#555!important; font-weight:500!important; font-size:0.85rem!important;
        text-decoration:none!important; }
  .fc .fc-event { border-radius:8px!important; border:none!important; cursor:pointer!important;
        transition:all 0.2s ease!important; margin:2px 4px!important; padding:2px 4px!important; }
  .fc .fc-event:hover { transform:translateY(-1px)!important; filter:brightness(1.05)!important;
        box-shadow:0 2px 8px rgba(0,0,0,0.15)!important; }
  .fc .fc-daygrid-event { white-space:normal!important; }
  .fc .fc-list-event:hover td { background-color:#FFEBEE!important; }
  .fc .fc-list-day-cushion { background:linear-gradient(135deg,#FFEBEE 0%,#FFE4E6 100%)!important; }
  .fc .fc-list-day-text,.fc .fc-list-day-side-text { color:#C62828!important; font-weight:700!important; }
  .fc .fc-timegrid-now-indicator-line { border-color:#C62828!important; border-width:2px!important; }
  .fc .fc-timegrid-now-indicator-arrow { border-top-color:#C62828!important; border-bottom-color:#C62828!important; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .fc-event { animation:fadeIn 0.3s ease!important; }
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
    async ({ startStr, endStr }) => {
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

  // ── Rendu de chaque événement ──────────────────────────────────────────────
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

    // Pour les activités CRM, on affine l'icône selon activityType
    const iconKey = eventType === "activity" && activityType ? activityType : eventType;
    const icon = TYPE_ICONS[iconKey] || "📌";

    const tooltipLines = [
      event.title,
      description && `📝 ${description.slice(0, 100)}${description.length > 100 ? "..." : ""}`,
      stageName && `🏁 ${stageName}`,
      opportunityName && `💰 ${opportunityName}`,
      assignedName && `👤 ${assignedName}`,
      alertSeverity && `🚨 Sévérité : ${alertSeverity}`,
      opStatus && `📊 Statut pipeline : ${opStatus}`,
      taskIsOverdue && "⚠️ Tâche en retard",
      `🔴 Priorité : ${PRIORITY_LABELS[priority] || priority}`,
    ].filter(Boolean);

    return (
      <Tooltip
        title={
          <Box sx={{ p: 0.5 }}>
            {tooltipLines.map((l, i) => (
              <Typography
                key={i}
                variant="caption"
                display="block"
                sx={{ color: "#fff", mt: i > 0 ? 0.5 : 0 }}
              >
                {l}
              </Typography>
            ))}
          </Box>
        }
        arrow
        placement="top"
        enterDelay={500}
      >
        <Box
          sx={{
            px: 0.8,
            py: 0.3,
            fontSize: "0.75rem",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            gap: 0.6,
            whiteSpace: "normal",
            lineHeight: 1.3,
          }}
        >
          <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              fontWeight: 500,
            }}
          >
            {event.title}
          </span>
          {priority && priority !== "medium" && (
            <Chip
              label={PRIORITY_LABELS[priority]?.charAt(0) || priority.charAt(0).toUpperCase()}
              size="small"
              sx={{
                height: 18,
                width: 18,
                fontSize: "0.65rem",
                fontWeight: 700,
                flexShrink: 0,
                bgcolor: COLOR_MAP[priority] || "#999",
                color: "#fff",
                "& .MuiChip-label": { px: 0.3 },
              }}
            />
          )}
          {taskIsOverdue && (
            <Chip
              label="!"
              size="small"
              sx={{
                height: 18,
                width: 18,
                fontSize: "0.65rem",
                fontWeight: 700,
                flexShrink: 0,
                bgcolor: "#f44336",
                color: "#fff",
                "& .MuiChip-label": { px: 0.3 },
              }}
            />
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

  return (
    <Fade in timeout={300}>
      <Box sx={{ position: "relative" }}>
        {/* Barre d'outils */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            p: 1.5,
            borderRadius: 3,
            border: `1.5px solid ${CRM_RED.border}`,
            bgcolor: CRM_RED.surface,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1.5}
          >
            {/* Navigation */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton
                onClick={() => handleNavigate("prev")}
                size="small"
                sx={{
                  bgcolor: "#fff",
                  border: `1px solid ${CRM_RED.border}`,
                  "&:hover": { bgcolor: CRM_RED.hover, borderColor: CRM_RED.main },
                }}
              >
                <ChevronLeftIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <IconButton
                onClick={() => handleNavigate("today")}
                size="small"
                sx={{
                  bgcolor: "#fff",
                  border: `1px solid ${CRM_RED.border}`,
                  px: 1.5,
                  borderRadius: 2,
                  "&:hover": { bgcolor: CRM_RED.hover, borderColor: CRM_RED.main },
                }}
              >
                <Typography variant="body2" fontWeight={600} color={CRM_RED.main}>
                  Aujourd&apos;hui
                </Typography>
              </IconButton>
              <IconButton
                onClick={() => handleNavigate("next")}
                size="small"
                sx={{
                  bgcolor: "#fff",
                  border: `1px solid ${CRM_RED.border}`,
                  "&:hover": { bgcolor: CRM_RED.hover, borderColor: CRM_RED.main },
                }}
              >
                <ChevronRightIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Stack>

            {/* Sélecteur de vue */}
            <Stack direction="row" spacing={0.5}>
              {VIEWS.map((view) => {
                const Icon = view.icon;
                const isActive = currentView === view.id;
                return (
                  <Tooltip key={view.id} title={view.label}>
                    <IconButton
                      onClick={() => handleViewChange(view.id)}
                      size="small"
                      sx={{
                        bgcolor: isActive ? CRM_RED.main : "#fff",
                        color: isActive ? "#fff" : CRM_RED.main,
                        border: `1px solid ${CRM_RED.border}`,
                        "&:hover": { bgcolor: isActive ? CRM_RED.dark : CRM_RED.hover },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                );
              })}
            </Stack>

            {/* Actions */}
            <Stack direction="row" alignItems="center" spacing={1}>
              {(loading || isRefreshing) && (
                <CircularProgress size={20} sx={{ color: CRM_RED.main }} />
              )}
              {error && (
                <Alert severity="error" sx={{ py: 0, px: 1, borderRadius: 2 }} icon={false}>
                  <Typography variant="caption">{error}</Typography>
                </Alert>
              )}
              <Tooltip title="Rafraîchir">
                <IconButton
                  onClick={handleRefresh}
                  size="small"
                  sx={{
                    bgcolor: "#fff",
                    border: `1px solid ${CRM_RED.border}`,
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
                      bgcolor: showFilters ? CRM_RED.main : "#fff",
                      color: showFilters ? "#fff" : CRM_RED.main,
                      border: `1px solid ${CRM_RED.border}`,
                      "&:hover": { bgcolor: showFilters ? CRM_RED.dark : CRM_RED.hover },
                      transition: "all 0.2s ease",
                    }}
                  >
                    <FilterListIcon fontSize="small" />
                  </IconButton>
                </Badge>
              </Tooltip>
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
              borderRadius: "6px!important",
              border: "none!important",
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
              // Priorité : colorResolved (calculé backend) > color (stocké)
              const color =
                info.event.extendedProps?.colorResolved || info.event.extendedProps?.color;
              if (color) {
                info.el.style.backgroundColor = color;
                info.el.style.borderColor = color;
              }
              info.el.style.opacity = "0.95";
              // Indicateur visuel si tâche en retard
              if (info.event.extendedProps?.taskIsOverdue) {
                info.el.style.outline = "2px solid #f44336";
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
