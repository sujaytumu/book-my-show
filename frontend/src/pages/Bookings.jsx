// import { useEffect, useState } from "react";
// import { api } from "../api";

// export default function Bookings() {
//   const [bookings, setBookings] = useState([]);

//   function load() {
//     api.get("/bookings/me").then((res) => setBookings(res.data));
//   }

//   useEffect(load, []);

//   async function cancel(id) {
//     try {
//       await api.post("/bookings/" + id + "/cancel");
//       load();
//     } catch (err) {
//       alert(err.response?.data?.message || err.message);
//     }
//   }

//   // A plain <a href> can't carry the Authorization header, so fetch the PDF
//   // as a blob via axios (which does attach it) and trigger the download manually.
//   async function downloadTicket(id, reference) {
//     try {
//       const res = await api.get("/bookings/" + id + "/ticket", { responseType: "blob" });
//       const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = reference + ".pdf";
//       link.click();
//       window.URL.revokeObjectURL(url);
//     } catch (err) {
//       alert("Could not download ticket. Please try again.");
//     }
//   }

//   return (
//     <>
//       <h1>My Bookings</h1>
//       {bookings.map((b) => (
//         <div className="card booking" key={b.id}>
//           <h3>{b.reference}</h3>
//           <p>
//             {b.title} · {b.theatre_name}
//           </p>
//           <p>
//             {b.show_date} · {b.start_time.slice(0, 5)} · Seats: {b.seats}
//           </p>
//           <b>
//             ₹{b.amount} · {b.status}
//           </b>
//           <div className="booking-actions">
//             {(b.status === "CONFIRMED" || b.status === "CANCELLED") && (
//               <button className="ghost" onClick={() => downloadTicket(b.id, b.reference)}>
//                 Download ticket (PDF)
//               </button>
//             )}
//             {b.status === "CONFIRMED" && (
//               <button className="ghost" onClick={() => cancel(b.id)}>
//                 Cancel booking
//               </button>
//             )}
//           </div>
//         </div>
//       ))}
//     </>
//   );
// }


import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-06" -> "Tue, 6 Oct 2026" (parsed by parts so the timezone can't shift the day)
function fmtDate(str) {
  const [y, m, d] = String(str).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return DAYS[dt.getDay()] + ", " + d + " " + MONTHS[m - 1] + " " + y;
}

// "20:30:00" -> "8:30 PM"
function fmtTime(str) {
  const [hh, mm] = String(str).split(":");
  const h = Number(hh);
  return (h % 12 || 12) + ":" + mm + " " + (h >= 12 ? "PM" : "AM");
}

function startsAt(b) {
  const [y, m, d] = String(b.show_date).split("-").map(Number);
  const [hh, mm] = String(b.start_time).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function bucketOf(b) {
  if (b.status === "CANCELLED") return "cancelled";
  return startsAt(b) < new Date() ? "past" : "upcoming";
}

function statusInfo(b) {
  if (b.status === "CONFIRMED") return { label: "Confirmed", cls: "ok" };
  if (b.status === "CANCELLED") return { label: "Cancelled", cls: "bad" };
  if (b.status === "PENDING") return { label: "Payment pending", cls: "wait" };
  return { label: b.status, cls: "wait" };
}

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [posters, setPosters] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("upcoming");

  function load() {
    api.get("/bookings/me").then((res) => {
      setBookings(res.data);
      setLoaded(true);
    });
  }

  useEffect(load, []);

  // Posters come from the existing movie list (matched by title) - no backend change needed.
  useEffect(() => {
    api
      .get("/movies")
      .then((res) => {
        const map = {};
        res.data.forEach((m) => {
          map[m.title] = m.poster_url;
        });
        setPosters(map);
      })
      .catch(() => {});
  }, []);

  async function cancel(id) {
    try {
      await api.post("/bookings/" + id + "/cancel");
      load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  // A plain <a href> can't carry the Authorization header, so fetch the PDF
  // as a blob via axios (which does attach it) and trigger the download manually.
  async function downloadTicket(id, reference) {
    try {
      const res = await api.get("/bookings/" + id + "/ticket", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = reference + ".pdf";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Could not download ticket. Please try again.");
    }
  }

  const counts = { upcoming: 0, past: 0, cancelled: 0 };
  bookings.forEach((b) => {
    counts[bucketOf(b)] += 1;
  });
  const visible = bookings.filter((b) => bucketOf(b) === tab);

  return (
    <>
      <h1 className="bk-heading">My Bookings</h1>

      <div className="bk-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={"bk-tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {loaded && visible.length === 0 && (
        <div className="bk-empty">
          <b>No {tab} bookings</b>
          <p>
            {tab === "upcoming" ? "Booked something? It will show up here." : "Nothing here yet."}
          </p>
          {tab === "upcoming" && (
            <Link to="/" className="bk-btn primary bk-link">
              Browse movies
            </Link>
          )}
        </div>
      )}

      {visible.map((b) => {
        const info = statusInfo(b);
        const bucket = bucketOf(b);
        const poster = posters[b.title];
        const seatCount = String(b.seats).split(",").filter((s) => s.trim()).length;
        return (
          <div className={"bk-card" + (bucket === "upcoming" ? "" : " dim")} key={b.id}>
            <div className="bk-main">
              {poster ? (
                <img className="bk-poster" src={poster} alt={b.title} />
              ) : (
                <div className="bk-poster ph">{String(b.title).charAt(0)}</div>
              )}
              <div className="bk-info">
                <div className="bk-top">
                  <h3 className="bk-title">{b.title}</h3>
                  <span className={"bk-status " + info.cls}>{info.label}</span>
                </div>
                <p className="bk-theatre">{b.theatre_name}</p>
                <div className="bk-when">
                  <div>
                    <small>Date</small>
                    <b>{fmtDate(b.show_date)}</b>
                  </div>
                  <div>
                    <small>Time</small>
                    <b>{fmtTime(b.start_time)}</b>
                  </div>
                  <div>
                    <small>{seatCount === 1 ? "1 Ticket" : seatCount + " Tickets"}</small>
                    <b>{b.seats}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="bk-divider" />

            <div className="bk-foot">
              <div>
                <small>Booking ID</small>
                <b>{b.reference}</b>
              </div>
              <div>
                <small>{b.status === "CONFIRMED" ? "Amount paid" : "Amount"}</small>
                <b>₹{Number(b.amount).toFixed(2)}</b>
              </div>
              <div className="bk-actions">
                {(b.status === "CONFIRMED" || b.status === "CANCELLED") && (
                  <button className="bk-btn primary" onClick={() => downloadTicket(b.id, b.reference)}>
                    Download ticket
                  </button>
                )}
                {b.status === "CONFIRMED" && bucket === "upcoming" && (
                  <button className="bk-btn danger" onClick={() => cancel(b.id)}>
                    Cancel booking
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}