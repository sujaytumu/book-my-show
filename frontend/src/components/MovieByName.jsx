import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Admin tools to add movies by name instead of typing every detail:
//  1. "Add a movie by name": type a title, pick the right film, see exactly what will be saved, add it.
//  2. "Needs details": movies that are missing a poster, cast, dates... with a one-tap Auto-fill.
// Everything is fetched by the server from the movie database (TMDB); this screen only shows and confirms it.

const fmtDate = (iso) => {
  if (!iso) return "Date not announced";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const errText = (e) => (e && e.response && e.response.data && e.response.data.message) || "Something went wrong. Try again.";

function Chip({ children }) {
  return children ? <span className="mbn-chip">{children}</span> : null;
}

function Preview({ d, onAdd, busy }) {
  const upcoming = d.releaseDate && d.releaseDate > todayIso();
  const cast = (d.castCrew || []).filter((p) => p.role === "Actor");
  const crew = (d.castCrew || []).filter((p) => p.role !== "Actor");
  return (
    <div className="mbn-preview">
      <div className="mbn-pv-top">
        {d.posterUrl ? <img src={d.posterUrl} alt="" /> : <div className="mbn-noposter">No poster</div>}
        <div className="mbn-pv-main">
          <b>{d.title}</b>
          <div className="mbn-chips">
            <Chip>{d.language}</Chip>
            <Chip>{d.genre}</Chip>
            <Chip>{d.durationMinutes ? Math.floor(d.durationMinutes / 60) + "h " + (d.durationMinutes % 60) + "m" : null}</Chip>
            <Chip>{d.certificate}</Chip>
          </div>
          <div className={"mbn-when" + (upcoming ? " soon" : "")}>
            {d.releaseDate
              ? upcoming
                ? "Releases " + fmtDate(d.releaseDate) + ". It moves to Now Showing on its own that day."
                : "Released " + fmtDate(d.releaseDate) + ". It goes straight to Now Showing."
              : "Release date not announced yet. It stays in Coming Soon and updates itself when announced."}
          </div>
        </div>
      </div>
      {d.description && <p className="mbn-overview">{d.description}</p>}
      {cast.length > 0 && (
        <div className="mbn-cast">
          {cast.slice(0, 8).map((p) => (
            <div key={p.name}>
              {p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <i>{p.name.charAt(0)}</i>}
              <small>{p.name}</small>
            </div>
          ))}
        </div>
      )}
      {crew.length > 0 && (
        <p className="mbn-crew">
          {crew.map((p) => p.role + ": " + p.name).join(" · ")}
        </p>
      )}
      {d.trailerKey && (
        <a className="mbn-trailer" href={"https://www.youtube.com/watch?v=" + d.trailerKey} target="_blank" rel="noreferrer">
          Watch trailer
        </a>
      )}
      <button type="button" className="mbn-add" disabled={busy} onClick={onAdd}>
        {busy ? "Adding…" : "Add to catalogue"}
      </button>
    </div>
  );
}

export function AddByName({ onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null); // null = nothing searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const seq = useRef(0);

  // Search as you type (after a short pause).
  useEffect(() => {
    const text = q.trim();
    setDone("");
    if (text.length < 2) {
      setResults(null);
      setError("");
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get("/admin/movies/lookup", { params: { query: text } })
        .then((r) => {
          if (mine !== seq.current) return;
          setResults(r.data.results || []);
          setError("");
        })
        .catch((e) => {
          if (mine !== seq.current) return;
          setResults(null);
          setError(errText(e));
        })
        .finally(() => mine === seq.current && setLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  function pick(c) {
    setPicked(c.tmdbId);
    setDetail(null);
    setError("");
    api
      .get("/admin/movies/lookup/" + c.tmdbId)
      .then((r) => setDetail(r.data))
      .catch((e) => setError(errText(e)));
  }

  async function add() {
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/admin/movies/from-lookup", { tmdbId: picked });
      const s = r.data.status;
      setDone(
        s === "exists"
          ? "That movie is already in the catalogue."
          : s === "completed"
          ? "Completed the existing entry: " + (r.data.filled || []).join(", ") + "."
          : (r.data.title || "Movie") + " added with poster, cast, language and release date. " +
            (r.data.upcoming ? "It appears under Coming Soon and moves to Now Showing automatically on " + fmtDate(r.data.releaseDate) + "." : "It is now showing.")
      );
      setPicked(null);
      setDetail(null);
      setResults(null);
      setQ("");
      if (onChange) onChange();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const notSetUp = /not set up|TMDB_API_KEY/i.test(error);
  return (
    <div className="card mbn">
      <h2>Add a movie by name</h2>
      <p className="mbn-hint">Type the name. Poster, language, genre, runtime, certificate, release date and cast &amp; crew are filled in for you.</p>
      <input
        className="mbn-input"
        placeholder="Movie name, e.g. Ranabaali"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {done && <p className="mbn-done">{done}</p>}
      {error && (
        <div className={"mbn-error" + (notSetUp ? " setup" : "")}>
          {error}
          {notSetUp && (
            <small>
              One-time setup: create a free account at themoviedb.org, open Settings → API, copy the API key, and add it as
              <b> TMDB_API_KEY </b> in the server settings (Render → Environment). Then restart the server.
            </small>
          )}
        </div>
      )}
      {loading && <div className="mbn-loading">Searching…</div>}
      {results && results.length === 0 && !loading && <p className="mbn-empty">No film found with that name. Check the spelling or add the year.</p>}
      {results && results.length > 0 && (
        <div className="mbn-results">
          {results.slice(0, 10).map((c) => (
            <button type="button" key={c.tmdbId} className={"mbn-card" + (picked === c.tmdbId ? " on" : "")} onClick={() => pick(c)}>
              {c.poster ? <img src={c.poster} alt="" loading="lazy" /> : <div className="mbn-noposter">No poster</div>}
              <b>{c.title}</b>
              <small>{[c.year, c.language].filter(Boolean).join(" · ")}</small>
            </button>
          ))}
        </div>
      )}
      {picked && !detail && !error && <div className="mbn-loading">Getting the details…</div>}
      {detail && <Preview d={detail} onAdd={add} busy={busy} />}
    </div>
  );
}

const FIELDS = [
  ["poster_url", "poster"],
  ["description", "description"],
  ["language", "language"],
  ["genre", "genre"],
  ["duration_minutes", "runtime"],
  ["release_date", "release date"],
  ["cast_crew", "cast & crew"],
];
const missingOf = (m) =>
  FIELDS.filter(([k]) => (k === "cast_crew" ? m.has_cast === false : m[k] == null || String(m[k]).trim() === "")).map(([, label]) => label);

export function NeedsDetails({ movies, onChange }) {
  const [state, setState] = useState({}); // id -> { busy, note, suggestions }
  const needing = (movies || []).map((m) => ({ m, missing: missingOf(m) })).filter((x) => x.missing.length > 0);
  if (needing.length === 0) return null;

  async function fill(id, tmdbId) {
    setState((s) => ({ ...s, [id]: { busy: true } }));
    try {
      const r = await api.post("/admin/movies/" + id + "/auto-fill", tmdbId ? { tmdbId } : {});
      setState((s) => ({ ...s, [id]: { note: r.data.note, suggestions: r.data.suggestions || [], ok: r.data.matched } }));
      if (r.data.matched && onChange) onChange();
    } catch (e) {
      setState((s) => ({ ...s, [id]: { note: errText(e), ok: false } }));
    }
  }

  return (
    <div className="card mbn">
      <h2>Needs details ({needing.length})</h2>
      <p className="mbn-hint">These movies have gaps. Auto-fill gets them from the movie database. It also runs by itself every few hours.</p>
      {needing.map(({ m, missing }) => {
        const st = state[m.id] || {};
        return (
          <div className="mbn-row" key={m.id}>
            <div className="mbn-row-main">
              <b>{m.title}</b>
              <small>Missing: {missing.join(", ")}</small>
              {st.note && <em className={st.ok ? "ok" : ""}>{st.note}</em>}
              {st.suggestions && st.suggestions.length > 0 && (
                <div className="mbn-sugg">
                  {st.suggestions.map((c) => (
                    <button type="button" key={c.tmdbId} onClick={() => fill(m.id, c.tmdbId)}>
                      {c.title}
                      {c.year ? " (" + c.year + ")" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="mbn-fill" disabled={st.busy} onClick={() => fill(m.id)}>
              {st.busy ? "…" : "Auto-fill"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
