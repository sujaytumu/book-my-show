// import { useEffect, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { api, currentUser } from "../api";
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
//         navigate("/bookings");
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
//           navigate("/bookings");
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

import { useNavigate, useParams } from "react-router-dom";

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
  const [qty, setQty] = useState(null);
  const [qtyDraft, setQtyDraft] = useState(2);
  const [qtyOpen, setQtyOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const zoomValue = useRef(1);
  const zoomRef = useRef(null); // scroll container of the seat map
  const pinch = useRef(null); // { dist, zoom } while two fingers are down
  const anchor = useRef(null); // keeps the point between the fingers steady while zooming
  const [seatMsg, setSeatMsg] = useState("");



  useEffect(() => {

    api.get("/shows/" + id).then((res) => setShow(res.data));

    api

      .get("/shows/" + id + "/seats")

      .then((res) => setSeats(res.data))

      .catch(() => setLoadError("Could not load seats. The server may be waking up — try refreshing in a bit."));

    api.get("/payments/mode").then((res) => setMode(res.data.mode));

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

  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 2.4;

  function applyZoom(next, cx) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    setZoom((current) => {
      if (clamped !== current) anchor.current = { cx, ratio: clamped / current };
      return clamped;
    });
  }

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

  // Tap a seat -> select `qty` seats together in that row (starting at the tapped seat,
  // sliding left if there is no room on the right). Tap a selected seat again to clear.
  function selectSeat(seat) {
    if (seat.status !== "AVAILABLE") return;
    if (!qty) {
      setQtyOpen(true);
      return;
    }
    setSeatMsg("");
    if (selected.includes(seat.seat_number)) {
      setSelected([]);
      return;
    }
    const letter = seat.seat_number.charAt(0);
    const row = seats
      .filter((x) => x.seat_number.charAt(0) === letter)
      .sort((x, y) => parseInt(x.seat_number.slice(1), 10) - parseInt(y.seat_number.slice(1), 10));
    const idx = row.findIndex((x) => x.seat_number === seat.seat_number);
    for (let start = idx; start > idx - qty; start--) {
      if (start < 0 || start + qty > row.length) continue;
      const win = row.slice(start, start + qty);
      if (win.every((x) => x.status === "AVAILABLE")) {
        setSelected(win.map((x) => x.seat_number));
        return;
      }
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

      const res = await api.post("/bookings/hold", {

        showId: +id,

        seatNumbers: selected,

        contactEmail: contactEmail.trim(),

        contactPhone: contactPhone.trim() || null,

      });

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

      if (mode === "mock") {

        await api.post("/payments/mock-confirm/" + hold.bookingId);

        openTicketInNewTab(hold.bookingId);

        navigate("/bookings");

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

          navigate("/bookings");

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
  const selectedTotal = selected.reduce(
    (sum, sn) => sum + Number(classPrices[rowClass[sn.charAt(0)]] ?? show?.price ?? 0),
    0
  );

  return (

    <>

      {show && (

        <div className="show-header">

          <h1>{show.movie_title}</h1>

          <p>

            {show.theatre_name} / {show.screen_name} · {show.show_date} · {show.start_time?.slice(0, 5)} · from ₹{show.price}

          </p>

        </div>

      )}



      {loadError && <p className="error">{loadError}</p>}



      {!hold && (

        <>

          {qtyOpen && (
            <div className="qty-overlay" onClick={() => qty && setQtyOpen(false)}>
              <div className="qty-modal" onClick={(e) => e.stopPropagation()}>
                <h2>How many seats?</h2>
                <div className="qty-grid">
                  {Array.from({ length: MAX_SEATS }, (_, n) => n + 1).map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={qtyDraft === n ? "on" : ""}
                      onClick={() => setQtyDraft(n)}
                    >
                      {n}
                      {qtyDraft === n && <i className="tick">✓</i>}
                    </button>
                  ))}
                </div>
                {show?.class_prices && (
                  <p className="hint">
                    ₹{Math.min(...Object.values(show.class_prices))} – ₹{Math.max(...Object.values(show.class_prices))} per ticket, depending on the class
                  </p>
                )}
                <button type="button" className="qty-go" onClick={confirmQty}>
                  Select Seats
                </button>
              </div>
            </div>
          )}

          <div className="seat-toolbar">
            <button
              type="button"
              className="qty-chip"
              onClick={() => {
                setQtyDraft(qty || 2);
                setQtyOpen(true);
              }}
            >
              🎟 {qty || "–"} {qty === 1 ? "Ticket" : "Tickets"} ✎
            </button>
          </div>
          {seatMsg && <p className="notice">{seatMsg}</p>}

          {/* Seat map: rows are grouped into the seat classes. Zoom scales seat size; it scrolls when larger than the screen. */}
          <div className="seat-zoom" ref={zoomRef} onTouchStart={onPinchStart} onTouchMove={onPinchMove} onTouchEnd={onPinchEnd} onTouchCancel={onPinchEnd}>
          <div className="seat-map" style={{ "--z": zoom }}>
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
                            (selected.includes(seat.seat_number) ? "selected" : seat.status.toLowerCase()) +
                            (rowMap[letter].length > 5 && idx === 4 ? " aisle" : "")
                          }
                          title={seat.seat_number}
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
          <div className="seat-legend">
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

          <p>

            {show?.movie_title} · Seats: <b>{selected.join(", ")}</b>

          </p>

          <div className="fare-row">

            <span>Ticket Price</span>

            <span>₹{hold.ticketSubtotal.toFixed(2)}</span>

          </div>

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

          <div className="bar">

            <button className="ghost" disabled={pending} onClick={() => setHold(null)}>

              Back

            </button>

            <button disabled={pending} onClick={confirmAndPay}>

              {pending ? "Please wait..." : mode === "razorpay" ? "Pay with Razorpay" : "Pay & Confirm (Test Mode)"}

            </button>

          </div>

        </div>

      )}

    </>

  );

}
