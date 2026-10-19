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
  return api
    .get(path)
    .then((res) => {
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
