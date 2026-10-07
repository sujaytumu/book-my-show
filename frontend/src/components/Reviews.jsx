import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, currentUser } from "../api";

// Rating buckets for the bar chart (ratings are 1-10, like the "★ 7.7" on movie cards).
const BUCKETS = [
  { label: "9-10", from: 9, to: 10 },
  { label: "7-8", from: 7, to: 8 },
  { label: "5-6", from: 5, to: 6 },
  { label: "3-4", from: 3, to: 4 },
  { label: "1-2", from: 1, to: 2 },
];

function fmtDate(value) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Reviews({ movieId }) {
  const user = currentUser();
  const [data, setData] = useState(null); // null = loading, false = reviews unavailable
  const [mine, setMine] = useState(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    api
      .get("/movies/" + movieId + "/reviews")
      .then((res) => setData(res.data))
      .catch(() => setData(false));
    if (user) {
      api
        .get("/reviews/mine", { params: { movieId } })
        .then((res) => setMine(res.data && res.data.rating ? res.data : null))
        .catch(() => {});
    }
  }

  useEffect(load, [movieId]);

  function openSheet() {
    setRating(mine ? mine.rating : 0);
    setText(mine && mine.body ? mine.body : "");
    setError("");
    setOpen(true);
  }

  async function submit() {
    if (rating < 1) {
      setError("Tap a star to choose your rating.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.put("/reviews", { movieId: Number(movieId), rating, body: text });
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your review. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.delete("/reviews", { params: { movieId } });
      setMine(null);
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove your review. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Still loading, or the reviews API isn't reachable: show nothing rather than a broken box.
  if (!data) return null;

  const dist = data.distribution || [];

  return (
    <section className="rv-section card">
      <div className="rv-head">
        <h2>Ratings &amp; Reviews</h2>
        {user ? (
          <button className="rv-cta" onClick={openSheet}>
            {mine ? "Edit your review" : "Rate this movie"}
          </button>
        ) : (
          <Link to="/login" className="rv-cta rv-cta-link">
            Login to rate
          </Link>
        )}
      </div>

      {data.count === 0 ? (
        <p className="rv-empty">No reviews yet. Be the first to rate this movie.</p>
      ) : (
        <div className="rv-summary">
          <div className="rv-score">
            <div>
              <b>{Number(data.average).toFixed(1)}</b>
              <span>/10</span>
            </div>
            <small>
              {data.count} {data.count === 1 ? "rating" : "ratings"}
            </small>
          </div>
          <div className="rv-bars">
            {BUCKETS.map((b) => {
              let n = 0;
              for (let r = b.from; r <= b.to; r++) n += dist[r - 1] || 0;
              return (
                <div className="rv-bar-row" key={b.label}>
                  <span>{b.label}</span>
                  <div className="rv-bar">
                    <i style={{ width: (n / data.count) * 100 + "%" }} />
                  </div>
                  <span>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rv-list">
        {(data.reviews || []).map((r) => (
          <div className="rv-item" key={r.id}>
            <div className="rv-item-top">
              <b>{r.user_name}</b>
              {r.verified && <span className="rv-verified">✓ Verified booking</span>}
              <span className="rv-pill">★ {r.rating}/10</span>
            </div>
            {r.body && <p>{r.body}</p>}
            <small>{fmtDate(r.created_at)}</small>
          </div>
        ))}
      </div>

      {open && (
        <div className="sheet-backdrop" onClick={() => !busy && setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>{mine ? "Edit your review" : "Rate this movie"}</h3>
            </div>

            <h4 className="sheet-label">Your rating{rating > 0 ? ": " + rating + "/10" : ""}</h4>
            <div className="rv-stars">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={"rv-star" + (n <= rating ? " on" : "")}
                  onClick={() => setRating(n)}
                  aria-label={n + " out of 10"}
                >
                  ★
                </button>
              ))}
            </div>

            <h4 className="sheet-label">Your review (optional)</h4>
            <textarea
              className="rv-text"
              rows={4}
              maxLength={500}
              placeholder="What did you think of the movie?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <small className="rv-count">{text.length}/500</small>

            {error && <p className="error">{error}</p>}

            <button className="sheet-done" onClick={submit} disabled={busy}>
              {busy ? "Saving..." : mine ? "Update review" : "Submit review"}
            </button>
            {mine && (
              <button className="rv-delete" onClick={remove} disabled={busy}>
                Delete my review
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
