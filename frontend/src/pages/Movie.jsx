// import { useEffect, useMemo, useState } from "react";
// import { Link, useNavigate, useParams } from "react-router-dom";
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
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, currentUser } from "../api";
import { haversineKm } from "../components/TheatreMap";
import Reviews from "../components/Reviews";
import { isWatchlisted, toggleWatchlist } from "../watchlist";
import { getCity } from "../location";
import { IcSearch } from "../components/Icons";

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

function castSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Photo from /cast/<name>.jpg (drop files into frontend/public/cast/); falls back to initials.
function CastAvatar({ person }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="cast-avatar">{castInitials(person.name)}</div>;
  return (
    <img
      className="cast-avatar cast-photo"
      src={person.photo || "/cast/" + castSlug(person.name) + ".jpg"}
      alt={person.name}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

// BMS style: ★ 8.2/10 and "1.2K Votes" (real votes from the Ratings & Reviews below).
function RatingPill({ movieId, fallback }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    api
      .get("/movies/" + movieId + "/reviews")
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, [movieId]);
  const votes = summary?.count || 0;
  const score = votes > 0 ? Number(summary.average) : Number(fallback);
  if (!score) return null;
  return (
    <a className="rating-pill" href="#ratings">
      <span className="rp-star">★</span>
      <b>{score.toFixed(1)}/10</b>
      {votes > 0 && <span className="rp-votes">{fmtCount(votes)} {votes === 1 ? "Vote" : "Votes"}</span>}
    </a>
  );
}

// Tags: genres, language, certificate, duration (like the BMS pill row).
function movieTags(movie) {
  const tags = [];
  if (!movie.upcoming && movie.duration_minutes) {
    const h = Math.floor(movie.duration_minutes / 60);
    const m = movie.duration_minutes % 60;
    tags.push((h ? h + "h " : "") + (m ? m + "m" : "").trim());
  }
  String(movie.genre || "")
    .split(/[,/&]|\s+/)
    .map((g) => g.trim())
    .filter(Boolean)
    .forEach((g) => tags.push(g));
  if (movie.certificate) tags.push(movie.certificate);
  String(movie.language || "")
    .split(/[,/&]/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l) => tags.push(l));
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

// Fixed full-width "Book tickets" bar at the bottom of the movie details page.
function StickyBook({ onClick }) {
  return (
    <div className="sticky-book">
      <button type="button" onClick={onClick}>
        Book tickets
      </button>
    </div>
  );
}

// Horizontal row of other movies (poster, title, rating) like BMS "You might also like".
function MoreMovies({ currentId, upcoming }) {
  const [movies, setMovies] = useState([]);
  useEffect(() => {
    api
      .get("/movies")
      .then((res) => setMovies(res.data))
      .catch(() => {});
  }, []);
  const list = movies.filter((m) => String(m.id) !== String(currentId) && !!m.upcoming === !!upcoming).slice(0, 12);
  if (list.length === 0) return null;
  return (
    <div className="more-movies">
      <h2>{upcoming ? "More coming soon" : "You might also like"}</h2>
      <div className="more-row">
        {list.map((m) => (
          <Link className="more-card" to={"/movie/" + m.id} key={m.id}>
            <img src={m.poster_url} alt={m.title} loading="lazy" />
            <b>{m.title}</b>
            {!m.upcoming && Number(m.rating) > 0 && <small>★ {m.rating}</small>}
          </Link>
        ))}
      </div>
    </div>
  );
}

// 1234 -> "1.2K", 12 -> "12"
function fmtCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function castInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function parseCast(raw) {
  try {
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list.filter((p) => p && p.name) : [];
  } catch {
    return [];
  }
}

// Show price is the starting price: ₹100 at single screens, ₹150 at multiplexes.
const PRICE_BANDS = [
  { key: "low", label: "₹100 (Single screens)", test: (p) => p <= 100 },
  { key: "mid", label: "₹150 (Multiplexes)", test: (p) => p > 100 },
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

// Dates are worked out in India time (IST), not UTC: at 2:30 AM on 11 Oct IST it is still 10 Oct in UTC.
function istToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type) => parts.find((x) => x.type === type).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
function addDaysIso(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// "2026-10-11" -> a Date that always reads as that calendar day (formatted with timeZone: "UTC")
function isoDay(iso) {
  return new Date(iso + "T00:00:00Z");
}

// Class prices for a theatre type. Mirrors Pricing.java: base ₹100 (single screen) / ₹150 (multiplex).
function classPriceList(theatreType) {
  const base = theatreType === "MULTIPLEX" ? 150 : 100;
  return [
    ["Recliner", base * 3],
    ["Balcony", base * 1.5],
    ["Second Class", base * 1.25],
    ["Dress Class", base],
  ];
}

function time12(t) {
  const [hh, mm] = String(t).split(":");
  const n = parseInt(hh, 10);
  return String(n % 12 || 12).padStart(2, "0") + ":" + mm + " " + (n < 12 ? "AM" : "PM");
}

function slotKind(t) {
  const n = parseInt(String(t).slice(0, 2), 10);
  if (n >= 22 || n < 4) return "late";
  if (n < 8) return "early";
  return "";
}

export default function Movie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movie, setMovie] = useState();
  const [shows, setShows] = useState([]);
  const [showsLoaded, setShowsLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [sheet, setSheet] = useState(null); // "sort" | "filter" | "cinema" | null
  const [infoGroup, setInfoGroup] = useState(null); // theatre shown in the cinema details sheet
  const [priceBands, setPriceBands] = useState([]);
  const [language, setLanguage] = useState(null);
  const [formats, setFormats] = useState([]); // "2D" / "3D"
  const [langFilter, setLangFilter] = useState([]); // languages of the shows
  const [favs, setFavs] = useState(loadFavs);
  const [favOnly, setFavOnly] = useState(false);
  const [visited, setVisited] = useState([]);
  const [shareMsg, setShareMsg] = useState("");
  const [interested, setInterested] = useState(false);
  const [offers, setOffers] = useState([]);
  const [cineQuery, setCineQuery] = useState("");
  const [cineSearch, setCineSearch] = useState(false);
  const [hintOff, setHintOff] = useState(false);
  const [readMore, setReadMore] = useState(false);
  useEffect(() => {
    api.get("/coupons").then((res) => setOffers(res.data)).catch(() => {});
  }, []);

  // Is this coming-soon movie already on the viewer's watchlist?
  useEffect(() => {
    if (movie) setInterested(isWatchlisted(movie.id));
  }, [movie]);

  useEffect(() => {
    api.get("/movies/" + id).then((res) => {
      setMovie(res.data);
      if (!res.data.upcoming) {
        api.get("/shows", { params: { movieId: id, city: getCity() } }).then((showsRes) => {
          setShows(showsRes.data);
          setShowsLoaded(true);
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
        // Show times are India time (IST), so compare against the real instant, not the phone's own clock.
        const now = Date.now();
        const names = res.data
          .filter((b) => {
            if (b.status !== "CONFIRMED") return false;
            const startsAt = Date.parse(String(b.show_date).slice(0, 10) + "T" + String(b.start_time).slice(0, 5) + ":00+05:30");
            return startsAt < now;
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
      if (formats.length && !formats.includes(s.format || "2D")) return false;
      if (langFilter.length && !langFilter.includes(s.language || movie?.language)) return false;
      return true;
    });
    const groups = [];
    for (const show of forDate) {
      let group = groups.find((g) => g.theatre_name === show.theatre_name);
      if (!group) {
        group = {
          theatre_name: show.theatre_name,
          theatre_address: show.theatre_address,
          theatre_type: show.theatre_type,
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
  }, [shows, selectedDate, myLocation, sortBy, priceBands, favs, favOnly, formats, langFilter, movie]);

  if (!movie) return <p>Loading...</p>;

  const todayIso = istToday();
  const tomorrowIso = addDaysIso(todayIso, 1);
  const hasShowsForDate = shows.some((s) => s.show_date === selectedDate);
  const languages = movie.language
    ? String(movie.language)
        .split(/[,/&]/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const activeLanguage = language || languages[0];
  const showLanguages = [...new Set([...shows.map((s) => s.language).filter(Boolean), ...languages])];

  function chipDate(d) {
    const day = isoDay(d);
    if (d === todayIso) return "Today, " + day.getUTCDate() + " " + day.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    if (d === tomorrowIso) return "Tomorrow, " + day.getUTCDate() + " " + day.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    return day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }

  const booking = !movie.upcoming && searchParams.get("book") === "1";
  const formatOptions = [...new Set(shows.map((x) => x.format || "2D"))].sort();
  const handleBook = () => {
    if (formatOptions.length > 0) setSheet("lf");
    else openBooking();
  };
  const openBooking = () => {
    setSearchParams({ book: "1" });
    window.scrollTo(0, 0);
  };

  return (
    <div className="movie-page">
      {booking ? (
        <div className="book-head">
          <button type="button" className="book-back" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="bh-text">
            <b>{movie.title}</b>
            {movie.duration_minutes ? <small>Movie runtime: {Math.floor(movie.duration_minutes / 60)}h {movie.duration_minutes % 60}m</small> : null}
          </div>
          {shows.length > 0 && (
            <>
              <button type="button" className="book-back bh-icon" onClick={() => setCineSearch((x) => !x)} aria-label="Search cinemas">
                <IcSearch width={22} height={22} />
              </button>
              <button type="button" className="book-back bh-icon" onClick={() => setSheet("filter")} aria-label="Filters">
                <FilterIcon />
              </button>
            </>
          )}
        </div>
      ) : (
      <>
      <div className="mv-bar">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1>{movie.title}</h1>
        <button type="button" onClick={shareMovie} aria-label="Share">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.600 13.500l6.800 4M15.400 6.500l-6.800 4" />
          </svg>
        </button>
      </div>
      {shareMsg && <p className="share-msg mv-share-msg">{shareMsg}</p>}

      <div className="mv-hero">
        <img src={movie.poster_url} alt={movie.title} />
        <a
          className="mv-trailer"
          href={"https://www.youtube.com/results?search_query=" + encodeURIComponent(movie.title + " official trailer")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Trailer
        </a>
        <span className="mv-strip">{movie.upcoming ? "Coming soon" : "In cinemas"}</span>
      </div>

      <div className="mv-info">
        {!movie.upcoming && <RatingPill movieId={id} fallback={movie.rating} />}
        <p className="mv-meta">
          {[
            movie.duration_minutes ? Math.floor(movie.duration_minutes / 60) + "h " + (movie.duration_minutes % 60) + "m" : null,
            String(movie.genre || "").replace(/[/]/g, ", "),
            movie.certificate,
          ]
            .filter(Boolean)
            .join("  •  ")}
        </p>
        <div className="mv-tags">
          {[...new Set(shows.map((x) => x.format || "2D"))].length > 0 && (
            <span>{[...new Set(shows.map((x) => x.format || "2D"))].sort().join(", ")}</span>
          )}
          {String(movie.language || "")
            .split(/[,/&]/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => (
              <span key={l}>{l.toUpperCase()}</span>
            ))}
        </div>
        <p className={"mv-desc" + (readMore ? " open" : "")}>
          {movie.description}
          {!readMore && String(movie.description || "").length > 110 && (
            <button type="button" className="mv-more" onClick={() => setReadMore(true)}>
              ...Read more
            </button>
          )}
        </p>
        {movie.upcoming && (
          <button
            className={"share-btn interest-btn" + (interested ? " on" : "")}
            onClick={() => setInterested(toggleWatchlist(movie))}
          >
            {interested ? "♥ In your watchlist" : "♡ I'm interested"}
          </button>
        )}
      </div>

      {!movie.upcoming && (
        <div className="trending-bar">
          <span className="tb-tag">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M15 7h6v6" />
            </svg>
            Trending
          </span>
          <span className="tb-text">
            {Number(movie.tickets_last_hour) > 0 ? (
              <>
                <b>{fmtCount(Number(movie.tickets_last_hour))}</b> tickets booked in last 1 hour
              </>
            ) : (
              <>Bookings are open. Grab your seats!</>
            )}
          </span>
        </div>
      )}

      {!movie.upcoming && offers.length > 0 && (
        <div className="mv-offers">
          <h2>Top offers for you</h2>
          <div className="mv-offer-row">
            {offers.map((o) => (
              <div className="mv-offer" key={o.code}>
                <i>%</i>
                <span>
                  <b>{o.description}</b>
                  <small>Use code {o.code}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {parseCast(movie.cast_crew).length > 0 && (
        <div className="cast-block">
          <h2>Cast &amp; Crew</h2>
          <div className="cast-row">
            {parseCast(movie.cast_crew).map((p) => (
              <div className="cast-item" key={p.name + p.role}>
                <CastAvatar person={p} />
                <b>{p.name}</b>
                <small>{p.role}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      </>
      )}

      {movie.upcoming ? (
        <>
          <div className="card coming-soon-panel">
            <h2>Coming Soon</h2>
            <p>Booking opens closer to release. Check back soon for showtimes.</p>
          </div>
          <MoreMovies currentId={id} upcoming={true} />
        </>
      ) : (
        <>
          {booking && (<>
          {dates.length > 0 && (
        <div className="date-strip">
          {dates.map((d) => {
            const label = isoDay(d).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }).toUpperCase();
            return (
              <button
                key={d}
                className={"date-pill" + (d === selectedDate ? " active" : "")}
                onClick={() => setSelectedDate(d)}
              >
                {label}
                <b>{isoDay(d).getUTCDate()}</b>
                {isoDay(d).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
              </button>
            );
          })}
        </div>
      )}

      {shows.length > 0 && (
      <>
      {cineSearch && (
        <div className="cine-search">
          <IcSearch width={18} height={18} />
          <input autoFocus placeholder="Search for cinema" value={cineQuery} onChange={(e) => setCineQuery(e.target.value)} />
        </div>
      )}
      <div className="cinemas-header" id="showtimes" />
      <div className="lf-row">
        <span>
          {movie.language}
          {formats.length > 0 ? "  •  " + formats.join(", ") : ""}
        </span>
        <button type="button" onClick={() => setSheet("lf")}>
          Change ›
        </button>
      </div>

      <div className="mv-toolbar">
        <button className="mv-tool" onClick={() => setSheet("sort")}>
          <SortIcon />
          <span>Sort by</span>
          <i className="chev">⌄</i>
        </button>
        <span className="mv-sep" />
        <button className={"mv-tool" + (formats.length ? " on" : "")} onClick={() => setSheet("filter")}>
          <span>Special Formats</span>
          <i className="chev">⌄</i>
        </button>
        <button className={"mv-tool" + (priceBands.length ? " on" : "")} onClick={() => setSheet("filter")}>
          <span>Price</span>
          <i className="chev">⌄</i>
        </button>
        <button className={"mv-tool" + (favOnly ? " on" : "")} onClick={() => setFavOnly((x) => !x)}>
          <span>Favourites</span>
        </button>
      </div>

      </>
      )}

      {locationError && sheet === null && <p className="error">{locationError}</p>}

      {showsLoaded && shows.length === 0 && (
        <div className="no-cinemas">
          <b>No cinemas in {getCity()} yet</b>
          <span>Shows for this movie aren't available in your city right now.</span>
          <Link to="/city">Change city</Link>
        </div>
      )}

      {shows.length > 0 && theatreGroups.length === 0 && (
        <p>
          {hasShowsForDate ? "No shows match your filters." : "No shows scheduled for this date."}
          {hasShowsForDate && (priceBands.length > 0 || formats.length > 0 || langFilter.length > 0 || favOnly) && (
            <>
              {" "}
              <button
                className="ghost mv-inline"
                onClick={() => {
                  setPriceBands([]);
                  setFormats([]);
                  setLangFilter([]);
                  setFavOnly(false);
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </p>
      )}
      {theatreGroups.filter((g) => !cineQuery.trim() || g.theatre_name.toLowerCase().includes(cineQuery.trim().toLowerCase())).map((group) => (
        <div className="theatre-block card" key={group.theatre_name}>
          <div className="theatre-block-header">
            <span className="th-logo">{String(group.theatre_name).trim().charAt(0).toUpperCase()}</span>
            <div className="th-main">
              <h3>
                {group.theatre_name}
                <button
                  type="button"
                  className="info-btn"
                  aria-label={"About " + group.theatre_name}
                  title="Cinema details"
                  onClick={() => {
                    setInfoGroup(group);
                    setSheet("cinema");
                  }}
                >
                  i
                </button>
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
                  {time12(show.start_time)}
                  <small>{av === "full" ? "Housefull" : show.format || "2D"}</small>
                  {slotKind(show.start_time) && <i className={"slot-badge " + slotKind(show.start_time)}>{slotKind(show.start_time) === "late" ? "☾" : "☀"}</i>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

        </>)}
        {!booking && (<>
        <div id="ratings"><Reviews movieId={id} /></div>
        <MoreMovies currentId={id} upcoming={false} />
        <StickyBook onClick={handleBook} />
        </>)}
        </>
      )}

      {booking && !hintOff && theatreGroups.some((g) => g.shows.some((x) => slotKind(x.start_time))) && (
        <div className="slot-hint">
          <span><i className="slot-badge late">☾</i> Late night shows</span>
          <span><i className="slot-badge early">☀</i> Early morning shows</span>
          <button type="button" onClick={() => setHintOff(true)} aria-label="Close">×</button>
        </div>
      )}

      {sheet === "cinema" && infoGroup && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h3>{infoGroup.theatre_name}</h3>
            </div>
            <div className="ci-tags">
              <span>{infoGroup.theatre_type === "MULTIPLEX" ? "Multiplex" : "Single screen"}</span>
              <span>10 rows × 15 seats</span>
              {infoGroup.distanceKm != null && <span>{infoGroup.distanceKm.toFixed(1)} km away</span>}
            </div>
            {infoGroup.theatre_address && <p className="ci-address">{infoGroup.theatre_address}</p>}
            {infoGroup.latitude != null && (
              <a
                className="ci-directions"
                href={"https://www.google.com/maps/dir/?api=1&destination=" + infoGroup.latitude + "," + infoGroup.longitude}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions
              </a>
            )}
            <h4 className="sheet-label">Ticket prices</h4>
            <div className="ci-prices">
              {classPriceList(infoGroup.theatre_type).map(([name, price]) => (
                <div key={name}>
                  <span>{name}</span>
                  <b>₹{price}</b>
                </div>
              ))}
            </div>
            <h4 className="sheet-label">Good to know</h4>
            <ul className="ci-notes">
              <li>Seats are held for 10 minutes while you pay.</li>
              <li>Bookings can be cancelled from My Bookings.</li>
              <li>Up to 10 tickets per booking.</li>
            </ul>
            <button className="sheet-done" onClick={() => setSheet(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {sheet === "lf" && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet lf-sheet" onClick={(e) => e.stopPropagation()}>
            <i className="grab" />
            <small className="lf-movie">{movie.title}</small>
            <h3 className="lf-title">Select language and format</h3>
            <div className="lf-lang">{String(movie.language || "").toUpperCase()}</div>
            <div className="lf-chips">
              {formatOptions.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => {
                    setFormats([f]);
                    setSheet(null);
                    openBooking();
                  }}
                >
                  {f}
                </button>
              ))}
              {formatOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setFormats([]);
                    setSheet(null);
                    openBooking();
                  }}
                >
                  Select all
                </button>
              )}
            </div>
          </div>
        </div>
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
                  setFormats([]);
                  setLangFilter([]);
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

            <h4 className="sheet-label">Language</h4>
            <div className="chip-row">
              {showLanguages.map((l) => (
                <button
                  key={l}
                  className={"chip" + (langFilter.includes(l) ? " active" : "")}
                  onClick={() => setLangFilter((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))}
                >
                  {l}
                </button>
              ))}
            </div>

            <h4 className="sheet-label">Format</h4>
            <div className="chip-row">
              {["2D", "3D"].map((f) => (
                <button
                  key={f}
                  className={"chip" + (formats.includes(f) ? " active" : "")}
                  onClick={() => setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))}
                >
                  {f}
                </button>
              ))}
            </div>

            <button className="sheet-done" onClick={() => setSheet(null)}>
              Show {theatreGroups.length} {theatreGroups.length === 1 ? "cinema" : "cinemas"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}