import { api } from "./api";

// Stale-while-revalidate for catalogue data: show the last saved copy instantly, then refresh it quietly.
const PREFIX = "bms_swr_";

export function swrGet(path, onData) {
  let had = false;
  try {
    const raw = localStorage.getItem(PREFIX + path);
    if (raw) {
      onData(JSON.parse(raw));
      had = true;
    }
  } catch (e) {
    /* storage unavailable */
  }
  // First ever open (nothing saved yet) while the server may be asleep: show the movie list that was bundled with the app
  // at build time right away; the live list replaces it as soon as the server answers.
  let live = false;
  if (!had && path === "/movies") {
    fetch("/movies-snapshot.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live && Array.isArray(d) && d.length) onData(d);
      })
      .catch(() => {});
  }
  // The first /movies request was already started by index.html before the app code loaded; use it once.
  let early = null;
  if (path === "/movies" && window.__bmsMovies) {
    early = window.__bmsMovies;
    window.__bmsMovies = null;
  }
  const fetched = early
    ? early.then((d) => (Array.isArray(d) ? { data: d } : api.get(path)))
    : api.get(path);
  return fetched
    .then((res) => {
      live = true;
      onData(res.data);
      try {
        localStorage.setItem(PREFIX + path, JSON.stringify(res.data));
      } catch (e) {
        /* quota */
      }
      return res.data;
    })
    .catch((e) => {
      if (!had) throw e;
    });
}

export function hadCached(path) {
  try {
    return !!localStorage.getItem(PREFIX + path);
  } catch (e) {
    return false;
  }
}
