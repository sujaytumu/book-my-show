import { useEffect, useState } from "react";
import { api, currentUser } from "../api";

const emptyMovie = {
  title: "",
  description: "",
  posterUrl: "",
  language: "",
  genre: "",
  durationMinutes: "",
  certificate: "",
  rating: "",
};
const emptyShow = { movieId: "", screenId: "", date: "", start: "", end: "", price: "" };
const emptyCity = { name: "" };
const emptyTheatre = { name: "", address: "", cityId: "", latitude: "", longitude: "" };
const emptyScreen = { name: "", totalSeats: "60", theatreId: "" };

export default function Admin() {
  const user = currentUser();
  const [movies, setMovies] = useState([]);
  const [screens, setScreens] = useState([]);
  const [cities, setCities] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [movieForm, setMovieForm] = useState(emptyMovie);
  const [showForm, setShowForm] = useState(emptyShow);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [theatreForm, setTheatreForm] = useState(emptyTheatre);
  const [screenForm, setScreenForm] = useState(emptyScreen);
  const [message, setMessage] = useState("");

  function loadLookups() {
    api.get("/movies").then((res) => setMovies(res.data));
    api.get("/admin/screens").then((res) => setScreens(res.data));
    api.get("/cities").then((res) => setCities(res.data));
    api.get("/admin/theatres").then((res) => setTheatres(res.data));
  }

  useEffect(loadLookups, []);

  if (!user || user.role !== "ADMIN") {
    return <p>You need an admin account to view this page.</p>;
  }

  const bind = (form, setForm) => (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function submitFactory(url, form, setForm, emptyForm, successMessage) {
    return async (e) => {
      e.preventDefault();
      setMessage("");
      try {
        await api.post(url, form);
        setMessage(successMessage);
        setForm(emptyForm);
        loadLookups();
      } catch (err) {
        setMessage(err.response?.data?.message || "Something went wrong");
      }
    };
  }

  const submitCity = submitFactory("/admin/cities", cityForm, setCityForm, emptyCity, "City added.");
  const submitTheatre = submitFactory("/admin/theatres", theatreForm, setTheatreForm, emptyTheatre, "Theatre added.");
  const submitScreen = submitFactory("/admin/screens", screenForm, setScreenForm, emptyScreen, "Screen added.");
  const submitMovie = submitFactory("/admin/movies", movieForm, setMovieForm, emptyMovie, "Movie added.");
  const submitShow = submitFactory("/admin/shows", showForm, setShowForm, emptyShow, "Show scheduled.");

  const updateCity = bind(cityForm, setCityForm);
  const updateTheatre = bind(theatreForm, setTheatreForm);
  const updateScreen = bind(screenForm, setScreenForm);
  const updateMovie = bind(movieForm, setMovieForm);
  const updateShow = bind(showForm, setShowForm);

  return (
    <div className="admin">
      <h1>Admin</h1>
      {message && <p className="notice">{message}</p>}

      <div className="card">
        <h2>Add a city</h2>
        <form onSubmit={submitCity}>
          <input placeholder="City name" required value={cityForm.name} onChange={updateCity("name")} />
          <button>Add city</button>
        </form>
      </div>

      <div className="card">
        <h2>Add a theatre</h2>
        <form onSubmit={submitTheatre}>
          <input placeholder="Theatre name" required value={theatreForm.name} onChange={updateTheatre("name")} />
          <input placeholder="Address" value={theatreForm.address} onChange={updateTheatre("address")} />
          <select required value={theatreForm.cityId} onChange={updateTheatre("cityId")}>
            <option value="">Select city</option>
            {cities.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Latitude (e.g. 17.4435)"
            type="number"
            step="0.000001"
            value={theatreForm.latitude}
            onChange={updateTheatre("latitude")}
          />
          <input
            placeholder="Longitude (e.g. 78.3772)"
            type="number"
            step="0.000001"
            value={theatreForm.longitude}
            onChange={updateTheatre("longitude")}
          />
          <p className="hint">
            Find coordinates by right-clicking the spot on{" "}
            <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">
              openstreetmap.org
            </a>{" "}
            and copying "Show address".
          </p>
          <button>Add theatre</button>
        </form>
      </div>

      <div className="card">
        <h2>Add a screen</h2>
        <form onSubmit={submitScreen}>
          <select required value={screenForm.theatreId} onChange={updateScreen("theatreId")}>
            <option value="">Select theatre</option>
            {theatres.map((t) => (
              <option value={t.id} key={t.id}>
                {t.city_name} — {t.name}
              </option>
            ))}
          </select>
          <input placeholder="Screen name (e.g. Screen 1)" required value={screenForm.name} onChange={updateScreen("name")} />
          <input
            placeholder="Total seats"
            type="number"
            required
            value={screenForm.totalSeats}
            onChange={updateScreen("totalSeats")}
          />
          <button>Add screen</button>
        </form>
      </div>

      <div className="card">
        <h2>Add a movie</h2>
        <form onSubmit={submitMovie}>
          <input placeholder="Title" required value={movieForm.title} onChange={updateMovie("title")} />
          <input placeholder="Description" value={movieForm.description} onChange={updateMovie("description")} />
          <input placeholder="Poster URL" value={movieForm.posterUrl} onChange={updateMovie("posterUrl")} />
          <input placeholder="Language" value={movieForm.language} onChange={updateMovie("language")} />
          <input placeholder="Genre" value={movieForm.genre} onChange={updateMovie("genre")} />
          <input
            placeholder="Duration (minutes)"
            type="number"
            value={movieForm.durationMinutes}
            onChange={updateMovie("durationMinutes")}
          />
          <input placeholder="Certificate (e.g. UA)" value={movieForm.certificate} onChange={updateMovie("certificate")} />
          <input placeholder="Rating (0-10)" type="number" step="0.1" value={movieForm.rating} onChange={updateMovie("rating")} />
          <button>Add movie</button>
        </form>
      </div>

      <div className="card">
        <h2>Schedule a show</h2>
        <form onSubmit={submitShow}>
          <select required value={showForm.movieId} onChange={updateShow("movieId")}>
            <option value="">Select movie</option>
            {movies.map((m) => (
              <option value={m.id} key={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <select required value={showForm.screenId} onChange={updateShow("screenId")}>
            <option value="">Select screen</option>
            {screens.map((s) => (
              <option value={s.id} key={s.id}>
                {s.theatre_name} — {s.name}
              </option>
            ))}
          </select>
          <input type="date" required value={showForm.date} onChange={updateShow("date")} />
          <input type="time" required placeholder="Start" value={showForm.start} onChange={updateShow("start")} />
          <input type="time" required placeholder="End" value={showForm.end} onChange={updateShow("end")} />
          <input placeholder="Price" type="number" required value={showForm.price} onChange={updateShow("price")} />
          <button>Schedule show</button>
        </form>
      </div>
    </div>
  );
}
