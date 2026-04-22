import { haversine } from "@/lib/elevation/elevationService";

export type GPXData = {
  coordinates: [number, number][]; // [lng, lat]
  elevations: number[];
  distanceKm: number;
  elevationGain: number;
  name?: string;
};

const MAX_POINTS = 500;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  const result = arr.filter((_, i) => i % step === 0);
  if (result[result.length - 1] !== arr[arr.length - 1]) {
    result.push(arr[arr.length - 1]);
  }
  return result;
}

export function parseGPX(xmlString: string): GPXData | null {
  if (typeof window === "undefined") return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  if (doc.querySelector("parsererror")) return null;

  // trkpt > rtept > wpt fallback
  let pts = Array.from(doc.querySelectorAll("trkpt"));
  if (pts.length === 0) pts = Array.from(doc.querySelectorAll("rtept"));
  if (pts.length === 0) pts = Array.from(doc.querySelectorAll("wpt"));
  if (pts.length < 2) return null;

  const name = doc.querySelector("name")?.textContent?.trim() ?? undefined;

  const rawCoords: [number, number][] = [];
  const rawElevs: number[] = [];

  for (const pt of pts) {
    const lat = parseFloat(pt.getAttribute("lat") ?? "");
    const lon = parseFloat(pt.getAttribute("lon") ?? "");
    if (isNaN(lat) || isNaN(lon)) continue;
    const ele = parseFloat(pt.querySelector("ele")?.textContent ?? "0");
    rawCoords.push([lon, lat]);
    rawElevs.push(isNaN(ele) ? 0 : ele);
  }

  if (rawCoords.length < 2) return null;

  const coordinates = downsample(rawCoords, MAX_POINTS);
  const elevations = downsample(rawElevs, MAX_POINTS);

  // Distance (Haversine)
  let distanceM = 0;
  for (let i = 1; i < coordinates.length; i++) {
    distanceM += haversine(coordinates[i - 1], coordinates[i]);
  }

  // D+
  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0.5) gain += diff;
  }

  return {
    coordinates,
    elevations,
    distanceKm: distanceM / 1000,
    elevationGain: Math.round(gain),
    name,
  };
}
