"use client";

import { useRef, useState } from "react";
import _dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import type { StoredRoute } from "@/lib/elevation/elevationService";
import { parseGPX, type GPXData } from "@/lib/gpx/parseGPX";

const RoutePickerMap = _dynamic(() => import("@/components/RoutePickerMap"), { ssr: false });

const SPORTS = ["Course à pied", "Vélo", "Randonnée", "Trail", "Natation", "Triathlon", "Autre"];
const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé", "Expert"];

export default function CreatePage() {
  const { user } = useUser();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const lieuRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [storedRoute, setStoredRoute] = useState<StoredRoute | null>(null);
  const [gpxData, setGpxData] = useState<GPXData | null>(null);
  const [gpxStatus, setGpxStatus] = useState<"idle" | "success" | "error">("idle");
  const [gpxName, setGpxName] = useState("");
  const gpxInputRef = useRef<HTMLInputElement>(null);

  function handleGpxFile(file: File) {
    setGpxStatus("idle");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseGPX(text);
      if (!parsed) { setGpxStatus("error"); return; }
      setGpxData(parsed);
      setGpxName(parsed.name ?? file.name.replace(".gpx", ""));
      setGpxStatus("success");
    };
    reader.onerror = () => setGpxStatus("error");
    reader.readAsText(file);
  }

  function handleLocationChange(c: { lat: number; lng: number }, adresse?: string) {
    setCoords(c);
    if (adresse && lieuRef.current) lieuRef.current.value = adresse;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) { router.push("/login?redirect=/create"); return; }

    setLoading(true);
    setError("");
    setSuccess(false);

    const form = e.currentTarget;

    // resolve route
    let finalRoute: string | null = storedRoute ? JSON.stringify(storedRoute) : routePoints.length >= 2 ? JSON.stringify(routePoints) : null;
    let finalGeometry: string | null = null;
    let finalDistanceKm: number | null = storedRoute?.distanceKm ?? null;
    let finalElevationGain: number | null = storedRoute?.gain ?? null;

    if (storedRoute) {
      finalGeometry = JSON.stringify(storedRoute.geometry);
    } else if (routePoints.length >= 2) {
      // fallback: compute route server-side
      try {
        const r = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waypoints: routePoints, mode: "cycling" }),
        });
        if (r.ok) {
          const rd = await r.json();
          finalGeometry = JSON.stringify(rd.geometry);
          finalDistanceKm = rd.distanceKm;
          finalRoute = JSON.stringify({ v: 2, geometry: rd.geometry, distanceKm: rd.distanceKm, durationMin: rd.durationMin });
        }
      } catch { /* ignore */ }
    }

    const data = {
      titre: (form.elements.namedItem("titre") as HTMLInputElement).value,
      date: (form.elements.namedItem("date") as HTMLInputElement).value,
      heure: (form.elements.namedItem("heure") as HTMLInputElement).value,
      lieu: (form.elements.namedItem("lieu") as HTMLInputElement).value,
      sport: (form.elements.namedItem("sport") as HTMLInputElement).value,
      niveau: (form.elements.namedItem("niveau") as HTMLSelectElement).value,
      participantsMax: (form.elements.namedItem("participantsMax") as HTMLInputElement).value,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      organizerId: user.id,
      organizerEmail: user.email,
      route: finalRoute,
      route_geometry: finalGeometry,
      distanceKm: finalDistanceKm,
      elevationGain: finalElevationGain,
    };

    const res = await fetch("/api/sorties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (res.ok) {
      form.reset();
      setCoords(null);
      setRoutePoints([]);
      setStoredRoute(null);
      setSuccess(true);
    } else {
      setError("Erreur lors de la création. Réessaie.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Retour</Link>
          <h1 className="text-2xl font-bold text-gray-900">Créer une sortie</h1>
        </div>

        {!user && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 mb-6">
            Tu dois être{" "}
            <Link href="/login?redirect=/create" className="underline font-medium">connecté</Link>
            {" "}pour créer une sortie.
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-5"
        >
          <Field label="Titre *">
            <input name="titre" required placeholder="Ex : Trail matinal au Massif de l'Étoile" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *">
              <input name="date" type="date" required className={inputCls} />
            </Field>
            <Field label="Heure *">
              <input name="heure" type="time" required className={inputCls} />
            </Field>
          </div>

          <Field label="Lieu *">
            <input ref={lieuRef} name="lieu" required placeholder="Adresse ou point de rendez-vous" className={inputCls} />
          </Field>

          <Field label="Carte · RDV &amp; Parcours">
            {/* ── Import GPX ── */}
            <div className="flex flex-col gap-2 mb-2">
              <input
                ref={gpxInputRef}
                type="file"
                accept=".gpx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGpxFile(f); e.target.value = ""; }}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => gpxInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                >
                  📂 Importer un GPX
                </button>
                {gpxStatus === "success" && gpxData && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-700 font-medium">
                    <span>✅ {gpxName}</span>
                    <span className="text-emerald-500">·</span>
                    <span>{gpxData.distanceKm.toFixed(2)} km</span>
                    {gpxData.elevationGain > 0 && <><span className="text-emerald-500">·</span><span>D+ {gpxData.elevationGain} m</span></>}
                    <button
                      type="button"
                      onClick={() => { setGpxData(null); setGpxStatus("idle"); setGpxName(""); }}
                      className="ml-1 text-emerald-400 hover:text-emerald-700"
                    >×</button>
                  </div>
                )}
                {gpxStatus === "error" && (
                  <p className="text-xs text-red-500 font-medium">❌ Fichier GPX invalide ou sans points de trace.</p>
                )}
              </div>
            </div>

            <RoutePickerMap
              onLocationChange={handleLocationChange}
              onRouteChange={(pts, sr) => { setRoutePoints(pts); setStoredRoute(sr ?? null); }}
              height="320px"
              initialGpx={gpxData}
            />
            {coords && (
              <p className="text-xs text-gray-400">RDV : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Sport *">
              <input name="sport" required placeholder="Ex : Trail, Vélo…" list="sports-list" className={inputCls} />
              <datalist id="sports-list">
                {SPORTS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Niveau *">
              <select name="niveau" required className={inputCls}>
                <option value="">— Choisir —</option>
                {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Participants max *">
            <input name="participantsMax" type="number" min={1} max={200} required placeholder="10" className={inputCls} />
          </Field>

          {success && (
            <div className="fade-in flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
              <span className="text-base">✅</span> Sortie créée avec succès !
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 ease-in-out"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Création…</span>
              : "Créer la sortie"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
