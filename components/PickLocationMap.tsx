"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GPXData } from "@/lib/gpx/parseGPX";
import { buildPlainGeoJSON } from "@/lib/elevation/elevationService";

type Props = {
  onLocationPick: (lat: number, lng: number, address?: string) => void;
  gpx?: GPXData | null;       // if provided, shows the GPX trace
  initialCenter?: [number, number];
  height?: string;
};

const DEFAULT_CENTER: [number, number] = [-0.5792, 44.8378];

async function reverseGeocode(lng: number, lat: number): Promise<string | undefined> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=fr&types=address,poi&access_token=${token}`
    );
    const json = await res.json();
    return json.features?.[0]?.place_name as string | undefined;
  } catch { return undefined; }
}

function computeBounds(coords: [number, number][]): mapboxgl.LngLatBoundsLike {
  const lngs = coords.map((p) => p[0]);
  const lats = coords.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export default function PickLocationMap({
  onLocationPick,
  gpx,
  initialCenter,
  height = "280px",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: initialCenter ?? DEFAULT_CENTER,
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // GPX trace
      if (gpx && gpx.coordinates.length >= 2) {
        map.addSource("gpx-route", { type: "geojson", data: buildPlainGeoJSON(gpx.coordinates) });
        map.addLayer({
          id: "gpx-glow",
          type: "line", source: "gpx-route",
          paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.15, "line-blur": 6 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
        map.addLayer({
          id: "gpx-line",
          type: "line", source: "gpx-route",
          paint: { "line-color": "#10b981", "line-width": 3.5, "line-opacity": 0.9 },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        // Start / end markers
        const startEl = document.createElement("div");
        startEl.style.cssText = "width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)";
        new mapboxgl.Marker({ element: startEl }).setLngLat(gpx.coordinates[0]).addTo(map);

        const last = gpx.coordinates[gpx.coordinates.length - 1];
        const isLoop = Math.abs(last[0] - gpx.coordinates[0][0]) < 0.0001 &&
                       Math.abs(last[1] - gpx.coordinates[0][1]) < 0.0001;
        if (!isLoop) {
          const endEl = document.createElement("div");
          endEl.style.cssText = "width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)";
          new mapboxgl.Marker({ element: endEl }).setLngLat(last).addTo(map);
        }

        map.fitBounds(computeBounds(gpx.coordinates), {
          padding: { top: 32, bottom: 32, left: 24, right: 24 },
          maxZoom: 15, duration: 0,
        });
      }
    });

    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#2563eb" })
          .setLngLat([lng, lat])
          .addTo(map);
      }
      const address = await reverseGeocode(lng, lat);
      onLocationPick(lat, lng, address);
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GPX trace when file changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!gpx || gpx.coordinates.length < 2) return;

    const data = buildPlainGeoJSON(gpx.coordinates);
    const src = map.getSource("gpx-route") as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data as Parameters<mapboxgl.GeoJSONSource["setData"]>[0]);
    } else {
      map.addSource("gpx-route", { type: "geojson", data });
      map.addLayer({ id: "gpx-glow", type: "line", source: "gpx-route",
        paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.15, "line-blur": 6 },
        layout: { "line-join": "round", "line-cap": "round" } });
      map.addLayer({ id: "gpx-line", type: "line", source: "gpx-route",
        paint: { "line-color": "#10b981", "line-width": 3.5, "line-opacity": 0.9 },
        layout: { "line-join": "round", "line-cap": "round" } });
    }
    map.fitBounds(computeBounds(gpx.coordinates), { padding: 32, maxZoom: 15, duration: 600 });
  }, [gpx]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-xl overflow-hidden border border-slate-200"
    />
  );
}
