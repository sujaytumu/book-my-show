import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { api } from "./api";
import Nav from "./components/Nav";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Movie from "./pages/Movie";
import Show from "./pages/Show";
import Bookings from "./pages/Bookings";
import Admin from "./pages/Admin";

export default function App() {
  // The backend is on Render's free tier and spins down after ~15 min idle;
  // waking it back up takes 60-90s. Ping it in the background the instant the
  // app loads so it's likely already awake by the time someone submits a form.
  useEffect(() => {
    api.get("/health").catch(() => {});
  }, []);

  return (
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/show/:id" element={<Show />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <footer>Spring Boot · React · PostgreSQL · Razorpay</footer>
    </>
  );
}
