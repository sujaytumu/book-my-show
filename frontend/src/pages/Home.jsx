import { useEffect, useMemo, useRef, useState } from "react";
import { thumb, prefetchPosters } from "../img";
import { Link } from "react-router-dom";
import { api } from "../api";
import { swrGet } from "../cache";
import { IcClap, IcFilm, IcLike, IcReel } from "../components/Icons";

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

// Poster image that fades in once loaded and falls back to a title card if the picture is missing or broken,
// so a poster that changes in the database (or fails to load) never leaves a blank hole in the row.
function PosterImg({ url, title, size, eager }) {
  // State is tied to the url it was recorded for, so a changed poster starts fresh without an effect.
  const [rec, setRec] = useState({ url, v: "" });
  const state = rec.url === url ? rec.v : "";
  const setState = (v) => setRec({ url, v });
  const ref = (el) => {
    if (el && el.complete && el.naturalWidth > 0 && !state) setState("ld");
  };
  if (!url || state === "err") {
    return <span className="pc-fallback">{title}</span>;
  }
  return (
    <img
      ref={ref}
      className={state}
      src={size ? thumb(url, size) : thumb(url)}
      alt={title}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setState("ld")}
      onError={() => setState("err")}
    />
  );
}

// "Releasing in 3 days" / "Releases tomorrow" / "Releases 12 Nov" for upcoming movies, like the real app.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function releaseChip(d) {
  if (!d) return "Coming Soon";
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return "Coming Soon";
  const today = new Date();
  const days = Math.round((new Date(y, m - 1, day) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (days === 0) return "Releases today";
  if (days === 1) return "Releases tomorrow";
  if (days > 1 && days <= 7) return "Releasing in " + days + " days";
  return "Releases " + day + " " + MON[m - 1];
}

function likesLabel(n) {
  n = Number(n) || 0;
  if (n >= 1000) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "K+ likes";
  return n + " likes";
}

function Poster({ movie, eager }) {
  return (
    <Link className="poster-card" to={"/movie/" + movie.id}>
      <div className="pc-img">
        <PosterImg url={movie.poster_url} title={movie.title} eager={eager} />
        {movie.upcoming && <span className="pc-rate soon">{releaseChip(movie.release_date)}</span>}
        {!movie.upcoming && flagFor(movie) && <i className="pc-flag">{flagFor(movie)}</i>}
      </div>
      {movie.upcoming && Number(movie.interested_base) > 0 && (
        <span className="pc-likes">
          <IcLike /> {likesLabel(movie.interested_base)}
        </span>
      )}
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
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bms_recent_movies") || "[]");
    } catch {
      return [];
    }
  });
  function clearRecent() {
    try {
      localStorage.removeItem("bms_recent_movies");
    } catch {}
    setRecent([]);
  }
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

  // Keep the posters live: re-read the movie list every minute and whenever the app comes back to the
  // foreground, so new releases, changed posters and "Coming Soon" -> "Now Showing" moves show up on their own.
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      swrGet("/movies", (data) => {
        if (Array.isArray(data)) setMovies(data);
      }).catch(() => {});
    };
    const t = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Telugu movies only.
  const telugu = useMemo(() => movies.filter((m) => m.language === "Telugu"), [movies]);
  const running = useMemo(() => telugu.filter((m) => !m.upcoming), [telugu]);
  const soon = useMemo(() => telugu.filter((m) => m.upcoming), [telugu]);
  // Warm every poster on the page (Coming Soon is far below the fold, so lazy loading would fetch it late).
  useEffect(() => {
    prefetchPosters([...soon, ...running], 30);
  }, [soon, running]);
  // Top Rated row (unchanged): best rated running movies.
  const hero = useMemo(() => [...running].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5), [running]);
  // Banner carousel: freshest releases first, then by rating, so a new release is always up front.
  const featured = useMemo(() => {
    const age = (m) => (m.release_date ? Date.now() - new Date(m.release_date + "T00:00:00").getTime() : Infinity);
    const fresh = (m) => age(m) >= 0 && age(m) <= 10 * 86400000;
    return [...running]
      .sort((a, b) => Number(fresh(b)) - Number(fresh(a)) || Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 6);
  }, [running]);

  // ---- banner carousel: loops forever, auto-advances, and stops while the finger/mouse is on it ----------------
  const heroRef = useRef(null);
  const [heroIdx, setHeroIdx] = useState(0); // index into `slides` (includes the two loop clones)
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const lastTouch = useRef(0);
  const settleTimer = useRef(0);
  const loop = featured.length > 1;
  const slides = useMemo(() => (loop ? [featured[featured.length - 1], ...featured, featured[0]] : featured), [featured, loop]);
  const realIdx = loop ? (heroIdx - 1 + featured.length) % featured.length : heroIdx;

  // Scroll offset that centres slide i (matches the CSS snap-align:center).
  function offsetFor(el, i) {
    const c = el.children[i];
    if (!c) return 0;
    const er = el.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    return el.scrollLeft + (cr.left - er.left) - (el.clientWidth - cr.width) / 2;
  }
  function nearest(el) {
    let best = 0;
    let bd = Infinity;
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
    for (let i = 0; i < el.children.length; i++) {
      const r = el.children[i].getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
  function goTo(i, smooth = true) {
    const el = heroRef.current;
    if (!el) return;
    el.scrollTo({ left: offsetFor(el, i), behavior: smooth ? "smooth" : "auto" });
  }

  // Start on the first real slide (index 1 when there are clones).
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !loop) return;
    goTo(1, false);
    setHeroIdx(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, featured.length, loading, isSoon]);

  function onHeroScroll() {
    const el = heroRef.current;
    if (!el) return;
    setHeroIdx(nearest(el));
    // Once scrolling stops on a clone, jump (invisibly) to the identical real slide: that is the endless loop.
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!loop || heldRef.current) return;
      const i = nearest(el);
      if (i === 0) goTo(featured.length, false);
      else if (i === slides.length - 1) goTo(1, false);
    }, 140);
  }
  function hold() {
    heldRef.current = true;
    lastTouch.current = Date.now();
    setHeld(true);
  }
  function release() {
    heldRef.current = false;
    lastTouch.current = Date.now();
    setHeld(false);
    // finger lifted while sitting on a clone: let the scroll settle, then the loop jump runs
    onHeroScroll();
  }

  useEffect(() => {
    if (!loop) return undefined;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = setInterval(() => {
      const el = heroRef.current;
      if (!el || document.hidden || heldRef.current) return;
      if (Date.now() - lastTouch.current < 1500) return; // just let go: give it a moment
      goTo(nearest(el) + 1);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, slides.length]);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

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
              <Poster movie={m} key={m.id} eager />
            ))}
          </div>
          {soon.length === 0 && <p className="empty-note">No upcoming Telugu movies right now.</p>}
        </>
      ) : (
        <>
          {featured.length > 0 && (
            <>
              <div
                className="hero-row"
                ref={heroRef}
                onScroll={onHeroScroll}
                onTouchStart={hold}
                onTouchEnd={release}
                onTouchCancel={release}
                onMouseEnter={hold}
                onMouseLeave={release}
              >
                {slides.map((m, si) => (
                  <Link key={si + "-" + m.id} to={"/movie/" + m.id} className="hero-card" draggable={false}>
                    <img className="hc-bg" src={thumb(m.poster_url, "w185")} alt="" />
                    <img decoding="async" className="hc-poster" src={si === (loop ? 1 : 0) ? thumb(m.poster_url) : m.poster_url} alt={m.title} draggable={false} fetchpriority={si <= 1 ? "high" : "auto"} />
                    <div>
                      <span className="hc-tag">NOW SHOWING</span>
                      <b>{m.title}</b>
                      <span>{m.genre}</span>
                      <span className="hc-rate">
                        <i>★</i> {Number(m.rating || 0).toFixed(1)}
                        {Number(m.votes) > 0 && <u>{votesLabel(m.votes)}</u>}
                      </span>
                      <em>Book now</em>
                    </div>
                  </Link>
                ))}
              </div>
              <div className={"hero-dots" + (held ? " hold" : "")}>
                {featured.map((m, i) => (
                  <i
                    key={m.id + (i === realIdx ? "-on-" + heroIdx : "")}
                    className={i === realIdx ? "on" : ""}
                    onClick={() => goTo(loop ? i + 1 : i)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="quick-row">
            {[["/offers", "🏷️", "Offers"], ["/wallet", "👛", "Wallet"], ["/bookings", "🎟️", "My tickets"], ["/plan", "🗓️", "Plan my day"], ["/help", "💬", "Help"]].map(([to, ic, label]) => (
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
                {last.poster_url && <img src={thumb(last.poster_url)} alt="" />}
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

          {recent.length > 1 && (
            <>
              <div className="hp-head">
                <h2 className="hp-h">Recently Viewed</h2>
                <a href="#clear" onClick={(e) => { e.preventDefault(); clearRecent(); }}>Clear</a>
              </div>
              <div className="poster-row">
                {recent.map((m) => (
                  <Poster movie={m} key={m.id} />
                ))}
              </div>
            </>
          )}

          {soon.length > 0 && (
            <>
              <div className="hp-head">
                <h2 className="hp-h">Coming Soon</h2>
                <Link to="/coming-soon">See All ›</Link>
              </div>
              <div className="poster-row">
                {soon.map((m) => (
                  <Poster movie={m} key={m.id} eager />
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
                      <img src={thumb(m.poster_url)} alt={m.title} loading="lazy" />
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
