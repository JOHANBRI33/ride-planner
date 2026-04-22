"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getRoute } from "@/lib/mapbox/routeService";
import type { TravelMode } from "@/lib/mapbox/directions";
import {
  sampleGeometry,
  calculateElevationProfile,
  getDifficulty,
  buildSlopeGeoJSON,
  buildPlainGeoJSON,
  type StoredRoute,
  type SlopeSegment,
} from "@/lib/elevation/elevationService";

// ─── Types ────────────────────────────────────────────────────────────────────

type Coords = { lat: number; lng: number };
type Point = [number, number]; // [lng, lat]

type Props = {
  onLocationChange: (coords: Coords, adresse?: string) => void;
  onRouteChange: (points: Point[], storedRoute?: StoredRoute) => void;
  height?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [-0.5792, 44.8378];

const TRAVEL_MODES: { value: TravelMode; label: string; emoji: string }[] = [
  { value: "cycling", label: "Vélo",    emoji: "🚴" },
  { value: "walking", label: "Marche",  emoji: "🥾" },
  { value: "driving", label: "Voiture", emoji: "🚗" },
];

const LEGEND = [
  { color: "#10b981", label: "0–3 %" },
  { color: "#eab308", label: "3–6 %" },
  { color: "#f97316", label: "6–10 %" },
  { color: "#ef4444", label: "> 10 %" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeBounds(coords: Point[]): mapboxgl.LngLatBoundsLike {
  const lngs = coords.map((p) => p[0]);
  const lats = coords.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

async function reverseGeocode(lng: number, lat: number): Promise<string | undefined> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=fr&types=address,poi&access_token=${token}`
    );
    const json = await res.json();
    return json.features?.[0]?.place_name as string | undefined;
  } catch { return undefined; }
}

/**
 * Query terrain elevation for a set of points.
 * Returns null if terrain data isn't loaded yet (all zeros = no DEM).
 */
function queryElevations(map: mapboxgl.Map, coords: Point[]): number[] | null {
  const sampled = sampleGeometry(coords, 150);
  const elevs = sampled.map(([lng, lat]) => {
    const v = (map as mapboxgl.Map & { queryTerrainElevation?: (lngLat: [number, number], opts?: { exaggerated: boolean }) => number | null })
      .queryTerrainElevation?.([lng, lat], { exaggerated: false });
    return v ?? 0;
  });
  // Check if we got meaningful data (not all zeros)
  const hasData = elevs.some((e) => e > 1);
  return hasData ? elevs : null;
}

/** Source + layers for the route. Uses FeatureCollection so color is data-driven. */
function initRouteSources(map: mapboxgl.Map) {
  const emptyFC = buildPlainGeoJSON([]);

  map.addSource("route", { type: "geojson", data: emptyFC });
  // Glow layer (always green for softness)
  map.addLayer({
    id: "route-glow",
    type: "line",
    source: "route",
    paint: { "line-color": "#10b981", "line-width": 10, "line-opacity": 0.15, "line-blur": 6 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  // Main colored line
  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 4,
      "line-opacity": 0.92,
    },
    layout: { "line-join": "round", "line-cap": "round" },
  });

  // Dashed preview (between waypoints while calculating)
  map.addSource("route-preview", {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
  });
  map.addLayer({
    id: "route-preview-line",
    type: "line",
    source: "route-preview",
    paint: { "line-color": "#10b981", "line-width": 2, "line-opacity": 0.4, "line-dasharray": [2, 2] },
    layout: { "line-join": "round", "line-cap": "round" },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutePickerMap({ onLocationChange, onRouteChange, height = "320px" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const locationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routePointsRef = useRef<Point[]>([]);
  const modeRef = useRef<"location" | "route">("location");
  const travelModeRef = useRef<TravelMode>("cycling");

  const [mode, setMode] = useState<"location" | "route">("location");
  const [travelMode, setTravelMode] = useState<TravelMode>("cycling");
  const [locating, setLocating] = useState(false);
  const [locationPicked, setLocationPicked] = useState(false);
  const [routePoints, setRoutePoints] = useState<Point[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingElevation, setLoadingElevation] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMin: number;
    gain?: number;
    loss?: number;
    slopes?: SlopeSegment[];
  } | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { travelModeRef.current = travelMode; }, [travelMode]);

  // ── Map init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12", // shows terrain naturally
      center: DEFAULT_CENTER,
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Terrain DEM — required for queryTerrainElevation
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1 });

      initRouteSources(map);
    });

    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      if (modeRef.current === "location") {
        placeLocationMarker(map, lat, lng);
        const adresse = await reverseGeocode(lng, lat);
        onLocationChange({ lat, lng }, adresse);
      } else {
        await addRoutePoint(map, [lng, lat]);
      }
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Location marker ─────────────────────────────────────────────────────────

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

  // ── Route management ────────────────────────────────────────────────────────

  async function addRoutePoint(map: mapboxgl.Map, point: Point) {
    const el = document.createElement("div");
    el.className = "w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow";
    const marker = new mapboxgl.Marker({ element: el }).setLngLat(point).addTo(map);
    routeMarkersRef.current.push(marker);

    const newPoints = [...routePointsRef.current, point];
    routePointsRef.current = newPoints;
    setRoutePoints(newPoints);

    updatePreviewLine(map, newPoints);

    if (newPoints.length >= 2) {
      await refreshDirections(map, newPoints);
    } else {
      onRouteChange(newPoints);
    }
  }

  async function refreshDirections(
    map: mapboxgl.Map,
    points: Point[],
    forcedMode?: TravelMode,
  ) {
    setLoadingRoute(true);
    const result = await getRoute(points, forcedMode ?? travelModeRef.current);
    setLoadingRoute(false);

    if (!result) {
      // Fallback: straight lines
      updateRouteSource(map, buildPlainGeoJSON(points));
      onRouteChange(points);
      return;
    }

    const { geometry, distanceKm, durationMin } = result;

    // Show plain green route immediately while elevation loads
    updateRouteSource(map, buildPlainGeoJSON(geometry));
    clearPreviewLine(map);

    // Fit map to route — terrain tiles for this area will load
    map.fitBounds(computeBounds(geometry), {
      padding: { top: 50, bottom: 50, left: 40, right: 40 },
      maxZoom: 15,
      duration: 800,
    });

    // After the map is idle (tiles loaded), query terrain elevations
    setLoadingElevation(true);
    map.once("idle", () => {
      const elevs = queryElevations(map, geometry);

      if (elevs) {
        const sampled = sampleGeometry(geometry, 150);
        const profile = calculateElevationProfile(sampled, elevs);
        updateRouteSource(map, buildSlopeGeoJSON(profile.slopes));
        setRouteInfo({ distanceKm, durationMin, gain: profile.gain, loss: profile.loss, slopes: profile.slopes });
        onRouteChange(points, {
          v: 2,
          geometry,
          distanceKm,
          durationMin,
          gain: profile.gain,
          loss: profile.loss,
          slopes: profile.slopes,
        });
      } else {
        setRouteInfo({ distanceKm, durationMin });
        onRouteChange(points, { v: 2, geometry, distanceKm, durationMin });
      }
      setLoadingElevation(false);
    });
  }

  function updateRouteSource(map: mapboxgl.Map, data: object) {
    const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0]);
  }

  function updatePreviewLine(map: mapboxgl.Map, coords: Point[]) {
    const src = map.getSource("route-preview") as mapboxgl.GeoJSONSource | undefined;
    src?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
  }

  function clearPreviewLine(map: mapboxgl.Map) {
    updatePreviewLine(map, []);
  }

  function clearRoute() {
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
    routePointsRef.current = [];
    setRoutePoints([]);
    setRouteInfo(null);
    setShowLegend(false);
    const map = mapRef.current;
    if (map) {
      updateRouteSource(map, buildPlainGeoJSON([]));
      clearPreviewLine(map);
    }
    onRouteChange([]);
  }

  async function closeLoop() {
    const points = routePointsRef.current;
    if (points.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    await addRoutePoint(map, points[0]);
  }

  async function changeTravelMode(newMode: TravelMode) {
    setTravelMode(newMode);
    const map = mapRef.current;
    const points = routePointsRef.current;
    if (map && points.length >= 2) {
      await refreshDirections(map, points, newMode);
    }
  }

  async function geolocate() {
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
      () => setLocating(false),
    );
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const difficulty = routeInfo?.gain != null && routeInfo.gain > 0
    ? getDifficulty(routeInfo.gain, routeInfo.distanceKm ?? 0)
    : null;

  const isLoading = loadingRoute || loadingElevation;
  const hasSlopes = (routeInfo?.slopes?.length ?? 0) > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">

      {/* ── Mode tabs ── */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setMode("location")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
            mode === "location" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          📍 Point RDV
        </button>
        <button type="button" onClick={() => setMode("route")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
            mode === "route" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          🗺️ Tracer le parcours
        </button>
        {mode === "location" && (
          <button type="button" onClick={geolocate} disabled={locating}
            className="ml-auto text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {locating ? "Localisation…" : "📍 Ma position"}
          </button>
        )}
      </div>

      {/* ── Transport mode (route tab only) ── */}
      {mode === "route" && (
        <div className="flex gap-1.5">
          {TRAVEL_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => changeTravelMode(m.value)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${
                travelMode === m.value
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              <span>{m.emoji}</span>{m.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Map ── */}
      <div className="relative">
        <div ref={containerRef} style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-200" />

        {/* Legend toggle button (only when slopes exist) */}
        {mode === "route" && hasSlopes && (
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow border border-slate-200 text-slate-600 hover:bg-white transition-colors"
          >
            {showLegend ? "✕ Légende" : "🎨 Pentes"}
          </button>
        )}

        {/* Legend panel */}
        {showLegend && hasSlopes && (
          <div className="absolute bottom-12 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-100 px-3 py-2.5 flex flex-col gap-1.5 fade-in">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Pente</p>
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-4 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Stats bar (route mode) ── */}
      {mode === "route" && (
        <div className="flex items-center justify-between min-h-[24px] gap-2">

          {/* Left: loading / stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                {loadingRoute ? "Calcul de l'itinéraire…" : "Calcul du dénivelé…"}
              </span>
            ) : routePoints.length === 0 ? (
              <span className="text-xs text-slate-400">Clique sur la carte pour tracer le parcours</span>
            ) : routeInfo ? (
              <>
                <Stat icon="📏" value={`${routeInfo.distanceKm.toFixed(2)} km`} />
                <Stat icon="⏱️" value={`~${routeInfo.durationMin} min`} />
                {routeInfo.gain != null && routeInfo.gain > 0 && (
                  <Stat icon="⬆️" value={`${routeInfo.gain} m`} title="Dénivelé positif" />
                )}
                {difficulty && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${difficulty.bg} ${difficulty.color}`}>
                    {difficulty.label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">{routePoints.length} point{routePoints.length > 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex gap-2 flex-shrink-0">
            {routePoints.length >= 2 && !isLoading && (
              <button type="button" onClick={closeLoop}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">
                🔄 Boucle
              </button>
            )}
            {routePoints.length > 0 && (
              <button type="button" onClick={clearRoute}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-lg transition-colors">
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ icon, value, title }: { icon: string; value: string; title?: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-slate-600 font-medium" title={title}>
      <span>{icon}</span>{value}
    </span>
  );
}
