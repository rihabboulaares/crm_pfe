// src/hooks/usePerformance.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:8000/api/sales" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function useMyKPI(year, month) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (year) params.year = year;
      if (month) params.month = month;
      const res = await api.get("/kpi/me/", { params });
      setData(res.data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useTeamKPI(year, month) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (year) params.year = year;
      if (month) params.month = month;
      const res = await api.get("/kpi/team/", { params });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useAlerts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/kpi/alerts/");
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useLeaderboard(year, month) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (year) params.year = year;
      if (month) params.month = month;
      const res = await api.get("/kpi/leaderboard/", { params });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useHistory(userId, months = 6) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const url = userId ? `/kpi/history/${userId}/` : "/kpi/history/";
      const res = await api.get(url, { params: { months } });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, months]);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useMyGoals(year, month) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const res = await api.get("/goals/my_goals/", {
        params: { year: year || now.getFullYear(), month: month || now.getMonth() + 1 },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useMyBadges() {
  const [data, setData] = useState([]);
  const fetch = useCallback(async () => {
    try {
      const res = await api.get("/badges/my_badges/");
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data };
}

export function useMyFeedbacks() {
  const [data, setData] = useState([]);
  const fetch = useCallback(async () => {
    try {
      const res = await api.get("/feedback/my_feedbacks/");
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data };
}

export function useCommercialGoals(year, month) {
  const [data, setData] = useState([]);
  const fetch = useCallback(async () => {
    try {
      const now = new Date();
      const res = await api.get("/goals/", {
        params: { year: year || now.getFullYear(), month: month || now.getMonth() + 1 },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [year, month]);
  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, refetch: fetch };
}

export { api as perfApi };
