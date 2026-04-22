"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Coords = { lat: number; lng: number };
type Point = [number, number]; // [lng, lat]

type Props = {
  onLocationChange: (coords: Coords, adresse?: string) => void;
  onRouteChange: (points: Point[]) => void;
  height?: string;
};

const DEFAULT_CENTER: [number, number] = [-0.5792, 44.8378];

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const aa = sinLat * sinLat + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function totalDistance(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineKm(points[i - 1], points[i]);
  return d;
}

export default function RoutePickerMap({ onLocationChange, onRouteChange, height = "320px" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const locationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routePointsRef = useRef<Point[]>([]);
  const modeRef = useRef<"location" | "route">("location");

  const [mode, setMode] = useState<"location" | "route">("location");
  const [locating, setLocating] = useState(false);
  const [locationPicked, setLocationPicked] = useState(false);
  const [routePoints, setRoutePoints] = useState<Point[]>([]);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#10b981", "line-width": 4, "line-opacity": 0.8 },
        layout: { "line-join": "round", "line-cap": "round" },
      });
    });

    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      if (modeRef.current === "location") {
        placeLocationMarker(map, lat, lng);
        const adresse = await reverseGeocode(lng, lat);
        onLocationChange({ lat, lng }, adresse);
      } else {
        addRoutePoint(map, [lng, lat]);
      }
    });

    return () => map.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeLocationMarker(map: mapboxgl.Map, lat: number, lng: number) {
    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLngLat([lng, lat]);
    } else {
      locationMarkerRef.current = new mapboxgl.Marker({ color: "#2563eb" })
        .setLngLat([lng, lat])
        .addTo(map);
    }
    setLocationPicked(true);
  }

  function addRoutePoint(map: mapboxgl.Map, point: Point) {
    const el = document.createElement("div");
    el.className = "w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow";
    const marker = new mapboxgl.Marker({ element: el }).setLngLat(point).addTo(map);
    routeMarkersRef.current.push(marker);

    const newPoints = [...routePointsRef.current, point];
    routePointsRef.current = newPoints;
    setRoutePoints(newPoints);
    updateRouteLine(map, newPoints);
    onRouteChange(newPoints);
  }

  function updateRouteLine(map: mapboxgl.Map, points: Point[]) {
    const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: points }, properties: {} });
  }

  function clearRoute() {
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
    routePointsRef.current = [];
    setRoutePoints([]);
    const map = mapRef.current;
    if (map) updateRouteLine(map, []);
    onRouteChange([]);
  }

  function closeLoop() {
    const points = routePointsRef.current;
    if (points.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    addRoutePoint(map, points[0]);
  }

  async function reverseGeocode(lng: number, lat: number): Promise<string | undefined> {
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=fr&types=address,poi&access_token=${token}`
      );
      const json = await res.json();
      return json.features?.[0]?.place_name as string | undefined;
    } catch {
      return undefined;
    }
  }

  function geolocate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [lng, lat], zoom: 14 });
        placeLocationMarker(map, lat, lng);
        const adresse = await reverseGeocode(lng, lat);
        onLocationChange({ lat, lng }, adresse);
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  const dist = totalDistance(routePoints);

  return (
    <div className="flex flex-col gap-2">
      {/* Tabs mode */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setMode("location")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
            mode === "location" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          📍 Point RDV
        </button>
        <button
          type="button"
          onClick={() => setMode("route")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
            mode === "route" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          🗺️ Tracer le parcours
        </button>
        {mode === "location" && (
          <button
            type="button"
            onClick={geolocate}
            disabled={locating}
            className="ml-auto text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {locating ? "Localisation…" : "📍 Ma position"}
          </button>
        )}
      </div>

      <div ref={containerRef} style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-200" />

      {/* Infos & actions parcours */}
      {mode === "route" && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {routePoints.length === 0
              ? "Clique sur la carte pour tracer le parcours"
              : `${routePoints.length} point${routePoints.length > 1 ? "s" : ""} · ${dist.toFixed(2)} km`}
          </p>
          <div className="flex gap-2">
            {routePoints.length >= 2 && (
              <button
                type="button"
                onClick={closeLoop}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors"
              >
                🔄 Fermer la boucle
              </button>
            )}
            {routePoints.length > 0 && (
              <button
                type="button"
                onClick={clearRoute}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-lg transition-colors"
              >
                ✕ Effacer
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "location" && (
        <p className="text-xs text-gray-400">
          {locationPicked
            ? "✅ Position sélectionnée — champ lieu rempli automatiquement"
            : "Clique sur la carte pour choisir le point de rendez-vous"}
        </p>
      )}
    </div>
  );
}
