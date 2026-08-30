import { createApiClient } from "./axiosConfig";
const API_BASE = process.env.REACT_APP_API_BASE_URL || "/api";
const baseURL = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE.replace(/\/$/, "")}/api`;

const publicApi = createApiClient(baseURL, { authenticated: false });
const api = createApiClient(baseURL);

export const getSubscriptionPlans = async () => {
  const response = await publicApi.get("/subscriptions/plans/");
  return response.data;
};
