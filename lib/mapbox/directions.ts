export type TravelMode = "cycling" | "walking" | "driving";

// Mapbox profile par mode sportif
export const MAPBOX_PROFILE: Record<string, TravelMode> = {
  cycling:  "cycling",
  running:  "walking",   // Mapbox n'a pas de profil "running"
  walking:  "walking",
  hiking:   "walking",
  swimming: "walking",   // jamais appelé pour swimming
};

export type DirectionsResult = {
  geometry:    [number, number][];
  distanceKm:  number;
  durationMin: number;
};

/**
 * Appelle Mapbox Directions pour UNE paire de points (from → to).
 * N'envoie jamais plus de 2 waypoints → plus fiable, moins de timeouts.
 */
export async function getSegment(
  from:  [number, number],
  to:    [number, number],
  mode:  TravelMode = "cycling",
): Promise<DirectionsResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) { console.error("NEXT_PUBLIC_MAPBOX_TOKEN manquant"); return null; }

  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      console.error(`Directions API ${res.status}:`, txt);
      return null;
    }
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) { console.warn("Directions: aucun itinéraire trouvé"); return null; }

    return {
      geometry:    route.geometry.coordinates as [number, number][],
      distanceKm:  Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.round(route.duration / 60),
    };
  } catch (err) {
    console.error("getSegment error:", err);
    return null;
  }
}

/**
 * Compatibilité avec l'ancien code qui envoie N waypoints.
 * Découpe en segments A→B, B→C, … et concatène.
 */
export async function getDirections(
  waypoints: [number, number][],
  mode: TravelMode = "cycling",
): Promise<DirectionsResult | null> {
  if (waypoints.length < 2) return null;

  const results = await Promise.all(
    waypoints.slice(0, -1).map((from, i) => getSegment(from, waypoints[i + 1], mode))
  );

  const valid = results.filter(Boolean) as DirectionsResult[];
  if (valid.length === 0) return null;

  // Concatène les géométries (évite le point de jonction en double)
  const geometry = valid.reduce<[number, number][]>((acc, r, i) => {
    return acc.concat(i === 0 ? r.geometry : r.geometry.slice(1));
  }, []);

  return {
    geometry,
    distanceKm:  Math.round(valid.reduce((s, r) => s + r.distanceKm, 0) * 100) / 100,
    durationMin: valid.reduce((s, r) => s + r.durationMin, 0),
  };
}
