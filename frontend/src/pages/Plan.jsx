import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { goBack } from "../nav";
import { api } from "../api";
import { swrGet } from "../cache";
import { getCity } from "../location";
import { thumb } from "../img";
import { IcBack } from "../components/Icons";

// Plan my day: pick 2 to 4 movies and a day; get back-to-back showtimes at ONE cinema with comfortable gaps.

const iso = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
function days() {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    out.push({
      key: iso(d),
      top: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
      sub: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
    });
  }
  return out;
}
const t12 = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return ((h + 11) % 12) + 1 + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM");
};
const mins = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};
const gapText = (g) => (g >= 60 ? Math.floor(g / 60) + "h " + (g % 60 ? (g % 60) + "m" : "") : g + " min");

export default function Plan() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [picked, setPicked] = useState([]);
  const [day, setDay] = useState(iso(new Date()));
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState(false);
  const week = useMemo(days, []);

  useEffect(() => {
    swrGet("/movies", (list) => setMovies(list.filter((m) => !m.upcoming)));
  }, []);

  useEffect(() => {
    if (picked.length < 2) {
      setPlans(null);
      return;
    }
    let live = true;
    setBusy(true);
    api
      .get("/plan", { params: { movieIds: picked.join(","), date: day, city: getCity() } })
      .then((r) => live && setPlans(r.data.plans))
      .catch(() => live && setPlans([]))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [picked, day]);

  function toggle(id) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  }

  return (
    <div className="plan-page">
      <div className="ml-top">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Plan my day</h1>
          <p>Pick 2 to 4 movies. We find back-to-back shows at one cinema.</p>
        </div>
      </div>

      <div className="plan-days">
        {week.map((d) => (
          <button type="button" key={d.key} className={d.key === day ? "on" : ""} onClick={() => setDay(d.key)}>
            <b>{d.top}</b>
            <small>{d.sub}</small>
          </button>
        ))}
      </div>

      <div className="plan-movies">
        {movies.map((m) => {
          const on = picked.includes(m.id);
          return (
            <button type="button" key={m.id} className={"plan-m" + (on ? " on" : "")} onClick={() => toggle(m.id)}>
              <img src={thumb(m.poster_url)} alt="" loading="lazy" />
              {on && <i>{picked.indexOf(m.id) + 1}</i>}
              <b>{m.title}</b>
            </button>
          );
        })}
      </div>

      {picked.length < 2 && <p className="plan-hint">Choose at least 2 movies to see your plan.</p>}
      {busy && <p className="plan-hint">Finding the best plan…</p>}
      {plans && plans.length === 0 && !busy && (
        <p className="plan-hint">No single cinema has all of these back to back on this day. Try another day or fewer movies.</p>
      )}
      {plans && plans.map((p, i) => {
        const first = p.shows[0];
        const last = p.shows[p.shows.length - 1];
        return (
          <div className="plan-card" key={p.theatre_id + "-" + i}>
            <div className="plan-head">
              <b>{p.theatre_name}</b>
              <small>
                {t12(first.start_time)} to {t12(last.end_time)}
                {p.gap_minutes > 0 ? " · " + gapText(p.gap_minutes) + " of breaks" : ""}
              </small>
              {i === 0 && <em>Best fit</em>}
            </div>
            {p.shows.map((s, k) => (
              <div key={s.id}>
                {k > 0 && (
                  <div className="plan-gap">
                    {gapText(mins(s.start_time) - mins(p.shows[k - 1].end_time))} break
                  </div>
                )}
                <button type="button" className="plan-show" onClick={() => navigate("/show/" + s.id)}>
                  <img src={thumb(s.poster_url)} alt="" loading="lazy" />
                  <span>
                    <b>{s.movie_title}</b>
                    <small>
                      {t12(s.start_time)} to {t12(s.end_time)}
                      {s.format ? " · " + s.format : ""} · from ₹{Math.round(Number(s.price))}
                    </small>
                  </span>
                  <i>Book ›</i>
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
