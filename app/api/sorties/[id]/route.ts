import Airtable from "airtable";

function getBase() {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
}

function downsample(pts: [number, number][], maxPts = 300): [number, number][] {
  if (!Array.isArray(pts) || pts.length <= maxPts) return pts;
  const step = (pts.length - 1) / (maxPts - 1);
  return Array.from({ length: maxPts }, (_, i) => pts[Math.round(i * step)]);
}

function sanitizeRoute(raw: string): string {
  try {
    const r = JSON.parse(raw);
    if (r && typeof r === "object" && r.v === 2) {
      return JSON.stringify({ v: 2, geometry: downsample(r.geometry ?? []), distanceKm: r.distanceKm, durationMin: r.durationMin, gain: r.gain, loss: r.loss });
    }
    if (Array.isArray(r)) return JSON.stringify(downsample(r));
    return raw;
  } catch { return raw; }
}

// PATCH : rejoindre (?action=join, défaut), clôturer (?action=close), quitter (?action=leave), modifier tracé (?action=updateRoute)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "join";
    const body = await request.json();
    const base = getBase();

    // ── Mettre à jour le tracé ────────────────────────────────────────────────
    if (action === "updateRoute") {
      const { userId, route, route_geometry, distanceKm, elevationGain } = body;
      const record = await base("sorties").find(id);
      const ADMIN = "bridey.johan@neuf.fr";
      const orgId = record.fields["organizerId"] as string | undefined;
      const orgEmail = record.fields["organizerEmail"] as string | undefined;
      if (userId !== orgId && orgEmail !== ADMIN) {
        return Response.json({ error: "Non autorisé" }, { status: 403 });
      }
      const fields: Record<string, unknown> = {};
      if (route)          fields["route"]          = sanitizeRoute(route);
      if (route_geometry) fields["route_geometry"]  = JSON.stringify(downsample(JSON.parse(route_geometry)));
      if (distanceKm != null)   fields["distanceKm"]     = Number(distanceKm);
      if (elevationGain != null) fields["elevationGain"] = Number(elevationGain);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await base("sorties").update(id, fields as any);
      return Response.json({ success: true });
    }

    // ── Clôturer ──────────────────────────────────────────────────────────────
    if (action === "close") {
      const { userId } = body;
      const record = await base("sorties").find(id);
      if (record.fields["organizerId"] !== userId) {
        return Response.json({ error: "Non autorisé" }, { status: 403 });
      }
      await base("sorties").update(id, { status: "closed" });
      return Response.json({ success: true });
    }

    // ── Quitter ───────────────────────────────────────────────────────────────
    if (action === "leave") {
      const { userId, userEmail } = body;
      if (!userId) return Response.json({ error: "Non authentifié" }, { status: 401 });

      const record = await base("sorties").find(id);
      const f = record.fields;

      const rawIds = (f["Participants IDs"] as string) ?? "";
      const ids = rawIds ? rawIds.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const newIds = ids.filter((x) => x !== userId);
      if (newIds.length === ids.length) return Response.json({ error: "Pas inscrit" }, { status: 409 });

      const rawEmails = (f["Participants emails"] as string) ?? "";
      const emails = rawEmails ? rawEmails.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const newEmails = emails.filter((x) => x !== userEmail);

      const currentCount = (f["Nb participants"] as number) ?? 0;
      try {
        await base("sorties").update(id, {
          "Nb participants": Math.max(0, currentCount - 1),
          "Participants IDs": newIds.join(", "),
          "Participants emails": newEmails.join(", "),
        });
      } catch {
        await base("sorties").update(id, {
          "Participants IDs": newIds.join(", "),
          "Participants emails": newEmails.join(", "),
        });
      }
      return Response.json({ success: true });
    }

    // ── Rejoindre ──────────────────────────────────────────────────────────────
    const { userId, userEmail } = body;
    if (!userId || !userEmail) {
      return Response.json({ error: "Non authentifié" }, { status: 401 });
    }

    const record = await base("sorties").find(id);
    const f = record.fields;

    if ((f["status"] as string) === "closed") {
      return Response.json({ error: "Sortie clôturée" }, { status: 409 });
    }

    const currentCount = (f["Nb participants"] as number) ?? 0;
    const max = (f["Participants max"] as number) ?? Infinity;
    if (currentCount >= max) {
      return Response.json({ error: "Complet" }, { status: 409 });
    }

    const rawIds = (f["Participants IDs"] as string) ?? "";
    const ids = rawIds ? rawIds.split(",").map((s) => s.trim()) : [];
    if (ids.includes(userId)) {
      return Response.json({ error: "Déjà inscrit" }, { status: 409 });
    }
    ids.push(userId);

    const rawEmails = (f["Participants emails"] as string) ?? "";
    const emails = rawEmails ? rawEmails.split(",").map((s) => s.trim()) : [];
    emails.push(userEmail);

    // Essaie chaque combinaison jusqu'à ce qu'une réussisse
    let joinOk = false;
    try {
      await base("sorties").update(id, {
        "Nb participants": currentCount + 1,
        "Participants IDs": ids.join(", "),
        "Participants emails": emails.join(", "),
      });
      joinOk = true;
    } catch (e1) {
      console.error("join attempt 1 failed:", JSON.stringify(e1));
    }
    if (!joinOk) {
      try {
        await base("sorties").update(id, {
          "Participants IDs": ids.join(", "),
          "Participants emails": emails.join(", "),
        });
        joinOk = true;
      } catch (e2) {
        console.error("join attempt 2 failed:", JSON.stringify(e2));
      }
    }
    if (!joinOk) {
      try {
        await base("sorties").update(id, { "Nb participants": currentCount + 1 });
        joinOk = true;
      } catch (e3) {
        console.error("join attempt 3 failed:", JSON.stringify(e3));
      }
    }
    if (!joinOk) {
      return Response.json({ error: "Impossible de mettre à jour Airtable" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Airtable PATCH error:", error);
    return Response.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
}

const ADMIN_EMAILS = ["bridey.johan@neuf.fr"];

// DELETE : supprimer la sortie (organisateur ou admin)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, userEmail } = await request.json();
    const base = getBase();

    const record = await base("sorties").find(id);
    const isOrganizer = record.fields["organizerId"] === userId;
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    if (!isOrganizer && !isAdmin) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    await base("sorties").destroy(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Airtable DELETE error:", error);
    return Response.json({ error: "Erreur suppression" }, { status: 500 });
  }
}
