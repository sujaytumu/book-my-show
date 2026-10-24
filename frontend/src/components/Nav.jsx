// import { Link, useNavigate } from "react-router-dom";
// import { currentUser, logout } from "../api";

// export default function Nav() {
//   const navigate = useNavigate();
//   const user = currentUser();

//   function handleLogout() {
//     logout();
//     navigate("/");
//   }

//   return (
//     <nav>
//       <Link to="/" className="logo">
//         BookMyShow
//       </Link>
//       <div>
//         {user ? (
//           <>
//             <span>Hi {user.name}</span>
//             <Link to="/bookings">My Bookings</Link>
//             {user.role === "ADMIN" && <Link to="/admin">Admin</Link>}
//             <button className="ghost" onClick={handleLogout}>
//               Logout
//             </button>
//           </>
//         ) : (
//           <>
//             <Link to="/login">Login</Link>
//             <Link to="/register">Register</Link>
//           </>
//         )}
//       </div>
//     </nav>
//   );
// }


import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCity } from "../location";
import { IcUser } from "./Icons";
import { useNotifications } from "../notifications";
import { currentUser, logout } from "../api";

// "Sujay Tumu" -> "ST", "Sujay" -> "S"
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Nav({ path }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const pathname = path || loc.pathname;
  const [city, setCityState] = useState(getCity());
  const { unread } = useNotifications();
  useEffect(() => {
    const f = () => setCityState(getCity());
    window.addEventListener("bms-city", f);
    return () => window.removeEventListener("bms-city", f);
  }, []);
  const user = currentUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the profile menu on outside tap/click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/", { replace: true });
  }

  if (pathname === "/login" || pathname === "/register" || pathname === "/forgot" || pathname === "/search" || pathname === "/city" || pathname === "/notifications" || pathname === "/offers" || pathname === "/help" || pathname === "/wallet" || pathname === "/coming-soon" || pathname === "/now-showing" || pathname.startsWith("/movie/") || pathname.startsWith("/show/")) return null;
  const right = (
      <div className="nav-right">
        {user ? (
          <div className="nav-user" ref={menuRef}>
            <button
              type="button"
              className="nav-avatar"
              title={user.name}
              aria-label="Profile menu"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {initials(user.name)}
            </button>
            {open && (
              <div className="nav-menu" role="menu">
                <div className="nav-menu-name">{user.name}</div>
                <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
                  My Profile
                </Link>
                <Link to="/bookings" role="menuitem" onClick={() => setOpen(false)}>
                  My Bookings
                </Link>
                {user.role === "ADMIN" && (
                  <Link to="/admin" role="menuitem" onClick={() => setOpen(false)}>
                    Admin
                  </Link>
                )}
                <button type="button" role="menuitem" className="nav-menu-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          pathname === "/" ? (
            <Link to="/login" className="home-person" aria-label="Login">
              <IcUser width={26} height={26} />
            </Link>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )
        )}
      </div>
  );
  if (pathname === "/") {
    return (
      <header className="home-head">
        <div>
          <h1>It All Starts Here!</h1>
          <Link to="/city" className="home-city">
            {city} <span>›</span>
          </Link>
        </div>
        <div className="home-right">
          <Link to="/notifications" className="home-bell" aria-label="Notifications">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.700 20a2 2 0 0 1-3.400 0" />
            </svg>
            {unread > 0 && <i>{unread > 9 ? "9+" : unread}</i>}
          </Link>
          {right}
        </div>
      </header>
    );
  }
  return (
    <nav>
      <Link to="/" className="logo">
        BMS
      </Link>
      {right}
    </nav>
  );
}
