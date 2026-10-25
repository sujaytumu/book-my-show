import { installPosterFlight } from "./sharedPoster";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { seedHomeBelow, tabStack } from "./nav";
import { alreadyAsked, detectCity, markAsked, setCity } from "./location";

const TAB_PAGES = ["/", "/search", "/bookings", "/profile"];


// ---------------------------------------------------------------------------------------------------------------
// Tab pager (Home / Search / Bookings / Profile), like WhatsApp: while you drag, the neighbouring tab is really
// rendered beside the current one, so you see it arrive under your finger. On release it flings on (speed counts, not
// just distance) or springs back. All per-frame styling is written straight to the DOM; React only mounts/unmounts
// the neighbour. A sideways-scrolling row (posters, carousel, chips) keeps its own scrolling until it reaches its end,
// and only then hands the gesture to the pager.
// ---------------------------------------------------------------------------------------------------------------
const SWIPE_COMMIT = 0.22; // fraction of the screen width that commits a swipe
const EASE = "cubic-bezier(.22,.9,.3,1)";
const pager = { dx: 0, dir: 0, pending: null, origScrollTo: null, watchdog: 0 };

// A page that mounts to be peeked at must not yank the window to the top (Home does that on mount).
function holdScroll(on) {
  if (on && !pager.origScrollTo) {
    pager.origScrollTo = window.scrollTo;
    window.scrollTo = () => {};
  } else if (!on && pager.origScrollTo) {
    window.scrollTo = pager.origScrollTo;
    pager.origScrollTo = null;
  }
}
function layers() {
  return {
    cur: document.querySelector(".pager-cur"),
    peek: document.querySelector(".pager-peek"),
    bar: document.querySelector(".tabbar"),
  };
}
// dx = finger offset; the current page follows it and the neighbour sits right behind it, edge to edge.
function place(dx, ms) {
  const w = window.innerWidth || 360;
  const { cur, peek } = layers();
  const t = ms ? "transform " + ms + "ms " + EASE : "none";
  if (cur) {
    cur.style.transition = t;
    cur.style.transform = "translate3d(" + dx + "px,0,0)";
  }
  if (peek) {
    peek.style.transition = t;
    peek.style.transform = "translate3d(" + (dx < 0 ? w + dx : dx - w) + "px,0,0)";
  }
}
function clearLayers() {
  const { cur, peek, bar } = layers();
  if (cur) {
    cur.style.transition = "";
    cur.style.transform = "";
    cur.style.willChange = "";
  }
  if (peek) peek.style.transform = "";
  if (bar) bar.classList.remove("dragging");
  pager.dx = 0;
  pager.dir = 0;
}
function tick() {
  try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) { /* no haptics */ }
}

function PeekLayer({ path }) {
  // Position it the moment it mounts, so it never flashes at the wrong spot.
  useLayoutEffect(() => { place(pager.dx); }, [path]);
  return (
    <div className="pager-peek" aria-hidden="true">
      <Nav path={path} />
      <main>
        <Suspense fallback={<div className="route-fallback"><div className="sk sk-hero" /></div>}>
          <AppRoutes location={path} />
        </Suspense>
      </main>
    </div>
  );
}

function useTabPager(peek, setPeek) {
  const navigate = useNavigate();
  const navRef = useRef(navigate); // listeners must survive re-renders mid-drag, whatever navigate's identity does
  navRef.current = navigate;
  const { pathname } = useLocation();

  // A committed swipe is finished here, in the same commit that renders the new route: the neighbour stays on screen
  // until the real page is in the DOM, then the layers reset before the browser paints (no flash, no jump).
  useLayoutEffect(() => {
    if (pager.pending && pager.pending === pathname) {
      pager.pending = null;
      clearTimeout(pager.watchdog);
      holdScroll(false);
      window.scrollTo(0, 0);
      clearLayers();
      setPeek(null);
    }
  }, [pathname, setPeek]);

  // Warm the other tabs' code so a neighbour never has to show a loading skeleton while you drag.
  useEffect(() => {
    if (!TAB_PAGES.includes(pathname)) return;
    const warm = () => { import("./pages/Search"); import("./pages/Bookings"); import("./pages/Profile"); };
    const id = window.requestIdleCallback ? window.requestIdleCallback(warm, { timeout: 2500 }) : setTimeout(warm, 1200);
    return () => (window.cancelIdleCallback && window.requestIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [pathname]);

  useEffect(() => installPosterFlight(), []);

  // The page we landed on slides in from the side we came from (taps and back); a swipe sets "none".
  useEffect(() => {
    const id = setTimeout(() => delete document.documentElement.dataset.swipe, 450);
    return () => clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    const idx = TAB_PAGES.indexOf(pathname);
    if (idx < 0) return;
    let sx = 0, sy = 0, t0 = 0, mode = 0; // 0 idle, 1 undecided, 2 dragging, -1 not ours
    let scroller = null;
    let timer = 0;
    const HARD = (n) =>
      /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) ||
      (n.classList && (n.classList.contains("sheet-backdrop") || n.classList.contains("qty-overlay") || n.classList.contains("tabbar") || n.classList.contains("pager-peek")));
    // Returns false when the gesture can never be ours; otherwise the nearest sideways scroller (or null).
    const inspect = (el) => {
      let found = null;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (HARD(n)) return false;
        if (!found) {
          const cs = window.getComputedStyle(n);
          if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 2) found = n;
        }
      }
      return found || null;
    };
    const canHandOver = (dx) => {
      if (!scroller) return true;
      const atStart = scroller.scrollLeft <= 1;
      const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
      return dx < 0 ? atEnd : atStart; // the row is used up in that direction -> the pager takes over
    };
    const start = (e) => {
      if (timer) return;
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; t0 = Date.now();
      const r = e.touches.length === 1 ? inspect(e.target) : false;
      scroller = r || null;
      mode = r === false ? -1 : 1;
    };
    const move = (e) => {
      if (mode < 1) return;
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      const w = window.innerWidth || 360;
      if (mode === 1) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx) * 0.8 || !canHandOver(dx)) { mode = -1; return; }
        mode = 2;
        const { cur, bar } = layers();
        if (cur) cur.style.willChange = "transform";
        if (bar) bar.classList.add("dragging");
      }
      const dir = dx < 0 ? 1 : -1;
      const target = TAB_PAGES[idx + dir];
      if (dir !== pager.dir) { // first move, or the finger changed direction: mount the right neighbour
        pager.dir = dir;
        holdScroll(!!target);
        setPeek(target || null);
      }
      pager.dx = target ? dx : dx * 0.22; // rubber-band at the first / last tab
      place(pager.dx);
      const { bar } = layers();
      if (bar) bar.style.setProperty("--i", target ? idx + dir * Math.min(Math.abs(dx) / (w * 0.5), 1) : idx);
    };
    const end = (e) => {
      const was = mode;
      mode = 0;
      if (was !== 2) return;
      const w = window.innerWidth || 360;
      const x = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : sx + pager.dx);
      const dx = x - sx;
      const dir = dx < 0 ? 1 : -1;
      const target = TAB_PAGES[idx + dir];
      const v = Math.abs(dx) / Math.max(Date.now() - t0, 1); // px per ms
      const commit = e.type !== "touchcancel" && !!target && (Math.abs(dx) > w * SWIPE_COMMIT || (v > 0.45 && Math.abs(dx) > 28));
      const { bar } = layers();
      if (bar) bar.classList.remove("dragging");
      if (commit) {
        const ms = Math.round(Math.min(260, Math.max(130, (w - Math.abs(dx)) / Math.max(v, 0.9))));
        place(-dir * w, ms);
        const { peek: pe } = layers();
        if (pe) { pe.style.transition = "transform " + ms + "ms " + EASE; pe.style.transform = "translate3d(0,0,0)"; }
        if (bar) bar.style.setProperty("--i", idx + dir);
        pager.pending = target;
        document.documentElement.dataset.swipe = "none";
        timer = setTimeout(() => {
          timer = 0;
          tick();
          navRef.current(target, { replace: true });
          // If the route never renders (it should), don't leave the layers stuck.
          pager.watchdog = setTimeout(() => {
            if (pager.pending) { pager.pending = null; holdScroll(false); clearLayers(); setPeek(null); }
          }, 1500);
        }, ms + 12);
      } else {
        const ms = 240;
        place(0, ms);
        const { peek: pe } = layers();
        if (pe) { pe.style.transition = "transform " + ms + "ms " + EASE; pe.style.transform = "translate3d(" + (dir > 0 ? w : -w) + "px,0,0)"; }
        if (bar) bar.style.setProperty("--i", idx);
        timer = setTimeout(() => { timer = 0; holdScroll(false); clearLayers(); setPeek(null); }, ms + 20);
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
    };
  }, [pathname, setPeek]);
}

const TABS = [
  ["/", "Home", IcHome],
  ["/search", "Search", IcSearch],
  ["/bookings", "Bookings", IcTicket],
  ["/profile", "Profile", IcUser],
];

// Bottom tab bar. All four labels are always drawn; the highlight is a single pill that slides to the current tab
// (--i = its position, also driven live by the pager above).
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

// Every route in one place so the pager can render a neighbouring tab (location) beside the current one.
function AppRoutes({ location }) {
  return (
    <Routes location={location}>
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
  const [peek, setPeek] = useState(null);
  useTabPager(peek, setPeek);
  // Remember the order tabs were used in, so Back goes to the previously used tab (see NativeBack).
  useEffect(() => {
    if (TAB_PAGES.includes(pathname)) tabStack.visit(pathname);
  }, [pathname]);
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
      <div className="pager-cur">
        <Nav />
        <main key={pathname} className="page-in">
          <Suspense fallback={<div className="route-fallback"><div className="sk sk-hero" /></div>}>
            <AppRoutes />
          </Suspense>
        </main>
      </div>
      {peek && <PeekLayer path={peek} />}
      <TabBar />
      {signedIn && askLoc && pathname === "/" && <LocationPrompt onDone={() => setAskLoc(false)} />}
    </>
  );
}
