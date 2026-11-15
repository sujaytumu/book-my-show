import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getTheme, setTheme } from "../theme";
import { navHidden } from "./Nav";

// Small floating light/dark switch that is on every page, so the mode can be changed without opening Profile.
export default function ThemeToggle({ inline = false }) {
  const [dark, setDark] = useState(getTheme() === "dark");
  const { pathname } = useLocation();
  useEffect(() => {
    const sync = () => setDark(getTheme() === "dark");
    window.addEventListener("storage", sync);
    window.addEventListener("bms-theme", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("bms-theme", sync);
    };
  }, []);
  function flip() {
    const n = !dark;
    setDark(n);
    setTheme(n ? "dark" : "light");
    window.dispatchEvent(new Event("bms-theme"));
  }
  // The floating copy only shows on pages that have no top header of their own (the header one is inline).
  if (!inline && !navHidden(pathname)) return null;
  return (
    <button
      type="button"
      className={inline ? "theme-btn" : "theme-fab"}
      onClick={flip}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
