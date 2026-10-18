import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

const DEVICE_KEY = "bms_device";
function loadDevice() {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY) || "null");
  } catch {
    return null;
  }
}

export default function Auth({ register = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [device, setDevice] = useState(loadDevice);
  const [askSave, setAskSave] = useState(false); // "save login on this device?" prompt after a successful login

  const sessionExpired = searchParams.get("sessionExpired") === "1";

  // The API can take up to ~60-90s to respond if the free-tier backend has
  // spun down; after a few seconds let the user know that's what's
  // happening instead of leaving them staring at a plain disabled button.
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [pending]);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await api.post("/auth/" + (register ? "register" : "login"), form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data));
      const saved = loadDevice();
      if (saved && saved.email === String(form.email).toLowerCase()) {
        navigate("/", { replace: true });
      } else {
        setAskSave(true); // ask before leaving the page
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function saveLogin() {
    setPending(true);
    try {
      const r = await api.post("/auth/remember", { email: form.email, password: form.password });
      localStorage.setItem(DEVICE_KEY, JSON.stringify(r.data));
      // Also hand it to the browser's own password manager where supported.
      try {
        if (window.PasswordCredential && navigator.credentials) {
          await navigator.credentials.store(new window.PasswordCredential({ id: form.email, password: form.password, name: r.data.name }));
        }
      } catch {
        /* optional */
      }
    } catch {
      /* not saving is fine */
    }
    navigate("/", { replace: true });
  }

  async function oneTap() {
    setError("");
    setPending(true);
    try {
      const res = await api.post("/auth/device-login", { deviceToken: device.deviceToken });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data));
      navigate("/", { replace: true });
    } catch (err) {
      localStorage.removeItem(DEVICE_KEY);
      setDevice(null);
      setError(err.response?.data?.message || "Saved login expired. Please log in with your password.");
    } finally {
      setPending(false);
    }
  }

  function forgetThisDevice() {
    const d = device;
    localStorage.removeItem(DEVICE_KEY);
    setDevice(null);
    if (d && d.deviceToken) api.post("/auth/forget-device", { deviceToken: d.deviceToken }).catch(() => {});
  }

  if (askSave) {
    return (
      <div className="auth-wrap">
        <div className="auth-brand">
          <b>book<i>my</i>show</b>
        </div>
        <div className="auth card save-card">
          <h2>Save login on this device?</h2>
          <p className="save-note">Next time you can sign in with one tap, even after logging out. Your password is not stored on the phone.</p>
          <button disabled={pending} onClick={saveLogin}>{pending ? "Saving..." : "Save login"}</button>
          <button type="button" className="ghost-btn" disabled={pending} onClick={() => navigate("/", { replace: true })}>Not now</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
    <div className="auth-brand">
      <b>book<i>my</i>show</b>
      <span>{register ? "Create your account to start booking" : "Login to continue"}</span>
    </div>
    <div className="auth card">
      {!register && device && (
        <div className="one-tap">
          <span className="ot-av">{String(device.name || "?").charAt(0).toUpperCase()}</span>
          <div>
            <b>{device.name}</b>
            <small>{device.email}</small>
          </div>
          <button type="button" disabled={pending} onClick={oneTap}>{pending ? "..." : "Continue"}</button>
        </div>
      )}
      {!register && device && <p className="auth-links"><a href="#other" onClick={(e) => { e.preventDefault(); forgetThisDevice(); }}>Use a different account</a></p>}
      <h2>{register ? "Create account" : "Login"}</h2>
      {sessionExpired && !register && (
        <p className="notice">Your session has expired. Please log in again.</p>
      )}
      <form onSubmit={submit}>
        {register && <input placeholder="Name" required onChange={update("name")} />}
        <input placeholder="Email" type="email" name="email" autoComplete="username" required onChange={update("email")} />
        <input placeholder="Password" type="password" name="password" autoComplete={register ? "new-password" : "current-password"} required onChange={update("password")} />
        <button disabled={pending}>
          {pending ? "Please wait..." : register ? "Register" : "Login"}
        </button>
      </form>
      {slow && (
        <p className="notice">
          Still working — the server may be waking up from idle, this can take up to a minute.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {!register && (
        <p className="auth-links">
          <Link to="/forgot">Forgot password?</Link>
        </p>
      )}
      <p className="auth-links">
        {register ? (
          <>Already have an account? <Link to="/login">Login</Link></>
        ) : (
          <>New here? <Link to="/register">Create an account</Link></>
        )}
      </p>
    </div>
    </div>
  );
}
