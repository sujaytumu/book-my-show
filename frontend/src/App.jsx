import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import Nav from "./components/Nav";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
const Movie = lazy(() => import("./pages/Movie"));
const Show = lazy(() => import("./pages/Show"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Admin = lazy(() => import("./pages/Admin"));
//
const Profile = lazy(() => import("./pages/Profile"));
const Search = lazy(() => import("./pages/Search"));
const MovieList = lazy(() => import("./pages/MovieList"));
const City = lazy(() => import("./pages/City"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Offers = lazy(() => import("./pages/Offers"));
const Help = lazy(() => import("./pages/Help"));
const Cinemas = lazy(() => import("./pages/Cinemas"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Forgot = lazy(() => import("./pages/Forgot"));
import UpdateBanner from "./components/UpdateBanner";
import NativeBack from "./components/NativeBack";
import { IcTarget, IcHome, IcSearch, IcTicket, IcUser } from "./components/Icons";
import { seedHomeBelow } from "./nav";
import { alreadyAsked, detectCity, markAsked, setCity } from "./location";

const TAB_PAGES = ["/", "/search", "/bookings", "/profile"];


// Swipe left/right between the four main tabs (Home, Search, Bookings, Profile), like WhatsApp.
// Ignored when the gesture starts inside something that scrolls sideways (poster rows, carousel, chips) or a form field.
function useTabSwipe() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const id = setTimeout(() => delete document.documentElement.dataset.swipe, 450);
    return () => clearTimeout(id);
  }, [pathname]);
  useEffect(() => {
    const idx = TAB_PAGES.indexOf(pathname);
    if (idx < 0) return;
    let sx = 0, sy = 0, ok = false, t0 = 0;
    const blocked = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) return true;
        if (n.classList && (n.classList.contains("sheet-backdrop") || n.classList.contains("qty-overlay") || n.classList.contains("tabbar"))) return true;
        const cs = window.getComputedStyle(n);
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
      }
      return false;
    };
    const start = (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; t0 = Date.now();
      ok = e.touches.length === 1 && !blocked(e.target);
    };
    const end = (e) => {
      if (!ok) return;
      ok = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - t0 > 700) return;
      const next = idx + (dx < 0 ? 1 : -1);
      if (next < 0 || next >= TAB_PAGES.length) return;
      document.documentElement.dataset.swipe = dx < 0 ? "left" : "right";
      navigate(TAB_PAGES[next], { replace: true });
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, [pathname, navigate]);
}

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
  useTabSwipe();
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



  // First open: nothing but Login / Register until the user is signed in.
  const PUBLIC = ["/login", "/register", "/forgot"];
  const isPublic = PUBLIC.includes(pathname);
  const signedIn = !!localStorage.getItem("token");
  if (!signedIn && !isPublic) return <Navigate to="/login" replace />;

  return (
    <>
      <UpdateBanner />
      <NativeBack />
      <Nav />
      <main key={pathname} className="page-in">
        <Suspense fallback={<div className="route-fallback"><div className="sk sk-hero" /></div>}>
        <Routes>
          <Route path="/forgot" element={<Forgot />} />
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
          <Route path="/cinemas" element={<Cinemas />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        </Suspense>
      </main>
      <TabBar />
      {signedIn && askLoc && pathname === "/" && <LocationPrompt onDone={() => setAskLoc(false)} />}
    </>
  );
}
