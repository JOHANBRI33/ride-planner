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
  "Vélo":           "#3b82f6",  // blue
  "Course à pied":  "#ef4444",  // red
  "Trail":          "#22c55e",  // green
  "Natation":       "#06b6d4",  // cyan
  "Randonnée":      "#10b981",  // emerald
  "Triathlon":      "#f59e0b",  // amber
};

const DEFAULT_COLOR = "#6366f1";

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "⛰️",
  "Natation": "🏊", "Randonnée": "🥾", "Triathlon": "🏅",
};

function sportColor(sport: string) {
  return SPORT_COLOR[sport] ?? DEFAULT_COLOR;
}

// ── Build GeoJSON ──────────────────────────────────────────────────────────

function buildFeatures(sorties: MapSortie[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sorties
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [s.longitude!, s.latitude!],
        },
        properties: {
          id: s.id,
          titre: s.titre,
          lieu: s.lieu,
          date: s.date,
          heure: s.heure,
          sport: s.sport,
          niveau: s.niveau ?? "",
          image: resolveSortieImage(s.image_url ?? s.image, s.sport, s.lieu),
          color: sportColor(s.sport),
          emoji: SPORT_EMOJI[s.sport] ?? "🏅",
          participants: s.nbParticipants ?? 0,
          participantsMax: s.participantsMax ?? 0,
          isClosed: s.status === "closed" ? 1 : 0,
        },
      })),
  };
}

// ── Popup HTML ─────────────────────────────────────────────────────────────

function buildPopupHTML(p: Record<string, string>): string {
  const pct = Number(p.participantsMax) > 0
    ? Math.min(100, Math.round((Number(p.participants) / Number(p.participantsMax)) * 100))
    : 0;
  const barColor = pct >= 80 ? "#f97316" : "#10b981";

  return `
    <div style="width:220px;font-family:system-ui,sans-serif;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.15);">
      <div style="position:relative;height:110px;overflow:hidden;">
        <img src="${p.image}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=60'" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 60%)"></div>
        <div style="position:absolute;top:8px;right:8px;background:${p.color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;">${p.sport}</div>
        <div style="position:absolute;bottom:8px;left:8px;right:8px;color:#fff;font-size:13px;font-weight:700;line-height:1.2;">${p.titre}</div>
      </div>
      <div style="padding:10px 12px;background:#fff;">
        <div style="display:flex;gap:8px;font-size:11px;color:#64748b;margin-bottom:6px;">
          <span>📍 ${p.lieu}</span>
        </div>
        <div style="display:flex;gap:8px;font-size:11px;color:#64748b;margin-bottom:8px;">
          <span>📅 ${p.date}</span>
          ${p.niveau ? `<span style="background:#f1f5f9;padding:1px 6px;border-radius:8px;font-weight:600;">${p.niveau}</span>` : ""}
        </div>
        ${Number(p.participantsMax) > 0 ? `
          <div style="background:#f1f5f9;border-radius:8px;height:4px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:8px;"></div>
          </div>
          <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${p.participants}/${p.participantsMax} participants</div>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const router = useRouter();

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-0.5792, 44.8378],
      zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-right");
    mapRef.current = map;

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: "explore-popup",
    });
    popupRef.current = popup;

    map.on("load", () => {
      const data = buildFeatures(sorties);

      // ── Source with clustering ──────────────────────────────────────────
      map.addSource("sorties", {
        type: "geojson",
        data,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 55,
      });

      // ── Cluster circle ──────────────────────────────────────────────────
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "sorties",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#6366f1", 5, "#8b5cf6", 10, "#7c3aed"],
          "circle-radius": ["step", ["get", "point_count"], 22, 5, 30, 10, 38],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.92,
        },
      });

      // ── Cluster count ───────────────────────────────────────────────────
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "sorties",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#fff" },
      });

      // ── Unclustered glow ────────────────────────────────────────────────
      map.addLayer({
        id: "sorties-glow",
        type: "circle",
        source: "sorties",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 22,
          "circle-opacity": 0.15,
          "circle-blur": 0.6,
        },
      });

      // ── Unclustered points ──────────────────────────────────────────────
      map.addLayer({
        id: "sorties-points",
        type: "circle",
        source: "sorties",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 11,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.95,
        },
      });

      // ── Hover highlight layer ───────────────────────────────────────────
      map.addLayer({
        id: "sorties-hover",
        type: "circle",
        source: "sorties",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 16,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
          "circle-opacity": 1,
        },
      });

      // ── Auto-zoom to active sorties ─────────────────────────────────────
      const validSorties = sorties.filter((s) => s.latitude && s.longitude);
      if (validSorties.length > 0) {
        const lngs = validSorties.map((s) => s.longitude!);
        const lats = validSorties.map((s) => s.latitude!);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 13, duration: 800 }
        );
      }

      // ── Hover interactions ──────────────────────────────────────────────
      map.on("mouseenter", "sorties-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const props = feature.properties as Record<string, string>;
        onHover(props.id);

        popup
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(buildPopupHTML(props))
          .addTo(map);
      });

      map.on("mouseleave", "sorties-points", () => {
        map.getCanvas().style.cursor = "";
        onHover(null);
        popup.remove();
      });

      // ── Click on point ──────────────────────────────────────────────────
      map.on("click", "sorties-points", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as Record<string, string>;
        router.push(`/sorties/${props.id}`);
      });

      // ── Click on cluster → zoom in ──────────────────────────────────────
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;
        (map.getSource("sorties") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || zoom == null) return;
            const geo = features[0].geometry;
            if (geo.type !== "Point") return;
            map.easeTo({ center: geo.coordinates as [number, number], zoom });
          }
        );
      });

      map.on("mouseenter", "clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "clusters", () => { map.getCanvas().style.cursor = ""; });
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update data when sorties change ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("sorties") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(buildFeatures(sorties) as Parameters<mapboxgl.GeoJSONSource["setData"]>[0]);
  }, [sorties]);

  // ── Sync hovered marker from list ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setFilter("sorties-hover", ["==", ["get", "id"], hoveredId ?? ""]);

    if (hoveredId) {
      const feature = map.querySourceFeatures("sorties", {
        sourceLayer: "",
        filter: ["==", ["get", "id"], hoveredId],
      })[0];
      if (feature?.geometry?.type === "Point") {
        map.easeTo({ center: feature.geometry.coordinates as [number, number], duration: 300 });
      }
    }
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
