// Posters are stored at 500px wide. Grid cards and rows show them ~110px wide, so ask the image CDN for a smaller
// copy there (about half the bytes). Other hosts are left untouched.
export function thumb(url, size = "w342") {
  return typeof url === "string" ? url.replace(/(image\.tmdb\.org\/t\/p\/)(w500|w780|original)\//, "$1" + size + "/") : url;
}

// Warm the browser image cache for posters that are not on screen yet (e.g. the Coming Soon row far down the
// page, which lazy loading would otherwise fetch only when the user scrolls to it). Each url is fetched once.
const warmed = new Set();
export function prefetchPosters(list, limit = 24) {
  try {
    (list || []).slice(0, limit).forEach((m) => {
      const u = m && m.poster_url ? thumb(m.poster_url) : null;
      if (!u || warmed.has(u)) return;
      warmed.add(u);
      const img = new Image();
      img.decoding = "async";
      img.src = u;
    });
  } catch (e) {
    /* best effort */
  }
}
