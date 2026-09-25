import { useEffect, useState } from "react";
import { api } from "../api";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);

  function load() {
    api.get("/bookings/me").then((res) => setBookings(res.data));
  }

  useEffect(load, []);

  async function cancel(id) {
    try {
      await api.post("/bookings/" + id + "/cancel");
      load();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  }

  return (
    <>
      <h1>My Bookings</h1>
      {bookings.map((b) => (
        <div className="card booking" key={b.id}>
          <h3>{b.reference}</h3>
          <p>
            {b.title} · {b.theatre_name}
          </p>
          <p>
            {b.show_date} · {b.start_time.slice(0, 5)} · Seats: {b.seats}
          </p>
          <b>
            ₹{b.amount} · {b.status}
          </b>
          {b.status === "CONFIRMED" && (
            <button className="ghost" onClick={() => cancel(b.id)}>
              Cancel booking
            </button>
          )}
        </div>
      ))}
    </>
  );
}
