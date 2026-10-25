// import { useEffect, useState } from "react";
import { goBack, finishTo } from "../nav";
// import { useNavigate, useParams } from "react-router-dom";
// import { api, currentUser } from "../api";
import { watchShowSeats } from "../liveSeats";
// import TheatreMap, { haversineKm } from "../components/TheatreMap";

// const MAX_SEATS = 10;

// function loadRazorpayScript() {
//   return new Promise((resolve, reject) => {
//     if (window.Razorpay) return resolve();
//     const script = document.createElement("script");
//     script.src = "https://checkout.razorpay.com/v1/checkout.js";
//     script.onload = resolve;
//     script.onerror = reject;
//     document.body.appendChild(script);
//   });
// }

// export default function Show() {
//   const { id } = useParams();
//   const navigate = useNavigate();
//   const user = currentUser();
//   const [show, setShow] = useState(null);
//   const [seats, setSeats] = useState([]);
//   const [selected, setSelected] = useState([]);
//   const [mode, setMode] = useState(null); // "mock" | "razorpay" | null (unknown yet)
//   const [loadError, setLoadError] = useState("");
//   const [pending, setPending] = useState(false);
//   const [slow, setSlow] = useState(false);
//   const [myLocation, setMyLocation] = useState(null);
//   const [locationError, setLocationError] = useState("");
//   const [contactEmail, setContactEmail] = useState(user?.email || "");
//   const [contactPhone, setContactPhone] = useState("");
//   const [hold, setHold] = useState(null); // { bookingId, reference, ticketSubtotal, convenienceFee, gst, amount }

//   useEffect(() => {
//     api.get("/shows/" + id).then((res) => setShow(res.data));
//     api
//       .get("/shows/" + id + "/seats")
//       .then((res) => setSeats(res.data))
//       .catch(() => setLoadError("Could not load seats. The server may be waking up — try refreshing in a bit."));
//     api.get("/payments/mode").then((res) => setMode(res.data.mode));
//   }, [id]);

//   useEffect(() => {
//     if (!pending) {
//       setSlow(false);
//       return;
//     }
//     const timer = setTimeout(() => setSlow(true), 4000);
//     return () => clearTimeout(timer);
//   }, [pending]);

//   function findMe() {
//     setLocationError("");
//     if (!navigator.geolocation) {
//       setLocationError("Your browser doesn't support location.");
//       return;
//     }
//     navigator.geolocation.getCurrentPosition(
//       (pos) => setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
//       () => setLocationError("Location permission denied — enable it in your browser to see distance.")
//     );
//   }

//   function toggleSeat(seat) {
//     if (seat.status !== "AVAILABLE") return;
//     setSelected((current) => {
//       if (current.includes(seat.seat_number)) {
//         return current.filter((s) => s !== seat.seat_number);
//       }
//       return current.length < MAX_SEATS ? [...current, seat.seat_number] : current;
//     });
//   }

//   // Step 1: lock the seats and get a real fare breakdown (ticket price + convenience fee + GST).
//   async function reviewBooking() {
//     if (!localStorage.getItem("token")) return navigate("/login");
//     if (!contactEmail.trim()) {
//       alert("Please enter an email address for the ticket.");
//       return;
//     }
//     setPending(true);
//     try {
//       const res = await api.post("/bookings/hold", {
//         showId: +id,
//         seatNumbers: selected,
//         contactEmail: contactEmail.trim(),
//         contactPhone: contactPhone.trim() || null,
//       });
//       setHold(res.data);
//     } catch (err) {
//       alert(err.response?.data?.message || err.message);
//     } finally {
//       setPending(false);
//     }
//   }

//   // Opens the ticket PDF in a new tab. The blank tab is opened synchronously
//   // (before any await) so browsers don't treat the later redirect as a
//   // blocked popup.
//   async function openTicketInNewTab(bookingId) {
//     const ticketTab = window.open("", "_blank");
//     try {
//       const res = await api.get("/bookings/" + bookingId + "/ticket", { responseType: "blob" });
//       const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
//       if (ticketTab) ticketTab.location.href = url;
//     } catch (err) {
//       if (ticketTab) ticketTab.close();
//     }
//   }

//   // Step 2: actually pay (mock or Razorpay) for the held booking.
//   async function confirmAndPay() {
//     setPending(true);
//     try {
//       if (mode === "mock") {
//         await api.post("/payments/mock-confirm/" + hold.bookingId);
//         openTicketInNewTab(hold.bookingId);
//         finishTo(navigate, "/bookings");
//         return;
//       }

//       const order = await api.post("/payments/create-order/" + hold.bookingId);
//       await loadRazorpayScript();

//       new window.Razorpay({
//         key: order.data.keyId,
//         amount: order.data.amount,
//         currency: order.data.currency,
//         name: "Book My Show",
//         order_id: order.data.orderId,
//         prefill: { email: contactEmail, contact: contactPhone },
//         handler: async (response) => {
//           await api.post("/payments/verify", {
//             razorpayOrderId: response.razorpay_order_id,
//             razorpayPaymentId: response.razorpay_payment_id,
//             razorpaySignature: response.razorpay_signature,
//           });
//           openTicketInNewTab(hold.bookingId);
//           finishTo(navigate, "/bookings");
//         },
//       }).open();
//     } catch (err) {
//       alert(err.response?.data?.message || err.message);
//     } finally {
//       setPending(false);
//     }
//   }

//   const distanceKm =
//     show?.latitude != null && myLocation
//       ? haversineKm(myLocation.lat, myLocation.lon, +show.latitude, +show.longitude).toFixed(1)
//       : null;

//   return (
//     <>
//       {show && (
//         <div className="show-header">
//           <h1>{show.movie_title}</h1>
//           <p>
//             {show.theatre_name} / {show.screen_name} · {show.show_date} · {show.start_time?.slice(0, 5)} · ₹{show.price}
//           </p>
//         </div>
//       )}

//       {loadError && <p className="error">{loadError}</p>}

//       {!hold && (
//         <>
//           <div className="screen">SCREEN</div>
//           <div className="seats">
//             {seats.map((seat) => (
//               <button
//                 className={selected.includes(seat.seat_number) ? "selected" : seat.status.toLowerCase()}
//                 onClick={() => toggleSeat(seat)}
//                 key={seat.id}
//               >
//                 {seat.seat_number}
//               </button>
//             ))}
//           </div>

//           {selected.length > 0 && (
//             <div className="card contact-details">
//               <h2>Booking details</h2>
//               <p className="hint">Your ticket (PDF) is emailed here automatically once payment is confirmed.</p>
//               <input
//                 type="email"
//                 placeholder="Email for ticket"
//                 required
//                 value={contactEmail}
//                 onChange={(e) => setContactEmail(e.target.value)}
//               />
//               <input
//                 type="tel"
//                 placeholder="Phone number (optional)"
//                 value={contactPhone}
//                 onChange={(e) => setContactPhone(e.target.value)}
//               />
//             </div>
//           )}

//           {slow && (
//             <p className="notice">
//               Still working — the server may be waking up from idle, this can take up to a minute.
//             </p>
//           )}

//           <div className="bar">
//             <b>{selected.length} seats selected</b>
//             <button disabled={!selected.length || pending} onClick={reviewBooking}>
//               {pending ? "Please wait..." : "Review Booking"}
//             </button>
//           </div>
//         </>
//       )}

//       {hold && (
//         <div className="card confirm-booking">
//           <h2>Confirm booking</h2>
//           <p>
//             {show?.movie_title} · Seats: <b>{selected.join(", ")}</b>
//           </p>
//           <div className="fare-row">
//             <span>Ticket Price</span>
//             <span>₹{hold.ticketSubtotal.toFixed(2)}</span>
//           </div>
//           <div className="fare-row">
//             <span>Convenience Fee</span>
//             <span>₹{hold.convenienceFee.toFixed(2)}</span>
//           </div>
//           <div className="fare-row">
//             <span>GST (18% on fee)</span>
//             <span>₹{hold.gst.toFixed(2)}</span>
//           </div>
//           <div className="fare-row fare-total">
//             <span>Total</span>
//             <span>₹{hold.amount.toFixed(2)}</span>
//           </div>
//           <p className="hint">Sending ticket to: {contactEmail}{contactPhone ? " · " + contactPhone : ""}</p>
//           {slow && (
//             <p className="notice">
//               Still working — the server may be waking up from idle, this can take up to a minute.
//             </p>
//           )}
//           <div className="bar">
//             <button className="ghost" disabled={pending} onClick={() => setHold(null)}>
//               Back
//             </button>
//             <button disabled={pending} onClick={confirmAndPay}>
//               {pending ? "Please wait..." : mode === "razorpay" ? "Pay with Razorpay" : "Pay & Confirm (Test Mode)"}
//             </button>
//           </div>
//         </div>
//       )}

//       {show?.latitude != null && (
//         <div className="theatre-location card">
//           <h2>Theatre location</h2>
//           {distanceKm ? (
//             <p>
//               <b>{distanceKm} km</b> away from your current location.
//             </p>
//           ) : (
//             <button className="ghost" onClick={findMe}>
//               Show distance from me
//             </button>
//           )}
//           {locationError && <p className="error">{locationError}</p>}
//           <TheatreMap
//             theatreLat={+show.latitude}
//             theatreLon={+show.longitude}
//             theatreName={show.theatre_name}
//             myLocation={myLocation}
//           />
//         </div>
//       )}
//     </>
//   );
// }



import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { api, currentUser } from "../api";

const MAX_SEATS = 10;



//a) addn



// Row letters run top (back of the hall) to bottom (nearest the screen):

// first 2 rows Recliner, next 2 Balcony, next Second Class, the rest Dress Class.

function seatClassFor(index) {

  if (index < 1) return "Recliner";

  if (index < 4) return "Balcony";

  if (index < 7) return "Second Class";

  return "Dress Class";

}

//



function loadRazorpayScript() {

  return new Promise((resolve, reject) => {

    if (window.Razorpay) return resolve();

    const script = document.createElement("script");

    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = resolve;

    script.onerror = reject;

    document.body.appendChild(script);

  });

}



function fmtShowDate(d) {
  const iso = String(d).slice(0, 10);
  const day = new Date(iso + "T00:00:00Z");
  return day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(/^(\w+)\s/, "$1, ");
}

function fmtTime12(t) {
  const [hh, mm] = String(t).split(":");
  const h = parseInt(hh, 10);
  return String(h % 12 || 12).padStart(2, "0") + ":" + mm + " " + (h < 12 ? "AM" : "PM");
}

export default function Show() {

  const { id } = useParams();

  const navigate = useNavigate();

  const user = currentUser();

  const [show, setShow] = useState(null);

  const [seats, setSeats] = useState([]);

  const [selected, setSelected] = useState([]);

  const [mode, setMode] = useState(null); // "mock" | "razorpay" | null (unknown yet)

  const [loadError, setLoadError] = useState("");

  const [pending, setPending] = useState(false);

  const [slow, setSlow] = useState(false);

  const [contactEmail, setContactEmail] = useState(user?.email || "");

  const [contactPhone, setContactPhone] = useState("");

  const [hold, setHold] = useState(null); // { bookingId, reference, ticketSubtotal, convenienceFee, gst, amount }

  // Real-BMS style: pick how many tickets first, then tap one seat to grab that many together.
  const [qty, setQty] = useState(2);
  const [qtyDraft, setQtyDraft] = useState(2);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomValue = useRef(1);
  const zoomRef = useRef(null); // scroll container of the seat map
  const pinch = useRef(null); // { dist, zoom } while two fingers are down
  const fitted = useRef(false); // auto-fit the 15-seat rows to the screen width once
  const anchor = useRef(null); // keeps the point between the fingers steady while zooming
  const [seatMsg, setSeatMsg] = useState("");
  // Smart seat picker (server-side scoring): auto-pick, explanation card and the view-quality heat overlay.
  const [heat, setHeat] = useState(null);
  const [showHeat, setShowHeat] = useState(false);
  const [pickNote, setPickNote] = useState(null);
  const [picking, setPicking] = useState("");
  const [flash, setFlash] = useState(false);
  const [siblings, setSiblings] = useState([]); // other showtimes of this movie at this cinema on this day
  useEffect(() => {
    if (!show?.movie_id) return;
    const d = String(show.show_date).slice(0, 10);
    api
      .get("/shows", { params: { movieId: show.movie_id, date: d } })
      .then((res) => setSiblings(res.data.filter((x) => x.theatre_name === show.theatre_name)))
      .catch(() => {});
  }, [show?.movie_id, show?.show_date, show?.theatre_name]);
  const [couponCode, setCouponCode] = useState(""); // typed or picked coupon, validated by the server on Review Booking
  const [offers, setOffers] = useState([]); // active offers from the server
  const [foodMenu, setFoodMenu] = useState([]); // snacks from the server
  const [foodQty, setFoodQty] = useState({}); // { itemId: qty }
  const [walletBal, setWalletBal] = useState(null); // wallet balance, loaded when the review sheet opens
  const [useWallet, setUseWallet] = useState(false);
  const [secsLeft, setSecsLeft] = useState(null); // countdown while the seats are held for payment



  useEffect(() => {

    api.get("/shows/" + id).then((res) => setShow(res.data));

    api

      .get("/shows/" + id + "/seats")

      .then((res) => setSeats(res.data))

      .catch(() => setLoadError("Could not load seats. The server may be waking up — try refreshing in a bit."));

    api.get("/payments/mode").then((res) => setMode(res.data.mode));

  }, [id]);



  // Live seat map: other people's holds/bookings appear instantly (WebSocket), and seats you picked that
  // someone else just took are dropped from your selection.
  const holdRef = useRef(null);
  const idemRef = useRef(null);
  holdRef.current = hold;
  const [liveNote, setLiveNote] = useState("");
  const [wait, setWait] = useState(null); // { onWaitlist, seats, available }
  const [waitQty, setWaitQty] = useState(2);
  const [waitBusy, setWaitBusy] = useState(false);
  function loadWait() {
    api.get("/waitlist/" + id).then((res) => setWait(res.data)).catch(() => {});
  }
  async function toggleWait() {
    setWaitBusy(true);
    try {
      const res = wait && wait.onWaitlist ? await api.delete("/waitlist/" + id) : await api.post("/waitlist/" + id, { seats: waitQty });
      setWait(res.data);
    } catch (e) {
      setLiveNote((e.response && e.response.data && e.response.data.message) || "Could not update the waitlist");
    } finally {
      setWaitBusy(false);
    }
  }
  useEffect(() => {
    loadWait();
    const stop = watchShowSeats(id, () => {
      loadWait();
      api.get("/shows/" + id + "/seats").then((res) => {
        setSeats(res.data);
        if (holdRef.current) return;
        const free = new Set(res.data.filter((x) => x.status === "AVAILABLE").map((x) => x.seat_number));
        setSelected((cur) => {
          const kept = cur.filter((sn) => free.has(sn));
          if (kept.length !== cur.length) setLiveNote("Someone just booked a seat you picked. Please choose again.");
          return kept.length === cur.length ? cur : kept;
        });
      }).catch(() => {});
    });
    return stop;
  }, [id]);

  useEffect(() => {

    if (!pending) {

      setSlow(false);

      return;

    }

    const timer = setTimeout(() => setSlow(true), 4000);

    return () => clearTimeout(timer);

  }, [pending]);



  zoomValue.current = zoom;

  useEffect(() => {
    api
      .get("/coupons")
      .then((res) => setOffers(res.data))
      .catch(() => {});
    api
      .get("/food")
      .then((res) => setFoodMenu(res.data))
      .catch(() => {});
  }, []);

  // Seats are held for 10 minutes once you review the booking; count down like BMS.
  useEffect(() => {
    if (!hold?.expiresAt) {
      setSecsLeft(null);
      return;
    }
    const end = new Date(hold.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setSecsLeft(left);
      if (left === 0) {
        setHold(null);
        setSelected([]);
        setSeatMsg("Your seat hold expired. Please select seats again.");
        api.get("/shows/" + id + "/seats").then((res) => setSeats(res.data));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold, id]);

  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.4;

  function applyZoom(next, cx) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setZoom((current) => {
      if (clamped !== current) anchor.current = { cx, ratio: clamped / current };
      return clamped;
    });
  }

  // 15 seats per row is wider than a phone: start zoomed out so every seat is visible (pinch to zoom in).
  useLayoutEffect(() => {
    const el = zoomRef.current;
    const map = el && el.firstElementChild;
    if (!map || !seats.length || fitted.current) return;
    const natural = map.scrollWidth / zoom;
    if (!natural) return;
    fitted.current = true;
    setZoom(Math.min(1, Math.max(MIN_ZOOM, +((el.clientWidth - 4) / natural).toFixed(2))));
  }, [seats.length, hold]);

  // After the seat map resizes, scroll so the point between the fingers stays under them.
  useLayoutEffect(() => {
    const el = zoomRef.current;
    const a = anchor.current;
    if (el && a) el.scrollLeft = (el.scrollLeft + a.cx) * a.ratio - a.cx;
    anchor.current = null;
  }, [zoom]);

  // Laptop/trackpad pinch (ctrl + wheel) zooms the seat map too.
  useEffect(() => {
    const el = zoomRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(zoomValue.current * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function touchDist(e) {
    const [a, b] = [e.touches[0], e.touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function onPinchStart(e) {
    if (e.touches.length === 2) pinch.current = { dist: touchDist(e), zoom };
  }

  function onPinchMove(e) {
    if (e.touches.length !== 2 || !pinch.current) return;
    const rect = zoomRef.current.getBoundingClientRect();
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    applyZoom(pinch.current.zoom * (touchDist(e) / pinch.current.dist), cx);
  }

  function onPinchEnd(e) {
    if (e.touches.length < 2) pinch.current = null;
  }

  function confirmQty() {
    if (qty !== qtyDraft) setSelected([]);
    setQty(qtyDraft);
    setSeatMsg("");
    setQtyOpen(false);
  }

  // Heat overlay: fetched only while it is switched on, and refreshed whenever the seat map changes.
  useEffect(() => {
    if (!showHeat) return;
    let live = true;
    const t = setTimeout(() => {
      api
        .get("/shows/" + id + "/best-seats", { params: { count: qty || 2 } })
        .then((r) => live && setHeat(r.data.heat))
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [showHeat, id, seats, qty]);

  // Auto-pick: the server finds the best group (centred, right depth, no lonely seat left beside it).
  async function autoPick(mode) {
    if (!qty) {
      setQtyOpen(true);
      return;
    }
    setSeatMsg("");
    setPicking(mode);
    try {
      const { data } = await api.get("/shows/" + id + "/best-seats", { params: { count: qty, mode } });
      if (!data.seats || data.seats.length === 0) {
        setPickNote(null);
        setSeatMsg("No seats left for " + qty + ". Try fewer tickets or another show.");
        return;
      }
      setSelected(data.seats);
      setPickNote(data);
      showPicked(data.seats);
    } catch (e) {
      setSeatMsg("Couldn't pick seats just now. Tap any seat to choose yourself.");
    } finally {
      setPicking("");
    }
  }
  function showPicked(list) {
    setFlash(true);
    setTimeout(() => setFlash(false), 1100);
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (e) {
      /* no haptics */
    }
    setTimeout(() => {
      const first = zoomRef.current && zoomRef.current.querySelector('[title="' + list[0] + '"]');
      if (first && first.scrollIntoView) first.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }, 60);
  }

  // The `qty` free seats side by side that include (or sit just left of) the given seat, or null.
  function windowFor(seatNumber) {
    const letter = seatNumber.charAt(0);
    const row = seats
      .filter((x) => x.seat_number.charAt(0) === letter)
      .sort((x, y) => parseInt(x.seat_number.slice(1), 10) - parseInt(y.seat_number.slice(1), 10));
    const idx = row.findIndex((x) => x.seat_number === seatNumber);
    if (idx < 0 || !qty) return null;
    for (let start = idx; start > idx - qty; start--) {
      if (start < 0 || start + qty > row.length) continue;
      const win = row.slice(start, start + qty);
      if (win.every((x) => x.status === "AVAILABLE")) return win.map((x) => x.seat_number);
    }
    return null;
  }

  // Press and slide across a row to move the whole group of seats (WhatsApp-style hold, then drag).
  const dragLatest = useRef({});
  dragLatest.current = { qty, windowFor, setSelected, setSeatMsg, setPickNote };
  const hasSeats = seats.length > 0;
  useEffect(() => {
    const el = zoomRef.current;
    if (!el) return;
    let timer = 0, active = false, sx = 0, sy = 0, last = "", block = 0;
    const at = (t) => {
      const b = document.elementFromPoint(t.clientX, t.clientY);
      const seat = b && b.closest ? b.closest("[data-seat]") : null;
      return seat ? seat.getAttribute("data-seat") : null;
    };
    const apply = (num) => {
      if (!num || num === last) return;
      const d = dragLatest.current;
      const win = d.windowFor(num);
      if (!win) return;
      last = num;
      d.setSelected(win);
      d.setSeatMsg("");
      d.setPickNote(null);
      try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) { /* no haptics */ }
    };
    const start = (e) => {
      clearTimeout(timer);
      if (e.touches.length !== 1 || !dragLatest.current.qty) return;
      const t = e.touches[0];
      const num = at(t);
      if (!num) return;
      sx = t.clientX; sy = t.clientY; last = "";
      timer = setTimeout(() => {
        active = true;
        el.classList.add("dragging");
        apply(num);
      }, 140);
    };
    const move = (e) => {
      const t = e.touches[0];
      if (active) {
        e.preventDefault();
        apply(at(t));
      } else if (timer && Math.hypot(t.clientX - sx, t.clientY - sy) > 10) {
        clearTimeout(timer);
        timer = 0;
      }
    };
    const end = () => {
      clearTimeout(timer);
      timer = 0;
      if (active) {
        active = false;
        block = Date.now() + 450;
        el.classList.remove("dragging");
      }
    };
    const click = (e) => {
      if (Date.now() < block) { e.stopPropagation(); e.preventDefault(); }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("click", click, true);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("click", click, true);
    };
  }, [hasSeats]);

  // Tap a seat -> select `qty` seats together in that row (starting at the tapped seat,
  // sliding left if there is no room on the right). Tap a selected seat again to clear.
  function selectSeat(seat) {
    if (seat.status !== "AVAILABLE") return;
    if (!qty) {
      setQtyOpen(true);
      return;
    }
    setSeatMsg("");
    setPickNote(null);
    if (selected.includes(seat.seat_number)) {
      setSelected([]);
      return;
    }
    const win = windowFor(seat.seat_number);
    if (win) {
      setSelected(win);
      return;
    }
    setSeatMsg("Can't seat " + qty + " together here. Try another spot or change the number of tickets.");
  }

  // Step 1: lock the seats and get a real fare breakdown (ticket price + convenience fee + GST).

  async function reviewBooking() {

    if (!localStorage.getItem("token")) return navigate("/login");

    if (!contactEmail.trim()) {

      alert("Please enter an email address for the ticket.");

      return;

    }

    setPending(true);

    try {

      // Same seats + coupon + food => same key, so a double tap or a network retry returns the SAME hold.
      const sig = id + "|" + [...selected].sort().join(",") + "|" + couponCode.trim() + "|" + JSON.stringify(foodQty);
      if (!idemRef.current || idemRef.current.sig !== sig) idemRef.current = { sig, key: Date.now().toString(36) + Math.random().toString(36).slice(2, 12) };
      const idemKey = idemRef.current.key;
      const res = await api.post("/bookings/hold", {

        showId: +id,

        seatNumbers: selected,

        contactEmail: contactEmail.trim(),

        contactPhone: contactPhone.trim() || null,
        couponCode: couponCode.trim() || null,
        food: Object.entries(foodQty).filter(([, q]) => q > 0).map(([fid, q]) => ({ id: +fid, qty: q })),

      }, { headers: { "Idempotency-Key": idemKey } });

      setHold(res.data);

    } catch (err) {

      alert(err.response?.data?.message || err.message);

    } finally {

      setPending(false);

    }

  }



  // Opens the ticket PDF in a new tab. The blank tab is opened synchronously

  // (before any await) so browsers don't treat the later redirect as a

  // blocked popup.

  async function openTicketInNewTab(bookingId) {

    const ticketTab = window.open("", "_blank");

    try {

      const res = await api.get("/bookings/" + bookingId + "/ticket", { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));

      if (ticketTab) ticketTab.location.href = url;

    } catch (err) {

      if (ticketTab) ticketTab.close();

    }

  }



  // Step 2: actually pay (mock or Razorpay) for the held booking.

  async function confirmAndPay() {

    setPending(true);

    try {

      if (useWallet) {
        await api.post("/payments/wallet-pay/" + hold.bookingId);
        openTicketInNewTab(hold.bookingId);
        finishTo(navigate, "/bookings");
        return;
      }

      if (mode === "mock") {

        await api.post("/payments/mock-confirm/" + hold.bookingId);

        openTicketInNewTab(hold.bookingId);

        finishTo(navigate, "/bookings");

        return;

      }



      const order = await api.post("/payments/create-order/" + hold.bookingId);

      await loadRazorpayScript();



      new window.Razorpay({

        key: order.data.keyId,

        amount: order.data.amount,

        currency: order.data.currency,

        name: "Book My Show",

        order_id: order.data.orderId,

        prefill: { email: contactEmail, contact: contactPhone },

        handler: async (response) => {

          await api.post("/payments/verify", {

            razorpayOrderId: response.razorpay_order_id,

            razorpayPaymentId: response.razorpay_payment_id,

            razorpaySignature: response.razorpay_signature,

          });

          openTicketInNewTab(hold.bookingId);

          finishTo(navigate, "/bookings");

        },

      }).open();

    } catch (err) {

      alert(err.response?.data?.message || err.message);

    } finally {

      setPending(false);

    }

  }



  // Group the flat seat list into rows (A, B, C...) and then into seat classes.
  const rowMap = {};
  seats.forEach((seat) => {
    const letter = seat.seat_number.charAt(0);
    (rowMap[letter] = rowMap[letter] || []).push(seat);
  });
  const rowLetters = Object.keys(rowMap).sort();
  rowLetters.forEach((l) =>
    rowMap[l].sort((a, b) => parseInt(a.seat_number.slice(1), 10) - parseInt(b.seat_number.slice(1), 10))
  );
  const sections = [];
  rowLetters.forEach((letter, i) => {
    const label = seatClassFor(i);
    let section = sections[sections.length - 1];
    if (!section || section.label !== label) {
      section = { label, rows: [] };
      sections.push(section);
    }
    section.rows.push(letter);
  });

  // Class price list comes from the server (single screen base ₹100, multiplex base ₹150).
  const classPrices = show?.class_prices || {};
  const rowClass = {};
  sections.forEach((sec) => sec.rows.forEach((l) => (rowClass[l] = sec.label)));
  // "Bestseller": the most central available seats (middle rows, middle columns) that can still fit the party together.
  const bestSet = new Set();
  {
    const mid = (rowLetters.length - 1) / 2;
    const cands = [];
    rowLetters.forEach((letter, ri) => {
      const row = rowMap[letter];
      row.forEach((seat, ci) => {
        const win = row.slice(ci, ci + qty);
        if (win.length < qty || !win.every((x) => x.status === "AVAILABLE")) return;
        const score = Math.abs(ri - (mid + 0.5)) * 1.4 + Math.abs(ci + (qty - 1) / 2 - (row.length - 1) / 2) * 0.8;
        cands.push({ score, win });
      });
    });
    cands.sort((a, b) => a.score - b.score);
    cands.slice(0, 6).forEach((c) => c.win.forEach((x) => bestSet.add(x.seat_number)));
  }
  const selectedTotal = selected.reduce(
    (sum, sn) => sum + Number(classPrices[rowClass[sn.charAt(0)]] ?? show?.price ?? 0),
    0
  );

  return (

    <>

      {show && (
        <div className="bms-head">
          <div className="bms-head-top">
            <button type="button" className="bms-back" onClick={() => goBack(navigate)} aria-label="Back">
              ‹
            </button>
            <div className="bms-head-text">
              <h1>{show.movie_title}</h1>
              <p>
                {show.theatre_name}
                {show.screen_name ? " · " + show.screen_name : ""}
              </p>
            </div>
          </div>
          <div className="bms-head-row">
            <span className="bms-date">{fmtShowDate(show.show_date)}</span>
            {!hold && (
              <button
                type="button"
                className="bms-qty"
                aria-label={"Number of tickets: " + qty}
                onClick={() => {
                  setQtyDraft(qty);
                  setQtyOpen(true);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                {qty} {qty === 1 ? "Ticket" : "Tickets"}
              </button>
            )}
          </div>
          {!hold && siblings.length > 1 && (
            <div className="bms-times">
              {siblings.map((x) => (
                <button
                  type="button"
                  key={x.id}
                  className={"bms-time" + (String(x.id) === String(id) ? " on" : "")}
                  onClick={() => String(x.id) !== String(id) && navigate("/show/" + x.id)}
                >
                  {fmtTime12(x.start_time)}
                  <small>{x.format || "STANDARD"}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loadError && <p className="error">{loadError}</p>}



      {!hold && (

        <>

          {qtyOpen && (
            <div className="qty-overlay sheet-mode" onClick={() => setQtyOpen(false)}>
              <div className="qty-modal" onClick={(e) => e.stopPropagation()}>
                <i className="grab" />
                <h2>How many seats?</h2>
                <div className="qty-grid">
                  {Array.from({ length: MAX_SEATS }, (_, n) => n + 1).map((n) => (
                    <button type="button" key={n} className={qtyDraft === n ? "on" : ""} onClick={() => setQtyDraft(n)}>
                      {n}
                    </button>
                  ))}
                </div>
                {show?.class_prices && (
                  <div className="qty-classes">
                    {Object.entries(show.class_prices).map(([name, price]) => (
                      <div key={name}>
                        <small>{name.toUpperCase()} ROWS</small>
                        <b>₹{price}</b>
                        <em>AVAILABLE</em>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="qty-go" onClick={confirmQty}>
                  Select Seats
                </button>
              </div>
            </div>
          )}

          {seatMsg && <p className="notice">{seatMsg}</p>}
          {liveNote && !seatMsg && <p className="notice">{liveNote}</p>}
          {seats.length > 0 && (seats.every((x) => x.status !== "AVAILABLE") || (wait && wait.onWaitlist)) && (
            <div className="wait-card">
              <b>{wait && wait.onWaitlist ? "You're on the waitlist ✓" : "This show is sold out"}</b>
              <p>
                {wait && wait.onWaitlist
                  ? "We'll notify you in the app and by email as soon as " + wait.seats + " seat" + (wait.seats === 1 ? "" : "s") + " open up."
                  : "Get notified if seats open up (cancellations or unpaid holds)."}
              </p>
              {!(wait && wait.onWaitlist) && (
                <div className="wait-qty">
                  <span>Seats</span>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button type="button" key={n} className={waitQty === n ? "on" : ""} onClick={() => setWaitQty(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="wait-btn" disabled={waitBusy} onClick={toggleWait}>
                {wait && wait.onWaitlist ? "Leave waitlist" : "Notify me"}
              </button>
            </div>
          )}


          {seats.some((x) => x.status === "AVAILABLE") && (
            <div className="seat-tools">
              <button type="button" className="st-pick" disabled={!!picking} onClick={() => autoPick("view")}>
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" fill="currentColor" /></svg>
                {picking === "view" ? "Finding…" : "Best seats"}
              </button>
              <button type="button" className="st-pick alt" disabled={!!picking} onClick={() => autoPick("value")}>
                {picking === "value" ? "Finding…" : "Best value"}
              </button>
              <button type="button" className={"st-heat" + (showHeat ? " on" : "")} onClick={() => setShowHeat((v) => !v)}>
                <i className="st-dot" />
                View quality
              </button>
            {qty ? <p className="seat-hint">Tip: press a seat, hold, then slide along the row to move your group.</p> : null}
            </div>
          )}
          {pickNote && selected.length > 0 && (
            <div className="pick-note">
              <div className="pn-top">
                <b>{pickNote.label}</b>
                <span className="pn-score">
                  <i style={{ width: pickNote.score + "%" }} />
                </span>
                <em>{pickNote.score}/100</em>
              </div>
              <ul>
                {pickNote.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {pickNote.alternatives && pickNote.alternatives.length > 0 && (
                <div className="pn-alts">
                  <small>Or sit in</small>
                  {pickNote.alternatives.map((alt) => (
                    <button
                      type="button"
                      key={alt.join()}
                      onClick={() => {
                        setSelected(alt);
                        setPickNote(null);
                        showPicked(alt);
                      }}
                    >
                      Row {alt[0].charAt(0)} · {alt[0]}{alt.length > 1 ? "–" + alt[alt.length - 1] : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seat map: rows are grouped into the seat classes. Zoom scales seat size; it scrolls when larger than the screen. */}
          <div className="seat-zoom" ref={zoomRef} onTouchStart={onPinchStart} onTouchMove={onPinchMove} onTouchEnd={onPinchEnd} onTouchCancel={onPinchEnd}>
          <div className={"seat-map" + (showHeat && heat ? " heat" : "")} style={{ "--z": zoom }}>
            {sections.map((section) => (
              <div className="seat-class" key={section.label}>
                <div className="seat-class-title">{section.label}{classPrices[section.label] != null ? " · ₹" + classPrices[section.label] : ""}</div>
                {section.rows.map((letter) => (
                  <div className="seat-row" key={letter}>
                    <span className="seat-row-label">{letter}</span>
                    <div className="seat-row-seats">
                      {rowMap[letter].map((seat, idx) => (
                        <button
                          className={
                            (selected.includes(seat.seat_number) ? "selected" + (flash ? " pulse" : "") : seat.status.toLowerCase() + (bestSet.has(seat.seat_number) && !showHeat ? " best" : "")) +
                            ((idx + 1) % 5 === 0 && idx < rowMap[letter].length - 1 ? " aisle" : "")
                          }
                          title={seat.seat_number}
                          data-seat={seat.seat_number}
                          style={showHeat && heat && heat[seat.seat_number] != null ? { "--q": heat[seat.seat_number] } : undefined}
                          onClick={() => selectSeat(seat)}
                          key={seat.id}
                        >
                          {selected.includes(seat.seat_number) ? "✓" : seat.seat_number.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>

          {/* SCREEN is kept below the seats as requested. */}
          <div className="screen">SCREEN</div>
          {showHeat && heat && (
            <div className="heat-legend">
              <small>Weaker view</small>
              <i />
              <small>Best view</small>
            </div>
          )}
          <div className="seat-legend">
            <span>
              <i className="lg best" />
              Bestseller
            </span>
            <span>
              <i className="lg available" />
              Available
            </span>
            <span>
              <i className="lg selected" />
              Selected
            </span>
            <span>
              <i className="lg booked" />
              Sold
            </span>
          </div>

          {selected.length > 0 && (

            <div className="card contact-details">

              <h2>Booking details</h2>

              <p className="hint">Your ticket (PDF) is emailed here automatically once payment is confirmed.</p>

              <input

                type="email"

                placeholder="Email for ticket"

                required

                value={contactEmail}

                onChange={(e) => setContactEmail(e.target.value)}

              />

              <input

                type="tel"

                placeholder="Phone number (optional)"

                value={contactPhone}

                onChange={(e) => setContactPhone(e.target.value)}

              />

              {foodMenu.length > 0 && (
                <>
                  <h3 className="offers-title">Grab a bite</h3>
                  <div className="food-list">
                    {foodMenu.map((f) => {
                      const q = foodQty[f.id] || 0;
                      return (
                        <div className="food-row" key={f.id}>
                          <span className={"food-dot " + (f.veg ? "veg" : "nonveg")} />
                          <div>
                            <b>{f.name}</b>
                            <small>{f.description}</small>
                            <em>₹{Number(f.price).toFixed(0)}</em>
                          </div>
                          {q === 0 ? (
                            <button type="button" className="food-add" onClick={() => setFoodQty({ ...foodQty, [f.id]: 1 })}>ADD</button>
                          ) : (
                            <span className="food-step">
                              <button type="button" onClick={() => setFoodQty({ ...foodQty, [f.id]: q - 1 })}>−</button>
                              {q}
                              <button type="button" onClick={() => setFoodQty({ ...foodQty, [f.id]: Math.min(q + 1, 10) })}>+</button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <h3 className="offers-title">Offers</h3>
              <input
                type="text"
                placeholder="Have a coupon code?"
                value={couponCode}
                autoCapitalize="characters"
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              {offers.length > 0 && (
                <div className="offer-list">
                  {offers.map((o) => (
                    <button
                      type="button"
                      key={o.code}
                      className={"offer-chip" + (couponCode === o.code ? " on" : "")}
                      onClick={() => setCouponCode(couponCode === o.code ? "" : o.code)}
                    >
                      <b>{o.code}</b>
                      <small>{o.description}</small>
                    </button>
                  ))}
                </div>
              )}

            </div>

          )}



          {slow && (

            <p className="notice">

              Still working — the server may be waking up from idle, this can take up to a minute.

            </p>

          )}



          <div className="bar">

            <b>{selected.length ? selected.join(", ") + " · ₹" + selectedTotal : qty ? "Select " + qty + (qty === 1 ? " seat" : " seats") : "Choose tickets"}</b>

            <button disabled={!qty || selected.length !== qty || pending} onClick={reviewBooking}>

              {pending ? "Please wait..." : "Review Booking"}

            </button>

          </div>

        </>

      )}



      {hold && (

        <div className="card confirm-booking">

          <h2>Confirm booking</h2>

          {secsLeft != null && (
            <div className={"hold-timer ring" + (secsLeft <= 60 ? " low" : "")}>
              <svg viewBox="0 0 44 44" width="46" height="46" aria-hidden="true">
                <circle cx="22" cy="22" r="18" className="hr-track" />
                <circle
                  cx="22" cy="22" r="18" className="hr-arc"
                  strokeDasharray="113.1"
                  strokeDashoffset={113.1 * (1 - Math.min(1, secsLeft / 600))}
                />
              </svg>
              <span>
                Seats held for you. Complete payment in{" "}
                <b>
                  {String(Math.floor(secsLeft / 60)).padStart(2, "0")}:{String(secsLeft % 60).padStart(2, "0")}
                </b>
              </span>
            </div>
          )}

          <p>

            {show?.movie_title} · Seats: <b>{selected.join(", ")}</b>

          </p>

          <div className="fare-row">

            <span>Ticket Price</span>

            <span>₹{hold.ticketSubtotal.toFixed(2)}</span>

          </div>

          {hold.foodAmount > 0 && (
            <div className="fare-row">
              <span>Food &amp; beverages</span>
              <span>₹{hold.foodAmount.toFixed(2)}</span>
            </div>
          )}

          {hold.discount > 0 && (
            <div className="fare-row fare-discount">
              <span>Coupon {hold.couponCode}</span>
              <span>−₹{hold.discount.toFixed(2)}</span>
            </div>
          )}

          <div className="fare-row">

            <span>Convenience Fee</span>

            <span>₹{hold.convenienceFee.toFixed(2)}</span>

          </div>

          <div className="fare-row">

            <span>GST (18% on fee)</span>

            <span>₹{hold.gst.toFixed(2)}</span>

          </div>

          <div className="fare-row fare-total">

            <span>Total</span>

            <span>₹{hold.amount.toFixed(2)}</span>

          </div>

          <p className="hint">Sending ticket to: {contactEmail}{contactPhone ? " · " + contactPhone : ""}</p>

          {slow && (

            <p className="notice">

              Still working — the server may be waking up from idle, this can take up to a minute.

            </p>

          )}

          {walletBal !== null && (
            <label className={"wallet-pay" + (walletBal < hold.amount ? " low" : "")}>
              <input
                type="checkbox"
                checked={useWallet}
                disabled={walletBal < hold.amount}
                onChange={(e) => setUseWallet(e.target.checked)}
              />
              <span>
                Pay with Wallet <b>₹{walletBal.toFixed(2)}</b>
                {walletBal < hold.amount && <small> · not enough balance, <Link to="/wallet">add money</Link></small>}
              </span>
            </label>
          )}

          <div className="bar">

            <button className="ghost" disabled={pending} onClick={() => setHold(null)}>

              Back

            </button>

            <button disabled={pending} onClick={confirmAndPay}>

              {pending ? "Please wait..." : "Pay ₹" + hold.amount.toFixed(2)}

            </button>

          </div>

        </div>

      )}

    </>

  );

}
