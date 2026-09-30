import { useEffect, useState } from "react";
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

  useEffect(() => {
    api.get("/movies").then((res) => setMovies(res.data));
  }, []);

  async function search(value) {
    setQuery(value);
    const res = await api.get("/movies", { params: { q: value } });
    setMovies(res.data);
  }

  const nowShowing = movies.filter((m) => !m.upcoming);
  const comingSoon = movies.filter((m) => m.upcoming);

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

      <h2 className="section-title">Now Showing</h2>
      <div className="grid">
        {nowShowing.map((movie) => (
          <MovieCard movie={movie} key={movie.id} />
        ))}
      </div>

      {comingSoon.length > 0 && (
        <>
          <h2 className="section-title">Coming Soon</h2>
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
