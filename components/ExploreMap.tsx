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

// ── Marker style (mutates existing element — no DOM recreation) ───────────

function applyMarkerStyle(el: HTMLDivElement, s: MapSortie, hovered: boolean) {
  const color  = sportColor(s.sport);
  const emoji  = SPORT_EMOJI[s.sport] ?? "🏅";
  const label  = s.sport.split(" ")[0];

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
    box-shadow: ${hovered ? `0 4px 14px ${color}66` : "0 2px 6px rgba(0,0,0,.18)"};
    cursor: pointer;
    white-space: nowrap;
    transform: scale(${hovered ? "1.1" : "1"});
    transform-origin: center bottom;
    transition: transform .12s ease, box-shadow .12s ease, background .12s ease, color .12s ease;
    user-select: none;
    position: relative;
    z-index: ${hovered ? "10" : "1"};
    font-family: system-ui, sans-serif;
  `;
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
        <div style="position:absolute;top:7px;right:7px;background:${sportColor(s.sport)};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;">${s.sport}</div>
        <div style="position:absolute;bottom:7px;left:8px;right:8px;color:#fff;font-size:12px;font-weight:700;line-height:1.2;">${s.titre}</div>
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

// ── Component ──────────────────────────────────────────────────────────────

export default function ExploreMap({ sorties, hoveredId, onHover, height = "100%" }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<mapboxgl.Map | null>(null);
  const markersRef     = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement; sortie: MapSortie }>>(new Map());
  const popupRef       = useRef<mapboxgl.Popup | null>(null);
  const hasFitRef      = useRef(false);   // fitBounds only once, on initial data load
  const onHoverRef     = useRef(onHover); // stable ref — avoids stale closure in event listeners
  const router         = useRouter();

  // Keep callback ref current without recreating markers
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);

  // ── Init map (once, never recreated) ──────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return; // guard: only init once
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-0.5792, 44.8378],
      zoom: 8,
      // Disable default scroll-zoom fighting with page scroll
      scrollZoom: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
      "top-right"
    );

    // Re-enable scroll zoom only when cursor is inside the map
    map.getCanvas().addEventListener("mouseenter", () => map.scrollZoom.enable());
    map.getCanvas().addEventListener("mouseleave", () => map.scrollZoom.disable());

    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: "explore-popup",
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current  = null;
      hasFitRef.current = false;
    };
  }, []);

  // ── Sync markers when sorties change (diff — no full rebuild) ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function syncMarkers() {
      const incoming = new Map(sorties.filter(s => s.latitude != null && s.longitude != null).map(s => [s.id, s]));
      const existing = markersRef.current;

      // Remove markers no longer in filtered set
      existing.forEach(({ marker }, id) => {
        if (!incoming.has(id)) {
          marker.remove();
          existing.delete(id);
        }
      });

      // Add markers that are new
      const bounds = new mapboxgl.LngLatBounds();
      let newCount = 0;

      incoming.forEach((s) => {
        bounds.extend([s.longitude!, s.latitude!]);

        if (existing.has(s.id)) return; // already on map

        const el = document.createElement("div");
        applyMarkerStyle(el, s, false);

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([s.longitude!, s.latitude!])
          .addTo(map!);

        el.addEventListener("mouseenter", () => {
          onHoverRef.current(s.id);
          applyMarkerStyle(el, s, true);
          popupRef.current
            ?.setLngLat([s.longitude!, s.latitude!])
            .setHTML(buildPopupHTML(s))
            .addTo(map!);
        });

        el.addEventListener("mouseleave", () => {
          onHoverRef.current(null);
          applyMarkerStyle(el, s, false);
          popupRef.current?.remove();
        });

        el.addEventListener("click", () => router.push(`/sorties/${s.id}`));

        existing.set(s.id, { marker, el, sortie: s });
        newCount++;
      });

      // fitBounds only on the very first data load (not on every filter change)
      if (!hasFitRef.current && incoming.size > 0) {
        map!.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 700 });
        hasFitRef.current = true;
      }
    }

    if (map.isStyleLoaded()) {
      syncMarkers();
    } else {
      map.once("load", syncMarkers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorties]);

  // ── Sync hover highlight — NO map movement ────────────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, sortie }, id) => {
      applyMarkerStyle(el, sortie, id === hoveredId);
    });
    // ⚠️ No easeTo / flyTo here — hover must never move the map
  }, [hoveredId]);

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
