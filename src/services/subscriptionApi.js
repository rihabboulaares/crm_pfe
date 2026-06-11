import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_BASE.endsWith("/api") ? API_BASE : `${API_BASE.replace(/\/$/, "")}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getSubscriptionPlans = async () => {
  const response = await api.get("/subscriptions/plans/");
  return response.data;
};
