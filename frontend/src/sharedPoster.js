// Poster -> movie page "flight": the tapped poster lifts off the grid as a fixed copy, the movie page loads
// underneath, and the copy glides into the page's hero picture. All best-effort: any problem just means the
// normal page change happens.
let ghost = null;
let ghostId = null;
let timer = 0;

function drop() {
  clearTimeout(timer);
  if (ghost) ghost.remove();
  ghost = null;
  ghostId = null;
}

export function liftPoster(img, movieId) {
  try {
    if (!img || !img.src) return;
    const r = img.getBoundingClientRect();
    if (r.width < 24 || r.bottom < 0 || r.top > window.innerHeight) return;
    drop();
    const g = document.createElement("img");
    g.src = img.currentSrc || img.src;
    g.alt = "";
    const radius = getComputedStyle(img.parentElement || img).borderRadius || "8px";
    Object.assign(g.style, {
      position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px",
      objectFit: "cover", borderRadius: radius, zIndex: "60", pointerEvents: "none", margin: "0",
      boxShadow: "0 10px 30px rgba(0,0,0,.35)",
    });
    document.body.appendChild(g);
    ghost = g;
    ghostId = String(movieId);
    document.documentElement.dataset.swipe = "none"; // no side-slide: the poster flight is the transition
    timer = setTimeout(drop, 3000);
  } catch (e) { /* transition is optional */ }
}

export function landPoster(movieId, target) {
  try {
    if (!ghost || !target || ghostId !== String(movieId)) return;
    const box = target.parentElement || target;
    const r = box.getBoundingClientRect();
    if (r.width < 24) return;
    const g = ghost;
    ghost = null;
    ghostId = null;
    clearTimeout(timer);
    target.style.visibility = "hidden";
    const s = g.getBoundingClientRect();
    const done = () => { target.style.visibility = ""; g.remove(); };
    if (!g.animate) return done();
    const a = g.animate(
      [
        { left: s.left + "px", top: s.top + "px", width: s.width + "px", height: s.height + "px", objectPosition: "50% 50%" },
        { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: "16px", objectPosition: "50% 22%" },
      ],
      { duration: 400, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
    );
    a.onfinish = done;
    a.oncancel = done;
    setTimeout(done, 900);
  } catch (e) {
    if (target) target.style.visibility = "";
  }
}

// One delegated listener: any link to /movie/:id that contains a poster flies it.
export function installPosterFlight() {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey) return;
    const a = e.target.closest && e.target.closest('a[href^="/movie/"]');
    if (!a) return;
    const m = a.getAttribute("href").match(/^\/movie\/(\d+)/);
    if (!m) return;
    const img = a.querySelector("img.hc-poster") || a.querySelector("img");
    liftPoster(img, m[1]);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
