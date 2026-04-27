import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

// GET /api/validations?userId=X
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return Response.json({ error: "userId requis" }, { status: 400 });

    const base = getBase();
    const records = await base("validations")
      .select({ filterByFormula: `{userId} = "${userId}"` })
      .all();

    const data = records.map((r) => ({
      id: r.id,
      sortieId:   r.fields["sortieId"]   as string,
      userId:     r.fields["userId"]     as string,
      status:     r.fields["status"]     as string,
      distanceKm: r.fields["distanceKm"] as number | null,
      durationMin:r.fields["durationMin"]as number | null,
      ressenti:   r.fields["ressenti"]   as string | null,
      createdAt:  r.fields["createdAt"]  as string,
    }));

    return Response.json(data);
  } catch (err) {
    console.error("validations GET error:", err);
    return Response.json([], { status: 200 }); // fail silently → empty list
  }
}

// POST /api/validations
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sortieId, userId, userEmail, status, distanceKm, durationMin, ressenti } = body;
    if (!sortieId || !userId || !status) {
      return Response.json({ error: "Données manquantes" }, { status: 400 });
    }

    const base = getBase();

    const allFields: Record<string, unknown> = {
      sortieId, userId, userEmail: userEmail ?? "",
      status, createdAt: new Date().toISOString(),
    };
    if (distanceKm != null) allFields.distanceKm = Number(distanceKm);
    if (durationMin != null) allFields.durationMin = Number(durationMin);
    if (ressenti) allFields.ressenti = ressenti;

    let record;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [record] = await base("validations").create([{ fields: allFields as any }]);
    } catch (e1) {
      console.error("validations POST attempt 1:", e1);
      // Fallback: core fields only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [record] = await base("validations").create([{ fields: { sortieId, userId, status, createdAt: new Date().toISOString() } as any }]);
    }

    return Response.json({ id: record.id }, { status: 201 });
  } catch (err) {
    console.error("validations POST error:", err);
    return Response.json({ error: "Erreur création" }, { status: 500 });
  }
}
