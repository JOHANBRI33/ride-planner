type Point = [number, number]; // [lng, lat]

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlopeSegment = {
  coords: [Point, Point];
  pct: number;    // slope percentage (positive = uphill, negative = downhill)
  color: string;  // hex color
};

export type ElevationProfile = {
  gain: number;       // D+ in meters
  loss: number;       // D- in meters
  minElev: number;
  maxElev: number;
  slopes: SlopeSegment[];
};

export type StoredRoute = {
  v: 2;
  geometry: Point[];
  distanceKm: number;
  durationMin: number;
  gain?: number;
  loss?: number;
  slopes?: SlopeSegment[];
};

// ─── Slope color scale ────────────────────────────────────────────────────────

export function getSlopeColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 3)  return "#10b981"; // emerald — easy
  if (abs < 6)  return "#eab308"; // yellow  — moderate
  if (abs < 10) return "#f97316"; // orange  — hard
  return "#ef4444";               // red     — very hard
}

// ─── Difficulty label ─────────────────────────────────────────────────────────

export function getDifficulty(
  gainM: number,
  distKm: number,
): { label: string; color: string; bg: string } {
  const ratio = distKm > 0 ? gainM / distKm : 0; // m of gain per km
  if (gainM < 100 || ratio < 15)
    return { label: "Facile",         color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (gainM < 500 || ratio < 35)
    return { label: "Intermédiaire",  color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" };
  return   { label: "Difficile",      color: "text-red-700",     bg: "bg-red-50 border-red-200" };
}

// ─── Haversine distance (meters) ─────────────────────────────────────────────

export function haversine([lng1, lat1]: Point, [lng2, lat2]: Point): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Downsample geometry to at most maxPts points ─────────────────────────────

export function sampleGeometry(coords: Point[], maxPts = 150): Point[] {
  if (coords.length <= maxPts) return coords;
  const step = Math.ceil(coords.length / maxPts);
  const sampled = coords.filter((_, i) => i % step === 0);
  // Always include last point
  if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
    sampled.push(coords[coords.length - 1]);
  }
  return sampled;
}

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * Given a list of coords and matching elevation values (meters),
 * compute D+, D-, and per-segment slope data.
 *
 * minSegM: segments shorter than this (meters) are merged (noise filter).
 */
export function calculateElevationProfile(
  coords: Point[],
  elevations: number[],
  minSegM = 20,
): ElevationProfile {
  let gain = 0;
  let loss = 0;
  const slopes: SlopeSegment[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const dElev = elevations[i + 1] - elevations[i];
    const dDist = haversine(coords[i], coords[i + 1]);

    // Accumulate D+/D- (0.5 m threshold to filter GPS noise)
    if (dElev > 0.5) gain += dElev;
    if (dElev < -0.5) loss += Math.abs(dElev);

    if (dDist < minSegM) continue; // skip micro-segments
    const pct = (dElev / dDist) * 100;
    slopes.push({ coords: [coords[i], coords[i + 1]], pct, color: getSlopeColor(pct) });
  }

  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
    minElev: Math.round(Math.min(...elevations)),
    maxElev: Math.round(Math.max(...elevations)),
    slopes,
  };
}

// ─── GeoJSON builders ─────────────────────────────────────────────────────────

type GeoJSONFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "LineString"; coordinates: number[][] };
};

type GeoJSONCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

/** Multi-feature FeatureCollection — each 2-point segment carries its color. */
export function buildSlopeGeoJSON(slopes: SlopeSegment[]): GeoJSONCollection {
  return {
    type: "FeatureCollection",
    features: slopes.map((seg) => ({
      type: "Feature",
      properties: { color: seg.color, pct: Math.round(seg.pct) },
      geometry: { type: "LineString", coordinates: seg.coords },
    })),
  };
}

/** Plain green line when elevation data isn't available. */
export function buildPlainGeoJSON(coords: Point[]): GeoJSONCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { color: "#10b981" },
        geometry: { type: "LineString", coordinates: coords },
      },
    ],
  };
}
