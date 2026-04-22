import Airtable, { type FieldSet } from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.userId || !body.userEmail) {
      return Response.json({ error: "Non authentifié" }, { status: 401 });
    }

    const core: Record<string, unknown> = {
      userId:    body.userId,
      userEmail: body.userEmail,
      type:      body.type,        // "propose" | "search"
      date:      body.date ?? "",
      timeFrom:  body.timeFrom ?? "",
      sport:     body.sport ?? "",
      status:    "open",
      createdAt: new Date().toISOString(),
    };

    const optional: Record<string, unknown> = {};

    if (body.type === "propose") {
      if (body.level)              optional["level"]              = body.level;
      if (body.startAddress)       optional["startAddress"]       = body.startAddress;
      if (body.latitude  != null)  optional["latitude"]           = body.latitude;
      if (body.longitude != null)  optional["longitude"]          = body.longitude;
      if (body.gpxRoute)           optional["gpxRoute"]           = body.gpxRoute;   // JSON string
      if (body.distanceKm != null) optional["distanceKm"]         = body.distanceKm;
      if (body.elevationGain != null) optional["elevationGain"]   = body.elevationGain;
      if (body.maxParticipants)    optional["maxParticipants"]     = Number(body.maxParticipants);
      if (body.openToOtherRoutes != null) optional["openToOtherRoutes"] = body.openToOtherRoutes;
      if (body.description)        optional["description"]        = body.description;
    } else {
      if (body.timeTo)               optional["timeTo"]           = body.timeTo;
      if (body.searchLat  != null)   optional["searchLat"]        = body.searchLat;
      if (body.searchLng  != null)   optional["searchLng"]        = body.searchLng;
      if (body.searchLocation)       optional["searchLocation"]   = body.searchLocation;
      if (body.searchRadius != null) optional["searchRadius"]     = body.searchRadius;
      if (body.distanceMin != null)  optional["distanceMin"]      = body.distanceMin;
      if (body.distanceMax != null)  optional["distanceMax"]      = body.distanceMax;
      if (body.elevationType)        optional["elevationType"]    = body.elevationType;
      if (body.objective)            optional["objective"]        = body.objective;
      if (body.specificObjective)    optional["specificObjective"]= body.specificObjective;
      if (body.groupPreference)      optional["groupPreference"]  = body.groupPreference;
    }

    let record;
    try {
      const records = await getBase()("ride_requests").create([{ fields: { ...core, ...optional } as FieldSet }]);
      record = records[0];
    } catch {
      const records = await getBase()("ride_requests").create([{ fields: core as FieldSet }]);
      record = records[0];
    }

    return Response.json({ id: record.id }, { status: 201 });
  } catch (err) {
    console.error("ride_requests POST error:", err);
    return Response.json({ error: "Erreur création" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const records = await getBase()("ride_requests")
      .select({ filterByFormula: "{status} = 'open'", maxRecords: 100 })
      .firstPage();

    return Response.json(
      records.map((r) => ({ id: r.id, ...r.fields }))
    );
  } catch (err) {
    console.error("ride_requests GET error:", err);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}
