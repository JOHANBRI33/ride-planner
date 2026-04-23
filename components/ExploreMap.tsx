"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

export default function ExploreMap({ height = "100%" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);

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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {/* Overlay label */}
      <div style={{
        position: "absolute",
        top: 12,
        left: 12,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        borderRadius: 12,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        color: "#1e293b",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        pointerEvents: "none",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        📍 Sorties disponibles autour de toi
      </div>
    </div>
  );
}
