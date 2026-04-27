"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useMemo } from "react";
import _dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { resolveSortieImage, SPORT_IMAGE_FALLBACK, getRouteStaticImageUrl } from "@/lib/getAutoImage";
import { parseRoute } from "@/lib/mapbox/parseRoute";

const ExploreMap = _dynamic(() => import("@/components/ExploreMap"), { ssr: false });
const WeatherWidget = _dynamic(() => import("@/components/WeatherWidget"), { ssr: false });
const WeatherCompactDynamic = _dynamic(() => import("@/components/WeatherWidget").then(m => ({ default: m.WeatherCompact })), { ssr: false });
const CommunauteBoard = _dynamic(() => import("@/components/CommunauteBoard"), { ssr: false });

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
  organizerId?: string | null;
  status?: string;
  route?: string | null;
  distanceKm?: number | null;
  elevationGain?: number | null;
  avgRating?: number | null;
  nbRatings?: number | null;
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

// Static fallbacks re-exported from lib for hero image use
const SPORT_IMAGE = SPORT_IMAGE_FALLBACK;

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

// ─── Helpers personnalisation ──────────────────────────────────────────────────

const SPORT_KEY_TO_SORTIE: Record<string, string[]> = {
  cycling:  ["Vélo"],
  running:  ["Course à pied"],
  hiking:   ["Randonnée", "Trail"],
  swimming: ["Natation"],
  other:    [],
};

const LEVEL_TO_NIVEAU: Record<string, string> = {
  beginner:     "Débutant",
  intermediate: "Intermédiaire",
  advanced:     "Avancé",
  expert:       "Expert",
};

const RYTHME_LABEL: Record<string, string> = {
  occasional: "Occasionnel", weekly: "1×/semaine",
  regular: "2–3×/semaine",  daily: "Quotidien",
};

const GOAL_LABEL: Record<string, string> = {
  performance: "Performance", social: "Social", fun: "Plaisir", health: "Forme",
};

type ProfilePrefs = {
  sports:   string[];   // noms de sport ("Vélo"…)
  niveau:   string;     // "Débutant" | "Intermédiaire" | "Avancé" | "Expert"
  goal?:    string;
  rythme?:  string;
};

function parseProfilePrefs(profile: Record<string, string | undefined> | null): ProfilePrefs | null {
  if (!profile || profile.onboardingDone !== "true") return null;

  const rawSports = (profile.sports ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const sports = rawSports.flatMap((k) => SPORT_KEY_TO_SORTIE[k] ?? []);

  // Niveau : champ direct (nouveau onboarding) ou legacy sport-specific
  const niveau = profile.niveau
    || LEVEL_TO_NIVEAU[profile.cycling_level ?? ""]
    || LEVEL_TO_NIVEAU[profile.swimming_level ?? ""]
    || "";

  return sports.length > 0 ? { sports, niveau, goal: profile.goal, rythme: profile.rythme } : null;
}

// ─── Moteur de score ───────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeScore(
  s: Sortie,
  prefs: ProfilePrefs,
  userLat: number | null,
  userLng: number | null,
): number {
  let score = 0;
  if (prefs.sports.includes(s.sport))   score += 3;  // match sport
  if (prefs.niveau && s.niveau === prefs.niveau) score += 2;  // match niveau exact
  else if (s.niveau === "Débutant")      score += 1;  // toujours accessible
  if (userLat && userLng && s.latitude && s.longitude) {
    if (haversineKm(userLat, userLng, s.latitude, s.longitude) <= 20) score += 1; // proximité
  }
  if (s.date) {
    const days = (new Date(s.date).getTime() - Date.now()) / 86400000;
    if (days >= 0 && days <= 7) score += 1; // date proche
  }
  return score;
}

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

function SkeletonCard({ horizontal }: { horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div className="flex gap-3 bg-white rounded-2xl border border-slate-100 p-3">
        <div className="w-24 h-24 shimmer rounded-xl flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2 py-1">
          <div className="h-3 shimmer rounded-full w-2/3" />
          <div className="h-3 shimmer rounded-full w-1/2" />
          <div className="h-3 shimmer rounded-full w-1/3" />
          <div className="flex gap-2 mt-auto">
            <div className="h-7 shimmer rounded-xl flex-1" />
            <div className="h-7 shimmer rounded-xl w-16" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="h-48 shimmer" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 shimmer rounded-full w-3/4" />
        <div className="h-3 shimmer rounded-full w-1/2" />
      </div>
    </div>
  );
}

export default function Home() {
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [loading, setLoading] = useState(true);
  const [bounds, setBounds] = useState<Bounds>(null); // kept for filter compat
  const [filterSport, setFilterSport] = useState("");
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [joinToast, setJoinToast] = useState("");
  const [activityToast, setActivityToast] = useState("");
  const [activityVisible, setActivityVisible] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [communauteAutoOpen, setCommunauteAutoOpen] = useState<"cherche" | "propose" | null>(null);
  const communauteSectionRef = useRef<HTMLDivElement>(null);
  const [hoveredSortie, setHoveredSortie] = useState<string | null>(null);
  const [activeSortie,  setActiveSortie]  = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [filterRadius, setFilterRadius] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const { user, profile } = useUser();
  const router = useRouter();
  const [profilToast, setProfilToast] = useState(false);

  const [slogan, setSlogan] = useState(SLOGANS[0]);
  useEffect(() => {
    setSlogan(SLOGANS[Math.floor(Math.random() * SLOGANS.length)]);
  }, []);

  // Toast "Profil configuré" si retour d'onboarding
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("profil") === "configured") {
      setProfilToast(true);
      // Nettoie l'URL sans rechargement
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setProfilToast(false), 5000);
    }
  }, []);

  // Redirige vers onboarding seulement si pas encore fait
  function requireProfile(next: () => void) {
    // Onboarding déjà complété (Airtable)
    if (profile?.onboardingDone === "true") { next(); return; }
    // Onboarding complété ou skippé (localStorage fallback)
    const prefs = localStorage.getItem("userPreferences");
    if (prefs) { next(); return; }
    router.push("/onboarding");
  }

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
    if (filterRadius && userLat && userLng && s.latitude && s.longitude) {
      if (haversineKm(userLat, userLng, s.latitude, s.longitude) > filterRadius) return false;
    }
    return true;
  });

  const markers = filtered
    .filter((s) => s.latitude && s.longitude)
    .map((s) => {
      const parsedForMap = parseRoute(s.route);
      const geomForMap   = parsedForMap?.geometry ?? null;
      const cardImageUrl = geomForMap && geomForMap.length >= 2
        ? getRouteStaticImageUrl(geomForMap, 460, 240)
        : resolveSortieImage(s.image_url ?? s.image, s.sport, s.lieu);
      return {
        id: s.id, titre: s.titre, lieu: s.lieu, date: s.date, heure: s.heure,
        sport: s.sport, niveau: s.niveau,
        latitude: s.latitude!, longitude: s.longitude!,
        distanceKm:    s.distanceKm    ?? null,
        elevationGain: s.elevationGain ?? null,
        nbParticipants: s.nbParticipants, participantsMax: s.participantsMax,
        status: s.status,
        cardImageUrl,
      };
    });

  const totalParticipants = sorties.reduce((acc, s) => acc + (s.nbParticipants ?? 0), 0);
  const totalSports = Array.from(new Set(sorties.map((s) => s.sport).filter(Boolean))).length;
  const countSorties = useCountUp(loading ? 0 : sorties.length);
  const countParticipants = useCountUp(loading ? 0 : totalParticipants);
  const countSports = useCountUp(loading ? 0 : totalSports);

  // ── Sorties personnalisées avec score ─────────────────────────────────────
  const profilePrefs = useMemo(
    () => parseProfilePrefs(profile as Record<string, string | undefined> | null),
    [profile],
  );

  const personalizedSorties = useMemo(() => {
    if (!profilePrefs || sorties.length === 0) return [];
    return sorties
      .map((s) => ({ ...s, _score: computeScore(s, profilePrefs, userLat, userLng) }))
      .filter((s) => s._score >= 3)
      .sort((a, b) => b._score - a._score)
      .slice(0, 4);
  }, [profilePrefs, sorties, userLat, userLng]);

  const hasFilters = filterSport || filterNiveau || filterDate || filterRadius;

  function resetFilters() {
    setFilterSport(""); setFilterNiveau(""); setFilterDate(""); setBounds(null);
    setFilterRadius(null); setUserLat(null); setUserLng(null);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setFilterRadius((r) => r ?? 20); setLocating(false); },
      () => setLocating(false)
    );
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

      {/* ── Toast profil configuré ── */}
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
        profilToast ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
      }`}>
        <div className="flex items-center gap-3 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-lg">🎯</span>
          Profil configuré — on te propose des sorties adaptées !
        </div>
      </div>

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

          {/* Météo compacte inline */}
          <WeatherCompactDynamic />

          {/* Titre */}
          <div className="fade-in flex flex-col gap-3">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {slogan}
            </h1>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-lg mx-auto mt-2">
              Trouve des partenaires près de chez toi ou crée ta sortie en 30 secondes.
            </p>
          </div>

          {/* Boutons */}
          <div className="fade-in flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:justify-center">
            <button
              onClick={() => requireProfile(() => setShowCreateModal(true))}
              className="w-full sm:w-auto min-h-[48px] bg-blue-600 hover:bg-blue-700 hover:scale-[1.04] active:scale-[0.98] text-white font-semibold px-7 py-3.5 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg text-sm"
            >
              + Créer une sortie
            </button>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-2 items-center">
          <select value={filterSport} onChange={(e) => setFilterSport(e.target.value)} className={filterCls}>
            <option value="">Tous les sports</option>
            {sportsDispos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterNiveau} onChange={(e) => setFilterNiveau(e.target.value)} className={filterCls}>
            <option value="">Tous niveaux</option>
            {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={filterCls} />
          {/* Distance filter */}
          {userLat && userLng ? (
            <select value={filterRadius ?? ""} onChange={(e) => setFilterRadius(e.target.value ? Number(e.target.value) : null)} className={filterCls}>
              <option value="5">📍 5 km</option>
              <option value="10">📍 10 km</option>
              <option value="20">📍 20 km</option>
              <option value="50">📍 50 km</option>
            </select>
          ) : (
            <button onClick={locateMe} disabled={locating} className={`${filterCls} flex items-center gap-1.5 cursor-pointer disabled:opacity-60`}>
              {locating ? "⏳" : "📍"} {locating ? "Localisation…" : "Près de moi"}
            </button>
          )}
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

      {/* ── Bandeau personnalisation ── */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-indigo-700 font-medium">
            {profilePrefs
              ? `🎯 Sorties filtrées selon ton profil · ${profilePrefs.sports.join(", ")}`
              : "✨ Personnalise tes sorties selon ton sport et ton niveau"}
          </p>
          <Link href="/onboarding">
            <button className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white px-4 py-1.5 rounded-full transition-all duration-200 shadow-sm flex-shrink-0 whitespace-nowrap">
              🎯 Personnaliser mes sorties
            </button>
          </Link>
        </div>
      </div>

      {/* ── Toggle mobile Liste / Carte ── */}
      <div className="lg:hidden sticky top-16 z-20 bg-white border-b border-slate-100 py-2">
      <div className="max-w-7xl mx-auto px-4 flex gap-2">
        <button
          onClick={() => setMobileView("list")}
          className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-all ${mobileView === "list" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          ☰ Liste ({filtered.length})
        </button>
        <button
          onClick={() => setMobileView("map")}
          className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-all ${mobileView === "map" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          🗺️ Carte
        </button>
      </div>
      </div>

      {/* ── Split layout : liste + carte ── */}
      <div id="sorties-grid" className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6 items-start">

        {/* ── LEFT : liste ── */}
        <div className={`w-full ${mobileView === "map" ? "hidden lg:block" : ""}`}>
          <div>

            {/* ── Bloc profil sportif ── */}
            {profilePrefs && !hasFilters && (
              <div className="mb-4 flex items-center gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3 shadow-sm">
                <span className="text-2xl flex-shrink-0">👤</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 mb-1">Ton profil sportif</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profilePrefs.sports.map((sp) => (
                      <span key={sp} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: (SPORT_COLOR[sp] ?? "#64748b") + "18", color: SPORT_COLOR[sp] ?? "#64748b" }}>
                        {SPORT_EMOJI[sp] ?? "🏅"} {sp}
                      </span>
                    ))}
                    {profilePrefs.niveau && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        📊 {profilePrefs.niveau}
                      </span>
                    )}
                    {profilePrefs.rythme && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        📅 {RYTHME_LABEL[profilePrefs.rythme] ?? profilePrefs.rythme}
                      </span>
                    )}
                    {profilePrefs.goal && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        🎯 {GOAL_LABEL[profilePrefs.goal] ?? profilePrefs.goal}
                      </span>
                    )}
                  </div>
                </div>
                <Link href="/onboarding" className="flex-shrink-0">
                  <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap">
                    Modifier →
                  </span>
                </Link>
              </div>
            )}

            {/* ── Recommandé pour toi ── */}
            {!loading && profilePrefs && personalizedSorties.length > 0 && !hasFilters && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">🎯 Recommandé pour toi</h2>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                      Score sport · niveau · proximité · date
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{personalizedSorties.length} sortie{personalizedSorties.length > 1 ? "s" : ""}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {personalizedSorties.map((s) => {
                    const isFull   = (s.nbParticipants ?? 0) >= s.participantsMax;
                    const isClosed = s.status === "closed";
                    const isOrg    = user?.id === s.organizerId;
                    const dejaInsc = user ? (s.participantIds ?? []).includes(user.id) : false;
                    const emoji    = SPORT_EMOJI[s.sport] ?? "🏅";
                    const c        = SPORT_COLOR[s.sport] ?? "#64748b";
                    const score    = (s as typeof s & { _score?: number })._score ?? 0;
                    return (
                      <Link key={s.id} href={`/sorties/${s.id}`}>
                        <div
                          onMouseEnter={() => { setHoveredSortie(s.id); setActiveSortie(s.id); }}
                          onMouseLeave={() => { setHoveredSortie(null); setActiveSortie(null); }}
                          className="flex items-center gap-3 bg-white rounded-2xl border border-indigo-100 hover:border-indigo-300 hover:shadow-sm p-3 cursor-pointer transition-all duration-150"
                        >
                          <span className="text-2xl flex-shrink-0">{emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{s.titre}</p>
                            <p className="text-xs text-slate-500 truncate">📍 {s.lieu} · 📅 {s.date}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: c + "18", color: c }}>
                              {s.sport}
                            </span>
                            {/* score bar */}
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5,6,7].map((i) => (
                                <div key={i} className={`w-1 h-1 rounded-full ${i <= score ? "bg-indigo-400" : "bg-slate-200"}`} />
                              ))}
                            </div>
                          </div>
                          {!isOrg && !dejaInsc && !isFull && !isClosed && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); requireProfile(() => rejoindre(s.id)); }}
                              disabled={!!joining}
                              className="ml-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-xl flex-shrink-0 transition-all active:scale-95 disabled:opacity-50"
                            >
                              {joining === s.id ? "…" : "Rejoindre"}
                            </button>
                          )}
                          {dejaInsc && <span className="ml-1 text-xs font-bold text-emerald-600">✓</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="h-px bg-slate-100 mt-5 mb-1" />
              </div>
            )}

            {/* Skeletons */}
            {loading && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} horizontal />)}
              </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <div className="text-5xl">😴</div>
                <div>
                  <p className="text-slate-800 font-bold text-lg">
                    {hasFilters || bounds ? "Aucune sortie trouvée" : "Aucune sortie pour l'instant"}
                  </p>
                  <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                    {hasFilters || bounds ? "Élargis tes filtres." : "Crée la première sortie !"}
                  </p>
                </div>
                {hasFilters || bounds
                  ? <button onClick={resetFilters} className={btnGhost}>Effacer les filtres</button>
                  : <Link href="/create"><button className={btnPrimary}>🚀 Créer</button></Link>
                }
              </div>
            )}

            {/* ── Cartes horizontales ── */}
            {!loading && filtered.length > 0 && (
              <div className="flex flex-col gap-3">
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

              const parsedRouteData = parseRoute(s.route);
              const parsedRoute = parsedRouteData?.geometry ?? null;
              const hasRoute = !!(parsedRoute && parsedRoute.length >= 2);
              const routeImgUrl = hasRoute ? getRouteStaticImageUrl(parsedRoute!, 400, 240) : "";

              return (
                <Link key={s.id} href={`/sorties/${s.id}`}>
                  <div
                    onMouseEnter={() => { setHoveredSortie(s.id); setActiveSortie(s.id); }}
                    onMouseLeave={() => { setHoveredSortie(null); setActiveSortie(null); }}
                    className={`group flex gap-3 bg-white rounded-2xl border transition-all duration-150 cursor-pointer p-3 ${
                      hoveredSortie === s.id
                        ? "border-blue-400 shadow-md ring-1 ring-blue-200"
                        : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    {/* Image */}
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-200">
                      <img
                        src={hasRoute && routeImgUrl
                          ? routeImgUrl
                          : resolveSortieImage(s.image_url ?? s.image, s.sport, s.lieu)}
                        alt={s.titre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            SPORT_IMAGE_FALLBACK[s.sport] ?? SPORT_IMAGE_FALLBACK["default"];
                        }}
                      />
                      {/* Overlay km + niveau si parcours dispo */}
                      {hasRoute && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end px-1.5 pb-1.5 gap-0.5">
                          {s.distanceKm != null && (
                            <span className="text-white text-[10px] font-bold drop-shadow leading-none">
                              📏 {s.distanceKm.toFixed(1)} km
                            </span>
                          )}
                          {s.elevationGain != null && s.elevationGain > 0 && (
                            <span className="text-white text-[10px] font-semibold drop-shadow leading-none">
                              ⬆️ {s.elevationGain} m
                            </span>
                          )}
                        </div>
                      )}
                      {/* Sport emoji */}
                      <div className="absolute top-1.5 left-1.5 text-sm drop-shadow">{SPORT_EMOJI[s.sport] ?? "🏅"}</div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        {/* Badges */}
                        <div className="flex gap-1 flex-wrap mb-1">
                          {isRecommended && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">⭐ Top</span>}
                          {isNew && !isOrganizer && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">🆕 Nouveau</span>}
                          {isAlmostFull && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">⚡ Dernières places</span>}
                          {isPopular && <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">🔥 Populaire</span>}
                          {isOrganizer && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">👑 Ma sortie</span>}
                          {isClosed && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">🔒 Clôturée</span>}
                          {!isClosed && isFull && <span className="text-[10px] font-semibold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">Complet</span>}
                          {s.avgRating != null && s.nbRatings != null && s.nbRatings > 0 && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                              ⭐ {s.avgRating.toFixed(1)} ({s.nbRatings})
                            </span>
                          )}
                        </div>

                        <h2 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{s.titre}</h2>
                        <p className="text-xs text-slate-500 truncate mt-0.5">📍 {s.lieu}</p>
                        <p className="text-xs text-slate-400 mt-0.5">📅 {s.date} · {s.heure}</p>
                      </div>

                      <div className="flex items-center justify-between mt-2 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.niveau && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${NIVEAU_STYLE[s.niveau] ?? "bg-slate-100 text-slate-600"}`}>
                              {s.niveau}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isFull ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                            👥 {s.nbParticipants ?? 0}/{s.participantsMax}
                          </span>
                        </div>
                        {!isOrganizer && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); !dejaInscrit && !joining && requireProfile(() => rejoindre(s.id)); }}
                            disabled={!!joining || isFull || isClosed || dejaInscrit}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0 transition-all active:scale-95 ${
                              dejaInscrit || joined === s.id ? "bg-emerald-100 text-emerald-600"
                              : isClosed || isFull ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm"
                            }`}
                          >
                            {joining === s.id ? "…" : dejaInscrit ? "✓" : isClosed ? "🔒" : isFull ? "Complet" : "Rejoindre"}
                          </button>
                        )}
                        {isOrganizer && (
                          <span className="text-xs font-semibold text-slate-400">⚙️ Gérer</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                        <div className={`h-full rounded-full ${isClosed || isFull ? "bg-red-400" : pct > 70 ? "bg-orange-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT : carte sticky (desktop) ── */}
        <div className="hidden lg:block w-full sticky top-20">
          <div className="h-[70vh] rounded-2xl overflow-hidden shadow-sm border border-slate-100">
            <ExploreMap
              sorties={markers}
              hoveredId={hoveredSortie}
              activeId={activeSortie}
              onHover={setHoveredSortie}
              onActive={setActiveSortie}
              height="100%"
            />
          </div>
        </div>

        </div>{/* end grid */}

        {/* ── Mobile : carte plein écran quand toggle actif ── */}
        {mobileView === "map" && (
          <div className="lg:hidden h-[calc(100vh-128px)] rounded-2xl overflow-hidden">
            <ExploreMap
              sorties={markers}
              hoveredId={hoveredSortie}
              activeId={activeSortie}
              onHover={setHoveredSortie}
              onActive={setActiveSortie}
              height="100%"
            />
          </div>
        )}

      </div>{/* end max-w-7xl */}

      {/* ── Communauté / annonces ── */}
      <div ref={communauteSectionRef}>
        <CommunauteBoard autoOpen={communauteAutoOpen} onAutoOpenDone={() => setCommunauteAutoOpen(null)} />
      </div>

      {/* ── Section marketing ── */}
      <section className="bg-white border-t border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Pourquoi RidePlanner ?</h2>
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

      {/* ── Météo complète en bas ── */}
      <section className="bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Météo locale</span>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-300">OpenWeatherMap</span>
          </div>
          <WeatherWidget />
        </div>
      </section>

      {/* ── Toast activité (bas-gauche) ── */}
      <div className={`fixed bottom-6 left-6 z-40 max-w-xs transition-all duration-500 ${
        activityVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      }`}>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg px-4 py-3 text-sm text-slate-700 font-medium flex items-center gap-2">
          {activityToast}
        </div>
      </div>

      {/* ── Modal choix création ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            <div className="text-center pb-1">
              <h3 className="text-xl font-extrabold text-slate-900">Que veux-tu faire ?</h3>
              <p className="text-sm text-slate-400 mt-1">Choisis ton intention</p>
            </div>
            <div className="flex flex-col gap-3">
              {/* Propose */}
              <button
                onClick={() => { setShowCreateModal(false); requireProfile(() => router.push("/create")); }}
                className="group flex items-center gap-4 w-full rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 px-5 py-5 transition-all active:scale-[0.98] text-left"
              >
                <span className="text-3xl">🚀</span>
                <div className="flex-1">
                  <p className="text-base font-bold text-emerald-800">Je propose une sortie</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Tu as une idée et cherches des participants</p>
                </div>
                <span className="text-emerald-400 group-hover:translate-x-1 transition-transform text-lg">→</span>
              </button>
              {/* Cherche */}
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCommunauteAutoOpen("cherche");
                  setTimeout(() => communauteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                }}
                className="group flex items-center gap-4 w-full rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 px-5 py-5 transition-all active:scale-[0.98] text-left"
              >
                <span className="text-3xl">🔍</span>
                <div className="flex-1">
                  <p className="text-base font-bold text-indigo-800">Je cherche des partenaires</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Tu veux trouver quelqu&apos;un avec qui pratiquer</p>
                </div>
                <span className="text-indigo-400 group-hover:translate-x-1 transition-transform text-lg">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
