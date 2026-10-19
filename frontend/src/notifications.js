import { useEffect, useState } from "react";
import { api, currentUser } from "./api";

const SEEN = "bms_notif_seen";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(b) {
  const [y, m, d] = String(b.show_date).slice(0, 10).split("-").map(Number);
  const [hh, mm] = String(b.start_time).split(":");
  const n = parseInt(hh, 10);
  return d + " " + MON[m - 1] + ", " + String(n % 12 || 12).padStart(2, "0") + ":" + mm + " " + (n < 12 ? "AM" : "PM");
}

// Build the notification list from the user's bookings (confirmations, reminders, cancellations).
export function buildNotifications(bookings) {
  const now = Date.now();
  const out = [];
  bookings.forEach((b) => {
    const startsAt = Date.parse(String(b.show_date).slice(0, 10) + "T" + String(b.start_time).slice(0, 5) + ":00+05:30");
    const created = Date.parse(b.created_at) || 0;
    if (b.status === "CONFIRMED") {
      if (startsAt > now && startsAt - now < 24 * 3600 * 1000) {
        out.push({
          id: "r" + b.id,
          kind: "reminder",
          at: Math.min(startsAt - 3600 * 1000, now),
          title: "Show starts soon",
          text: b.title + " at " + b.theatre_name + " · " + when(b) + ". Seats " + b.seats + ".",
        });
      }
      out.push({
        id: "c" + b.id,
        kind: "confirmed",
        at: created,
        title: "Booking confirmed",
        text: b.title + " at " + b.theatre_name + " · " + when(b) + ". Seats " + b.seats + ". ID " + b.reference,
      });
    } else if (b.status === "CANCELLED") {
      out.push({
        id: "x" + b.id,
        kind: "cancelled",
        at: created,
        title: "Booking cancelled",
        text: b.title + " · " + when(b) + ". Booking ID " + b.reference,
      });
    }
  });
  return out.sort((a, b) => b.at - a.at);
}

export function useNotifications() {
  const [list, setList] = useState([]);
  const [seen, setSeen] = useState(() => {
    try {
      return Number(localStorage.getItem(SEEN) || 0);
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    if (!currentUser()) return;
    Promise.all([
      api.get("/bookings/me").then((r) => r.data).catch(() => []),
      api.get("/notifications").then((r) => r.data).catch(() => []),
    ]).then(([bookings, server]) => {
      const extra = server.map((n) => ({
        id: "s" + n.id,
        kind: n.kind,
        at: Date.parse(n.created_at) || 0,
        title: n.title,
        text: n.body,
        link: n.link,
      }));
      setList([...buildNotifications(bookings), ...extra].sort((a, b) => b.at - a.at));
    });
  }, []);
  useEffect(() => {
    const sync = () => {
      try {
        setSeen(Number(localStorage.getItem(SEEN) || 0));
      } catch {}
    };
    window.addEventListener("bms-notif-seen", sync);
    return () => window.removeEventListener("bms-notif-seen", sync);
  }, []);
  const unread = list.filter((n) => n.at > seen).length;
  function markSeen() {
    const t = Date.now();
    try {
      localStorage.setItem(SEEN, String(t));
    } catch {}
    setSeen(t);
    window.dispatchEvent(new Event("bms-notif-seen"));
  }
  return { list, unread, markSeen };
}
