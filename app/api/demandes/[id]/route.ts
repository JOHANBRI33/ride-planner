import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

// PATCH /api/demandes/[id] — increment responses counter
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const base = getBase();

    // Fetch current count
    const record = await base("demandes").find(id);
    const current = (record.fields["responses"] as number) ?? 0;

    await base("demandes").update([{ id, fields: { responses: current + 1 } }]);
    return Response.json({ responses: current + 1 });
  } catch (err) {
    console.error("demandes PATCH error:", err);
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
