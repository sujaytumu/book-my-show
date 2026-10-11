import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api";
import Nav from "./components/Nav";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Movie from "./pages/Movie";
import Show from "./pages/Show";
import Bookings from "./pages/Bookings";
import Admin from "./pages/Admin";
//
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import City from "./pages/City";
import { IcHome, IcSearch, IcTicket, IcUser } from "./components/Icons";
import { alreadyAsked, detectCity, markAsked, setCity } from "./location";

const TAB_PAGES = ["/", "/coming-soon", "/search", "/bookings", "/profile"];

function TabBar() {
  const { pathname } = useLocation();
  if (!TAB_PAGES.includes(pathname)) return null;
  const tabs = [
    ["/", "Home", IcHome],
    ["/search", "Search", IcSearch],
    ["/bookings", "Bookings", IcTicket],
    ["/profile", "Profile", IcUser],
  ];
  return (
    <div className="tabbar">
      {tabs.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive || (to === "/" && pathname === "/coming-soon") ? "on" : "")}>
          <Icon width={26} height={26} />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

export default function App() {
  // The backend is on Render's free tier and spins down after ~15 min idle;
  // waking it back up takes 60-90s. Ping it in the background the instant the
  // app loads so it's likely already awake by the time someone submits a form.
  useEffect(() => {
    api.get("/health").catch(() => {});
  }, []);

  // First visit: ask for the real location (the browser shows its permission prompt) and pick the nearest city.
  useEffect(() => {
    if (alreadyAsked()) return;
    detectCity()
      .then(setCity)
      .catch(markAsked);
  }, []);

  return (
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home mode="now-showing" />} />
          <Route path="/coming-soon" element={<Home mode="coming-soon" />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/show/:id" element={<Show />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/search" element={<Search />} />
          <Route path="/city" element={<City />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
