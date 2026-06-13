// src/services/calendarSyncService.js
import axios from "axios";

const API_CALENDAR_URL = "/api/calendar-events/";

const api = axios.create({ baseURL: API_CALENDAR_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Crée un événement calendrier à partir d'une tâche
 */
export const syncTaskToCalendar = async (task, prospect = null) => {
  if (!task || !task.id) {
    console.warn("Tâche invalide");
    return null;
  }

  if (!task.due_date) {
    console.warn("Tâche sans date d'échéance, événement non créé");
    return null;
  }

  let eventTitle = task.title;
  let eventType = "task";
  let description = task.description || "";

  if (prospect) {
    if (task.title.toLowerCase().includes("appel")) {
      eventTitle = `📞 Appel - ${prospect.first_name} ${prospect.last_name}`;
      description = `Appel programmé avec ${prospect.first_name} ${prospect.last_name}\n\n${description}`;
    } else if (
      task.title.toLowerCase().includes("réunion") ||
      task.title.toLowerCase().includes("meeting")
    ) {
      eventType = "meeting";
      eventTitle = `📅 Réunion - ${prospect.first_name} ${prospect.last_name}`;
      description = `Réunion programmée avec ${prospect.first_name} ${prospect.last_name}\n\n${description}`;
    } else {
      eventTitle = `📋 ${task.title} - ${prospect.first_name} ${prospect.last_name}`;
    }
  } else {
    eventTitle = `📋 ${task.title}`;
  }

  const eventData = {
    title: eventTitle,
    description: description,
    start: task.due_date,
    end: task.due_date,
    all_day: false,
    event_type: eventType,
    priority: task.priority || "medium",
    task: task.id,
    assigned_to: task.assigned_to || null,
    reminder: 30,
    is_synced: true,
  };

  try {
    const response = await api.post("", eventData);
    console.log("✅ Événement calendrier créé:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Erreur création événement:", error.response?.data || error.message);
    return null;
  }
};

/**
 * Met à jour un événement calendrier existant
 */
export const updateCalendarEventFromTask = async (task) => {
  if (!task || !task.id) return null;

  try {
    const response = await api.get(`/?task=${task.id}`);
    const events = Array.isArray(response.data) ? response.data : response.data?.results || [];

    if (events.length === 0) {
      // Si pas d'événement existant, en créer un nouveau
      return await syncTaskToCalendar(task);
    }

    const eventId = events[0].id;
    const eventData = {
      title: task.title,
      description: task.description || "",
      start: task.due_date,
      end: task.due_date,
      priority: task.priority || "medium",
    };

    const updateResponse = await api.patch(`${eventId}/`, eventData);
    console.log("✅ Événement calendrier mis à jour:", updateResponse.data);
    return updateResponse.data;
  } catch (error) {
    console.error("❌ Erreur mise à jour événement:", error);
    return null;
  }
};

/**
 * Supprime l'événement calendrier lié à une tâche
 */
export const deleteCalendarEventByTaskId = async (taskId) => {
  if (!taskId) return;

  try {
    const response = await api.get(`/?task=${taskId}`);
    const events = Array.isArray(response.data) ? response.data : response.data?.results || [];

    for (const event of events) {
      await api.delete(`${event.id}/`);
      console.log(`✅ Événement ${event.id} supprimé pour la tâche ${taskId}`);
    }
  } catch (error) {
    console.error("❌ Erreur suppression événement:", error);
  }
};
