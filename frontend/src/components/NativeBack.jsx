import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Phone back button inside the installed Android app: one step back through the screens you came from,
// Home if there is nothing behind the current screen, and only on Home (or Login) does it leave the app.
// Uses the Capacitor runtime's built-in App plugin through window.Capacitor, so no extra package is needed.
export default function NativeBack() {
  const navigate = useNavigate();
  useEffect(() => {
    const cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return undefined;
    const app = cap.Plugins && cap.Plugins.App;
    if (!app || !app.addListener) return undefined;
    let handle = null;
    let gone = false;
    Promise.resolve(
      app.addListener("backButton", () => {
        const st = window.history.state;
        const idx = st && typeof st.idx === "number" ? st.idx : 0;
        const path = window.location.pathname;
        const atRoot = path === "/" || path === "/login" || path === "/register";
        if (idx > 0) navigate(-1);
        else if (!atRoot && path !== "/forgot") navigate("/", { replace: true });
        else if (path === "/forgot") navigate("/login", { replace: true });
        else if (app.exitApp) app.exitApp();
      })
    ).then((h) => {
      handle = h;
      if (gone && h && h.remove) h.remove();
    });
    return () => {
      gone = true;
      if (handle && handle.remove) handle.remove();
    };
  }, [navigate]);
  return null;
}
