"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter } from "next/navigation";
import { resolveSortieImage } from "@/lib/getAutoImage";

// ── Types ──────────────────────────────────────────────────────────────────

export type MapSortie = {
  id: string;
  titre: string;
  lieu: string;
  date: string;
  heure: string;
  sport: string;
  niveau?: string;
  latitude?: number | null;
  longitude?: number | null;
  image?: string | null;
  image_url?: string | null;
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

// ── Constants ──────────────────────────────────────────────────────────────

const SPORT_COLOR: Record<string, string> = {
  "Vélo":          "#3b82f6",
  "Course à pied": "#ef4444",
  "Trail":         "#22c55e",
  "Natation":      "#06b6d4",
  "Randonnée":     "#10b981",
  "Triathlon":     "#f59e0b",
};
const DEFAULT_COLOR = "#6366f1";

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "⛰️",
  "Natation": "🏊", "Randonnée": "🥾", "Triathlon": "🏅",
};

function sportColor(sport: string) {
  return SPORT_COLOR[sport] ?? DEFAULT_COLOR;
}

// ── Popup HTML ─────────────────────────────────────────────────────────────

function buildPopupHTML(s: MapSortie): string {
  const img = resolveSortieImage(s.image_url ?? s.image, s.sport, s.lieu);
  const pct = (s.participantsMax ?? 0) > 0
    ? Math.min(100, Math.round(((s.nbParticipants ?? 0) / s.participantsMax!) * 100))
    : 0;
  const barColor = pct >= 80 ? "#f97316" : "#10b981";

  return `
    <div style="width:210px;font-family:system-ui,sans-serif;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15);">
      <div style="position:relative;height:100px;overflow:hidden;">
        <img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;"
          onerror="this.src='https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=60'" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55) 0%,transparent 60%)"></div>
        <div style="position:absolute;top:7px;right:7px;background:${sportColor(s.sport)};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;">
          ${s.sport}
        </div>
        <div style="position:absolute;bottom:7px;left:8px;right:8px;color:#fff;font-size:12px;font-weight:700;line-height:1.2;">
          ${s.titre}
        </div>
      </div>
      <div style="padding:9px 11px;background:#fff;">
        <div style="font-size:11px;color:#64748b;margin-bottom:5px;">📍 ${s.lieu}</div>
        <div style="display:flex;gap:7px;font-size:11px;color:#64748b;margin-bottom:7px;">
          <span>📅 ${s.date}</span>
          ${s.niveau ? `<span style="background:#f1f5f9;padding:1px 6px;border-radius:8px;font-weight:600;">${s.niveau}</span>` : ""}
        </div>
        ${(s.participantsMax ?? 0) > 0 ? `
          <div style="background:#f1f5f9;border-radius:8px;height:4px;overflow:hidden;margin-bottom:3px;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:8px;"></div>
          </div>
          <div style="font-size:10px;color:#94a3b8;">${s.nbParticipants ?? 0}/${s.participantsMax} participants</div>
        ` : ""}
        <div style="margin-top:8px;text-align:center;background:#2563eb;color:#fff;border-radius:8px;padding:5px;font-size:11px;font-weight:700;cursor:pointer;">
          Voir la sortie →
        </div>
      </div>
    </div>
  `;
}

// ── Marker pill factory (Airbnb style) ────────────────────────────────────

function createMarkerEl(s: MapSortie, hovered = false): HTMLDivElement {
  const el = document.createElement("div");
  applyMarkerStyle(el, s, hovered);
  return el;
}

function applyMarkerStyle(el: HTMLDivElement, s: MapSortie, hovered: boolean) {
  const color = sportColor(s.sport);
  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";
  // Show distance if available, else sport short name
  const label = s.sport.split(" ")[0]; // "Vélo", "Trail", "Course"…

  el.innerHTML = `<span style="font-size:13px;line-height:1">${emoji}</span><span style="font-size:11px;font-weight:700;letter-spacing:-.01em">${label}</span>`;
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: ${hovered ? "5px 10px" : "4px 8px"};
    background: ${hovered ? color : "#fff"};
    color: ${hovered ? "#fff" : "#1e293b"};
    border: 2px solid ${color};
    border-radius: 999px;
    box-shadow: ${hovered ? `0 6px 20px ${color}55` : "0 2px 8px rgba(0,0,0,.18)"};
    cursor: pointer;
    white-space: nowrap;
    transform: scale(${hovered ? "1.15" : "1"});
    transform-origin: center bottom;
    transition: transform .15s ease, box-shadow .15s ease, background .15s ease, color .15s ease;
    user-select: none;
    z-index: ${hovered ? "10" : "1"};
    position: relative;
    font-family: system-ui, sans-serif;
  `;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ExploreMap({ sorties, hoveredId, onHover, height = "100%" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; sortie: MapSortie }>>(new Map());
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  const router       = useRouter();

  // ── Init map (once) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-0.5792, 44.8378],
      zoom: 8,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
      "top-right"
    );

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      className: "explore-popup",
    });
    popupRef.current = popup;
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild markers when sorties change ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function rebuildMarkers() {
      // Remove existing markers
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      popupRef.current?.remove();

      const valid = sorties.filter((s) => s.latitude != null && s.longitude != null);
      if (valid.length === 0) return;

      // Fit bounds to all visible sorties
      const bounds = new mapboxgl.LngLatBounds();

      valid.forEach((s) => {
        bounds.extend([s.longitude!, s.latitude!]);

        const el = createMarkerEl(s, false);

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([s.longitude!, s.latitude!])
          .addTo(map!);

        // Hover: show popup + highlight
        el.addEventListener("mouseenter", () => {
          onHover(s.id);
          applyMarkerStyle(el, s, true);
          popupRef.current
            ?.setLngLat([s.longitude!, s.latitude!])
            .setHTML(buildPopupHTML(s))
            .addTo(map!);
        });

        el.addEventListener("mouseleave", () => {
          if (hoveredId !== s.id) {
            applyMarkerStyle(el, s, false);
          }
          onHover(null);
          popupRef.current?.remove();
        });

        el.addEventListener("click", () => router.push(`/sorties/${s.id}`));

        markersRef.current.set(s.id, { marker, el, sortie: s });
      });

      map!.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
    }

    if (map.isStyleLoaded()) {
      rebuildMarkers();
    } else {
      map.once("load", rebuildMarkers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorties]);

  // ── Sync hover from list ───────────────────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, sortie }, id) => {
      applyMarkerStyle(el, sortie, id === hoveredId);
    });

    if (hoveredId) {
      const s = sorties.find((s) => s.id === hoveredId);
      if (s?.latitude != null && s?.longitude != null) {
        mapRef.current?.easeTo({
          center: [s.longitude, s.latitude],
          zoom: Math.max(mapRef.current.getZoom(), 11),
          duration: 300,
        });
      }
    }
  }, [hoveredId, sorties]);

  return (
    <>
      <style>{`
        .explore-popup .mapboxgl-popup-content {
          padding: 0 !important;
          border-radius: 14px !important;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,.18) !important;
        }
        .explore-popup .mapboxgl-popup-tip { display: none; }
      `}</style>
      <div ref={containerRef} style={{ height, width: "100%" }} />
    </>
  );
}
