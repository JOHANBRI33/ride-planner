"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MapRoute = {
  id:           string;
  name:         string;
  sport:        string;
  distance_km:  number;
  elevation:    number;
  difficulty:   string;
  start_lat:    number;
  start_lng:    number;
  city:         string;
  gpx_url?:     string;
};

type Props = {
  routes:     MapRoute[];
  hoveredId:  string | null;
  activeId:   string | null;
  onHover:    (id: string | null) => void;
  onActive:   (id: string | null) => void;
  height?:    string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_COLOR: Record<string, string> = {
  "Vélo":           "#f97316",
  "Course à pied":  "#ef4444",
  "Trail":          "#8b5cf6",
  "Randonnée":      "#10b981",
  "Natation":       "#06b6d4",
  "Triathlon":      "#f59e0b",
};

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "🏔️",
  "Randonnée": "🥾", "Natation": "🏊", "Triathlon": "🏅",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  "Débutant":      "#10b981",
  "Intermédiaire": "#3b82f6",
  "Avancé":        "#f97316",
  "Expert":        "#ef4444",
};

function sportColor(sport: string) {
  return SPORT_COLOR[sport] ?? "#64748b";
}

// ─── GPX Parser ───────────────────────────────────────────────────────────────

function parseGpxCoords(gpxText: string): [number, number][] {
  if (typeof window === "undefined") return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxText, "text/xml");
    if (doc.querySelector("parsererror")) return [];

    let pts = Array.from(doc.querySelectorAll("trkpt"));
    if (pts.length === 0) pts = Array.from(doc.querySelectorAll("rtept"));
    if (pts.length === 0) pts = Array.from(doc.querySelectorAll("wpt"));

    const coords: [number, number][] = [];
    for (const pt of pts) {
      const lat = parseFloat(pt.getAttribute("lat") ?? "");
      const lon = parseFloat(pt.getAttribute("lon") ?? "");
      if (!isNaN(lat) && !isNaN(lon)) coords.push([lon, lat]);
    }

    // Downsample to max 500 points for performance
    if (coords.length > 500) {
      const step = Math.ceil(coords.length / 500);
      return coords.filter((_, i) => i % step === 0);
    }
    return coords;
  } catch {
    return [];
  }
}

// ─── Marker DOM ───────────────────────────────────────────────────────────────

function createMarkerEl(route: MapRoute, active = false): HTMLDivElement {
  const color = sportColor(route.sport);
  const emoji = SPORT_EMOJI[route.sport] ?? "📍";

  const el = document.createElement("div");
  el.dataset.routeId = route.id;
  el.className = "rp-route-marker";
  el.style.cssText = `
    width: ${active ? "48px" : "40px"};
    height: ${active ? "48px" : "40px"};
    border-radius: 50%;
    background: ${color};
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${active ? "20px" : "16px"};
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    transform: scale(1);
  `;
  el.textContent = emoji;
  return el;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutesMap({
  routes, hoveredId, activeId, onHover, onActive, height = "100%",
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<mapboxgl.Map | null>(null);
  const markersRef    = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map());
  const popupRef      = useRef<mapboxgl.Popup | null>(null);
  const activeIdRef   = useRef<string | null>(null);
  const gpxSourceRef  = useRef<string | null>(null); // tracks current GPX source/layer ID

  // ── Map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container:  containerRef.current,
      style:      "mapbox://styles/mapbox/outdoors-v12",
      center:     [-0.5792, 44.8378],
      zoom:       9,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Inject popup + marker styles
    const style = document.createElement("style");
    style.textContent = `
      .rp-route-popup .mapboxgl-popup-content {
        padding: 0; border-radius: 16px; overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15); min-width: 220px;
        border: none;
      }
      .rp-route-popup .mapboxgl-popup-tip { display: none; }
      .rp-route-marker:hover { transform: scale(1.15) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important; }
    `;
    document.head.appendChild(style);

    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 24,
      className: "rp-route-popup",
      maxWidth: "280px",
    });

    return () => {
      style.remove();
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Markers: rebuild when routes change ───────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function addMarkers() {
      if (!map) return;
      // Remove old markers
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();

      const validRoutes = routes.filter((r) => r.start_lat && r.start_lng);
      if (validRoutes.length === 0) return;

      const bounds = new mapboxgl.LngLatBounds();

      validRoutes.forEach((route) => {
        const el = createMarkerEl(route, false);

        el.addEventListener("mouseenter", () => onHover(route.id));
        el.addEventListener("mouseleave", () => onHover(null));
        el.addEventListener("click",      () => {
          onActive(route.id);
          const m = mapRef.current;
          if (m) showPopup(m, route);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([route.start_lng, route.start_lat])
          .addTo(map);

        markersRef.current.set(route.id, { marker, el });
        bounds.extend([route.start_lng, route.start_lat]);
      });

      // Fit all markers in view — only on initial load
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
      }
    }

    if (map.loaded()) addMarkers();
    else map.once("load", addMarkers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  // ── Hover effect ─────────────────────────────────────────────────────────

  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => {
      const isHovered = id === hoveredId && id !== activeId;
      const isActive  = id === activeId;
      el.style.transform  = isActive ? "scale(1.25)" : isHovered ? "scale(1.2)" : "scale(1)";
      el.style.zIndex     = isActive || isHovered ? "10" : "1";
      el.style.boxShadow  = isActive
        ? "0 4px 20px rgba(0,0,0,0.35)"
        : isHovered
        ? "0 4px 16px rgba(0,0,0,0.3)"
        : "0 2px 8px rgba(0,0,0,0.25)";
    });
  }, [hoveredId, activeId]);

  // ── Active: open/close popup + draw GPX line ──────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    activeIdRef.current = activeId;

    // Clear previous GPX layer
    clearGpxLayer(map);

    if (!activeId) {
      popupRef.current?.remove();
      return;
    }

    const route = routes.find((r) => r.id === activeId);
    if (!route) return;

    showPopup(map, route);

    // Draw GPX line if available
    if (route.gpx_url) {
      loadGpxLine(map, route);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, routes]);

  // ── GPX helpers ───────────────────────────────────────────────────────────

  function clearGpxLayer(map: mapboxgl.Map) {
    const srcId = gpxSourceRef.current;
    if (!srcId) return;
    try {
      if (map.getLayer(`${srcId}-glow`)) map.removeLayer(`${srcId}-glow`);
      if (map.getLayer(`${srcId}-line`)) map.removeLayer(`${srcId}-line`);
      if (map.getSource(srcId))          map.removeSource(srcId);
    } catch { /* map might be in transition */ }
    gpxSourceRef.current = null;
  }

  async function loadGpxLine(map: mapboxgl.Map, route: MapRoute) {
    if (!route.gpx_url) return;
    try {
      const res = await fetch(route.gpx_url);
      if (!res.ok) return;
      const text = await res.text();
      const coords = parseGpxCoords(text);
      if (coords.length < 2) return;

      // Wait for map to be ready
      await new Promise<void>((resolve) => {
        if (map.loaded()) resolve();
        else map.once("load", () => resolve());
      });

      const srcId = `gpx-${route.id}`;
      const color = sportColor(route.sport);

      // Clean previous if any
      clearGpxLayer(map);

      map.addSource(srcId, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: {},
        },
      });

      // Glow
      map.addLayer({
        id: `${srcId}-glow`,
        type: "line",
        source: srcId,
        paint: {
          "line-color": color,
          "line-width": 10,
          "line-opacity": 0.18,
          "line-blur": 5,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      // Main line
      map.addLayer({
        id: `${srcId}-line`,
        type: "line",
        source: srcId,
        paint: {
          "line-color": color,
          "line-width": 4,
          "line-opacity": 0.9,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      gpxSourceRef.current = srcId;

      // Fit map to GPX extent
      const lngs = coords.map((c) => c[0]);
      const lats  = coords.map((c) => c[1]);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 80, maxZoom: 14, duration: 900 },
      );
    } catch (err) {
      console.warn("[RoutesMap] GPX load failed", err);
    }
  }

  // ── Popup builder ─────────────────────────────────────────────────────────

  function showPopup(map: mapboxgl.Map, route: MapRoute) {
    if (!route.start_lat || !route.start_lng) return;

    const color     = sportColor(route.sport);
    const diffColor = DIFFICULTY_COLOR[route.difficulty] ?? "#64748b";
    const hasGpx    = !!route.gpx_url;

    const html = `
      <div style="font-family:-apple-system,sans-serif;">
        <div style="padding:14px 16px 12px; background:${color}10; border-bottom:1px solid ${color}20;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;line-height:1.3;">${route.name}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">
            📍 ${route.city || "—"}
            ${hasGpx ? ' · <span style="color:#10b981;font-weight:600;">🗺️ Tracé disponible</span>' : ""}
          </p>
        </div>
        <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <p style="margin:0;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Distance</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0f172a;">${route.distance_km} km</p>
          </div>
          <div>
            <p style="margin:0;font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">D+</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#0f172a;">${route.elevation} m</p>
          </div>
        </div>
        <div style="padding:0 16px 14px;">
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:${diffColor}18;color:${diffColor};">
            ${route.difficulty}
          </span>
          <span style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:${color}15;color:${color};margin-left:4px;">
            Départ du circuit ↑
          </span>
        </div>
      </div>
    `;

    popupRef.current
      ?.setLngLat([route.start_lng, route.start_lat])
      .setHTML(html)
      .addTo(map);

    // Note: no easeTo — prevents the "marker moves" feeling
  }

  return (
    <div ref={containerRef} style={{ height }} className="w-full" />
  );
}
