import { NextRequest } from "next/server";
import { getStravaToken } from "@/lib/strava";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ connected: false }, { status: 400 });
  }

  try {
    const token = await getStravaToken(userId);
    if (!token) return Response.json({ connected: false });
    return Response.json({ connected: true, athleteId: token.athleteId });
  } catch {
    return Response.json({ connected: false });
  }
}
