import { useEffect, useRef, useState } from "react";

// Pull down at the top of a page to refresh it (like the real app). Only vertical pulls that start at scrollTop 0
// count; sheets, inputs and sideways scrollers are ignored. Refresh clears the cached lists and reloads.
export default function PullRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const st = useRef({ y: 0, x: 0, on: false, d: 0 });
  useEffect(() => {
    const blocked = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) return true;
        if (n.classList && (n.classList.contains("sheet-backdrop") || n.classList.contains("qty-overlay") || n.classList.contains("seat-map"))) return true;
        const cs = window.getComputedStyle(n);
        if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 2 && n.scrollTop > 0) return true;
      }
      return false;
    };
    const start = (e) => {
      const t = e.touches[0];
      st.current = { y: t.clientY, x: t.clientX, on: e.touches.length === 1 && window.scrollY <= 0 && !blocked(e.target), d: 0 };
    };
    const move = (e) => {
      const s = st.current;
      if (!s.on) return;
      const t = e.touches[0];
      const dy = t.clientY - s.y;
      const dx = Math.abs(t.clientX - s.x);
      if (dy <= 0 || dx > dy * 0.7 || window.scrollY > 0) {
        if (dy <= 0 || window.scrollY > 0) {
          s.on = false;
          setPull(0);
        }
        return;
      }
      s.d = Math.min(dy * 0.5, 90);
      setPull(s.d);
    };
    const end = () => {
      const s = st.current;
      if (!s.on) return;
      s.on = false;
      if (s.d >= 60) {
        setBusy(true);
        setPull(54);
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("bms_swr_"))
            .forEach((k) => localStorage.removeItem(k));
        } catch {}
        setTimeout(() => window.location.reload(), 350);
      } else setPull(0);
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, []);
  if (pull <= 0 && !busy) return null;
  return (
    <div className="ptr" style={{ transform: "translate(-50%," + (pull - 44) + "px)", opacity: Math.min(1, pull / 50) }}>
      <span className={busy || pull >= 60 ? "spin" : ""} style={busy ? undefined : { transform: "rotate(" + pull * 4 + "deg)" }}>↻</span>
    </div>
  );
}
