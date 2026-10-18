import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, currentUser, logout } from "../api";

// Forgot password (signed out) and Change password (signed in, ?change=1): both email a 6-digit code first.
export default function Forgot() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const change = params.get("change") === "1";
  const user = currentUser();
  const [email, setEmail] = useState(change && user ? user.email : "");
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e) {
    e && e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const r = await api.post("/auth/forgot", { email });
      setMsg(r.data.message);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e) {
    e.preventDefault();
    setError("");
    if (pw.length < 6) return setError("Password must be at least 6 characters");
    if (pw !== pw2) return setError("The two passwords do not match");
    setBusy(true);
    try {
      await api.post("/auth/reset", { email, otp, newPassword: pw });
      if (user) logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <b>book<i>my</i>show</b>
        <span>{change ? "Change your password" : "Reset your password"}</span>
      </div>
      <div className="auth card">
        <h2>{change ? "Change password" : "Forgot password"}</h2>
        {step === 1 ? (
          <form onSubmit={sendCode}>
            <input placeholder="Email" type="email" required value={email} readOnly={change && !!user} onChange={(e) => setEmail(e.target.value)} />
            <button disabled={busy}>{busy ? "Sending..." : "Send code to my email"}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            {msg && <p className="notice">{msg}</p>}
            <input placeholder="6-digit code" inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            <input placeholder="New password" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            <input placeholder="Confirm new password" type="password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
            <button disabled={busy}>{busy ? "Please wait..." : "Update password"}</button>
            <p className="auth-links">
              <a href="#resend" onClick={(e) => { e.preventDefault(); sendCode(); }}>Send the code again</a>
            </p>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        <p className="auth-links">
          {change ? <Link to="/profile">Back to profile</Link> : <Link to="/login">Back to login</Link>}
        </p>
      </div>
    </div>
  );
}
