import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { NATIVE_VERSION, BUILD_ID, RELEASE_API } from "./appVersion";

async function findUpdate() {
  const res = await fetch(RELEASE_API, { cache: "no-store" });
  if (!res.ok) return null;
  const rel = await res.json();
  let meta = {};
  try { meta = JSON.parse(rel.body || "{}"); } catch { return null; }
  const asset = (name) => (rel.assets || []).find((a) => a.name === name)?.browser_download_url;
  if (Number(meta.native) > NATIVE_VERSION) {
    const url = asset("book-my-show.apk");
    return url ? { type: "apk", url, build: String(meta.build) } : null;
  }
  if (BUILD_ID !== "dev" && String(meta.build) !== BUILD_ID) {
    const url = asset("bundle.zip");
    return url ? { type: "web", url, build: String(meta.build) } : null;
  }
  return null;
}

export default function UpdatePrompt() {
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Tell the updater this bundle booted fine (otherwise it rolls back).
    CapacitorUpdater.notifyAppReady().catch(() => {});
    let dismissed = false;
    const check = () => {
      if (dismissed) return;
      findUpdate().then((u) => u && setUpdate(u)).catch(() => {});
    };
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => { dismissed = true; document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  if (!update) return null;

  async function apply() {
    setBusy(true);
    setError("");
    try {
      if (update.type === "apk") {
        await Browser.open({ url: update.url });
        setBusy(false);
        return;
      }
      const bundle = await CapacitorUpdater.download({ url: update.url, version: update.build });
      await CapacitorUpdater.set({ id: bundle.id }); // reloads the app on the new version
    } catch (e) {
      // Show the real reason (it is usually not the internet connection).
      const why = (e && (e.message || e.errorMessage || e.code)) || String(e);
      setError("Update failed: " + String(why).slice(0, 160));
      setFallback(true);
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", color: "#222", borderRadius: 14, padding: 22, maxWidth: 340, width: "100%", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,.35)" }}>
        <h3 style={{ margin: "0 0 8px", color: "#d2232a" }}>Update available</h3>
        <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.4 }}>
          {update.type === "apk"
            ? "A new app version is ready. Tap Update to download it, then open the file to install."
            : "A new version of Book My Show is ready. Tap Update and the app will refresh itself."}
        </p>
        {error && <p style={{ color: "#d2232a", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
        <button onClick={apply} disabled={busy} style={{ background: "#d2232a", color: "#fff", border: 0, borderRadius: 8, padding: "10px 22px", fontSize: 15, fontWeight: 600, width: "100%" }}>
          {busy ? "Updating…" : "Update"}
        </button>
        {fallback && (
          <button
            onClick={() => Browser.open({ url: "https://github.com/sujaytumu/book-my-show/releases/download/apk-latest/book-my-show.apk" })}
            style={{ background: "#fff", color: "#d2232a", border: "1.5px solid #d2232a", borderRadius: 8, padding: "9px 22px", fontSize: 14, fontWeight: 600, width: "100%", marginTop: 10 }}
          >
            Download the full app instead
          </button>
        )}
        <button onClick={() => setUpdate(null)} disabled={busy} style={{ background: "none", border: 0, color: "#666", marginTop: 10, fontSize: 13 }}>
          Later
        </button>
      </div>
    </div>
  );
}
