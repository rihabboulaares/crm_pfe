import axios from "axios";

const SUBSCRIPTION_INTERCEPTOR = "__subscriptionInterceptorInstalled";
const AUTH_INTERCEPTOR = "__authInterceptorInstalled";

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

export function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function normalizeApiBase(baseURL = "") {
  if (/^https?:\/\//i.test(String(baseURL || ""))) {
    return String(baseURL || "").replace(/\/+$/, "");
  }

  const apiBase = String(API_BASE_URL || "").replace(/\/+$/, "");
  const pathBase = String(baseURL || "").replace(/^\/?/, "/");

  if (!apiBase) return pathBase;
  if (apiBase.endsWith("/api") && pathBase.startsWith("/api/")) {
    return `${apiBase}${pathBase.slice(4)}`;
  }
  return `${apiBase}${pathBase}`;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || localStorage.getItem("currentUser") || "{}");
  } catch {
    return {};
  }
}

function isAdmin() {
  return String(getCurrentUser()?.role || "").toUpperCase() === "ADMIN";
}

function notifySubscriptionError(data) {
  const messageByError = {
    subscription_expired: isAdmin()
      ? "Votre abonnement est expiré. Veuillez renouveler votre abonnement."
      : "Votre abonnement est expiré. Contactez votre administrateur.",
    feature_not_allowed:
      data?.message || "Cette fonctionnalité n'est pas disponible dans votre abonnement actuel.",
    limit_reached: data?.message || "Limite atteinte. Mettez à niveau votre abonnement.",
  };

  const message = messageByError[data?.error];
  if (!message) return;

  window.dispatchEvent(
    new CustomEvent("subscription:error", {
      detail: {
        error: data.error,
        message,
        redirect: data.redirect,
        actionLabel:
          data.error === "limit_reached" ? "Mettre à niveau mon abonnement" : "Mettre à niveau",
      },
    })
  );

  window.alert(message);

  const shouldRedirectAdmin =
    data.error === "subscription_expired" &&
    isAdmin() &&
    window.location.pathname !== "/subscriptions";

  if (shouldRedirectAdmin) {
    window.location.assign("/subscriptions");
  }
}

function attachResponseInterceptor(instance) {
  if (!instance || instance[SUBSCRIPTION_INTERCEPTOR]) return instance;

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const data = error?.response?.data;
      if (error?.response?.status === 403 && data?.error) {
        notifySubscriptionError(data);
      }
      return Promise.reject(error);
    }
  );

  instance[SUBSCRIPTION_INTERCEPTOR] = true;
  return instance;
}

function attachAuthInterceptor(instance, { authenticated = true } = {}) {
  if (!instance || instance[AUTH_INTERCEPTOR]) return instance;

  instance.interceptors.request.use((config) => {
    if (!config.headers) config.headers = {};

    if (!authenticated) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
      return config;
    }

    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
    return config;
  });

  instance[AUTH_INTERCEPTOR] = true;
  return instance;
}

attachResponseInterceptor(axios);

const originalCreate = axios.create.bind(axios);
axios.create = (...args) => attachResponseInterceptor(originalCreate(...args));

export function createApiClient(baseURL = "", options = {}) {
  const { authenticated = true, headers = {}, ...axiosOptions } = options;
  const instance = axios.create({
    baseURL: normalizeApiBase(baseURL),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...axiosOptions,
  });
  return attachAuthInterceptor(instance, { authenticated });
}

export const apiClient = createApiClient("/api");
export const publicApiClient = createApiClient("/api", { authenticated: false });

export default axios;
