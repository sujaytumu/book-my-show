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
          <div className="booking-actions">
            {(b.status === "CONFIRMED" || b.status === "CANCELLED") && (
              <button className="ghost" onClick={() => downloadTicket(b.id, b.reference)}>
                Download ticket (PDF)
              </button>
            )}
            {b.status === "CONFIRMED" && (
              <button className="ghost" onClick={() => cancel(b.id)}>
                Cancel booking
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
