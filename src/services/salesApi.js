import { createApiClient } from "./axiosConfig";

const salesApi = createApiClient("/api/sales");

salesApi.interceptors.request.use((config) => {
  if (String(config.url || "").startsWith("/api/")) {
    config.baseURL = "";
  }
  return config;
});

export default salesApi;
