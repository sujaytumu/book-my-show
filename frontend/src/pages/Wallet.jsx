import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, currentUser } from "../api";
import { IcBack } from "../components/Icons";

const KIND = { TOPUP: "Money added", PAYMENT: "Booking payment", REFUND: "Refund" };

export default function Wallet() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const user = currentUser();

  useEffect(() => {
    if (!user) return;
    api.get("/bookings/wallet").then((r) => setData(r.data)).catch(() => setMsg("Could not load your wallet"));
  }, [user]);

  async function add(value) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.post("/bookings/wallet/add", { amount: Number(value) });
      setData(r.data);
      setAmt("");
      setMsg("₹" + Number(value) + " added to your wallet");
    } catch (e) {
      setMsg(e.response?.data?.message || "Could not add money");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="of-page">
      <div className="ml-top">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Wallet</h1>
        </div>
      </div>
      {!user ? (
        <div className="nt-empty">
          <b>Login to use your wallet</b>
          <Link to="/login">Login</Link>
        </div>
      ) : (
        <>
          <div className="wl-balance">
            <small>Wallet balance</small>
            <b>₹{data ? Number(data.balance).toFixed(2) : "—"}</b>
          </div>
          <div className="wl-add">
            <h3>Add money (demo)</h3>
            <div className="wl-chips">
              {[100, 500, 1000].map((v) => (
                <button type="button" key={v} disabled={busy} onClick={() => add(v)}>+ ₹{v}</button>
              ))}
            </div>
            <div className="wl-custom">
              <input type="number" min="1" max="10000" placeholder="Other amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <button type="button" disabled={busy || !amt} onClick={() => add(amt)}>Add</button>
            </div>
            {msg && <p className="wl-msg">{msg}</p>}
            <p className="wl-note">This is demo money for testing - no real payment is taken. Cancelled bookings are refunded here.</p>
          </div>
          <h3 className="wl-h">Recent activity</h3>
          {data && data.transactions.length === 0 && (
            <div className="nt-empty"><span>No transactions yet</span></div>
          )}
          {data && data.transactions.map((t, i) => (
            <div className="wl-tx" key={i}>
              <div>
                <b>{KIND[t.kind] || t.kind}</b>
                <small>{t.note} · {new Date(t.created_at).toLocaleDateString()}</small>
              </div>
              <span className={Number(t.amount) < 0 ? "neg" : "pos"}>
                {Number(t.amount) < 0 ? "−" : "+"}₹{Math.abs(Number(t.amount)).toFixed(2)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
