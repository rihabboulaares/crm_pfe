// src/hooks/usePaginatedList.js
// ─────────────────────────────────────────────────────────────────
// Hook universel pour toutes les listes paginées du CRM
// Usage :
//   const { data, loading, total, pages, page, setPage, setFilters, refresh }
//     = usePaginatedList("/prospects/");
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API_BASE = "/api/sales";

const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function usePaginatedList(endpoint, defaultPageSize = 10) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [filters, setFilters] = useState({}); // { status, search, assigned_to, ... }
  const [error, setError] = useState(null);

  // Évite les requêtes en double (React StrictMode / changements rapides)
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    // Annuler la requête précédente si elle est encore en cours
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Construire les query params
      const params = new URLSearchParams({
        page,
        page_size: pageSize,
      });

      // Ajouter les filtres non vides
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== "" && val !== null && val !== undefined) {
          params.append(key, val);
        }
      });

      const { data: res } = await api.get(`${endpoint}?${params}`, {
        signal: abortRef.current.signal,
      });

      // Réponse paginée : { results, total, pages, page }
      if (res.results !== undefined) {
        setData(res.results);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
      } else {
        // Fallback si la pagination n'est pas encore activée
        setData(Array.isArray(res) ? res : []);
        setTotal(Array.isArray(res) ? res.length : 0);
        setPages(1);
      }
    } catch (err) {
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        setError("Erreur lors du chargement");
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, filters]);

  // Re-fetch quand page / pageSize / filters changent
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Quand les filtres changent → revenir à la page 1
  const updateFilters = useCallback((newFilters) => {
    setPage(1);
    setFilters(newFilters);
  }, []);

  // Quand pageSize change → revenir à la page 1
  const updatePageSize = useCallback((size) => {
    setPage(1);
    setPageSize(size);
  }, []);

  return {
    data,
    loading,
    error,
    total,
    pages,
    page,
    pageSize,
    setPage,
    setPageSize: updatePageSize,
    filters,
    setFilters: updateFilters,
    refresh: fetch,
  };
}
