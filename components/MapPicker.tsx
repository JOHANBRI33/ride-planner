"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Coords = { lat: number; lng: number };

type Props = {
  onChange: (coords: Coords, adresse?: string) => void;
  height?: string;
};

const DEFAULT_CENTER: [number, number] = [-0.5792, 44.8378];

export default function MapPicker({ onChange, height = "280px" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [picked, setPicked] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      placeMarker(map, lat, lng);
      const adresse = await reverseGeocode(lng, lat);
      onChange({ lat, lng }, adresse);
    });

    return () => map.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeMarker(map: mapboxgl.Map, lat: number, lng: number) {
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      markerRef.current = new mapboxgl.Marker({ color: "#2563eb" })
        .setLngLat([lng, lat])
        .addTo(map);
    }
    setPicked(true);
  }

  async function reverseGeocode(lng: number, lat: number): Promise<string | undefined> {
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=fr&types=address,poi&access_token=${token}`
      );
      const json = await res.json();
      return json.features?.[0]?.place_name as string | undefined;
    } catch {
      return undefined;
    }
  }

  function geolocate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [lng, lat], zoom: 14 });
        placeMarker(map, lat, lng);
        const adresse = await reverseGeocode(lng, lat);
        onChange({ lat, lng }, adresse);
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={geolocate}
        disabled={locating}
        className="self-start flex items-center gap-2 text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {locating ? "Localisation…" : "📍 Utiliser ma position"}
      </button>

      <div
        ref={containerRef}
        style={{ height }}
        className="w-full rounded-xl overflow-hidden border border-gray-200"
      />

      <p className="text-xs text-gray-400">
        {picked
          ? "✅ Position sélectionnée — le champ lieu a été rempli automatiquement"
          : "Clique sur la carte pour choisir le point de rendez-vous"}
      </p>
    </div>
  );
}
