import { useEffect, useRef, useState } from "react";
import { goBack } from "../nav";
import { Link, useNavigate } from "react-router-dom";
import { currentUser } from "../api";
import { IcBack } from "../components/Icons";
import { useNotifications } from "../notifications";

const ICON = { confirmed: "🎟", reminder: "⏰", cancelled: "✕", seats: "💺", release: "🎬" };

// Filter tabs. The person can reorder them with "Edit order"; the order and starred items are remembered on this device.
const TABS = { all: "All", unread: "Unread", fav: "Favourites" };
const DEFAULT_ORDER = ["all", "unread", "fav"];
const ORDER_KEY = "bms_notif_tab_order";
const FAV_KEY = "bms_notif_favs";
const read = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const cleanOrder = (o) => {
  const keep = Array.isArray(o) ? o.filter((k) => TABS[k]) : [];
  return [...new Set([...keep, ...DEFAULT_ORDER])];
};

export default function Notifications() {
  const navigate = useNavigate();
  const { list, markSeen, clearAll } = useNotifications();
  const seenAtOpen = useRef(Number(read("bms_notif_seen", 0)) || 0);
  const [order, setOrder] = useState(() => cleanOrder(read(ORDER_KEY, DEFAULT_ORDER)));
  const [tab, setTab] = useState(() => cleanOrder(read(ORDER_KEY, DEFAULT_ORDER))[0]);
  const [editing, setEditing] = useState(false);
  const [favs, setFavs] = useState(() => read(FAV_KEY, []));
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const o = order.slice();
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
    write(ORDER_KEY, o);
  }
  function toggleFav(e, id) {
    e.stopPropagation();
    const f = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(f);
    write(FAV_KEY, f);
  }
  const shown = list.filter((n) => (tab === "unread" ? n.at > seenAtOpen.current : tab === "fav" ? favs.includes(n.id) : true));
  const unreadCount = list.filter((n) => n.at > seenAtOpen.current).length;
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
      {currentUser() && list.length > 0 && (
        <div className="nt-tabs">
          {order.map((k, i) => (
            <span key={k} className={"nt-tab" + (tab === k ? " on" : "") + (editing ? " edit" : "")}>
              {editing && (
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={"Move " + TABS[k] + " earlier"}>
                  ‹
                </button>
              )}
              <button type="button" className="nt-tab-main" onClick={() => setTab(k)}>
                {TABS[k]}
                {k === "unread" && unreadCount > 0 ? " (" + unreadCount + ")" : ""}
                {k === "fav" && favs.length > 0 ? " (" + favs.filter((id) => list.some((n) => n.id === id)).length + ")" : ""}
              </button>
              {editing && (
                <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={"Move " + TABS[k] + " later"}>
                  ›
                </button>
              )}
            </span>
          ))}
          <button type="button" className="nt-edit" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit order"}
          </button>
        </div>
      )}
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
        shown.length === 0 ? (
          <div className="nt-empty">
            <b>{tab === "unread" ? "No unread notifications" : "No favourites yet"}</b>
            <span>{tab === "unread" ? "New ones will show up here." : "Tap the star on a notification to keep it here."}</span>
          </div>
        ) : (
        shown.map((n) => (
          <div className={"nt-item " + n.kind} key={n.id} onClick={() => n.link && navigate(n.link)} style={n.link ? { cursor: "pointer" } : undefined}>
            <i>{ICON[n.kind] || "🔔"}</i>
            <div>
              <b>{n.title}</b>
              <p>{n.text}</p>
            </div>
            <button type="button" className={"nt-star" + (favs.includes(n.id) ? " on" : "")} onClick={(e) => toggleFav(e, n.id)} aria-label={favs.includes(n.id) ? "Remove from favourites" : "Add to favourites"}>
              {favs.includes(n.id) ? "★" : "☆"}
            </button>
          </div>
        ))
        )
      )}
    </div>
  );
}
