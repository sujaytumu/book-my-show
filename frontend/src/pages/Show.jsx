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



import { useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { api, currentUser } from "../api";

const MAX_SEATS = 10;



//a) addn



// Row letters run top (back of the hall) to bottom (nearest the screen):

// first 2 rows Recliner, next 2 Balcony, next Second Class, the rest Dress Class.

function seatClassFor(index) {

  if (index < 2) return "Recliner";

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



  function toggleSeat(seat) {

    if (seat.status !== "AVAILABLE") return;

    setSelected((current) => {

      if (current.includes(seat.seat_number)) {

        return current.filter((s) => s !== seat.seat_number);

      }

      return current.length < MAX_SEATS ? [...current, seat.seat_number] : current;

    });

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

  return (

    <>

      {show && (

        <div className="show-header">

          <h1>{show.movie_title}</h1>

          <p>

            {show.theatre_name} / {show.screen_name} · {show.show_date} · {show.start_time?.slice(0, 5)} · ₹{show.price}

          </p>

        </div>

      )}



      {loadError && <p className="error">{loadError}</p>}



      {!hold && (

        <>

          {/* Seat map: rows are grouped into the requested seat classes. */}
          <div className="seat-map">
            {sections.map((section) => (
              <div className="seat-class" key={section.label}>
                <div className="seat-class-title">{section.label}</div>
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
                          onClick={() => toggleSeat(seat)}
                          key={seat.id}
                        >
                          {seat.seat_number.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
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

            <b>{selected.length} seats selected</b>

            <button disabled={!selected.length || pending} onClick={reviewBooking}>

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
