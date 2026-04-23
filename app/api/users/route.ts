import Airtable from "airtable";

const ADMIN_EMAIL = "bridey.johan@neuf.fr";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

function sanitize(email: string) {
  return email.replace(/"/g, '\\"');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return Response.json({ error: "Email requis" }, { status: 400 });

  try {
    const base = getBase();
    const records = await base("utilisateurs")
      .select({ filterByFormula: `{Email} = "${sanitize(email)}"`, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) return Response.json(null);

    const r = records[0];
    const get = (f: string) => r.get(f) ?? null;

    return Response.json({
      airtableId: r.id,
      email: get("Email"),
      sexe: get("sexe"),
      ageRange: get("ageRange"),
      sports: get("sports"),
      goal: get("goal"),
      description: get("description"),
      avatarKey: get("avatarKey"),
      photoUrl: get("photoUrl"),
      onboardingDone: get("onboardingDone"),
      cycling_level: get("cycling_level"),
      cycling_bikeType: get("cycling_bikeType"),
      cycling_mechanicalSkill: get("cycling_mechanicalSkill"),
      running_pace: get("running_pace"),
      running_terrain: get("running_terrain"),
      running_distance: get("running_distance"),
      hiking_duration: get("hiking_duration"),
      hiking_elevationGain: get("hiking_elevationGain"),
      hiking_groupPref: get("hiking_groupPref"),
      swimming_level: get("swimming_level"),
      swimming_distance: get("swimming_distance"),
    });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.email) return Response.json({ error: "Email requis" }, { status: 400 });

    const base = getBase();

    // Check if user already exists
    const existing = await base("utilisateurs")
      .select({ filterByFormula: `{Email} = "${sanitize(body.email)}"`, maxRecords: 1 })
      .firstPage();

    const fields: Record<string, unknown> = {
      Email: body.email,
    };

    // Optional profile fields — added only if provided
    const optional: Record<string, string> = {
      sexe: body.sexe,
      ageRange: body.ageRange,
      sports: body.sports,
      goal: body.goal,
      description: body.description,
      avatarKey: body.avatarKey,
      photoUrl: body.photoUrl,
      onboardingDone: body.onboardingDone ?? "true",
      cycling_level: body.cycling_level,
      cycling_bikeType: body.cycling_bikeType,
      cycling_mechanicalSkill: body.cycling_mechanicalSkill,
      running_pace: body.running_pace,
      running_terrain: body.running_terrain,
      running_distance: body.running_distance,
      hiking_duration: body.hiking_duration,
      hiking_elevationGain: body.hiking_elevationGain,
      hiking_groupPref: body.hiking_groupPref,
      swimming_level: body.swimming_level,
      swimming_distance: body.swimming_distance,
    };

    for (const [k, v] of Object.entries(optional)) {
      if (v != null && v !== "") fields[k] = v;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fields as any;
    if (existing.length > 0) {
      await base("utilisateurs").update(existing[0].id, f);
      return Response.json({ ok: true, airtableId: existing[0].id });
    } else {
      const records = await base("utilisateurs").create([{ fields: f }]);
      return Response.json({ ok: true, airtableId: records[0].id });
    }
  } catch (err) {
    console.error("[POST /api/users]", err);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { airtableId, requestingEmail, ...updates } = body;

    if (!airtableId || !requestingEmail) {
      return Response.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    // Verify the requesting user owns this record or is admin
    const base = getBase();
    const record = await base("utilisateurs").find(airtableId);
    const recordEmail = record.get("Email") as string;

    if (requestingEmail !== recordEmail && requestingEmail !== ADMIN_EMAIL) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    const fields: Record<string, unknown> = {};
    const allowed = [
      "sexe", "ageRange", "sports", "goal", "description", "avatarKey", "photoUrl",
      "cycling_level", "cycling_bikeType", "cycling_mechanicalSkill",
      "running_pace", "running_terrain", "running_distance",
      "hiking_duration", "hiking_elevationGain", "hiking_groupPref",
      "swimming_level", "swimming_distance",
    ];
    for (const k of allowed) {
      if (updates[k] !== undefined) fields[k] = updates[k];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await base("utilisateurs").update(airtableId, fields as any);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/users]", err);
    return Response.json({ error: "Erreur Airtable" }, { status: 500 });
  }
}
