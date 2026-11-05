import { useState } from "react";
import { api } from "../api";

// Admin card: shows whether the server has Razorpay keys and whether Razorpay accepts them, so a bad key on Render
// is obvious here instead of the app quietly using the simulated payment.
export default function PaymentCheck() {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const r = await api.get("/admin/payments/check");
      setRes(r.data);
    } catch (e) {
      setRes(null);
      setErr((e && e.response && e.response.data && e.response.data.message) || "Could not run the check. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card paycheck">
      <h2>Payments check</h2>
      <p className="mbn-hint">Checks that the server has your Razorpay test keys and that Razorpay accepts them.</p>
      <button type="button" className="mbn-add" disabled={busy} onClick={run}>
        {busy ? "Checking…" : "Check Razorpay keys"}
      </button>
      {err && <div className="mbn-error">{err}</div>}
      {res && (
        <div className={"pc-result " + (res.ok ? "ok" : "bad")}>
          <b>{res.ok ? "Razorpay test checkout is working" : "Razorpay is not working yet"}</b>
          <p>{res.message}</p>
          <small>
            Key id: {res.keyIdSet ? res.keyIdHint : "not set"} · Secret: {res.secretSet ? "set" : "not set"} · Test key: {res.testKey ? "yes" : "no"} ·
            Webhook secret: {res.webhookSecretSet ? "set" : "not set"}
          </small>
        </div>
      )}
    </div>
  );
}
