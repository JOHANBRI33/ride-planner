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
const WeatherCompactDynamic = _dynamic(
  () => import("@/components/WeatherWidget").then((m) => ({ default: m.WeatherCompact })),
  { ssr: false },
);

// ─── Types ────────────────────────────────────────────────────────────────────

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

type WeatherData = { temp: number; desc: string; icon: string } | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const NIVEAU_STYLE: Record<string, string> = {
  "Débutant":      "bg-emerald-100 text-emerald-700",
  "Intermédiaire": "bg-blue-100 text-blue-700",
  "Avancé":        "bg-orange-100 text-orange-700",
  "Expert":        "bg-red-100 text-red-700",
};

const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé", "Expert"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDateShort(dateStr: string): string {
  const date  = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff <= 7)  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex gap-3 bg-white rounded-2xl border border-slate-100 p-3 animate-pulse">
      <div className="w-24 h-24 bg-slate-100 rounded-xl flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2 py-1">
        <div className="h-3 bg-slate-100 rounded-full w-2/3" />
        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
        <div className="h-3 bg-slate-100 rounded-full w-1/3" />
        <div className="flex gap-2 mt-auto">
          <div className="h-7 bg-slate-100 rounded-xl flex-1" />
          <div className="h-7 bg-slate-100 rounded-xl w-16" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useUser();
  const router    = useRouter();

  // Data
  const [sorties,     setSorties]     = useState<Sortie[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [weather,     setWeather]     = useState<WeatherData>(null);

  // Filters
  const [filterNiveau, setFilterNiveau] = useState("");
  const [filterDate,   setFilterDate]   = useState("");
  const [filterRadius, setFilterRadius] = useState<number | null>(null);
  const [locating,     setLocating]     = useState(false);

  // Map interaction
  const [hoveredSortie, setHoveredSortie] = useState<string | null>(null);
  const [activeSortie,  setActiveSortie]  = useState<string | null>(null);
  const [mobileView,    setMobileView]    = useState<"list" | "map">("list");

  // Position
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // UX
  const [joining,   setJoining]   = useState<string | null>(null);
  const [joined,    setJoined]    = useState<string | null>(null);
  const [joinToast, setJoinToast] = useState("");
  const [profilToast, setProfilToast] = useState(false);

  // ── Fetch sorties ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/sorties")
      .then((r) => r.json())
      .then((data) => { setSorties(data); setLoading(false); });
  }, []);

  // ── Toast profil configuré ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("profil") === "configured") {
      setProfilToast(true);
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setProfilToast(false), 4000);
    }
  }, []);

  // ── Géolocalisation auto ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
      () => {},
    );
  }, []);

  // ── Météo locale ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (userLat === null || userLng === null) return;
    fetch(`/api/weather?lat=${userLat}&lng=${userLng}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.main?.temp !== undefined) {
          setWeather({
            temp: Math.round(d.main.temp),
            desc: d.weather?.[0]?.description ?? "",
            icon: d.weather?.[0]?.icon ?? "",
          });
        }
      })
      .catch(() => {});
  }, [userLat, userLng]);

  // ── Filtres ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => sorties.filter((s) => {
    if (filterNiveau && s.niveau !== filterNiveau) return false;
    if (filterDate   && s.date   !== filterDate)   return false;
    if (filterRadius && userLat && userLng && s.latitude && s.longitude) {
      if (haversineKm(userLat, userLng, s.latitude, s.longitude) > filterRadius) return false;
    }
    return true;
  }), [sorties, filterNiveau, filterDate, filterRadius, userLat, userLng]);

  // ── Sorties à venir (7 prochains jours) ────────────────────────────────────
  const upcoming = useMemo(() => {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const inWeek  = new Date(today); inWeek.setDate(today.getDate() + 7);
    return filtered
      .filter((s) => {
        const d = new Date(s.date + "T00:00:00");
        return d >= today && d <= inWeek;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [filtered]);

  // ── Markers carte ──────────────────────────────────────────────────────────
  const markers = useMemo(() => filtered
    .filter((s) => s.latitude && s.longitude)
    .map((s) => {
      const parsed      = parseRoute(s.route);
      const geom        = parsed?.geometry ?? null;
      const cardImageUrl = geom && geom.length >= 2
        ? getRouteStaticImageUrl(geom, 460, 240)
        : resolveSortieImage(s.image_url ?? s.image, s.sport, s.lieu);
      return {
        id: s.id, titre: s.titre, lieu: s.lieu, date: s.date, heure: s.heure,
        sport: s.sport, niveau: s.niveau,
        latitude: s.latitude!, longitude: s.longitude!,
        distanceKm: s.distanceKm ?? null, elevationGain: s.elevationGain ?? null,
        nbParticipants: s.nbParticipants, participantsMax: s.participantsMax,
        status: s.status, cardImageUrl,
      };
    }), [filtered]);

  const hasFilters = filterNiveau || filterDate || filterRadius;

  function resetFilters() {
    setFilterNiveau(""); setFilterDate(""); setFilterRadius(null);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude);
        setFilterRadius((r) => r ?? 20); setLocating(false);
      },
      () => setLocating(false),
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Toast profil ── */}
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 pointer-events-none ${
        profilToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}>
        <div className="bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
          🎯 Profil mis à jour — sorties adaptées !
        </div>
      </div>

      {/* ── HERO compact ── */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

          {/* Left: title + sub */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚴</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Trouve ta prochaine sortie vélo
              </h1>
            </div>
            <p className="text-sm text-slate-500 ml-12">
              Rejoins une sortie près de toi ou crée la tienne en 30 secondes.
            </p>
            {/* Météo inline */}
            {weather && (
              <div className="ml-12 flex items-center gap-2 text-xs text-slate-500">
                {weather.icon && (
                  <img
                    src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
                    alt=""
                    className="w-5 h-5"
                  />
                )}
                <span className="font-semibold text-slate-700">{weather.temp}°C</span>
                <span className="capitalize">{weather.desc}</span>
              </div>
            )}
            {!weather && <WeatherCompactDynamic />}
          </div>

          {/* Right: CTAs */}
          <div className="flex gap-3 flex-shrink-0">
            <Link href="/create">
              <button className="min-h-[44px] bg-slate-900 hover:bg-slate-700 active:scale-[0.97] text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm shadow-sm whitespace-nowrap">
                + Créer une sortie
              </button>
            </Link>
            <Link href="/explore">
              <button className="min-h-[44px] border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.97] text-slate-700 font-semibold px-6 py-2.5 rounded-xl transition-all text-sm whitespace-nowrap">
                🗺️ Parcours
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Filtres sticky ── */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap gap-2 items-center">
          <select
            value={filterNiveau}
            onChange={(e) => setFilterNiveau(e.target.value)}
            className={filterCls}
          >
            <option value="">Tous niveaux</option>
            {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>

          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={filterCls}
          />

          {userLat && userLng ? (
            <select
              value={filterRadius ?? ""}
              onChange={(e) => setFilterRadius(e.target.value ? Number(e.target.value) : null)}
              className={filterCls}
            >
              <option value="">📍 Toutes distances</option>
              <option value="10">📍 10 km</option>
              <option value="20">📍 20 km</option>
              <option value="50">📍 50 km</option>
            </select>
          ) : (
            <button
              onClick={locateMe}
              disabled={locating}
              className={`${filterCls} cursor-pointer disabled:opacity-60 flex items-center gap-1.5`}
            >
              {locating ? "⏳ Localisation…" : "📍 Près de moi"}
            </button>
          )}

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
            >
              ✕ Effacer
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {loading ? "…" : `${filtered.length} sortie${filtered.length !== 1 ? "s" : ""}`}
            </span>
            {/* Mobile tabs */}
            <div className="flex lg:hidden bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setMobileView(v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                    mobileView === v ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                  }`}
                >
                  {v === "list" ? "Liste" : "Carte"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section "Sorties à venir" ── */}
      {!loading && upcoming.length > 0 && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              📅 Cette semaine
              <span className="font-normal text-slate-400">— {upcoming.length} sortie{upcoming.length > 1 ? "s" : ""} à venir</span>
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {upcoming.map((s) => {
                const isFull     = (s.nbParticipants ?? 0) >= s.participantsMax;
                const dejaInscrit = user ? (s.participantIds ?? []).includes(user.id) : false;
                const isOrg      = user?.id === s.organizerId;
                const places     = s.participantsMax - (s.nbParticipants ?? 0);

                return (
                  <Link key={s.id} href={`/sorties/${s.id}`} className="flex-shrink-0">
                    <div className="w-52 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md rounded-2xl p-3.5 flex flex-col gap-2 transition-all cursor-pointer">
                      {/* Date badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                          {formatDateShort(s.date)}
                        </span>
                        {weather && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            {weather.icon && <img src={`https://openweathermap.org/img/wn/${weather.icon}.png`} alt="" className="w-4 h-4" />}
                            {weather.temp}°
                          </span>
                        )}
                      </div>

                      {/* Titre */}
                      <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{s.titre}</p>

                      {/* Lieu */}
                      <p className="text-xs text-slate-400 truncate">📍 {s.lieu}</p>

                      {/* Stats */}
                      <div className="flex items-center justify-between pt-1 mt-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.distanceKm && (
                            <span className="text-[10px] font-semibold text-slate-500">📏 {s.distanceKm.toFixed(0)} km</span>
                          )}
                          <span className={`text-[10px] font-semibold ${isFull ? "text-red-500" : "text-slate-500"}`}>
                            👥 {s.nbParticipants}/{s.participantsMax}
                          </span>
                        </div>
                        {!isOrg && !dejaInscrit && !isFull && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {places} place{places > 1 ? "s" : ""}
                          </span>
                        )}
                        {dejaInscrit && <span className="text-[10px] font-bold text-emerald-600">✓ Inscrit</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SPLIT LAYOUT ── */}
      <div id="sorties-grid" className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[58%_42%] gap-6 items-start">

          {/* ── LEFT: liste ── */}
          <div className={`w-full ${mobileView === "map" ? "hidden lg:block" : ""}`}>

            {/* Skeletons */}
            {loading && (
              <div className="flex flex-col gap-3">
                {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 flex flex-col items-center gap-4">
                <span className="text-5xl">🚴</span>
                <div>
                  <p className="text-slate-800 font-bold text-lg">
                    {hasFilters ? "Aucune sortie trouvée" : "Aucune sortie pour l'instant"}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {hasFilters ? "Élargis tes filtres." : "Sois le premier à créer une sortie !"}
                  </p>
                </div>
                {hasFilters
                  ? <button onClick={resetFilters} className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold px-6 py-2.5 rounded-xl transition-all">Effacer les filtres</button>
                  : <Link href="/create"><button className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm">+ Créer une sortie</button></Link>
                }
              </div>
            )}

            {/* Cards */}
            {!loading && filtered.length > 0 && (
              <div className="flex flex-col gap-3">
                {filtered.map((s) => {
                  const isFull      = (s.nbParticipants ?? 0) >= s.participantsMax;
                  const isClosed    = s.status === "closed";
                  const isOrganizer = user?.id === s.organizerId;
                  const dejaInscrit = user ? (s.participantIds ?? []).includes(user.id) : false;
                  const pct         = Math.min(100, ((s.nbParticipants ?? 0) / s.participantsMax) * 100);
                  const isAlmostFull = pct >= 80 && !isFull && !isClosed;

                  const parsedRoute  = parseRoute(s.route);
                  const geom         = parsedRoute?.geometry ?? null;
                  const hasRoute     = !!(geom && geom.length >= 2);
                  const routeImgUrl  = hasRoute ? getRouteStaticImageUrl(geom!, 400, 240) : "";

                  return (
                    <Link key={s.id} href={`/sorties/${s.id}`}>
                      <div
                        onMouseEnter={() => { setHoveredSortie(s.id); setActiveSortie(s.id); }}
                        onMouseLeave={() => { setHoveredSortie(null); setActiveSortie(null); }}
                        className={`group flex gap-3 bg-white rounded-2xl border transition-all duration-150 cursor-pointer p-3 ${
                          hoveredSortie === s.id
                            ? "border-slate-400 shadow-md ring-1 ring-slate-200"
                            : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                        }`}
                      >
                        {/* Image */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100">
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
                          {hasRoute && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end px-1.5 pb-1.5 gap-0.5">
                              {s.distanceKm != null && (
                                <span className="text-white text-[10px] font-bold drop-shadow">📏 {s.distanceKm.toFixed(1)} km</span>
                              )}
                              {s.elevationGain != null && s.elevationGain > 0 && (
                                <span className="text-white text-[10px] font-semibold drop-shadow">⬆️ {s.elevationGain} m</span>
                              )}
                            </div>
                          )}
                          <div className="absolute top-1.5 left-1.5 text-sm drop-shadow">🚴</div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex gap-1 flex-wrap mb-1">
                              {isAlmostFull && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">⚡ Dernières places</span>}
                              {isOrganizer  && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">👑 Ma sortie</span>}
                              {isClosed     && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">🔒 Clôturée</span>}
                              {!isClosed && isFull && <span className="text-[10px] font-semibold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">Complet</span>}
                              {s.avgRating != null && s.nbRatings && s.nbRatings > 0 && (
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">⭐ {s.avgRating.toFixed(1)}</span>
                              )}
                            </div>
                            <h2 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{s.titre}</h2>
                            <p className="text-xs text-slate-500 truncate mt-0.5">📍 {s.lieu}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              📅 {formatDateShort(s.date)}{s.heure ? ` · ${s.heure}` : ""}
                            </p>
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
                                onClick={(e) => { e.preventDefault(); !dejaInscrit && !joining && rejoindre(s.id); }}
                                disabled={!!joining || isFull || isClosed || dejaInscrit}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0 transition-all active:scale-95 ${
                                  dejaInscrit || joined === s.id
                                    ? "bg-emerald-100 text-emerald-600"
                                    : isClosed || isFull
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-900 hover:bg-slate-700 text-white shadow-sm"
                                }`}
                              >
                                {joining === s.id ? "…" : dejaInscrit ? "✓" : isClosed ? "🔒" : isFull ? "Complet" : "Rejoindre"}
                              </button>
                            )}
                            {isOrganizer && <span className="text-xs font-semibold text-slate-400">⚙️ Gérer</span>}
                          </div>

                          {/* Progress bar */}
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full rounded-full ${isClosed || isFull ? "bg-red-400" : pct > 70 ? "bg-orange-400" : "bg-emerald-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT: carte sticky ── */}
          <div className={`w-full sticky top-28 ${mobileView === "list" ? "hidden lg:block" : ""}`}>
            <div className="h-[calc(100vh-160px)] min-h-[500px] rounded-2xl overflow-hidden shadow-sm border border-slate-100">
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

        </div>
      </div>

      {/* ── Toast join ── */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 pointer-events-none ${
        joinToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}>
        <div className="bg-emerald-600 text-white rounded-2xl shadow-lg px-6 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap">
          ✅ {joinToast}
        </div>
      </div>

    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const filterCls = "border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-700 transition-colors";
