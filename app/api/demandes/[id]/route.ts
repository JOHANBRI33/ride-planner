import Airtable, { type FieldSet } from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

// PATCH ?action=interest  → ajouter l'utilisateur aux intéressés
// PATCH ?action=update    → modifier la demande (créateur uniquement)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "interest";
    const base = getBase();

    if (action === "interest") {
      const { userEmail } = await request.json();
      if (!userEmail) return Response.json({ error: "Non authentifié" }, { status: 401 });

      const record = await base("demandes").find(id);
      const raw = (record.fields["interested_users"] as string) ?? "";
      const list = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];

      if (list.includes(userEmail)) {
        return Response.json({ error: "Déjà intéressé" }, { status: 409 });
      }

      list.push(userEmail);
      const count = (record.fields["responses"] as number) ?? 0;

      try {
        await base("demandes").update([{
          id,
          fields: { interested_users: list.join(", "), responses: count + 1 },
        }]);
      } catch {
        // fallback si interested_users n'existe pas encore
        await base("demandes").update([{ id, fields: { responses: count + 1 } }]);
      }

      return Response.json({ responses: count + 1, interested_users: list });
    }

    if (action === "update") {
      const body = await request.json();
      const record = await base("demandes").find(id);

      // Vérification souple : createdBy peut être email complet ou partiel
      const storedBy = (record.fields["createdBy"] as string) ?? "";
      if (storedBy && storedBy !== body.userEmail && !body.userEmail?.startsWith(storedBy)) {
        return Response.json({ error: `Non autorisé (${storedBy} ≠ ${body.userEmail})` }, { status: 403 });
      }

      // Tente mise à jour complète, fallback sur champs core si colonnes manquantes
      const allFields: Partial<FieldSet> = {};
      if (body.sport)    allFields.sport    = body.sport;
      if (body.message !== undefined) allFields.messages = body.message;
      if (body.date)     allFields.date     = body.date;
      if (body.heure !== undefined)   allFields.heure    = body.heure;
      if (body.zone)     allFields.zone     = body.zone;
      if (body.distance !== undefined) allFields.distance = body.distance;
      if (body.denivele !== undefined) allFields.denivele = body.denivele;
      if (body.objectif !== undefined) allFields.objectif = body.objectif;
      if (body.type)     allFields.type     = body.type;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await base("demandes").update([{ id, fields: allFields as any }]);
      } catch (e1) {
        console.error("demandes update attempt 1 failed:", JSON.stringify(e1));
        // Fallback : uniquement sport, zone, type (colonnes de base garanties)
        const coreFields: Partial<FieldSet> = {};
        if (body.sport) coreFields.sport = body.sport;
        if (body.zone)  coreFields.zone  = body.zone;
        if (body.type)  coreFields.type  = body.type;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await base("demandes").update([{ id, fields: coreFields as any }]);
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: "Action inconnue" }, { status: 400 });
  } catch (err) {
    console.error("demandes PATCH error:", err);
    const msg = (err as { message?: string })?.message ?? "Erreur inconnue";
    console.error("demandes PATCH error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE → supprimer la demande (créateur uniquement)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userEmail } = await request.json();
    const base = getBase();

    const record = await base("demandes").find(id);
    if (record.fields["createdBy"] !== userEmail) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    await base("demandes").destroy(id);
    return Response.json({ success: true });
  } catch (err) {
    console.error("demandes DELETE error:", err);
    return Response.json({ error: "Erreur suppression" }, { status: 500 });
  }
}
