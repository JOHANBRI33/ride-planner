import type { SlopeSegment, StoredRoute } from "@/lib/elevation/elevationService";

export type ParsedRoute = {
  geometry: [number, number][];
  distanceKm?: number;
  durationMin?: number;
  gain?: number;
  loss?: number;
  slopes?: SlopeSegment[];
};

/**
 * Parses the `route` field stored in Airtable.
 *
 * Supports two formats:
 *  - Legacy v1: `[[lng,lat], ...]`          — plain coordinate array
 *  - Current v2: `{ v:2, geometry, ... }`   — full StoredRoute object
 */
export function parseRoute(raw: string | null | undefined): ParsedRoute | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);

    // v1 — plain array
    if (Array.isArray(parsed)) {
      const geometry = parsed as [number, number][];
      if (geometry.length < 2) return null;
      return { geometry };
    }

    // v2 — StoredRoute object
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      (parsed as StoredRoute).v === 2 &&
      Array.isArray((parsed as StoredRoute).geometry)
    ) {
      const r = parsed as StoredRoute;
      return {
        geometry: r.geometry,
        distanceKm: r.distanceKm,
        durationMin: r.durationMin,
        gain: r.gain,
        loss: r.loss,
        slopes: r.slopes,
      };
    }

    return null;
  } catch {
    return null;
  }
}
