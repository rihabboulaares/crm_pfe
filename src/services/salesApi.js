import axios from "./axiosConfig";

const salesApi = axios.create({ baseURL: "/api/sales" });

salesApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (String(config.url || "").startsWith("/api/")) {
    config.baseURL = "";
  }
  return config;
});

export default salesApi;
