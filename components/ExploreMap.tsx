"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapSortie = {
  id: string;
  titre: string;
  lieu?: string;
  date?: string;
  heure?: string;
  sport: string;
  niveau?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  nbParticipants?: number;
  participantsMax?: number;
  status?: string;
};

type Props = {
  sorties: MapSortie[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  height?: string;
};

const SPORT_COLOR: Record<string, string> = {
  "Course à pied": "#ef4444",
  "Vélo":          "#f97316",
  "Randonnée":     "#22c55e",
  "Trail":         "#8b5cf6",
  "Natation":      "#06b6d4",
  "Triathlon":     "#f59e0b",
};

const SPORT_EMOJI: Record<string, string> = {
  "Course à pied": "🏃",
  "Vélo":          "🚴",
  "Randonnée":     "🥾",
  "Trail":         "⛰️",
  "Natation":      "🏊",
  "Triathlon":     "🏅",
};

function createMarkerEl(s: MapSortie): HTMLElement {
  const color = SPORT_COLOR[s.sport] ?? "#3b82f6";
  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";

  const el = document.createElement("div");
  el.style.cssText = [
    "background:white",
    `border:2.5px solid ${color}`,
    "border-radius:20px",
    "padding:5px 10px",
    "font-size:14px",
    "font-weight:700",
    "box-shadow:0 2px 8px rgba(0,0,0,0.15)",
    "display:flex",
    "align-items:center",
    "gap:4px",
    "cursor:pointer",
    "transition:transform 0.15s ease,box-shadow 0.15s ease,z-index 0s",
    "white-space:nowrap",
    "user-select:none",
    `color:${color}`,
    "position:relative",
  ].join(";");
  el.innerHTML = emoji;
  return el;
}

function buildPopupHtml(s: MapSortie): string {
  const color = SPORT_COLOR[s.sport] ?? "#3b82f6";
  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";
  const isFull = s.nbParticipants != null && s.participantsMax != null && s.nbParticipants >= s.participantsMax;
  const isClosed = s.status === "closed";

  const pills: string[] = [];
  if (s.distanceKm) pills.push(`📏 ${s.distanceKm.toFixed(1)} km`);
  if (s.niveau) pills.push(`📊 ${s.niveau}`);
  if (s.nbParticipants != null && s.participantsMax != null)
    pills.push(`👥 ${s.nbParticipants}/${s.participantsMax}`);

  return `
    <div style="font-family:system-ui,sans-serif;min-width:175px;padding:2px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:16px">${emoji}</span>
        <p style="margin:0;font-weight:800;font-size:13px;color:#0f172a;line-height:1.3;flex:1">${s.titre}</p>
      </div>
      ${s.lieu ? `<p style="margin:0 0 3px;font-size:11px;color:#64748b">📍 ${s.lieu}</p>` : ""}
      ${s.date ? `<p style="margin:0 0 6px;font-size:11px;color:#64748b">📅 ${s.date}${s.heure ? " · " + s.heure : ""}</p>` : ""}
      ${pills.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${pills.map(p => `<span style="font-size:10px;font-weight:600;background:#f1f5f9;color:#475569;padding:2px 7px;border-radius:20px">${p}</span>`).join("")}
        </div>` : ""}
      ${isClosed ? `<div style="margin-top:6px;font-size:10px;font-weight:700;color:#64748b">🔒 Clôturée</div>` : ""}
      ${isFull && !isClosed ? `<div style="margin-top:6px;font-size:10px;font-weight:700;color:#ef4444">Complet</div>` : ""}
      <div style="margin-top:8px;border-top:1px solid #f1f5f9;padding-top:6px">
        <span style="font-size:10px;font-weight:700;color:${color};background:${color}18;padding:3px 8px;border-radius:20px">Voir la sortie →</span>
      </div>
    </div>
  `;
}

export default function ExploreMap({ sorties, hoveredId, onHover, height = "100%" }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<mapboxgl.Map | null>(null);
  const loadedRef     = useRef(false);
  const markersRef    = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLElement }>>(new Map());
  const popupRef      = useRef<mapboxgl.Popup | null>(null);
  const onHoverRef    = useRef(onHover);
  const sortiesRef    = useRef(sorties);
  onHoverRef.current  = onHover;
  sortiesRef.current  = sorties;

  // ── Init map once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-0.57, 44.84],
      zoom: 10,
      scrollZoom: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.getCanvas().addEventListener("mouseenter", () => map.scrollZoom.enable());
    map.getCanvas().addEventListener("mouseleave", () => map.scrollZoom.disable());

    map.on("load", () => {
      loadedRef.current = true;
      buildMarkers(map, sortiesRef.current);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild markers when sorties list changes ────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return;
    buildMarkers(mapRef.current, sorties);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorties]);

  // ── Hover: popup + scale — NO camera movement ────────────────────────────
  useEffect(() => {
    popupRef.current?.remove();
    popupRef.current = null;

    // Reset all scales
    markersRef.current.forEach(({ el }) => {
      el.style.transform = "scale(1)";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      el.style.zIndex = "0";
    });

    if (!hoveredId || !mapRef.current) return;

    const sortie = sorties.find((s) => s.id === hoveredId);
    const entry  = markersRef.current.get(hoveredId);
    if (!sortie || !entry || !sortie.latitude || !sortie.longitude) return;

    // Scale up
    entry.el.style.transform = "scale(1.3)";
    entry.el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.22)";
    entry.el.style.zIndex    = "20";

    // Popup without moving camera
    popupRef.current = new mapboxgl.Popup({
      offset: 30,
      closeButton: false,
      closeOnClick: false,
      maxWidth: "240px",
    })
      .setHTML(buildPopupHtml(sortie))
      .setLngLat([sortie.longitude, sortie.latitude])
      .addTo(mapRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  // ── Build markers ────────────────────────────────────────────────────────
  function buildMarkers(map: mapboxgl.Map, items: MapSortie[]) {
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    popupRef.current?.remove();

    items
      .filter((s) => s.latitude && s.longitude)
      .forEach((s) => {
        const el = createMarkerEl(s);

        el.addEventListener("mouseenter", () => onHoverRef.current(s.id));
        el.addEventListener("mouseleave", () => onHoverRef.current(null));
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          map.flyTo({
            center: [s.longitude!, s.latitude!],
            zoom: 14,
            duration: 700,
            essential: true,
          });
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([s.longitude!, s.latitude!])
          .addTo(map);

        markersRef.current.set(s.id, { marker, el });
      });
  }

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      <div style={{
        position: "absolute", top: 12, left: 12,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
        borderRadius: 12, padding: "6px 12px",
        fontSize: 12, fontWeight: 700, color: "#1e293b",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        pointerEvents: "none", zIndex: 10,
        fontFamily: "system-ui,sans-serif",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        📍 Sorties disponibles
      </div>
    </div>
  );
}
