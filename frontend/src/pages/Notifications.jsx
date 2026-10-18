import { useEffect } from "react";
import { goBack } from "../nav";
import { Link, useNavigate } from "react-router-dom";
import { currentUser } from "../api";
import { IcBack } from "../components/Icons";
import { useNotifications } from "../notifications";

const ICON = { confirmed: "🎟", reminder: "⏰", cancelled: "✕" };

export default function Notifications() {
  const navigate = useNavigate();
  const { list, markSeen } = useNotifications();
  useEffect(() => {
    if (list.length) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);
  return (
    <div className="nt-page">
      <div className="ml-top">
        <button type="button" onClick={() => goBack(navigate)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Notifications</h1>
        </div>
      </div>
      {!currentUser() ? (
        <div className="nt-empty">
          <b>Login to see your notifications</b>
          <Link to="/login">Login</Link>
        </div>
      ) : list.length === 0 ? (
        <div className="nt-empty">
          <b>You're all caught up</b>
          <span>Booking confirmations and show reminders will show up here.</span>
        </div>
      ) : (
        list.map((n) => (
          <div className={"nt-item " + n.kind} key={n.id}>
            <i>{ICON[n.kind]}</i>
            <div>
              <b>{n.title}</b>
              <p>{n.text}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
