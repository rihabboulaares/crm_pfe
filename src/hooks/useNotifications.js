// src/hooks/useNotifications.js
import { useState, useEffect, useCallback, useRef } from "react";
import { createApiClient } from "../services/axiosConfig";

const api = createApiClient("/api/notifications");

// ── Hook notifications ────────────────────────────────────────────
export function useNotifications(pollInterval = 30000) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get("/count/");
      setUnreadCount(data.unread || 0);
    } catch {
      /* silencieux */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/");
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (ids = null) => {
    try {
      await api.post("/mark-read/", ids ? { ids } : {});
      setNotifications((prev) =>
        prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => (ids ? Math.max(0, prev - ids.length) : 0));
    } catch {
      /* silencieux */
    }
  }, []);

  const markAllRead = useCallback(() => markRead(null), [markRead]);

  const deleteNotif = useCallback(async (id) => {
    try {
      await api.delete(`/${id}/delete/`);
      setNotifications((prev) => {
        const wasUnread = prev.find((n) => n.id === id && !n.is_read);
        if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
        return prev.filter((n) => n.id !== id);
      });
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchCount, pollInterval]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotif,
    refresh: fetchNotifications,
  };
}

// ── Hook historique — CORRIGÉ : pas de boucle infinie ────────────
export function useHistory(entityType, action, search, page, refreshKey) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page || 1,
          entity_type: entityType || "",
          action: action || "",
          search: search || "",
        });
        const { data } = await api.get(`/history/?${params}`);
        if (!cancelled) {
          setLogs(data.results || []);
          setTotal(data.total || 0);
          setPages(data.pages || 1);
        }
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };

    // Dépendances primitives — pas d'objet, pas de boucle infinie
  }, [entityType, action, search, page, refreshKey]);

  return { logs, total, pages, loading };
}
