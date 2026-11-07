import { api } from "./api";
import { getCity } from "./location";

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
  watchSlowRequests();
  watchMovieTaps();
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

// If a request is still waiting after 5 seconds the server is most likely waking from idle: say so, so it does not look stuck.
function watchSlowRequests() {
  let pending = 0;
  let el = null;
  const show = (on) => {
    if (on && !el) {
      el = document.createElement("div");
      el.className = "wake-banner";
      el.setAttribute("role", "status");
      el.textContent = "Waking up the server... the first open can take up to a minute.";
      document.body.appendChild(el);
    } else if (!on && el) {
      el.remove();
      el = null;
    }
  };
  const done = (config) => {
    if (config && config.__slow) clearTimeout(config.__slow);
    pending = Math.max(0, pending - 1);
    if (pending === 0) show(false);
  };
  api.interceptors.request.use((config) => {
    pending++;
    config.__slow = setTimeout(() => show(true), 5000);
    return config;
  });
  api.interceptors.response.use(
    (res) => {
      done(res.config);
      return res;
    },
    (err) => {
      done(err && err.config);
      return Promise.reject(err);
    }
  );
}

// The moment a finger lands on a movie, start loading that movie's details and showtimes and keep them for the page,
// so by the time the page opens they are usually already here.
const tapped = new Map();
export function prefetchMovie(id) {
  const city = getCity();
  const key = id + "|" + city;
  if (tapped.has(key) && Date.now() - tapped.get(key) < 60000) return;
  tapped.set(key, Date.now());
  const save = (k, data) => {
    try {
      localStorage.setItem("bms_swr_" + k, JSON.stringify(data));
    } catch (e) {
      /* storage full or blocked */
    }
  };
  api.get("/movies/" + id).then((r) => save("/movies/" + id, r.data)).catch(() => {});
  api
    .get("/shows", { params: { movieId: id, city } })
    .then((r) => save("/shows/" + id + "/" + city, r.data))
    .catch(() => {});
}

function watchMovieTaps() {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      const m = a && /\/movie\/(\d+)/.exec(a.getAttribute("href") || "");
      if (m) prefetchMovie(m[1]);
    },
    { passive: true, capture: true }
  );
}
