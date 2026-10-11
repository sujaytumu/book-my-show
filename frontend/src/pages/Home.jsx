import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { IcClap, IcFilm, IcReel } from "../components/Icons";

function Poster({ movie }) {
  return (
    <Link className="poster-card" to={"/movie/" + movie.id}>
      <div className="pc-img">
        <img src={movie.poster_url} alt={movie.title} loading="lazy" />
        {movie.upcoming ? (
          <span className="pc-rate soon">Coming Soon</span>
        ) : (
          <span className="pc-rate">
            <i>★</i> {Number(movie.rating || 0).toFixed(1)}/10
          </span>
        )}
      </div>
      <b>{movie.title}</b>
      <small>{movie.genre}</small>
    </Link>
  );
}

export default function Home({ mode = "now-showing" }) {
  const isSoon = mode === "coming-soon";
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/movies")
      .then((res) => setMovies(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [mode]);

  // Telugu movies only.
  const telugu = useMemo(() => movies.filter((m) => m.language === "Telugu"), [movies]);
  const running = telugu.filter((m) => !m.upcoming);
  const soon = telugu.filter((m) => m.upcoming);
  const hero = [...running].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5);

  return (
    <div className="home-page">
      <div className="home-tabs">
        <Link to="/now-showing" className={!isSoon ? "on" : ""}>
          <IcReel width={34} height={34} />
          Movies
        </Link>
        <Link to="/coming-soon" className={isSoon ? "on" : ""}>
          <IcClap width={34} height={34} />
          Coming Soon
        </Link>
        <a href="#top-rated" onClick={(e) => { e.preventDefault(); document.getElementById("top-rated")?.scrollIntoView({ behavior: "smooth" }); }}>
          <IcFilm width={34} height={34} />
          Top Rated
        </a>
      </div>

      {loading ? (
        <>
          <div className="sk sk-hero" />
          <div className="sk sk-line w40" />
          <div className="sk-row">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="sk sk-poster" />
                <div className="sk sk-line" />
              </div>
            ))}
          </div>
        </>
      ) : isSoon ? (
        <>
          <h2 className="hp-h">Coming Soon</h2>
          <div className="poster-grid">
            {soon.map((m) => (
              <Poster movie={m} key={m.id} />
            ))}
          </div>
          {soon.length === 0 && <p className="empty-note">No upcoming Telugu movies right now.</p>}
        </>
      ) : (
        <>
          {hero.length > 0 && (
            <div className="hero-row">
              {hero.map((m) => (
                <Link key={m.id} to={"/movie/" + m.id} className="hero-card">
                  <img src={m.poster_url} alt={m.title} />
                  <div>
                    <b>{m.title}</b>
                    <span>{m.genre}</span>
                    <em>Book now</em>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="hp-head">
            <h2 className="hp-h">Recommended Movies</h2>
            <Link to="/now-showing">See All ›</Link>
          </div>
          <div className="poster-row">
            {running.map((m) => (
              <Poster movie={m} key={m.id} />
            ))}
          </div>
          {running.length === 0 && <p className="empty-note">No Telugu movies running right now.</p>}

          {soon.length > 0 && (
            <>
              <div className="hp-head">
                <h2 className="hp-h">Coming Soon</h2>
                <Link to="/coming-soon">See All ›</Link>
              </div>
              <div className="poster-row">
                {soon.map((m) => (
                  <Poster movie={m} key={m.id} />
                ))}
              </div>
            </>
          )}

          <div className="hp-head" id="top-rated">
            <h2 className="hp-h">Top Rated</h2>
          </div>
          <div className="poster-row">
            {hero.map((m) => (
              <Poster movie={m} key={m.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
