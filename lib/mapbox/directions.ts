export type TravelMode = "cycling" | "walking" | "driving";

export type DirectionsResult = {
  /** Coordonnées GeoJSON suivant les routes réelles */
  geometry: [number, number][];
  /** Distance totale en kilomètres */
  distanceKm: number;
  /** Durée estimée en minutes */
  durationMin: number;
};

/**
 * Appelle l'API Mapbox Directions pour obtenir un itinéraire réel
 * entre une liste de waypoints.
 *
 * @param waypoints  Liste de coordonnées [lng, lat]
 * @param mode       Mode de transport : cycling | walking | driving
 * @returns          Géométrie GeoJSON + distance (km) + durée (min)
 */
export async function getDirections(
  waypoints: [number, number][],
  mode: TravelMode = "cycling"
): Promise<DirectionsResult | null> {
  if (waypoints.length < 2) return null;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error("NEXT_PUBLIC_MAPBOX_TOKEN manquant");
    return null;
  }

  // Format attendu par l'API : "lng,lat;lng,lat;..."
  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coords}` +
    `?geometries=geojson&overview=full&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Mapbox Directions API error:", res.status, await res.text());
      return null;
    }

    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;

    return {
      geometry: route.geometry.coordinates as [number, number][],
      distanceKm: route.distance / 1000,
      durationMin: Math.round(route.duration / 60),
    };
  } catch (err) {
    console.error("getDirections error:", err);
    return null;
  }
}
