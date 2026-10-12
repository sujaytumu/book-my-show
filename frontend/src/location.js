// City selection + real location detection.
const KEY = "bms_city";
const ASKED = "bms_loc_asked";

export const POPULAR = ["Mumbai", "Delhi-NCR", "Bengaluru", "Hyderabad", "Chandigarh", "Ahmedabad", "Pune", "Chennai", "Kolkata", "Kochi"];

// [name, lat, lng] - used to snap a GPS fix to the nearest city.
const GEO = [
  ["Mumbai", 19.076, 72.8777], ["Delhi-NCR", 28.6139, 77.209], ["Bengaluru", 12.9716, 77.5946], ["Hyderabad", 17.385, 78.4867],
  ["Chandigarh", 30.7333, 76.7794], ["Ahmedabad", 23.0225, 72.5714], ["Pune", 18.5204, 73.8567], ["Chennai", 13.0827, 80.2707],
  ["Kolkata", 22.5726, 88.3639], ["Kochi", 9.9312, 76.2673], ["Visakhapatnam", 17.6868, 83.2185], ["Vijayawada", 16.5062, 80.648],
  ["Guntur", 16.3067, 80.4365], ["Tirupati", 13.6288, 79.4192], ["Warangal", 17.9689, 79.5941], ["Karimnagar", 18.4386, 79.1288],
  ["Nizamabad", 18.6725, 78.0941], ["Khammam", 17.2473, 80.1514], ["Nellore", 14.4426, 79.9865], ["Kurnool", 15.8281, 78.0373],
  ["Rajahmundry", 17.0005, 81.804], ["Kakinada", 16.9891, 82.2475], ["Anantapur", 14.6819, 77.6006], ["Kadapa", 14.4673, 78.8242],
  ["Eluru", 16.7107, 81.0952], ["Ongole", 15.5057, 80.0499], ["Mysuru", 12.2958, 76.6394], ["Mangaluru", 12.9141, 74.856],
  ["Hubballi", 15.3647, 75.124], ["Belagavi", 15.8497, 74.4977], ["Coimbatore", 11.0168, 76.9558], ["Madurai", 9.9252, 78.1198],
  ["Tiruchirappalli", 10.7905, 78.7047], ["Salem", 11.6643, 78.146], ["Tirunelveli", 8.7139, 77.7567], ["Vellore", 12.9165, 79.1325],
  ["Thiruvananthapuram", 8.5241, 76.9366], ["Kozhikode", 11.2588, 75.7804], ["Thrissur", 10.5276, 76.2144], ["Kollam", 8.8932, 76.6141],
  ["Jaipur", 26.9124, 75.7873], ["Jodhpur", 26.2389, 73.0243], ["Udaipur", 24.5854, 73.7125], ["Lucknow", 26.8467, 80.9462],
  ["Kanpur", 26.4499, 80.3319], ["Varanasi", 25.3176, 82.9739], ["Agra", 27.1767, 78.0081], ["Prayagraj", 25.4358, 81.8463],
  ["Patna", 25.5941, 85.1376], ["Ranchi", 23.3441, 85.3096], ["Bhubaneswar", 20.2961, 85.8245], ["Cuttack", 20.4625, 85.883],
  ["Guwahati", 26.1445, 91.7362], ["Bhopal", 23.2599, 77.4126], ["Indore", 22.7196, 75.8577], ["Nagpur", 21.1458, 79.0882],
  ["Nashik", 19.9975, 73.7898], ["Aurangabad", 19.8762, 75.3433], ["Surat", 21.1702, 72.8311], ["Vadodara", 22.3072, 73.1812],
  ["Rajkot", 22.3039, 70.8022], ["Dehradun", 30.3165, 78.0322], ["Amritsar", 31.634, 74.8723], ["Ludhiana", 30.901, 75.8573],
  ["Jalandhar", 31.326, 75.5762], ["Gurugram", 28.4595, 77.0266], ["Noida", 28.5355, 77.391], ["Ghaziabad", 28.6692, 77.4538],
  ["Faridabad", 28.4089, 77.3178], ["Thane", 19.2183, 72.9781], ["Navi Mumbai", 19.033, 73.0297], ["Goa", 15.4909, 73.8278],
  ["Puducherry", 11.9416, 79.8083], ["Raipur", 21.2514, 81.6296], ["Jabalpur", 23.1815, 79.9864], ["Gwalior", 26.2183, 78.1828],
  ["Jammu", 32.7266, 74.857], ["Srinagar", 34.0837, 74.7973], ["Shimla", 31.1048, 77.1734], ["Siliguri", 26.7271, 88.3953],
  ["Ajmer", 26.4499, 74.6399], ["Allahabad", 25.4358, 81.8463], ["Ambala", 30.3782, 76.7767], ["Asansol", 23.6739, 86.9524],
  ["Bhilai", 21.2094, 81.4285], ["Bikaner", 28.0229, 73.3119], ["Bokaro", 23.6693, 86.1511], ["Durgapur", 23.5204, 87.3119],
  ["Erode", 11.341, 77.7172], ["Gandhinagar", 23.2156, 72.6369], ["Haridwar", 29.9457, 78.1642], ["Jamshedpur", 22.8046, 86.2029],
  ["Kolhapur", 16.705, 74.2433], ["Kota", 25.2138, 75.8648], ["Ludhiana", 30.901, 75.8573], ["Moradabad", 28.8386, 78.7733],
  ["Panaji", 15.4909, 73.8278], ["Rourkela", 22.2604, 84.8536], ["Sangli", 16.8524, 74.5815], ["Solapur", 17.6599, 75.9064],
  ["Thanjavur", 10.787, 79.1378], ["Udupi", 13.3409, 74.7421], ["Ujjain", 23.1765, 75.7885], ["Vasai-Virar", 19.4259, 72.8225],
  ["Darsi", 15.7728, 79.6783],
  ["Mathura", 27.4924, 77.6737], ["Meerut", 28.9845, 77.7064], ["Bareilly", 28.367, 79.4304], ["Gorakhpur", 26.7606, 83.3732],
];

const ALIASES = { vizag: "Visakhapatnam", vizianagaram: "Vizianagaram", bezawada: "Vijayawada", bangalore: "Bengaluru", delhi: "Delhi-NCR", bombay: "Mumbai", madras: "Chennai", calcutta: "Kolkata" };
export function aliasMatch(needle) {
  return Object.entries(ALIASES).filter(([k]) => k.startsWith(needle)).map(([, v]) => v);
}

export const ALL_CITIES = [...new Set(GEO.map((g) => g[0]))];
export const OTHER_CITIES = ALL_CITIES.filter((c) => !POPULAR.includes(c)).sort();

export function getCity() {
  try {
    return localStorage.getItem(KEY) || "Hyderabad";
  } catch {
    return "Hyderabad";
  }
}

export function setCity(name) {
  try {
    localStorage.setItem(KEY, name);
    localStorage.setItem(ASKED, "1");
  } catch {}
  window.dispatchEvent(new Event("bms-city"));
}

export function alreadyAsked() {
  try {
    return !!localStorage.getItem(ASKED);
  } catch {
    return true;
  }
}

export function markAsked() {
  try {
    localStorage.setItem(ASKED, "1");
  } catch {}
}

function km(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (c - a) * r, dLng = (d - b) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function nearestCity(lat, lng) {
  let best = null;
  GEO.forEach(([name, la, ln]) => {
    const d = km(lat, lng, la, ln);
    if (!best || d < best.d) best = { name, d };
  });
  return best;
}

// Ask the browser/phone for the real GPS position and resolve to a city name.
export function detectCity() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Your device doesn't support location."));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const near = nearestCity(latitude, longitude);
        if (near && near.d <= 60) return resolve(near.name);
        try {
          const r = await fetch(
            "https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=" + latitude + "&lon=" + longitude
          );
          const j = await r.json();
          const a = j.address || {};
          const name = a.city || a.town || a.village || a.county || a.state_district;
          if (name) return resolve(name);
        } catch {}
        resolve(near ? near.name : "Hyderabad");
      },
      (err) =>
        reject(new Error(err.code === 1 ? "Location permission was denied. Pick your city below." : "Couldn't get your location. Pick your city below.")),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
    );
  });
}
