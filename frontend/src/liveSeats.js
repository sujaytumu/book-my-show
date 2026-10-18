import { api } from "./api";

// Opens a WebSocket to /ws/seats and calls onChange() whenever seats of this show change.
// Reconnects automatically; returns a function that stops listening.
export function watchShowSeats(showId, onChange) {
  let ws = null;
  let stopped = false;
  let retry = 0;
  let ping = null;
  let timer = null;

  function url() {
    const base = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
    return base.replace(/^http/, "ws") + "/ws/seats";
  }

  function connect() {
    if (stopped) return;
    try {
      ws = new WebSocket(url());
    } catch (e) {
      return;
    }
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ sub: Number(showId) }));
      ping = setInterval(() => {
        try {
          ws.send("ping");
        } catch (e) {
          /* ignore */
        }
      }, 25000);
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (Number(m.show) === Number(showId)) onChange();
      } catch (e) {
        /* ignore */
      }
    };
    ws.onclose = () => {
      clearInterval(ping);
      if (stopped) return;
      retry = Math.min(retry + 1, 6);
      timer = setTimeout(connect, 1000 * retry * retry);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch (e) {
        /* ignore */
      }
    };
  }
  connect();

  return () => {
    stopped = true;
    clearInterval(ping);
    clearTimeout(timer);
    try {
      if (ws) ws.close();
    } catch (e) {
      /* ignore */
    }
  };
}
