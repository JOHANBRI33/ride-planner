import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

// POST /api/ratings  { sortieId, organizerId, raterId, ambiance, respect, niveauCoherence }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sortieId, organizerId, raterId, raterEmail, ambiance, respect, niveauCoherence } = body;
    if (!sortieId || !raterId || ambiance == null) {
      return Response.json({ error: "Données manquantes" }, { status: 400 });
    }

    const avg = Math.round(((Number(ambiance) + Number(respect) + Number(niveauCoherence)) / 3) * 10) / 10;
    const base = getBase();

    // 1. Save rating record
    try {
      await base("ratings").create([{
        fields: {
          sortieId, organizerId: organizerId ?? "",
          raterId, raterEmail: raterEmail ?? "",
          ambiance: Number(ambiance),
          respect: Number(respect),
          niveauCoherence: Number(niveauCoherence),
          avgScore: avg,
          createdAt: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }]);
    } catch (e1) {
      console.error("ratings create attempt 1:", e1);
      try {
        await base("ratings").create([{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fields: { sortieId, raterId, avgScore: avg, createdAt: new Date().toISOString() } as any,
        }]);
      } catch (e2) { console.error("ratings create attempt 2:", e2); }
    }

    // 2. Update sortie's rolling average
    try {
      const allRatings = await base("ratings")
        .select({ filterByFormula: `{sortieId} = "${sortieId}"` })
        .all();
      const scores = allRatings.map((r) => r.fields["avgScore"] as number).filter((n) => typeof n === "number");
      if (scores.length > 0) {
        const newAvg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await base("sorties").update(sortieId, { avgRating: newAvg, nbRatings: scores.length } as any);
      }
    } catch (e) { console.error("ratings update sortie avg:", e); }

    return Response.json({ success: true, avg }, { status: 201 });
  } catch (err) {
    console.error("ratings POST error:", err);
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
