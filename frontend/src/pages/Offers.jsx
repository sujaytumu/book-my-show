import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { IcBack } from "../components/Icons";

export default function Offers() {
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    api.get("/coupons").then((r) => setList(r.data)).catch(() => setList([]));
  }, []);
  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      window.prompt("Copy this code:", code);
    }
    setCopied(code);
    setTimeout(() => setCopied(""), 1800);
  }
  return (
    <div className="of-page">
      <div className="ml-top">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <IcBack width={26} height={26} />
        </button>
        <div>
          <h1>Offers</h1>
        </div>
      </div>
      <p className="of-hint">Copy a code, then paste it at the payment step on the seat page.</p>
      {list === null && <div className="nt-empty"><span>Loading offers…</span></div>}
      {list && list.length === 0 && (
        <div className="nt-empty">
          <b>No offers right now</b>
          <span>Check back soon.</span>
        </div>
      )}
      {list && list.map((c) => (
        <div className="of-card" key={c.code}>
          <div>
            <b className="of-code">{c.code}</b>
            <p>{c.description}</p>
          </div>
          <button type="button" onClick={() => copy(c.code)}>{copied === c.code ? "Copied ✓" : "Copy code"}</button>
        </div>
      ))}
    </div>
  );
}
