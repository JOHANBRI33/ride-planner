"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

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
  latitude?: number | null;
  longitude?: number | null;
  participantIds?: string[];
  organizerId?: string | null;
  status?: string;
};

type Bounds = { minLng: number; maxLng: number; minLat: number; maxLat: number } | null;

const SPORT_EMOJI: Record<string, string> = {
  "Course à pied": "🏃",
  "Vélo": "🚴",
  "Randonnée": "🥾",
  "Trail": "⛰️",
  "Natation": "🏊",
  "Triathlon": "🏅",
};

const SPORT_IMAGE: Record<string, string> = {
  "Course à pied": "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=80",
  "Vélo":          "https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&q=80",
  "Randonnée":     "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
  "Trail":         "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80",
  "Natation":      "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80",
  "Triathlon":     "https://images.unsplash.com/photo-1560073743-0107c7b2e5b4?w=800&q=80",
  "default":       "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
};

const SPORT_COLOR: Record<string, string> = {
  "Course à pied": "#ef4444",
  "Vélo": "#f97316",
  "Randonnée": "#22c55e",
  "Trail": "#8b5cf6",
  "Natation": "#06b6d4",
  "Triathlon": "#f59e0b",
};

const NIVEAU_STYLE: Record<string, string> = {
  "Débutant":      "bg-emerald-100 text-emerald-700",
  "Intermédiaire": "bg-blue-100 text-blue-700",
  "Avancé":        "bg-orange-100 text-orange-700",
  "Expert":        "bg-red-100 text-red-700",
};

const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé", "Expert"];

const ACTIVITY_TOASTS = [
  "🔥 2 personnes viennent de rejoindre une sortie",
  "👟 Nouvelle sortie ajoutée il y a 3 min",
  "💬 3 nouveaux messages sur une sortie",
  "🚴 Un cycliste cherche des partenaires près de toi",
  "⚡ Une sortie trail affiche presque complet",
  "👥 5 sportifs connectés en ce moment",
  "🏊 Nouvelle sortie natation disponible",
];

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const steps = 40;
    const increment = target / steps;
    const delay = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, delay);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

const SLOGANS = [
  "Ça roule aujourd'hui ?",
  "Un run ce soir ?",
  "Qui est chaud pour bouger ?",
  "Trouve ton crew sportif",
  "On sort ou quoi ?",
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="h-48 shimmer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 shimmer rounded-full w-3/4" />
        <div className="h-3 shimmer rounded-full w-1/2" />
        <div className="flex gap-2 mt-1">
          <div className="h-6 shimmer rounded-full w-20" />
          <div className="h-6 shimmer rounded-full w-16" />
        </div>
        <div className="flex gap-2 mt-1">
          <div className="h-9 shimmer rounded-xl flex-1" />
          <div className="h-9 shimmer rounded-xl w-16" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [loading, setLoading] = useState(true);
  const [bounds, setBounds] = useState<Bounds>(null);
  const [filterSport, setFilterSport] = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [joinToast, setJoinToast] = useState("");
  const [activityToast, setActivityToast] = useState("");
  const [activityVisible, setActivityVisible] = useState(false);
  const { user } = useUser();
  const router = useRouter();

  const [slogan, setSlogan] = useState(SLOGANS[0]);
  useEffect(() => {
    setSlogan(SLOGANS[Math.floor(Math.random() * SLOGANS.length)]);
    if (!localStorage.getItem("userPreferences")) {
      router.push("/onboarding");
    }
  }, []);

  useEffect(() => {
    fetch("/api/sorties")
      .then((res) => res.json())
      .then((data) => { setSorties(data); setLoading(false); });
  }, []);

  // Activity toasts
  useEffect(() => {
    function showNext() {
      const msg = ACTIVITY_TOASTS[Math.floor(Math.random() * ACTIVITY_TOASTS.length)];
      setActivityToast(msg);
      setActivityVisible(true);
      setTimeout(() => setActivityVisible(false), 4000);
    }
    const delay = setTimeout(showNext, 3000);
    const interval = setInterval(showNext, 7000);
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, []);

  const sportsDispos = Array.from(new Set(sorties.map((s) => s.sport).filter(Boolean)));

  const filtered = sorties.filter((s) => {
    if (filterSport && s.sport !== filterSport) return false;
    if (filterNiveau && s.niveau !== filterNiveau) return false;
    if (filterDate && s.date !== filterDate) return false;
    if (bounds && s.latitude && s.longitude) {
      if (s.longitude < bounds.minLng || s.longitude > bounds.maxLng ||
          s.latitude < bounds.minLat || s.latitude > bounds.maxLat) return false;
    }
    return true;
  });

  const markers = filtered
    .filter((s) => s.latitude && s.longitude)
    .map((s) => ({
      id: s.id, titre: s.titre, date: s.date, heure: s.heure,
      latitude: s.latitude!, longitude: s.longitude!,
      color: SPORT_COLOR[s.sport] ?? "#3b82f6",
    }));

  const totalParticipants = sorties.reduce((acc, s) => acc + (s.nbParticipants ?? 0), 0);
  const totalSports = Array.from(new Set(sorties.map((s) => s.sport).filter(Boolean))).length;
  const countSorties = useCountUp(loading ? 0 : sorties.length);
  const countParticipants = useCountUp(loading ? 0 : totalParticipants);
  const countSports = useCountUp(loading ? 0 : totalSports);

  const hasFilters = filterSport || filterNiveau || filterDate;

  function resetFilters() {
    setFilterSport(""); setFilterNiveau(""); setFilterDate(""); setBounds(null);
  }

  async function rejoindre(id: string) {
    if (!user) { router.push("/login?redirect=/"); return; }
    setJoining(id);
    await fetch(`/api/sorties/${id}?action=join`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userEmail: user.email }),
    });
    const data = await fetch("/api/sorties").then((r) => r.json());
    setSorties(data);
    setJoining(null);
    setJoined(id);
    setJoinToast("Tu as rejoint la sortie 🎉");
    setTimeout(() => setJoined(null), 2000);
    setTimeout(() => setJoinToast(""), 3500);
  }

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-slate-100">
        {/* Background image très légère */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1600&q=60"
            alt=""
            aria-hidden
            className="w-full h-full object-cover object-center opacity-[0.08]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-white" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-24 text-center flex flex-col items-center gap-6 sm:gap-8">

          {/* Badge */}
          <span className="fade-in inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold px-4 py-1.5 rounded-full border border-blue-100 shadow-sm">
            🏅 Sorties sportives près de chez toi
          </span>

          {/* Titre */}
          <div className="fade-in flex flex-col gap-3">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {slogan}
            </h1>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-lg mx-auto mt-2">
              Rejoins une sortie ou crée la tienne en quelques secondes.
            </p>
          </div>

          {/* Boutons */}
          <div className="fade-in flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:justify-center">
            <Link href="/create" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto min-h-[48px] bg-blue-600 hover:bg-blue-700 hover:scale-[1.04] active:scale-[0.98] text-white font-semibold px-7 py-3.5 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg text-sm">
                + Créer une sortie
              </button>
            </Link>
            <button
              onClick={() => document.getElementById("sorties-grid")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto min-h-[48px] bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 hover:scale-[1.04] active:scale-[0.98] text-slate-700 font-semibold px-7 py-3.5 rounded-2xl transition-all duration-200 shadow-sm text-sm"
            >
              Explorer les sorties ↓
            </button>
          </div>

          {/* Stats */}
          {!loading && (
            <div className="fade-in flex gap-3 flex-wrap justify-center pt-2 w-full sm:w-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center gap-3 min-w-[130px]">
                <span className="text-2xl">🔥</span>
                <div className="text-left">
                  <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{countSorties}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">sorties actives</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center gap-3 min-w-[130px]">
                <span className="text-2xl">👥</span>
                <div className="text-left">
                  <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{countParticipants}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">participants</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center gap-3 min-w-[130px]">
                <span className="text-2xl">🏃</span>
                <div className="text-left">
                  <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{countSports}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">sports</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Filtres sticky ── */}
      <div className="sticky top-16 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-2 items-center">
          <select value={filterSport} onChange={(e) => setFilterSport(e.target.value)} className={filterCls}>
            <option value="">Tous les sports</option>
            {sportsDispos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterNiveau} onChange={(e) => setFilterNiveau(e.target.value)} className={filterCls}>
            <option value="">Tous niveaux</option>
            {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={filterCls} />
          {(hasFilters || bounds) && (
            <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all">
              ✕ Réinitialiser
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {loading ? "…" : `${filtered.length} sortie${filtered.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* ── Section marketing ── */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Pourquoi RidePlanner ?
            </h2>
            <p className="text-slate-400 mt-2 text-sm">Tout ce qu&apos;il te faut pour sortir, sans prise de tête.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { emoji: "🧭", titre: "Trouve des sorties près de toi",     desc: "Grâce à la carte interactive, repère les sorties autour de toi en un coup d'œil." },
              { emoji: "🤝", titre: "Rencontre des partenaires sportifs", desc: "Rejoins ou crée une sortie en 1 clic et connecte-toi avec ta communauté." },
              { emoji: "🗺️", titre: "Visualise les parcours",             desc: "Trace et découvre les itinéraires directement sur la carte avant de partir." },
            ].map((item) => (
              <div key={item.titre} className="group flex flex-col items-start gap-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-2xl p-6 transition-all duration-200 hover:shadow-md">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-200">
                  {item.emoji}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{item.titre}</h3>
                  <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bandeau personnalisation ── */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-indigo-700 font-medium">
            ✨ Personnalise tes sorties en 10 secondes
          </p>
          <Link href="/onboarding">
            <button className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white px-4 py-1.5 rounded-full transition-all duration-200 shadow-sm flex-shrink-0">
              Adapter →
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Carte Mapbox */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-200">
          <div className="hidden sm:block">
            <Map markers={markers} height="380px" onBoundsChange={setBounds} />
          </div>
          <div className="sm:hidden">
            <Map markers={markers} height="220px" onBoundsChange={setBounds} />
          </div>
        </div>

        {/* Skeletons */}
        {loading && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-24 flex flex-col items-center gap-5">
            <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center text-5xl shadow-sm">
              😴
            </div>
            <div>
              <p className="text-slate-800 font-bold text-2xl">
                {hasFilters || bounds ? "Aucune sortie trouvée" : "Aucune sortie pour l'instant"}
              </p>
              <p className="text-slate-400 text-base mt-2 max-w-xs mx-auto">
                {hasFilters || bounds
                  ? "Essaie d'élargir tes filtres ou de zoomer sur la carte."
                  : "Crée la première sortie et rassemble ton crew !"}
              </p>
            </div>
            {hasFilters || bounds
              ? <button onClick={resetFilters} className={btnGhost}>Effacer les filtres</button>
              : (
                <Link href="/create">
                  <button className={btnPrimary}>🚀 Créer la première sortie</button>
                </Link>
              )
            }
          </div>
        )}

        {/* ── Grille de cartes ── */}
        {!loading && filtered.length > 0 && (
          <div id="sorties-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            {filtered.map((s, idx) => {
              const isFull = (s.nbParticipants ?? 0) >= s.participantsMax;
              const isClosed = s.status === "closed";
              const isOrganizer = user?.id === s.organizerId;
              const dejaInscrit = user ? (s.participantIds ?? []).includes(user.id) : false;
              const pct = Math.min(100, ((s.nbParticipants ?? 0) / s.participantsMax) * 100);
              const isRecommended = idx < 2 && !isOrganizer && !dejaInscrit && !isClosed && !isFull;
              const places = s.participantsMax - (s.nbParticipants ?? 0);
              const isPopular = pct >= 50 && pct < 80 && !isFull;
              const isAlmostFull = pct >= 80 && !isFull && !isClosed;
              const isNew = s.id === filtered[filtered.length - 1]?.id;

              return (
                <div
                  key={s.id}
                  className="group bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-200 ease-in-out cursor-default"
                >
                  {/* ── Zone image ── */}
                  <div className="relative h-36 sm:h-48 bg-slate-900 overflow-hidden">
                    <img
                      src={s.image ?? (SPORT_IMAGE[s.sport] ?? SPORT_IMAGE["default"])}
                      alt={s.titre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out opacity-90 group-hover:opacity-100"
                    />

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    {/* Titre sur l'image */}
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                      <h2 className="text-white font-bold text-lg leading-snug drop-shadow line-clamp-2">
                        {s.titre}
                      </h2>
                    </div>

                    {/* Badges statut haut-gauche */}
                    <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                      {isRecommended && (
                        <span className="fade-in bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          ⭐ Recommandé
                        </span>
                      )}
                      {isNew && !isOrganizer && (
                        <span className="fade-in bg-blue-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          🆕 Nouveau
                        </span>
                      )}
                      {isAlmostFull && (
                        <span className="fade-in bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          ⚡ Dernières places
                        </span>
                      )}
                      {isPopular && (
                        <span className="fade-in bg-rose-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          🔥 Populaire
                        </span>
                      )}
                      {isOrganizer && (
                        <span className="fade-in bg-yellow-400 text-yellow-900 text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          👑 Ma sortie
                        </span>
                      )}
                      {isClosed && (
                        <span className="fade-in bg-slate-700 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                          🔒 Clôturée
                        </span>
                      )}
                      {!isClosed && isFull && (
                        <span className="fade-in bg-red-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                          Complet
                        </span>
                      )}
                    </div>

                    {/* Emoji sport haut-droit */}
                    <span className="absolute top-3 right-3 text-xl drop-shadow">
                      {SPORT_EMOJI[s.sport] ?? "🏅"}
                    </span>
                  </div>

                  {/* ── Contenu ── */}
                  <div className="p-5 flex flex-col gap-3.5">

                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span>📍</span>
                        <span className="truncate">{s.lieu}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-slate-400">
                        <span>📅</span>
                        <span>{s.date} · {s.heure}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {s.niveau && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${NIVEAU_STYLE[s.niveau] ?? "bg-slate-100 text-slate-600"}`}>
                          {s.niveau}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isFull ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                      }`}>
                        👥 {s.nbParticipants ?? 0}/{s.participantsMax}
                      </span>
                    </div>

                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isClosed || isFull ? "bg-red-400" : pct > 70 ? "bg-orange-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex gap-2">
                      {!isOrganizer && (
                        <button
                          onClick={() => !dejaInscrit && !joining && rejoindre(s.id)}
                          disabled={!!joining || isFull || isClosed || dejaInscrit}
                          className={`flex-1 min-h-[44px] py-3 rounded-xl text-sm font-bold transition-all duration-200 ease-in-out active:scale-[0.97] ${
                            dejaInscrit || joined === s.id
                              ? "bg-emerald-100 text-emerald-600 cursor-default"
                              : isClosed || isFull
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] disabled:opacity-50"
                          }`}
                        >
                          {joining === s.id
                            ? <span className="flex items-center justify-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Inscription…</span>
                            : joined === s.id ? "✓ Inscrit !"
                            : dejaInscrit ? "✓ Inscrit"
                            : isClosed ? "🔒 Clôturée"
                            : isFull ? "Complet"
                            : "Rejoindre →"}
                        </button>
                      )}

                      <Link href={`/sorties/${s.id}`} className={isOrganizer ? "flex-1" : ""}>
                        <button className={`w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97] transition-all duration-200 ease-in-out ${
                          isOrganizer ? "" : "px-4"
                        }`}>
                          {isOrganizer ? "⚙️ Gérer" : "Voir"}
                        </button>
                      </Link>
                    </div>

                    {/* Micro urgence */}
                    {!isOrganizer && !dejaInscrit && !isClosed && !isFull && places <= 3 && places > 0 && (
                      <p className="text-xs text-orange-500 font-semibold text-center">
                        ⏳ Plus que {places} place{places > 1 ? "s" : ""} disponible{places > 1 ? "s" : ""}
                      </p>
                    )}
                    {!isOrganizer && !dejaInscrit && !isClosed && isAlmostFull && places > 3 && (
                      <p className="text-xs text-orange-400 font-medium text-center">⚡ Presque complet</p>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* ── Toast activité (bas-gauche) ── */}
      <div className={`fixed bottom-6 left-6 z-40 max-w-xs transition-all duration-500 ${
        activityVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg px-4 py-3 text-sm text-slate-700 font-medium flex items-center gap-2">
          {activityToast}
        </div>
      </div>

      {/* ── Toast join success (bas-centre) ── */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ${
        joinToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}>
        <div className="bg-emerald-600 text-white rounded-2xl shadow-lg px-6 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap">
          ✅ {joinToast}
        </div>
      </div>

    </main>
  );
}

const filterCls = "border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 transition-colors";
const btnPrimary = "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold px-6 py-3 rounded-2xl transition-all duration-200 shadow-sm";
const btnGhost = "border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-600 text-sm font-semibold px-6 py-3 rounded-2xl transition-all duration-200";
