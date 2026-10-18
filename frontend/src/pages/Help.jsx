import { useState } from "react";
import { goBack } from "../nav";
import { useNavigate } from "react-router-dom";
import { IcBack } from "../components/Icons";

const FAQ = [
  ["How do I book tickets?", "Open a movie, tap Book tickets, choose a cinema and showtime, pick your seats and pay. Your ticket appears under Bookings."],
  ["How long are my seats held?", "Seats are held for 10 minutes once you review your booking. If the timer runs out, select the seats again."],
  ["Can I cancel a booking?", "Yes, from Bookings, unless the cinema is marked Non-cancellable. Cancelled seats are released straight away and the amount is refunded to your Wallet."],
  ["How do I change my show?", "Cancel the booking (if the cinema allows it) and use Book again on that ticket to pick a new showtime."],
  ["How do I use a coupon?", "Copy a code from the Offers page and enter it at the payment step. The discount shows in the price breakup."],
  ["I did not get my ticket", "Open Bookings and tap View ticket or Download ticket. The QR code works from the app."],
  ["Why are no cinemas shown?", "Check the city at the top of the home page. Only cities with listed cinemas show showtimes."],
];

export default function Help() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(0);
  return (
    <div className="of-page">
      <div className="ml-top">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Help &amp; support</h1>
        </div>
      </div>
      {FAQ.map(([q, a], i) => (
        <div className={"hp-item" + (open === i ? " on" : "")} key={q}>
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)}>
            {q}
            <i>{open === i ? "−" : "+"}</i>
          </button>
          {open === i && <p>{a}</p>}
        </div>
      ))}
    </div>
  );
}
