import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

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

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All");

  useEffect(() => {
    api.get("/movies").then((res) => setMovies(res.data));
  }, []);

  async function search(value) {
    setQuery(value);
    const res = await api.get("/movies", { params: { q: value } });
    setMovies(res.data);
  }

  const languages = useMemo(() => ["All", ...new Set(movies.map((m) => m.language).filter(Boolean))], [movies]);
  const filtered = language === "All" ? movies : movies.filter((m) => m.language === language);
  const nowShowing = filtered.filter((m) => !m.upcoming);
  const comingSoon = filtered.filter((m) => m.upcoming);

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
        <div className="chip-row">
          {languages.map((lang) => (
            <button
              key={lang}
              className={"chip" + (language === lang ? " active" : "")}
              onClick={() => setLanguage(lang)}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      <div className="section-header">
        <h2 className="section-title">Now Showing</h2>
        <span className="section-count">{nowShowing.length} movies</span>
      </div>
      <div className="grid">
        {nowShowing.map((movie) => (
          <MovieCard movie={movie} key={movie.id} />
        ))}
      </div>

      {comingSoon.length > 0 && (
        <>
          <a href="#coming-soon" className="cta-banner">
            <div>
              <b>Coming Soon</b>
              <span>Explore upcoming movies</span>
            </div>
            <span>→</span>
          </a>
          <div className="section-header" id="coming-soon">
            <h2 className="section-title">Coming Soon</h2>
            <span className="section-count">{comingSoon.length} movies</span>
          </div>
          <div className="grid">
            {comingSoon.map((movie) => (
              <MovieCard movie={movie} key={movie.id} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
