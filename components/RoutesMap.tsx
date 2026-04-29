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
    transform: ${active ? "scale(1.25)" : "scale(1)"};
  `;
  el.textContent = emoji;
  return el;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutesMap({
  routes, hoveredId, activeId, onHover, onActive, height = "100%",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map());
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const activeIdRef  = useRef<string | null>(null);

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

    // Inject popup styles
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
      // Remove old
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
          showPopup(map, route);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([route.start_lng, route.start_lat])
          .addTo(map);

        markersRef.current.set(route.id, { marker, el });
        bounds.extend([route.start_lng, route.start_lat]);
      });

      // Fit all markers
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
      el.style.transform = isHovered ? "scale(1.2)" : id === activeId ? "scale(1.25)" : "scale(1)";
      el.style.zIndex    = isHovered || id === activeId ? "10" : "1";
    });
  }, [hoveredId, activeId]);

  // ── Active: open/close popup ──────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    activeIdRef.current = activeId;

    if (!activeId) {
      popupRef.current?.remove();
      return;
    }

    const route = routes.find((r) => r.id === activeId);
    if (route) showPopup(map, route);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ── Popup builder ─────────────────────────────────────────────────────────

  function showPopup(map: mapboxgl.Map, route: MapRoute) {
    if (!route.start_lat || !route.start_lng) return;

    const color      = sportColor(route.sport);
    const diffColor  = DIFFICULTY_COLOR[route.difficulty] ?? "#64748b";

    const html = `
      <div style="font-family:-apple-system,sans-serif;">
        <div style="padding:14px 16px 12px; background:${color}10; border-bottom:1px solid ${color}20;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a;line-height:1.3;">${route.name}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">📍 ${route.city || "—"}</p>
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
        </div>
      </div>
    `;

    popupRef.current
      ?.setLngLat([route.start_lng, route.start_lat])
      .setHTML(html)
      .addTo(map);

    map.easeTo({ center: [route.start_lng, route.start_lat], duration: 400 });
  }

  return (
    <div ref={containerRef} style={{ height }} className="w-full" />
  );
}
