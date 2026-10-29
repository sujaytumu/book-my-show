// A short burst of confetti when a booking has just been paid for. The booking screen shows it once on arrival.
const FLAG = "bms_celebrate";

export function markCelebrate() {
  try { sessionStorage.setItem(FLAG, String(Date.now())); } catch (e) { /* storage unavailable */ }
}

export function takeCelebrate() {
  try {
    const t = Number(sessionStorage.getItem(FLAG) || 0);
    sessionStorage.removeItem(FLAG);
    return t > 0 && Date.now() - t < 60000;
  } catch (e) {
    return false;
  }
}

export function confetti(ms = 2400) {
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    Object.assign(c.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "300" });
    document.body.appendChild(c);
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const colors = ["#d2232a", "#f59e0b", "#22a35a", "#2563eb", "#e11d8c", "#ffffff"];
    const bits = Array.from({ length: 110 }, () => {
      const side = Math.random() < 0.5 ? 0 : 1;
      const a = (side ? Math.PI - 0.6 : 0.6) + (Math.random() - 0.5) * 0.9; // two cannons from the lower corners
      const v = 9 + Math.random() * 9;
      return {
        x: side ? W + 4 : -4, y: H * 0.78,
        vx: Math.cos(a) * v * (side ? 1 : 1) * (side ? 1 : 1), vy: -Math.sin(a) * v,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        col: colors[(Math.random() * colors.length) | 0],
      };
    });
    const t0 = performance.now();
    const tick = (now) => {
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += 0.34; b.vx *= 0.992; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, (ms - t) / 600));
        g.translate(b.x, b.y); g.rotate(b.r);
        g.fillStyle = b.col; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        g.restore();
      }
      if (t < ms) requestAnimationFrame(tick); else c.remove();
    };
    requestAnimationFrame(tick);
    setTimeout(() => c.remove(), ms + 400);
  } catch (e) { /* purely decorative */ }
}
