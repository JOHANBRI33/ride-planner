"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Sortie = {
  id: string;
  titre: string;
  date: string;
  heure?: string;
  sport: string;
  niveau?: string;
  lieu?: string;
  distanceKm: number | null;
  route: string | null;
  organizerId: string | null;
  participantIds: string[];
  status: string;
  image_url?: string | null;
};

type StoredRoute = {
  v: 2;
  distanceKm: number;
  durationMin: number;
  gain?: number;
  loss?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_COLORS: Record<string, string> = {
  "Vélo":            "bg-orange-100 text-orange-700",
  "Course à pied":   "bg-red-100 text-red-700",
  "Randonnée":       "bg-green-100 text-green-700",
  "Trail":           "bg-purple-100 text-purple-700",
  "Natation":        "bg-cyan-100 text-cyan-700",
  "Triathlon":       "bg-amber-100 text-amber-700",
};

const SPORT_EMOJI: Record<string, string> = {
  "Vélo":            "🚴",
  "Course à pied":   "🏃",
  "Randonnée":       "🥾",
  "Trail":           "🏔️",
  "Natation":        "🏊",
  "Triathlon":       "🏅",
};

// Objectifs du mois
const GOAL_BIKE_KM   = 200;
const GOAL_ACTIVE_MIN = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRouteStats(route: string | null): { distanceKm: number; durationMin: number } | null {
  if (!route) return null;
  try {
    const r = JSON.parse(route) as StoredRoute;
    if (r.v === 2) return { distanceKm: r.distanceKm, durationMin: r.durationMin };
    return null;
  } catch { return null; }
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { start, end };
}

function monthLabel(): string {
  return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1">
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function SortieRow({ s, mine }: { s: Sortie; mine: boolean }) {
  const colorClass = SPORT_COLORS[s.sport] ?? "bg-slate-100 text-slate-600";
  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";
  const stats = parseRouteStats(s.route);
  const past = s.date < new Date().toISOString().split("T")[0];

  return (
    <Link href={`/sorties/${s.id}`}>
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md hover:border-blue-200 cursor-pointer ${past ? "opacity-60 bg-slate-50 border-slate-100" : "bg-white border-slate-100"}`}>
        <span className="text-xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{s.titre}</p>
          <p className="text-xs text-slate-500">{s.date}{s.heure ? ` · ${s.heure}` : ""}{s.lieu ? ` · ${s.lieu}` : ""}</p>
          {stats && (
            <p className="text-xs text-slate-400 mt-0.5">{stats.distanceKm} km · ~{stats.durationMin} min</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>{s.sport}</span>
          {mine && <span className="text-[10px] text-blue-500 font-medium">Organisateur</span>}
          {past && <span className="text-[10px] text-slate-400">Passée</span>}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetch("/api/sorties?includePast=true")
      .then((r) => r.json())
      .then((data: Sortie[]) => { setSorties(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, router]);

  // ── My sorties ──────────────────────────────────────────────────────────────

  const mySorties = useMemo(() => {
    if (!user) return [];
    return sorties.filter(
      (s) => s.organizerId === user.id || s.participantIds.includes(user.id)
    );
  }, [sorties, user]);

  const { start, end } = currentMonthRange();

  const thisMont = useMemo(
    () => mySorties.filter((s) => s.date >= start && s.date <= end),
    [mySorties, start, end]
  );

  // ── Monthly stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let totalKm = 0;
    let totalMin = 0;
    const sportCount: Record<string, number> = {};

    for (const s of thisMont) {
      const r = parseRouteStats(s.route);
      if (r) {
        totalKm  += r.distanceKm;
        totalMin += r.durationMin;
      } else if (s.distanceKm) {
        totalKm += s.distanceKm;
      }
      sportCount[s.sport] = (sportCount[s.sport] ?? 0) + 1;
    }

    return {
      count:     thisMont.length,
      totalKm:   Math.round(totalKm * 10) / 10,
      totalMin,
      sportCount,
    };
  }, [thisMont]);

  // ── Objectives ───────────────────────────────────────────────────────────────

  const bikeKm = useMemo(() => {
    let km = 0;
    for (const s of thisMont.filter((s) => s.sport === "Vélo")) {
      const r = parseRouteStats(s.route);
      if (r) km += r.distanceKm;
      else if (s.distanceKm) km += s.distanceKm;
    }
    return Math.round(km * 10) / 10;
  }, [thisMont]);

  const bikeUnlocked   = bikeKm >= GOAL_BIKE_KM;
  const activeUnlocked = stats.totalMin >= GOAL_ACTIVE_MIN;

  // ── Sections ─────────────────────────────────────────────────────────────────

  const upcoming = mySorties.filter((s) => s.date >= new Date().toISOString().split("T")[0]).slice(0, 5);
  const past     = mySorties.filter((s) => s.date <  new Date().toISOString().split("T")[0]).slice(0, 5);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mon dashboard</h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">{monthLabel()}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Statistiques du mois ── */}
            <section>
              <h2 className="text-base font-semibold text-slate-700 mb-3">📈 Ce mois-ci</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon="🏅" label="Sorties" value={stats.count} />
                <StatCard icon="📏" label="Kilomètres" value={`${stats.totalKm} km`} />
                <StatCard icon="⏱️" label="Temps actif" value={`${stats.totalMin} min`} />
                <StatCard
                  icon="🚴"
                  label="Sport principal"
                  value={Object.entries(stats.sportCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}
                />
              </div>

              {/* Sport breakdown */}
              {Object.keys(stats.sportCount).length > 0 && (
                <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Répartition par sport</p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(stats.sportCount).sort((a, b) => b[1] - a[1]).map(([sport, count]) => {
                      const pct = Math.round((count / stats.count) * 100);
                      const emoji = SPORT_EMOJI[sport] ?? "🏅";
                      return (
                        <div key={sport} className="flex items-center gap-2">
                          <span className="text-base w-6 text-center">{emoji}</span>
                          <span className="text-xs text-slate-600 w-28 flex-shrink-0">{sport}</span>
                          <div className="flex-1">
                            <ProgressBar value={count} max={stats.count} color="bg-blue-400" />
                          </div>
                          <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* ── Objectifs du mois ── */}
            <section>
              <h2 className="text-base font-semibold text-slate-700 mb-3">🎯 Objectifs du mois</h2>
              <div className="flex flex-col gap-3">

                {/* Objectif vélo */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚴</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Objectif vélo</p>
                        <p className="text-xs text-slate-500">{bikeKm} / {GOAL_BIKE_KM} km</p>
                      </div>
                    </div>
                    {bikeUnlocked ? (
                      <span className="text-lg" title="Badge débloqué !">🏆</span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        {Math.round(((bikeKm / GOAL_BIKE_KM) * 100))}%
                      </span>
                    )}
                  </div>
                  <ProgressBar value={bikeKm} max={GOAL_BIKE_KM} color={bikeUnlocked ? "bg-amber-400" : "bg-orange-400"} />
                  <p className="text-xs text-slate-500 mt-2">
                    {bikeUnlocked
                      ? "🎉 Objectif atteint ! Badge vélo débloqué."
                      : `Encore ${Math.round((GOAL_BIKE_KM - bikeKm) * 10) / 10} km pour atteindre ton objectif`}
                  </p>
                </div>

                {/* Objectif activité */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚡</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Activité mensuelle</p>
                        <p className="text-xs text-slate-500">{stats.totalMin} / {GOAL_ACTIVE_MIN} min</p>
                      </div>
                    </div>
                    {activeUnlocked ? (
                      <span className="text-lg" title="Badge débloqué !">🏆</span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        {Math.round(((stats.totalMin / GOAL_ACTIVE_MIN) * 100))}%
                      </span>
                    )}
                  </div>
                  <ProgressBar value={stats.totalMin} max={GOAL_ACTIVE_MIN} color={activeUnlocked ? "bg-amber-400" : "bg-blue-500"} />
                  <p className="text-xs text-slate-500 mt-2">
                    {activeUnlocked
                      ? "🎉 Objectif atteint ! Badge activité débloqué."
                      : `Encore ${GOAL_ACTIVE_MIN - stats.totalMin} min pour atteindre ton objectif`}
                  </p>
                </div>

                {/* Badges */}
                {(bikeUnlocked || activeUnlocked) && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-amber-800 mb-2">🏆 Badges débloqués ce mois</p>
                    <div className="flex gap-2 flex-wrap">
                      {bikeUnlocked   && <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full">🚴 Champion vélo</span>}
                      {activeUnlocked && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">⚡ Athlète du mois</span>}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Mes sorties à venir ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-700">📅 À venir</h2>
                <Link href="/" className="text-xs text-blue-600 hover:underline">Voir toutes les sorties</Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-slate-400 text-sm">Aucune sortie à venir</p>
                  <Link href="/create">
                    <button className="mt-3 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-blue-700 transition-colors">
                      + Créer une sortie
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcoming.map((s) => (
                    <SortieRow key={s.id} s={s} mine={s.organizerId === user.id} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Sorties passées ── */}
            {past.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-slate-700 mb-3">🕐 Historique</h2>
                <div className="flex flex-col gap-2">
                  {past.map((s) => (
                    <SortieRow key={s.id} s={s} mine={s.organizerId === user.id} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
