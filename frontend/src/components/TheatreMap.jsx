import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";

export { haversineKm } from "../geo";
const theatreIcon = L.divIcon({
  className: "map-pin theatre-pin",
  html: "🎬",
  iconSize: [28, 28],
});
const meIcon = L.divIcon({ className: "map-pin me-pin", html: "📍", iconSize: [24, 24] });

export default function TheatreMap({ theatreLat, theatreLon, theatreName, myLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || theatreLat == null || theatreLon == null) return;

    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([theatreLat, theatreLon], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.marker([theatreLat, theatreLon], { icon: theatreIcon }).addTo(map).bindPopup(theatreName || "Theatre");

    if (myLocation) {
      L.marker([myLocation.lat, myLocation.lon], { icon: meIcon }).addTo(map).bindPopup("You");
      L.polyline(
        [
          [theatreLat, theatreLon],
          [myLocation.lat, myLocation.lon],
        ],
        { color: "#f84464", weight: 2, dashArray: "6 6" }
      ).addTo(map);
      map.fitBounds([
        [theatreLat, theatreLon],
        [myLocation.lat, myLocation.lon],
      ], { padding: [30, 30] });
    }

    return () => map.remove();
  }, [theatreLat, theatreLon, theatreName, myLocation]);

  if (theatreLat == null || theatreLon == null) return null;
  return <div ref={containerRef} className="theatre-map" />;
}
