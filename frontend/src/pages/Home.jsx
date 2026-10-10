import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const MAIN_LANGUAGES = ["Telugu", "Hindi", "Tamil", "Kannada", "Malayalam", "English"];

function MovieCard({ movie }) {
  return (
    <Link className="card movie" to={"/movie/" + movie.id}>
      <img src={movie.poster_url} alt={movie.title} loading="lazy" />
      <h3>{movie.title}</h3>
      <p>
        {movie.language} · {movie.genre}
      </p>
      {movie.upcoming ? <b className="coming-soon-tag">Coming Soon</b> : <b>★ {movie.rating}</b>}
    </Link>
  );
}

export default function Home({ mode = "now-showing" }) {
  const isComingSoon = mode === "coming-soon";
  const [movies, setMovies] = useState([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All");

  useEffect(() => {
    api.get("/movies").then((res) => setMovies(res.data));
    setQuery("");
    setLanguage("All");
  }, [mode]);

  async function search(value) {
    setQuery(value);
    const res = await api.get("/movies", { params: { q: value } });
    setMovies(res.data);
  }

  // Only the active view's movies - never both sets at once.
  const inView = movies.filter((m) => !!m.upcoming === isComingSoon);
  // Always offer the main Indian film languages (like BMS), plus any other language that has movies.
  const languages = useMemo(
    () => ["All", ...new Set([...inView.map((m) => m.language).filter(Boolean), ...MAIN_LANGUAGES])],
    [inView]
  );
  const filtered = language === "All" ? inView : inView.filter((m) => m.language === language);

  return (
    <>

      
        <div className="banner">
          <h1>Book movies. Pick seats. Enjoy.</h1>
          <p>End-to-end ticket booking with secure seat locking and Razorpay.</p>
        </div>
      

      <input
        className="search"
        placeholder="Search movies..."
        value={query}
        onChange={(e) => search(e.target.value)}
      />

      {languages.length > 1 && (
        <div className="chip-row lang-row">
          {languages.map((lang) => (
            <button
              key={lang}
              className={"chip" + (language === lang ? " active" : "")}
              onClick={() => setLanguage(lang)}
            >
              {lang}
              {lang !== "All" && <small>{inView.filter((m) => m.language === lang).length}</small>}
            </button>
          ))}
        </div>
      )}

      <Link to={isComingSoon ? "/" : "/coming-soon"} className="cta-banner">
        <div>
          <b>{isComingSoon ? "Now Showing" : "Coming Soon"}</b>
          <span>{isComingSoon ? "Browse movies in cinemas near you" : "Explore upcoming movies"}</span>
        </div>
        <span>→</span>
      </Link>

      <div className="section-header">
        <h2 className="section-title">{isComingSoon ? "Coming Soon" : "Now Showing"}</h2>
        <span className="section-count">{filtered.length} movies</span>
      </div>
      <div className="grid">
        {filtered.map((movie) => (
          <MovieCard movie={movie} key={movie.id} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="empty-note">
          No {isComingSoon ? "upcoming" : "running"} {language} movies right now.{" "}
          <button className="ghost" onClick={() => setLanguage("All")}>
            Show all
          </button>
        </p>
      )}
    </>
  );
}
