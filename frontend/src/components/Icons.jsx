const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
export const IcHome = (p) => (<svg {...base} {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>);
export const IcSearch = (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.500-3.500" /></svg>);
export const IcTicket = (p) => (<svg {...base} {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M13 6v12" strokeDasharray="2 2" /></svg>);
export const IcUser = (p) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.500-7 8-7s8 3 8 7" /></svg>);
export const IcReel = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="7.500" r="1.600" /><circle cx="12" cy="16.500" r="1.600" /><circle cx="7.500" cy="12" r="1.600" /><circle cx="16.500" cy="12" r="1.600" /></svg>);
export const IcClap = (p) => (<svg {...base} {...p}><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M3 9l3-5 4 1-3 5M10 5l4 1-3 4M14 6l4 1-3 3" /></svg>);
export const IcFilm = (p) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.500v5l4-2.500z" /><path d="M3 9h2M3 15h2M19 9h2M19 15h2" /></svg>);
export const IcBack = (p) => (<svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>);
export const IcTarget = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.500" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>);
const cb = { viewBox: "0 0 44 44", width: 44, height: 44, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };
const CITY_ICONS = {
  // Gateway-style arch
  Mumbai: <><path d="M4 40V20h36v20M2 40h40" /><path d="M14 40V26a8 8 0 0 1 16 0v14" /><path d="M8 20v-5l3-2 3 2v5M30 20v-5l3-2 3 2v5M18 20v-4h8v4" /></>,
  // India Gate
  "Delhi-NCR": <><path d="M6 40V16h32v24M2 40h40" /><path d="M14 40V24a8 8 0 0 1 16 0v16" /><path d="M6 16l2-4h28l2 4M12 12V9h20v3" /><path d="M16 28h12M16 33h12" /></>,
  // Vidhana Soudha
  Bengaluru: <><path d="M4 40V26h36v14M2 40h40" /><path d="M16 26v-6h12v6M18 20v-5h8v5M22 15v-6M20 9h4" /><path d="M8 26v-4h4v4M32 26v-4h4v4M10 40v-8h4v8M30 40v-8h4v8M20 40v-8h4v8" /></>,
  // Charminar
  Hyderabad: <><path d="M6 40V20h32v20M2 40h40" /><path d="M6 20v-9M38 20v-9M4 11h4M36 11h4M6 8v3M38 8v3" /><path d="M18 40V28a4 4 0 0 1 8 0v12" /><path d="M6 26h32" /><path d="M14 20v-4h16v4" /></>,
  // Open Hand
  Chandigarh: <><path d="M12 40V30h20v10M6 40h32" /><path d="M16 30c-3-3-4-8-2-11 2 0 3 2 3 4l-1-9c1-2 3-1 3 1l1 6V10c1-2 3-1 3 1v8l2-6c1-1 3 0 2 2l-3 10c2 1 4 0 5-2l-1 8" /></>,
  // Sidi Saiyyed gate
  Ahmedabad: <><path d="M4 40V18h36v22M2 40h40" /><path d="M10 40V28a4 4 0 0 1 8 0v12M26 40V28a4 4 0 0 1 8 0v12" /><path d="M4 18l2-4h32l2 4M14 14v-4h16v4" /></>,
  // Shaniwar Wada gate
  Pune: <><path d="M4 40V22h36v18M2 40h40" /><path d="M16 40V28a6 6 0 0 1 12 0v12" /><path d="M4 22l3-6h30l3 6M10 16v-4M34 16v-4M22 16V9" /></>,
  // Gopuram
  Chennai: <><path d="M10 40V32h24v8M4 40h36" /><path d="M14 32v-6h16v6M17 26v-6h10v6M19.500 20v-5h5v5M22 15v-6" /><path d="M20 40v-5h4v5" /></>,
  // Victoria Memorial
  Kolkata: <><path d="M4 40V28h36v12M2 40h40" /><path d="M14 28v-5h16v5M18 23v-4h8v4" /><path d="M22 19c-4-1-5-4-5-6 2 0 4 1 5 2 1-1 3-2 5-2 0 2-1 5-5 6zM22 13V7" /><path d="M10 40V32h4v8M30 40V32h4v8M20 40v-8h4v8" /></>,
  // Chinese nets + palms
  Kochi: <><path d="M4 38c6 3 10 3 18 0s12-3 18 0" /><path d="M6 36c0-8 6-12 16-12s16 4 16 12" /><path d="M12 36v-6M18 36v-8M24 36v-8M30 36v-6" /><path d="M10 22c-4 0-6-3-6-5 3 0 5 1 6 3 0-4 2-7 4-8M34 22c4 0 6-3 6-5-3 0-5 1-6 3 0-4-2-7-4-8" /></>,
};
export const IcCity = ({ name, ...p }) => (
  <svg {...cb} {...p}>{CITY_ICONS[name] || CITY_ICONS.Hyderabad}</svg>
);
