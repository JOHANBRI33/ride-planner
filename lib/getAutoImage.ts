/**
 * Returns a sport+location-keyed Unsplash image URL.
 * Falls back to sport-only if no location, then to generic sports.
 *
 * Priority at call site:
 *   sortie.image_url  →  getAutoImage(sport, lieu)  →  SPORT_IMAGE[sport]  →  SPORT_IMAGE.default
 */

const SPORT_SLUG: Record<string, string> = {
  "Course à pied": "running",
  "Vélo":          "cycling",
  "Randonnée":     "hiking",
  "Trail":         "trail+running",
  "Natation":      "swimming",
  "Triathlon":     "triathlon",
};

/**
 * Extracts the first meaningful word from a French location string.
 * "Parc de Bordeaux" → "Bordeaux"
 */
function extractCity(lieu: string): string {
  // Strip numbers and short prepositions, take first remaining word ≥ 4 chars
  const words = lieu
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^a-zA-ZÀ-ÿ]/g, ""))
    .filter((w) => w.length >= 4 && !/^(parc|rue|avenue|allée|place|chemin|rond)$/i.test(w));
  return words[0] ?? "";
}

export function getAutoImage(sport: string, lieu?: string | null): string {
  const sportSlug = SPORT_SLUG[sport] ?? "sport";
  const city = lieu ? extractCity(lieu) : "";
  const query = city ? `${sportSlug},${city}` : sportSlug;
  // source.unsplash.com is configured in next.config.ts → images.remotePatterns
  return `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`;
}

/** Static fallback images (no network variance) */
export const SPORT_IMAGE_FALLBACK: Record<string, string> = {
  "Course à pied": "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80",
  "Vélo":          "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&q=80",
  "Randonnée":     "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
  "Trail":         "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80",
  "Natation":      "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80",
  "Triathlon":     "https://images.unsplash.com/photo-1560073743-0107c7b2e5b4?w=800&q=80",
  "default":       "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
};

/**
 * Resolves the best image URL for a sortie card.
 * @param image_url  User-uploaded or manually set URL (highest priority)
 * @param sport      Sport category
 * @param lieu       Meeting location (used for contextual Unsplash query)
 */
export function resolveSortieImage(
  image_url: string | null | undefined,
  sport: string,
  lieu?: string | null,
): string {
  if (image_url) return image_url;
  return getAutoImage(sport, lieu);
}

/**
 * Generates a Mapbox Static API image URL for a route (LineString).
 * Returns empty string if no token or fewer than 2 points.
 */
export function getRouteStaticImageUrl(
  geometry: [number, number][],
  width = 400,
  height = 240,
): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || geometry.length < 2) return "";

  // Downsample to max 60 points to stay well within URL limits
  const maxPts = 60;
  const step = (geometry.length - 1) / (maxPts - 1);
  const pts: [number, number][] = geometry.length > maxPts
    ? Array.from({ length: maxPts }, (_, i) => geometry[Math.round(i * step)])
    : geometry;

  const geojson = JSON.stringify({
    type: "Feature",
    properties: { stroke: "#10b981", "stroke-width": 3, "stroke-opacity": 0.9 },
    geometry: { type: "LineString", coordinates: pts },
  });

  const encoded = encodeURIComponent(geojson);
  return (
    `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/` +
    `geojson(${encoded})/auto/${width}x${height}` +
    `?padding=30&access_token=${token}`
  );
}
