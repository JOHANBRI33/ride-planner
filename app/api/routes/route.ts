import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function GET() {
  console.log("[GET /api/routes] called");

  try {
    const base = getBase();
    const records = await base("routes").select({ maxRecords: 200 }).all();

    if (records.length === 0) {
      console.log("[GET /api/routes] table vide");
      return Response.json([]);
    }

    const routes = records.map((r) => {
      const g = (f: string) => r.fields[f] ?? null;
      return {
        id:           r.id,
        name:         g("name"),
        sport:        g("sport"),
        distance_km:  g("distance_km"),
        duration_min: g("duration_min"),
        elevation:    g("elevation"),
        difficulty:   g("difficulty"),
        safety_score: g("safety_score"),
        traffic_level:g("traffic_level"),
        start_lat:    g("start_lat"),
        start_lng:    g("start_lng"),
        city:         g("city"),
        gpx_url:      g("gpx_url"),
      };
    });

    console.log(`[GET /api/routes] ${routes.length} parcours retournés`);
    return Response.json(routes);
  } catch (err) {
    console.error("[GET /api/routes] erreur Airtable:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
