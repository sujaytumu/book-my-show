import { useEffect, useState } from "react";
import { thumb } from "../img";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, currentUser, logout } from "../api";
import { swrGet } from "../cache";
import { getTheme, setTheme } from "../theme";
import { loadWatchlist, removeFromWatchlist, syncWatchlist } from "../watchlist";

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

// Duolingo / Cred style progression: a level from confirmed bookings plus badges earned from how you watch.
const LEVELS = [
  { at: 0, name: "Newcomer" },
  { at: 1, name: "Ticket Holder" },
  { at: 3, name: "Regular" },
  { at: 6, name: "Movie Buff" },
  { at: 12, name: "Cinephile" },
  { at: 25, name: "Legend" },
];

function badgeList(bookings) {
  const hour = (b) => Number(String(b.start_time).slice(0, 2));
  const dow = (b) => {
    const [y, m, d] = String(b.show_date).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  };
  const seatsOf = (b) => String(b.seats).split(",").filter((x) => x.trim()).length;
  const perTheatre = {};
  bookings.forEach((b) => (perTheatre[b.theatre_name] = (perTheatre[b.theatre_name] || 0) + 1));
  return [
    { icon: "🎟️", name: "First show", hint: "Book your first ticket", on: bookings.length >= 1 },
    { icon: "🌙", name: "Night owl", hint: "Watch a show at 9:30 PM or later", on: bookings.some((b) => hour(b) * 60 + Number(String(b.start_time).slice(3, 5)) >= 21 * 60 + 30) },
    { icon: "🌅", name: "Early bird", hint: "Watch a show before 12 noon", on: bookings.some((b) => hour(b) < 12) },
    { icon: "🎉", name: "Weekend warrior", hint: "3 shows on weekends", on: bookings.filter((b) => dow(b) === 0 || dow(b) === 6).length >= 3 },
    { icon: "👥", name: "Squad goals", hint: "Book 4 or more seats at once", on: bookings.some((b) => seatsOf(b) >= 4) },
    { icon: "🏠", name: "Home theatre", hint: "5 shows at the same cinema", on: Object.values(perTheatre).some((n) => n >= 5) },
  ];
}

function MovieLevel({ bookings }) {
  const n = bookings.length;
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (n >= l.at) idx = i;
  });
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const pct = next ? Math.round(((n - cur.at) / (next.at - cur.at)) * 100) : 100;
  const badges = badgeList(bookings);
  const earned = badges.filter((b) => b.on).length;
  return (
    <div className="pf-card lv-card">
      <div className="lv-top">
        <div>
          <small>Your level</small>
          <h3>{cur.name}</h3>
        </div>
        <span className="lv-n">{idx + 1}</span>
      </div>
      <div className="lv-bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
        <i style={{ width: pct + "%" }} />
      </div>
      <p className="lv-sub">
        {next ? (next.at - n) + (next.at - n === 1 ? " more show" : " more shows") + " to reach " + next.name : "You reached the top level"}
      </p>
      <h4 className="lv-h">
        Badges <em>{earned}/{badges.length}</em>
      </h4>
      <div className="lv-badges">
        {badges.map((b) => (
          <div key={b.name} className={"lv-badge" + (b.on ? " on" : "")} title={b.hint}>
            <span>{b.icon}</span>
            <b>{b.name}</b>
            <small>{b.on ? "Earned" : b.hint}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

// Apple Health style goal ring: shows watched this month against a goal the viewer sets (kept on this device).
function GoalRing({ bookings }) {
  const KEY = "bms_month_goal";
  const [goal, setGoal] = useState(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      return v >= 1 && v <= 30 ? v : 4;
    } catch {
      return 4;
    }
  });
  const change = (d) => {
    const g = Math.max(1, Math.min(30, goal + d));
    setGoal(g);
    try {
      localStorage.setItem(KEY, String(g));
    } catch {
      /* private mode: goal just resets next time */
    }
  };
  const now = new Date();
  const prefix = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const done = bookings.filter((b) => String(b.show_date).startsWith(prefix)).length;
  const pct = Math.min(1, done / goal);
  const R = 42;
  const C = 2 * Math.PI * R;
  const month = now.toLocaleString("en-IN", { month: "long" });
  return (
    <div className="pf-card gr-card">
      <svg className="gr-ring" viewBox="0 0 100 100" role="img" aria-label={done + " of " + goal + " shows this month"}>
        <circle cx="50" cy="50" r={R} className="gr-track" />
        <circle cx="50" cy="50" r={R} className="gr-fill" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        <text x="50" y="54" textAnchor="middle" className="gr-num">
          {done}/{goal}
        </text>
      </svg>
      <div className="gr-side">
        <h3>{month} goal</h3>
        <p>{done >= goal ? "Goal reached. Great month at the movies." : goal - done + (goal - done === 1 ? " more show" : " more shows") + " to hit your goal"}</p>
        <div className="gr-set">
          <button type="button" onClick={() => change(-1)} aria-label="Lower goal">−</button>
          <span>{goal} shows a month</span>
          <button type="button" onClick={() => change(1)} aria-label="Raise goal">+</button>
        </div>
      </div>
    </div>
  );
}

// Duolingo style streak: how many weeks in a row (including this one) you have had at least one show.
function WeekStreak({ bookings }) {
  const weekKey = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday of that week
    return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate();
  };
  const today = new Date();
  const weeks = new Set(
    bookings
      .map((b) => {
        const [y, m, d] = String(b.show_date).slice(0, 10).split("-").map(Number);
        return new Date(y, m - 1, d);
      })
      .filter((d) => d <= today)
      .map(weekKey)
  );
  const cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;
  // An empty current week does not break the streak yet: you still have until Sunday.
  if (!weeks.has(weekKey(cur))) cur.setDate(cur.getDate() - 7);
  while (weeks.has(weekKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 7);
  }
  const thisWeek = weeks.has(weekKey(today));
  return (
    <div className="pf-card sk-card">
      <span className={"sk-flame" + (streak ? " on" : "")}>🔥</span>
      <div>
        <h3>{streak} {streak === 1 ? "week" : "weeks"} streak</h3>
        <p>
          {streak === 0
            ? "Watch a show this week to start a streak."
            : thisWeek
              ? "You have watched a show this week. Keep it going."
              : "Watch a show before Sunday to keep your streak."}
        </p>
      </div>
    </div>
  );
}

// Spotify Wrapped style recap: your favourite cinema, day and time of day, worked out from your bookings.
function MovieRecap({ bookings }) {
  if (bookings.length === 0) return null;
  const top = (arr) => {
    const c = {};
    arr.forEach((x) => (c[x] = (c[x] || 0) + 1));
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  };
  const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOf = (b) => {
    const [y, m, d] = String(b.show_date).slice(0, 10).split("-").map(Number);
    return DAY[new Date(y, m - 1, d).getDay()];
  };
  const slotOf = (b) => {
    const h = Number(String(b.start_time).slice(0, 2));
    return h < 12 ? "Morning" : h < 16 ? "Afternoon" : h < 20 ? "Evening" : "Night";
  };
  const cinema = top(bookings.map((b) => b.theatre_name));
  const day = top(bookings.map(dayOf));
  const slot = top(bookings.map(slotOf));
  const movie = top(bookings.map((b) => b.title));
  const spent = bookings.reduce((sum, b) => sum + Number(b.amount), 0);
  const rows = [
    ["Favourite cinema", cinema[0]],
    ["Favourite day", day[0]],
    ["Favourite time", slot[0]],
    ["Most booked movie", movie[0]],
  ];
  return (
    <div className="rc-recap">
      <small>Your movie recap</small>
      <div className="rc-big">
        <b>{bookings.length}</b>
        <span>{bookings.length === 1 ? "show booked" : "shows booked"}</span>
      </div>
      <div className="rc-grid">
        {rows.map(([k, v]) => (
          <div key={k}>
            <em>{k}</em>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <p>You have spent ₹{spent.toFixed(0)} on movie nights.</p>
    </div>
  );
}

// LeetCode-style activity grid: one square per day for the last 16 weeks, darker = more shows that day.
function MovieHeatmap({ bookings }) {
  const WEEKS = 16;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const counts = {};
  bookings.forEach((b) => {
    const k = String(b.show_date).slice(0, 10);
    counts[k] = (counts[k] || 0) + 1;
  });
  // Grid ends on today's weekday so the last column is the current week.
  const start = new Date(today);
  start.setDate(start.getDate() - ((WEEKS - 1) * 7 + today.getDay()));
  const cells = [];
  let total = 0;
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d > today) {
      cells.push(<i key={i} className="hm-c off" />);
      continue;
    }
    const n = counts[iso(d)] || 0;
    total += n;
    cells.push(<i key={i} className={"hm-c l" + Math.min(n, 3)} title={iso(d) + ": " + n + (n === 1 ? " show" : " shows")} />);
  }
  return (
    <div className="pf-card hm-card">
      <h3>Your movie activity</h3>
      <p className="hm-sub">
        <b>{total}</b> {total === 1 ? "show" : "shows"} in the last {WEEKS} weeks
      </p>
      <div className="hm-grid" role="img" aria-label={total + " shows booked in the last " + WEEKS + " weeks"}>
        {cells}
      </div>
    </div>
  );
}

// Your taste: the genres and languages of the movies you booked (matched to the movie list by title).
function TasteChips({ bookings }) {
  const [movies, setMovies] = useState([]);
  useEffect(() => {
    swrGet("/movies", (d) => Array.isArray(d) && setMovies(d)).catch(() => {});
  }, []);
  if (bookings.length === 0 || movies.length === 0) return null;
  const byTitle = {};
  movies.forEach((m) => (byTitle[String(m.title).toLowerCase()] = m));
  const genres = {};
  const langs = {};
  bookings.forEach((b) => {
    const m = byTitle[String(b.title).toLowerCase()];
    if (!m) return;
    String(m.genre || "")
      .split(/[,/]/)
      .map((g) => g.trim())
      .filter(Boolean)
      .forEach((g) => (genres[g] = (genres[g] || 0) + 1));
    if (m.language) langs[m.language] = (langs[m.language] || 0) + 1;
  });
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const g = top(genres, 4);
  const l = top(langs, 2);
  if (g.length === 0) return null;
  return (
    <div className="pf-card">
      <h3>Your taste</h3>
      <div className="tc-chips">
        {g.map(([name, n]) => (
          <Link key={name} to={"/search?q=" + encodeURIComponent(name)} className="tc-chip">
            {name} <b>{n}</b>
          </Link>
        ))}
        {l.map(([name, n]) => (
          <span key={name} className="tc-chip lang">
            {name} <b>{n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// Movies you rated from My Bookings (ratings are kept on this device).
function MyRatings({ bookings }) {
  let ratings = {};
  try {
    ratings = JSON.parse(localStorage.getItem("bms_my_ratings") || "{}");
  } catch (e) {
    ratings = {};
  }
  const seen = new Set();
  const rows = [];
  bookings.forEach((b) => {
    const key = String(b.movie_id || b.title);
    if (ratings[key] && !seen.has(key)) {
      seen.add(key);
      rows.push({ key, id: b.movie_id, title: b.title, stars: ratings[key] });
    }
  });
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.stars - a.stars);
  return (
    <div className="pf-card">
      <h3>Your ratings</h3>
      <div className="mr-list">
        {rows.slice(0, 5).map((r) => (
          <Link key={r.key} to={r.id ? "/movie/" + r.id : "/search?q=" + encodeURIComponent(r.title)} className="mr-row">
            <span>{r.title}</span>
            <b aria-label={r.stars + " out of 5"}>
              {"★".repeat(r.stars)}
              <i>{"★".repeat(5 - r.stars)}</i>
            </b>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Mint / Cred style spending view: what you spent on tickets in each of the last 6 months.
function SpendChart({ bookings }) {
  if (bookings.length === 0) return null;
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    months.push({ key, label: d.toLocaleDateString("en-IN", { month: "short" }), total: 0 });
  }
  bookings.forEach((b) => {
    const m = months.find((x) => String(b.show_date).startsWith(x.key));
    if (m) m.total += Number(b.amount) || 0;
  });
  const max = Math.max(1, ...months.map((m) => m.total));
  const all = bookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const avg = Math.round(all / bookings.length);
  const thisMonth = months[months.length - 1].total;
  return (
    <div className="pf-card sp-chart">
      <h3>Spending on tickets</h3>
      <p className="sp-sub">
        ₹{thisMonth.toFixed(0)} this month · ₹{avg} average per booking
      </p>
      <div className="sp-bars">
        {months.map((m) => (
          <div className="sp-col" key={m.key}>
            <span className="sp-val">{m.total ? "₹" + Math.round(m.total) : ""}</span>
            <i style={{ height: Math.max(4, Math.round((m.total / max) * 84)) + "px" }} className={m.total ? "on" : ""} />
            <small>{m.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

// Airline / card style membership tier from lifetime ticket spend (status only; no discounts are attached).
const TIERS = [
  { name: "Silver", at: 0, color: "#9aa3b2" },
  { name: "Gold", at: 2000, color: "#d9a21b" },
  { name: "Platinum", at: 5000, color: "#5b6b8c" },
  { name: "Black", at: 10000, color: "#1d1f22" },
];

function MemberTier({ bookings }) {
  const spent = bookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (spent >= t.at) idx = i;
  });
  const cur = TIERS[idx];
  const next = TIERS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((spent - cur.at) / (next.at - cur.at)) * 100)) : 100;
  return (
    <div className="pf-card mt-card" style={{ "--tier": cur.color }}>
      <div className="mt-top">
        <span className="mt-chip">{cur.name}</span>
        <small>Member tier</small>
      </div>
      <b className="mt-spent">₹{Math.round(spent)} spent on tickets</b>
      <div className="mt-bar">
        <i style={{ width: pct + "%" }} />
      </div>
      <p className="mt-next">
        {next ? "Spend ₹" + Math.ceil(next.at - spent) + " more to reach " + next.name : "You are at the top tier"}
      </p>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const user = currentUser();
  const [bookings, setBookings] = useState([]);
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [dark, setDark] = useState(getTheme() === "dark");

  useEffect(() => {
    if (!user) return;
    syncWatchlist().then(setWatchlist);
    api
      .get("/bookings/me")
      .then((res) => setBookings(res.data))
      .catch(() => {});
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  async function invite() {
    const url = window.location.origin;
    const text = "Book movie tickets with live seat maps, offers and a wallet on BookMyShow: " + url;
    try {
      if (navigator.share) await navigator.share({ title: "BookMyShow", text, url });
      else await navigator.clipboard.writeText(text);
    } catch {}
  }

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
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

      <MemberTier bookings={confirmed} />

      <MovieRecap bookings={confirmed} />

      <GoalRing bookings={confirmed} />

      <WeekStreak bookings={confirmed} />

      <SpendChart bookings={confirmed} />

      <MovieLevel bookings={confirmed} />

      <TasteChips bookings={confirmed} />

      <MyRatings bookings={confirmed} />

      <MovieHeatmap bookings={confirmed} />

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

      <div className="pf-card pf-menu">
        <Link to="/forgot?change=1"><span><em>🔑</em>Change password</span><i>›</i></Link>
        <Link to="/wallet"><span><em>👛</em>Wallet</span><i>›</i></Link>
        <Link to="/offers"><span><em>🏷️</em>Offers &amp; coupons</span><i>›</i></Link>
        <Link to="/help"><span><em>❓</em>Help &amp; support</span><i>›</i></Link>
        <a href="#theme" onClick={(e) => { e.preventDefault(); const n = !dark; setDark(n); setTheme(n ? "dark" : "light"); }}>
          <span><em>{dark ? "🌙" : "☀️"}</em>Dark mode</span>
          <i className={"pf-switch" + (dark ? " on" : "")} aria-hidden="true"><b /></i>
        </a>
        <a href="#invite" onClick={(e) => { e.preventDefault(); invite(); }}><span><em>🎁</em>Invite friends</span><i>›</i></a>
      </div>

      <div className="pf-card">
        <h3>My Watchlist</h3>
        {watchlist.length === 0 && (
          <p className="pf-muted">Tap "I'm interested" on a coming-soon movie to save it here.</p>
        )}
        <div className="wl-grid">
          {watchlist.map((m) => (
            <Link className="wl-item" to={"/movie/" + m.id} key={m.id}>
              <img loading="lazy" decoding="async" src={thumb(m.poster_url)} alt={m.title} />
              <span>{m.title}</span>
              {m.release_date && m.upcoming !== false && <small className="wl-date">Releases {fmtDate(String(m.release_date).slice(0, 10))}</small>}
              {m.upcoming === false && <small className="wl-date on">Now showing</small>}
              <button
                className="wl-remove"
                aria-label={"Remove " + m.title + " from watchlist"}
                title="Remove"
                onClick={(e) => {
                  e.preventDefault();
                  setWatchlist(removeFromWatchlist(m.id));
                }}
              >
                ×
              </button>
            </Link>
          ))}
        </div>
      </div>

      <button className="pf-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}