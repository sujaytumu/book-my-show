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


// Swipe left/right between the four main tabs (Home, Search, Bookings, Profile), like WhatsApp:
// the page follows the finger while you drag, the tab-bar pill glides along with it, and on release the page either
// slides on to the next tab or springs back. Ignored when the gesture starts inside something that scrolls sideways
// (poster rows, carousel, chips) or a form field. Styles are written straight to the DOM (no re-render per touch move).
const SWIPE_COMMIT = 0.28; // fraction of the screen width that commits a swipe
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
    const main = document.querySelector("main");
    const bar = document.querySelector(".tabbar");
    if (!main) return;
    let sx = 0, sy = 0, t0 = 0, mode = 0; // 0 idle, 1 undecided, 2 dragging, -1 not ours
    let timer = 0;
    const blocked = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) return true;
        if (n.classList && (n.classList.contains("sheet-backdrop") || n.classList.contains("qty-overlay") || n.classList.contains("tabbar"))) return true;
        const cs = window.getComputedStyle(n);
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
      }
      return false;
    };
    const nextOf = (dx) => idx + (dx < 0 ? 1 : -1);
    const valid = (dx) => nextOf(dx) >= 0 && nextOf(dx) < TAB_PAGES.length;
    const reset = () => {
      main.style.transition = "";
      main.style.transform = "";
      main.style.opacity = "";
      main.style.willChange = "";
      if (bar) {
        bar.classList.remove("dragging");
        bar.style.setProperty("--i", idx);
      }
    };
    const start = (e) => {
      if (timer) return;
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; t0 = Date.now();
      mode = e.touches.length === 1 && !blocked(e.target) ? 1 : -1;
    };
    const move = (e) => {
      if (mode < 1) return;
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (mode === 1) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx) * 0.8) { mode = -1; return; } // a vertical scroll: leave it alone
        mode = 2;
        main.style.transition = "none";
        main.style.willChange = "transform, opacity";
        if (bar) bar.classList.add("dragging");
      }
      const w = window.innerWidth || 360;
      const eff = valid(dx) ? dx : dx * 0.22; // rubber-band at the first / last tab
      main.style.transform = "translate3d(" + eff + "px,0,0)";
      main.style.opacity = String(1 - Math.min(Math.abs(eff) / w, 1) * 0.5);
      if (bar && valid(dx)) {
        const prog = Math.min(Math.abs(dx) / (w * 0.4), 1);
        bar.style.setProperty("--i", idx + (dx < 0 ? 1 : -1) * prog);
      }
    };
    const end = (e) => {
      const was = mode;
      mode = 0;
      if (was !== 2) return;
      const t = (e.changedTouches && e.changedTouches[0]) || { clientX: sx };
      const dx = t.clientX - sx;
      const w = window.innerWidth || 360;
      const v = Math.abs(dx) / Math.max(Date.now() - t0, 1); // px per ms
      const commit = e.type !== "touchcancel" && valid(dx) && (Math.abs(dx) > w * SWIPE_COMMIT || (v > 0.5 && Math.abs(dx) > 40));
      if (bar) bar.classList.remove("dragging");
      if (commit) {
        const next = nextOf(dx);
        main.style.transition = "transform .14s ease-in, opacity .14s ease-in";
        main.style.transform = "translate3d(" + (dx < 0 ? -w : w) + "px,0,0)";
        main.style.opacity = "0.15";
        if (bar) bar.style.setProperty("--i", next);
        timer = setTimeout(() => {
          timer = 0;
          document.documentElement.dataset.swipe = dx < 0 ? "left" : "right";
          navigate(TAB_PAGES[next], { replace: true });
        }, 140);
      } else {
        main.style.transition = "transform .22s cubic-bezier(.2,.8,.3,1), opacity .22s ease";
        main.style.transform = "translate3d(0,0,0)";
        main.style.opacity = "1";
        if (bar) bar.style.setProperty("--i", idx);
        timer = setTimeout(() => { timer = 0; reset(); }, 230);
      }
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
      if (timer) clearTimeout(timer);
      timer = 0;
    };
  }, [pathname, navigate]);
}

const TABS = [
  ["/", "Home", IcHome],
  ["/search", "Search", IcSearch],
  ["/bookings", "Bookings", IcTicket],
  ["/profile", "Profile", IcUser],
];

// Bottom tab bar. All four labels are always drawn; the highlight is a single pill that slides to the current tab
// (--i = its position, also driven live by the swipe gesture above).
function TabBar() {
  const { pathname } = useLocation();
  const idx = TAB_PAGES.indexOf(pathname);
  if (idx < 0) return null;
  return (
    <div className="tabbar" role="navigation" aria-label="Main" style={{ "--i": idx }}>
      <span className="tab-pill" aria-hidden="true" />
      {TABS.map(([to, label, Icon], i) => (
        <NavLink
          key={to}
          to={to}
          end
          className={i === idx ? "on" : ""}
          onClick={() => { document.documentElement.dataset.swipe = i > idx ? "left" : "right"; }}
        >
          <Icon width={26} height={26} />
          <span className="tab-label">{label}</span>
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
