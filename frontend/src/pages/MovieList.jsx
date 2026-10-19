import { useEffect, useMemo, useState } from "react";
import { goBack } from "../nav";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { swrGet } from "../cache";
import { IcBack, IcSearch } from "../components/Icons";
import { getCity } from "../location";

const IcFilter = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h18l-7 8v6l-4-2v-4z" />
  </svg>
);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtRelease(d) {
  if (!d) return "";
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  return day + " " + MON[m - 1] + ", " + y;
}
function fmtVotes(n) {
  n = Number(n || 0);
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K+ votes";
  return n + (n === 1 ? " vote" : " votes");
}

export default function MovieList({ upcoming = false }) {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [genre, setGenre] = useState(null);
  const [topRated, setTopRated] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    swrGet("/movies", (data) => {
      setMovies(data);
      setLoading(false);
    })
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [upcoming]);

  const base = useMemo(() => movies.filter((m) => m.language === "Telugu" && !!m.upcoming === upcoming), [movies, upcoming]);
  const genres = useMemo(() => {
    const set = new Set();
    base.forEach((m) =>
      String(m.genre || "")
        .split(/[,/]/)
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => set.add(g))
    );
    return [...set].sort();
  }, [base]);

  let list = genre ? base.filter((m) => String(m.genre || "").split(/[,/]/).map((g) => g.trim()).includes(genre)) : base;
  if (topRated) list = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  if (newOnly) {
    const cutoff = Date.now() - 21 * 86400000;
    list = list.filter((m) => m.release_date && new Date(String(m.release_date).slice(0, 10)).getTime() >= cutoff);
  }
  const filtered = !!(genre || topRated || newOnly);

  return (
    <div className="ml-page">
      <div className="ml-top">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>{upcoming ? "Coming soon" : "Now Showing"}</h1>
          <p>
            {getCity()} <i>|</i> {loading ? "…" : list.length + (list.length === 1 ? " Movie" : " Movies")}
          </p>
        </div>
        <Link to="/search" aria-label="Search">
          <IcSearch width={26} height={26} />
        </Link>
      </div>

      <div className="ml-chips">
        <button
          type="button"
          className={"ml-filter" + (filtered ? " on" : "")}
          onClick={() => {
            setGenre(null);
            setTopRated(false);
            setNewOnly(false);
          }}
          aria-label="Clear filters"
        >
          <IcFilter />
        </button>
        <span className="ml-sep" />
        {!upcoming && (
          <button type="button" className={newOnly ? "on" : ""} onClick={() => setNewOnly((v) => !v)}>
            New Releases
          </button>
        )}
        <button type="button" className={topRated ? "on" : ""} onClick={() => setTopRated((v) => !v)}>
          Top Rated
        </button>
        {genres.map((g) => (
          <button type="button" key={g} className={genre === g ? "on" : ""} onClick={() => setGenre(genre === g ? null : g)}>
            {g}
          </button>
        ))}
      </div>

      <Link to={upcoming ? "/now-showing" : "/coming-soon"} className="ml-banner">
        <b>{upcoming ? "Now Showing" : "Coming Soon"}</b>
        <span>{upcoming ? "In Cinemas near you" : "Explore Upcoming Movies"}</span>
        <em>›</em>
      </Link>

      {loading && (
        <div className="ml-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <div className="sk sk-poster" />
              <div className="sk sk-line" />
            </div>
          ))}
        </div>
      )}

      <div className="ml-grid">
        {list.map((m) => (
          <Link key={m.id} to={"/movie/" + m.id} className="ml-card">
            <img src={m.poster_url} alt={m.title} loading="lazy" />
            {!upcoming && Number(m.rating) >= 9 && <i className="ml-promo">TOP RATED</i>}
            {upcoming ? (
              <span className="ml-pill">{m.release_date ? fmtRelease(m.release_date) : "Coming Soon"}</span>
            ) : (
              <span className="ml-rate">
                <span>
                  <i>★</i> {Number(m.rating || 0).toFixed(1)}
                </span>
                {Number(m.votes) > 0 && <em>{fmtVotes(m.votes)}</em>}
              </span>
            )}
            <b>{m.title}</b>
            {upcoming && Number(m.interested_base) > 0 && (
              <small className="ml-likes">
                <i>👍</i> {fmtVotes(m.interested_base).replace("+ votes", "+").replace(" votes", "")} likes
              </small>
            )}
            {upcoming && <small>{m.genre}</small>}
          </Link>
        ))}
      </div>
      {!loading && list.length === 0 && <p className="empty-note">No movies found.</p>}
      {!upcoming && (
        <Link to="/cinemas" className="browse-cin">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          Browse by Cinemas
        </Link>
      )}
    </div>
  );
}
