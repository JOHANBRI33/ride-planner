"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayForecast = {
  date: string;       // "lun.", "mar.", …
  dateObj: Date;
  emoji: string;
  label: string;
  tempMin: number;
  tempMax: number;
  pop: number;        // probability of precipitation 0-1
};

type WeatherData = {
  city: string;
  country: string;
  currentTemp: number;
  feelsLike: number;
  emoji: string;
  label: string;
  humidity: number;
  windKmh: number;
  forecast: DayForecast[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COORDS = { lat: 44.8378, lon: -0.5792 }; // Bordeaux

const DAY_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// OWM weather id → emoji + label fr
function owmToEmoji(id: number, icon: string): { emoji: string; label: string } {
  const night = icon.endsWith("n");
  if (id >= 200 && id < 300) return { emoji: "⛈️",  label: "Orages" };
  if (id >= 300 && id < 400) return { emoji: "🌦️",  label: "Bruine" };
  if (id >= 500 && id < 600) {
    if (id === 500) return { emoji: "🌧️", label: "Pluie légère" };
    if (id === 501) return { emoji: "🌧️", label: "Pluie modérée" };
    return { emoji: "🌧️", label: "Pluie" };
  }
  if (id >= 600 && id < 700) return { emoji: "❄️",  label: "Neige" };
  if (id >= 700 && id < 800) return { emoji: "🌫️",  label: "Brume" };
  if (id === 800) return night ? { emoji: "🌙", label: "Nuit claire" } : { emoji: "☀️", label: "Ensoleillé" };
  if (id === 801) return { emoji: "🌤️",  label: "Peu nuageux" };
  if (id === 802) return { emoji: "⛅",   label: "Partiellement nuageux" };
  return { emoji: "☁️", label: "Nuageux" };
}

// ─── Dynamic motivation message ───────────────────────────────────────────────

function motivationMessage(data: WeatherData): { text: string; color: string } | null {
  const today = new Date();
  const isFriday = today.getDay() === 5;
  const isSaturday = today.getDay() === 6;
  const isSunday = today.getDay() === 0;
  const isWeekend = isSaturday || isSunday || isFriday;

  const temp = data.currentTemp;
  const emoji = data.emoji;
  const isRain = ["🌧️", "⛈️", "🌦️"].includes(emoji);
  const isSunny = ["☀️", "🌤️", "⛅"].includes(emoji);
  const isSnow = emoji === "❄️";

  // Weekend sunny
  const weekendForecast = data.forecast.find((d) => [6, 0].includes(d.dateObj.getDay()));
  const weekendSunny = weekendForecast && ["☀️", "🌤️", "⛅"].includes(weekendForecast.emoji);

  if (isWeekend && isSunny && temp >= 15)
    return { text: "☀️ Parfait pour sortir ce week-end !", color: "text-amber-600" };
  if (isWeekend && isSunny)
    return { text: "🧥 Frais mais idéal pour courir ce week-end", color: "text-blue-600" };
  if (!isWeekend && weekendSunny)
    return { text: "🗓️ Beau temps prévu ce week-end, prépare ta sortie !", color: "text-emerald-600" };
  if (isRain && temp >= 12)
    return { text: "🌧️ Pluie légère — une sortie trail reste envisageable", color: "text-slate-500" };
  if (isRain)
    return { text: "☔ Mauvais temps — parfait pour planifier une sortie future", color: "text-slate-400" };
  if (isSnow)
    return { text: "❄️ Neige en vue — prévoir trail ou raquettes !", color: "text-sky-600" };
  if (temp >= 25)
    return { text: "🌡️ Grosse chaleur — pense à sortir tôt le matin", color: "text-orange-500" };
  if (isSunny && temp >= 10)
    return { text: "🏃 Bonne météo pour une sortie aujourd'hui !", color: "text-emerald-600" };
  return null;
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
  if (!res.ok) return null;
  const { current, forecast: forecastRaw, error } = await res.json();
  if (error) return null;

  const { emoji, label } = owmToEmoji(current.weather[0].id, current.weather[0].icon);

  // Group forecast by day (skip today)
  const todayStr = new Date().toDateString();
  const byDay = new Map<string, { temps: number[]; ids: number[]; icons: string[]; pops: number[]; dateObj: Date }>();

  for (const item of forecastRaw.list as {
    dt: number; main: { temp: number }; weather: { id: number; icon: string }[]; pop: number
  }[]) {
    const d = new Date(item.dt * 1000);
    const key = d.toDateString();
    if (key === todayStr) continue;
    if (!byDay.has(key)) byDay.set(key, { temps: [], ids: [], icons: [], pops: [], dateObj: d });
    const entry = byDay.get(key)!;
    entry.temps.push(item.main.temp);
    entry.ids.push(item.weather[0].id);
    entry.icons.push(item.weather[0].icon);
    entry.pops.push(item.pop);
  }

  const forecast: DayForecast[] = Array.from(byDay.values())
    .slice(0, 5)
    .map(({ temps, ids, icons, pops, dateObj }) => {
      // Pick most representative weather id (midday slot if available, else mode)
      const modeId = ids[Math.floor(ids.length / 2)] ?? ids[0];
      const modeIcon = icons[Math.floor(icons.length / 2)] ?? icons[0];
      const { emoji: fe, label: fl } = owmToEmoji(modeId, modeIcon);
      return {
        date: DAY_SHORT[dateObj.getDay()],
        dateObj,
        emoji: fe,
        label: fl,
        tempMin: Math.round(Math.min(...temps)),
        tempMax: Math.round(Math.max(...temps)),
        pop: Math.max(...pops),
      };
    });

  return {
    city: current.name,
    country: current.sys.country,
    currentTemp: Math.round(current.main.temp),
    feelsLike: Math.round(current.main.feels_like),
    emoji,
    label,
    humidity: current.main.humidity,
    windKmh: Math.round(current.wind.speed * 3.6),
    forecast,
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WeatherSkeleton() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 bg-slate-200 rounded-full" />
          <div className="h-7 w-16 bg-slate-200 rounded-full" />
        </div>
        <div className="h-12 w-12 bg-slate-200 rounded-full" />
      </div>
      <div className="flex gap-2">
        {[1,2,3,4,5].map((i) => (
          <div key={i} className="flex-1 h-20 bg-slate-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(lat: number, lon: number) {
      try {
        const data = await fetchWeather(lat, lon);
        if (!cancelled) {
          if (data) setWeather(data);
          else setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!navigator.geolocation) {
      load(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => load(pos.coords.latitude, pos.coords.longitude),
      () => load(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon),
      { timeout: 5000 },
    );

    return () => { cancelled = true; };
  }, []);

  if (loading) return <WeatherSkeleton />;

  // Clé absente ou API pas encore activée (nouvelles clés OWM : délai jusqu'à 2h)
  if (error || !weather) {
    return (
      <div className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-slate-400">
        <span className="text-2xl">🌤️</span>
        <span>Météo indisponible — clé API en cours d&apos;activation (jusqu&apos;à 2h)</span>
      </div>
    );
  }

  const motivation = motivationMessage(weather);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden fade-in">

      {/* ── Header : ville + météo actuelle ── */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-start justify-between gap-3">

        <div className="flex flex-col gap-0.5 min-w-0">
          {/* Ville */}
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest truncate">
            📍 {weather.city}, {weather.country}
          </span>
          {/* Temp + label */}
          <div className="flex items-end gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 leading-none tabular-nums">
              {weather.currentTemp}°
            </span>
            <span className="text-sm text-slate-500 font-medium pb-0.5 leading-tight">
              {weather.label}<br />
              <span className="text-xs text-slate-400">ressenti {weather.feelsLike}°</span>
            </span>
          </div>
        </div>

        {/* Emoji + détails */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-4xl sm:text-5xl leading-none select-none">{weather.emoji}</span>
          <div className="flex gap-3 text-xs text-slate-400 font-medium">
            <span>💧 {weather.humidity}%</span>
            <span>💨 {weather.windKmh} km/h</span>
          </div>
        </div>
      </div>

      {/* ── Message motivation ── */}
      {motivation && (
        <div className="px-4 sm:px-5 pb-3">
          <p className={`text-xs font-semibold ${motivation.color}`}>{motivation.text}</p>
        </div>
      )}

      {/* ── Prévisions 5 jours ── */}
      <div className="px-3 sm:px-4 pb-4 sm:pb-5">
        <div className="flex gap-1.5 sm:gap-2">
          {weather.forecast.map((day) => (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 bg-slate-50 hover:bg-slate-100 rounded-xl py-2.5 px-1 transition-colors duration-150 group"
            >
              {/* Jour */}
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                {day.date}
              </span>

              {/* Emoji météo */}
              <span className="text-lg sm:text-2xl leading-none select-none group-hover:scale-110 transition-transform duration-150">
                {day.emoji}
              </span>

              {/* Temp max / min */}
              <div className="flex flex-col items-center gap-0">
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 tabular-nums">
                  {day.tempMax}°
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 tabular-nums">
                  {day.tempMin}°
                </span>
              </div>

              {/* Barre probabilité pluie */}
              {day.pop > 0.1 && (
                <div className="w-full px-1.5">
                  <div className="h-0.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${Math.round(day.pop * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-blue-400 font-medium tabular-nums">
                    {Math.round(day.pop * 100)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
