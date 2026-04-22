"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { buildSlopeGeoJSON, buildPlainGeoJSON, type SlopeSegment } from "@/lib/elevation/elevationService";

type Point = [number, number]; // [lng, lat]

type Props = {
  route: Point[];
  slopes?: SlopeSegment[];  // pre-computed from StoredRoute — enables colored display
  center?: Point;
  height?: string;
};

function computeBounds(route: Point[]): mapboxgl.LngLatBoundsLike {
  const lngs = route.map((p) => p[0]);
  const lats = route.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export default function MiniMapPreview({ route, slopes, center, height = "100%" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || route.length < 2) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const lngs = route.map((p) => p[0]);
    const lats = route.map((p) => p[1]);
    const computedCenter: Point = center ?? [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: computedCenter,
      zoom: 11,
      interactive: false,
      attributionControl: false,
      logoPosition: "bottom-right",
    });

    map.on("load", () => {
      // Colored route if slopes available, plain green otherwise
      const routeData = slopes && slopes.length > 0
        ? buildSlopeGeoJSON(slopes)
        : buildPlainGeoJSON(route);

      map.addSource("mini-route", { type: "geojson", data: routeData });

      // Glow layer
      map.addLayer({
        id: "mini-route-glow",
        type: "line",
        source: "mini-route",
        paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.18, "line-blur": 4 },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      // Main line — data-driven color when slopes exist, else static green
      map.addLayer({
        id: "mini-route-line",
        type: "line",
        source: "mini-route",
        paint: {
          "line-color": slopes && slopes.length > 0 ? ["get", "color"] : "#10b981",
          "line-width": 3,
          "line-opacity": 0.92,
        },
        layout: { "line-join": "round", "line-cap": "round" },
      });

      // Start marker
      const startEl = document.createElement("div");
      startEl.style.cssText =
        "width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)";
      new mapboxgl.Marker({ element: startEl }).setLngLat(route[0]).addTo(map);

      // End marker (skip if loop)
      const last = route[route.length - 1];
      const isLoop = Math.abs(last[0] - route[0][0]) < 0.0001 && Math.abs(last[1] - route[0][1]) < 0.0001;
      if (!isLoop) {
        const endEl = document.createElement("div");
        endEl.style.cssText =
          "width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)";
        new mapboxgl.Marker({ element: endEl }).setLngLat(last).addTo(map);
      }

      map.fitBounds(computeBounds(route), {
        padding: { top: 28, bottom: 28, left: 24, right: 24 },
        maxZoom: 15,
        duration: 0,
      });
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (route.length < 2) return null;

  return <div ref={containerRef} style={{ height, width: "100%" }} className="bg-slate-100" />;
}
