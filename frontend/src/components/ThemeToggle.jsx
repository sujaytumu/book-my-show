import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getTheme, setTheme } from "../theme";

// Small floating light/dark switch that is on every page, so the mode can be changed without opening Profile.
export default function ThemeToggle() {
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
  return (
    <button
      type="button"
      className={"theme-fab" + (pathname.startsWith("/show/") ? " high" : "")}
      onClick={flip}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
