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

  function handleLogout() {
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
          <>
            <Link to="/profile" className="nav-avatar" title={"My Profile · " + user.name} aria-label="My Profile">
              {initials(user.name)}
            </Link>
            <Link to="/bookings">My Bookings</Link>
            {user.role === "ADMIN" && <Link to="/admin">Admin</Link>}
            <button className="ghost" onClick={handleLogout}>
              Logout
            </button>
          </>
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