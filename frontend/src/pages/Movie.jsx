import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

export default function Movie() {
  const { id } = useParams();
  const [movie, setMovie] = useState();
  const [shows, setShows] = useState([]);

  useEffect(() => {
    api.get("/movies/" + id).then((res) => setMovie(res.data));
    api.get("/shows", { params: { movieId: id } }).then((res) => setShows(res.data));
  }, [id]);

  if (!movie) return <p>Loading...</p>;

  return (
    <div className="details card">
      <img src={movie.poster_url} alt={movie.title} />
      <section>
        <h1>{movie.title}</h1>
        <p>{movie.description}</p>
        <p>
          {movie.language} · {movie.genre} · {movie.duration_minutes} min · {movie.certificate}
        </p>
        <h2>Available Shows</h2>
        {shows.map((show) => (
          <Link className="show" to={"/show/" + show.id} key={show.id}>
            {show.show_date} · {show.start_time.slice(0, 5)} · ₹{show.price}
            <small>
              {show.theatre_name} / {show.screen_name}
            </small>
          </Link>
        ))}
      </section>
    </div>
  );
}
