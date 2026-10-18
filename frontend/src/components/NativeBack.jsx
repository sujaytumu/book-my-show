import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Phone back button. The Android shell (MainActivity) intercepts the back press and asks the page what to do by
// calling window.__bmsBack(): returning true means "handled here" (we moved one screen back, or went Home);
// returning false means "nothing left, leave the app" (only on Home or the Login screen).
export default function NativeBack() {
  const navigate = useNavigate();
  useEffect(() => {
    window.__bmsBack = () => {
      const st = window.history.state;
      const idx = st && typeof st.idx === "number" ? st.idx : 0;
      const path = window.location.pathname;
      if (idx > 0) {
        navigate(-1);
        return true;
      }
      if (path === "/forgot") {
        navigate("/login", { replace: true });
        return true;
      }
      if (path !== "/" && path !== "/login" && path !== "/register") {
        navigate("/", { replace: true });
        return true;
      }
      return false;
    };
    return () => {
      delete window.__bmsBack;
    };
  }, [navigate]);
  return null;
}
