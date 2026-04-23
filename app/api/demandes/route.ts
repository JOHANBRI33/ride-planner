import Airtable, { type FieldSet } from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function GET() {
  try {
    // Tente un tri/filtre avancé, retombe sur un select simple si les colonnes n'existent pas
    let records;
    try {
      records = await getBase()("demandes")
        .select({
          filterByFormula: "OR({status} = 'open', {status} = '')",
          maxRecords: 50,
          sort: [{ field: "createdAt", direction: "desc" }],
        })
        .firstPage();
    } catch {
      records = await getBase()("demandes").select({ maxRecords: 50 }).firstPage();
    }

    return Response.json(
      records.map((r) => ({
        id: r.id,
        sport:     (r.fields["sport"]     as string) ?? "",
        message:   (r.fields["messages"]   as string) ?? "",
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
        interestedUsers: (r.fields["interested_users"] as string)
          ? (r.fields["interested_users"] as string).split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      }))
    );
  } catch (err) {
    const msg = (err as {message?:string})?.message ?? String(err);
    console.error("demandes GET error:", msg);
    return Response.json({ error: msg }, { status: 500 });
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
      messages:  body.message   ?? "",
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

    const base = getBase();

    // Attempt 1 : tous les champs
    // Attempt 2 : champs core seulement (si colonnes optionnelles absentes dans Airtable)
    let records;
    try {
      records = await base("demandes").create([{ fields }]);
    } catch (e1) {
      console.error("demandes POST attempt 1 failed:", JSON.stringify(e1));
      const coreFields: FieldSet = {
        sport:    fields.sport,
        messages: fields.messages ?? "",
        zone:     fields.zone,
        type:     fields.type,
        createdBy: fields.createdBy,
      };
      try {
        records = await base("demandes").create([{ fields: coreFields }]);
      } catch (e2) {
        console.error("demandes POST attempt 2 failed:", JSON.stringify(e2));
        const msg = (e2 as { message?: string })?.message ?? "Erreur création";
        return Response.json({ error: msg }, { status: 500 });
      }
    }

    return Response.json({ id: records[0].id }, { status: 201 });
  } catch (err) {
    console.error("demandes POST error:", err);
    return Response.json({ error: "Erreur création" }, { status: 500 });
  }
}
