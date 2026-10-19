import { useEffect, useState } from "react";
import { api } from "../api";

const inr = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");
const short = (n) => {
  n = Number(n || 0);
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
};

function Bars({ rows, labelKey, valueKey, fmt = short, color = "#dc3558" }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)));
  if (rows.length === 0) return <p className="an-empty">No data in this period yet.</p>;
  return (
    <div className="an-hbars">
      {rows.map((r) => (
        <div className="an-hrow" key={r[labelKey]}>
          <span className="an-hlabel">{r[labelKey]}</span>
          <span className="an-htrack">
            <i style={{ width: (Number(r[valueKey] || 0) / max) * 100 + "%", background: color }} />
          </span>
          <b>{fmt(r[valueKey])}</b>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    api
      .get("/admin/analytics", { params: { days } })
      .then((r) => setData(r.data))
      .catch((e) => setErr((e.response && e.response.data && e.response.data.message) || "Could not load analytics"));
  }, [days]);

  if (err) return <p className="notice">{err}</p>;
  if (!data) return <p className="an-empty">Loading analytics…</p>;

  const t = data.totals;
  const daily = data.daily || [];
  const maxRev = Math.max(1, ...daily.map((x) => Number(x.revenue)));
  const W = 320;
  const H = 110;
  const bw = W / Math.max(1, daily.length);

  const kpis = [
    ["Revenue", inr(t.revenue), "an-k-red"],
    ["Bookings", short(t.bookings)],
    ["Tickets sold", short(t.tickets)],
    ["Avg order", inr(t.avg_order)],
    ["Today", inr(t.revenue_today)],
    ["Cancelled", short(t.cancelled)],
    ["Next 7 days fill", Number(data.occupancy.fill_percent) + "%"],
    ["Users", short(t.users)],
    ["Waitlisted", short(t.waitlisted)],
    ["Watchlisted", short(t.watchlisted)],
  ];

  const hours = (data.peakHours || []).map((h) => ({
    label: (h.hr % 12 || 12) + (h.hr >= 12 ? " PM" : " AM"),
    bookings: h.bookings,
  }));

  return (
    <div className="an-wrap">
      <div className="an-head">
        <h2>Analytics</h2>
        <div className="an-range">
          {[7, 30, 90].map((d) => (
            <button type="button" key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="an-kpis">
        {kpis.map(([label, value, cls]) => (
          <div className={"an-kpi " + (cls || "")} key={label}>
            <b>{value}</b>
            <small>{label}</small>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Revenue per day</h3>
        <svg viewBox={"0 0 " + W + " " + (H + 18)} className="an-chart" role="img" aria-label="Revenue per day">
          {daily.map((x, i) => {
            const h = (Number(x.revenue) / maxRev) * H;
            return (
              <rect key={x.label} x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={Math.max(h, Number(x.revenue) > 0 ? 2 : 0)} rx="2" fill="#dc3558">
                <title>{x.label + ": " + inr(x.revenue) + " · " + x.bookings + " bookings"}</title>
              </rect>
            );
          })}
          <line x1="0" y1={H} x2={W} y2={H} stroke="#ddd" />
          <text x="0" y={H + 13} fontSize="8" fill="#888">{daily.length ? daily[0].label.slice(5) : ""}</text>
          <text x={W} y={H + 13} fontSize="8" fill="#888" textAnchor="end">{daily.length ? daily[daily.length - 1].label.slice(5) : ""}</text>
        </svg>
      </div>

      <div className="card">
        <h3>Top movies (tickets)</h3>
        <Bars rows={data.topMovies || []} labelKey="title" valueKey="tickets" />
      </div>
      <div className="card">
        <h3>Top cinemas (revenue)</h3>
        <Bars rows={(data.topTheatres || []).map((x) => ({ ...x, label: x.name + (x.city ? " · " + x.city : "") }))} labelKey="label" valueKey="revenue" fmt={inr} color="#2f6fed" />
      </div>
      <div className="card">
        <h3>Peak show times (bookings)</h3>
        <Bars rows={hours} labelKey="label" valueKey="bookings" color="#f59e0b" />
      </div>
      <div className="card">
        <h3>How people pay</h3>
        <Bars rows={data.paymentMix || []} labelKey="method" valueKey="revenue" fmt={inr} color="#15803d" />
      </div>
    </div>
  );
}
