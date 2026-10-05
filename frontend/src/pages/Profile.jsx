import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, currentUser, logout } from "../api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function fmtDate(str) {
  const [y, m, d] = String(str).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return DAYS[dt.getDay()] + ", " + d + " " + MONTHS[m - 1] + " " + y;
}

function fmtTime(str) {
  const [hh, mm] = String(str).split(":");
  const h = Number(hh);
  return (h % 12 || 12) + ":" + mm + " " + (h >= 12 ? "PM" : "AM");
}

function startsAt(b) {
  const [y, m, d] = String(b.show_date).split("-").map(Number);
  const [hh, mm] = String(b.start_time).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function pill(status) {
  if (status === "CONFIRMED") return { label: "Confirmed", cls: "ok" };
  if (status === "CANCELLED") return { label: "Cancelled", cls: "bad" };
  if (status === "PENDING") return { label: "Payment pending", cls: "wait" };
  return { label: status, cls: "wait" };
}

export default function Profile() {
  const navigate = useNavigate();
  const user = currentUser();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!user) return;
    api
      .get("/bookings/me")
      .then((res) => setBookings(res.data))
      .catch(() => {});
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  function handleLogout() {
    logout();
    navigate("/");
  }

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const spent = confirmed.reduce((sum, b) => sum + Number(b.amount), 0);
  const tickets = confirmed.reduce((sum, b) => sum + String(b.seats).split(",").filter((s) => s.trim()).length, 0);
  const upcoming = confirmed.filter((b) => startsAt(b) >= new Date()).length;
  const recent = bookings.slice(0, 3);

  return (
    <div className="pf-wrap">
      <div className="pf-hero">
        <div className="pf-avatar">{initials(user.name)}</div>
        <div className="pf-who">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          <span className="pf-role">{user.role === "ADMIN" ? "Administrator" : "Customer"}</span>
        </div>
      </div>

      <div className="pf-stats">
        <div className="pf-stat">
          <b>{bookings.length}</b>
          <small>Total bookings</small>
        </div>
        <div className="pf-stat">
          <b>{upcoming}</b>
          <small>Upcoming shows</small>
        </div>
        <div className="pf-stat">
          <b>{tickets}</b>
          <small>Tickets booked</small>
        </div>
        <div className="pf-stat">
          <b>₹{spent.toFixed(0)}</b>
          <small>Total spent</small>
        </div>
      </div>

      <div className="pf-card">
        <h3>Account details</h3>
        <div className="pf-row">
          <span>Full name</span>
          <b>{user.name}</b>
        </div>
        <div className="pf-row">
          <span>Email address</span>
          <b>{user.email}</b>
        </div>
        <div className="pf-row">
          <span>Customer ID</span>
          <b>#{user.id}</b>
        </div>
        <div className="pf-row">
          <span>Account type</span>
          <b>{user.role === "ADMIN" ? "Administrator" : "Customer"}</b>
        </div>
      </div>

      <div className="pf-card">
        <h3>Recent bookings</h3>
        {recent.length === 0 && <p className="pf-muted">No bookings yet.</p>}
        {recent.map((b) => {
          const p = pill(b.status);
          return (
            <div className="pf-book" key={b.id}>
              <div>
                <b>{b.title}</b>
                <small>
                  {b.theatre_name} · {fmtDate(b.show_date)}, {fmtTime(b.start_time)}
                </small>
              </div>
              <span className={"pf-pill " + p.cls}>{p.label}</span>
            </div>
          );
        })}
        <Link to="/bookings" className="pf-link">
          View all bookings →
        </Link>
      </div>

      <button className="pf-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}