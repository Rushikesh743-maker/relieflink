import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Circle, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import type { NGO, ReliefRequest } from "@/lib/reliefStore";
import type { DisasterEvent } from "@/lib/simulationEngine";

function divIcon(color: string, pulse = false, label?: string) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        ${pulse ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.3;animation:rl-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ""}
        <span style="position:relative;width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px hsl(220 26% 8%),0 0 12px ${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;">${label ?? ""}</span>
      </div>
      <style>@keyframes rl-ping{75%,100%{transform:scale(2.4);opacity:0}}</style>
    `,
  });
}

const ICONS = {
  ngo: divIcon("hsl(210 100% 56%)", false, "N"),
  done: divIcon("hsl(142 71% 45%)"),
  high: divIcon("hsl(0 84% 58%)", true),
  medium: divIcon("hsl(38 95% 55%)", true),
  low: divIcon("hsl(142 71% 45%)"),
};

const FIRE_COLOR = "hsl(15 95% 55%)";
const FLOOD_COLOR = "hsl(210 100% 56%)";
const QUAKE_COLOR = "hsl(280 80% 60%)";

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  useEffect(() => {
    // @ts-expect-error - leaflet.heat augments L
    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 14,
      max: 1,
      gradient: {
        0.2: "rgba(56,189,248,0.5)",
        0.4: "rgba(250,204,21,0.7)",
        0.65: "rgba(249,115,22,0.85)",
        1.0: "rgba(239,68,68,1)",
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  useEffect(() => {
    if (layerRef.current) {
      // @ts-expect-error setLatLngs exists on heatLayer
      layerRef.current.setLatLngs(points);
    }
  }, [points]);
  return null;
}

function FitOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
    fitted.current = true;
  }, [points, map]);
  return null;
}

export default function SimulationMap({
  requests, ngos, events, showHeatmap,
}: {
  requests: ReliefRequest[];
  ngos: NGO[];
  events: DisasterEvent[];
  showHeatmap: boolean;
}) {
  const heatPoints = useMemo<[number, number, number][]>(
    () =>
      requests
        .filter((r) => r.status !== "completed")
        .map((r) => {
          const w = r.priority === "high" ? 1 : r.priority === "medium" ? 0.6 : 0.3;
          return [r.location.lat, r.location.lng, w] as [number, number, number];
        }),
    [requests]
  );

  const allPoints = useMemo<[number, number][]>(
    () => [
      ...requests.map((r) => [r.location.lat, r.location.lng] as [number, number]),
      ...ngos.map((n) => [n.location.lat, n.location.lng] as [number, number]),
    ],
    [requests, ngos]
  );

  return (
    <MapContainer
      center={[28.6139, 77.209]}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: 360 }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <FitOnce points={allPoints} />
      {showHeatmap && <HeatLayer points={heatPoints} />}

      {/* Disaster zones */}
      {events.map((e) => {
        const color =
          e.type === "fire" ? FIRE_COLOR :
          e.type === "flood" ? FLOOD_COLOR :
          e.type === "earthquake" ? QUAKE_COLOR :
          "hsl(0 84% 58%)";
        return (
          <Circle
            key={e.id}
            center={[e.origin.lat, e.origin.lng]}
            radius={e.radiusKm * 1000}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1.5, dashArray: e.type === "fire" ? "6 6" : undefined }}
          />
        );
      })}

      {ngos.map((n) => (
        <Marker key={n.id} position={[n.location.lat, n.location.lng]} icon={ICONS.ngo}>
          <Popup>{n.name}<br />Active: {n.active}/{n.capacity}</Popup>
        </Marker>
      ))}

      {requests.map((r) => {
        const icon =
          r.status === "completed" ? ICONS.done :
          r.priority === "high" ? ICONS.high :
          r.priority === "medium" ? ICONS.medium : ICONS.low;
        return (
          <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={icon}>
            <Popup>
              <strong style={{ textTransform: "capitalize" }}>{r.type}</strong> · {r.priority}<br />
              {r.description}<br />
              <em>Status: {r.status.replace("_", " ")}</em>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
