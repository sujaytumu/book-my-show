import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Auth({ register = false }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);

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
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth card">
      <h2>{register ? "Create account" : "Login"}</h2>
      <form onSubmit={submit}>
        {register && <input placeholder="Name" required onChange={update("name")} />}
        <input placeholder="Email" type="email" required onChange={update("email")} />
        <input placeholder="Password" type="password" required onChange={update("password")} />
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
    </div>
  );
}
