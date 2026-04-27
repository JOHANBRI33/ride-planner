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
  elevationGain?: number | null;
  nbParticipants?: number;
  participantsMax?: number;
  status?: string;
  cardImageUrl?: string | null;   // pre-computed route or sport image
};

type Props = {
  sorties:   MapSortie[];
  hoveredId: string | null;             // card hover → scale marker
  activeId:  string | null;             // card hover OR marker click → popup
  onHover:   (id: string | null) => void;
  onActive:  (id: string | null) => void;
  height?:   string;
};

// ─── Sport palette ────────────────────────────────────────────────────────────

const SPORT_COLOR: Record<string, string> = {
  "Vélo":          "#3B82F6",
  "Course à pied": "#F97316",
  "Randonnée":     "#22C55E",
  "Trail":         "#8B5CF6",
  "Natation":      "#06B6D4",
  "Triathlon":     "#F59E0B",
};
const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Randonnée": "🥾",
  "Trail": "⛰️", "Natation": "🏊", "Triathlon": "🏅",
};

function color(sport: string) { return SPORT_COLOR[sport] ?? "#64748b"; }

// ─── Marker DOM element ───────────────────────────────────────────────────────

function createDot(sport: string): HTMLElement {
  const c = color(sport);
  const el = document.createElement("div");
  Object.assign(el.style, {
    width:        "10px",
    height:       "10px",
    borderRadius: "50%",
    background:   c,
    border:       "2px solid #ffffff",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.22)",
    cursor:       "pointer",
    transition:   "transform 0.14s ease, box-shadow 0.14s ease",
    willChange:   "transform",
  });
  return el;
}

type DotState = "idle" | "hover" | "active";

function setDotState(el: HTMLElement, sport: string, state: DotState) {
  const c = color(sport);
  switch (state) {
    case "hover":
      el.style.transform = "scale(1.6)";
      el.style.boxShadow = `0 0 0 4px ${c}30, 0 1px 6px rgba(0,0,0,0.20)`;
      break;
    case "active":
      el.style.transform = "scale(1.9)";
      el.style.boxShadow = `0 0 0 5px ${c}45, 0 2px 10px rgba(0,0,0,0.25)`;
      break;
    default:
      el.style.transform = "scale(1)";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.22)";
  }
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function buildPopup(s: MapSortie): string {
  const c = color(s.sport);
  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";

  const dateFmt = s.date
    ? new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    : null;

  const pill = `
    font-size:10px;font-weight:600;
    background:#f1f5f9;color:#475569;
    padding:3px 9px;border-radius:20px;
    white-space:nowrap;
  `;

  const hasImage = !!s.cardImageUrl;

  return `
    <div style="font-family:system-ui,sans-serif;width:230px;overflow:hidden">

      ${hasImage ? `
        <div style="position:relative;margin:-12px -12px 10px -12px;height:120px;overflow:hidden;border-radius:12px 12px 0 0">
          <img src="${s.cardImageUrl}" alt=""
            style="width:100%;height:100%;object-fit:cover;display:block" />
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.45) 0%,transparent 60%)"></div>
          <div style="position:absolute;bottom:8px;left:10px;display:flex;gap:5px;align-items:center">
            <span style="font-size:14px">${emoji}</span>
            ${s.distanceKm ? `<span style="color:white;font-size:10px;font-weight:700">${s.distanceKm.toFixed(1)} km</span>` : ""}
            ${s.elevationGain ? `<span style="color:white;font-size:10px;font-weight:600">↑ ${s.elevationGain} m</span>` : ""}
          </div>
        </div>
      ` : ""}

      <div style="padding: ${hasImage ? "0" : "2px 0"}">
        <p style="margin:0 0 7px;font-weight:800;font-size:13px;color:#0f172a;line-height:1.3">${s.titre}</p>

        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:9px">
          ${!hasImage && s.distanceKm ? `<span style="${pill}">📏 ${s.distanceKm.toFixed(1)} km</span>` : ""}
          ${s.niveau   ? `<span style="${pill}">${s.niveau}</span>`                                    : ""}
          ${dateFmt    ? `<span style="${pill}">📅 ${dateFmt}</span>`                                  : ""}
          ${s.nbParticipants != null && s.participantsMax != null
              ? `<span style="${pill}">👥 ${s.nbParticipants}/${s.participantsMax}</span>`             : ""}
        </div>

        <a href="/sorties/${s.id}"
          style="display:block;text-align:center;text-decoration:none;
                 font-size:12px;font-weight:700;color:#fff;
                 background:${c};border-radius:10px;padding:8px 12px">
          Voir la sortie →
        </a>
      </div>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExploreMap({
  sorties, hoveredId, activeId, onHover, onActive, height = "100%",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const loadedRef    = useRef(false);
  const markersRef   = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLElement; sport: string }>>(new Map());
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const activeIdRef  = useRef<string | null>(null);   // tracks which marker is "active"

  // stable refs so event listeners don't stale-close
  const onHoverRef  = useRef(onHover);
  const onActiveRef = useRef(onActive);
  const sortiesRef  = useRef(sorties);
  onHoverRef.current  = onHover;
  onActiveRef.current = onActive;
  sortiesRef.current  = sorties;

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container:  containerRef.current,
      style:      "mapbox://styles/mapbox/outdoors-v12",
      center:     [-0.57, 44.84],
      zoom:       10,
      scrollZoom: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.getCanvas().addEventListener("mouseenter", () => map.scrollZoom.enable());
    map.getCanvas().addEventListener("mouseleave", () => map.scrollZoom.disable());

    // Click on map background → close popup + clear active
    map.on("click", () => {
      closePopup();
      onActiveRef.current(null);
    });

    map.on("load", () => {
      loadedRef.current = true;
      buildMarkers(map, sortiesRef.current);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild markers when list changes ─────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !loadedRef.current) return;
    buildMarkers(mapRef.current, sorties);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorties]);

  // ── hoveredId → dot scale (from card list) ────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, sport }, id) => {
      if (id === activeIdRef.current) return; // active takes priority
      setDotState(el, sport, id === hoveredId ? "hover" : "idle");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  // ── activeId → open/close popup ───────────────────────────────────────────
  useEffect(() => {
    const prevId = activeIdRef.current;

    // Reset previous active marker
    if (prevId) {
      const prev = markersRef.current.get(prevId);
      if (prev) setDotState(prev.el, prev.sport, "idle");
    }

    activeIdRef.current = activeId;

    if (!activeId || !mapRef.current) {
      closePopup();
      return;
    }

    const sortie = sortiesRef.current.find((s) => s.id === activeId);
    const entry  = markersRef.current.get(activeId);
    if (!sortie || !entry || !sortie.latitude || !sortie.longitude) return;

    // Scale active marker
    setDotState(entry.el, sortie.sport, "active");

    // Open popup (single instance)
    popupRef.current?.remove();
    popupRef.current = new mapboxgl.Popup({
      offset:       [0, -10],
      closeButton:  true,
      closeOnClick: false,
      maxWidth:     "260px",
      className:    "rp-popup",
    })
      .setHTML(buildPopup(sortie))
      .setLngLat([sortie.longitude, sortie.latitude])
      .addTo(mapRef.current);

    // When popup's X button is clicked
    popupRef.current.on("close", () => {
      const cur = markersRef.current.get(activeIdRef.current ?? "");
      if (cur) setDotState(cur.el, cur.sport, "idle");
      activeIdRef.current = null;
      onActiveRef.current(null);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function closePopup() {
    popupRef.current?.remove();
    popupRef.current = null;
  }

  // ── Build markers ─────────────────────────────────────────────────────────
  function buildMarkers(map: mapboxgl.Map, items: MapSortie[]) {
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    closePopup();
    activeIdRef.current = null;

    items
      .filter((s) => s.latitude != null && s.longitude != null)
      .forEach((s) => {
        const el = createDot(s.sport);

        // Hover: visual only (no popup, no camera)
        el.addEventListener("mouseenter", (e) => {
          e.stopPropagation();
          if (s.id !== activeIdRef.current) setDotState(el, s.sport, "hover");
          onHoverRef.current(s.id);
        });
        el.addEventListener("mouseleave", () => {
          if (s.id !== activeIdRef.current) setDotState(el, s.sport, "idle");
          onHoverRef.current(null);
        });

        // Click: activate → popup (no camera)
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onActiveRef.current(s.id);   // drives activeId effect above
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([s.longitude!, s.latitude!])
          .addTo(map);

        markersRef.current.set(s.id, { marker, el, sport: s.sport });
      });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

      {/* Sport legend */}
      <div style={{
        position: "absolute", top: 12, left: 12,
        background: "rgba(255,255,255,0.93)",
        backdropFilter: "blur(8px)",
        borderRadius: 14,
        padding: "6px 12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.09)",
        pointerEvents: "none",
        zIndex: 10,
        fontFamily: "system-ui,sans-serif",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        {Object.entries(SPORT_COLOR).slice(0, 4).map(([sport, c]) => (
          <span key={sport} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: c,
              border: "1.5px solid #fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
              {sport === "Course à pied" ? "Course" : sport}
            </span>
          </span>
        ))}
      </div>

      {/* Popup global style — injected once */}
      <style>{`
        .rp-popup .mapboxgl-popup-content {
          padding: 12px !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14) !important;
          border: 1px solid #f1f5f9 !important;
        }
        .rp-popup .mapboxgl-popup-tip { display: none !important; }
        .rp-popup .mapboxgl-popup-close-button {
          font-size: 16px !important;
          color: #94a3b8 !important;
          right: 6px !important;
          top: 4px !important;
          background: transparent !important;
          border: none !important;
          line-height: 1 !important;
        }
        .rp-popup .mapboxgl-popup-close-button:hover { color: #1e293b !important; }
      `}</style>
    </div>
  );
}
