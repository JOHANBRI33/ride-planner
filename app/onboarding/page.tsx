"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type SportKey = "cycling" | "running" | "hiking" | "swimming" | "other";

type Option = { value: string; label: string; emoji: string; desc?: string };

type Step = {
  id:       string;
  question: string;
  emoji:    string;
  hint?:    string;
  type:     "multi" | "single";
  options:  Option[];
};

type MatchedSortie = {
  id: string;
  titre: string;
  sport: string;
  niveau: string | null;
  date: string | null;
  lieu: string | null;
  distanceKm: number | null;
  nbParticipants: number;
  participantsMax: number;
  score: number;
};

// ─── Sport mapping ────────────────────────────────────────────────────────────

const SPORT_TO_SORTIE: Record<SportKey, string[]> = {
  cycling:  ["Vélo"],
  running:  ["Course à pied"],
  hiking:   ["Randonnée", "Trail"],
  swimming: ["Natation"],
  other:    [],
};

const SPORT_EMOJI_MAP: Record<string, string> = {
  "Vélo": "🚴", "Course à pied": "🏃", "Randonnée": "🥾",
  "Trail": "⛰️", "Natation": "🏊", "Triathlon": "🏅",
};

const SPORT_COLOR_MAP: Record<string, string> = {
  "Vélo": "#3B82F6", "Course à pied": "#F97316", "Randonnée": "#22C55E",
  "Trail": "#8B5CF6", "Natation": "#06B6D4", "Triathlon": "#F59E0B",
};

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "sports",
    question: "Quels sports pratiques-tu ?",
    emoji: "🏅",
    hint: "Plusieurs choix possibles",
    type: "multi",
    options: [
      { value: "cycling",  label: "Vélo",              emoji: "🚴", desc: "Route, gravel, VTT" },
      { value: "running",  label: "Course à pied",     emoji: "🏃", desc: "Route, trail, piste" },
      { value: "hiking",   label: "Randonnée / Trail", emoji: "🥾", desc: "Journée ou bivouac" },
      { value: "swimming", label: "Natation",          emoji: "🏊", desc: "Piscine ou eau libre" },
      { value: "other",    label: "Autre sport",       emoji: "🏅", desc: "Tout autre activité" },
    ],
  },
  {
    id: "goal",
    question: "Quel est ton objectif principal ?",
    emoji: "🎯",
    type: "single",
    options: [
      { value: "performance", label: "Progresser & performer",  emoji: "📈", desc: "Je vise la progression" },
      { value: "social",      label: "Rencontrer des sportifs", emoji: "🤝", desc: "Je cherche une communauté" },
      { value: "fun",         label: "Bouger pour le plaisir",  emoji: "😄", desc: "Sans pression" },
      { value: "health",      label: "Garder la forme",        emoji: "💪", desc: "Régulier & équilibré" },
    ],
  },
  {
    id: "niveau",
    question: "Quel est ton niveau général ?",
    emoji: "📊",
    type: "single",
    options: [
      { value: "Débutant",      label: "Débutant",      emoji: "🌱", desc: "Je débute ou je reprends" },
      { value: "Intermédiaire", label: "Intermédiaire", emoji: "🔥", desc: "Pratique régulière" },
      { value: "Avancé",        label: "Avancé",        emoji: "⚡", desc: "Entraînement sérieux" },
      { value: "Expert",        label: "Expert",        emoji: "🏆", desc: "Compétition / haute performance" },
    ],
  },
  {
    id: "rythme",
    question: "À quelle fréquence sors-tu ?",
    emoji: "📅",
    type: "single",
    options: [
      { value: "occasional", label: "De temps en temps", emoji: "☕", desc: "Quand l'occasion se présente" },
      { value: "weekly",     label: "1 fois par semaine", emoji: "🗓️", desc: "Une sortie hebdo" },
      { value: "regular",    label: "2–3 fois par semaine", emoji: "🔥", desc: "Pratique régulière" },
      { value: "daily",      label: "Presque tous les jours", emoji: "⚡", desc: "Sportif assidu" },
    ],
  },
];

// ─── Scoring (écran résultats) ────────────────────────────────────────────────

function scoreSortie(
  s: { sport: string; niveau: string | null; date: string | null },
  sports: string[],   // noms de sport ("Vélo", "Course à pied"…)
  niveau: string,
): number {
  let score = 0;
  if (sports.includes(s.sport)) score += 3;
  if (s.niveau === niveau) score += 2;
  else if (s.niveau === "Débutant") score += 1; // toujours accessible
  if (s.date) {
    const days = (new Date(s.date).getTime() - Date.now()) / 86400000;
    if (days >= 0 && days <= 7) score += 1;
  }
  return score;
}

// ─── Composant bouton option ──────────────────────────────────────────────────

function OptionBtn({
  opt, selected, onClick,
}: { opt: Option; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl border-2 font-semibold text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
      }`}
    >
      <span className="text-2xl flex-shrink-0 leading-none">{opt.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="text-sm leading-snug block">{opt.label}</span>
        {opt.desc && <span className="text-xs text-slate-400 font-normal">{opt.desc}</span>}
      </span>
      {selected && <span className="text-blue-500 font-bold flex-shrink-0">✓</span>}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useUser();

  const alreadyDone = profile?.onboardingDone === "true";

  // Step index: 0-3 = questions, 4 = résultats
  const [step,         setStep]         = useState(0);
  const [animating,    setAnimating]    = useState(false);
  const [slideDir,     setSlideDir]     = useState<"fwd" | "bck">("fwd");
  const [sports,       setSports]       = useState<SportKey[]>([]);
  const [goal,         setGoal]         = useState("");
  const [niveau,       setNiveau]       = useState("");
  const [rythme,       setRythme]       = useState("");
  const [saving,       setSaving]       = useState(false);
  const [matches,      setMatches]      = useState<MatchedSortie[]>([]);
  const [loadingMatch, setLoadingMatch] = useState(false);

  const isResults = step === STEPS.length;

  // Fetch + score sorties quand on arrive à l'écran résultats
  useEffect(() => {
    if (!isResults) return;
    setLoadingMatch(true);
    const sportNames = sports.flatMap((k) => SPORT_TO_SORTIE[k] ?? []);
    fetch("/api/sorties")
      .then((r) => r.json())
      .then((data: Array<{
        id: string; titre: string; sport: string; niveau: string | null;
        date: string | null; lieu: string | null; distanceKm: number | null;
        nbParticipants: number; participantsMax: number;
      }>) => {
        const scored = data
          .map((s) => ({ ...s, score: scoreSortie(s, sportNames, niveau) }))
          .filter((s) => s.score >= 3)  // au moins un sport en commun
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);
        setMatches(scored);
      })
      .catch(() => setMatches([]))
      .finally(() => setLoadingMatch(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResults]);

  // ── Answers ───────────────────────────────────────────────────────────────

  const currentStep = STEPS[step];

  function getAnswer(): string | SportKey[] {
    if (!currentStep) return [];
    switch (currentStep.id) {
      case "sports": return sports;
      case "goal":   return goal;
      case "niveau": return niveau;
      case "rythme": return rythme;
      default:       return "";
    }
  }

  function isSelected(value: string): boolean {
    const ans = getAnswer();
    if (Array.isArray(ans)) return ans.includes(value as SportKey);
    return ans === value;
  }

  function handleSelect(value: string) {
    if (!currentStep) return;
    if (currentStep.id === "sports") {
      setSports((prev) =>
        prev.includes(value as SportKey) ? prev.filter((s) => s !== value) : [...prev, value as SportKey]
      );
    } else if (currentStep.id === "goal")   setGoal(value);
    else if (currentStep.id === "niveau")   setNiveau(value);
    else if (currentStep.id === "rythme")   setRythme(value);
  }

  function canContinue(): boolean {
    if (!currentStep) return true;
    if (currentStep.id === "sports") return sports.length > 0;
    return !!getAnswer();
  }

  function transition(dir: "fwd" | "bck", cb: () => void) {
    if (animating) return;
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => { cb(); setAnimating(false); }, 180);
  }

  function goNext() {
    if (!canContinue() || animating) return;
    transition("fwd", () => setStep((i) => i + 1));
  }

  function goBack() {
    if (step === 0 || animating) return;
    transition("bck", () => setStep((i) => i - 1));
  }

  async function finish() {
    setSaving(true);

    const sportNames = sports.flatMap((k) => SPORT_TO_SORTIE[k] ?? []);
    const payload = {
      sports:         sports.join(","),
      goal,
      niveau,
      rythme,
      onboardingDone: "true",
    };

    // localStorage (fallback)
    localStorage.setItem("userPreferences", JSON.stringify({
      v: 4, sports, goal, niveau, rythme, sportNames,
    }));

    // Airtable
    if (user?.email) {
      await fetch("/api/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: user.email, ...payload }),
      });
      await refreshProfile();
    }

    setSaving(false);
    router.push("/?profil=configured");
  }

  function skip() {
    localStorage.setItem("userPreferences", JSON.stringify({ skipped: true }));
    router.push("/");
  }

  const slideClass = animating
    ? slideDir === "fwd" ? "opacity-0 translate-y-3" : "opacity-0 -translate-y-3"
    : "opacity-100 translate-y-0";

  const progress = isResults ? 100 : (step / STEPS.length) * 100;

  // ── Écran résultats ─────────────────────────────────────────────────────────
  if (isResults) {
    const sportNames = sports.flatMap((k) => SPORT_TO_SORTIE[k] ?? []);

    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-10">
        <div className={`w-full max-w-lg transition-all duration-200 ease-out ${slideClass}`}>

          {/* Header résultats */}
          <div className="text-center mb-6">
            <span className="text-5xl mb-3 block">🎯</span>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
              On a trouvé des sorties pour toi !
            </h1>
            <p className="text-slate-500 text-sm">
              Basé sur tes sports ({sportNames.join(", ")}) · {niveau}
            </p>
          </div>

          {/* Progress */}
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full w-full transition-all duration-500" />
          </div>

          {/* Sorties matchées */}
          <div className="flex flex-col gap-2.5 mb-6">
            {loadingMatch ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-white rounded-2xl border border-slate-100 shimmer" />
              ))
            ) : matches.length > 0 ? (
              matches.map((s) => {
                const c = SPORT_COLOR_MAP[s.sport] ?? "#64748b";
                const e = SPORT_EMOJI_MAP[s.sport] ?? "🏅";
                const pct = Math.min(100, ((s.nbParticipants ?? 0) / s.participantsMax) * 100);
                return (
                  <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-sm p-3 transition-all">
                    <span className="text-2xl flex-shrink-0">{e}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{s.titre}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {s.date ?? ""}{s.lieu ? ` · ${s.lieu}` : ""}
                        {s.distanceKm ? ` · ${s.distanceKm.toFixed(1)} km` : ""}
                      </p>
                      {/* mini progress */}
                      <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: c + "18", color: c }}>
                        {s.sport}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        👥 {s.nbParticipants}/{s.participantsMax}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-500 text-sm">Aucune sortie trouvée pour l&apos;instant</p>
                <p className="text-xs text-slate-400 mt-1">D&apos;autres seront proposées bientôt !</p>
              </div>
            )}
          </div>

          {/* Score pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-5">
            {sports.map((k) => {
              const names = SPORT_TO_SORTIE[k];
              return names.map((n) => (
                <span key={n} className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: (SPORT_COLOR_MAP[n] ?? "#64748b") + "18", color: SPORT_COLOR_MAP[n] ?? "#64748b" }}>
                  {SPORT_EMOJI_MAP[n] ?? "🏅"} {n}
                </span>
              ));
            })}
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
              📊 {niveau}
            </span>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-base shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
          >
            {saving ? "Enregistrement…" : "Voir toutes mes sorties →"}
          </button>
          <button type="button" onClick={() => setStep(STEPS.length - 1)}
            className="w-full text-center text-sm text-slate-400 hover:text-slate-600 py-2 mt-1">
            ← Modifier mes réponses
          </button>
        </div>
      </main>
    );
  }

  // ── Questionnaire ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-10">
      <div className={`w-full max-w-lg transition-all duration-200 ease-out ${slideClass}`}>

        {/* Badge re-visite */}
        {alreadyDone && step === 0 && (
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              ✏️ Modification de tes préférences sportives
            </span>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-5xl mb-3 block">{currentStep.emoji}</span>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug">
            {currentStep.question}
          </h1>
          {currentStep.hint && (
            <p className="text-slate-400 text-sm mt-1">{currentStep.hint}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-blue-600" : i < step ? "w-2 bg-blue-300" : "w-2 bg-slate-200"
            }`} />
          ))}
          <div className="w-2 h-1.5 rounded-full bg-slate-200" /> {/* results dot */}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {currentStep.options.map((opt) => (
            <OptionBtn
              key={opt.value}
              opt={opt}
              selected={isSelected(opt.value)}
              onClick={() => handleSelect(opt.value)}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-5 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97] transition-all"
              >
                ←
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue()}
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all active:scale-[0.98] shadow-md"
            >
              {step === STEPS.length - 1 ? "Voir mes sorties →" : "Continuer →"}
            </button>
          </div>
          <button type="button" onClick={skip}
            className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1">
            Passer l&apos;onboarding
          </button>
        </div>

      </div>
    </main>
  );
}
