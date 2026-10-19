// NATIVE_VERSION: bump this number ONLY when you change native stuff
// (new Capacitor plugin, AndroidManifest/permissions, icons, capacitor.config).
// Pure web/UI/API changes never need a bump: they reach the phone through the
// in-app "Update" popup without reinstalling the APK.
export const NATIVE_VERSION = 3;

// Stamped by the CI build (GitHub run number). "dev" when running locally.
export const BUILD_ID = String(import.meta.env.VITE_BUILD_ID || "dev");

// The release that CI keeps refreshing on every push.
export const RELEASE_API = "https://api.github.com/repos/sujaytumu/book-my-show/releases/tags/apk-latest";
