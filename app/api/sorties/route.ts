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
    if (body.image_url)         optionalFields["image_url"]      = body.image_url;
    if (body.distanceKm != null)  optionalFields["distanceKm"]     = Number(body.distanceKm);
    if (body.elevationGain != null) optionalFields["elevationGain"] = Number(body.elevationGain);
    if (body.route_geometry)      optionalFields["route_geometry"] = body.route_geometry;

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

// Bounding box métropolitaine France (lng_min, lat_min, lng_max, lat_max)
const FRANCE_BBOX = [-5.14, 41.33, 9.56, 51.09];

function inFrance(lng: number, lat: number): boolean {
  return lng >= FRANCE_BBOX[0] && lng <= FRANCE_BBOX[2]
      && lat >= FRANCE_BBOX[1] && lat <= FRANCE_BBOX[3];
}

// Geocode a place name → {lat, lng} using Mapbox, cached 24 h by Next.js fetch
// Uses types=address,place + bbox France to avoid results in the ocean
async function geocodeLieu(lieu: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return null;
    const bbox  = FRANCE_BBOX.join(",");
    const types = "address,place,locality,neighborhood";
    const url   = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lieu)}.json`
                + `?access_token=${token}&limit=1&country=fr&types=${types}&bbox=${bbox}&language=fr`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json   = await res.json();
    const center = json.features?.[0]?.center as [number, number] | undefined;
    if (!center) return null;
    const [lng, lat] = center;
    // Reject anything that landed outside France (safety net)
    if (!inFrance(lng, lat)) return null;
    return { lng, lat };
  } catch { return null; }
}

export async function GET() {
  try {
    const base = getBase();
    const records = await base("sorties").select().firstPage();

    const data = await Promise.all(records.map(async (record) => {
      const f = record.fields;
      let lat = (f["Latitude"] as number) ?? null;
      let lng = (f["Longitude"] as number) ?? null;

      // Auto-geocode records that have a place name but no coordinates
      if ((lat == null || lng == null) && f["Lieu précis"]) {
        const geo = await geocodeLieu(f["Lieu précis"] as string);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          // Persist back to Airtable so next request is instant
          base("sorties")
            .update([{ id: record.id, fields: { Latitude: geo.lat, Longitude: geo.lng } }])
            .catch(() => {});
        }
      }

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
        latitude: lat,
        longitude: lng,
        image: (f["Carte"] as { url: string }[] | undefined)?.[0]?.url || null,
        image_url: (f["image_url"] as string) ?? null,
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
        distanceKm: (f["distanceKm"] as number) ?? null,
        elevationGain: (f["elevationGain"] as number) ?? null,
        route_geometry: (f["route_geometry"] as string) ?? null,
      };
    }));

    return Response.json(data);
  } catch (error) {
    console.error("Airtable GET error:", error);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}
