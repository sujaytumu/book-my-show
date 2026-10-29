// Posters are stored at 500px wide. Grid cards and rows show them ~110px wide, so ask the image CDN for a smaller
// copy there (about half the bytes). Other hosts are left untouched.
export function thumb(url, size = "w342") {
  return typeof url === "string" ? url.replace(/(image\.tmdb\.org\/t\/p\/)(w500|w780|original)\//, "$1" + size + "/") : url;
}
