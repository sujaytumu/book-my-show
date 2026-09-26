import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

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
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState(null); // "mock" | "razorpay" | null (unknown yet)
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
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

  async function pay() {
    if (!localStorage.getItem("token")) return navigate("/login");
    setPending(true);
    try {
      const hold = await api.post("/bookings/hold", { showId: +id, seatNumbers: selected });

      if (mode === "mock") {
        await api.post("/payments/mock-confirm/" + hold.data.bookingId);
        alert("Payment simulated (no live gateway configured yet) — booking confirmed!");
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
          alert("Payment successful!");
          navigate("/bookings");
        },
      }).open();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1>Select Seats</h1>
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
    </>
  );
}
