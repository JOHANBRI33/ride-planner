"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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
};

const DEFAULT_CENTER: [number, number] = [-0.5792, 44.8378];

export default function Map({
  markers = [],
  center = DEFAULT_CENTER,
  zoom = 11,
  height = "400px",
  onBoundsChange,
  route,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    function emitBounds() {
      if (!onBoundsChange) return;
      const b = map.getBounds();
      onBoundsChange({
        minLng: b.getWest(),
        maxLng: b.getEast(),
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
      });
    }

    map.on("load", () => {
      // Route tracé
      if (route && route.length >= 2) {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: route }, properties: {} },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: { "line-color": "#10b981", "line-width": 4, "line-opacity": 0.8 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
      }

      markers.forEach((m) => {
        const popupHtml = `
          <div style="font-family:sans-serif;min-width:150px;padding:2px 0">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:#111">${m.titre}</div>
            ${m.date ? `<div style="font-size:12px;color:#6b7280">📅 ${m.date}${m.heure ? ` à ${m.heure}` : ""}</div>` : ""}
          </div>
        `;
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: false })
          .setHTML(popupHtml);

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
