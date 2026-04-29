import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

// GET /api/favorites?userId=X  → liste des routeIds favoris
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return Response.json([], { status: 400 });

  try {
    const base = getBase();
    const records = await base("favorites")
      .select({ filterByFormula: `{userId} = "${userId}"` })
      .all();

    const routeIds = records.map((r) => ({
      id:      r.id,
      routeId: r.fields["routeId"] as string,
    }));

    return Response.json(routeIds);
  } catch (err) {
    console.error("[GET /api/favorites]", err);
    return Response.json([], { status: 200 }); // graceful empty
  }
}

// POST /api/favorites { userId, routeId }  → ajoute un favori
export async function POST(request: Request) {
  try {
    const { userId, routeId } = await request.json();
    if (!userId || !routeId) return Response.json({ error: "Params manquants" }, { status: 400 });

    const base = getBase();

    // Évite les doublons
    const existing = await base("favorites")
      .select({ filterByFormula: `AND({userId}="${userId}", {routeId}="${routeId}")`, maxRecords: 1 })
      .firstPage();
    if (existing.length > 0) return Response.json({ id: existing[0].id });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [record] = await base("favorites").create([{ fields: { userId, routeId } as any }]);
    return Response.json({ id: record.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/favorites]", err);
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/favorites { userId, routeId }  → supprime un favori
export async function DELETE(request: Request) {
  try {
    const { userId, routeId } = await request.json();
    if (!userId || !routeId) return Response.json({ error: "Params manquants" }, { status: 400 });

    const base = getBase();
    const records = await base("favorites")
      .select({ filterByFormula: `AND({userId}="${userId}", {routeId}="${routeId}")`, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) return Response.json({ ok: true });
    await base("favorites").destroy(records[0].id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/favorites]", err);
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
