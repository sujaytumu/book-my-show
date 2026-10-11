import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { IcBack, IcSearch } from "../components/Icons";
import { getCity } from "../location";

const IcFilter = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h18l-7 8v6l-4-2v-4z" />
  </svg>
);

export default function MovieList({ upcoming = false }) {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [genre, setGenre] = useState(null);
  const [topRated, setTopRated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/movies")
      .then((res) => setMovies(res.data))
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
  const filtered = !!(genre || topRated);

  return (
    <div className="ml-page">
      <div className="ml-top">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
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
          }}
          aria-label="Clear filters"
        >
          <IcFilter />
        </button>
        <span className="ml-sep" />
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
            {upcoming ? (
              <span className="ml-pill">Coming Soon</span>
            ) : (
              <span className="ml-rate">
                <i>★</i> {Number(m.rating || 0).toFixed(1)}
              </span>
            )}
            <b>{m.title}</b>
            {upcoming && <small>{m.genre}</small>}
          </Link>
        ))}
      </div>
      {!loading && list.length === 0 && <p className="empty-note">No movies found.</p>}
    </div>
  );
}
