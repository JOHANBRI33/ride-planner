import Airtable from "airtable";

// ─── Sport mapping Strava → RidePlanner ──────────────────────────────────────

export const STRAVA_SPORT_MAP: Record<string, string> = {
  Ride:         "Vélo",
  VirtualRide:  "Vélo",
  EBikeRide:    "Vélo",
  GravelRide:   "Vélo",
  MountainBikeRide: "Vélo",
  Run:          "Course à pied",
  VirtualRun:   "Course à pied",
  TrailRun:     "Trail",
  Hike:         "Randonnée",
  Walk:         "Randonnée",
  Swim:         "Natation",
  OpenWaterSwim:"Natation",
  Triathlon:    "Triathlon",
};

// ─── Airtable helper ─────────────────────────────────────────────────────────

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

// ─── Token management ─────────────────────────────────────────────────────────

export type StravaTokenRecord = {
  id: string;        // Airtable record ID
  userId: string;
  userEmail: string;
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix timestamp
};

export async function getStravaToken(userId: string): Promise<StravaTokenRecord | null> {
  try {
    const base = getBase();
    const records = await base("strava_tokens")
      .select({ filterByFormula: `{userId} = "${userId}"`, maxRecords: 1 })
      .firstPage();
    if (records.length === 0) return null;
    const r = records[0];
    return {
      id:           r.id,
      userId:       r.fields["userId"]       as string,
      userEmail:    r.fields["userEmail"]     as string,
      athleteId:    r.fields["athleteId"]     as string,
      accessToken:  r.fields["accessToken"]   as string,
      refreshToken: r.fields["refreshToken"]  as string,
      expiresAt:    Number(r.fields["expiresAt"] ?? 0),
    };
  } catch (err) {
    console.error("getStravaToken error:", err);
    return null;
  }
}

export async function upsertStravaToken(data: Omit<StravaTokenRecord, "id">): Promise<void> {
  const base = getBase();
  const existing = await getStravaToken(data.userId);

  const fields = {
    userId:       data.userId,
    userEmail:    data.userEmail,
    athleteId:    data.athleteId,
    accessToken:  data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt:    String(data.expiresAt),
  };

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base("strava_tokens").update(existing.id, fields as any);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base("strava_tokens").create([{ fields: fields as any }]);
  }
}

/** Returns a valid access token, refreshing if needed */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const token = await getStravaToken(userId);
  if (!token) return null;

  const now = Math.floor(Date.now() / 1000);

  // Still valid (with 5 min buffer)
  if (token.expiresAt > now + 300) return token.accessToken;

  // Refresh
  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type:    "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    const data = await res.json();

    await upsertStravaToken({
      userId:       token.userId,
      userEmail:    token.userEmail,
      athleteId:    token.athleteId,
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    data.expires_at,
    });

    return data.access_token as string;
  } catch (err) {
    console.error("getValidAccessToken refresh error:", err);
    return null;
  }
}

// ─── Fetch activities from Strava ─────────────────────────────────────────────

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string; // ISO date string
  distance: number;         // meters
  moving_time: number;      // seconds
  elapsed_time: number;
};

export async function fetchStravaActivities(
  accessToken: string,
  afterTimestamp?: number,
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: "50" });
  if (afterTimestamp) params.set("after", String(afterTimestamp));

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`);
  return res.json();
}

// ─── Match activity to sortie ─────────────────────────────────────────────────

export type SortieForMatch = {
  id: string;
  date: string;
  sport: string;
  distanceKm: number | null;
  route: string | null;
};

export function matchActivity(
  activity: StravaActivity,
  sorties: SortieForMatch[],
): SortieForMatch | null {
  const actDate   = activity.start_date_local.split("T")[0]; // YYYY-MM-DD
  const actSport  = STRAVA_SPORT_MAP[activity.sport_type] ?? STRAVA_SPORT_MAP[activity.type] ?? null;
  const actDistKm = activity.distance / 1000;

  if (!actSport) return null;

  for (const s of sorties) {
    // Date: ±1 day
    const diff = Math.abs(
      new Date(actDate).getTime() - new Date(s.date).getTime()
    ) / 86400000;
    if (diff > 1) continue;

    // Sport match
    if (s.sport !== actSport) continue;

    // Distance: sortie may not have one (accept if no distance stored)
    if (s.distanceKm != null && s.distanceKm > 0) {
      const ratio = actDistKm / s.distanceKm;
      if (ratio < 0.7 || ratio > 1.4) continue; // ±30% tolerance
    }

    return s;
  }

  return null;
}
