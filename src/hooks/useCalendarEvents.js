// src/hooks/useCalendarEvents.js
import { useState, useCallback } from "react";
import axios from "axios";

// ── Instance axios avec token JWT automatique ─────────────────────────────────
const authAxios = axios.create();
authAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Endpoints ─────────────────────────────────────────────────────────────────
const API = "/api/calendar-events/";
const CALENDAR_TASKS_API = "/api/calendar/tasks/";

const SALES_API = {
  pipelines: "/api/sales/pipelines/",
  pipelineStages: "/api/sales/pipeline-stages/",
  tasks: "/api/sales/tasks/",
  opportunities: "/api/sales/opportunities/",
};
const USERS_API = {
  assignable: "/api/users/assignable-users/",
};

// ── Couleurs par priorité ─────────────────────────────────────────────────────
export const COLOR_MAP = {
  // Priorités
  low: "#4caf50",
  medium: "#1976d2",
  high: "#ff9800",
  critical: "#C62828",
  // Types d'événements
  task: "#7b1fa2",
  meeting: "#0288d1",
  deadline: "#C62828",
  reminder: "#f57c00",
  stage: "#37474f",
  activity: "#00695c",
  pipeline_alert: "#bf360c",
};

// ── Labels lisibles ───────────────────────────────────────────────────────────
export const PRIORITY_LABELS = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

export const EVENT_TYPE_LABELS = {
  task: "Tâche",
  meeting: "Réunion",
  deadline: "Échéance",
  reminder: "Rappel",
  stage: "Étape Pipeline",
  activity: "Activité CRM",
  pipeline_alert: "Alerte Pipeline",
};

// ── Conversion événement backend → FullCalendar ───────────────────────────────
function toFCEvent(ev) {
  // Couleur finale : on préfère color_resolved (calculé backend) sur tout le reste
  const resolvedColor =
    ev.color_resolved ||
    COLOR_MAP[ev.priority] ||
    COLOR_MAP[ev.event_type] ||
    ev.color ||
    "#1976d2";

  return {
    id: String(ev.id),
    title: ev.title,
    start: ev.start,
    end: ev.end || undefined,
    allDay: ev.all_day,
    backgroundColor: resolvedColor,
    borderColor: resolvedColor,
    textColor: "#fff",
    extendedProps: {
      // ── Champs généraux ──────────────────────────────────────────────────
      description: ev.description,
      eventType: ev.event_type,
      priority: ev.priority,
      color: ev.color,
      colorResolved: ev.color_resolved,
      isSynced: ev.is_synced,
      reminder: ev.reminder,

      // ── Task ────────────────────────────────────────────────────────────
      task: ev.task,
      taskTitle: ev.task_title,
      taskStatus: ev.task_status,
      taskPriority: ev.task_priority,
      taskType: ev.task_type,
      taskQuotaPct: ev.task_quota_pct,
      taskIsOverdue: ev.task_is_overdue,

      // ── Opportunity ─────────────────────────────────────────────────────
      opportunity: ev.opportunity,
      opportunityName: ev.opportunity_name,
      opportunityStage: ev.opportunity_stage,
      opportunityAmount: ev.opportunity_amount,

      // ── Pipeline / Stage ────────────────────────────────────────────────
      pipelineStage: ev.pipeline_stage,
      stageName: ev.stage_name,
      pipelineName: ev.pipeline_name,
      stageColorHex: ev.stage_color_hex,
      stageOrder: ev.stage_order,

      // ── OpportunityPipeline ─────────────────────────────────────────────
      opportunityPipeline: ev.opportunity_pipeline,
      opStatus: ev.op_status,
      opProgression: ev.op_progression,

      // ── TaskActivity ────────────────────────────────────────────────────
      taskActivity: ev.task_activity,
      activityType: ev.activity_type,
      activityResult: ev.activity_result,
      meetingLocation: ev.meeting_location,

      // ── PipelineAlert ────────────────────────────────────────────────────
      pipelineAlert: ev.pipeline_alert,
      alertType: ev.alert_type,
      alertSeverity: ev.alert_severity,
      alertIsRead: ev.alert_is_read,

      // ── Assigné ──────────────────────────────────────────────────────────
      assignedTo: ev.assigned_to,
      assignedName: ev.assigned_name,
    },
  };
}

function toTaskEvent(task) {
  const color = COLOR_MAP[task.priority] || COLOR_MAP.task;
  const prospectSuffix = task.prospect_name ? ` - ${task.prospect_name}` : "";

  return {
    id: `task-${task.id}`,
    title: `${task.title}${prospectSuffix}`,
    start: task.start,
    end: task.end || undefined,
    allDay: false,
    backgroundColor: color,
    borderColor: color,
    textColor: "#fff",
    editable: false,
    extendedProps: {
      description: task.description || "",
      eventType: "task",
      priority: task.priority,
      color,
      colorResolved: color,
      isSynced: true,
      isVirtualTaskEvent: true,
      task: task.id,
      taskTitle: task.title,
      taskStatus: task.status,
      taskPriority: task.priority,
      taskType: task.type,
      taskIsOverdue: task.is_overdue,
      prospect: task.prospect_id,
      prospectName: task.prospect_name,
      assignedTo: task.assigned_to,
      assignedName: task.assigned_name,
    },
  };
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useCalendarEvents(filters = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chargement des événements dans une plage de dates
  const fetchEvents = useCallback(
    async (rangeStart, rangeEnd) => {
      setLoading(true);
      setError(null);
      try {
        const selectedTypes = String(filters.event_type || "")
          .split(",")
          .filter(Boolean);
        const shouldFetchTasks = selectedTypes.length === 0 || selectedTypes.includes("task");
        const effectiveStart = filters.start || rangeStart;
        const effectiveEnd = filters.end || rangeEnd;

        const [eventsResponse, tasksResponse] = await Promise.all([
          authAxios.get(API, {
            params: { start: rangeStart, end: rangeEnd, ...filters },
          }),
          shouldFetchTasks
            ? authAxios.get(CALENDAR_TASKS_API, {
                params: {
                  start: effectiveStart,
                  end: effectiveEnd,
                  type: filters.task_type,
                  status: filters.status,
                  priority: filters.priority,
                  assigned_to: filters.assigned_to,
                  show_completed: filters.show_completed,
                },
              })
            : Promise.resolve({ data: [] }),
        ]);

        const eventList = Array.isArray(eventsResponse.data)
          ? eventsResponse.data
          : eventsResponse.data.results || [];
        const taskList = Array.isArray(tasksResponse.data)
          ? tasksResponse.data
          : tasksResponse.data.results || [];
        const eventTaskIds = new Set(
          eventList
            .map((event) => event.task)
            .filter((taskId) => taskId !== null && taskId !== undefined)
            .map(String)
        );
        const calendarEvents = eventList.map(toFCEvent);
        const taskEvents = taskList
          .filter((task) => !eventTaskIds.has(String(task.id)))
          .filter((task) => !["done", "completed", "cancelled"].includes(task.status))
          .map(toTaskEvent);

        setEvents([...calendarEvents, ...taskEvents]);
      } catch (err) {
        const msg = err?.response?.data?.detail || err.message || "Erreur réseau";
        setError(msg);
        console.error("[CalendarEvents] fetchEvents error:", err);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filters)]
  );

  // GET /api/sales/pipelines/
  const fetchPipelines = useCallback(async () => {
    const { data } = await authAxios.get(SALES_API.pipelines);
    return Array.isArray(data) ? data : data.results || [];
  }, []);

  // GET /api/sales/pipeline-stages/?pipeline=<id>
  const fetchStages = useCallback(async (pipelineId) => {
    const { data } = await authAxios.get(SALES_API.pipelineStages, {
      params: { pipeline: pipelineId },
    });
    return Array.isArray(data) ? data : data.results || [];
  }, []);

  // GET /api/users/assignable-users/
  const fetchUsers = useCallback(async () => {
    const { data } = await authAxios.get(USERS_API.assignable);
    return Array.isArray(data) ? data : data.results || [];
  }, []);

  // GET /api/sales/tasks/
  const fetchTasks = useCallback(async (search = "") => {
    const { data } = await authAxios.get(SALES_API.tasks, {
      params: { search, page_size: 50 },
    });
    return Array.isArray(data) ? data : data.results || [];
  }, []);

  const createEvent = useCallback(async (eventData) => {
    const { data } = await authAxios.post(API, eventData);
    return data;
  }, []);

  const updateEvent = useCallback(async (id, eventData) => {
    const { data } = await authAxios.patch(`${API}${id}/`, eventData);
    return data;
  }, []);

  const deleteEvent = useCallback(async (id) => {
    await authAxios.delete(`${API}${id}/`);
  }, []);

  return {
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
  };
}
