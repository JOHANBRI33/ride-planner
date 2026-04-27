"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

type Demande = {
  id: string;
  sport: string;
  message: string;
  date: string;
  heure?: string;
  zone: string;
  distance?: string;
  denivele?: string;
  objectif?: string;
  type: "cherche" | "propose";
  createdBy: string;
  responses: number;
  status: string;
  createdAt: string;
  interestedUsers: string[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const SPORTS = ["Vélo", "Course à pied", "Trail", "Randonnée", "Natation", "Triathlon", "Autre sport"];

const SPORT_BADGE: Record<string, string> = {
  "Vélo":           "bg-blue-100 text-blue-700",
  "Course à pied":  "bg-red-100 text-red-700",
  "Trail":          "bg-emerald-100 text-emerald-700",
  "Randonnée":      "bg-green-100 text-green-700",
  "Natation":       "bg-cyan-100 text-cyan-700",
  "Triathlon":      "bg-amber-100 text-amber-700",
  "Autre sport":    "bg-slate-100 text-slate-600",
};

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "⛰️",
  "Randonnée": "🥾", "Natation": "🏊", "Triathlon": "🏅", "Autre sport": "🏅",
};

const OBJECTIFS = [
  "Sortie découverte", "Entraînement", "Compétition / prépa",
  "Longue distance", "Récupération active", "Autre",
];

const POSTIT_COLORS = [
  "bg-yellow-50 border-yellow-200",
  "bg-blue-50 border-blue-200",
  "bg-emerald-50 border-emerald-200",
  "bg-pink-50 border-pink-200",
  "bg-violet-50 border-violet-200",
  "bg-orange-50 border-orange-200",
  "bg-cyan-50 border-cyan-200",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getRotation(id: string): string {
  const n = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.5deg]", "rotate-0"][n % 5];
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
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }); }
  catch { return iso; }
}

function avatarUrl(email: string): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(email)}`;
}

// ── Modal ──────────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        {children}
      </div>
    </div>
  );
}

// ── Edit Form ──────────────────────────────────────────────────────────────

function EditForm({ d, onSaved, onClose }: { d: Demande; onSaved: (updated: Demande) => void; onClose: () => void }) {
  const { user } = useUser();
  const [sport, setSport]       = useState(d.sport);
  const [message, setMessage]   = useState(d.message);
  const [zone, setZone]         = useState(d.zone);
  const [date, setDate]         = useState(d.date);
  const [heure, setHeure]       = useState(d.heure ?? "");
  const [distance, setDistance] = useState(d.distance ?? "");
  const [denivele, setDenivele] = useState(d.denivele ?? "");
  const [objectif, setObjectif] = useState(d.objectif ?? "");
  const [type, setType]         = useState<"cherche" | "propose">(d.type);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/demandes/${d.id}?action=update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: user.email, sport, message, zone, date, heure, distance, denivele, objectif, type }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      const updated = { ...d, sport, message, zone, date, heure, distance, denivele, objectif, type };
      onSaved(updated);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-slate-800">✏️ Modifier la demande</h3>

      <div className="flex gap-2">
        {(["cherche", "propose"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`flex-1 text-xs font-bold py-2 rounded-xl border transition-all ${type === t ? (t === "cherche" ? "bg-indigo-600 text-white border-indigo-600" : "bg-emerald-600 text-white border-emerald-600") : "bg-white text-slate-600 border-slate-200"}`}>
            {t === "cherche" ? "🔍 Cherche" : "📣 Propose"}
          </button>
        ))}
      </div>

      <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls}>
        {SPORTS.map((s) => <option key={s} value={s}>{SPORT_EMOJI[s] ?? "🏅"} {s}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone" className={inputCls} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={inputCls} />
        <input value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Distance" className={inputCls} />
      </div>
      <input value={denivele} onChange={(e) => setDenivele(e.target.value)} placeholder="Dénivelé" className={inputCls} />
      <select value={objectif} onChange={(e) => setObjectif(e.target.value)} className={inputCls}>
        <option value="">— Objectif —</option>
        {OBJECTIFS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={240} placeholder="Message…" className={`${inputCls} resize-none`} />

      {error && <p className="text-xs text-red-500">{error}</p>}

      {saved ? (
        <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="text-emerald-600 font-bold text-sm">✅ Modifications enregistrées !</span>
        </div>
      ) : (
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} type="button" className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Annuler</button>
          <button onClick={handleSave} disabled={saving} type="button" className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Demande Modal ──────────────────────────────────────────────────────────

function DemandeModal({
  d: initialD,
  onClose,
  onDeleted,
  onUpdated,
}: {
  d: Demande;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (d: Demande) => void;
}) {
  const { user } = useUser();
  const router = useRouter();
  const [d, setD]           = useState(initialD);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCreator = !!user && user.email === d.createdBy;
  const isInterested = !!user && d.interestedUsers.includes(user.email);

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    const res = await fetch(`/api/demandes/${d.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: user.email }),
    });
    setDeleting(false);
    if (res.ok) { onDeleted(d.id); onClose(); }
  }

  function handleCreateSortie() {
    const params = new URLSearchParams();
    if (d.sport) params.set("sport", d.sport);
    if (d.date)  params.set("date", d.date);
    if (d.zone)  params.set("lieu", d.zone);
    router.push(`/create?${params.toString()}`);
    onClose();
  }

  if (editing) {
    return (
      <Modal onClose={onClose}>
        <EditForm
          d={d}
          onSaved={(updated) => { setD(updated); onUpdated(updated); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      </Modal>
    );
  }

  const typeStyle = d.type === "cherche" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700";

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeStyle}`}>
              {d.type === "cherche" ? "🔍 Cherche" : "📣 Propose"}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SPORT_BADGE[d.sport] ?? "bg-slate-100 text-slate-600"}`}>
              {SPORT_EMOJI[d.sport] ?? "🏅"} {d.sport}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            par <span className="font-semibold text-slate-600">{shortEmail(d.createdBy)}</span>
            {d.createdAt && ` · ${formatDate(d.createdAt)}`}
          </p>
        </div>
        {isCreator && (
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(true)} title="Modifier" className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">✏️</button>
            <button onClick={() => setConfirmDelete(true)} title="Supprimer" className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-100 hover:bg-red-50 text-red-400 transition-colors">🗑</button>
          </div>
        )}
      </div>

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-red-700">Supprimer cette demande ?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Annuler</button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
              {deleting ? "Suppression…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {/* Message */}
      {d.message && (
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-2xl px-4 py-3 italic">
          &ldquo;{d.message}&rdquo;
        </p>
      )}

      {/* Infos */}
      <div className="grid grid-cols-2 gap-2">
        {d.zone     && <InfoPill icon="📍" value={d.zone} />}
        {d.date     && <InfoPill icon="📅" value={`${d.date}${d.heure ? ` · ${d.heure}` : ""}`} />}
        {d.distance && <InfoPill icon="📏" value={d.distance} />}
        {d.denivele && <InfoPill icon="⛰️" value={d.denivele} />}
        {d.objectif && <InfoPill icon="🎯" value={d.objectif} />}
      </div>

      {/* Intéressés */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {d.interestedUsers.length > 0
            ? `${d.interestedUsers.length} personne${d.interestedUsers.length > 1 ? "s" : ""} intéressée${d.interestedUsers.length > 1 ? "s" : ""}`
            : "Sois le premier à lancer la sortie ! 🚀"}
        </p>
        {d.interestedUsers.length > 0 && (
          <div className="flex flex-col gap-2">
            {d.interestedUsers.slice(0, 8).map((email) => (
              <div key={email} className="flex items-center gap-2">
                <img src={avatarUrl(email)} alt="" className="w-7 h-7 rounded-full bg-slate-100" />
                <span className="text-sm text-slate-700">{shortEmail(email)}</span>
                {email === d.createdBy && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Créateur</span>}
                {isCreator && email !== user?.email && (
                  <a href={`mailto:${email}`} className="ml-auto text-xs text-blue-500 hover:underline">
                    💬 Contacter
                  </a>
                )}
              </div>
            ))}
            {d.interestedUsers.length > 8 && (
              <p className="text-xs text-slate-400">+{d.interestedUsers.length - 8} autres</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
        {!isInterested && user && (
          <p className="text-xs text-slate-400 text-center">Clique sur &quot;Intéressé&quot; sur la carte pour rejoindre</p>
        )}
        {isInterested && (
          <div className="flex items-center justify-center gap-2 py-2 bg-emerald-50 rounded-xl">
            <span className="text-emerald-600 font-semibold text-sm">✓ Tu es intéressé</span>
          </div>
        )}
        <button
          onClick={handleCreateSortie}
          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-700 text-white font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          🚀 Créer une sortie à partir de cette demande
        </button>
      </div>
    </Modal>
  );
}

function InfoPill({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600 font-medium">
      <span>{icon}</span><span className="truncate">{value}</span>
    </div>
  );
}

// ── Post-it card ───────────────────────────────────────────────────────────

function PostItCard({
  d: initialD,
  onOpenModal,
  onInterestToggle,
}: {
  d: Demande;
  onOpenModal: (d: Demande) => void;
  onInterestToggle: (id: string, newD: Partial<Demande>) => void;
}) {
  const { user } = useUser();
  const router = useRouter();
  const [d, setD] = useState(initialD);
  const [loading, setLoading] = useState(false);

  // Resync si le parent met à jour la demande (ex: après édition)
  useEffect(() => { setD(initialD); }, [initialD]);

  const isInterested = !!user && d.interestedUsers.includes(user.email);
  const isCreator    = !!user && user.email === d.createdBy;

  const typeStyle = d.type === "cherche" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700";

  async function handleInterest(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) { router.push("/login"); return; }
    if (isInterested || loading) return;

    setLoading(true);
    const res = await fetch(`/api/demandes/${d.id}?action=interest`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userEmail: user.email }),
    });
    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      const updated = { ...d, responses: data.responses, interestedUsers: data.interested_users ?? [...d.interestedUsers, user.email] };
      setD(updated);
      onInterestToggle(d.id, { responses: updated.responses, interestedUsers: updated.interestedUsers });
    }
  }

  return (
    <div
      onClick={() => onOpenModal(d)}
      className={`relative flex flex-col gap-2 border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${getColor(d.id)} ${getRotation(d.id)}`}
    >
      {/* Pin */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-slate-400/60 shadow-sm" />

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeStyle}`}>
          {d.type === "cherche" ? "🔍 Cherche" : "📣 Propose"}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SPORT_BADGE[d.sport] ?? "bg-slate-100 text-slate-600"}`}>
          {SPORT_EMOJI[d.sport] ?? "🏅"} {d.sport}
        </span>
        {isCreator && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Ma demande</span>}
      </div>

      {/* Message */}
      {d.message && (
        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-3 flex-1">
          &ldquo;{d.message}&rdquo;
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-col gap-0.5 text-[11px] text-slate-500">
        {d.zone    && <span>📍 {d.zone}</span>}
        {d.date    && <span>📅 {d.date}{d.heure ? ` · ${d.heure}` : ""}</span>}
        {d.distance && <span>📏 {d.distance}</span>}
        {d.objectif && <span>🎯 {d.objectif}</span>}
        <span>✍️ {shortEmail(d.createdBy)}</span>
      </div>

      {/* Avatars intéressés */}
      {d.interestedUsers.length > 0 && (
        <div className="flex items-center gap-1 mt-0.5">
          {d.interestedUsers.slice(0, 4).map((email) => (
            <img key={email} src={avatarUrl(email)} alt="" className="w-5 h-5 rounded-full bg-white border border-white ring-1 ring-slate-200" />
          ))}
          {d.interestedUsers.length > 4 && (
            <span className="text-[10px] text-slate-500 ml-1">+{d.interestedUsers.length - 4}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-current/10" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11px] text-slate-500 font-medium">
          {d.responses > 0 ? `${d.responses} intéressé${d.responses > 1 ? "s" : ""}` : "Sois le premier !"}
        </span>

        {isCreator ? (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenModal(d); }}
              title="Modifier"
              className="text-xs px-2 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-current/20 text-slate-600 transition-all active:scale-95"
            >✏️</button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenModal(d); }}
              title="Supprimer"
              className="text-xs px-2 py-1.5 rounded-xl bg-white/80 hover:bg-red-50 border border-current/20 text-red-400 transition-all active:scale-95"
            >🗑</button>
          </div>
        ) : (
          <button
            onClick={handleInterest}
            disabled={isInterested || loading}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 ${
              isInterested
                ? "bg-emerald-500 text-white cursor-default"
                : loading
                ? "bg-slate-200 text-slate-400 cursor-wait"
                : "bg-white/80 hover:bg-white text-slate-700 border border-current/20 hover:shadow-sm"
            }`}
          >
            {loading ? "…" : isInterested ? "✓ Intéressé !" : "👋 Je suis intéressé"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Create form ────────────────────────────────────────────────────────────

function CreateForm({ onCreated, onClose, defaultType = "cherche" }: { onCreated: () => void; onClose: () => void; defaultType?: "cherche" | "propose" }) {
  const { user } = useUser();
  const router = useRouter();
  const [type, setType]           = useState<"cherche" | "propose">(defaultType);
  const [sport, setSport]         = useState("");
  const [message, setMessage]     = useState("");
  const [date, setDate]           = useState("");
  const [heure, setHeure]         = useState("");
  const [zone, setZone]           = useState("");
  const [distance, setDistance]   = useState("");
  const [denivele, setDenivele]   = useState("");
  const [objectif, setObjectif]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push("/login"); return; }
    if (!sport) { setError("Choisis un sport."); return; }
    if (!zone.trim()) { setError("La zone est requise."); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/demandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport, message: message.trim(), date, heure, zone: zone.trim(),
        distance, denivele, objectif, type, createdBy: user.email,
      }),
    });

    setLoading(false);
    if (res.ok) { onCreated(); onClose(); }
    else {
      const data = await res.json().catch(() => null);
      setError((data as {error?:string} | null)?.error ?? `Erreur HTTP ${res.status}`);
    }
  }

  const msgPlaceholder = type === "cherche"
    ? "Ex : Je cherche quelqu'un pour un trail dimanche matin…"
    : "Ex : Je propose une sortie vélo de 80 km, allure modérée…";

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 shadow-md flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">🎯 Mon intention sportive</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Remplis ce qui est pertinent pour ta sortie</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(["cherche", "propose"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 text-xs font-bold py-2.5 rounded-xl border transition-all ${
                type === t
                  ? t === "cherche" ? "bg-indigo-600 text-white border-indigo-600" : "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}>
              {t === "cherche" ? "🔍 Je cherche une sortie" : "📣 Je propose une sortie"}
            </button>
          ))}
        </div>

        <select value={sport} onChange={(e) => setSport(e.target.value)} required className={inputCls}>
          <option value="">— Quel sport ? —</option>
          {SPORTS.map((s) => <option key={s} value={s}>{SPORT_EMOJI[s] ?? "🏅"} {s}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone (ex : Bordeaux)" maxLength={60} required className={inputCls} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={inputCls} />
          <input value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="Distance (ex : 50 km)" maxLength={20} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={denivele} onChange={(e) => setDenivele(e.target.value)} placeholder="Dénivelé (ex : +800 m)" maxLength={20} className={inputCls} />
          <select value={objectif} onChange={(e) => setObjectif(e.target.value)} className={inputCls}>
            <option value="">— Objectif —</option>
            {OBJECTIFS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={msgPlaceholder} maxLength={240} rows={3} className={`${inputCls} resize-none`} />
          <span className="text-[10px] text-slate-400 block text-right -mt-1">{message.length}/240</span>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button type="submit" disabled={loading}
          className="bg-slate-900 hover:bg-slate-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50">
          {loading ? "Publication…" : "📌 Publier mon intention"}
        </button>
      </form>
    </div>
  );
}

const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Main component ─────────────────────────────────────────────────────────

export default function CommunauteBoard({
  autoOpen = null,
  onAutoOpenDone,
}: {
  autoOpen?: "cherche" | "propose" | null;
  onAutoOpenDone?: () => void;
}) {
  const [demandes, setDemandes]       = useState<Demande[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [defaultType, setDefaultType] = useState<"cherche" | "propose">("cherche");
  const [showAll, setShowAll]         = useState(false);
  const [selectedDemande, setSelected] = useState<Demande | null>(null);
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => { loadDemandes(); }, []);

  // Auto-open form when triggered from homepage
  useEffect(() => {
    if (!autoOpen) return;
    setDefaultType(autoOpen);
    setShowForm(true);
    onAutoOpenDone?.();
  }, [autoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDemandes() {
    try {
      const res = await fetch("/api/demandes");
      if (res.ok) setDemandes(await res.json());
    } finally { setLoading(false); }
  }

  const handleInterestToggle = useCallback((id: string, patch: Partial<Demande>) => {
    setDemandes((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setDemandes((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleUpdated = useCallback((updated: Demande) => {
    setDemandes((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    setSelected(updated);
  }, []);

  const visible = showAll ? demandes : demandes.slice(0, 8);

  return (
    <section className="bg-white border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {/* Header */}
        <div className="mb-7">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            🤝 Trouver ou organiser une sortie
          </h2>
          <p className="text-sm text-slate-400 mt-1">Propose une sortie ou trouve des partenaires près de toi</p>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-7 max-w-xl">
            <CreateForm defaultType={defaultType} onCreated={loadDemandes} onClose={() => setShowForm(false)} />
          </div>
        )}

        {/* Loading skeleton */}
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

        {/* Empty state */}
        {!loading && demandes.length === 0 && !showForm && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-4xl mb-3">🎯</p>
            <p className="font-semibold text-slate-600">Aucune intention publiée pour l&apos;instant</p>
            <p className="text-sm text-slate-400 mt-1">Utilise le bouton &quot;+ Créer une sortie&quot; en haut de page !</p>
          </div>
        )}

        {/* Grid */}
        {!loading && visible.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((d) => (
              <PostItCard
                key={d.id}
                d={d}
                onOpenModal={setSelected}
                onInterestToggle={handleInterestToggle}
              />
            ))}
          </div>
        )}

        {/* Voir plus */}
        {!loading && demandes.length > 8 && (
          <div className="text-center mt-6">
            <button onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-5 py-2 rounded-xl transition-all">
              {showAll ? "Voir moins ↑" : `Voir tout (${demandes.length}) →`}
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedDemande && (
        <DemandeModal
          d={selectedDemande}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}
    </section>
  );
}
