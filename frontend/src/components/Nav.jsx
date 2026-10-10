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
import { Link, useNavigate } from "react-router-dom";
import { currentUser, logout } from "../api";

// "Sujay Tumu" -> "ST", "Sujay" -> "S"
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Nav() {
  const navigate = useNavigate();
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
    navigate("/");
  }

  return (
    <nav>
      <Link to="/" className="logo">
        BMS
      </Link>
      <div>
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
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
