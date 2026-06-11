import axios from "axios";

const SUBSCRIPTION_INTERCEPTOR = "__subscriptionInterceptorInstalled";

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

attachResponseInterceptor(axios);

const originalCreate = axios.create.bind(axios);
axios.create = (...args) => attachResponseInterceptor(originalCreate(...args));

export default axios;
