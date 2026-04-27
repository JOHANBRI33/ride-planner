"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  hoveredId: string | null;          // kept for card-list sync
  onHover: (id: string | null) => void;
  height?: string;
};

// ─── Sport palette ────────────────────────────────────────────────────────────

const SPORT_COLOR: Record<string, string> = {
  "Vélo":          "#3b82f6",   // blue
  "Course à pied": "#f97316",   // orange
  "Randonnée":     "#22c55e",   // green
  "Trail":         "#8b5cf6",   // purple
  "Natation":      "#06b6d4",   // cyan / turquoise
  "Triathlon":     "#f59e0b",   // amber
};

function sportColor(sport: string): string {
  return SPORT_COLOR[sport] ?? "#64748b";
}

// ─── Marker element — 10 px circle ───────────────────────────────────────────

function createDotEl(sport: string): HTMLElement {
  const color = sportColor(sport);
  const el = document.createElement("div");
  Object.assign(el.style, {
    width:        "12px",
    height:       "12px",
    borderRadius: "50%",
    background:   color,
    boxShadow:    `0 1px 4px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.9)`,
    cursor:       "pointer",
    transition:   "transform 0.15s ease, box-shadow 0.15s ease",
    flexShrink:   "0",
  });
  return el;
}

function dotHover(el: HTMLElement, sport: string, on: boolean) {
  const color = sportColor(sport);
  if (on) {
    el.style.transform  = "scale(1.8)";
    el.style.boxShadow  = `0 2px 10px ${color}88, 0 0 0 3px rgba(255,255,255,0.95)`;
  } else {
    el.style.transform  = "scale(1)";
    el.style.boxShadow  = `0 1px 4px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.9)`;
  }
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function buildPopupHtml(s: MapSortie): string {
  const color = sportColor(s.sport);

  const dateFmt = s.date
    ? new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : null;

  return `
    <div style="font-family:system-ui,sans-serif;min-width:200px;padding:2px 0">

      <p style="margin:0 0 6px;font-weight:800;font-size:13px;color:#0f172a;line-height:1.35">${s.titre}</p>

      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
        ${s.distanceKm  ? `<span style="${pill}">${s.distanceKm.toFixed(1)} km</span>` : ""}
        ${s.niveau      ? `<span style="${pill}">${s.niveau}</span>` : ""}
        ${dateFmt       ? `<span style="${pill}">📅 ${dateFmt}${s.heure ? " · " + s.heure : ""}</span>` : ""}
      </div>

      <a href="/sorties/${s.id}"
        style="display:block;text-align:center;text-decoration:none;
               font-size:12px;font-weight:700;color:white;
               background:${color};border-radius:10px;padding:7px 12px;
               transition:opacity 0.15s"
        onmouseover="this.style.opacity='0.85'"
        onmouseout="this.style.opacity='1'">
        Voir la sortie →
      </a>
    </div>
  `;
}

const pill = [
  "font-size:10px",
  "font-weight:600",
  "background:#f1f5f9",
  "color:#475569",
  "padding:2px 8px",
  "border-radius:20px",
].join(";");

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExploreMap({ sorties, hoveredId, onHover, height = "100%" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const loadedRef    = useRef(false);
  const markersRef   = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLElement; sport: string }>>(new Map());
  const popupRef     = useRef<mapboxgl.Popup | null>(null);   // single popup instance
  const onHoverRef   = useRef(onHover);
  const sortiesRef   = useRef(sorties);
  onHoverRef.current  = onHover;
  sortiesRef.current  = sorties;

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     "mapbox://styles/mapbox/outdoors-v12",
      center:    [-0.57, 44.84],
      zoom:      10,
      scrollZoom: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // scroll-to-zoom only when cursor is over the map
    map.getCanvas().addEventListener("mouseenter", () => map.scrollZoom.enable());
    map.getCanvas().addEventListener("mouseleave", () => map.scrollZoom.disable());

    // Clicking map background closes popup + clears card highlight
    map.on("click", () => {
      popupRef.current?.remove();
      onHoverRef.current(null);
    });

    map.on("load", () => {
      loadedRef.current = true;
      buildMarkers(map, sortiesRef.current);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild markers when sorties list changes ──────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return;
    buildMarkers(mapRef.current, sorties);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorties]);

  // ── Sync card-list hover → marker scale (no popup, no camera) ─────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, sport }, id) => {
      dotHover(el, sport, id === hoveredId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  // ── Build markers ──────────────────────────────────────────────────────────
  function buildMarkers(map: mapboxgl.Map, items: MapSortie[]) {
    // Remove old markers + popup
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    popupRef.current?.remove();
    popupRef.current = null;

    items
      .filter((s) => s.latitude != null && s.longitude != null)
      .forEach((s) => {
        const el = createDotEl(s.sport);

        // ── hover: pure DOM, no setState ──────────────────────────────────
        el.addEventListener("mouseenter", () => {
          dotHover(el, s.sport, true);
          onHoverRef.current(s.id);       // highlights card in list
        });
        el.addEventListener("mouseleave", () => {
          dotHover(el, s.sport, false);
          onHoverRef.current(null);
        });

        // ── click: open popup (no flyTo, no zoom) ─────────────────────────
        el.addEventListener("click", (e) => {
          e.stopPropagation();            // don't trigger map click → close

          // Remove previous popup then create fresh one
          popupRef.current?.remove();

          popupRef.current = new mapboxgl.Popup({
            offset:      [0, -8],         // above the dot
            closeButton: true,
            closeOnClick: false,
            maxWidth:    "260px",
          })
            .setHTML(buildPopupHtml(s))
            .setLngLat([s.longitude!, s.latitude!])
            .addTo(map);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([s.longitude!, s.latitude!])
          .addTo(map);

        markersRef.current.set(s.id, { marker, el, sport: s.sport });
      });
  }

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

      {/* Legend badge */}
      <div style={{
        position:       "absolute",
        top:            12,
        left:           12,
        background:     "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        borderRadius:   12,
        padding:        "5px 11px",
        fontSize:       11,
        fontWeight:     700,
        color:          "#1e293b",
        boxShadow:      "0 2px 8px rgba(0,0,0,0.10)",
        pointerEvents:  "none",
        zIndex:         10,
        fontFamily:     "system-ui,sans-serif",
        display:        "flex",
        alignItems:     "center",
        gap:            8,
      }}>
        {/* Sport dot legend */}
        {Object.entries(SPORT_COLOR).slice(0, 4).map(([sport, color]) => (
          <span key={sport} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: color, display: "inline-block",
              boxShadow: "0 0 0 1.5px rgba(255,255,255,0.9)",
            }} />
            <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{sport.split(" ")[0]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
