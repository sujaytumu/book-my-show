import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { haversineKm } from "../components/TheatreMap";

export default function Movie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState();
  const [shows, setShows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    api.get("/movies/" + id).then((res) => setMovie(res.data));
    api.get("/shows", { params: { movieId: id } }).then((res) => {
      setShows(res.data);
      if (res.data.length) setSelectedDate(res.data[0].show_date);
    });
  }, [id]);

  const dates = useMemo(() => [...new Set(shows.map((s) => s.show_date))], [shows]);

  function findMe() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setLocationError("Location permission denied — enable it to sort cinemas by distance.")
    );
  }

  // Group the selected date's shows by theatre, then sort by real distance
  // from the viewer's actual location once granted (nearest first, like BMS
  // does for your selected area) - falls back to alphabetical until then.
  const theatreGroups = useMemo(() => {
    const forDate = shows.filter((s) => s.show_date === selectedDate);
    const groups = [];
    for (const show of forDate) {
      let group = groups.find((g) => g.theatre_name === show.theatre_name);
      if (!group) {
        group = {
          theatre_name: show.theatre_name,
          theatre_address: show.theatre_address,
          latitude: show.latitude,
          longitude: show.longitude,
          shows: [],
        };
        groups.push(group);
      }
      group.shows.push(show);
    }
    if (myLocation) {
      for (const g of groups) {
        g.distanceKm =
          g.latitude != null ? haversineKm(myLocation.lat, myLocation.lon, +g.latitude, +g.longitude) : null;
      }
      groups.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      groups.sort((a, b) => a.theatre_name.localeCompare(b.theatre_name));
    }
    return groups;
  }, [shows, selectedDate, myLocation]);

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

      <div className="cinemas-header">
        <h2>Cinemas</h2>
        {!myLocation && (
          <button className="ghost" onClick={findMe}>
            Sort by distance from me
          </button>
        )}
      </div>
      {locationError && <p className="error">{locationError}</p>}

      {theatreGroups.length === 0 && <p>No shows scheduled for this date.</p>}
      {theatreGroups.map((group) => (
        <div className="theatre-block card" key={group.theatre_name}>
          <div className="theatre-block-header">
            <div>
              <h3>{group.theatre_name}</h3>
              {group.theatre_address && <p className="theatre-address">{group.theatre_address}</p>}
            </div>
            {group.distanceKm != null && (
              <span className="distance-tag">{group.distanceKm.toFixed(1)} km away</span>
            )}
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
