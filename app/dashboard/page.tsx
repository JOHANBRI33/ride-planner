"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useRouter, useSearchParams } from "next/navigation";

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
  organizerEmail?: string | null;
  participantIds: string[];
  status: string;
};

type Validation = {
  id: string;
  sortieId: string;
  status: "oui" | "partiel" | "non";
  distanceKm: number | null;
  durationMin: number | null;
  ressenti: string | null;
};

type StoredRoute = { v: 2; distanceKm: number; durationMin: number; gain?: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_COLORS: Record<string, string> = {
  "Vélo":           "bg-orange-100 text-orange-700",
  "Course à pied":  "bg-red-100 text-red-700",
  "Randonnée":      "bg-green-100 text-green-700",
  "Trail":          "bg-purple-100 text-purple-700",
  "Natation":       "bg-cyan-100 text-cyan-700",
  "Triathlon":      "bg-amber-100 text-amber-700",
};
const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Randonnée": "🥾",
  "Trail": "🏔️", "Natation": "🏊", "Triathlon": "🏅",
};
const RESSENTIS = ["😤", "😐", "💪", "🔥", "🏆"];
const GOAL_BIKE_KM    = 200;
const GOAL_ACTIVE_MIN = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRouteStats(route: string | null): { distanceKm: number; durationMin: number } | null {
  if (!route) return null;
  try {
    const r = JSON.parse(route) as StoredRoute;
    if (r.v === 2) return { distanceKm: r.distanceKm, durationMin: r.durationMin };
  } catch { /* */ }
  return null;
}

function today() { return new Date().toISOString().split("T")[0]; }

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { start, end };
}

function monthLabel() {
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

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`text-xl transition-transform hover:scale-110 ${n <= value ? "opacity-100" : "opacity-25"}`}>
          ⭐
        </button>
      ))}
    </div>
  );
}

// ─── Validation Card ──────────────────────────────────────────────────────────

function ValidationCard({
  s,
  onValidated,
}: {
  s: Sortie;
  onValidated: (sortieId: string, v: Validation) => void;
}) {
  const { user } = useUser();
  const [step, setStep]         = useState<"ask" | "form" | "rating" | "done">("ask");
  const [status, setStatus]     = useState<"oui" | "partiel" | "non" | null>(null);
  const [distance, setDistance] = useState(String(s.distanceKm ?? parseRouteStats(s.route)?.distanceKm ?? ""));
  const [duration, setDuration] = useState(String(parseRouteStats(s.route)?.durationMin ?? ""));
  const [ressenti, setRessenti] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationId, setValidationId] = useState("");

  // Rating state
  const [ambiance,        setAmbiance]        = useState(0);
  const [respect,         setRespect]         = useState(0);
  const [niveauCoherence, setNiveauCoherence] = useState(0);
  const [ratingDone,      setRatingDone]      = useState(false);

  async function handleStatus(st: "oui" | "partiel" | "non") {
    setStatus(st);
    if (st === "non") {
      await submitValidation(st, null, null, null);
    } else {
      setStep("form");
    }
  }

  async function submitValidation(
    st: "oui" | "partiel" | "non",
    dist: number | null,
    dur: number | null,
    res: string | null,
  ) {
    if (!user) return;
    setSubmitting(true);
    const res2 = await fetch("/api/validations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sortieId: s.id, userId: user.id, userEmail: user.email,
        status: st,
        distanceKm: dist,
        durationMin: dur,
        ressenti: res,
      }),
    });
    setSubmitting(false);
    if (res2.ok) {
      const data = await res2.json();
      setValidationId(data.id ?? "");
      const validation: Validation = { id: data.id ?? "", sortieId: s.id, status: st, distanceKm: dist, durationMin: dur, ressenti: res };
      onValidated(s.id, validation);
      if (st === "non") { setStep("done"); }
      else { setStep("rating"); }
    }
  }

  async function handleForm() {
    await submitValidation(
      status!,
      distance ? Number(distance) : null,
      duration ? Number(duration) : null,
      ressenti || null,
    );
  }

  async function handleRating() {
    if (!user || !ambiance || !respect || !niveauCoherence) return;
    setSubmitting(true);
    await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sortieId: s.id,
        organizerId: s.organizerId,
        raterId: user.id, raterEmail: user.email,
        ambiance, respect, niveauCoherence,
        validationId,
      }),
    });
    setSubmitting(false);
    setRatingDone(true);
    setStep("done");
  }

  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";
  const colorCls = SPORT_COLORS[s.sport] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
        <span className="text-xl">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{s.titre}</p>
          <p className="text-xs text-slate-500">{s.date}{s.lieu ? ` · ${s.lieu}` : ""}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${colorCls}`}>{s.sport}</span>
      </div>

      <div className="px-4 py-4">

        {/* Step: ask */}
        {step === "ask" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">As-tu effectué cette sortie ?</p>
            <div className="flex gap-2">
              <button onClick={() => handleStatus("oui")} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50">
                ✅ Oui
              </button>
              <button onClick={() => handleStatus("partiel")} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50">
                ⚡ Partiellement
              </button>
              <button onClick={() => handleStatus("non")} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold transition-all active:scale-95 disabled:opacity-50">
                ❌ Non
              </button>
            </div>
          </div>
        )}

        {/* Step: form */}
        {step === "form" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">
              {status === "partiel" ? "Dis-nous ce que tu as fait :" : "Détails de ta sortie :"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 font-medium">Distance réelle (km)</label>
                <input
                  type="number" min="0" step="0.1"
                  value={distance} onChange={(e) => setDistance(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex : 45"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium">Durée (min, optionnel)</label>
                <input
                  type="number" min="0"
                  value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex : 120"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Ressenti</label>
              <div className="flex gap-2 mt-1">
                {RESSENTIS.map((r) => (
                  <button key={r} type="button" onClick={() => setRessenti(r === ressenti ? "" : r)}
                    className={`text-2xl transition-all hover:scale-110 rounded-xl p-1 ${ressenti === r ? "bg-blue-100 ring-2 ring-blue-400 scale-110" : "opacity-50 hover:opacity-80"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setStep("ask")}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                ← Retour
              </button>
              <button type="button" onClick={handleForm} disabled={submitting}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 transition-all">
                {submitting ? "Enregistrement…" : "Valider ma sortie"}
              </button>
            </div>
          </div>
        )}

        {/* Step: rating */}
        {step === "rating" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <p className="text-sm font-semibold text-slate-800">Note l&apos;organisateur</p>
              <button type="button" onClick={() => setStep("done")}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline">
                Passer
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Ambiance du groupe</p>
                <StarPicker value={ambiance} onChange={setAmbiance} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Respect &amp; ponctualité</p>
                <StarPicker value={respect} onChange={setRespect} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">Cohérence du niveau</p>
                <StarPicker value={niveauCoherence} onChange={setNiveauCoherence} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleRating}
              disabled={submitting || !ambiance || !respect || !niveauCoherence}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold disabled:opacity-40 transition-all active:scale-95"
            >
              {submitting ? "Envoi…" : "Envoyer ma note"}
            </button>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="flex items-center gap-2 py-2">
            <span className="text-lg">{status === "non" ? "❌" : "✅"}</span>
            <p className="text-sm text-slate-600 font-medium">
              {status === "non"
                ? "Enregistré. On espère te revoir bientôt !"
                : ratingDone
                ? "Merci pour ta validation et ta note !"
                : "Sortie validée avec succès !"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortie Row ───────────────────────────────────────────────────────────────

function SortieRow({ s, mine }: { s: Sortie; mine: boolean }) {
  const colorClass = SPORT_COLORS[s.sport] ?? "bg-slate-100 text-slate-600";
  const emoji = SPORT_EMOJI[s.sport] ?? "🏅";
  const stats = parseRouteStats(s.route);
  const isPast = s.date < today();

  return (
    <Link href={`/sorties/${s.id}`}>
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md hover:border-blue-200 cursor-pointer ${isPast ? "opacity-60 bg-slate-50 border-slate-100" : "bg-white border-slate-100"}`}>
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
          {mine  && <span className="text-[10px] text-blue-500 font-medium">Organisateur</span>}
          {isPast && <span className="text-[10px] text-slate-400">Passée</span>}
        </div>
      </div>
    </Link>
  );
}

// ─── Strava Section ───────────────────────────────────────────────────────────

type SyncResult = { total: number; matched: number; validated: number };

function StravaSection({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [connected,  setConnected]  = useState<boolean | null>(null);
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError,  setSyncError]  = useState("");

  useEffect(() => {
    fetch(`/api/strava/status?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, [userId]);

  async function handleSync() {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userEmail }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: SyncResult = await res.json();
      setSyncResult(data);
    } catch (e) {
      setSyncError((e as Error).message ?? "Erreur sync");
    } finally {
      setSyncing(false);
    }
  }

  if (connected === null) return null; // loading

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-slate-700">🟠 Strava</h2>
        {connected && (
          <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
            Connecté
          </span>
        )}
      </div>

      {!connected ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🟠</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">Connecte ton compte Strava</p>
              <p className="text-xs text-slate-500 mt-1">
                Tes activités Strava seront automatiquement associées à tes sorties RidePlanner et valideront tes participations.
              </p>
            </div>
          </div>
          <a
            href={`/api/strava/auth?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}`}
            className="inline-flex items-center justify-center gap-2 bg-[#FC4C02] hover:bg-[#e04400] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
          >
            🔗 Connecter Strava
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Compte Strava lié</p>
              <p className="text-xs text-slate-500">Tes activités récentes seront associées à tes sorties.</p>
            </div>
            <a
              href={`/api/strava/auth?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}`}
              className="text-xs text-slate-400 hover:text-slate-600 underline flex-shrink-0"
            >
              Reconnecter
            </a>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 w-full bg-[#FC4C02] hover:bg-[#e04400] disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95"
          >
            {syncing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Synchronisation…
              </>
            ) : (
              "🔄 Synchroniser mes activités"
            )}
          </button>

          {syncResult && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm">
              <p className="font-semibold text-orange-800">Sync terminée ✅</p>
              <ul className="mt-1 text-xs text-orange-700 space-y-0.5">
                <li>• {syncResult.total} activité{syncResult.total > 1 ? "s" : ""} importée{syncResult.total > 1 ? "s" : ""}</li>
                <li>• {syncResult.matched} associée{syncResult.matched > 1 ? "s" : ""} à une sortie</li>
                {syncResult.validated > 0 && (
                  <li className="font-semibold">• {syncResult.validated} sortie{syncResult.validated > 1 ? "s" : ""} auto-validée{syncResult.validated > 1 ? "s" : ""} 🎉</li>
                )}
              </ul>
            </div>
          )}

          {syncError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{syncError}</p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sorties,     setSorties]     = useState<Sortie[]>([]);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [stravaToast, setStravaToast] = useState<"connected" | "denied" | "error" | null>(null);

  // Show Strava connection toast from redirect
  useEffect(() => {
    const s = searchParams.get("strava");
    if (s === "connected" || s === "denied" || s === "error") {
      setStravaToast(s as "connected" | "denied" | "error");
      // Remove query param without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("strava");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => setStravaToast(null), 4000);
    }
  }, [searchParams]);

  const todayStr = today();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }

    Promise.all([
      fetch("/api/sorties?includePast=true").then((r) => r.json()),
      fetch(`/api/validations?userId=${user.id}`).then((r) => r.json()).catch(() => []),
    ]).then(([s, v]) => {
      setSorties(s);
      setValidations(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, router]);

  // ── My sorties ─────────────────────────────────────────────────────────────
  const mySorties = useMemo(() => {
    if (!user) return [];
    return sorties.filter((s) => s.organizerId === user.id || s.participantIds.includes(user.id));
  }, [sorties, user]);

  const pastSorties = useMemo(() =>
    mySorties.filter((s) => s.date < todayStr),
  [mySorties, todayStr]);

  const upcoming = useMemo(() =>
    mySorties.filter((s) => s.date >= todayStr).slice(0, 5),
  [mySorties, todayStr]);

  // ── Pending validations ────────────────────────────────────────────────────
  const validatedIds = useMemo(() => new Set(validations.map((v) => v.sortieId)), [validations]);

  const pendingValidation = useMemo(() =>
    // Only participant sorties (not ones I organized), past and not yet validated
    pastSorties
      .filter((s) => s.organizerId !== user?.id && s.participantIds.includes(user?.id ?? "") && !validatedIds.has(s.id))
      .slice(0, 5),
  [pastSorties, validatedIds, user]);

  const handleValidated = useCallback((sortieId: string, v: Validation) => {
    setValidations((prev) => [...prev.filter((x) => x.sortieId !== sortieId), v]);
  }, []);

  // ── Stats from VALIDATED sorties only ──────────────────────────────────────
  const { start, end } = currentMonthRange();

  const validatedMonthly = useMemo(() => {
    return validations.filter((v) => {
      const s = sorties.find((s) => s.id === v.sortieId);
      return s && s.date >= start && s.date <= end && (v.status === "oui" || v.status === "partiel");
    });
  }, [validations, sorties, start, end]);

  const stats = useMemo(() => {
    let totalKm = 0;
    let totalMin = 0;
    const sportCount: Record<string, number> = {};

    for (const v of validatedMonthly) {
      const s = sorties.find((s) => s.id === v.sortieId);
      if (!s) continue;

      // Use actual reported distance if available, else route data
      if (v.distanceKm != null) totalKm += v.distanceKm;
      else {
        const r = parseRouteStats(s.route);
        if (r) totalKm += r.distanceKm;
        else if (s.distanceKm) totalKm += s.distanceKm;
      }

      if (v.durationMin != null) totalMin += v.durationMin;
      else {
        const r = parseRouteStats(s.route);
        if (r) totalMin += r.durationMin;
      }

      sportCount[s.sport] = (sportCount[s.sport] ?? 0) + 1;
    }

    return {
      count: validatedMonthly.length,
      totalKm: Math.round(totalKm * 10) / 10,
      totalMin,
      sportCount,
    };
  }, [validatedMonthly, sorties]);

  const bikeKm = useMemo(() => {
    let km = 0;
    for (const v of validatedMonthly.filter((v) => {
      const s = sorties.find((s) => s.id === v.sortieId);
      return s?.sport === "Vélo";
    })) {
      if (v.distanceKm != null) { km += v.distanceKm; continue; }
      const s = sorties.find((s) => s.id === v.sortieId);
      if (!s) continue;
      const r = parseRouteStats(s.route);
      if (r) km += r.distanceKm;
      else if (s.distanceKm) km += s.distanceKm;
    }
    return Math.round(km * 10) / 10;
  }, [validatedMonthly, sorties]);

  const bikeUnlocked   = bikeKm >= GOAL_BIKE_KM;
  const activeUnlocked = stats.totalMin >= GOAL_ACTIVE_MIN;

  // ── Historique (validated) ─────────────────────────────────────────────────
  const histPast = pastSorties.slice(0, 8);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Strava toast */}
        {stravaToast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${
            stravaToast === "connected" ? "bg-orange-500 text-white" :
            stravaToast === "denied"   ? "bg-slate-600 text-white" :
                                         "bg-red-500 text-white"
          }`}>
            {stravaToast === "connected" ? "🟠 Strava connecté avec succès !" :
             stravaToast === "denied"   ? "Connexion Strava annulée" :
                                          "Erreur lors de la connexion Strava"}
          </div>
        )}

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
            {/* ── À valider ── */}
            {pendingValidation.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold text-slate-700">🔔 À valider</h2>
                  <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {pendingValidation.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Ces sorties passées sont en attente de confirmation. Tes stats seront calculées à partir de tes validations.</p>
                <div className="flex flex-col gap-3">
                  {pendingValidation.map((s) => (
                    <ValidationCard key={s.id} s={s} onValidated={handleValidated} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Stats du mois (validées) ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-slate-700">📈 Ce mois-ci</h2>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                  Basé sur tes sorties validées
                </span>
              </div>

              {stats.count === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
                  <p className="text-slate-400 text-sm">Aucune sortie validée ce mois-ci.</p>
                  <p className="text-xs text-slate-300 mt-1">Valide tes sorties passées pour voir tes stats.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon="🏅" label="Sorties" value={stats.count} sub="validées" />
                    <StatCard icon="📏" label="Kilomètres" value={`${stats.totalKm} km`} />
                    <StatCard icon="⏱️" label="Temps actif" value={`${stats.totalMin} min`} />
                    <StatCard
                      icon="🚴"
                      label="Sport principal"
                      value={Object.entries(stats.sportCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}
                    />
                  </div>

                  {Object.keys(stats.sportCount).length > 0 && (
                    <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Répartition par sport</p>
                      <div className="flex flex-col gap-2">
                        {Object.entries(stats.sportCount).sort((a, b) => b[1] - a[1]).map(([sport, count]) => {
                          const pct = Math.round((count / stats.count) * 100);
                          return (
                            <div key={sport} className="flex items-center gap-2">
                              <span className="text-base w-6 text-center">{SPORT_EMOJI[sport] ?? "🏅"}</span>
                              <span className="text-xs text-slate-600 w-28 flex-shrink-0">{sport}</span>
                              <div className="flex-1"><ProgressBar value={count} max={stats.count} color="bg-blue-400" /></div>
                              <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Objectifs ── */}
            <section>
              <h2 className="text-base font-semibold text-slate-700 mb-3">🎯 Objectifs du mois</h2>
              <div className="flex flex-col gap-3">

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚴</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Objectif vélo</p>
                        <p className="text-xs text-slate-500">{bikeKm} / {GOAL_BIKE_KM} km</p>
                      </div>
                    </div>
                    {bikeUnlocked
                      ? <span className="text-lg">🏆</span>
                      : <span className="text-xs text-slate-400">{Math.round((bikeKm / GOAL_BIKE_KM) * 100)}%</span>}
                  </div>
                  <ProgressBar value={bikeKm} max={GOAL_BIKE_KM} color={bikeUnlocked ? "bg-amber-400" : "bg-orange-400"} />
                  <p className="text-xs text-slate-500 mt-2">
                    {bikeUnlocked
                      ? "🎉 Objectif atteint ! Badge vélo débloqué."
                      : `Encore ${Math.round((GOAL_BIKE_KM - bikeKm) * 10) / 10} km`}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚡</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Activité mensuelle</p>
                        <p className="text-xs text-slate-500">{stats.totalMin} / {GOAL_ACTIVE_MIN} min</p>
                      </div>
                    </div>
                    {activeUnlocked
                      ? <span className="text-lg">🏆</span>
                      : <span className="text-xs text-slate-400">{Math.round((stats.totalMin / GOAL_ACTIVE_MIN) * 100)}%</span>}
                  </div>
                  <ProgressBar value={stats.totalMin} max={GOAL_ACTIVE_MIN} color={activeUnlocked ? "bg-amber-400" : "bg-blue-500"} />
                  <p className="text-xs text-slate-500 mt-2">
                    {activeUnlocked
                      ? "🎉 Objectif atteint ! Badge activité débloqué."
                      : `Encore ${GOAL_ACTIVE_MIN - stats.totalMin} min`}
                  </p>
                </div>

                {(bikeUnlocked || activeUnlocked) && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-amber-800 mb-2">🏆 Badges débloqués</p>
                    <div className="flex gap-2 flex-wrap">
                      {bikeUnlocked   && <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full">🚴 Champion vélo</span>}
                      {activeUnlocked && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">⚡ Athlète du mois</span>}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Strava ── */}
            <StravaSection userId={user.id} userEmail={user.email} />

            {/* ── À venir ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-700">📅 À venir</h2>
                <Link href="/" className="text-xs text-blue-600 hover:underline">Voir toutes</Link>
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
                  {upcoming.map((s) => <SortieRow key={s.id} s={s} mine={s.organizerId === user.id} />)}
                </div>
              )}
            </section>

            {/* ── Historique ── */}
            {histPast.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-slate-700 mb-3">🕐 Historique</h2>
                <div className="flex flex-col gap-2">
                  {histPast.map((s) => (
                    <div key={s.id} className="relative">
                      <SortieRow s={s} mine={s.organizerId === user.id} />
                      {validatedIds.has(s.id) && (
                        <span className="absolute top-2 right-2 text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                          ✓ Validée
                        </span>
                      )}
                    </div>
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
