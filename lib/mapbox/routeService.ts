import { getDirections, type TravelMode, type DirectionsResult } from "./directions";

// ─── In-memory cache keyed by waypoints + mode ────────────────────────────────

const cache = new Map<string, DirectionsResult>();

function key(waypoints: [number, number][], mode: TravelMode): string {
  return `${mode}|${waypoints.map((p) => p.join(",")).join("|")}`;
}

export async function getRoute(
  waypoints: [number, number][],
  mode: TravelMode = "cycling",
): Promise<DirectionsResult | null> {
  const k = key(waypoints, mode);
  if (cache.has(k)) return cache.get(k)!;
  const result = await getDirections(waypoints, mode);
  if (result) cache.set(k, result);
  return result;
}

export function clearRouteCache() {
  cache.clear();
}
