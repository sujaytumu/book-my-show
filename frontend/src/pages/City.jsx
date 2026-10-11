import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IcBack, IcCity, IcSearch, IcTarget } from "../components/Icons";
import { ALL_CITIES, OTHER_CITIES, POPULAR, detectCity, getCity, setCity } from "../location";

export default function City() {
  const navigate = useNavigate();
  const current = getCity();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function choose(name) {
    setCity(name);
    navigate("/", { replace: true });
  }

  async function auto() {
    setBusy(true);
    setMsg("");
    try {
      choose(await detectCity());
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const found = needle ? ALL_CITIES.filter((c) => c.toLowerCase().includes(needle)).sort() : null;

  return (
    <div className="city-page">
      <div className="cp-top">
        <button type="button" className="cp-back" onClick={() => navigate(-1)} aria-label="Back">
          <IcBack />
        </button>
        <h1>{current}</h1>
      </div>
      <label className="cp-search">
        <IcSearch width={20} height={20} />
        <input placeholder="Search for your city" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <button type="button" className="cp-auto" onClick={auto} disabled={busy}>
        <IcTarget width={24} height={24} />
        {busy ? "Detecting your location…" : "Auto Detect My Location"}
      </button>
      {msg && <p className="cp-msg">{msg}</p>}

      {found ? (
        <ul className="cp-list">
          {found.length === 0 && <li className="cp-empty">No city found</li>}
          {found.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => choose(c)}>{c}</button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <h2 className="cp-h">POPULAR CITIES</h2>
          <div className="cp-grid">
            {POPULAR.map((c) => (
              <button type="button" key={c} className={c === current ? "on" : ""} onClick={() => choose(c)}>
                <IcCity name={c} />
                <span>
                  {c === current && <i className="cp-dot" />}
                  {c}
                </span>
              </button>
            ))}
            {Array.from({ length: (4 - (POPULAR.length % 4)) % 4 }, (_, k) => (
              <div key={"e" + k} className="cp-empty-cell" />
            ))}
          </div>
          <h2 className="cp-h">OTHER CITIES</h2>
          <ul className="cp-list">
            {OTHER_CITIES.map((c) => (
              <li key={c}>
                <button type="button" onClick={() => choose(c)}>{c}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
