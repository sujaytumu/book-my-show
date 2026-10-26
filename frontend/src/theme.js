const KEY = "bms_theme";
export function getTheme() {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", t === "dark" ? "#121216" : "#d2232a");
}
export function setTheme(t) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  applyTheme(t);
}
