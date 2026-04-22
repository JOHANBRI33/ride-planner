"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

type Demande = {
  id: string;
  sport: string;
  message: string;
  date: string;
  zone: string;
  type: "cherche" | "propose";
  createdBy: string;
  responses: number;
  status: string;
  createdAt: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const SPORTS = ["Vélo", "Course à pied", "Trail", "Randonnée", "Natation", "Triathlon", "Autre"];

const SPORT_BADGE: Record<string, string> = {
  "Vélo":          "bg-blue-100 text-blue-700",
  "Course à pied": "bg-red-100 text-red-700",
  "Trail":         "bg-emerald-100 text-emerald-700",
  "Randonnée":     "bg-green-100 text-green-700",
  "Natation":      "bg-cyan-100 text-cyan-700",
  "Triathlon":     "bg-amber-100 text-amber-700",
  "Autre":         "bg-slate-100 text-slate-600",
};

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "⛰️",
  "Randonnée": "🥾", "Natation": "🏊", "Triathlon": "🏅", "Autre": "🏅",
};

// Post-it background palette (pastel)
const POSTIT_COLORS = [
  "bg-yellow-50 border-yellow-200",
  "bg-blue-50 border-blue-200",
  "bg-emerald-50 border-emerald-200",
  "bg-pink-50 border-pink-200",
  "bg-violet-50 border-violet-200",
  "bg-orange-50 border-orange-200",
  "bg-cyan-50 border-cyan-200",
];

// Deterministic rotation from id string (no hydration mismatch)
function getRotation(id: string): string {
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rotations = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.5deg]", "rotate-0"];
  return rotations[n % rotations.length];
}

function getColor(id: string): string {
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return POSTIT_COLORS[n % POSTIT_COLORS.length];
}

function shortEmail(email: string): string {
  return email?.split("@")[0] ?? "anonyme";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

// ── Post-it card ───────────────────────────────────────────────────────────

function PostItCard({ d, onInterest }: { d: Demande; onInterest: (id: string) => void }) {
  const [clicked, setClicked] = useState(false);
  const [count, setCount] = useState(d.responses);

  function handleInterest() {
    if (clicked) return;
    setClicked(true);
    setCount((c) => c + 1);
    onInterest(d.id);
  }

  const color = getColor(d.id);
  const rotation = getRotation(d.id);
  const typeLabel = d.type === "cherche" ? "cherche" : "propose";
  const typeStyle = d.type === "cherche"
    ? "bg-indigo-100 text-indigo-700"
    : "bg-emerald-100 text-emerald-700";

  return (
    <div className={`relative flex flex-col gap-2 border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${color} ${rotation}`}>

      {/* Pin décoratif */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-400/60 shadow-sm" />

      {/* Header : type + sport */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeStyle}`}>
          {typeLabel === "cherche" ? "🔍 Cherche" : "📣 Propose"}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SPORT_BADGE[d.sport] ?? "bg-slate-100 text-slate-600"}`}>
          {SPORT_EMOJI[d.sport] ?? "🏅"} {d.sport}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-3 flex-1">
        &ldquo;{d.message}&rdquo;
      </p>

      {/* Meta */}
      <div className="flex flex-col gap-0.5 text-[11px] text-slate-500">
        {d.zone && <span>📍 {d.zone}</span>}
        {d.date && <span>📅 {d.date}</span>}
        <span>✍️ {shortEmail(d.createdBy)}</span>
        {d.createdAt && <span className="text-slate-400">{formatDate(d.createdAt)}</span>}
      </div>

      {/* Footer : réponses + bouton */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-current/10">
        <span className="text-[11px] text-slate-500 font-medium">
          {count > 0 ? `${count} intéressé${count > 1 ? "s" : ""}` : "Sois le premier !"}
        </span>
        <button
          onClick={handleInterest}
          disabled={clicked}
          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 ${
            clicked
              ? "bg-emerald-500 text-white cursor-default"
              : "bg-white/80 hover:bg-white text-slate-700 border border-current/20 hover:shadow-sm"
          }`}
        >
          {clicked ? "✓ Intéressé !" : "👋 Répondre"}
        </button>
      </div>
    </div>
  );
}

// ── Create form ────────────────────────────────────────────────────────────

function CreateForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const { user } = useUser();
  const router = useRouter();
  const [sport, setSport] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [zone, setZone] = useState("");
  const [type, setType] = useState<"cherche" | "propose">("cherche");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push("/login"); return; }
    if (!sport || !message.trim()) { setError("Sport et message requis."); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/demandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sport, message: message.trim(), date, zone, type, createdBy: user.email }),
    });

    setLoading(false);
    if (res.ok) { onCreated(); onClose(); }
    else setError("Erreur lors de la publication.");
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 shadow-md flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-sm">📝 Nouvelle annonce</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Type */}
        <div className="flex gap-2">
          {(["cherche", "propose"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${
                type === t
                  ? t === "cherche" ? "bg-indigo-600 text-white border-indigo-600" : "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {t === "cherche" ? "🔍 Je cherche" : "📣 Je propose"}
            </button>
          ))}
        </div>

        {/* Sport */}
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          required
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Sport —</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Message */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={type === "cherche"
            ? "Ex : Je cherche quelqu'un pour un trail dimanche matin autour de Bordeaux…"
            : "Ex : Je propose une sortie vélo de 80km, niveau intermédiaire…"}
          maxLength={200}
          rows={3}
          required
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <span className="text-[10px] text-slate-400 -mt-2">{message.length}/200</span>

        {/* Zone + Date */}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Zone (ex: Bordeaux)"
            maxLength={50}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Publication…" : "📌 Publier l'annonce"}
        </button>
      </form>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CommunauteBoard() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => { loadDemandes(); }, []);

  async function loadDemandes() {
    try {
      const res = await fetch("/api/demandes");
      if (res.ok) setDemandes(await res.json());
    } finally { setLoading(false); }
  }

  async function handleInterest(id: string) {
    await fetch(`/api/demandes/${id}`, { method: "PATCH" });
  }

  function handleCreate() {
    if (!user) { router.push("/login"); return; }
    setShowForm(true);
  }

  const visible = showAll ? demandes : demandes.slice(0, 8);

  return (
    <section className="bg-white border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              💬 La communauté s&apos;organise
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Cherche un partenaire ou propose une idée de sortie
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 text-sm font-semibold bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.97]"
          >
            📌 Publier une annonce
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-6 max-w-md">
            <CreateForm onCreated={loadDemandes} onClose={() => setShowForm(false)} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 h-44 flex flex-col gap-3">
                <div className="h-3 shimmer rounded-full w-2/3" />
                <div className="h-3 shimmer rounded-full w-full" />
                <div className="h-3 shimmer rounded-full w-3/4" />
                <div className="mt-auto h-7 shimmer rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && demandes.length === 0 && !showForm && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-slate-600">Aucune annonce pour l&apos;instant</p>
            <p className="text-sm text-slate-400 mt-1">Sois le premier à chercher un partenaire !</p>
            <button
              onClick={handleCreate}
              className="mt-4 text-sm font-semibold bg-slate-900 hover:bg-slate-700 text-white px-5 py-2 rounded-xl shadow-sm transition-all"
            >
              Publier une annonce →
            </button>
          </div>
        )}

        {/* Grid post-it */}
        {!loading && visible.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((d) => (
              <PostItCard key={d.id} d={d} onInterest={handleInterest} />
            ))}
          </div>
        )}

        {/* Voir plus */}
        {!loading && demandes.length > 8 && (
          <div className="text-center mt-6">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-5 py-2 rounded-xl transition-all"
            >
              {showAll ? "Voir moins ↑" : `Voir tout (${demandes.length}) →`}
            </button>
          </div>
        )}

      </div>
    </section>
  );
}
