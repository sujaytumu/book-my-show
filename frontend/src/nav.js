// Back handling: one step back inside the app, never straight out of it.
// react-router keeps the position in history.state.idx (0 = first entry of this session).
export function goBack(navigate) {
  const idx = window.history.state && typeof window.history.state.idx === "number" ? window.history.state.idx : 0;
  if (idx > 0) navigate(-1);
  else navigate("/", { replace: true });
}

// If the app was opened straight on an inner page (home-screen shortcut, shared link, refresh), the browser/phone
// back button would leave the app. On the first tap we put Home underneath the current page so back goes Home first.
// It is done on a real tap because browsers ignore history entries created without user interaction.
export function seedHomeBelow(navigate, pathname, search) {
  const idx = window.history.state && typeof window.history.state.idx === "number" ? window.history.state.idx : 0;
  if (idx !== 0 || pathname === "/" || ["/login", "/register", "/forgot"].includes(pathname)) return;
  navigate("/", { replace: true });
  navigate(pathname + (search || ""));
}

// After something final (e.g. a paid booking): show `path`, and make back go Home instead of into the finished flow.
export function finishTo(navigate, path) {
  navigate("/", { replace: true });
  navigate(path);
}

// The four main tabs in the order they were used (most recent last). Back goes to the tab used before this one,
// not always Home, and only leaves the app once only Home is left.
const stack = [];
export const tabStack = {
  visit(path) {
    const i = stack.indexOf(path);
    if (i >= 0) stack.splice(i, 1);
    stack.push(path);
  },
  previous(current) {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i] !== current) return stack[i];
    return null;
  },
  drop(path) {
    const i = stack.indexOf(path);
    if (i >= 0) stack.splice(i, 1);
  },
};
