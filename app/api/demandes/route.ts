import Airtable, { type FieldSet } from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function GET() {
  try {
    const records = await getBase()("demandes")
      .select({
        filterByFormula: "OR({status} = 'open', {status} = '')",
        maxRecords: 50,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .firstPage();

    return Response.json(
      records.map((r) => ({
        id: r.id,
        sport:     (r.fields["sport"]     as string) ?? "",
        message:   (r.fields["message"]   as string) ?? "",
        date:      (r.fields["date"]      as string) ?? "",
        heure:     (r.fields["heure"]     as string) ?? "",
        zone:      (r.fields["zone"]      as string) ?? "",
        distance:  (r.fields["distance"]  as string) ?? "",
        denivele:  (r.fields["denivele"]  as string) ?? "",
        objectif:  (r.fields["objectif"]  as string) ?? "",
        type:      (r.fields["type"]      as string) ?? "cherche",
        createdBy: (r.fields["createdBy"] as string) ?? "",
        responses: (r.fields["responses"] as number) ?? 0,
        status:    (r.fields["status"]    as string) ?? "open",
        createdAt: (r.fields["createdAt"] as string) ?? "",
      }))
    );
  } catch (err) {
    console.error("demandes GET error:", err);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.createdBy) {
      return Response.json({ error: "Non authentifié" }, { status: 401 });
    }

    const fields: FieldSet = {
      sport:     body.sport     ?? "",
      message:   body.message   ?? "",
      date:      body.date      ?? "",
      heure:     body.heure     ?? "",
      zone:      body.zone      ?? "",
      distance:  body.distance  ?? "",
      denivele:  body.denivele  ?? "",
      objectif:  body.objectif  ?? "",
      type:      body.type      ?? "cherche",
      createdBy: body.createdBy,
      responses: 0,
      status:    "open",
      createdAt: new Date().toISOString(),
    };

    const records = await getBase()("demandes").create([{ fields }]);
    return Response.json({ id: records[0].id }, { status: 201 });
  } catch (err) {
    console.error("demandes POST error:", err);
    return Response.json({ error: "Erreur création" }, { status: 500 });
  }
}
