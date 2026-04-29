"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import _dynamic from "next/dynamic";
import { useUser } from "@/context/UserContext";
import type { MapRoute } from "@/components/RoutesMap";

const RoutesMap = _dynamic(() => import("@/components/RoutesMap"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type Route = MapRoute & {
  duration_min:  number;
  safety_score:  number;
  traffic_level: string;
  gpx_url:       string;
  distanceToUser?: number; // computed client-side
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORTS = ["", "Vélo", "Course à pied", "Trail", "Randonnée", "Natation", "Triathlon"];
const DIFFICULTIES = ["", "Débutant", "Intermédiaire", "Avancé", "Expert"];

const SPORT_COLOR: Record<string, string> = {
  "Vélo":           "bg-orange-100 text-orange-700",
  "Course à pied":  "bg-red-100 text-red-700",
  "Trail":          "bg-purple-100 text-purple-700",
  "Randonnée":      "bg-emerald-100 text-emerald-700",
  "Natation":       "bg-cyan-100 text-cyan-700",
  "Triathlon":      "bg-amber-100 text-amber-700",
};

const DIFFICULTY_STYLE: Record<string, string> = {
  "Débutant":      "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Intermédiaire": "bg-blue-50 text-blue-700 border-blue-200",
  "Avancé":        "bg-orange-50 text-orange-700 border-orange-200",
  "Expert":        "bg-red-50 text-red-700 border-red-200",
};

const SPORT_EMOJI: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Trail": "🏔️",
  "Randonnée": "🥾", "Natation": "🏊", "Triathlon": "🏅",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function fmtMin(min: number): string {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// ─── Safety dots ──────────────────────────────────────────────────────────────

function SafetyDots({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5" title={`Sécurité ${score}/5`}>
      {[1,2,3,4,5].map((n) => (
        <span key={n} className={`w-1.5 h-1.5 rounded-full ${n <= score ? "bg-emerald-500" : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="h-9 bg-slate-100 rounded-xl" />
    </div>
  );
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({
  route, active, hovered, isFavorite,
  onMouseEnter, onMouseLeave, onClick, onFavorite, onCreateSortie,
}: {
  route:          Route;
  active:         boolean;
  hovered:        boolean;
  isFavorite:     boolean;
  onMouseEnter:   () => void;
  onMouseLeave:   () => void;
  onClick:        () => void;
  onFavorite:     () => void;
  onCreateSortie: () => void;
}) {
  const sportCls = SPORT_COLOR[route.sport] ?? "bg-slate-100 text-slate-600";
  const diffCls  = DIFFICULTY_STYLE[route.difficulty] ?? "bg-slate-50 text-slate-600 border-slate-200";
  const emoji    = SPORT_EMOJI[route.sport] ?? "🏅";
  const sportColor = {
    "Vélo":"#f97316","Course à pied":"#ef4444","Trail":"#8b5cf6",
    "Randonnée":"#10b981","Natation":"#06b6d4","Triathlon":"#f59e0b",
  }[route.sport] ?? "#64748b";

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`group bg-white rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
        active  ? "border-slate-900 shadow-lg ring-1 ring-slate-900/10" :
        hovered ? "border-slate-300 shadow-md"                          :
                  "border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md"
      }`}
    >
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: sportColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `${sportColor}18` }}
          >
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">{route.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {route.city && (
                <span className="text-[11px] text-slate-400">📍 {route.city}</span>
              )}
              {route.distanceToUser != null && (
                <span className="text-[11px] text-blue-500 font-medium">
                  à {route.distanceToUser} km
                </span>
              )}
            </div>
          </div>
          {/* Favorite button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isFavorite
                ? "text-yellow-500 bg-yellow-50"
                : "text-slate-300 hover:text-yellow-400 hover:bg-yellow-50"
            }`}
            title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            {isFavorite ? "⭐" : "☆"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat icon="📏" value={`${route.distance_km} km`}  label="Distance" />
          <Stat icon="⏱️" value={fmtMin(route.duration_min)} label="Durée"    />
          <Stat icon="⬆️" value={`${route.elevation} m`}     label="D+"       />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${diffCls}`}>
            {route.difficulty}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sportCls}`}>
            {route.sport}
          </span>
          {route.safety_score > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-slate-400">Sécu.</span>
              <SafetyDots score={route.safety_score} />
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCreateSortie(); }}
            className="flex-1 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all active:scale-[0.97]"
          >
            + Créer une sortie
          </button>
          {route.gpx_url && (
            <a
              href={route.gpx_url}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 text-xs font-bold"
              title="Télécharger GPX"
            >
              ↓
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
      <span className="text-sm font-bold text-slate-800">{icon} {value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const { user } = useUser();

  // Data
  const [routes,    setRoutes]    = useState<Route[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set()); // routeIds

  // Filters
  const [sport,       setSport]       = useState("");
  const [difficulty,  setDifficulty]  = useState("");
  const [maxDist,     setMaxDist]     = useState(100);
  const [sortBy,      setSortBy]      = useState<"distance" | "proximity" | "elevation">("distance");
  const [showFavOnly, setShowFavOnly] = useState(false);

  // Map interaction
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId,  setActiveId]  = useState<string | null>(null);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

  // User position
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Card refs for scroll-to
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Geolocation ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
      () => {},
    );
  }, []);

  // ── Fetch routes ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/routes")
      .then((r) => r.json())
      .then((data: Route[]) => {
        const arr = Array.isArray(data) ? data : [];
        setRoutes(arr);
      })
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch favorites ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/favorites?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data: { routeId: string }[]) => {
        if (Array.isArray(data)) setFavorites(new Set(data.map((d) => d.routeId)));
      })
      .catch(() => {});
  }, [user?.id]);

  // ── Add distance to user ──────────────────────────────────────────────────

  const enrichedRoutes: Route[] = useMemo(() => {
    return routes.map((r) => ({
      ...r,
      distanceToUser:
        userLat !== null && userLng !== null && r.start_lat && r.start_lng
          ? haversineKm(userLat, userLng, r.start_lat, r.start_lng)
          : undefined,
    }));
  }, [routes, userLat, userLng]);

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = enrichedRoutes.filter((r) => {
      if (sport      && r.sport      !== sport)      return false;
      if (difficulty && r.difficulty !== difficulty) return false;
      if (r.distance_km > maxDist)                   return false;
      if (showFavOnly && !favorites.has(r.id))       return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "proximity") {
        const da = a.distanceToUser ?? Infinity;
        const db = b.distanceToUser ?? Infinity;
        return da - db;
      }
      if (sortBy === "elevation") return b.elevation - a.elevation;
      return a.distance_km - b.distance_km;
    });

    return list;
  }, [enrichedRoutes, sport, difficulty, maxDist, sortBy, showFavOnly, favorites]);

  // ── Favorite toggle ───────────────────────────────────────────────────────

  const toggleFavorite = useCallback(async (routeId: string) => {
    if (!user?.id) return;
    const isFav = favorites.has(routeId);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(routeId) : next.add(routeId);
      return next;
    });

    try {
      await fetch("/api/favorites", {
        method: isFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, routeId }),
      });
    } catch {
      // Rollback on error
      setFavorites((prev) => {
        const next = new Set(prev);
        isFav ? next.add(routeId) : next.delete(routeId);
        return next;
      });
    }
  }, [user?.id, favorites]);

  // ── Scroll card into view when marker clicked ─────────────────────────────

  useEffect(() => {
    if (!activeId) return;
    const el = cardRefs.current.get(activeId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  // ── Create sortie from route ──────────────────────────────────────────────

  function handleCreateSortie(routeId: string) {
    window.location.href = `/create?routeId=${encodeURIComponent(routeId)}`;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">←</Link>
          <h1 className="text-base font-bold text-slate-900">Explorer les parcours</h1>
          {!loading && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              {filtered.length} parcours
            </span>
          )}
        </div>

        {/* Mobile tab switcher */}
        <div className="flex sm:hidden bg-slate-100 rounded-xl p-1 gap-1">
          {(["list", "map"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                mobileTab === tab ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
              }`}
            >
              {tab === "list" ? "📋 Liste" : "🗺️ Carte"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: split layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Filters + List ── */}
        <div className={`
          flex flex-col w-full sm:w-[400px] lg:w-[440px] flex-shrink-0
          border-r border-slate-100 overflow-hidden
          ${mobileTab === "map" ? "hidden sm:flex" : "flex"}
        `}>

          {/* Filters */}
          <div className="p-4 border-b border-slate-50 flex flex-col gap-3 flex-shrink-0 bg-white">
            {/* Row 1: Sport + Difficulty */}
            <div className="flex gap-2">
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {SPORTS.map((s) => <option key={s} value={s}>{s || "Tous les sports"}</option>)}
              </select>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d || "Tous niveaux"}</option>)}
              </select>
            </div>

            {/* Row 2: Distance + Sort */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-slate-400 font-medium">Distance max</span>
                  <span className="text-[10px] font-bold text-slate-700">{maxDist} km</span>
                </div>
                <input
                  type="range" min={5} max={250} step={5}
                  value={maxDist}
                  onChange={(e) => setMaxDist(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="distance">↕ Distance</option>
                <option value="proximity">📍 Proximité</option>
                <option value="elevation">⬆️ D+</option>
              </select>
            </div>

            {/* Row 3: Favorites toggle */}
            {user && (
              <button
                onClick={() => setShowFavOnly((v) => !v)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl transition-all border ${
                  showFavOnly
                    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {showFavOnly ? "⭐ Mes favoris uniquement" : "☆ Afficher mes favoris"}
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50">
            {loading && [1,2,3].map((i) => <SkeletonCard key={i} />)}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <span className="text-4xl">🗺️</span>
                <p className="text-sm font-semibold text-slate-600">Aucun parcours trouvé</p>
                <p className="text-xs text-slate-400">Modifie les filtres pour voir plus de résultats</p>
              </div>
            )}

            {!loading && filtered.map((route) => (
              <div
                key={route.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(route.id, el);
                  else cardRefs.current.delete(route.id);
                }}
              >
                <RouteCard
                  route={route}
                  active={activeId  === route.id}
                  hovered={hoveredId === route.id}
                  isFavorite={favorites.has(route.id)}
                  onMouseEnter={() => setHoveredId(route.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    setActiveId((prev) => prev === route.id ? null : route.id);
                    setMobileTab("map");
                  }}
                  onFavorite={() => toggleFavorite(route.id)}
                  onCreateSortie={() => handleCreateSortie(route.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Map ── */}
        <div className={`
          flex-1 relative
          ${mobileTab === "list" ? "hidden sm:block" : "block"}
        `}>
          <RoutesMap
            routes={filtered}
            hoveredId={hoveredId}
            activeId={activeId}
            onHover={setHoveredId}
            onActive={(id) => {
              setActiveId(id);
              if (id) setMobileTab("list");
            }}
            height="100%"
          />

          {/* Active route CTA overlay */}
          {activeId && (() => {
            const route = filtered.find((r) => r.id === activeId);
            if (!route) return null;
            return (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 px-5 py-3 flex items-center gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900 max-w-[200px] truncate">{route.name}</p>
                    <p className="text-xs text-slate-400">{route.distance_km} km · {route.elevation} m D+</p>
                  </div>
                  <button
                    onClick={() => handleCreateSortie(route.id)}
                    className="bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap"
                  >
                    + Créer cette sortie
                  </button>
                  <button
                    onClick={() => setActiveId(null)}
                    className="text-slate-300 hover:text-slate-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
