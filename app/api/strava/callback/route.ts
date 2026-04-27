import { NextRequest } from "next/server";
import { upsertStravaToken } from "@/lib/strava";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error || !code) {
    return Response.redirect(`${appUrl}/dashboard?strava=denied`);
  }

  // Decode state
  let userId    = "";
  let userEmail = "";
  try {
    const parsed = JSON.parse(decodeURIComponent(state ?? "{}"));
    userId    = parsed.userId    ?? "";
    userEmail = parsed.userEmail ?? "";
  } catch {
    return Response.redirect(`${appUrl}/dashboard?strava=error`);
  }

  if (!userId) {
    return Response.redirect(`${appUrl}/dashboard?strava=error`);
  }

  // Exchange code for tokens
  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      console.error("Strava token exchange failed:", res.status, await res.text());
      return Response.redirect(`${appUrl}/dashboard?strava=error`);
    }

    const data = await res.json();

    await upsertStravaToken({
      userId,
      userEmail,
      athleteId:    String(data.athlete?.id ?? ""),
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    data.expires_at,
    });

    return Response.redirect(`${appUrl}/dashboard?strava=connected`);
  } catch (err) {
    console.error("Strava callback error:", err);
    return Response.redirect(`${appUrl}/dashboard?strava=error`);
  }
}
