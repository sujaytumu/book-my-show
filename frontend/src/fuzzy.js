// Typo-tolerant search for movie titles. Handles misspellings, missing or doubled letters and the usual
// Telugu-to-English spelling differences (Baahubali / Bahubali, Ranabaali / Ranabali, Veera / Vira).

// Collapse spellings that sound the same so "Baahubali" and "Bahubali" become the same word.
export function fold(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/aa+/g, "a").replace(/ee+/g, "i").replace(/oo+/g, "u").replace(/ii+/g, "i").replace(/uu+/g, "u")
    .replace(/ph/g, "f").replace(/w/g, "v").replace(/th/g, "t").replace(/dh/g, "d").replace(/kh/g, "k")
    .replace(/gh/g, "g").replace(/sh/g, "s").replace(/ck/g, "k").replace(/z/g, "j").replace(/y(?=[aeiou])/g, "y")
    .replace(/e(?=[ ]|$)/g, "i").replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ").trim();
}

// Edit distance (insert, delete, replace, swap two neighbours), stopping early past `max`.
export function distance(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const allowed = (len) => (len <= 3 ? 0 : len <= 5 ? 1 : len <= 9 ? 2 : 3);

// Score how well one query word matches the words of a title (0 = no match; higher is better).
function wordScore(qw, words) {
  let best = 0;
  for (const w of words) {
    if (w === qw) best = Math.max(best, 100);
    else if (w.startsWith(qw)) best = Math.max(best, 90 - Math.min(20, w.length - qw.length));
    else if (w.includes(qw) && qw.length >= 3) best = Math.max(best, 60);
    else {
      const max = allowed(qw.length);
      if (max > 0) {
        const d = distance(qw, w.length > qw.length + max ? w.slice(0, qw.length + max) : w, max);
        if (d <= max) best = Math.max(best, 70 - d * 12);
      }
    }
  }
  return best;
}

/**
 * Rank `movies` for a typed query. Every query word has to match something (title first, then genre).
 * Returns { list, fuzzy }: fuzzy is true when nothing matched exactly and the list is "closest matches".
 */
export function searchMovies(movies, query) {
  const q = fold(query);
  if (!q) return { list: [], fuzzy: false };
  const qWords = q.split(" ");
  const exact = String(query).trim().toLowerCase();
  const scored = [];
  for (const m of movies) {
    const tWords = fold(m.title).split(" ");
    const gWords = fold(m.genre).split(" ").filter(Boolean);
    let total = 0, ok = true;
    for (const qw of qWords) {
      const t = wordScore(qw, tWords);
      const g = t ? 0 : wordScore(qw, gWords) * 0.6;
      if (!t && !g) { ok = false; break; }
      total += t || g;
    }
    if (!ok) continue;
    let score = total / qWords.length;
    if (String(m.title).toLowerCase().includes(exact)) score += 40;
    score += Math.min(5, Number(m.rating || 0) / 2);
    scored.push({ m, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const literal = movies.some((m) => String(m.title).toLowerCase().includes(exact));
  return { list: scored.map((x) => x.m), fuzzy: !literal && scored.length > 0 };
}

// "Because you viewed X": other films that share its genres (and language), best rated first.
export function similarTo(seed, movies, limit = 8) {
  const genres = new Set(fold(seed.genre).split(" ").filter((g) => g.length > 2));
  return movies
    .filter((m) => m.id !== seed.id && !m.upcoming)
    .map((m) => {
      const shared = fold(m.genre).split(" ").filter((g) => genres.has(g)).length;
      return { m, s: shared * 10 + (m.language === seed.language ? 2 : 0) + Number(m.rating || 0) / 5 };
    })
    .filter((x) => x.s >= 10)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.m);
}
