import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

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
      <div className="grid">
        {movies.map((movie) => (
          <Link className="card movie" to={"/movie/" + movie.id} key={movie.id}>
            <img src={movie.poster_url} alt={movie.title} />
            <h3>{movie.title}</h3>
            <p>
              {movie.language} · {movie.genre}
            </p>
            <b>★ {movie.rating}</b>
          </Link>
        ))}
      </div>
    </>
  );
}
