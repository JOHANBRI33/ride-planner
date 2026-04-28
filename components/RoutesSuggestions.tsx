"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type SuggestedRoute = {
  id:              string;
  name:            string;
  sport:           string;
  distance_km:     number;
  duration_min:    number;
  elevation:       number;
  difficulty:      string;
  safety_score:    number;
  traffic_level:   string;
  city:            string;
  gpx_url:         string;
  score:           number;
  distanceToUser:  number | null;
};

type Props = {
  /** Pré-sélectionner un sport (depuis le mode carte par ex.) */
  defaultSport?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORTS = ["", "Vélo", "Course à pied", "Trail", "Randonnée", "Natation"];
const DIFFICULTIES = ["", "Débutant", "Intermédiaire", "Avancé", "Expert"];

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "🏔️",
  "Randonnée": "🥾", "Natation": "🏊", "Triathlon": "🏅",
};

const DIFFICULTY_STYLE: Record<string, string> = {
  "Débutant":      "bg-emerald-100 text-emerald-700",
  "Intermédiaire": "bg-blue-100 text-blue-700",
  "Avancé":        "bg-orange-100 text-orange-700",
  "Expert":        "bg-red-100 text-red-700",
};

const TRAFFIC_LABEL: Record<string, { label: string; cls: string }> = {
  low:    { label: "Peu de trafic",  cls: "text-emerald-600" },
  medium: { label: "Trafic modéré", cls: "text-amber-600"   },
  high:   { label: "Trafic élevé",  cls: "text-red-500"     },
};

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function SafetyDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`Sécurité : ${score}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`w-2 h-2 rounded-full ${
            n <= score ? "bg-emerald-500" : "bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutesSuggestions({ defaultSport = "" }: Props) {
  const router = useRouter();

  // Filters
  const [sport,      setSport]      = useState(defaultSport);
  const [difficulty, setDifficulty] = useState("");
  const [distMin,    setDistMin]    = useState(10);
  const [distMax,    setDistMax]    = useState(60);

  // Position
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Results
  const [routes,    setRoutes]    = useState<SuggestedRoute[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [searched,  setSearched]  = useState(false);
  const [error,     setError]     = useState("");

  // Loading indicator for "use this route"
  const [using, setUsing] = useState<string | null>(null);

  // Auto-get geolocation once
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => { /* silent */ },
    );
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    setSearched(true);

    const params = new URLSearchParams({
      distance_min: String(distMin),
      distance_max: String(distMax),
    });
    if (sport)      params.set("sport",      sport);
    if (difficulty) params.set("difficulty", difficulty);
    if (userLat !== null) params.set("lat", String(userLat));
    if (userLng !== null) params.set("lng", String(userLng));

    try {
      const res  = await fetch(`/api/routes/search?${params}`);
      const data = await res.json();
      setRoutes(data.routes ?? []);
    } catch {
      setError("Erreur lors de la recherche, réessaie.");
    } finally {
      setLoading(false);
    }
  }, [distMin, distMax, sport, difficulty, userLat, userLng]);

  async function handleUse(route: SuggestedRoute) {
    setUsing(route.id);
    // Pass routeId to create page — it will fetch details + pre-fill form
    router.push(`/create?routeId=${encodeURIComponent(route.id)}`);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-800">
          🗺️ Trouver un parcours prêt-à-utiliser
        </h2>

        {/* Distance range */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">Distance</label>
            <span className="text-xs font-semibold text-slate-700">
              {distMin} – {distMax} km
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-1">Min</label>
              <input
                type="range" min={0} max={200} step={5}
                value={distMin}
                onChange={(e) => setDistMin(Math.min(Number(e.target.value), distMax - 5))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-1">Max</label>
              <input
                type="range" min={5} max={250} step={5}
                value={distMax}
                onChange={(e) => setDistMax(Math.max(Number(e.target.value), distMin + 5))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Sport + Difficulty */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s || "— Tous —"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Niveau</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d || "— Tous —"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Position notice */}
        {userLat && (
          <p className="text-[10px] text-emerald-600 flex items-center gap-1">
            <span>📍</span> Position détectée — les parcours proches seront favorisés
          </p>
        )}

        <button
          onClick={search}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Recherche…</>
          ) : (
            "🔍 Trouver des parcours"
          )}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* ── No results ── */}
      {searched && !loading && routes.length === 0 && !error && (
        <div className="text-center py-10 text-slate-400">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-sm font-medium">Aucun parcours trouvé</p>
          <p className="text-xs mt-1">Élargis la distance ou change le sport</p>
        </div>
      )}

      {/* ── Results ── */}
      {routes.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400 font-medium px-1">
            {routes.length} parcours recommandé{routes.length > 1 ? "s" : ""}
          </p>

          {routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              onUse={handleUse}
              loading={using === route.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({
  route,
  onUse,
  loading,
}: {
  route:   SuggestedRoute;
  onUse:   (r: SuggestedRoute) => void;
  loading: boolean;
}) {
  const emoji   = SPORT_EMOJI[route.sport] ?? "🏅";
  const diffCls = DIFFICULTY_STYLE[route.difficulty] ?? "bg-slate-100 text-slate-600";
  const traffic = TRAFFIC_LABEL[route.traffic_level] ?? TRAFFIC_LABEL.medium;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl flex-shrink-0">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900 truncate">{route.name}</h3>
            {route.city && (
              <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                📍 {route.city}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffCls}`}>
              {route.difficulty}
            </span>
            <span className="text-[10px] font-medium text-slate-500">{route.sport}</span>
            {route.distanceToUser !== null && (
              <span className="text-[10px] text-slate-400">
                à {route.distanceToUser} km de toi
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-slate-50 border-t border-slate-50">
        <Metric icon="📏" value={`${route.distance_km} km`}    label="Distance" />
        <Metric icon="⏱️" value={fmtMin(route.duration_min)}   label="Durée" />
        <Metric icon="⬆️" value={`${route.elevation} m`}       label="D+" />
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between gap-3 border-t border-slate-50">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Sécurité</span>
            <SafetyDots score={route.safety_score} />
          </div>
          <span className={`text-[10px] font-medium ${traffic.cls}`}>
            {traffic.label}
          </span>
        </div>
        <button
          onClick={() => onUse(route)}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : null}
          Créer cette sortie →
        </button>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-3 gap-0.5">
      <span className="text-xs font-bold text-slate-800">{icon} {value}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
