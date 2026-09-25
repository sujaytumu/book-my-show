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

export default function Admin() {
  const user = currentUser();
  const [movies, setMovies] = useState([]);
  const [screens, setScreens] = useState([]);
  const [movieForm, setMovieForm] = useState(emptyMovie);
  const [showForm, setShowForm] = useState(emptyShow);
  const [message, setMessage] = useState("");

  function loadLookups() {
    api.get("/movies").then((res) => setMovies(res.data));
    api.get("/admin/screens").then((res) => setScreens(res.data));
  }

  useEffect(loadLookups, []);

  if (!user || user.role !== "ADMIN") {
    return <p>You need an admin account to view this page.</p>;
  }

  function updateMovie(field) {
    return (e) => setMovieForm({ ...movieForm, [field]: e.target.value });
  }
  function updateShow(field) {
    return (e) => setShowForm({ ...showForm, [field]: e.target.value });
  }

  async function submitMovie(e) {
    e.preventDefault();
    setMessage("");
    try {
      await api.post("/admin/movies", movieForm);
      setMessage("Movie added.");
      setMovieForm(emptyMovie);
      loadLookups();
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not add movie");
    }
  }

  async function submitShow(e) {
    e.preventDefault();
    setMessage("");
    try {
      await api.post("/admin/shows", showForm);
      setMessage("Show scheduled.");
      setShowForm(emptyShow);
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not schedule show");
    }
  }

  return (
    <div className="admin">
      <h1>Admin</h1>
      {message && <p className="notice">{message}</p>}

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
