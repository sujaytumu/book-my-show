import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
import MovieList from "./pages/MovieList";
import City from "./pages/City";
import Notifications from "./pages/Notifications";
import Offers from "./pages/Offers";
import Help from "./pages/Help";
import Wallet from "./pages/Wallet";
import { IcTarget, IcHome, IcSearch, IcTicket, IcUser } from "./components/Icons";
import { seedHomeBelow } from "./nav";
import { alreadyAsked, detectCity, markAsked, setCity } from "./location";

const TAB_PAGES = ["/", "/search", "/bookings", "/profile"];

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
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "on" : "")}>
          <Icon width={26} height={26} />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

function LocationPrompt({ onDone }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function allow() {
    setBusy(true);
    try {
      setCity(await detectCity());
      onDone();
    } catch (e) {
      setMsg(e.message);
      markAsked();
      setBusy(false);
    }
  }
  function manual() {
    markAsked();
    onDone();
    navigate("/city");
  }
  return (
    <div className="loc-overlay">
      <div className="loc-sheet">
        <i className="grab" />
        <span className="loc-ic">
          <IcTarget width={34} height={34} />
        </span>
        <h2>Allow location access</h2>
        <p>We use your location to show movies and cinemas in your city.</p>
        {msg && <p className="cp-msg">{msg}</p>}
        <button type="button" className="loc-allow" onClick={allow} disabled={busy}>
          {busy ? "Detecting…" : "Allow location"}
        </button>
        <button type="button" className="loc-manual" onClick={manual}>
          Select city manually
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const [askLoc, setAskLoc] = useState(() => !alreadyAsked());
  // The backend is on Render's free tier and spins down after ~15 min idle;
  // waking it back up takes 60-90s. Ping it in the background the instant the
  // app loads so it's likely already awake by the time someone submits a form.
  useEffect(() => {
    api.get("/health").catch(() => {});
  }, []);
  const navigate = useNavigate();
  const here = useLocation();
  useEffect(() => {
    // First tap in the session: make sure back goes Home before leaving the app.
    const once = () => {
      window.removeEventListener("pointerdown", once, true);
      seedHomeBelow(navigate, here.pathname, here.search);
    };
    window.addEventListener("pointerdown", once, true);
    return () => window.removeEventListener("pointerdown", once, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  return (
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home mode="now-showing" />} />
          <Route path="/coming-soon" element={<MovieList upcoming />} />
          <Route path="/now-showing" element={<MovieList />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/movie/:id" element={<Movie />} />
          <Route path="/show/:id" element={<Show />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/search" element={<Search />} />
          <Route path="/city" element={<City />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/help" element={<Help />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <TabBar />
      {askLoc && pathname === "/" && <LocationPrompt onDone={() => setAskLoc(false)} />}
    </>
  );
}
