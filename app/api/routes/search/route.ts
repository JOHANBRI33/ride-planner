import { NextRequest } from "next/server";
import Airtable from "airtable";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteRecord = {
  id:            string;
  name:          string;
  sport:         string;
  distance_km:   number;
  duration_min:  number;
  elevation:     number;
  difficulty:    string;
  safety_score:  number;   // 0–5
  traffic_level: string;   // "low" | "medium" | "high"
  start_lat:     number;
  start_lng:     number;
  city:          string;
  gpx_url:       string;
};

type ScoredRoute = RouteRecord & { score: number; distanceToUser: number | null };

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Airtable ─────────────────────────────────────────────────────────────────

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

function parseRoute(r: Airtable.Record<Airtable.FieldSet>): RouteRecord {
  const g = (f: string) => r.fields[f];
  return {
    id:            r.id,
    name:          (g("name")          as string)  ?? "",
    sport:         (g("sport")         as string)  ?? "",
    distance_km:   Number(g("distance_km")  ?? 0),
    duration_min:  Number(g("duration_min") ?? 0),
    elevation:     Number(g("elevation")    ?? 0),
    difficulty:    (g("difficulty")    as string)  ?? "",
    safety_score:  Number(g("safety_score") ?? 0),
    traffic_level: (g("traffic_level") as string)  ?? "medium",
    start_lat:     Number(g("start_lat")    ?? 0),
    start_lng:     Number(g("start_lng")    ?? 0),
    city:          (g("city")          as string)  ?? "",
    gpx_url:       (g("gpx_url")       as string)  ?? "",
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreRoute(
  route: RouteRecord,
  params: {
    distMin: number; distMax: number;
    sport: string; difficulty: string;
    lat: number | null; lng: number | null;
  },
): { score: number; distanceToUser: number | null } {
  let score = 0;

  // Exclure trafic élevé
  if (route.traffic_level === "high") return { score: -1, distanceToUser: null };

  // Distance match (+3)
  if (route.distance_km >= params.distMin && route.distance_km <= params.distMax) {
    score += 3;
  } else {
    // Partial match si à 20% hors range
    const lo = params.distMin * 0.8;
    const hi = params.distMax * 1.2;
    if (route.distance_km >= lo && route.distance_km <= hi) score += 1;
  }

  // Sport match (+2) — skip si non précisé
  if (params.sport && route.sport === params.sport) score += 2;

  // Difficulté match (+1)
  if (params.difficulty && route.difficulty === params.difficulty) score += 1;

  // Safety score (+0 à +2 selon score)
  score += (route.safety_score / 5) * 2;

  // Proximité
  let distanceToUser: number | null = null;
  if (params.lat !== null && params.lng !== null && route.start_lat && route.start_lng) {
    distanceToUser = Math.round(haversineKm(params.lat, params.lng, route.start_lat, route.start_lng) * 10) / 10;
    if (distanceToUser <= 10)      score += 2;
    else if (distanceToUser <= 30) score += 1;
  }

  return { score, distanceToUser };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const distMin    = Number(searchParams.get("distance_min") ?? 0);
  const distMax    = Number(searchParams.get("distance_max") ?? 999);
  const sport      = searchParams.get("sport")      ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";
  const lat        = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const lng        = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;

  try {
    const base    = getBase();
    const records = await base("routes").select({ maxRecords: 200 }).all();
    const routes  = records.map(parseRoute);

    const scored: ScoredRoute[] = routes
      .map((r) => {
        const { score, distanceToUser } = scoreRoute(r, { distMin, distMax, sport, difficulty, lat, lng });
        return { ...r, score, distanceToUser };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return Response.json({ routes: scored }, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[GET /api/routes/search]", err);
    return Response.json({ routes: [] }, { status: 200 }); // graceful empty
  }
}
