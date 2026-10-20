import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { swrGet } from "../cache";
import { IcClap, IcFilm, IcReel } from "../components/Icons";

function votesLabel(n) {
  n = Number(n) || 0;
  if (n >= 1000) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "K+ votes";
  return n + " votes";
}

function flagFor(m) {
  if (m.release_date) {
    const days = (Date.now() - new Date(m.release_date + "T00:00:00").getTime()) / 86400000;
    if (days >= 0 && days <= 10) return "NEW";
  }
  if (Number(m.rating) >= 9) return "TOP RATED";
  return "";
}

function Poster({ movie }) {
  return (
    <Link className="poster-card" to={"/movie/" + movie.id}>
      <div className="pc-img">
        <img src={movie.poster_url} alt={movie.title} loading="lazy" />
        {movie.upcoming && <span className="pc-rate soon">Coming Soon</span>}
        {!movie.upcoming && flagFor(movie) && <i className="pc-flag">{flagFor(movie)}</i>}
      </div>
      {!movie.upcoming && (
        <span className="pc-meta">
          <span>
            <i>★</i> {Number(movie.rating || 0).toFixed(1)}
          </span>
          {Number(movie.votes) > 0 && <em>{votesLabel(movie.votes)}</em>}
        </span>
      )}
      <b>{movie.title}</b>
      <small>{movie.genre}</small>
    </Link>
  );
}

export default function Home({ mode = "now-showing" }) {
  const isSoon = mode === "coming-soon";
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [last, setLast] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bms_last_movie") || "null");
    } catch {
      return null;
    }
  });
  function dismissLast() {
    try {
      localStorage.removeItem("bms_last_movie");
    } catch {}
    setLast(null);
  }

  useEffect(() => {
    swrGet("/movies", (data) => {
      setMovies(data);
      setLoading(false);
    })
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [mode]);

  // Telugu movies only.
  const telugu = useMemo(() => movies.filter((m) => m.language === "Telugu"), [movies]);
  const running = telugu.filter((m) => !m.upcoming);
  const soon = telugu.filter((m) => m.upcoming);
  const heroRef = useRef(null);
  const [heroIdx, setHeroIdx] = useState(0);
  function onHeroScroll(e) {
    const el = e.currentTarget;
    const w = el.firstChild ? el.firstChild.getBoundingClientRect().width + 12 : 1;
    setHeroIdx(Math.round(el.scrollLeft / w));
  }
  const hero = [...running].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5);
  useEffect(() => {
    if (hero.length < 2) return undefined;
    const t = setInterval(() => {
      const el = heroRef.current;
      if (!el || !el.firstChild) return;
      const w = el.firstChild.getBoundingClientRect().width + 12;
      const next = (Math.round(el.scrollLeft / w) + 1) % hero.length;
      el.scrollTo({ left: next * w, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(t);
  }, [hero.length]);

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
            <>
              <div className="hero-row" ref={heroRef} onScroll={onHeroScroll}>
                {hero.map((m) => (
                  <Link key={m.id} to={"/movie/" + m.id} className="hero-card">
                    <img className="hc-bg" src={m.poster_url} alt="" />
                    <img decoding="async" className="hc-poster" src={m.poster_url} alt={m.title} />
                    <div>
                      <span className="hc-tag">NOW SHOWING</span>
                      <b>{m.title}</b>
                      <span>{m.genre}</span>
                      <span className="hc-rate">
                        <i>★</i> {Number(m.rating || 0).toFixed(1)}
                        {Number(m.votes) > 0 && <u>{votesLabel(m.votes)} votes</u>}
                      </span>
                      <em>Book now</em>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="hero-dots">
                {hero.map((m, i) => (
                  <i key={m.id} className={i === heroIdx ? "on" : ""} />
                ))}
              </div>
            </>
          )}

          <div className="quick-row">
            {[["/offers", "🏷️", "Offers"], ["/wallet", "👛", "Wallet"], ["/bookings", "🎟️", "My tickets"], ["/help", "💬", "Help"]].map(([to, ic, label]) => (
              <Link to={to} key={to}>
                <span>{ic}</span>
                <small>{label}</small>
              </Link>
            ))}
          </div>

          <Link to="/offers" className="offer-banner">
            <div>
              <small>LIMITED OFFER</small>
              <b>Flat 10% off up to ₹100</b>
              <span>Use code BMS10 at payment</span>
            </div>
            <em>Grab ›</em>
          </Link>

          {last && (
            <div className="resume-card">
              <div className="rc-head">
                <b>Pick Up Where You Left Off</b>
                <button type="button" onClick={dismissLast} aria-label="Dismiss">
                  ×
                </button>
              </div>
              <div className="rc-body">
                {last.poster_url && <img src={last.poster_url} alt="" />}
                <div>
                  <b>{last.title}</b>
                  <small>★ {Number(last.rating || 0).toFixed(1)}</small>
                  <small>{last.genre}</small>
                </div>
              </div>
              <Link to={"/movie/" + last.id + "?book=1"} className="rc-btn">
                Resume booking
              </Link>
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

          {running.length > 2 && (
            <>
              <div className="hp-head">
                <h2 className="hp-h">🔥 Trending now</h2>
              </div>
              <div className="trend-row">
                {[...running]
                  .sort((x, y) => Number(y.votes || 0) - Number(x.votes || 0))
                  .slice(0, 5)
                  .map((m, i) => (
                    <Link to={"/movie/" + m.id} className="trend-card" key={m.id}>
                      <span className="trend-n">{i + 1}</span>
                      <img src={m.poster_url} alt={m.title} loading="lazy" />
                    </Link>
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
