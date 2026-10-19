import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import UpdatePrompt from "./UpdatePrompt";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ErrorBoundary>
      <App />
      <UpdatePrompt />
    </ErrorBoundary>
  </BrowserRouter>
);

// Tiny haptic tick on taps (Android WebView / Chrome). Silent no-op elsewhere.
document.addEventListener(
  "click",
  (e) => {
    const el = e.target && e.target.closest ? e.target.closest("button, a, .seat, .poster-card, .ml-card") : null;
    if (el && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch (err) {
        /* ignore */
      }
    }
  },
  { passive: true }
);
