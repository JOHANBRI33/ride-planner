import { NextRequest } from "next/server";
import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const base   = getBase();
    const record = await base("routes").find(id);
    const g = (f: string) => record.fields[f];

    return Response.json({
      id:            record.id,
      name:          g("name")          ?? "",
      sport:         g("sport")         ?? "",
      distance_km:   Number(g("distance_km")  ?? 0),
      duration_min:  Number(g("duration_min") ?? 0),
      elevation:     Number(g("elevation")    ?? 0),
      difficulty:    g("difficulty")    ?? "",
      safety_score:  Number(g("safety_score") ?? 0),
      traffic_level: g("traffic_level") ?? "medium",
      start_lat:     Number(g("start_lat")    ?? 0),
      start_lng:     Number(g("start_lng")    ?? 0),
      city:          g("city")          ?? "",
      gpx_url:       g("gpx_url")       ?? "",
    });
  } catch (err) {
    console.error("[GET /api/routes/[id]]", err);
    return Response.json({ error: "Parcours introuvable" }, { status: 404 });
  }
}
