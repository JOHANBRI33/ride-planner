"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Prefs = {
  goal: string;
  groupType: string;
  distance: string;
  sports: string[];
};

const STEPS = [
  {
    id: "goal",
    question: "Quel est ton objectif principal ?",
    emoji: "🎯",
    type: "single" as const,
    options: [
      { value: "performance", label: "Progresser & performer", emoji: "📈" },
      { value: "social",      label: "Rencontrer des gens",    emoji: "🤝" },
      { value: "fun",         label: "Bouger pour le plaisir", emoji: "😄" },
      { value: "health",      label: "Garder la forme",        emoji: "💪" },
    ],
  },
  {
    id: "groupType",
    question: "Tu préfères sortir avec…",
    emoji: "👥",
    type: "single" as const,
    options: [
      { value: "solo",   label: "Seul(e) mais en groupe", emoji: "🎧" },
      { value: "duo",    label: "Un binôme",               emoji: "👫" },
      { value: "small",  label: "Petit groupe (3–6)",      emoji: "🏃" },
      { value: "large",  label: "Grand groupe (7+)",       emoji: "🎉" },
    ],
  },
  {
    id: "distance",
    question: "Quel est ton niveau sportif ?",
    emoji: "📊",
    type: "single" as const,
    options: [
      { value: "debutant",      label: "Débutant — je reprends l'activité",     emoji: "🌱" },
      { value: "intermediaire", label: "Intermédiaire — je sors régulièrement", emoji: "🔥" },
      { value: "avance",        label: "Avancé — je m'entraîne sérieusement",   emoji: "⚡" },
      { value: "expert",        label: "Expert — je cherche des défis",          emoji: "🏆" },
    ],
  },
  {
    id: "sports",
    question: "Quels sports t'intéressent ?",
    emoji: "🏅",
    type: "multi" as const,
    options: [
      { value: "Course à pied", label: "Course à pied", emoji: "🏃" },
      { value: "Vélo",          label: "Vélo",          emoji: "🚴" },
      { value: "Randonnée",     label: "Randonnée",     emoji: "🥾" },
      { value: "Trail",         label: "Trail",         emoji: "⛰️" },
      { value: "Natation",      label: "Natation",      emoji: "🏊" },
      { value: "Triathlon",     label: "Triathlon",     emoji: "🏅" },
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>({ goal: "", groupType: "", distance: "", sports: [] });
  const [animating, setAnimating] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step) / STEPS.length) * 100;

  function canContinue() {
    if (current.type === "multi") return prefs.sports.length > 0;
    return !!(prefs as Record<string, unknown>)[current.id];
  }

  function selectSingle(value: string) {
    setPrefs((p) => ({ ...p, [current.id]: value }));
  }

  function toggleSport(value: string) {
    setPrefs((p) => ({
      ...p,
      sports: p.sports.includes(value)
        ? p.sports.filter((s) => s !== value)
        : [...p.sports, value],
    }));
  }

  function next() {
    if (!canContinue()) return;
    if (isLast) {
      localStorage.setItem("userPreferences", JSON.stringify(prefs));
      router.push("/");
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 180);
  }

  function skip() {
    localStorage.setItem("userPreferences", JSON.stringify({ skipped: true }));
    router.push("/");
  }

  const isSelected = (value: string) =>
    current.type === "multi"
      ? prefs.sports.includes(value)
      : (prefs as Record<string, string>)[current.id] === value;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-12">
      <div
        className={`w-full max-w-lg transition-all duration-200 ${animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl mb-4 block">{current.emoji}</span>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
            {current.question}
          </h1>
          {current.type === "multi" && (
            <p className="text-slate-400 text-sm mt-2">Plusieurs choix possibles</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Options */}
        <div className={`grid gap-3 ${current.options.length === 6 ? "grid-cols-2" : "grid-cols-1"}`}>
          {current.options.map((opt) => {
            const selected = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => current.type === "multi" ? toggleSport(opt.value) : selectSingle(opt.value)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 font-semibold text-left transition-all duration-150 active:scale-[0.98] ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                }`}
              >
                <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                <span className="text-sm leading-snug">{opt.label}</span>
                {selected && (
                  <span className="ml-auto text-blue-500 flex-shrink-0">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={next}
            disabled={!canContinue()}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all duration-200 active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            {isLast ? "Commencer 🚀" : "Continuer →"}
          </button>
          <button
            onClick={skip}
            className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Passer l&apos;onboarding
          </button>
        </div>
      </div>
    </main>
  );
}
