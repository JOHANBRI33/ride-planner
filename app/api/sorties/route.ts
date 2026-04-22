import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.organizerId || !body.organizerEmail) {
      return Response.json({ error: "Non authentifié" }, { status: 401 });
    }

    const base = getBase();
    // Champs garantis présents dans la table Airtable
    const coreFields: Record<string, unknown> = {
      Titre: body.titre,
      Date: body.date,
      Heure: body.heure,
      "Lieu précis": body.lieu,
      Sport: body.sport,
      "Niveau requis": body.niveau,
      "Participants max": Number(body.participantsMax),
    };

    // Champs optionnels — présents seulement si les colonnes existent dans Airtable.
    // Ajoute ces colonnes manuellement : Latitude (Number), Longitude (Number),
    // organizerId (Text), organizerEmail (Text), status (Text).
    const optionalFields: Record<string, unknown> = {};
    if (body.latitude != null)  optionalFields["Latitude"]       = body.latitude;
    if (body.longitude != null) optionalFields["Longitude"]      = body.longitude;
    if (body.organizerId)       optionalFields["organizerId"]    = body.organizerId;
    if (body.organizerEmail)    optionalFields["organizerEmail"] = body.organizerEmail;
    if (body.organizerId)       optionalFields["status"]         = "open";
    if (body.route)             optionalFields["route"]          = body.route;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function createRecord(fields: Record<string, any>) {
      const records = await base("sorties").create([{ fields }]);
      return records[0];
    }

    let record;
    try {
      record = await createRecord({ ...coreFields, ...optionalFields });
    } catch (e1) {
      console.error("Airtable POST attempt 1 failed:", JSON.stringify(e1));
      try {
        record = await createRecord(coreFields);
      } catch (e2) {
        console.error("Airtable POST attempt 2 failed:", JSON.stringify(e2));
        const msg = (e2 as { message?: string })?.message ?? "Erreur création";
        return Response.json({ error: msg }, { status: 500 });
      }
    }
    return Response.json({ id: record.id }, { status: 201 });
  } catch (error) {
    console.error("Airtable POST outer error:", JSON.stringify(error));
    return Response.json({ error: "Erreur création" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const base = getBase();
    const records = await base("sorties").select().firstPage();

    const data = records.map((record) => {
      const f = record.fields;
      return {
        id: record.id,
        titre: f["Titre"] || "",
        date: f["Date"],
        heure: f["Heure"],
        sport: f["Sport"],
        niveau: f["Niveau requis"],
        lieu: f["Lieu précis"],
        participantsMax: f["Participants max"],
        nbParticipants: f["Nb participants"],
        latitude: f["Latitude"] ?? null,
        longitude: f["Longitude"] ?? null,
        image: (f["Carte"] as { url: string }[] | undefined)?.[0]?.url || null,
        participantIds: f["Participants IDs"]
          ? (f["Participants IDs"] as string).split(",").map((s) => s.trim())
          : [],
        participantEmails: f["Participants emails"]
          ? (f["Participants emails"] as string).split(",").map((s) => s.trim())
          : [],
        organizerId: f["organizerId"] ?? null,
        organizerEmail: f["organizerEmail"] ?? null,
        status: (f["status"] as string) ?? "open",
        route: (f["route"] as string) ?? null,
      };
    });

    return Response.json(data);
  } catch (error) {
    console.error("Airtable GET error:", error);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}
