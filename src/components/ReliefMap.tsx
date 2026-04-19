import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { NGO, ReliefRequest } from "@/lib/reliefStore";

// Build colored circular DivIcons (no external image assets needed)
function makeIcon(color: string, pulse = false) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.35;animation:rl-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ""}
        <span style="position:relative;width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px hsl(220 26% 8%),0 0 12px ${color};"></span>
      </div>
      <style>@keyframes rl-ping{75%,100%{transform:scale(2.2);opacity:0}}</style>
    `,
  });
}

const icons = {
  high: makeIcon("hsl(0 84% 58%)", true),
  medium: makeIcon("hsl(38 95% 55%)", true),
  low: makeIcon("hsl(142 71% 45%)"),
  ngo: makeIcon("hsl(210 100% 56%)"),
  done: makeIcon("hsl(142 71% 45%)"),
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!points.length || fittedRef.current) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    fittedRef.current = true;
  }, [points, map]);
  return null;
}

export default function ReliefMap({
  requests,
  ngos,
  selectedId,
}: {
  requests: ReliefRequest[];
  ngos: NGO[];
  selectedId?: string | null;
}) {
  const points = useMemo<[number, number][]>(
    () => [
      ...requests.map((r) => [r.location.lat, r.location.lng] as [number, number]),
      ...ngos.map((n) => [n.location.lat, n.location.lng] as [number, number]),
    ],
    [requests, ngos]
  );

  const center: [number, number] = points[0] ?? [28.6139, 77.209];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full rounded-xl"
      style={{ minHeight: 320 }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />

      {ngos.map((n) => (
        <Marker key={n.id} position={[n.location.lat, n.location.lng]} icon={icons.ngo}>
          <Popup>
            <strong>{n.name}</strong>
            <br />
            Active: {n.active}/{n.capacity}
          </Popup>
        </Marker>
      ))}

      {requests.map((r) => {
        const icon =
          r.status === "completed"
            ? icons.done
            : r.priority === "high"
            ? icons.high
            : r.priority === "medium"
            ? icons.medium
            : icons.low;
        return (
          <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={icon}>
            <Popup>
              <strong style={{ textTransform: "capitalize" }}>{r.type}</strong> · {r.priority}
              <br />
              {r.description}
              <br />
              <em>Status: {r.status.replace("_", " ")}</em>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
