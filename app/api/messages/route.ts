import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortieId = searchParams.get("sortieId");

    if (!sortieId) {
      return Response.json({ error: "sortieId requis" }, { status: 400 });
    }

    const base = getBase();

    // Le sort Airtable sur un champ texte ISO peut échouer selon la config de
    // la table — on trie côté serveur pour éviter l'erreur.
    const records = await base("messages")
      .select({ filterByFormula: `{sortieId} = "${sortieId}"` })
      .all();

    const data = records
      .map((r) => ({
        id: r.id,
        sortieId: r.fields["sortieId"],
        userId: r.fields["userId"],
        email: r.fields["email"],
        message: r.fields["Message utilisateur"],
        createdAt: r.fields["createdAt"] as string ?? "",
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return Response.json(data);
  } catch (error) {
    console.error("Messages GET error:", error);
    return Response.json({ error: "Erreur lecture messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { sortieId, userId, email, message } = await request.json();

    if (!sortieId || !userId || !email || !message?.trim()) {
      return Response.json({ error: "Champs manquants" }, { status: 400 });
    }

    const base = getBase();
    const records = await base("messages").create([{
      fields: {
        sortieId,
        userId,
        email,
        "Message utilisateur": message.trim(),
        createdAt: new Date().toISOString(),
      },
    }]);

    return Response.json({ id: records[0].id }, { status: 201 });
  } catch (error) {
    console.error("Messages POST error:", error);
    return Response.json({ error: "Erreur envoi message" }, { status: 500 });
  }
}
