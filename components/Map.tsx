"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { buildSlopeGeoJSON, buildPlainGeoJSON, type SlopeSegment } from "@/lib/elevation/elevationService";

type Marker = {
  id: string;
  titre: string;
  date?: string;
  heure?: string;
  latitude: number;
  longitude: number;
  color?: string;
};

type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number };

type Props = {
  markers?: Marker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onBoundsChange?: (bounds: Bounds) => void;
  route?: [number, number][];
  slopes?: SlopeSegment[]; // colored segments from StoredRoute
};

const DEFAULT_CENTER: [number, number] = [-0.5792, 44.8378];

export default function Map({
  markers = [],
  center = DEFAULT_CENTER,
  zoom = 11,
  height = "400px",
  onBoundsChange,
  route,
  slopes,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center,
      zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    function emitBounds() {
      if (!onBoundsChange) return;
      const b = map.getBounds();
      if (!b) return;
      onBoundsChange({
        minLng: b.getWest(),
        maxLng: b.getEast(),
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
      });
    }

    map.on("load", () => {
      if (route && route.length >= 2) {
        // Use colored segments when available, plain green otherwise
        const routeData = slopes && slopes.length > 0
          ? buildSlopeGeoJSON(slopes)
          : buildPlainGeoJSON(route);

        map.addSource("route", { type: "geojson", data: routeData });

        // Glow
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          paint: { "line-color": "#10b981", "line-width": 10, "line-opacity": 0.15, "line-blur": 6 },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        // Main line — data-driven color
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": slopes && slopes.length > 0 ? ["get", "color"] : "#10b981",
            "line-width": 4,
            "line-opacity": 0.9,
          },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        // Fit map to route
        const lngs = route.map((p) => p[0]);
        const lats = route.map((p) => p[1]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 50, maxZoom: 15, duration: 0 },
        );
      }

      markers.forEach((m) => {
        const popupHtml = `
          <div style="font-family:sans-serif;min-width:150px;padding:2px 0">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:#111">${m.titre}</div>
            ${m.date ? `<div style="font-size:12px;color:#6b7280">📅 ${m.date}${m.heure ? ` à ${m.heure}` : ""}</div>` : ""}
          </div>
        `;
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(popupHtml);
        new mapboxgl.Marker({ color: m.color ?? "#2563eb" })
          .setLngLat([m.longitude, m.latitude])
          .setPopup(popup)
          .addTo(map);
      });
    });

    map.on("moveend", emitBounds);
    map.on("zoomend", emitBounds);

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
