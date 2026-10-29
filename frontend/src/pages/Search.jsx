import { useEffect, useMemo, useState } from "react";
import { thumb } from "../img";
import { goBack } from "../nav";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { swrGet } from "../cache";
import { IcBack } from "../components/Icons";

const RKEY = "bms_recent";
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RKEY) || "[]");
  } catch {
    return [];
  }
}
function saveRecent(list) {
  try {
    localStorage.setItem(RKEY, JSON.stringify(list));
  } catch {}
}

export default function Search() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState(loadRecent);
  function remember(text) {
    const t = String(text || "").trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setRecent(next);
    saveRecent(next);
  }

  useEffect(() => {
    swrGet("/movies", (data) => {
      setMovies(data);
      setLoading(false);
    })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const telugu = useMemo(() => movies.filter((m) => m.language === "Telugu"), [movies]);
  const running = telugu.filter((m) => !m.upcoming).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  const needle = q.trim().toLowerCase();
  const results = needle ? telugu.filter((m) => m.title.toLowerCase().includes(needle)) : null;

  return (
    <div className="search-page">
      <div className="sp-bar">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack />
        </button>
        <input
          placeholder="Search for latest movies"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && remember(q)}
        />
      </div>

      {loading ? (
        <>
          <div className="sk sk-line w40 sk-h" />
          <div className="sp-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div className="sp-item" key={i}>
                <div className="sk sk-thumb" />
                <span style={{ flex: 1 }}>
                  <div className="sk sk-line" />
                  <div className="sk sk-line w60" />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : results ? (
        <>
          <h2 className="sp-h">Movies</h2>
          <div className="sp-grid">
            {results.map((m) => (
              <Link key={m.id} to={"/movie/" + m.id} className="sp-item" onClick={() => remember(m.title)}>
                <img loading="lazy" decoding="async" src={thumb(m.poster_url)} alt="" />
                <span>
                  <b>{m.title}</b>
                  <small>{m.upcoming ? "Coming Soon" : "Movies"}</small>
                </span>
              </Link>
            ))}
          </div>
          {results.length === 0 && <p className="empty-note">No movies match "{q}".</p>}
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <div className="sp-recent-head">
                <h2 className="sp-h">Recent searches</h2>
                <button
                  type="button"
                  onClick={() => {
                    setRecent([]);
                    saveRecent([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="sp-recent">
                {recent.map((r) => (
                  <button type="button" key={r} onClick={() => setQ(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
          <h2 className="sp-h">Trending Now</h2>
          <div className="sp-grid">
            {running.slice(0, 10).map((m) => (
              <Link key={m.id} to={"/movie/" + m.id} className="sp-item">
                <img src={thumb(m.poster_url)} alt="" loading="lazy" decoding="async" />
                <span>
                  <b>{m.title}</b>
                  <small>Movies</small>
                </span>
              </Link>
            ))}
          </div>
          <h2 className="sp-h">Recommended For You</h2>
          <div className="rec-row">
            {running.slice(0, 8).map((m) => (
              <Link key={m.id} to={"/movie/" + m.id} className="rec-big">
                <img src={thumb(m.poster_url)} alt={m.title} loading="lazy" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
