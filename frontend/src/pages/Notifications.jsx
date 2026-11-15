import { useEffect, useState } from "react";
import { goBack } from "../nav";
import { Link, useNavigate } from "react-router-dom";
import { currentUser } from "../api";
import { IcBack } from "../components/Icons";
import { useNotifications } from "../notifications";

const FILTERS = [
  ["all", "All", null],
  ["bookings", "Bookings", ["confirmed", "cancelled", "seats"]],
  ["reminders", "Reminders", ["reminder"]],
  ["alerts", "Alerts", ["price", "release"]],
];

const ICON = { confirmed: "🎟", reminder: "⏰", cancelled: "✕", seats: "💺", release: "🎬", price: "💸" };

export default function Notifications() {
  const navigate = useNavigate();
  const { list, markSeen, clearAll } = useNotifications();
  const [filter, setFilter] = useState("all");
  const kinds = FILTERS.find((f) => f[0] === filter)[2];
  const shown = kinds ? list.filter((n) => kinds.includes(n.kind)) : list;
  useEffect(() => {
    if (list.length) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);
  return (
    <div className="nt-page">
      <div className="ml-top">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Notifications</h1>
        </div>
        {list.length > 0 && (
          <button type="button" className="nt-clear" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
      {!currentUser() ? (
        <div className="nt-empty">
          <b>Login to see your notifications</b>
          <Link to="/login">Login</Link>
        </div>
      ) : list.length === 0 ? (
        <div className="nt-empty">
          <b>You're all caught up</b>
          <span>Booking confirmations and show reminders will show up here.</span>
        </div>
      ) : (
        <>
          <div className="nt-filters" role="tablist">
            {FILTERS.map(([key, label, k]) => {
              const count = k ? list.filter((n) => k.includes(n.kind)).length : list.length;
              return (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "on" : ""} onClick={() => setFilter(key)}>
                  {label}
                  {count > 0 && <b>{count}</b>}
                </button>
              );
            })}
          </div>
          {shown.length === 0 && (
            <div className="nt-empty">
              <b>Nothing in this list</b>
              <span>Try another filter.</span>
            </div>
          )}
          {shown.map((n) => (
          <div className={"nt-item " + n.kind} key={n.id} onClick={() => n.link && navigate(n.link)} style={n.link ? { cursor: "pointer" } : undefined}>
            <i>{ICON[n.kind] || "🔔"}</i>
            <div>
              <b>{n.title}</b>
              <p>{n.text}</p>
            </div>
          </div>
          ))}
        </>
      )}
    </div>
  );
}
