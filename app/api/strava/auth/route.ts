import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId    = searchParams.get("userId");
  const userEmail = searchParams.get("userEmail") ?? "";

  if (!userId) {
    return Response.json({ error: "userId requis" }, { status: 400 });
  }

  const clientId   = process.env.STRAVA_CLIENT_ID;
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/strava/callback`;

  // Encode userId + userEmail in state so callback can retrieve them
  const state = encodeURIComponent(JSON.stringify({ userId, userEmail }));

  const stravaUrl =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=activity:read_all` +
    `&state=${state}`;

  return Response.redirect(stravaUrl);
}
