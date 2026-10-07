import { currentUser } from "./api";

// "I'm interested" watchlist, remembered in this browser per logged-in account (or guest).
function key() {
  const u = currentUser();
  return "bms_watchlist_" + (u && u.email ? u.email : "guest");
}

export function loadWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(key()));
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(key(), JSON.stringify(list));
  } catch (e) {
    // storage unavailable - the watchlist just lasts for this visit
  }
}

export function isWatchlisted(id) {
  return loadWatchlist().some((m) => String(m.id) === String(id));
}

// Adds the movie if it isn't saved, removes it if it is. Returns true when it is now saved.
export function toggleWatchlist(movie) {
  const list = loadWatchlist();
  const exists = list.some((m) => String(m.id) === String(movie.id));
  const next = exists
    ? list.filter((m) => String(m.id) !== String(movie.id))
    : [...list, { id: movie.id, title: movie.title, poster_url: movie.poster_url, language: movie.language }];
  save(next);
  return !exists;
}

export function removeFromWatchlist(id) {
  const next = loadWatchlist().filter((m) => String(m.id) !== String(id));
  save(next);
  return next;
}
