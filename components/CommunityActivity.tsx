"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

// ── Types ──────────────────────────────────────────────────────────────────

type Sortie = {
  id: string;
  titre: string;
  lieu: string;
  date: string;
  heure: string;
  sport: string;
  niveau?: string;
  nbParticipants?: number;
  participantsMax?: number;
  participantIds?: string[];
  organizerId?: string;
  status?: string;
  createdAt?: string;
  distanceKm?: number;
  elevationGain?: number;
};

type RideRequest = {
  id: string;
  type: "propose" | "search";
  userEmail: string;
  userId: string;
  date: string;
  timeFrom?: string;
  timeTo?: string;
  sport: string;
  status: string;
  createdAt: string;
  // propose fields
  startAddress?: string;
  distanceKm?: number;
  elevationGain?: number;
  level?: string;
  maxParticipants?: number;
  description?: string;
  // search fields
  searchLocation?: string;
  searchRadius?: number;
  distanceMin?: number;
  distanceMax?: number;
  elevationType?: string;
  objective?: string;
  specificObjective?: string;
  groupPreference?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  "Course à pied": "🏃", Vélo: "🚴", Randonnée: "🥾",
  Trail: "⛰️", Natation: "🏊", Triathlon: "🏅",
};

const SPORT_COLOR: Record<string, string> = {
  "Course à pied": "bg-red-100 text-red-700",
  Vélo: "bg-orange-100 text-orange-700",
  Randonnée: "bg-emerald-100 text-emerald-700",
  Trail: "bg-purple-100 text-purple-700",
  Natation: "bg-cyan-100 text-cyan-700",
  Triathlon: "bg-amber-100 text-amber-700",
};

function isNew(createdAt?: string): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  // if already dd/mm/yyyy keep it
  if (iso.includes("/")) return iso;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function shortEmail(email: string): string {
  return email.split("@")[0];
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SportBadge({ sport }: { sport: string }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${SPORT_COLOR[sport] ?? "bg-slate-100 text-slate-600"}`}>
      {SPORT_EMOJI[sport] ?? "🏅"} {sport}
    </span>
  );
}

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg">
      <span>{icon}</span>{label}
    </span>
  );
}

// ── Proposition card (sortie) ──────────────────────────────────────────────

function ProposeCard({ s, onJoin }: { s: Sortie; onJoin: (id: string) => void }) {
  const { user } = useUser();
  const isFull = (s.nbParticipants ?? 0) >= (s.participantsMax ?? 999);
  const isOrganizer = user?.id === s.organizerId;
  const dejaInscrit = user ? (s.participantIds ?? []).includes(user.id) : false;
  const pct = s.participantsMax ? Math.min(100, ((s.nbParticipants ?? 0) / s.participantsMax) * 100) : 0;
  const novel = isNew(s.createdAt);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {novel && <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">🆕 Nouveau</span>}
            {pct >= 70 && !isFull && <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">🔥 Populaire</span>}
            {isFull && <span className="text-[10px] font-bold bg-slate-400 text-white px-2 py-0.5 rounded-full">Complet</span>}
          </div>
          <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{s.titre}</h3>
          <p className="text-xs text-slate-400 truncate">par {shortEmail(s.organizerId ?? "unknown")}</p>
        </div>
        <SportBadge sport={s.sport} />
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-1.5">
        <StatPill icon="📍" label={s.lieu} />
        <StatPill icon="📅" label={`${formatDate(s.date)} · ${s.heure}`} />
        {s.distanceKm && <StatPill icon="📏" label={`${s.distanceKm.toFixed(1)} km`} />}
        {s.elevationGain && <StatPill icon="⬆️" label={`${s.elevationGain} m`} />}
        {s.niveau && <StatPill icon="🎯" label={s.niveau} />}
      </div>

      {/* Progress */}
      {s.participantsMax && (
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>{s.nbParticipants ?? 0}/{s.participantsMax} participants</span>
            <span>{Math.round(pct)}% rempli</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isFull ? "bg-red-400" : pct > 70 ? "bg-orange-400" : "bg-emerald-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {!isOrganizer && (
          <button
            onClick={() => !dejaInscrit && !isFull && onJoin(s.id)}
            disabled={isFull || dejaInscrit || s.status === "closed"}
            className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all duration-150 active:scale-[0.97] ${
              dejaInscrit ? "bg-emerald-100 text-emerald-600 cursor-default"
              : isFull || s.status === "closed" ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm"
            }`}
          >
            {dejaInscrit ? "✓ Inscrit" : isFull ? "Complet" : "Rejoindre →"}
          </button>
        )}
        <Link href={`/sorties/${s.id}`} className={isOrganizer ? "flex-1" : ""}>
          <button className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all duration-150">
            {isOrganizer ? "⚙️ Gérer" : "Discuter 💬"}
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── Search card (ride_request) ─────────────────────────────────────────────

function SearchCard({ r }: { r: RideRequest }) {
  const router = useRouter();
  const { user } = useUser();
  const [responded, setResponded] = useState(false);
  const novel = isNew(r.createdAt);
  const isMine = user?.id === r.userId;

  function handleDispo() {
    if (!user) { router.push("/login?redirect=/"); return; }
    setResponded(true);
    setTimeout(() => setResponded(false), 3000);
  }

  function buildCreateUrl(): string {
    const p = new URLSearchParams();
    if (r.date) p.set("date", r.date);
    if (r.sport) p.set("sport", r.sport);
    if (r.timeFrom) p.set("heure", r.timeFrom);
    if (r.searchLocation) p.set("lieu", r.searchLocation);
    return `/create?${p.toString()}`;
  }

  const locationLabel = r.searchLocation ?? (r.type === "propose" ? r.startAddress : undefined) ?? "";
  const distLabel = r.distanceMin != null && r.distanceMax != null
    ? `${r.distanceMin}–${r.distanceMax} km`
    : r.distanceKm ? `${r.distanceKm} km` : null;
  const objectiveLabel = r.specificObjective ?? r.objective ?? null;

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {novel && <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">🆕 Nouveau</span>}
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">🔍 Recherche</span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm leading-snug">
            {shortEmail(r.userEmail)} cherche un partenaire
          </h3>
          <p className="text-xs text-slate-400">{formatDate(r.date)} {r.timeFrom ? `· ${r.timeFrom}` : ""}{r.timeTo ? `–${r.timeTo}` : ""}</p>
        </div>
        <SportBadge sport={r.sport} />
      </div>

      {/* Info */}
      <div className="flex flex-wrap gap-1.5">
        {locationLabel && <StatPill icon="📍" label={locationLabel} />}
        {r.searchRadius && <StatPill icon="📡" label={`${r.searchRadius} km`} />}
        {distLabel && <StatPill icon="📏" label={distLabel} />}
        {r.elevationType && <StatPill icon="⛰️" label={r.elevationType} />}
        {r.level && <StatPill icon="🎯" label={r.level} />}
        {r.groupPreference && <StatPill icon="👥" label={r.groupPreference} />}
      </div>

      {/* Objectif */}
      {objectiveLabel && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 italic">
          &ldquo;{objectiveLabel}&rdquo;
        </p>
      )}

      {/* Actions */}
      {!isMine && (
        <div className="flex gap-2 pt-1">
          <Link href={buildCreateUrl()} className="flex-1">
            <button className="w-full text-xs font-bold py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all duration-150 active:scale-[0.97]">
              🗺️ Proposer un circuit
            </button>
          </Link>
          <button
            onClick={handleDispo}
            className={`flex-1 text-xs font-bold py-2 rounded-xl border-2 transition-all duration-150 active:scale-[0.97] ${
              responded
                ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
            }`}
          >
            {responded ? "✓ Message envoyé !" : "👋 Je suis dispo"}
          </button>
        </div>
      )}
      {isMine && (
        <p className="text-xs text-slate-400 text-center pt-1">📬 Ta demande · en attente de réponses</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const PAGE_SIZE = 6;

export default function CommunityActivity() {
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"propositions" | "recherches">("propositions");
  const [showAllProps, setShowAllProps] = useState(false);
  const [showAllReqs, setShowAllReqs] = useState(false);
  const [joinToast, setJoinToast] = useState("");
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/sorties").then((r) => r.json()),
      fetch("/api/ride-requests").then((r) => r.json()),
    ]).then(([s, rq]) => {
      setSorties(Array.isArray(s) ? s : []);
      setRequests(Array.isArray(rq) ? rq : []);
      setLoading(false);
    });
  }, []);

  async function handleJoin(id: string) {
    if (!user) { router.push("/login?redirect=/"); return; }
    await fetch(`/api/sorties/${id}?action=join`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userEmail: user.email }),
    });
    const data = await fetch("/api/sorties").then((r) => r.json());
    setSorties(data);
    setJoinToast("Tu as rejoint la sortie 🎉");
    setTimeout(() => setJoinToast(""), 3000);
  }

  // Sort propositions by date proximity
  const sortedSorties = [...sorties]
    .filter((s) => s.status !== "closed")
    .sort((a, b) => {
      const da = a.date ? new Date(a.date.split("/").reverse().join("-")).getTime() : 0;
      const db = b.date ? new Date(b.date.split("/").reverse().join("-")).getTime() : 0;
      return da - db;
    });

  // Sort requests by createdAt desc
  const sortedRequests = [...requests]
    .filter((r) => r.status === "open")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const visibleSorties = showAllProps ? sortedSorties : sortedSorties.slice(0, PAGE_SIZE);
  const visibleRequests = showAllReqs ? sortedRequests : sortedRequests.slice(0, PAGE_SIZE);

  const propCount = sortedSorties.length;
  const reqCount = sortedRequests.length;
  const newReqCount = sortedRequests.filter((r) => isNew(r.createdAt)).length;

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Activité autour de toi
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Propositions et recherches de sorties de la communauté
            </p>
          </div>
          <Link href="/request">
            <button className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.97]">
              + Poster une demande
            </button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-6 w-fit">
          <button
            onClick={() => setTab("propositions")}
            className={`relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              tab === "propositions"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🏁 Propositions
            {propCount > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {propCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("recherches")}
            className={`relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              tab === "recherches"
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🔍 Recherches
            {newReqCount > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {newReqCount} new
              </span>
            )}
            {reqCount > 0 && newReqCount === 0 && (
              <span className="bg-slate-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {reqCount}
              </span>
            )}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-48 flex flex-col gap-3">
                <div className="h-4 shimmer rounded-full w-2/3" />
                <div className="h-3 shimmer rounded-full w-1/2" />
                <div className="flex gap-2 mt-auto">
                  <div className="h-8 shimmer rounded-xl flex-1" />
                  <div className="h-8 shimmer rounded-xl flex-1" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Propositions */}
        {!loading && tab === "propositions" && (
          <>
            {visibleSorties.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">🏁</p>
                <p className="font-semibold text-slate-600">Aucune sortie proposée pour l&apos;instant</p>
                <Link href="/create">
                  <button className="mt-4 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2 rounded-xl shadow-sm transition-all">
                    Créer la première →
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleSorties.map((s) => (
                  <ProposeCard key={s.id} s={s} onJoin={handleJoin} />
                ))}
              </div>
            )}
            {sortedSorties.length > PAGE_SIZE && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowAllProps((v) => !v)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-5 py-2 rounded-xl transition-all"
                >
                  {showAllProps ? "Voir moins ↑" : `Voir tout (${sortedSorties.length}) →`}
                </button>
              </div>
            )}
          </>
        )}

        {/* Recherches */}
        {!loading && tab === "recherches" && (
          <>
            {visibleRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-slate-600">Aucune recherche active</p>
                <Link href="/request">
                  <button className="mt-4 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl shadow-sm transition-all">
                    Poster une recherche →
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleRequests.map((r) => (
                  <SearchCard key={r.id} r={r} />
                ))}
              </div>
            )}
            {sortedRequests.length > PAGE_SIZE && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowAllReqs((v) => !v)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-5 py-2 rounded-xl transition-all"
                >
                  {showAllReqs ? "Voir moins ↑" : `Voir tout (${sortedRequests.length}) →`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast join */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
        joinToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}>
        <div className="bg-emerald-600 text-white rounded-2xl shadow-lg px-6 py-3 text-sm font-bold whitespace-nowrap">
          ✅ {joinToast}
        </div>
      </div>
    </section>
  );
}
