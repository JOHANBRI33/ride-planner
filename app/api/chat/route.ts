import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function GET() {
  try {
    const base = getBase();
    const records = await base("chat").select({ maxRecords: 60 }).all();
    const data = records
      .map((r) => ({
        id: r.id,
        userId: r.fields["userId"] as string,
        email: r.fields["email"] as string,
        message: r.fields["message"] as string,
        createdAt: (r.fields["createdAt"] as string) ?? "",
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return Response.json(data);
  } catch (error) {
    console.error("Chat GET error:", error);
    return Response.json({ error: "Erreur lecture" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, email, message } = await request.json();
    if (!userId || !email || !message?.trim()) {
      return Response.json({ error: "Champs manquants" }, { status: 400 });
    }
    const base = getBase();
    const records = await base("chat").create([{
      fields: {
        userId,
        email,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      },
    }]);
    return Response.json({ id: records[0].id }, { status: 201 });
  } catch (error) {
    console.error("Chat POST error:", error);
    return Response.json({ error: "Erreur envoi" }, { status: 500 });
  }
}
