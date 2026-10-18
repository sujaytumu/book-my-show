import { api, currentUser } from "./api";

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
    : [...list, { id: movie.id, title: movie.title, poster_url: movie.poster_url, language: movie.language, release_date: movie.release_date }];
  save(next);
  if (currentUser()) {
    (exists ? api.delete("/watchlist/" + movie.id) : api.put("/watchlist/" + movie.id)).catch(() => {});
  }
  return !exists;
}

export function removeFromWatchlist(id) {
  const next = loadWatchlist().filter((m) => String(m.id) !== String(id));
  save(next);
  if (currentUser()) api.delete("/watchlist/" + id).catch(() => {});
  return next;
}

// Merges this browser's list with the account's server-side list (so it follows you across devices),
// then returns the merged list. Release reminders are sent for everything on the server list.
export async function syncWatchlist() {
  if (!currentUser()) return loadWatchlist();
  try {
    const local = loadWatchlist();
    const { data } = await api.get("/watchlist");
    const have = new Set(data.map((m) => String(m.id)));
    for (const m of local) {
      if (!have.has(String(m.id))) {
        await api.put("/watchlist/" + m.id);
        data.push(m);
      }
    }
    save(data.map((m) => ({ id: m.id, title: m.title, poster_url: m.poster_url, language: m.language, release_date: m.release_date, upcoming: m.upcoming })));
  } catch (e) {
    // offline - keep the local copy
  }
  return loadWatchlist();
}
