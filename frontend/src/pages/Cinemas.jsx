import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { goBack } from "../nav";
import { getCity } from "../location";
import { IcBack } from "../components/Icons";

export default function Cinemas() {
  const navigate = useNavigate();
  const city = getCity();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get("/theatres", { params: { city } })
      .then((r) => setList(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [city]);

  const shown = list.filter((t) => (t.name + " " + (t.address || "")).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="ml-page">
      <div className="ml-top">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Cinemas</h1>
          <p>
            {city} <i>|</i> {loading ? "…" : shown.length + (shown.length === 1 ? " cinema" : " cinemas")}
          </p>
        </div>
        <span />
      </div>
      <input className="cin-search" placeholder="Search for a cinema" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && <p className="empty-note">Loading cinemas…</p>}
      {!loading && shown.length === 0 && <p className="empty-note">No cinemas found in {city}.</p>}
      {shown.map((t) => (
        <div className="cin-card" key={t.id}>
          <div className="cin-head">
            <b>{t.name}</b>
            <span className={"cin-type " + (t.theatre_type === "MULTIPLEX" ? "mx" : "")}>{t.theatre_type === "MULTIPLEX" ? "MULTIPLEX" : "SINGLE SCREEN"}</span>
          </div>
          {t.address && <p className="cin-addr">📍 {t.address}</p>}
          <p className={"cin-can" + (t.cancellable ? "" : " no")}>{t.cancellable ? "✓ Cancellation available" : "Non-cancellable"}</p>
          <div className="cin-movies">
            {String(t.movies || "")
              .split("|")
              .filter(Boolean)
              .map((x) => {
                const i = x.indexOf(":");
                return (
                  <Link key={x} to={"/movie/" + x.slice(0, i)}>
                    {x.slice(i + 1)}
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
