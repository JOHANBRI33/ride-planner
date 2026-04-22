"use client";

export const dynamic = "force-dynamic";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { parseGPX, type GPXData } from "@/lib/gpx/parseGPX";
import { getDifficulty } from "@/lib/elevation/elevationService";

const PickLocationMap = dynamic(() => import("@/components/PickLocationMap"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "choose" | "propose" | "search";

type MatchedSortie = {
  id: string;
  titre: string;
  date: string;
  heure: string;
  sport: string;
  niveau: string;
  lieu: string;
  nbParticipants: number;
  participantsMax: number;
  status: string;
};

type ProposeData = {
  date: string;
  timeFrom: string;
  sport: string;
  level: string;
  startAddress: string;
  lat: number | null;
  lng: number | null;
  gpx: GPXData | null;
  openToOtherRoutes: boolean;
  maxParticipants: string;
  description: string;
};

type SearchData = {
  date: string;
  timeFrom: string;
  timeTo: string;
  sport: string;
  lat: number | null;
  lng: number | null;
  locationName: string;
  radius: number;
  distanceMin: number;
  distanceMax: number;
  elevationType: string;
  objective: string;
  specificObjective: string;
  groupPreference: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORTS = ["Course à pied", "Vélo", "Randonnée", "Trail", "Natation", "Triathlon", "Autre"];
const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé", "Expert"];

const PROPOSE_STEPS = [
  { id: "when",    title: "Quand ?",       subtitle: "Date et heure de départ" },
  { id: "where",   title: "Où ?",          subtitle: "Point de départ sur la carte" },
  { id: "route",   title: "Le parcours ?", subtitle: "Importer un fichier GPX (optionnel)" },
  { id: "details", title: "Détails",       subtitle: "Niveau, participants, options" },
];

const SEARCH_STEPS = [
  { id: "when",  title: "Quand ?",         subtitle: "Date et plage horaire" },
  { id: "where", title: "Où ?",            subtitle: "Zone géographique et rayon" },
  { id: "what",  title: "Quelle sortie ?", subtitle: "Distance et dénivelé souhaités" },
  { id: "style", title: "Ton style ?",     subtitle: "Objectif et préférence de groupe" },
];

// ─── Matching helper ──────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({
  step, total, title, subtitle, onBack,
}: {
  step: number; total: number; title: string; subtitle: string; onBack: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-colors"
        >
          ←
        </button>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 font-semibold tabular-nums">{step + 1}/{total}</span>
      </div>
      <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
    </div>
  );
}

function OptionCard({
  value, label, emoji, selected, onClick,
}: {
  value: string; label: string; emoji: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 font-semibold text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <span className="text-sm">{label}</span>
      {selected && <span className="ml-auto text-blue-500 font-bold">✓</span>}
    </button>
  );
}

function NavButtons({
  onNext, onBack, nextLabel = "Continuer →", disabled = false, loading = false,
}: {
  onNext: () => void; onBack?: () => void; nextLabel?: string; disabled?: boolean; loading?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors active:scale-95"
        >
          ←
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || loading}
        className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all duration-200 active:scale-[0.98] shadow-md hover:shadow-lg flex items-center justify-center gap-2"
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {nextLabel}
      </button>
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50";
const labelCls = "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RequestPage() {
  const { user } = useUser();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Propose state
  const [pd, setPd] = useState<ProposeData>({
    date: "", timeFrom: "", sport: "", level: "", startAddress: "",
    lat: null, lng: null, gpx: null,
    openToOtherRoutes: false, maxParticipants: "6", description: "",
  });
  const [gpxError, setGpxError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search state
  const [sd, setSd] = useState<SearchData>({
    date: "", timeFrom: "", timeTo: "", sport: "", lat: null, lng: null,
    locationName: "", radius: 20, distanceMin: 0, distanceMax: 60,
    elevationType: "", objective: "", specificObjective: "", groupPreference: "",
  });
  const [geolocating, setGeolocating] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [matches, setMatches] = useState<MatchedSortie[]>([]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const totalSteps = mode === "propose" ? PROPOSE_STEPS.length : SEARCH_STEPS.length;

  function goTo(newMode: Mode, newStep = 0) {
    setAnimating(true);
    setTimeout(() => { setMode(newMode); setStep(newStep); setAnimating(false); }, 160);
  }

  function nextStep() {
    if (step < totalSteps - 1) {
      setAnimating(true);
      setTimeout(() => { setStep((s) => s + 1); setAnimating(false); }, 160);
    }
  }

  function prevStep() {
    if (step > 0) {
      setAnimating(true);
      setTimeout(() => { setStep((s) => s - 1); setAnimating(false); }, 160);
    } else {
      goTo("choose");
    }
  }

  // ── GPX upload ─────────────────────────────────────────────────────────────

  function handleGPXFile(file: File) {
    setGpxError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseGPX(text);
      if (!data) { setGpxError("Fichier GPX invalide ou sans points de trace."); return; }
      setPd((prev) => ({
        ...prev,
        gpx: data,
        startAddress: prev.startAddress || "",
      }));
    };
    reader.readAsText(file);
  }

  // ── Geolocation for search ──────────────────────────────────────────────────

  const geolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSd((prev) => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          locationName: "Ma position actuelle",
        }));
        setGeolocating(false);
      },
      () => setGeolocating(false),
      { timeout: 5000 },
    );
  }, []);

  // ── Matching & submit ───────────────────────────────────────────────────────

  async function fetchMatches() {
    try {
      const sorties: MatchedSortie[] = await fetch("/api/sorties").then((r) => r.json());
      let filtered = sorties.filter((s) => s.status !== "closed");

      if (mode === "search") {
        if (sd.date) filtered = filtered.filter((s) => s.date === sd.date);
        if (sd.sport) filtered = filtered.filter((s) => s.sport === sd.sport);
      } else {
        if (pd.date) filtered = filtered.filter((s) => s.date === pd.date);
        if (pd.sport) filtered = filtered.filter((s) => s.sport === pd.sport);
      }

      // Geo filter
      if (mode === "search" && sd.lat && sd.lng && sd.radius) {
        // Can't filter without sortie GPS coords from this minimal type, keep all
      }

      setMatches(filtered.slice(0, 6));
    } catch { setMatches([]); }
  }

  async function handleSubmit() {
    if (!user) { router.push("/login?redirect=/request"); return; }
    setSubmitting(true);

    const body = mode === "propose"
      ? {
          userId: user.id, userEmail: user.email, type: "propose",
          date: pd.date, timeFrom: pd.timeFrom, sport: pd.sport, level: pd.level,
          startAddress: pd.startAddress, latitude: pd.lat, longitude: pd.lng,
          gpxRoute: pd.gpx ? JSON.stringify(pd.gpx.coordinates) : null,
          distanceKm: pd.gpx?.distanceKm ?? null,
          elevationGain: pd.gpx?.elevationGain ?? null,
          maxParticipants: pd.maxParticipants,
          openToOtherRoutes: pd.openToOtherRoutes,
          description: pd.description,
        }
      : {
          userId: user.id, userEmail: user.email, type: "search",
          date: sd.date, timeFrom: sd.timeFrom, timeTo: sd.timeTo, sport: sd.sport,
          searchLat: sd.lat, searchLng: sd.lng, searchLocation: sd.locationName,
          searchRadius: sd.radius, distanceMin: sd.distanceMin, distanceMax: sd.distanceMax,
          elevationType: sd.elevationType, objective: sd.objective,
          specificObjective: sd.specificObjective, groupPreference: sd.groupPreference,
        };

    await fetch("/api/ride-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await fetchMatches();
    setSubmitted(true);
    setSubmitting(false);
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const slideClass = `transition-all duration-200 ${
    animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
  }`;

  // ── CHOICE SCREEN ──────────────────────────────────────────────────────────

  if (mode === "choose") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-12">
        <div className={`w-full max-w-lg ${slideClass}`}>
          <div className="text-center mb-10">
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6 inline-block">
              ← Retour
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
              Trouve ta prochaine sortie
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              Propose une sortie à d&apos;autres ou cherche des partenaires
            </p>
          </div>

          <div className="grid gap-4">
            {/* Propose */}
            <button
              type="button"
              onClick={() => goTo("propose")}
              className="group bg-white hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-3xl p-7 text-left transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-3xl transition-colors flex-shrink-0">
                  🚀
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Je propose une sortie</h2>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Partage ta date, ton départ et ton parcours GPX.<br />
                    D&apos;autres sportifs peuvent te rejoindre.
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {["📅 Date & heure", "📍 Point de départ", "🗺️ GPX"].map((t) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium border border-blue-100">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={() => goTo("search")}
              className="group bg-white hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-400 rounded-3xl p-7 text-left transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center text-3xl transition-colors flex-shrink-0">
                  🔍
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Je cherche une sortie</h2>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Indique tes critères : zone, distance, dénivelé.<br />
                    On cherche les sorties qui te correspondent.
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {["📍 Zone géo", "📏 Distance", "⛰️ Dénivelé", "🎯 Objectif"].map((t) => (
                      <span key={t} className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-medium border border-emerald-100">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {!user && (
            <p className="text-center text-sm text-slate-400 mt-6">
              Tu devras être{" "}
              <Link href="/login?redirect=/request" className="text-blue-600 underline font-medium">
                connecté
              </Link>{" "}
              pour soumettre une demande.
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── RESULTS SCREEN ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className={`max-w-2xl mx-auto ${slideClass}`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✅
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {mode === "propose" ? "Sortie proposée !" : "Demande enregistrée !"}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              {mode === "propose"
                ? "Ta sortie est visible. Voici les sorties existantes similaires."
                : "Ta recherche est sauvegardée. Voici les sorties qui correspondent."}
            </p>
          </div>

          {/* Matching sorties */}
          {matches.length > 0 ? (
            <div className="flex flex-col gap-3 mb-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                {matches.length} sortie{matches.length > 1 ? "s" : ""} correspondante{matches.length > 1 ? "s" : ""}
              </h2>
              {matches.map((s) => (
                <Link key={s.id} href={`/sorties/${s.id}`}>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center justify-between gap-3 hover:shadow-md hover:border-blue-200 transition-all duration-150 cursor-pointer">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-slate-900 truncate">{s.titre}</span>
                      <span className="text-xs text-slate-400">📅 {s.date} · {s.heure} · {s.lieu}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100">
                        {s.sport}
                      </span>
                      <span className="text-xs text-slate-400">
                        👥 {s.nbParticipants}/{s.participantsMax}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-8 text-center mb-6">
              <span className="text-3xl">🔍</span>
              <p className="text-slate-500 mt-2 font-medium">Aucune sortie trouvée pour ces critères.</p>
              <p className="text-slate-400 text-sm mt-1">Ta demande est sauvegardée — on te préviendra !</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/" className="flex-1">
              <button className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-md">
                Explorer toutes les sorties
              </button>
            </Link>
            <button
              onClick={() => { setSubmitted(false); setMode("choose"); setStep(0); setPd({ date:"",timeFrom:"",sport:"",level:"",startAddress:"",lat:null,lng:null,gpx:null,openToOtherRoutes:false,maxParticipants:"6",description:"" }); setSd({ date:"",timeFrom:"",timeTo:"",sport:"",lat:null,lng:null,locationName:"",radius:20,distanceMin:0,distanceMax:60,elevationType:"",objective:"",specificObjective:"",groupPreference:"" }); }}
              className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
            >
              Nouvelle demande
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── PROPOSE FORM ───────────────────────────────────────────────────────────

  if (mode === "propose") {
    const currentStepDef = PROPOSE_STEPS[step];

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className={`max-w-lg mx-auto ${slideClass}`}>
          <StepHeader
            step={step} total={PROPOSE_STEPS.length}
            title={currentStepDef.title} subtitle={currentStepDef.subtitle}
            onBack={prevStep}
          />

          {/* Step 0: Quand */}
          {step === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={pd.date} onChange={(e) => setPd({ ...pd, date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Heure de départ *</label>
                  <input type="time" value={pd.timeFrom} onChange={(e) => setPd({ ...pd, timeFrom: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Sport *</label>
                <div className="flex flex-wrap gap-2">
                  {SPORTS.map((s) => (
                    <button key={s} type="button" onClick={() => setPd({ ...pd, sport: s })}
                      className={`text-sm px-3 py-1.5 rounded-full border-2 font-medium transition-all duration-150 ${pd.sport === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <NavButtons
                onNext={nextStep}
                disabled={!pd.date || !pd.timeFrom || !pd.sport}
              />
            </div>
          )}

          {/* Step 1: Où */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Adresse (remplie automatiquement)</label>
                <input
                  value={pd.startAddress}
                  onChange={(e) => setPd({ ...pd, startAddress: e.target.value })}
                  placeholder="Clique sur la carte pour positionner le départ"
                  className={inputCls}
                />
              </div>
              <PickLocationMap
                gpx={pd.gpx}
                height="260px"
                onLocationPick={(lat, lng, address) =>
                  setPd((prev) => ({ ...prev, lat, lng, startAddress: address ?? prev.startAddress }))
                }
              />
              {pd.lat && (
                <p className="text-xs text-emerald-600 font-medium">
                  ✅ Position sélectionnée : {pd.lat.toFixed(4)}, {pd.lng?.toFixed(4)}
                </p>
              )}
              <NavButtons onNext={nextStep} disabled={!pd.lat} />
            </div>
          )}

          {/* Step 2: GPX */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-150"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleGPXFile(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gpx"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGPXFile(f); }}
                />
                <span className="text-4xl block mb-2">{pd.gpx ? "✅" : "📂"}</span>
                <p className="font-semibold text-slate-700">
                  {pd.gpx ? pd.gpx.name ?? "Fichier GPX chargé" : "Glisse ou clique pour importer ton GPX"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Fichiers .gpx exportés depuis Garmin, Strava, Komoot…</p>
              </div>

              {gpxError && (
                <p className="text-xs text-red-500 font-medium">{gpxError}</p>
              )}

              {pd.gpx && (
                <div className="flex flex-wrap gap-3">
                  <StatPill icon="📏" value={`${pd.gpx.distanceKm.toFixed(2)} km`} />
                  {pd.gpx.elevationGain > 0 && (
                    <StatPill icon="⬆️" value={`${pd.gpx.elevationGain} m D+`} />
                  )}
                  {pd.gpx.elevationGain > 0 && (
                    <StatPill
                      icon="🎯"
                      value={getDifficulty(pd.gpx.elevationGain, pd.gpx.distanceKm).label}
                    />
                  )}
                </div>
              )}

              {pd.gpx && (
                <PickLocationMap
                  gpx={pd.gpx}
                  height="220px"
                  onLocationPick={() => {}}
                />
              )}

              <NavButtons
                onNext={nextStep}
                nextLabel={pd.gpx ? "Continuer →" : "Passer cette étape →"}
              />
            </div>
          )}

          {/* Step 3: Détails */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
              <div>
                <label className={labelCls}>Niveau requis</label>
                <div className="flex flex-wrap gap-2">
                  {NIVEAUX.map((n) => (
                    <button key={n} type="button" onClick={() => setPd({ ...pd, level: n })}
                      className={`text-sm px-3 py-1.5 rounded-full border-2 font-medium transition-all duration-150 ${pd.level === n ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Nombre max de participants</label>
                <input
                  type="number" min={1} max={100} value={pd.maxParticipants}
                  onChange={(e) => setPd({ ...pd, maxParticipants: e.target.value })}
                  className={inputCls}
                />
              </div>

              <label className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={pd.openToOtherRoutes}
                  onChange={(e) => setPd({ ...pd, openToOtherRoutes: e.target.checked })}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ouvert à d&apos;autres circuits</p>
                  <p className="text-xs text-slate-400">Les participants peuvent suggérer un tracé alternatif</p>
                </div>
              </label>

              <div>
                <label className={labelCls}>Description (optionnel)</label>
                <textarea
                  value={pd.description}
                  onChange={(e) => setPd({ ...pd, description: e.target.value })}
                  placeholder="Allure prévue, infos pratiques, rendez-vous…"
                  rows={3}
                  className={inputCls + " resize-none"}
                />
              </div>

              <NavButtons
                onNext={handleSubmit}
                nextLabel="Proposer la sortie 🚀"
                loading={submitting}
                disabled={!user}
              />
              {!user && (
                <p className="text-xs text-center text-slate-400">
                  <Link href="/login?redirect=/request" className="text-blue-600 underline">Connecte-toi</Link>
                  {" "}pour soumettre.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── SEARCH FORM ────────────────────────────────────────────────────────────

  const currentStepDef = SEARCH_STEPS[step];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className={`max-w-lg mx-auto ${slideClass}`}>
        <StepHeader
          step={step} total={SEARCH_STEPS.length}
          title={currentStepDef.title} subtitle={currentStepDef.subtitle}
          onBack={prevStep}
        />

        {/* Step 0: Quand */}
        {step === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" value={sd.date} onChange={(e) => setSd({ ...sd, date: e.target.value })} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>À partir de</label>
                <input type="time" value={sd.timeFrom} onChange={(e) => setSd({ ...sd, timeFrom: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Jusqu&apos;à</label>
                <input type="time" value={sd.timeTo} onChange={(e) => setSd({ ...sd, timeTo: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Sport (optionnel)</label>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((s) => (
                  <button key={s} type="button" onClick={() => setSd({ ...sd, sport: sd.sport === s ? "" : s })}
                    className={`text-sm px-3 py-1.5 rounded-full border-2 font-medium transition-all duration-150 ${sd.sport === s ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <NavButtons onNext={nextStep} disabled={!sd.date} />
          </div>
        )}

        {/* Step 1: Où */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4">
            <button
              type="button"
              onClick={geolocate}
              disabled={geolocating}
              className="flex items-center gap-2 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {geolocating
                ? <><span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />Localisation…</>
                : <>📍 Utiliser ma position actuelle</>}
            </button>

            {sd.locationName && (
              <p className="text-xs text-emerald-600 font-medium bg-emerald-50 rounded-xl px-3 py-2">
                ✅ {sd.locationName}
              </p>
            )}

            <div>
              <label className={labelCls}>Ou saisir une ville / adresse</label>
              <input
                value={sd.locationName}
                onChange={(e) => setSd({ ...sd, locationName: e.target.value })}
                placeholder="Ex : Bordeaux, Lyon, Parc de la Tête d'Or…"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Rayon de recherche : <strong>{sd.radius} km</strong></label>
              <input
                type="range" min={5} max={100} step={5} value={sd.radius}
                onChange={(e) => setSd({ ...sd, radius: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>5 km</span><span>100 km</span>
              </div>
            </div>

            <NavButtons onNext={nextStep} disabled={!sd.locationName} />
          </div>
        )}

        {/* Step 2: Quoi */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-5">
            <div>
              <label className={labelCls}>
                Distance souhaitée : <strong>{sd.distanceMin === 0 ? "Toute" : `${sd.distanceMin}`}–{sd.distanceMax} km</strong>
              </label>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-slate-400 w-8">Min</span>
                <input
                  type="range" min={0} max={150} step={5} value={sd.distanceMin}
                  onChange={(e) => setSd({ ...sd, distanceMin: Math.min(Number(e.target.value), sd.distanceMax - 5) })}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-xs text-slate-400 w-12">{sd.distanceMin} km</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-400 w-8">Max</span>
                <input
                  type="range" min={5} max={300} step={5} value={sd.distanceMax}
                  onChange={(e) => setSd({ ...sd, distanceMax: Math.max(Number(e.target.value), sd.distanceMin + 5) })}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-xs text-slate-400 w-12">{sd.distanceMax} km</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Type de terrain</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "flat",     l: "Plat",           e: "🌾" },
                  { v: "hilly",    l: "Vallonné",        e: "🌿" },
                  { v: "mountain", l: "Montagne / D+ important", e: "⛰️" },
                  { v: "any",      l: "Peu importe",     e: "🎲" },
                ].map(({ v, l, e }) => (
                  <OptionCard key={v} value={v} label={l} emoji={e}
                    selected={sd.elevationType === v}
                    onClick={() => setSd({ ...sd, elevationType: v })}
                  />
                ))}
              </div>
            </div>

            <NavButtons onNext={nextStep} />
          </div>
        )}

        {/* Step 3: Style */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-5">
            <div>
              <label className={labelCls}>Objectif de la sortie</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "cool",     l: "Cool & découverte",   e: "😎" },
                  { v: "moderate", l: "Modéré — je progresse", e: "🔥" },
                  { v: "intense",  l: "Intense & entraînement", e: "⚡" },
                  { v: "specific", l: "Spécifique (précise ci-dessous)", e: "🎯" },
                ].map(({ v, l, e }) => (
                  <OptionCard key={v} value={v} label={l} emoji={e}
                    selected={sd.objective === v}
                    onClick={() => setSd({ ...sd, objective: v })}
                  />
                ))}
              </div>
              {sd.objective === "specific" && (
                <input
                  value={sd.specificObjective}
                  onChange={(e) => setSd({ ...sd, specificObjective: e.target.value })}
                  placeholder="Ex : prépa marathon, séance seuil, sortie longue…"
                  className={inputCls + " mt-2"}
                />
              )}
            </div>

            <div>
              <label className={labelCls}>Préférence de groupe</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "women", l: "Groupe féminin",  e: "👩" },
                  { v: "men",   l: "Groupe masculin", e: "👨" },
                  { v: "mixed", l: "Mixte",           e: "👫" },
                  { v: "any",   l: "Pas de préférence", e: "🤝" },
                ].map(({ v, l, e }) => (
                  <OptionCard key={v} value={v} label={l} emoji={e}
                    selected={sd.groupPreference === v}
                    onClick={() => setSd({ ...sd, groupPreference: v })}
                  />
                ))}
              </div>
            </div>

            <NavButtons
              onNext={handleSubmit}
              nextLabel="Lancer la recherche 🔍"
              loading={submitting}
              disabled={!user || !sd.objective || !sd.groupPreference}
            />
            {!user && (
              <p className="text-xs text-center text-slate-400">
                <Link href="/login?redirect=/request" className="text-blue-600 underline">Connecte-toi</Link>
                {" "}pour soumettre.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full">
      <span>{icon}</span>{value}
    </span>
  );
}
