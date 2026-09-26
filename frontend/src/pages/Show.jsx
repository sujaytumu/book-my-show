import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import TheatreMap, { haversineKm } from "../components/TheatreMap";

const MAX_SEATS = 10;

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
  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState(null); // "mock" | "razorpay" | null (unknown yet)
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [myLocation, setMyLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

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

  function findMe() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setLocationError("Location permission denied — enable it in your browser to see distance.")
    );
  }

  function toggleSeat(seat) {
    if (seat.status !== "AVAILABLE") return;
    setSelected((current) => {
      if (current.includes(seat.seat_number)) {
        return current.filter((s) => s !== seat.seat_number);
      }
      return current.length < MAX_SEATS ? [...current, seat.seat_number] : current;
    });
  }

  async function pay() {
    if (!localStorage.getItem("token")) return navigate("/login");
    setPending(true);
    try {
      const hold = await api.post("/bookings/hold", { showId: +id, seatNumbers: selected });

      if (mode === "mock") {
        await api.post("/payments/mock-confirm/" + hold.data.bookingId);
        alert("Payment simulated (no live gateway configured yet) — booking confirmed! Check your bookings to download the ticket.");
        navigate("/bookings");
        return;
      }

      const order = await api.post("/payments/create-order/" + hold.data.bookingId);
      await loadRazorpayScript();

      new window.Razorpay({
        key: order.data.keyId,
        amount: order.data.amount,
        currency: order.data.currency,
        name: "Book My Show",
        order_id: order.data.orderId,
        handler: async (response) => {
          await api.post("/payments/verify", {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          alert("Payment successful! Check your bookings to download the ticket.");
          navigate("/bookings");
        },
      }).open();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setPending(false);
    }
  }

  const distanceKm =
    show?.latitude != null && myLocation
      ? haversineKm(myLocation.lat, myLocation.lon, +show.latitude, +show.longitude).toFixed(1)
      : null;

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

      <div className="screen">SCREEN</div>
      <div className="seats">
        {seats.map((seat) => (
          <button
            className={selected.includes(seat.seat_number) ? "selected" : seat.status.toLowerCase()}
            onClick={() => toggleSeat(seat)}
            key={seat.id}
          >
            {seat.seat_number}
          </button>
        ))}
      </div>

      {slow && (
        <p className="notice">
          Still working — the server may be waking up from idle, this can take up to a minute.
        </p>
      )}

      <div className="bar">
        <b>{selected.length} seats selected</b>
        <button disabled={!selected.length || pending} onClick={pay}>
          {pending ? "Please wait..." : mode === "razorpay" ? "Pay with Razorpay" : "Pay & Confirm (Test Mode)"}
        </button>
      </div>

      {show?.latitude != null && (
        <div className="theatre-location card">
          <h2>Theatre location</h2>
          {distanceKm ? (
            <p>
              <b>{distanceKm} km</b> away from your current location.
            </p>
          ) : (
            <button className="ghost" onClick={findMe}>
              Show distance from me
            </button>
          )}
          {locationError && <p className="error">{locationError}</p>}
          <TheatreMap
            theatreLat={+show.latitude}
            theatreLon={+show.longitude}
            theatreName={show.theatre_name}
            myLocation={myLocation}
          />
        </div>
      )}
    </>
  );
}
