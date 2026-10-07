// import { useEffect, useMemo, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { api } from "../api";
// import { haversineKm } from "../components/TheatreMap";

// export default function Movie() {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const [movie, setMovie] = useState();
//   const [shows, setShows] = useState([]);
//   const [selectedDate, setSelectedDate] = useState(null);
//   const [myLocation, setMyLocation] = useState(null);
//   const [locationError, setLocationError] = useState("");

//   useEffect(() => {
//     api.get("/movies/" + id).then((res) => {
//       setMovie(res.data);
//       if (!res.data.upcoming) {
//         api.get("/shows", { params: { movieId: id } }).then((showsRes) => {
//           setShows(showsRes.data);
//           if (showsRes.data.length) setSelectedDate(showsRes.data[0].show_date);
//         });
//       }
//     });
//   }, [id]);

//   // show_date is ISO (YYYY-MM-DD), so a plain string sort is already chronological -
//   // without this, dates appeared in whatever order they first showed up in the
//   // theatre-sorted shows list (effectively random), not today-then-tomorrow-etc.
//   const dates = useMemo(() => [...new Set(shows.map((s) => s.show_date))].sort(), [shows]);

//   function findMe() {
//     setLocationError("");
//     if (!navigator.geolocation) {
//       setLocationError("Your browser doesn't support location.");
//       return;
//     }
//     navigator.geolocation.getCurrentPosition(
//       (pos) => setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
//       () => setLocationError("Location permission denied — enable it to sort cinemas by distance.")
//     );
//   }

//   // Group the selected date's shows by theatre, then sort by real distance
//   // from the viewer's actual location once granted (nearest first, like BMS
//   // does for your selected area) - falls back to alphabetical until then.
//   const theatreGroups = useMemo(() => {
//     const forDate = shows.filter((s) => s.show_date === selectedDate);
//     const groups = [];
//     for (const show of forDate) {
//       let group = groups.find((g) => g.theatre_name === show.theatre_name);
//       if (!group) {
//         group = {
//           theatre_name: show.theatre_name,
//           theatre_address: show.theatre_address,
//           latitude: show.latitude,
//           longitude: show.longitude,
//           shows: [],
//         };
//         groups.push(group);
//       }
//       group.shows.push(show);
//     }
//     if (myLocation) {
//       for (const g of groups) {
//         g.distanceKm =
//           g.latitude != null ? haversineKm(myLocation.lat, myLocation.lon, +g.latitude, +g.longitude) : null;
//       }
//       groups.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
//     } else {
//       groups.sort((a, b) => a.theatre_name.localeCompare(b.theatre_name));
//     }
//     return groups;
//   }, [shows, selectedDate, myLocation]);

//   if (!movie) return <p>Loading...</p>;

//   return (
//     <div className="movie-page">
//       <div className="details card">
//         <img src={movie.poster_url} alt={movie.title} />
//         <section>
//           <h1>{movie.title}</h1>
//           <p>{movie.description}</p>
//           <p>
//             {movie.language} · {movie.genre}
//             {!movie.upcoming && <> · {movie.duration_minutes} min · {movie.certificate} · ★ {movie.rating}</>}
//           </p>
//         </section>
//       </div>

//       {movie.upcoming ? (
//         <div className="card coming-soon-panel">
//           <h2>Coming Soon</h2>
//           <p>Booking opens closer to release. Check back soon for showtimes.</p>
//         </div>
//       ) : (
//         <>
//           {dates.length > 0 && (
//         <div className="date-strip">
//           {dates.map((d) => {
//             const todayIso = new Date().toISOString().slice(0, 10);
//             const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
//             const label =
//               d === todayIso
//                 ? "TODAY"
//                 : d === tomorrowIso
//                 ? "TMRW"
//                 : new Date(d).toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
//             return (
//               <button
//                 key={d}
//                 className={"date-pill" + (d === selectedDate ? " active" : "")}
//                 onClick={() => setSelectedDate(d)}
//               >
//                 {label}
//                 <b>{new Date(d).getDate()}</b>
//                 {new Date(d).toLocaleDateString("en-IN", { month: "short" })}
//               </button>
//             );
//           })}
//         </div>
//       )}

//       <div className="cinemas-header">
//         <h2>Cinemas</h2>
//         {!myLocation && (
//           <button className="ghost" onClick={findMe}>
//             Sort by distance from me
//           </button>
//         )}
//       </div>
//       {locationError && <p className="error">{locationError}</p>}

//       {theatreGroups.length === 0 && <p>No shows scheduled for this date.</p>}
//       {theatreGroups.map((group) => (
//         <div className="theatre-block card" key={group.theatre_name}>
//           <div className="theatre-block-header">
//             <div>
//               <h3>{group.theatre_name}</h3>
//               {group.theatre_address && <p className="theatre-address">{group.theatre_address}</p>}
//             </div>
//             {group.distanceKm != null && (
//               <span className="distance-tag">{group.distanceKm.toFixed(1)} km away</span>
//             )}
//           </div>
//           <div className="time-slots">
//             {group.shows.map((show) => (
//               <button key={show.id} className="time-slot" onClick={() => navigate("/show/" + show.id)}>
//                 {show.start_time.slice(0, 5)}
//                 <small>₹{show.price}</small>
//               </button>
//             ))}
//           </div>
//         </div>
//       ))}
//         </>
//       )}
//     </div>
//   );
// }


import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, currentUser } from "../api";
import { haversineKm } from "../components/TheatreMap";
import Reviews from "../components/Reviews";
import { isWatchlisted, toggleWatchlist } from "../watchlist";

// Sold-out (housefull) showtimes are hidden from the list. Set this to false to
// show them instead as greyed-out, unclickable "Housefull" slots.
const HIDE_HOUSEFULL = true;

// Favourite cinemas are remembered in this browser, separately per logged-in account (or guest).
function favKey() {
  const u = currentUser();
  return "bms_fav_cinemas_" + (u && u.email ? u.email : "guest");
}
function loadFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem(favKey()));
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7h2C14 6.1 15.6 5 17.6 5 21 5 22.8 8.6 21.5 11.8 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

const PRICE_BANDS = [
  { key: "low", label: "Below ₹150", test: (p) => p < 150 },
  { key: "mid", label: "₹150 – ₹250", test: (p) => p >= 150 && p <= 250 },
  { key: "high", label: "Above ₹250", test: (p) => p > 250 },
];

const SORTS = [
  { key: "relevance", label: "Relevance", hint: "Best options for you first" },
  { key: "distance", label: "Distance", hint: "Show nearest first" },
];

// green = plenty of seats, yellow = filling fast (under half left), full = housefull.
// If the API doesn't send seat counts, every show is treated as green.
function availability(show) {
  const total = Number(show.total_seats);
  const left = Number(show.available_seats);
  if (!Number.isFinite(total) || !Number.isFinite(left) || total <= 0) return "ok";
  if (left <= 0) return "full";
  if (left / total < 0.5) return "fast";
  return "ok";
}

function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

export default function Movie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState();
  const [shows, setShows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [sheet, setSheet] = useState(null); // "sort" | "filter" | null
  const [priceBands, setPriceBands] = useState([]);
  const [language, setLanguage] = useState(null);
  const [favs, setFavs] = useState(loadFavs);
  const [favOnly, setFavOnly] = useState(false);
  const [visited, setVisited] = useState([]);
  const [shareMsg, setShareMsg] = useState("");
  const [interested, setInterested] = useState(false);

  // Is this coming-soon movie already on the viewer's watchlist?
  useEffect(() => {
    if (movie) setInterested(isWatchlisted(movie.id));
  }, [movie]);

  useEffect(() => {
    api.get("/movies/" + id).then((res) => {
      setMovie(res.data);
      if (!res.data.upcoming) {
        api.get("/shows", { params: { movieId: id } }).then((showsRes) => {
          setShows(showsRes.data);
          if (showsRes.data.length) setSelectedDate(showsRes.data[0].show_date);
        });
      }
    });
  }, [id]);

  // "Visited" = cinemas where the logged-in user has a confirmed booking whose show has already started.
  useEffect(() => {
    if (!currentUser()) return;
    api
      .get("/bookings/me")
      .then((res) => {
        const now = new Date();
        const names = res.data
          .filter((b) => {
            if (b.status !== "CONFIRMED") return false;
            const [y, m, d] = String(b.show_date).split("-").map(Number);
            const [hh, mm] = String(b.start_time).split(":").map(Number);
            return new Date(y, m - 1, d, hh, mm) < now;
          })
          .map((b) => b.theatre_name);
        setVisited([...new Set(names)]);
      })
      .catch(() => {});
  }, []);

  function toggleFav(name) {
    setFavs((current) => {
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      try {
        localStorage.setItem(favKey(), JSON.stringify(next));
      } catch (e) {
        // storage unavailable - favourites just last for this visit
      }
      return next;
    });
  }

  // Share: opens the device share sheet when available (phones), otherwise copies the link.
  async function shareMovie() {
    const url = window.location.href;
    const title = movie ? movie.title : "BookMyShow";
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title + " - book tickets on BookMyShow", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!");
      setTimeout(() => setShareMsg(""), 2000);
    } catch (e) {
      if (e && e.name === "AbortError") return; // the user just closed the share sheet
      window.prompt("Copy this link to share:", url);
    }
  }

  // show_date is ISO (YYYY-MM-DD), so a plain string sort is already chronological -
  // without this, dates appeared in whatever order they first showed up in the
  // theatre-sorted shows list (effectively random), not today-then-tomorrow-etc.
  const dates = useMemo(() => [...new Set(shows.map((s) => s.show_date))].sort(), [shows]);

  function findMe(onDone) {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        if (onDone) onDone();
      },
      () => setLocationError("Location permission denied — enable it to sort cinemas by distance.")
    );
  }

  function chooseSort(key) {
    if (key === "distance" && !myLocation) {
      // Needs the viewer's real location first; only switch once it's granted.
      findMe(() => {
        setSortBy("distance");
        setSheet(null);
      });
      return;
    }
    setSortBy(key);
    setSheet(null);
  }

  function toggleBand(key) {
    setPriceBands((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  // Group the selected date's shows by theatre. Relevance (default): theatres with
  // the most bookable showtimes first, then cheapest, then name. Distance: nearest
  // first using the viewer's real location, once granted.
  const theatreGroups = useMemo(() => {
    const bands = PRICE_BANDS.filter((b) => priceBands.includes(b.key));
    const forDate = shows.filter((s) => {
      if (s.show_date !== selectedDate) return false;
      if (HIDE_HOUSEFULL && availability(s) === "full") return false;
      if (bands.length && !bands.some((b) => b.test(Number(s.price)))) return false;
      return true;
    });
    const groups = [];
    for (const show of forDate) {
      let group = groups.find((g) => g.theatre_name === show.theatre_name);
      if (!group) {
        group = {
          theatre_name: show.theatre_name,
          theatre_address: show.theatre_address,
          latitude: show.latitude,
          longitude: show.longitude,
          shows: [],
        };
        groups.push(group);
      }
      group.shows.push(show);
    }
    if (myLocation) {
      for (const g of groups) {
        g.distanceKm =
          g.latitude != null ? haversineKm(myLocation.lat, myLocation.lon, +g.latitude, +g.longitude) : null;
      }
    }
    if (sortBy === "distance" && myLocation) {
      groups.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else {
      const minPrice = (g) => Math.min(...g.shows.map((s) => Number(s.price)));
      groups.sort(
        (a, b) =>
          Number(favs.includes(b.theatre_name)) - Number(favs.includes(a.theatre_name)) ||
          b.shows.length - a.shows.length ||
          minPrice(a) - minPrice(b) ||
          a.theatre_name.localeCompare(b.theatre_name)
      );
    }
    return favOnly ? groups.filter((g) => favs.includes(g.theatre_name)) : groups;
  }, [shows, selectedDate, myLocation, sortBy, priceBands, favs, favOnly]);

  if (!movie) return <p>Loading...</p>;

  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const hasShowsForDate = shows.some((s) => s.show_date === selectedDate);
  const languages = movie.language
    ? String(movie.language)
        .split(/[,/&]/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const activeLanguage = language || languages[0];

  function chipDate(d) {
    if (d === todayIso) return "Today, " + new Date(d).getDate() + " " + new Date(d).toLocaleDateString("en-IN", { month: "short" });
    if (d === tomorrowIso) return "Tomorrow, " + new Date(d).getDate() + " " + new Date(d).toLocaleDateString("en-IN", { month: "short" });
    return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  }

  return (
    <div className="movie-page">
      <div className="details card">
        <img src={movie.poster_url} alt={movie.title} />
        <section>
          <h1>{movie.title}</h1>
          <p>{movie.description}</p>
          <p>
            {movie.language} · {movie.genre}
            {!movie.upcoming && <> · {movie.duration_minutes} min · {movie.certificate} · ★ {movie.rating}</>}
          </p>
          {movie.upcoming && (
            <button
              className={"share-btn interest-btn" + (interested ? " on" : "")}
              onClick={() => setInterested(toggleWatchlist(movie))}
            >
              {interested ? "♥ In your watchlist" : "♡ I'm interested"}
            </button>
          )}
          <button className="share-btn" onClick={shareMovie}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.600 13.500l6.800 4M15.400 6.500l-6.800 4" />
            </svg>
            Share
          </button>
          {shareMsg && <span className="share-msg">{shareMsg}</span>}
        </section>
      </div>

      {movie.upcoming ? (
        <div className="card coming-soon-panel">
          <h2>Coming Soon</h2>
          <p>Booking opens closer to release. Check back soon for showtimes.</p>
        </div>
      ) : (
        <>
          {dates.length > 0 && (
        <div className="date-strip">
          {dates.map((d) => {
            const label =
              d === todayIso
                ? "TODAY"
                : d === tomorrowIso
                ? "TMRW"
                : new Date(d).toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase();
            return (
              <button
                key={d}
                className={"date-pill" + (d === selectedDate ? " active" : "")}
                onClick={() => setSelectedDate(d)}
              >
                {label}
                <b>{new Date(d).getDate()}</b>
                {new Date(d).toLocaleDateString("en-IN", { month: "short" })}
              </button>
            );
          })}
        </div>
      )}

      <div className="cinemas-header">
        <h2>Cinemas</h2>
      </div>

      <div className="mv-toolbar">
        <button className="mv-tool" onClick={() => setSheet("sort")}>
          <SortIcon />
          <span>
            Sort by: <b>{sortBy === "distance" ? "Distance" : "Relevance"}</b>
          </span>
        </button>
        <button className="mv-tool" onClick={() => setSheet("filter")}>
          <FilterIcon />
          <span>Filters</span>
          {priceBands.length + (favOnly ? 1 : 0) > 0 && (
            <span className="mv-badge">{priceBands.length + (favOnly ? 1 : 0)}</span>
          )}
        </button>
      </div>

      <div className="slot-legend">
        <span>
          <i className="lg ok" />
          Available
        </span>
        <span>
          <i className="lg fast" />
          Filling fast
        </span>
        {HIDE_HOUSEFULL ? <span className="lg-note">Housefull shows are hidden</span> : (
          <span>
            <i className="lg full" />
            Housefull
          </span>
        )}
      </div>
      {locationError && sheet === null && <p className="error">{locationError}</p>}

      {theatreGroups.length === 0 && (
        <p>
          {hasShowsForDate ? "No shows match your filters." : "No shows scheduled for this date."}
          {hasShowsForDate && (priceBands.length > 0 || favOnly) && (
            <>
              {" "}
              <button
                className="ghost mv-inline"
                onClick={() => {
                  setPriceBands([]);
                  setFavOnly(false);
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </p>
      )}
      {theatreGroups.map((group) => (
        <div className="theatre-block card" key={group.theatre_name}>
          <div className="theatre-block-header">
            <div>
              <h3>
                {group.theatre_name}
                {visited.includes(group.theatre_name) && <span className="visited-tag">Visited</span>}
              </h3>
              {group.theatre_address && <p className="theatre-address">{group.theatre_address}</p>}
            </div>
            <div className="theatre-block-side">
              {group.distanceKm != null && (
                <span className="distance-tag">{group.distanceKm.toFixed(1)} km away</span>
              )}
              <button
                className={"fav-btn" + (favs.includes(group.theatre_name) ? " on" : "")}
                onClick={() => toggleFav(group.theatre_name)}
                aria-label={favs.includes(group.theatre_name) ? "Remove from favourites" : "Add to favourites"}
                title={favs.includes(group.theatre_name) ? "Remove from favourites" : "Add to favourites"}
              >
                <HeartIcon />
              </button>
            </div>
          </div>
          <div className="time-slots">
            {group.shows.map((show) => {
              const av = availability(show);
              return (
                <button
                  key={show.id}
                  className={"time-slot " + av}
                  disabled={av === "full"}
                  title={av === "full" ? "Housefull" : av === "fast" ? "Filling fast" : "Available"}
                  onClick={() => navigate("/show/" + show.id)}
                >
                  {show.start_time.slice(0, 5)}
                  <small>{av === "full" ? "Housefull" : "₹" + show.price}</small>
                </button>
              );
            })}
          </div>
        </div>
      ))}

        <Reviews movieId={id} />
        </>
      )}

      {sheet === "sort" && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>Sort by</h3>
            </div>
            {SORTS.map((o) => (
              <button key={o.key} className="sort-option" onClick={() => chooseSort(o.key)}>
                <span>
                  <b>{o.label}</b>
                  <small>{o.hint}</small>
                </span>
                <i className={"radio" + (sortBy === o.key ? " on" : "")} />
              </button>
            ))}
            {locationError && <p className="error">{locationError}</p>}
          </div>
        </div>
      )}

      {sheet === "filter" && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>Filters</h3>
              <button
                className="sheet-clear"
                onClick={() => {
                  setPriceBands([]);
                  setFavOnly(false);
                }}
              >
                Clear all
              </button>
            </div>

            <h4 className="sheet-label">Price range</h4>
            <div className="chip-row">
              {PRICE_BANDS.map((b) => (
                <button
                  key={b.key}
                  className={"chip" + (priceBands.includes(b.key) ? " active" : "")}
                  onClick={() => toggleBand(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <h4 className="sheet-label">Cinemas</h4>
            <div className="chip-row">
              <button className={"chip" + (favOnly ? " active" : "")} onClick={() => setFavOnly((v) => !v)}>
                ♥ Favourites only ({favs.length})
              </button>
            </div>

            <h4 className="sheet-label">Date</h4>
            <div className="chip-row">
              {dates.map((d) => (
                <button
                  key={d}
                  className={"chip" + (d === selectedDate ? " active" : "")}
                  onClick={() => setSelectedDate(d)}
                >
                  {chipDate(d)}
                </button>
              ))}
            </div>

            {languages.length > 0 && (
              <>
                <h4 className="sheet-label">Language</h4>
                <div className="chip-row">
                  {languages.map((l) => (
                    <button
                      key={l}
                      className={"chip" + (l === activeLanguage ? " active" : "")}
                      onClick={() => setLanguage(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button className="sheet-done" onClick={() => setSheet(null)}>
              Show {theatreGroups.length} {theatreGroups.length === 1 ? "cinema" : "cinemas"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}