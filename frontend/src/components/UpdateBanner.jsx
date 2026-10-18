import { useEffect, useState } from "react";

// Tells the user when a newer version of the app has been deployed, and reloads into it on tap.
// Works in the browser, the installed app and APK wrappers that load the live site.
export default function UpdateBanner() {
  const [newer, setNewer] = useState(false);

  useEffect(() => {
    if (typeof __BUILD_ID__ === "undefined") return undefined;
    let stop = false;
    async function check() {
      try {
        const res = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!stop && data && data.id && data.id !== __BUILD_ID__) setNewer(true);
      } catch (e) {
        /* offline - try again later */
      }
    }
    check();
    const timer = setInterval(check, 3 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  async function update() {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {
      /* ignore */
    }
    window.location.reload();
  }

  if (!newer) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version of the app is available</span>
      <button type="button" onClick={update}>Update</button>
    </div>
  );
}
