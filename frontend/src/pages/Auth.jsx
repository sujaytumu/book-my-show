import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Auth({ register = false }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/" + (register ? "register" : "login"), form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Request failed");
    }
  }

  return (
    <div className="auth card">
      <h2>{register ? "Create account" : "Login"}</h2>
      <form onSubmit={submit}>
        {register && <input placeholder="Name" required onChange={update("name")} />}
        <input placeholder="Email" type="email" required onChange={update("email")} />
        <input placeholder="Password" type="password" required onChange={update("password")} />
        <button>{register ? "Register" : "Login"}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
