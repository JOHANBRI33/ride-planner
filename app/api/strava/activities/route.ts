import { NextRequest } from "next/server";
import { getValidAccessToken, fetchStravaActivities, STRAVA_SPORT_MAP } from "@/lib/strava";

export type StravaActivitySummary = {
  id:          number;
  name:        string;
  sport:       string;       // mapped to RidePlanner sport label
  sport_type:  string;       // raw Strava type
  date:        string;       // YYYY-MM-DD
  distanceKm:  number;
  durationMin: number;
  elevGain:    number;       // metres
};

export type StravaActivitiesResponse = {
  activities:   StravaActivitySummary[];
  stats: {
    totalActivities: number;
    totalKm:         number;
    totalMin:        number;
    mainSport:       string | null;
    // Current month
    monthKm:         number;
    monthMin:        number;
    monthActivities: number;
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId requis" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return Response.json({ error: "Non connecté à Strava" }, { status: 401 });
    }

    // Fetch last 90 days to compute monthly stats
    const after90d = Math.floor(Date.now() / 1000) - 90 * 86400;
    const raw = await fetchStravaActivities(accessToken, after90d);

    // Current month boundaries
    const now       = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Map + filter to known sports, limit display to 20
    const activities: StravaActivitySummary[] = raw
      .slice(0, 50) // process at most 50 for stats
      .map((a) => ({
        id:          a.id,
        name:        a.name,
        sport:       STRAVA_SPORT_MAP[a.sport_type] ?? STRAVA_SPORT_MAP[a.type] ?? a.sport_type,
        sport_type:  a.sport_type,
        date:        a.start_date_local.split("T")[0],
        distanceKm:  Math.round((a.distance / 1000) * 10) / 10,
        durationMin: Math.round(a.moving_time / 60),
        elevGain:    Math.round((a as { total_elevation_gain?: number }).total_elevation_gain ?? 0),
      }));

    // Monthly stats
    const monthly = activities.filter((a) => a.date >= monthStart && a.date <= monthEnd);
    const monthKm  = Math.round(monthly.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10;
    const monthMin = monthly.reduce((s, a) => s + a.durationMin, 0);

    // Sport frequency (all 90 days)
    const sportCount: Record<string, number> = {};
    for (const a of activities) {
      sportCount[a.sport] = (sportCount[a.sport] ?? 0) + 1;
    }
    const mainSport = Object.keys(sportCount).sort((a, b) => sportCount[b] - sportCount[a])[0] ?? null;

    const totalKm  = Math.round(activities.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10;
    const totalMin = activities.reduce((s, a) => s + a.durationMin, 0);

    const response: StravaActivitiesResponse = {
      activities: activities.slice(0, 20), // display max 20
      stats: {
        totalActivities: activities.length,
        totalKm,
        totalMin,
        mainSport,
        monthKm,
        monthMin,
        monthActivities: monthly.length,
      },
    };

    return Response.json(response, {
      headers: {
        // Cache 5 min sur Vercel CDN — userId in URL so no collision
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[GET /api/strava/activities]", err);
    return Response.json({ error: "Erreur Strava" }, { status: 500 });
  }
}
