import { api } from "./api";

// Wakes the server (Render's free tier sleeps when idle) the moment the app opens, so it is ready by the time the
// first screen asks for data. It then pings now and then while the app is open and again whenever you come back to it.
const base = () => String(api.defaults.baseURL || "").replace(/\/$/, "");
let last = 0;

export function ping(force) {
  const now = Date.now();
  if (!force && now - last < 60000) return;
  last = now;
  try {
    fetch(base() + "/health", { mode: "no-cors", cache: "no-store", keepalive: true }).catch(() => {});
  } catch (e) {
    /* offline or blocked: nothing to do */
  }
}

export function startWarmup() {
  ping(true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ping();
  });
  window.addEventListener("online", () => ping(true));
  setInterval(() => {
    if (document.visibilityState === "visible") ping();
  }, 4 * 60 * 1000);
}

// Download the other screens in the background once the first one is on screen, so tapping a movie is instant.
export function prefetchScreens() {
  const go = () => {
    import("./pages/Movie");
    import("./pages/Show");
    import("./pages/Search");
    import("./pages/Bookings");
  };
  if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
}
