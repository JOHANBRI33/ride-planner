"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { resolveSortieImage, SPORT_IMAGE_FALLBACK } from "@/lib/getAutoImage";
import { parseRoute } from "@/lib/mapbox/parseRoute";
import { getDifficulty } from "@/lib/elevation/elevationService";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });
const RoutePickerMap = dynamic(() => import("@/components/RoutePickerMap"), { ssr: false });

type Sortie = {
  id: string;
  titre: string;
  lieu: string;
  date: string;
  heure: string;
  niveau: string;
  sport: string;
  nbParticipants: number;
  participantsMax: number;
  image: string | null;
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  participantIds?: string[];
  participantEmails?: string[];
  organizerId?: string | null;
  organizerEmail?: string | null;
  status?: string;
  route?: string | null;
  distanceKm?: number | null;
  elevationGain?: number | null;
  route_geometry?: string | null;
};

type Message = {
  id: string;
  userId: string;
  email: string;
  message: string;
  createdAt: string;
};

const SPORT_EMOJI: Record<string, string> = {
  "Course à pied": "🏃",
  "Vélo": "🚴",
  "Randonnée": "🥾",
  "Trail": "⛰️",
  "Natation": "🏊",
  "Triathlon": "🏅",
};

const NIVEAU_STYLE: Record<string, string> = {
  "Débutant":      "bg-emerald-100 text-emerald-700",
  "Intermédiaire": "bg-blue-100 text-blue-700",
  "Avancé":        "bg-orange-100 text-orange-700",
  "Expert":        "bg-red-100 text-red-700",
};

// ─── Logique inchangée ────────────────────────────────────────────────────────

export default function SortiePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();

  const [sortie, setSortie] = useState<Sortie | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingRoute, setEditingRoute] = useState(false);
  const [newRoutePoints, setNewRoutePoints] = useState<[number,number][]>([]);
  const [newStoredRoute, setNewStoredRoute] = useState<import("@/lib/elevation/elevationService").StoredRoute | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true); // ne scroll que si l'utilisateur est déjà en bas du chat

  useEffect(() => {
    fetch("/api/sorties?includePast=true")
      .then((r) => r.json())
      .then((data: Sortie[]) => {
        const found = data.find((s) => s.id === id);
        if (found) setSortie(found);
        else setNotFound(true);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    // Scroll uniquement dans le conteneur chat, et seulement si déjà en bas
    const el = chatContainerRef.current;
    if (!el || !isAtBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleChatScroll() {
    const el = chatContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  async function fetchMessages() {
    const res = await fetch(`/api/messages?sortieId=${id}`);
    if (res.ok) setMessages(await res.json());
  }

  async function rejoindre() {
    if (!user) { router.push(`/login?redirect=/sorties/${id}`); return; }
    setJoining(true);
    const res = await fetch(`/api/sorties/${id}?action=join`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userEmail: user.email }),
    });
    if (res.ok) {
      setJoinSuccess(true);
      setTimeout(() => setJoinSuccess(false), 4000);
    }
    const data: Sortie[] = await fetch("/api/sorties?includePast=true").then((r) => r.json());
    const updated = data.find((s) => s.id === id);
    if (updated) setSortie(updated);
    setJoining(false);
  }

  async function quitter() {
    if (!user || !confirm("Annuler ta participation à cette sortie ?")) return;
    setLeaving(true);
    await fetch(`/api/sorties/${id}?action=leave`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userEmail: user.email }),
    });
    const data: Sortie[] = await fetch("/api/sorties?includePast=true").then((r) => r.json());
    const updated = data.find((s) => s.id === id);
    if (updated) setSortie(updated);
    setLeaving(false);
  }

  async function cloturerSortie() {
    if (!user || !confirm("Clôturer cette sortie ? Les inscriptions seront fermées.")) return;
    setClosing(true);
    await fetch(`/api/sorties/${id}?action=close`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const data: Sortie[] = await fetch("/api/sorties?includePast=true").then((r) => r.json());
    const updated = data.find((s) => s.id === id);
    if (updated) setSortie(updated);
    setClosing(false);
  }

  async function supprimerSortie() {
    if (!user || !confirm("Supprimer définitivement cette sortie ?")) return;
    setDeleting(true);
    await fetch(`/api/sorties/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userEmail: user.email }),
    });
    router.push("/");
  }

  async function saveRoute() {
    if (!newStoredRoute && newRoutePoints.length < 2) return;
    setSavingRoute(true);
    const route = newStoredRoute ?? { v: 2 as const, geometry: newRoutePoints, distanceKm: 0, durationMin: 0 };
    await fetch(`/api/sorties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateRoute",
        userId: user?.id,
        route: JSON.stringify(route),
        route_geometry: JSON.stringify(route.geometry),
        distanceKm: route.distanceKm ?? null,
        elevationGain: route.gain ?? null,
      }),
    });
    const data: Sortie[] = await fetch("/api/sorties").then(r => r.json());
    const updated = data.find(s => s.id === id);
    if (updated) setSortie(updated);
    setSavingRoute(false);
    setEditingRoute(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push(`/login?redirect=/sorties/${id}`); return; }
    const text = msgInput.trim();
    if (!text) return;

    // Optimistic update
    setMsgInput("");
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = { id: tempId, userId: user.id, email: user.email, message: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortieId: id, userId: user.id, email: user.email, message: text }),
    });

    if (res.ok) {
      await fetchMessages();
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMsgInput(text);
    }
    setSending(false);
  }

  // ─── États de chargement ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
          <div className="h-4 shimmer rounded-full w-32" />
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="h-64 shimmer" />
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="h-16 shimmer rounded-2xl" />)}
              </div>
              <div className="h-12 shimmer rounded-2xl" />
              <div className="h-12 shimmer rounded-2xl w-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !sortie) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🏃</div>
        <p className="text-slate-600 font-semibold text-lg">Sortie introuvable</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Retour à l&apos;accueil</Link>
      </main>
    );
  }

  const ADMIN_EMAILS = ["bridey.johan@neuf.fr"];
  const isClosed = sortie.status === "closed";
  const isFull = (sortie.nbParticipants ?? 0) >= sortie.participantsMax;
  const dejaInscrit = user ? (sortie.participantIds ?? []).includes(user.id) : false;
  const isOrganizer = user?.id === sortie.organizerId;
  const isAdmin = user ? ADMIN_EMAILS.includes(user.email) : false;
  const pct = Math.min(100, ((sortie.nbParticipants ?? 0) / sortie.participantsMax) * 100);

  const marker = sortie.latitude && sortie.longitude
    ? [{ id: sortie.id, titre: sortie.titre, date: sortie.date, heure: sortie.heure, latitude: sortie.latitude, longitude: sortie.longitude, color: "#2563eb" }]
    : [];

  // Priority: route_geometry field → route JSON → null
  function parseGeometryField(raw: string | null | undefined): [number,number][] | null {
    if (!raw) return null;
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p) && p.length >= 2) return p as [number,number][];
    } catch { /* */ }
    return null;
  }

  const parsedRouteData = parseRoute(sortie.route);
  const geometryFromField = parseGeometryField(sortie.route_geometry);
  const parsedRoute = parsedRouteData?.geometry ?? geometryFromField ?? undefined;
  const routeDistance = parsedRouteData?.distanceKm ?? sortie.distanceKm ?? null;
  const routeGain = parsedRouteData?.gain ?? sortie.elevationGain ?? null;
  const routeLoss = parsedRouteData?.loss ?? null;
  const routeSlopes = parsedRouteData?.slopes;
  const difficulty = routeGain != null && routeDistance != null && routeGain > 0
    ? getDifficulty(routeGain, routeDistance)
    : null;

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Retour */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors w-fit">
          ← Retour aux sorties
        </Link>

        {/* ── Hero card ── */}
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-100 overflow-hidden">

          {/* Image header avec overlay + titre */}
          <div className="relative h-64 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
            <img
              src={resolveSortieImage(sortie.image_url ?? sortie.image, sortie.sport, sortie.lieu)}
              alt={sortie.titre}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  SPORT_IMAGE_FALLBACK[sortie.sport] ?? SPORT_IMAGE_FALLBACK["default"];
              }}
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

            {/* Badges statut haut-gauche */}
            <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
              {isOrganizer && (
                <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow">
                  👑 Ma sortie
                </span>
              )}
              {isClosed && (
                <span className="bg-slate-800/80 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                  🔒 Clôturée
                </span>
              )}
              {!isClosed && isFull && (
                <span className="bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                  Complet
                </span>
              )}
            </div>

            {/* Emoji sport haut-droit */}
            <span className="absolute top-4 right-4 text-3xl drop-shadow-lg">
              {SPORT_EMOJI[sortie.sport] ?? "🏅"}
            </span>

            {/* Titre + organisateur sur l'image */}
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
              <h1 className="text-3xl font-bold text-white leading-tight drop-shadow">
                {sortie.titre}
              </h1>
              {sortie.organizerEmail && (
                <p className="text-white/70 text-sm mt-1">
                  Organisé par <span className="text-white font-medium">{sortie.organizerEmail}</span>
                </p>
              )}
            </div>
          </div>

          {/* Contenu */}
          <div className="p-6 flex flex-col gap-6">

            {/* Infos en grille — toujours visible */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoCard icon="📅" label="Date" value={sortie.date} />
              <InfoCard icon="🕐" label="Heure" value={sortie.heure} />
              <InfoCard icon="🏅" label="Sport" value={sortie.sport} />
              <InfoCard
                icon="📊"
                label="Niveau"
                value={sortie.niveau}
                valueClass={NIVEAU_STYLE[sortie.niveau] ?? "text-slate-700"}
              />
            </div>

            {/* Stats parcours — affichées dès qu'elles sont disponibles */}
            {(routeDistance != null || routeGain != null || difficulty) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {routeDistance != null && (
                  <InfoCard icon="📏" label="Distance" value={`${routeDistance.toFixed(1)} km`} />
                )}
                {routeGain != null && routeGain > 0 && (
                  <InfoCard icon="⬆️" label="Dénivelé +" value={`${routeGain} m`} valueClass="text-emerald-700" />
                )}
                {routeLoss != null && routeLoss > 0 && (
                  <InfoCard icon="⬇️" label="Dénivelé −" value={`${routeLoss} m`} valueClass="text-red-600" />
                )}
                {difficulty && (
                  <div className={`rounded-2xl px-4 py-3 flex flex-col gap-1 border ${difficulty.bg}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🎯</span>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Difficulté</p>
                    </div>
                    <p className={`text-sm font-bold ${difficulty.color}`}>{difficulty.label}</p>
                  </div>
                )}
              </div>
            )}

            {/* Lieu pleine largeur */}
            <div className="flex items-start gap-3 bg-slate-50 rounded-2xl px-4 py-3">
              <span className="text-xl mt-0.5">📍</span>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Lieu</p>
                <p className="text-slate-800 font-medium mt-0.5">{sortie.lieu}</p>
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Participants</p>
                <span className={`text-sm font-semibold ${isFull ? "text-red-500" : "text-slate-600"}`}>
                  {sortie.nbParticipants ?? 0} / {sortie.participantsMax}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isClosed || isFull ? "bg-red-400" : pct > 70 ? "bg-orange-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Avatars participants */}
              {(sortie.participantEmails ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {sortie.participantEmails!.map((email) => (
                    <div key={email} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 transition-colors rounded-full pl-1 pr-3 py-1">
                      <img
                        src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(email)}`}
                        alt=""
                        className="w-6 h-6 rounded-full bg-white flex-shrink-0"
                      />
                      <span className="text-xs text-slate-600 font-medium">{email}</span>
                      {user?.email === email && <span className="text-[10px] text-blue-500 font-bold ml-0.5">Moi</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Carte + stats parcours ── */}
            <div className="rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-100">
              <Map
                markers={marker}
                center={
                  sortie.longitude && sortie.latitude
                    ? [sortie.longitude, sortie.latitude]
                    : parsedRoute && parsedRoute.length > 0
                    ? parsedRoute[0]
                    : [-0.5792, 44.8378]
                }
                zoom={sortie.latitude || parsedRoute ? 13 : 10}
                height="300px"
                route={parsedRoute}
                slopes={routeSlopes}
              />

              {/* Stats dénivelé */}
              {parsedRoute && parsedRoute.length >= 2 && (
                <div className="px-4 py-3 bg-white border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-3">
                    {routeDistance != null && (
                      <StatBadge icon="📏" label="Distance" value={`${routeDistance.toFixed(2)} km`} />
                    )}
                    {routeGain != null && routeGain > 0 && (
                      <StatBadge icon="⬆️" label="D+" value={`${routeGain} m`} color="text-emerald-700" />
                    )}
                    {routeLoss != null && routeLoss > 0 && (
                      <StatBadge icon="⬇️" label="D−" value={`${routeLoss} m`} color="text-red-600" />
                    )}
                    {difficulty && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${difficulty.bg} ${difficulty.color}`}>
                        {difficulty.label}
                      </span>
                    )}
                    {/* Légende pentes */}
                    {routeSlopes && routeSlopes.length > 0 && (
                      <div className="ml-auto flex items-center gap-2.5 flex-wrap">
                        {[
                          { color: "#10b981", label: "0–3 %" },
                          { color: "#eab308", label: "3–6 %" },
                          { color: "#f97316", label: "6–10 %" },
                          { color: "#ef4444", label: ">10 %" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-1">
                            <span className="w-3 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[10px] text-slate-500 font-medium">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!sortie.latitude && !parsedRoute && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs text-slate-400 text-center">Aucune position ni tracé enregistré pour cette sortie</p>
                </div>
              )}
            </div>

            {/* Toast succès inscription */}
            {joinSuccess && (
              <div className="fade-in flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700 font-medium">
                <span className="text-base">🎉</span>
                <span>Tu es inscrit ! Tu peux maintenant discuter avec les autres participants ci-dessous.</span>
              </div>
            )}

            {/* Bouton rejoindre / annuler */}
            {!isOrganizer && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={rejoindre}
                  disabled={joining || isFull || isClosed || dejaInscrit}
                  className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all duration-200 ease-in-out active:scale-[0.98] ${
                    dejaInscrit
                      ? "bg-emerald-100 text-emerald-600 cursor-default"
                      : isClosed
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : isFull
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-sm shadow-emerald-200 hover:shadow-md disabled:opacity-60"
                  }`}
                >
                  {joining
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Inscription…</span>
                    : dejaInscrit ? "✅ Tu participes à cette sortie"
                    : isClosed ? "🔒 Sortie clôturée"
                    : isFull ? "Complet"
                    : "Rejoindre cette sortie"}
                </button>
                {dejaInscrit && (
                  <button
                    onClick={quitter}
                    disabled={leaving}
                    className="w-full py-2 rounded-2xl text-sm font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all duration-200"
                  >
                    {leaving
                      ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />Annulation…</span>
                      : "Annuler ma participation"}
                  </button>
                )}
              </div>
            )}

            {/* Modifier le tracé (organisateur) */}
            {isOrganizer && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setEditingRoute(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>🗺️ {editingRoute ? "Annuler la modification du tracé" : "Modifier / ajouter le tracé"}</span>
                  <span className="text-slate-400">{editingRoute ? "✕" : "+"}</span>
                </button>
                {editingRoute && (
                  <div className="border-t border-slate-100">
                    <RoutePickerMap
                      onLocationChange={() => {}}
                      onRouteChange={(pts, sr) => { setNewRoutePoints(pts); setNewStoredRoute(sr ?? null); }}
                      height="320px"
                    />
                    <div className="p-3 flex gap-2">
                      <button
                        onClick={saveRoute}
                        disabled={savingRoute || (newRoutePoints.length < 2 && !newStoredRoute)}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
                      >
                        {savingRoute ? "Enregistrement…" : "💾 Enregistrer le tracé"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions organisateur / admin */}
            {(isOrganizer || isAdmin) && (
              <div className="flex gap-3">
                {isOrganizer && !isClosed && (
                  <button
                    onClick={cloturerSortie}
                    disabled={closing}
                    className="flex-1 py-3 rounded-2xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 active:scale-[0.98] font-semibold transition-all duration-200 ease-in-out disabled:opacity-50"
                  >
                    {closing ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />Clôture…</span> : "🔒 Clôturer"}
                  </button>
                )}
                <button
                  onClick={supprimerSortie}
                  disabled={deleting}
                  className={`flex-1 py-3 rounded-2xl border font-semibold transition-all duration-200 ease-in-out active:scale-[0.98] disabled:opacity-50 ${
                    isAdmin && !isOrganizer
                      ? "border-red-300 bg-red-100 text-red-800 hover:bg-red-200"
                      : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  }`}
                >
                  {deleting
                    ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />Suppression…</span>
                    : isAdmin && !isOrganizer ? "🛡️ Supprimer (admin)" : "🗑 Supprimer"}
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── Zone chat ── */}
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-100 overflow-hidden">

          {/* Header chat */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Discussion</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-base">💬</div>
          </div>

          {/* Messages */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="px-5 py-5 flex flex-col gap-4 min-h-[220px] max-h-[440px] overflow-y-auto"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                <span className="text-3xl">💬</span>
                <p className="text-slate-400 text-sm">Aucun message pour l&apos;instant.</p>
                <p className="text-slate-300 text-xs">Sois le premier à écrire !</p>
              </div>
            )}

            {messages.map((m) => {
              const isMe = user?.id === m.userId;
              const time = m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                : "";
              const initiale = m.email[0]?.toUpperCase() ?? "?";

              return (
                <div key={m.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>

                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1 ${
                    isMe ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-slate-400 to-slate-500"
                  }`}>
                    {initiale}
                  </div>

                  {/* Bulle */}
                  <div className={`flex flex-col gap-1 max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-slate-400 px-1">
                      {isMe ? "Vous" : m.email} · {time}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-slate-100 text-slate-800 rounded-tl-sm"
                    }`}>
                      {m.message}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-slate-100">
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                placeholder={user ? "Écris un message…" : "Connecte-toi pour écrire"}
                disabled={!user || sending}
                maxLength={500}
                className="flex-1 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 placeholder:text-slate-400 disabled:opacity-50 transition-all"
              />
              <button
                type="submit"
                disabled={!user || sending || !msgInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.95] disabled:opacity-40 transition-all duration-200 ease-in-out text-white px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-sm"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : "↑"}
              </button>
            </form>

            {!user && (
              <p className="text-center text-xs text-slate-400 mt-3">
                <Link href={`/login?redirect=/sorties/${id}`} className="text-blue-600 hover:underline font-medium">
                  Se connecter
                </Link>{" "}
                pour participer à la discussion
              </p>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function StatBadge({
  icon, label, value, color = "text-slate-700",
}: {
  icon: string; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-3 py-1.5">
      <span className="text-sm">{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
        <span className={`text-sm font-bold ${color}`}>{value}</span>
      </div>
    </div>
  );
}

function InfoCard({
  icon, label, value, valueClass = "text-slate-800",
}: {
  icon: string; label: string; value?: string | number | null; valueClass?: string;
}) {
  return (
    <div className="bg-slate-50 rounded-2xl px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm font-bold ${valueClass}`}>{value ?? "—"}</p>
    </div>
  );
}
