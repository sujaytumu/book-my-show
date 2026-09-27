import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

export default function Movie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState();
  const [shows, setShows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    api.get("/movies/" + id).then((res) => setMovie(res.data));
    api.get("/shows", { params: { movieId: id } }).then((res) => {
      setShows(res.data);
      if (res.data.length) setSelectedDate(res.data[0].show_date);
    });
  }, [id]);

  const dates = useMemo(() => [...new Set(shows.map((s) => s.show_date))], [shows]);

  // Shows are already sorted nearest-to-JNTU-metro-first by the API; group
  // by theatre while preserving that order, the same way BMS lists theatres
  // for a movie nearest-first for the selected area.
  const theatreGroups = useMemo(() => {
    const forDate = shows.filter((s) => s.show_date === selectedDate);
    const groups = [];
    for (const show of forDate) {
      let group = groups.find((g) => g.theatre_name === show.theatre_name);
      if (!group) {
        group = { theatre_name: show.theatre_name, distance_from_jntu_km: show.distance_from_jntu_km, shows: [] };
        groups.push(group);
      }
      group.shows.push(show);
    }
    return groups;
  }, [shows, selectedDate]);

  if (!movie) return <p>Loading...</p>;

  return (
    <div className="movie-page">
      <div className="details card">
        <img src={movie.poster_url} alt={movie.title} />
        <section>
          <h1>{movie.title}</h1>
          <p>{movie.description}</p>
          <p>
            {movie.language} · {movie.genre} · {movie.duration_minutes} min · {movie.certificate} · ★ {movie.rating}
          </p>
        </section>
      </div>

      {dates.length > 0 && (
        <div className="date-strip">
          {dates.map((d) => (
            <button
              key={d}
              className={"date-pill" + (d === selectedDate ? " active" : "")}
              onClick={() => setSelectedDate(d)}
            >
              {new Date(d).toLocaleDateString("en-IN", { weekday: "short" })}
              <b>{new Date(d).getDate()}</b>
              {new Date(d).toLocaleDateString("en-IN", { month: "short" })}
            </button>
          ))}
        </div>
      )}

      <h2>Cinemas near JNTU Metro</h2>
      {theatreGroups.length === 0 && <p>No shows scheduled for this date.</p>}
      {theatreGroups.map((group) => (
        <div className="theatre-block card" key={group.theatre_name}>
          <div className="theatre-block-header">
            <h3>{group.theatre_name}</h3>
            <span className="distance-tag">{group.distance_from_jntu_km} km from JNTU Metro</span>
          </div>
          <div className="time-slots">
            {group.shows.map((show) => (
              <button key={show.id} className="time-slot" onClick={() => navigate("/show/" + show.id)}>
                {show.start_time.slice(0, 5)}
                <small>₹{show.price}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
