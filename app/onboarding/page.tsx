"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type SportKey = "cycling" | "running" | "hiking" | "swimming" | "other";

type Option = { value: string; label: string; emoji: string };

type StepDef = {
  id: string;
  sport: SportKey | null; // null = always shown
  question: string;
  emoji: string;
  hint?: string;
  type: "single" | "multi";
  options: Option[];
  profilePath: string; // e.g. "global.goal" or "cycling.level"
};

type UserProfile = {
  v: 2;
  sports: SportKey[];
  global: Record<string, string>;
  cycling: Record<string, string>;
  running: Record<string, string>;
  hiking: Record<string, string>;
  swimming: Record<string, string>;
  other: Record<string, string>;
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const SPORTS_STEP: StepDef = {
  id: "sports",
  sport: null,
  question: "Quels sports pratiques-tu ?",
  emoji: "🏅",
  hint: "Plusieurs choix possibles",
  type: "multi",
  profilePath: "global.sports",
  options: [
    { value: "cycling", label: "Vélo",             emoji: "🚴" },
    { value: "running", label: "Course à pied",    emoji: "🏃" },
    { value: "hiking",  label: "Randonnée / Trail", emoji: "🥾" },
    { value: "swimming",label: "Natation",          emoji: "🏊" },
    { value: "other",   label: "Autre sport",       emoji: "🏅" },
  ],
};

const GOAL_STEP: StepDef = {
  id: "goal",
  sport: null,
  question: "Quel est ton objectif principal ?",
  emoji: "🎯",
  type: "single",
  profilePath: "global.goal",
  options: [
    { value: "performance", label: "Progresser & performer",  emoji: "📈" },
    { value: "social",      label: "Rencontrer des sportifs", emoji: "🤝" },
    { value: "fun",         label: "Bouger pour le plaisir",  emoji: "😄" },
    { value: "health",      label: "Garder la forme",         emoji: "💪" },
  ],
};

const SPORT_STEPS: Record<SportKey, StepDef[]> = {
  cycling: [
    {
      id: "cycling.level", sport: "cycling",
      question: "Quel est ton niveau à vélo ?", emoji: "🚴",
      type: "single", profilePath: "cycling.level",
      options: [
        { value: "beginner",     label: "Débutant — je découvre",               emoji: "🌱" },
        { value: "intermediate", label: "Intermédiaire — sorties régulières",   emoji: "🔥" },
        { value: "advanced",     label: "Avancé — entraînement sérieux",        emoji: "⚡" },
        { value: "expert",       label: "Expert / compétition",                 emoji: "🏆" },
      ],
    },
    {
      id: "cycling.bikeType", sport: "cycling",
      question: "Quel type de vélo utilises-tu ?", emoji: "🚲",
      type: "single", profilePath: "cycling.bikeType",
      options: [
        { value: "road",     label: "Route",             emoji: "🛣️" },
        { value: "gravel",   label: "Gravel",            emoji: "🌾" },
        { value: "mtb",      label: "VTT",               emoji: "⛰️" },
        { value: "electric", label: "Électrique / VAE",  emoji: "⚡" },
      ],
    },
    {
      id: "cycling.cleats", sport: "cycling",
      question: "Utilises-tu des prolongateurs (position triathlon / chrono) ?", emoji: "🏁",
      type: "single", profilePath: "cycling.cleats",
      options: [
        { value: "yes", label: "Oui — position tri / aero", emoji: "✅" },
        { value: "no",  label: "Non — position standard",   emoji: "🚴" },
      ],
    },
    {
      id: "cycling.mechanicalSkill", sport: "cycling",
      question: "Comment te débrouilles-tu mécaniquement ?", emoji: "🔧",
      type: "single", profilePath: "cycling.mechanicalSkill",
      options: [
        { value: "autonomous", label: "Autonome — je répare tout",          emoji: "🛠️" },
        { value: "basics",     label: "Je gère les basiques (crevaison…)", emoji: "🔧" },
        { value: "dependent",  label: "Je dépends d'un atelier",            emoji: "🏪" },
      ],
    },
  ],
  running: [
    {
      id: "running.pace", sport: "running",
      question: "Quelle est ton allure de course habituelle ?", emoji: "⏱️",
      type: "single", profilePath: "running.pace",
      options: [
        { value: "sub5",  label: "< 5 min/km — allure rapide",       emoji: "⚡" },
        { value: "5to6",  label: "5 à 6 min/km",                     emoji: "🔥" },
        { value: "6to7",  label: "6 à 7 min/km",                     emoji: "🏃" },
        { value: "7plus", label: "> 7 min/km — je prends mon temps", emoji: "🚶" },
      ],
    },
    {
      id: "running.terrain", sport: "running",
      question: "Sur quel terrain cours-tu principalement ?", emoji: "🗺️",
      type: "single", profilePath: "running.terrain",
      options: [
        { value: "road",   label: "Route / asphalte",    emoji: "🛣️" },
        { value: "trail",  label: "Trail / montagne",    emoji: "⛰️" },
        { value: "mixed",  label: "Mixte",               emoji: "🌿" },
        { value: "track",  label: "Piste d'athlétisme",  emoji: "🏟️" },
      ],
    },
    {
      id: "running.distance", sport: "running",
      question: "Quelle distance cours-tu habituellement ?", emoji: "📏",
      type: "single", profilePath: "running.distance",
      options: [
        { value: "short",  label: "Moins de 5 km",           emoji: "🌱" },
        { value: "medium", label: "5 à 10 km",               emoji: "🏃" },
        { value: "long",   label: "10 à 21 km (semi-marathon)", emoji: "🔥" },
        { value: "ultra",  label: "Plus de 21 km (marathon+)", emoji: "🏆" },
      ],
    },
  ],
  hiking: [
    {
      id: "hiking.duration", sport: "hiking",
      question: "Combien de temps durent tes randonnées habituelles ?", emoji: "⏰",
      type: "single", profilePath: "hiking.duration",
      options: [
        { value: "short", label: "Moins de 2h",         emoji: "☕" },
        { value: "half",  label: "2 à 4h — demi-journée", emoji: "🌤️" },
        { value: "day",   label: "Journée complète",    emoji: "☀️" },
        { value: "multi", label: "Multi-jours / bivouac", emoji: "⛺" },
      ],
    },
    {
      id: "hiking.elevationGain", sport: "hiking",
      question: "Quel dénivelé positif acceptes-tu par sortie ?", emoji: "⛰️",
      type: "single", profilePath: "hiking.elevationGain",
      options: [
        { value: "flat",     label: "Terrain plat — < 200 m D+", emoji: "🌾" },
        { value: "moderate", label: "200 à 500 m D+",            emoji: "🌿" },
        { value: "steep",    label: "500 à 1000 m D+",           emoji: "⛰️" },
        { value: "extreme",  label: "Plus de 1000 m D+",         emoji: "🏔️" },
      ],
    },
    {
      id: "hiking.groupPref", sport: "hiking",
      question: "Tu préfères randonner comment ?", emoji: "👥",
      type: "single", profilePath: "hiking.groupPref",
      options: [
        { value: "solo",  label: "Solo — je trace ma route", emoji: "🎧" },
        { value: "duo",   label: "En duo",                   emoji: "👫" },
        { value: "small", label: "Petit groupe (3–6)",       emoji: "🏃" },
        { value: "large", label: "Grand groupe (7+)",        emoji: "🎉" },
      ],
    },
  ],
  swimming: [
    {
      id: "swimming.level", sport: "swimming",
      question: "Quel est ton niveau en natation ?", emoji: "🏊",
      type: "single", profilePath: "swimming.level",
      options: [
        { value: "beginner",     label: "Débutant — je reprends",               emoji: "🌱" },
        { value: "intermediate", label: "Intermédiaire — natation régulière",   emoji: "🔥" },
        { value: "advanced",     label: "Avancé — compétition / masters",       emoji: "🏆" },
        { value: "openwater",    label: "Eau libre / triathlon",                emoji: "🌊" },
      ],
    },
    {
      id: "swimming.distance", sport: "swimming",
      question: "Quelle distance nages-tu par séance ?", emoji: "📏",
      type: "single", profilePath: "swimming.distance",
      options: [
        { value: "short",  label: "Moins de 1 km",   emoji: "🌱" },
        { value: "medium", label: "1 à 2 km",        emoji: "🏊" },
        { value: "long",   label: "2 à 3 km",        emoji: "🔥" },
        { value: "ultra",  label: "Plus de 3 km",    emoji: "🏆" },
      ],
    },
  ],
  other: [],
};

// ─── Step queue builder ───────────────────────────────────────────────────────

const MAX_SPORT_STEPS = 5; // max questions after sports selection

function buildActiveSteps(selectedSports: SportKey[]): StepDef[] {
  const result: StepDef[] = [SPORTS_STEP];

  if (selectedSports.length > 0) {
    let budget = MAX_SPORT_STEPS;

    selectedSports.forEach((sport, i) => {
      if (budget <= 0) return;
      const sportSteps = SPORT_STEPS[sport] ?? [];
      // First sport gets a bigger share
      const remaining = selectedSports.length - i;
      const quota = i === 0 && remaining > 1
        ? Math.ceil(budget / 2)
        : Math.ceil(budget / remaining);
      const count = Math.min(quota, sportSteps.length, budget);
      result.push(...sportSteps.slice(0, count));
      budget -= count;
    });
  }

  result.push(GOAL_STEP);
  return result;
}

// ─── Profile serializer ───────────────────────────────────────────────────────

function buildProfile(
  selectedSports: SportKey[],
  answers: Record<string, string | string[]>,
  steps: StepDef[],
): UserProfile {
  const profile: UserProfile = {
    v: 2, sports: selectedSports,
    global: {}, cycling: {}, running: {}, hiking: {}, swimming: {}, other: {},
  };

  for (const step of steps) {
    const answer = answers[step.id];
    if (!answer) continue;
    const [ns, field] = step.profilePath.split(".") as [keyof UserProfile, string];
    if (ns === "global") {
      profile.global[field] = answer as string;
    } else if (ns in profile) {
      (profile[ns] as Record<string, unknown>)[field] = answer;
    }
  }

  return profile;
}

// ─── Sport labels ─────────────────────────────────────────────────────────────

const SPORT_LABEL: Record<SportKey, string> = {
  cycling: "Vélo", running: "Running", hiking: "Rando", swimming: "Natation", other: "Autre",
};
const SPORT_COLOR: Record<SportKey, string> = {
  cycling: "bg-orange-100 text-orange-700 border-orange-200",
  running: "bg-blue-100 text-blue-700 border-blue-200",
  hiking:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  swimming:"bg-cyan-100 text-cyan-700 border-cyan-200",
  other:   "bg-slate-100 text-slate-600 border-slate-200",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [stepIndex, setStepIndex]       = useState(0);
  const [animating, setAnimating]       = useState(false);
  const [slideDir, setSlideDir]         = useState<"forward" | "back">("forward");
  const [selectedSports, setSelectedSports] = useState<SportKey[]>([]);
  const [answers, setAnswers]           = useState<Record<string, string | string[]>>({});
  const [activeSteps, setActiveSteps]   = useState<StepDef[]>([SPORTS_STEP, GOAL_STEP]);

  const currentStep = activeSteps[stepIndex];
  const totalSteps  = activeSteps.length;
  const isLast      = stepIndex === totalSteps - 1;
  const progress    = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;

  const currentAnswer = answers[currentStep.id];

  // ── Selection logic ─────────────────────────────────────────────────────────

  function isSelected(value: string): boolean {
    if (currentStep.id === "sports") return selectedSports.includes(value as SportKey);
    if (currentStep.type === "multi") return Array.isArray(currentAnswer) && currentAnswer.includes(value);
    return currentAnswer === value;
  }

  function handleSelect(value: string) {
    if (currentStep.id === "sports") {
      setSelectedSports((prev) =>
        prev.includes(value as SportKey)
          ? prev.filter((s) => s !== value)
          : [...prev, value as SportKey],
      );
      return;
    }
    if (currentStep.type === "multi") {
      setAnswers((prev) => {
        const cur = (prev[currentStep.id] as string[] | undefined) ?? [];
        return {
          ...prev,
          [currentStep.id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
        };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function canContinue(): boolean {
    if (currentStep.id === "sports") return selectedSports.length > 0;
    if (currentStep.type === "multi") return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    return !!currentAnswer;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function transition(dir: "forward" | "back", callback: () => void) {
    if (animating) return;
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => { callback(); setAnimating(false); }, 200);
  }

  function goNext() {
    if (!canContinue() || animating) return;

    // After sports selection: rebuild the step queue
    if (currentStep.id === "sports") {
      const newSteps = buildActiveSteps(selectedSports);
      setActiveSteps(newSteps);
    }

    if (isLast) {
      const profile = buildProfile(selectedSports, answers, activeSteps);
      localStorage.setItem("userPreferences", JSON.stringify(profile));
      router.push("/");
      return;
    }

    transition("forward", () => setStepIndex((i) => i + 1));
  }

  function goBack() {
    if (stepIndex === 0 || animating) return;
    transition("back", () => setStepIndex((i) => i - 1));
  }

  function skip() {
    localStorage.setItem("userPreferences", JSON.stringify({ skipped: true }));
    router.push("/");
  }

  // ── Animation classes ───────────────────────────────────────────────────────

  const slideClass = animating
    ? slideDir === "forward"
      ? "opacity-0 translate-y-3"
      : "opacity-0 -translate-y-3"
    : "opacity-100 translate-y-0";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-10">
      <div className={`w-full max-w-lg transition-all duration-200 ease-out ${slideClass}`}>

        {/* ── Header ── */}
        <div className="text-center mb-6">
          <span className="text-5xl mb-3 block">{currentStep.emoji}</span>

          {/* Step counter + sport tags */}
          <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
              {stepIndex + 1} / {totalSteps}
            </span>
            {currentStep.sport && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${SPORT_COLOR[currentStep.sport]}`}>
                {SPORT_LABEL[currentStep.sport]}
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug">
            {currentStep.question}
          </h1>
          {currentStep.hint && (
            <p className="text-slate-400 text-sm mt-1.5">{currentStep.hint}</p>
          )}
        </div>

        {/* ── Progress bar ── */}
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Step pills (mini nav dots) ── */}
        <div className="flex justify-center gap-1.5 mb-6">
          {activeSteps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? "w-6 bg-blue-600"
                  : i < stepIndex
                  ? "w-2 bg-blue-300"
                  : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* ── Options ── */}
        <div className={`grid gap-2.5 ${currentStep.options.length >= 5 ? "grid-cols-2" : "grid-cols-1"}`}>
          {currentStep.options.map((opt) => {
            const selected = isSelected(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border-2 font-semibold text-left transition-all duration-150 active:scale-[0.98] ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                }`}
              >
                <span className="text-2xl flex-shrink-0 leading-none">{opt.emoji}</span>
                <span className="text-sm leading-snug">{opt.label}</span>
                {selected && (
                  <span className="ml-auto text-blue-500 font-bold flex-shrink-0 text-base">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── CTA buttons ── */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-3">
            {/* Back button */}
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-5 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97] transition-all duration-200"
              >
                ←
              </button>
            )}

            {/* Continue / Finish */}
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue()}
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all duration-200 active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              {isLast ? "Commencer 🚀" : "Continuer →"}
            </button>
          </div>

          {/* Skip */}
          <button
            type="button"
            onClick={skip}
            className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Passer l&apos;onboarding
          </button>
        </div>

        {/* ── Preview sports sélectionnés (visible depuis l'étape 2+) ── */}
        {stepIndex > 0 && selectedSports.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5 justify-center">
            {selectedSports.map((s) => (
              <span key={s} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${SPORT_COLOR[s]}`}>
                {SPORT_LABEL[s]}
              </span>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
