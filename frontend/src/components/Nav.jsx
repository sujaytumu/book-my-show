import { Link, useNavigate } from "react-router-dom";
import { currentUser, logout } from "../api";

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
        BookMyShow
      </Link>
      <div>
        {user ? (
          <>
            <span>Hi {user.name}</span>
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
