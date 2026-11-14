import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";

// Floating "Your show starts in 7h 31m" bar above the tab bar for the next confirmed show within 24 hours (show times are IST).
const PAGES = ["/", "/search", "/profile"];

function startMs(b) {
  return Date.parse(String(b.show_date).slice(0, 10) + "T" + String(b.start_time).slice(0, 5) + ":00+05:30");
}

function left(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? h + "h " + (m % 60) + "m" : (m % 60) + "m";
}

export default function NextShowBar() {
  const { pathname } = useLocation();
  const [next, setNext] = useState(null);
  const [now, setNow] = useState(Date.now());
  const show = PAGES.includes(pathname);

  useEffect(() => {
    if (!show || !localStorage.getItem("token")) return undefined;
    let live = true;
    api
      .get("/bookings/me")
      .then((res) => {
        if (!live) return;
        const t = Date.now();
        const soon = (Array.isArray(res.data) ? res.data : [])
          .filter((b) => b.status === "CONFIRMED")
          .map((b) => ({ b, at: startMs(b) }))
          .filter((x) => x.at > t && x.at - t <= 24 * 3600000)
          .sort((x, y) => x.at - y.at)[0];
        setNext(soon || null);
      })
      .catch(() => live && setNext(null));
    return () => {
      live = false;
    };
  }, [show]);

  useEffect(() => {
    if (!next) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [next]);

  if (!show || !next || next.at <= now) return null;
  return (
    <Link to="/bookings" className="nsb" aria-label={"Your show starts in " + left(next.at - now)}>
      <span className="nsb-ic">🎟️</span>
      <span className="nsb-txt">
        <small>
          <i /> Your show starts in <b>{left(next.at - now)}</b>
        </small>
        <b>{next.b.title}</b>
      </span>
      <em>Details ›</em>
    </Link>
  );
}
