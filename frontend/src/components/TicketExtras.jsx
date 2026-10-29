import { useEffect, useState } from "react";
import { haversineKm } from "../geo";

const startOf = (b) => {
  const [y, m, d] = String(b.show_date).slice(0, 10).split("-").map(Number);
  const [hh, mm] = String(b.start_time).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
const clock = (d) => {
  const h = d.getHours();
  return (h % 12 || 12) + ":" + String(d.getMinutes()).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
};
const span = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m >= 1440) return Math.floor(m / 1440) + "d " + Math.floor((m % 1440) / 60) + "h";
  if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60) + "m";
  return m + " min";
};

// Live "starts in 2h 10m" (updates every 20 s) and, on request, when to leave from where you are now.
export function TripChip({ b }) {
  const [now, setNow] = useState(Date.now());
  const [trip, setTrip] = useState(null); // { km, minutes } | "denied"
  const start = startOf(b);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);
  const left = start.getTime() - now;
  if (left < -15 * 60000) return null; // already well under way
  const soon = left < 60 * 60000;
  const lat = Number(b.theatre_lat), lng = Number(b.theatre_lng);
  const canRoute = Number.isFinite(lat) && Number.isFinite(lng) && b.theatre_lat != null;

  function whereAmI(e) {
    e.stopPropagation();
    if (!navigator.geolocation) return setTrip("denied");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const km = haversineKm(p.coords.latitude, p.coords.longitude, lat, lng) * 1.35; // roads wind
        setTrip({ km, minutes: Math.round((km / 22) * 60) + 15 }); // city traffic pace + 15 min to park and find the screen
      },
      () => setTrip("denied"),
      { maximumAge: 120000, timeout: 8000 }
    );
  }
  const leaveBy = trip && trip !== "denied" ? new Date(start.getTime() - trip.minutes * 60000) : null;
  return (
    <div className={"trip-chip" + (soon ? " soon" : "")}>
      <span>{left <= 0 ? "Show is starting now" : "Starts in " + span(left)}</span>
      {canRoute && !trip && (
        <button type="button" onClick={whereAmI}>When should I leave?</button>
      )}
      {trip === "denied" && <em>Allow location to get a leave-by time</em>}
      {leaveBy && (
        <em>
          {leaveBy.getTime() <= now
            ? "Leave now (" + trip.km.toFixed(1) + " km away)"
            : "Leave by " + clock(leaveBy) + " (" + trip.km.toFixed(1) + " km, ~" + trip.minutes + " min)"}
        </em>
      )}
      {canRoute && (
        <a
          href={"https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Directions
        </a>
      )}
    </div>
  );
}

// Split the booking amount between friends and send each a ready message with the UPI details.
export function SplitBill({ b }) {
  const seats = Math.max(2, String(b.seats).split(",").filter((s) => s.trim()).length);
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(Math.min(10, seats));
  const [upi, setUpi] = useState(() => {
    try { return localStorage.getItem("bms_upi") || ""; } catch { return ""; }
  });
  const total = Number(b.amount) || 0;
  const share = Math.ceil(total / people);
  const text =
    "Our tickets for " + b.title + " (" + b.theatre_name + ", " + String(b.show_date).slice(0, 10) + " " + String(b.start_time).slice(0, 5) +
    ") cost Rs " + total.toFixed(0) + " in total. Your share: Rs " + share + "." +
    (upi.trim() ? " Pay me on UPI: " + upi.trim() + " (upi://pay?pa=" + encodeURIComponent(upi.trim()) + "&am=" + share + "&cu=INR&tn=" + encodeURIComponent(b.title + " tickets") + ")" : "");

  function remember(v) {
    setUpi(v);
    try { localStorage.setItem("bms_upi", v); } catch {}
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch { window.prompt("Copy this message:", text); }
  }
  return (
    <div className="split">
      <button type="button" className="split-toggle" onClick={() => setOpen((v) => !v)}>
        💸 Split the cost
      </button>
      {open && (
        <div className="split-body">
          <div className="split-row">
            <span>People</span>
            <div>
              <button type="button" onClick={() => setPeople((p) => Math.max(2, p - 1))}>−</button>
              <b>{people}</b>
              <button type="button" onClick={() => setPeople((p) => Math.min(10, p + 1))}>+</button>
            </div>
          </div>
          <p className="split-amt">
            ₹{share} <small>each (total ₹{total.toFixed(0)})</small>
          </p>
          <input placeholder="Your UPI ID (optional), e.g. name@upi" value={upi} onChange={(e) => remember(e.target.value)} autoComplete="off" />
          <div className="split-go">
            <a href={"https://wa.me/?text=" + encodeURIComponent(text)} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
            <button type="button" onClick={copy}>Copy message</button>
          </div>
        </div>
      )}
    </div>
  );
}
