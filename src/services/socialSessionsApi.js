import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:8000/api/social" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getSocialSessions = () => api.get("/sessions/");

export const uploadSocialSession = (platform, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/sessions/${platform}/upload/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const checkSocialSession = (platform) => api.get(`/sessions/${platform}/check/`);

export const deleteSocialSession = (platform) => api.delete(`/sessions/${platform}/`);

export default api;
