"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getSegment, MAPBOX_PROFILE, type TravelMode } from "@/lib/mapbox/directions";
import type { GPXData } from "@/lib/gpx/parseGPX";
import {
  sampleGeometry,
  calculateElevationProfile,
  buildSlopeGeoJSON,
  buildPlainGeoJSON,
  haversine,
  type StoredRoute,
  type SlopeSegment,
} from "@/lib/elevation/elevationService";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExtendedMode = "cycling" | "walking" | "swimming";
type Point = [number, number]; // [lng, lat]

type Segment = {
  from:        Point;
  to:          Point;
  geometry:    Point[];   // road-following geometry from Directions API
  distanceKm:  number;
  durationMin: number;
};

type Props = {
  onLocationChange: (coords: { lat: number; lng: number }, adresse?: string) => void;
  onRouteChange:    (points: Point[], storedRoute?: StoredRoute) => void;
  onModeChange?:    (mode: ExtendedMode) => void;
  height?:          string;
  initialGpx?:      GPXData | null;
  /** Circuit figé provenant de la bibliothèque de parcours — non modifiable */
  fixedRoute?:      Point[] | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: Point = [-0.5792, 44.8378];

const TRAVEL_MODES: { value: ExtendedMode; label: string; emoji: string }[] = [
  { value: "cycling",  label: "Vélo",          emoji: "🚴" },
  { value: "walking",  label: "Marche ou Run",  emoji: "🥾" },
  { value: "swimming", label: "Natation",       emoji: "🏊" },
];

const LEGEND = [
  { color: "#10b981", label: "0–3 %"  },
  { color: "#eab308", label: "3–6 %"  },
  { color: "#f97316", label: "6–10 %" },
  { color: "#ef4444", label: "> 10 %" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(a: Point, b: Point): number {
  return haversine(a, b) / 1000;
}

function straightLineKm(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineKm(pts[i - 1], pts[i]);
  return Math.round(d * 100) / 100;
}

function computeBounds(coords: Point[]): mapboxgl.LngLatBoundsLike {
  const lngs = coords.map((p) => p[0]);
  const lats  = coords.map((p) => p[1]);
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

/** Concatène les géométries des segments en évitant les points de jonction doublons. */
function joinGeometries(segments: Segment[]): Point[] {
  return segments.reduce<Point[]>((acc, seg, i) => {
    return acc.concat(i === 0 ? seg.geometry : seg.geometry.slice(1));
  }, []);
}

/** Construit un segment en ligne droite (fallback / natation). */
function straightSegment(from: Point, to: Point): Segment {
  return {
    from, to,
    geometry:    [from, to],
    distanceKm:  Math.round(haversineKm(from, to) * 100) / 100,
    durationMin: 0,
  };
}

/** Attend que queryTerrainElevation retourne des données non-nulles pour au moins un point test. */
async function waitForTerrain(
  map:       mapboxgl.Map,
  testPoint: Point,
  maxMs    = 4000,
): Promise<boolean> {
  const step = 200;
  const queryMap = map as mapboxgl.Map & {
    queryTerrainElevation?: (p: mapboxgl.LngLatLike, opts?: { exaggerated: boolean }) => number | null;
  };
  for (let elapsed = 0; elapsed < maxMs; elapsed += step) {
    const e = queryMap.queryTerrainElevation?.([testPoint[0], testPoint[1]], { exaggerated: false });
    if (e !== null && e !== undefined && Math.abs(e) > 0.5) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

/** Query élévations pour une liste de points. */
function queryElevations(map: mapboxgl.Map, coords: Point[]): number[] {
  const queryMap = map as mapboxgl.Map & {
    queryTerrainElevation?: (p: mapboxgl.LngLatLike, opts?: { exaggerated: boolean }) => number | null;
  };
  return coords.map(([lng, lat]) => {
    return queryMap.queryTerrainElevation?.([lng, lat], { exaggerated: false }) ?? 0;
  });
}

// ─── Map source helpers ───────────────────────────────────────────────────────

function initRouteSources(map: mapboxgl.Map) {
  const empty = buildPlainGeoJSON([]);

  // ── Fixed/locked circuit layer (shown when fixedRoute is provided) ──
  map.addSource("route-fixed", {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
  });
  // Fixed glow
  map.addLayer({
    id: "route-fixed-glow", type: "line", source: "route-fixed",
    paint: { "line-color": "#f97316", "line-width": 12, "line-opacity": 0.15, "line-blur": 6 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  // Fixed main line (orange, solid)
  map.addLayer({
    id: "route-fixed-line", type: "line", source: "route-fixed",
    paint: { "line-color": "#f97316", "line-width": 4.5, "line-opacity": 0.9 },
    layout: { "line-join": "round", "line-cap": "round" },
  });

  // ── User-drawn route ──
  map.addSource("route", { type: "geojson", data: empty });
  // Glow
  map.addLayer({
    id: "route-glow", type: "line", source: "route",
    paint: { "line-color": "#10b981", "line-width": 10, "line-opacity": 0.12, "line-blur": 6 },
    layout: { "line-join": "round", "line-cap": "round" },
  });
  // Main colored line (data-driven by "color" property)
  map.addLayer({
    id: "route-line", type: "line", source: "route",
    paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.93 },
    layout: { "line-join": "round", "line-cap": "round" },
  });

  // Dashed preview while calculating next segment
  map.addSource("route-preview", {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
  });
  map.addLayer({
    id: "route-preview-line", type: "line", source: "route-preview",
    paint: { "line-color": "#10b981", "line-width": 2, "line-opacity": 0.45, "line-dasharray": [2, 2] },
    layout: { "line-join": "round", "line-cap": "round" },
  });
}

function setFixedRouteData(map: mapboxgl.Map, coords: Point[]) {
  (map.getSource("route-fixed") as mapboxgl.GeoJSONSource | undefined)
    ?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
}

function setRouteData(map: mapboxgl.Map, data: object) {
  (map.getSource("route") as mapboxgl.GeoJSONSource | undefined)
    ?.setData(data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0]);
}

function setPreviewData(map: mapboxgl.Map, coords: Point[]) {
  (map.getSource("route-preview") as mapboxgl.GeoJSONSource | undefined)
    ?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutePickerMap({
  onLocationChange, onRouteChange, onModeChange, height = "320px", initialGpx, fixedRoute,
}: Props) {
  const containerRef        = useRef<HTMLDivElement>(null);
  const mapRef              = useRef<mapboxgl.Map | null>(null);
  const mapLoadedRef        = useRef(false);
  const locationMarkerRef   = useRef<mapboxgl.Marker | null>(null);
  const waypointMarkersRef  = useRef<mapboxgl.Marker[]>([]);  // one per user-clicked waypoint
  const waypointsRef        = useRef<Point[]>([]);            // user-clicked points
  const segmentsRef         = useRef<Segment[]>([]);          // completed routed segments
  const modeRef             = useRef<"location" | "route">("location");
  const travelModeRef       = useRef<ExtendedMode>("cycling");
  const routingRef          = useRef(false);                  // prevent overlapping fetches

  const [mode,           setMode]           = useState<"location" | "route">("location");
  const [travelMode,     setTravelMode]     = useState<ExtendedMode>("cycling");
  const [locating,       setLocating]       = useState(false);
  const [locationPicked, setLocationPicked] = useState(false);
  const [waypoints,      setWaypoints]      = useState<Point[]>([]);
  const [loadingRoute,   setLoadingRoute]   = useState(false);
  const [loadingElev,    setLoadingElev]    = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm:  number;
    durationMin: number;
    gain?:       number;
    loss?:       number;
    slopes?:     SlopeSegment[];
  } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [routeError, setRouteError] = useState("");

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { travelModeRef.current = travelMode; }, [travelMode]);

  // ── Fixed route (circuit verrouillé depuis la bibliothèque) ────────────────

  useEffect(() => {
    if (!fixedRoute || fixedRoute.length < 2) return;

    function applyFixed() {
      const map = mapRef.current;
      if (!map || !fixedRoute) return;

      setFixedRouteData(map, fixedRoute);

      // Marqueur de départ (drapeau orange)
      const startEl = document.createElement("div");
      startEl.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: #f97316; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; pointer-events: none;
      `;
      startEl.textContent = "🚩";
      new mapboxgl.Marker({ element: startEl, anchor: "center" })
        .setLngLat(fixedRoute[0])
        .addTo(map);

      // Fit to fixed route bounds
      const lngs = fixedRoute.map((p) => p[0]);
      const lats  = fixedRoute.map((p) => p[1]);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, maxZoom: 15, duration: 800 },
      );

      // Notify parent with fixed route as the stored route
      onRouteChange(fixedRoute, {
        v: 2,
        geometry:    fixedRoute,
        distanceKm:  Math.round(straightLineKm(fixedRoute) * 100) / 100,
        durationMin: 0,
      });
    }

    if (mapLoadedRef.current) applyFixed();
    else mapRef.current?.once("load", applyFixed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedRoute]);

  // ── GPX import ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!initialGpx) return;

    function applyGpx() {
      const map = mapRef.current;
      if (!map || !initialGpx) return;

      clearAllMarkers();
      waypointsRef.current = initialGpx.coordinates;
      segmentsRef.current  = [];
      setWaypoints(initialGpx.coordinates);
      setRouteInfo({ distanceKm: initialGpx.distanceKm, durationMin: 0, gain: initialGpx.elevationGain });
      setMode("route");

      setRouteData(map, buildPlainGeoJSON(initialGpx.coordinates));

      const [startLng, startLat] = initialGpx.coordinates[0];
      addWaypointMarker(map, [startLng, startLat], true);

      map.fitBounds(computeBounds(initialGpx.coordinates), { padding: 60, maxZoom: 15, duration: 800 });

      onRouteChange(initialGpx.coordinates, {
        v: 2,
        geometry:    initialGpx.coordinates,
        distanceKm:  initialGpx.distanceKm,
        durationMin: 0,
        gain:        initialGpx.elevationGain,
        loss:        0,
        slopes:      [],
      });
    }

    if (mapLoadedRef.current) applyGpx();
    else mapRef.current?.once("load", applyGpx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGpx]);

  // ── Map init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container:  containerRef.current,
      style:      "mapbox://styles/mapbox/outdoors-v12",
      center:     DEFAULT_CENTER,
      zoom:       11,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      mapLoadedRef.current = true;

      // Terrain DEM pour queryTerrainElevation
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url:  "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512, maxzoom: 14,
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
        await addWaypoint(map, [lng, lat]);
      }
    });

    // Live preview: dashed line from last waypoint to cursor
    map.on("mousemove", (e) => {
      if (modeRef.current !== "route") return;
      const pts = waypointsRef.current;
      if (pts.length === 0) return;
      const last = pts[pts.length - 1];
      setPreviewData(map, [last, [e.lngLat.lng, e.lngLat.lat]]);
    });

    map.on("mouseleave", () => setPreviewData(map, []));

    return () => { map.remove(); mapRef.current = null; mapLoadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Marker helpers ──────────────────────────────────────────────────────────

  function addWaypointMarker(map: mapboxgl.Map, point: Point, isStart = false) {
    const el = document.createElement("div");
    el.className = [
      "rounded-full border-2 border-white shadow",
      isStart
        ? "w-4 h-4 bg-emerald-500"   // start: bigger green
        : "w-3 h-3 bg-blue-500",     // via point: smaller blue
    ].join(" ");
    const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(point)
      .addTo(map);
    waypointMarkersRef.current.push(marker);
    return marker;
  }

  function clearAllMarkers() {
    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];
  }

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

  // ── Core: add waypoint + route segment ─────────────────────────────────────

  async function addWaypoint(map: mapboxgl.Map, point: Point) {
    if (routingRef.current) return; // prevent overlapping requests

    const isStart = waypointsRef.current.length === 0;
    addWaypointMarker(map, point, isStart);

    const newWaypoints = [...waypointsRef.current, point];
    waypointsRef.current = newWaypoints;
    setWaypoints(newWaypoints);
    setRouteError("");

    if (newWaypoints.length < 2) {
      onRouteChange(newWaypoints);
      return;
    }

    // ── Route the new segment (prev → new) ──────────────────────────────────
    const from = newWaypoints[newWaypoints.length - 2];
    const to   = point;

    routingRef.current = true;
    setLoadingRoute(true);

    let segment: Segment;

    if (travelModeRef.current === "swimming") {
      segment = straightSegment(from, to);
    } else {
      const mapboxMode = MAPBOX_PROFILE[travelModeRef.current] as TravelMode;
      const result = await getSegment(from, to, mapboxMode);

      if (!result) {
        // Fallback straight line + error notice
        segment = straightSegment(from, to);
        setRouteError("Itinéraire routier introuvable — tracé approximatif");
      } else {
        segment = { from, to, ...result };
      }
    }

    segmentsRef.current = [...segmentsRef.current, segment];
    setLoadingRoute(false);
    routingRef.current = false;

    // ── Display joined geometry ──────────────────────────────────────────────
    const fullGeometry = joinGeometries(segmentsRef.current);
    const totalDist    = segmentsRef.current.reduce((s, seg) => s + seg.distanceKm, 0);
    const totalDur     = segmentsRef.current.reduce((s, seg) => s + seg.durationMin, 0);

    // Show plain green immediately
    setRouteData(map, buildPlainGeoJSON(fullGeometry));

    // ── Elevation ────────────────────────────────────────────────────────────
    setLoadingElev(true);

    // Wait for map to be idle after the flyTo
    await new Promise<void>((resolve) => {
      map.once("idle", () => resolve());
      setTimeout(resolve, 2000); // safety timeout
    });

    // Additional wait for terrain DEM tiles to load
    const midPoint = fullGeometry[Math.floor(fullGeometry.length / 2)];
    const hasTerrain = await waitForTerrain(map, midPoint, 3000);

    if (hasTerrain) {
      const sampled  = sampleGeometry(fullGeometry, 150);
      const elevs    = queryElevations(map, sampled);
      const profile  = calculateElevationProfile(sampled, elevs);
      const slopes   = profile.gain > 0 ? profile.slopes : [];

      setRouteData(map, slopes.length > 0 ? buildSlopeGeoJSON(slopes) : buildPlainGeoJSON(fullGeometry));
      setRouteInfo({ distanceKm: Math.round(totalDist * 100) / 100, durationMin: totalDur, ...profile });

      onRouteChange(newWaypoints, {
        v: 2, geometry: fullGeometry,
        distanceKm:  Math.round(totalDist * 100) / 100,
        durationMin: totalDur,
        gain: profile.gain,
        loss: profile.loss,
        slopes,
      });
    } else {
      setRouteInfo({ distanceKm: Math.round(totalDist * 100) / 100, durationMin: totalDur });
      onRouteChange(newWaypoints, {
        v: 2, geometry: fullGeometry,
        distanceKm:  Math.round(totalDist * 100) / 100,
        durationMin: totalDur,
      });
    }

    setLoadingElev(false);
  }

  // ── Mode change: re-route all segments ─────────────────────────────────────

  async function changeTravelMode(newMode: ExtendedMode) {
    setTravelMode(newMode);
    travelModeRef.current = newMode;
    onModeChange?.(newMode);
    const map = mapRef.current;
    const pts = waypointsRef.current;
    if (!map || pts.length < 2) return;

    routingRef.current = true;
    setLoadingRoute(true);
    setRouteError("");

    const mapboxMode = MAPBOX_PROFILE[newMode] as TravelMode;

    const newSegments: Segment[] = await Promise.all(
      pts.slice(0, -1).map(async (from, i) => {
        const to = pts[i + 1];
        if (newMode === "swimming") return straightSegment(from, to);
        const result = await getSegment(from, to, mapboxMode);
        return result ? { from, to, ...result } : straightSegment(from, to);
      })
    );

    segmentsRef.current = newSegments;
    setLoadingRoute(false);
    routingRef.current = false;

    const fullGeometry = joinGeometries(newSegments);
    const totalDist    = newSegments.reduce((s, seg) => s + seg.distanceKm, 0);
    const totalDur     = newSegments.reduce((s, seg) => s + seg.durationMin, 0);

    setRouteData(map, buildPlainGeoJSON(fullGeometry));
    setRouteInfo({ distanceKm: Math.round(totalDist * 100) / 100, durationMin: totalDur });

    // Re-query elevation
    setLoadingElev(true);
    await new Promise<void>((resolve) => { map.once("idle", () => resolve()); setTimeout(resolve, 2000); });
    const mid = fullGeometry[Math.floor(fullGeometry.length / 2)];
    const hasTerrain = await waitForTerrain(map, mid, 3000);

    if (hasTerrain) {
      const sampled = sampleGeometry(fullGeometry, 150);
      const elevs   = queryElevations(map, sampled);
      const profile = calculateElevationProfile(sampled, elevs);
      const slopes  = profile.gain > 0 ? profile.slopes : [];
      setRouteData(map, slopes.length > 0 ? buildSlopeGeoJSON(slopes) : buildPlainGeoJSON(fullGeometry));
      setRouteInfo({ distanceKm: Math.round(totalDist * 100) / 100, durationMin: totalDur, ...profile });
    }
    setLoadingElev(false);
  }

  // ── Clear ───────────────────────────────────────────────────────────────────

  function clearRoute() {
    clearAllMarkers();
    waypointsRef.current = [];
    segmentsRef.current  = [];
    setWaypoints([]);
    setRouteInfo(null);
    setShowLegend(false);
    setRouteError("");
    const map = mapRef.current;
    if (map) {
      setRouteData(map, buildPlainGeoJSON([]));
      setPreviewData(map, []);
    }
    onRouteChange([]);
  }

  // ── Close loop ──────────────────────────────────────────────────────────────

  async function closeLoop() {
    const pts = waypointsRef.current;
    const map = mapRef.current;
    if (pts.length < 2 || !map) return;
    await addWaypoint(map, pts[0]);
  }

  // ── Undo last point ─────────────────────────────────────────────────────────

  function undoLast() {
    const pts = waypointsRef.current;
    if (pts.length === 0) return;

    // Remove last waypoint marker
    const lastMarker = waypointMarkersRef.current.pop();
    lastMarker?.remove();

    const newWaypoints = pts.slice(0, -1);
    waypointsRef.current = newWaypoints;
    setWaypoints(newWaypoints);

    const newSegments = segmentsRef.current.slice(0, -1);
    segmentsRef.current = newSegments;
    setRouteError("");

    const map = mapRef.current;
    if (!map) return;

    if (newSegments.length === 0) {
      setRouteData(map, buildPlainGeoJSON([]));
      setRouteInfo(null);
      onRouteChange([]);
      return;
    }

    const fullGeometry = joinGeometries(newSegments);
    const totalDist    = newSegments.reduce((s, seg) => s + seg.distanceKm, 0);
    const totalDur     = newSegments.reduce((s, seg) => s + seg.durationMin, 0);

    setRouteData(map, buildPlainGeoJSON(fullGeometry));
    setRouteInfo({ distanceKm: Math.round(totalDist * 100) / 100, durationMin: totalDur });
    onRouteChange(newWaypoints, {
      v: 2, geometry: fullGeometry,
      distanceKm: Math.round(totalDist * 100) / 100, durationMin: totalDur,
    });
  }

  // ── Geolocation ─────────────────────────────────────────────────────────────

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

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isLoading  = loadingRoute || loadingElev;
  const hasSlopes  = (routeInfo?.slopes?.length ?? 0) > 0;
  const totalDist  = segmentsRef.current.reduce((s, seg) => s + seg.distanceKm, 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">

      {/* ── Badge circuit verrouillé ── */}
      {fixedRoute && fixedRoute.length >= 2 && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
          <span className="text-sm">🔒</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-orange-700">Circuit importé — verrouillé</span>
            <p className="text-[11px] text-orange-500 mt-0.5">Tracé figé · Placez votre point de rendez-vous ci-dessous</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-[10px] text-orange-500 font-medium">{fixedRoute.length} pts</span>
          </div>
        </div>
      )}

      {/* ── Mode tabs ── */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setMode("location")}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
            mode === "location" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          📍 Point RDV
        </button>
        {/* Masquer "Tracer le parcours" si circuit fixé (mais garder pour trajet d'accès) */}
        {!fixedRoute && (
          <button type="button" onClick={() => setMode("route")}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
              mode === "route" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            🗺️ Tracer le parcours
          </button>
        )}
        {fixedRoute && (
          <button type="button" onClick={() => setMode("route")}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
              mode === "route" ? "bg-slate-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            title="Tracer le chemin pour rejoindre le départ du circuit">
            🚦 Trajet d&apos;accès (optionnel)
          </button>
        )}
        {mode === "location" && (
          <button type="button" onClick={geolocate} disabled={locating}
            className="ml-auto text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {locating ? "Localisation…" : "📍 Ma position"}
          </button>
        )}
      </div>

      {/* ── Mode de transport (route seulement) ── */}
      {mode === "route" && (
        <div className="flex gap-1.5 flex-wrap">
          {TRAVEL_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => changeTravelMode(m.value)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                travelMode === m.value
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              <span>{m.emoji}</span>{m.label}
            </button>
          ))}
          {mode === "route" && waypoints.length > 0 && (
            <span className="ml-auto text-xs text-slate-400 self-center">
              {waypoints.length} point{waypoints.length > 1 ? "s" : ""}
              {totalDist > 0 ? ` · ${(totalDist).toFixed(1)} km` : ""}
            </span>
          )}
        </div>
      )}

      {/* ── Map ── */}
      <div className="relative">
        <div ref={containerRef} style={{ height }} className="w-full rounded-xl overflow-hidden border border-gray-200" />

        {/* Légende pentes */}
        {mode === "route" && hasSlopes && (
          <button type="button" onClick={() => setShowLegend((v) => !v)}
            className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow border border-slate-200 text-slate-600 hover:bg-white transition-colors">
            {showLegend ? "✕ Légende" : "🎨 Pentes"}
          </button>
        )}
        {showLegend && hasSlopes && (
          <div className="absolute bottom-12 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-100 px-3 py-2.5 flex flex-col gap-1.5">
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

      {/* ── Barre stats ── */}
      {mode === "route" && (
        <div className="flex items-center justify-between min-h-[24px] gap-2 flex-wrap">

          {/* Gauche : statut / stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {travelMode === "swimming" && waypoints.length === 0 ? (
              <span className="text-xs text-blue-500">
                🏊 Trace en ligne droite (natation)
              </span>
            ) : isLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                {loadingRoute ? "Calcul de l'itinéraire…" : "Analyse du dénivelé…"}
              </span>
            ) : waypoints.length === 0 ? (
              <span className="text-xs text-slate-400">
                Clique sur la carte pour tracer le parcours
              </span>
            ) : routeInfo ? (
              <>
                <Stat icon="📏" value={`${routeInfo.distanceKm.toFixed(2)} km`} />
                {routeInfo.durationMin > 0 && (
                  <Stat icon="⏱️" value={`~${routeInfo.durationMin} min`} />
                )}
                {routeInfo.gain != null && routeInfo.gain > 0 && (
                  <Stat icon="⬆️" value={`${routeInfo.gain} m`} title="Dénivelé positif" />
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">
                {waypoints.length} point{waypoints.length > 1 ? "s" : ""}
              </span>
            )}

            {/* Erreur de routage */}
            {routeError && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                ⚠️ {routeError}
              </span>
            )}
          </div>

          {/* Droite : actions */}
          <div className="flex gap-1.5 flex-shrink-0">
            {waypoints.length >= 1 && !isLoading && (
              <button type="button" onClick={undoLast}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">
                ↩ Annuler
              </button>
            )}
            {waypoints.length >= 2 && !isLoading && (
              <button type="button" onClick={closeLoop}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">
                🔄 Boucle
              </button>
            )}
            {waypoints.length > 0 && (
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
