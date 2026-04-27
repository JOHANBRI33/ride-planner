import { NextRequest } from "next/server";
import Airtable from "airtable";
import {
  getValidAccessToken,
  fetchStravaActivities,
  matchActivity,
  STRAVA_SPORT_MAP,
  type SortieForMatch,
  type StravaActivity,
} from "@/lib/strava";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

/** Fetch past sorties where user is a participant (for matching) */
async function getUserSorties(userId: string): Promise<SortieForMatch[]> {
  const base = getBase();
  try {
    const records = await base("sorties")
      .select({
        filterByFormula: `FIND("${userId}", {Participants IDs}) > 0`,
      })
      .all();

    return records.map((r) => ({
      id:         r.id,
      date:       (r.fields["Date"] as string) ?? "",
      sport:      (r.fields["Sport"] as string) ?? "",
      distanceKm: (r.fields["distanceKm"] as number) ?? null,
      route:      (r.fields["route"] as string) ?? null,
    }));
  } catch {
    return [];
  }
}

/** Check which sortie IDs are already validated by this user */
async function getAlreadyValidated(userId: string): Promise<Set<string>> {
  const base = getBase();
  try {
    const records = await base("validations")
      .select({ filterByFormula: `{userId} = "${userId}"` })
      .all();
    return new Set(records.map((r) => r.fields["sortieId"] as string));
  } catch {
    return new Set();
  }
}

/** Save matched activity details to strava_activities table */
async function saveStravaActivity(
  activity: StravaActivity,
  userId: string,
  sortieId: string | null,
): Promise<void> {
  const base = getBase();
  try {
    // Check if already saved
    const existing = await base("strava_activities")
      .select({ filterByFormula: `{activityId} = "${activity.id}"`, maxRecords: 1 })
      .firstPage();
    if (existing.length > 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base("strava_activities").create([{ fields: {
      activityId:    String(activity.id),
      userId,
      name:          activity.name,
      sport_type:    activity.sport_type,
      startDate:     activity.start_date_local.split("T")[0],
      distanceKm:    Math.round((activity.distance / 1000) * 10) / 10,
      movingTimeMin: Math.round(activity.moving_time / 60),
      sortieId:      sortieId ?? "",
      matched:       sortieId ? "true" : "false",
    } as any }]);
  } catch (err) {
    console.error("saveStravaActivity error:", err);
  }
}

/** Auto-create a validation for a matched sortie */
async function autoValidate(
  sortieId: string,
  userId: string,
  userEmail: string,
  activity: StravaActivity,
): Promise<void> {
  const base = getBase();
  const distanceKm  = Math.round((activity.distance / 1000) * 10) / 10;
  const durationMin = Math.round(activity.moving_time / 60);

  const fields = {
    sortieId,
    userId,
    userEmail,
    status:      "oui",
    distanceKm,
    durationMin,
    ressenti:    "💪",
    source:      "strava",
    activityId:  String(activity.id),
    createdAt:   new Date().toISOString(),
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base("validations").create([{ fields: fields as any }]);
  } catch {
    // Fallback: core fields only
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await base("validations").create([{ fields: {
        sortieId, userId, status: "oui", source: "strava",
        activityId: String(activity.id), createdAt: new Date().toISOString(),
      } as any }]);
    } catch (err) {
      console.error("autoValidate fallback error:", err);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userEmail } = body as { userId: string; userEmail: string };

    if (!userId) {
      return Response.json({ error: "userId requis" }, { status: 400 });
    }

    // 1. Get valid Strava access token
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return Response.json({ error: "Non connecté à Strava" }, { status: 401 });
    }

    // 2. Fetch recent Strava activities (last 90 days)
    const after90d = Math.floor(Date.now() / 1000) - 90 * 86400;
    const activities = await fetchStravaActivities(accessToken, after90d);

    // 3. Get user's sorties + already-validated set
    const [sorties, alreadyValidated] = await Promise.all([
      getUserSorties(userId),
      getAlreadyValidated(userId),
    ]);

    // 4. Match + auto-validate
    const results: { activityId: number; name: string; sortieId: string | null; autoValidated: boolean }[] = [];

    for (const activity of activities) {
      // Only consider sports we know
      const sport = STRAVA_SPORT_MAP[activity.sport_type] ?? STRAVA_SPORT_MAP[activity.type];
      if (!sport) continue;

      const matched = matchActivity(activity, sorties);
      const autoValidated = !!(matched && !alreadyValidated.has(matched.id));

      // Save activity record
      await saveStravaActivity(activity, userId, matched?.id ?? null);

      // Auto-validate if matched and not yet done
      if (autoValidated && matched) {
        await autoValidate(matched.id, userId, userEmail, activity);
        alreadyValidated.add(matched.id); // prevent double-validation in same sync
      }

      results.push({
        activityId: activity.id,
        name:       activity.name,
        sortieId:   matched?.id ?? null,
        autoValidated,
      });
    }

    const matchedCount    = results.filter((r) => r.sortieId).length;
    const validatedCount  = results.filter((r) => r.autoValidated).length;

    return Response.json({
      total:     activities.length,
      matched:   matchedCount,
      validated: validatedCount,
      results,
    });
  } catch (err) {
    console.error("Strava sync error:", err);
    return Response.json({ error: "Erreur sync Strava" }, { status: 500 });
  }
}
