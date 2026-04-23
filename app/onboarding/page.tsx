"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useDropzone } from "react-dropzone";

// ─── Avatar definitions ───────────────────────────────────────────────────────
// URLs pointent vers des images de personnages connus (remplaçables par /avatars/xxx.png)

export const AVATARS = [
  { key: "marchand",    name: "Léon Marchand",        emoji: "🏊", url: "https://api.dicebear.com/9.x/bottts/svg?seed=leonmarchand" },
  { key: "beaugrand",   name: "C. Beaugrand",         emoji: "🏅", url: "https://api.dicebear.com/9.x/bottts/svg?seed=cassandrebeaugrand" },
  { key: "gressier",    name: "Jimmy Gressier",        emoji: "🏃", url: "https://api.dicebear.com/9.x/bottts/svg?seed=jimmygressier" },
  { key: "alaphilippe", name: "J. Alaphilippe",        emoji: "🚴", url: "https://api.dicebear.com/9.x/bottts/svg?seed=julianalaphilippe" },
  { key: "pinot",       name: "Thibaut Pinot",         emoji: "🚵", url: "https://api.dicebear.com/9.x/bottts/svg?seed=thibautpinot" },
  { key: "manaudou",    name: "F. Manaudou",           emoji: "🌊", url: "https://api.dicebear.com/9.x/bottts/svg?seed=florentmanaudou" },
  { key: "luis",        name: "Vincent Luis",          emoji: "⚡", url: "https://api.dicebear.com/9.x/bottts/svg?seed=vincentluis" },
  { key: "dhaene",      name: "François D'Haene",      emoji: "🏔️", url: "https://api.dicebear.com/9.x/bottts/svg?seed=francoisdhaene" },
  { key: "bonnet",      name: "Charlotte Bonnet",      emoji: "💧", url: "https://api.dicebear.com/9.x/bottts/svg?seed=charlottebonnet" },
  { key: "thevenard",   name: "X. Thevenard",          emoji: "🥾", url: "https://api.dicebear.com/9.x/bottts/svg?seed=xavierthevenard" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type SportKey = "cycling" | "running" | "hiking" | "swimming" | "other";

type Option = { value: string; label: string; emoji: string };

type StepDef = {
  id: string;
  sport: SportKey | null;
  question: string;
  emoji: string;
  hint?: string;
  type: "single" | "multi" | "text" | "avatar";
  options: Option[];
  profilePath: string;
  optional?: boolean;
};

type UserProfile = {
  v: 3;
  sexe: string;
  ageRange: string;
  sports: SportKey[];
  global: Record<string, string>;
  cycling: Record<string, string>;
  running: Record<string, string>;
  hiking: Record<string, string>;
  swimming: Record<string, string>;
  other: Record<string, string>;
  description: string;
  avatarKey: string;
  photoUrl: string;
};

// ─── Step definitions ─────────────────────────────────────────────────────────

const SEX_STEP: StepDef = {
  id: "sexe",
  sport: null,
  question: "Tu es ?",
  emoji: "👤",
  type: "single",
  profilePath: "global.sexe",
  options: [
    { value: "homme",     label: "Homme",       emoji: "👨" },
    { value: "femme",     label: "Femme",        emoji: "👩" },
    { value: "nonbinaire",label: "Non binaire",  emoji: "🧑" },
  ],
};

const AGE_STEP: StepDef = {
  id: "ageRange",
  sport: null,
  question: "Ta tranche d'âge ?",
  emoji: "🎂",
  type: "single",
  profilePath: "global.ageRange",
  options: [
    { value: "moins20", label: "Moins de 20 ans", emoji: "🌱" },
    { value: "20-30",   label: "20 – 30 ans",     emoji: "⚡" },
    { value: "30-40",   label: "30 – 40 ans",     emoji: "🔥" },
    { value: "40-50",   label: "40 – 50 ans",     emoji: "💪" },
    { value: "50-60",   label: "50 – 60 ans",     emoji: "🏅" },
    { value: "plus60",  label: "Plus de 60 ans",  emoji: "🌟" },
  ],
};

const SPORTS_STEP: StepDef = {
  id: "sports",
  sport: null,
  question: "Quels sports pratiques-tu ?",
  emoji: "🏅",
  hint: "Plusieurs choix possibles",
  type: "multi",
  profilePath: "global.sports",
  options: [
    { value: "cycling", label: "Vélo",              emoji: "🚴" },
    { value: "running", label: "Course à pied",     emoji: "🏃" },
    { value: "hiking",  label: "Randonnée / Trail",  emoji: "🥾" },
    { value: "swimming",label: "Natation",           emoji: "🏊" },
    { value: "other",   label: "Autre sport",        emoji: "🏅" },
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

const DESCRIPTION_STEP: StepDef = {
  id: "description",
  sport: null,
  question: "Décris le sportif que tu es",
  emoji: "✍️",
  hint: "Facultatif — tes habitudes, ton style, ce qui te motive…",
  type: "text",
  profilePath: "global.description",
  optional: true,
  options: [],
};

const AVATAR_STEP: StepDef = {
  id: "avatar",
  sport: null,
  question: "Choisis ton avatar ou ajoute ta photo",
  emoji: "🖼️",
  hint: "Facultatif",
  type: "avatar",
  profilePath: "global.avatar",
  optional: true,
  options: [],
};

const SPORT_STEPS: Record<SportKey, StepDef[]> = {
  cycling: [
    {
      id: "cycling.level", sport: "cycling",
      question: "Quel est ton niveau à vélo ?", emoji: "🚴",
      type: "single", profilePath: "cycling.level",
      options: [
        { value: "beginner",     label: "Débutant — je découvre",             emoji: "🌱" },
        { value: "intermediate", label: "Intermédiaire — sorties régulières", emoji: "🔥" },
        { value: "advanced",     label: "Avancé — entraînement sérieux",      emoji: "⚡" },
        { value: "expert",       label: "Expert / compétition",               emoji: "🏆" },
      ],
    },
    {
      id: "cycling.bikeType", sport: "cycling",
      question: "Quel type de vélo utilises-tu ?", emoji: "🚲",
      type: "single", profilePath: "cycling.bikeType",
      options: [
        { value: "road",     label: "Route",            emoji: "🛣️" },
        { value: "gravel",   label: "Gravel",           emoji: "🌾" },
        { value: "mtb",      label: "VTT",              emoji: "⛰️" },
        { value: "electric", label: "Électrique / VAE", emoji: "⚡" },
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
        { value: "road",  label: "Route / asphalte",   emoji: "🛣️" },
        { value: "trail", label: "Trail / montagne",   emoji: "⛰️" },
        { value: "mixed", label: "Mixte",              emoji: "🌿" },
        { value: "track", label: "Piste d'athlétisme", emoji: "🏟️" },
      ],
    },
    {
      id: "running.distance", sport: "running",
      question: "Quelle distance cours-tu habituellement ?", emoji: "📏",
      type: "single", profilePath: "running.distance",
      options: [
        { value: "short",  label: "Moins de 5 km",            emoji: "🌱" },
        { value: "medium", label: "5 à 10 km",                emoji: "🏃" },
        { value: "long",   label: "10 à 21 km (semi-marathon)",emoji: "🔥" },
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
        { value: "short", label: "Moins de 2h",           emoji: "☕" },
        { value: "half",  label: "2 à 4h — demi-journée", emoji: "🌤️" },
        { value: "day",   label: "Journée complète",       emoji: "☀️" },
        { value: "multi", label: "Multi-jours / bivouac",  emoji: "⛺" },
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
        { value: "beginner",     label: "Débutant — je reprends",             emoji: "🌱" },
        { value: "intermediate", label: "Intermédiaire — natation régulière", emoji: "🔥" },
        { value: "advanced",     label: "Avancé — compétition / masters",     emoji: "🏆" },
        { value: "openwater",    label: "Eau libre / triathlon",              emoji: "🌊" },
      ],
    },
    {
      id: "swimming.distance", sport: "swimming",
      question: "Quelle distance nages-tu par séance ?", emoji: "📏",
      type: "single", profilePath: "swimming.distance",
      options: [
        { value: "short",  label: "Moins de 1 km", emoji: "🌱" },
        { value: "medium", label: "1 à 2 km",      emoji: "🏊" },
        { value: "long",   label: "2 à 3 km",      emoji: "🔥" },
        { value: "ultra",  label: "Plus de 3 km",  emoji: "🏆" },
      ],
    },
  ],
  other: [],
};

// ─── Step queue builder ───────────────────────────────────────────────────────

const MAX_SPORT_STEPS = 5;

function buildActiveSteps(selectedSports: SportKey[]): StepDef[] {
  const result: StepDef[] = [SEX_STEP, AGE_STEP, SPORTS_STEP];

  if (selectedSports.length > 0) {
    let budget = MAX_SPORT_STEPS;
    selectedSports.forEach((sport, i) => {
      if (budget <= 0) return;
      const sportSteps = SPORT_STEPS[sport] ?? [];
      const remaining = selectedSports.length - i;
      const quota = i === 0 && remaining > 1 ? Math.ceil(budget / 2) : Math.ceil(budget / remaining);
      const count = Math.min(quota, sportSteps.length, budget);
      result.push(...sportSteps.slice(0, count));
      budget -= count;
    });
  }

  result.push(GOAL_STEP, DESCRIPTION_STEP, AVATAR_STEP);
  return result;
}

// ─── Profile serializer ───────────────────────────────────────────────────────

function buildProfile(
  selectedSports: SportKey[],
  answers: Record<string, string | string[]>,
  steps: StepDef[],
  description: string,
  avatarKey: string,
  photoUrl: string,
): UserProfile {
  const profile: UserProfile = {
    v: 3, sexe: answers["sexe"] as string ?? "",
    ageRange: answers["ageRange"] as string ?? "",
    sports: selectedSports,
    global: {}, cycling: {}, running: {}, hiking: {}, swimming: {}, other: {},
    description, avatarKey, photoUrl,
  };

  for (const step of steps) {
    const answer = answers[step.id];
    if (!answer || step.type === "text" || step.type === "avatar") continue;
    const [ns, field] = step.profilePath.split(".") as [keyof UserProfile, string];
    if (ns === "global") {
      profile.global[field] = answer as string;
    } else if (ns in profile) {
      (profile[ns] as Record<string, unknown>)[field] = answer;
    }
  }
  return profile;
}

// ─── Sport helpers ────────────────────────────────────────────────────────────

const SPORT_LABEL: Record<SportKey, string> = {
  cycling: "Vélo", running: "Running", hiking: "Rando", swimming: "Natation", other: "Autre",
};
const SPORT_COLOR: Record<SportKey, string> = {
  cycling:  "bg-orange-100 text-orange-700 border-orange-200",
  running:  "bg-blue-100 text-blue-700 border-blue-200",
  hiking:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  swimming: "bg-cyan-100 text-cyan-700 border-cyan-200",
  other:    "bg-slate-100 text-slate-600 border-slate-200",
};

// ─── Dropzone sub-component ───────────────────────────────────────────────────

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function PhotoDropzone({ onPhoto }: { onPhoto: (dataUrl: string) => void }) {
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    compressImage(file).then(onPhoto);
  }, [onPhoto]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "image/*": [] }, maxFiles: 1, maxSize: 2 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
        isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-3xl mb-2">📸</div>
      <p className="text-sm font-semibold text-slate-600">
        {isDragActive ? "Dépose ici…" : "Glisse ta photo ou clique pour choisir"}
      </p>
      <p className="text-xs text-slate-400 mt-1">JPG, PNG — max 2 Mo</p>
    </div>
  );
}

// ─── Avatar step sub-component ────────────────────────────────────────────────

function AvatarStep({
  selectedAvatar, photoUrl,
  onAvatar, onPhoto, onClear,
}: {
  selectedAvatar: string; photoUrl: string;
  onAvatar: (key: string) => void; onPhoto: (url: string) => void; onClear: () => void;
}) {
  const [tab, setTab] = useState<"avatar" | "photo">("avatar");

  const preview = photoUrl || (selectedAvatar ? AVATARS.find(a => a.key === selectedAvatar)?.url : null);

  return (
    <div className="space-y-4">
      {/* Preview */}
      {preview && (
        <div className="flex flex-col items-center gap-2">
          <img
            src={preview} alt="Aperçu"
            className="w-20 h-20 rounded-full object-cover border-4 border-blue-500 shadow-lg"
          />
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
            Supprimer
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setTab("avatar")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "avatar" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          🎭 Choisir un avatar
        </button>
        <button
          type="button"
          onClick={() => setTab("photo")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "photo" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          📷 Ma photo
        </button>
      </div>

      {tab === "avatar" && (
        <div className="grid grid-cols-5 gap-2">
          {AVATARS.map((av) => (
            <button
              key={av.key}
              type="button"
              onClick={() => { onAvatar(av.key); onPhoto(""); }}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all duration-150 ${
                selectedAvatar === av.key && !photoUrl
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <img
                src={av.url}
                alt={av.name}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/bottts/svg?seed=${av.key}`; }}
              />
              <span className="text-[10px] font-semibold text-slate-600 truncate w-full text-center">{av.name}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "photo" && (
        <PhotoDropzone onPhoto={(url) => { onPhoto(url); onAvatar(""); }} />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();

  const [welcome, setWelcome]               = useState(true); // écran de bienvenue avant le questionnaire
  const [stepIndex, setStepIndex]           = useState(0);
  const [animating, setAnimating]           = useState(false);
  const [slideDir, setSlideDir]             = useState<"forward" | "back">("forward");
  const [selectedSports, setSelectedSports] = useState<SportKey[]>([]);
  const [answers, setAnswers]               = useState<Record<string, string | string[]>>({});
  const [activeSteps, setActiveSteps]       = useState<StepDef[]>([SEX_STEP, AGE_STEP, SPORTS_STEP, GOAL_STEP, DESCRIPTION_STEP, AVATAR_STEP]);
  const [description, setDescription]       = useState("");
  const [avatarKey, setAvatarKey]           = useState("");
  const [photoUrl, setPhotoUrl]             = useState("");
  const [saving, setSaving]                 = useState(false);

  const currentStep = activeSteps[stepIndex];
  const totalSteps  = activeSteps.length;
  const isLast      = stepIndex === totalSteps - 1;
  const progress    = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;
  const currentAnswer = answers[currentStep.id];

  function isSelected(value: string): boolean {
    if (currentStep.id === "sports") return selectedSports.includes(value as SportKey);
    if (currentStep.type === "multi") return Array.isArray(currentAnswer) && currentAnswer.includes(value);
    return currentAnswer === value;
  }

  function handleSelect(value: string) {
    if (currentStep.id === "sports") {
      setSelectedSports((prev) =>
        prev.includes(value as SportKey) ? prev.filter((s) => s !== value) : [...prev, value as SportKey]
      );
      return;
    }
    if (currentStep.type === "multi") {
      setAnswers((prev) => {
        const cur = (prev[currentStep.id] as string[] | undefined) ?? [];
        return { ...prev, [currentStep.id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
    }
  }

  function canContinue(): boolean {
    if (currentStep.optional) return true;
    if (currentStep.id === "sports") return selectedSports.length > 0;
    if (currentStep.type === "multi") return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    if (currentStep.type === "text" || currentStep.type === "avatar") return true;
    return !!currentAnswer;
  }

  function transition(dir: "forward" | "back", callback: () => void) {
    if (animating) return;
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => { callback(); setAnimating(false); }, 200);
  }

  async function goNext() {
    if (!canContinue() || animating) return;

    if (currentStep.id === "sports") {
      const newSteps = buildActiveSteps(selectedSports);
      setActiveSteps(newSteps);
    }

    if (isLast) {
      await saveProfile();
      return;
    }

    transition("forward", () => setStepIndex((i) => i + 1));
  }

  async function saveProfile() {
    setSaving(true);
    const profile = buildProfile(selectedSports, answers, activeSteps, description, avatarKey, photoUrl);

    // Save to localStorage
    localStorage.setItem("userPreferences", JSON.stringify(profile));

    // Save to Airtable
    if (user?.email) {
      const payload = {
        email: user.email,
        sexe: profile.sexe,
        ageRange: profile.ageRange,
        sports: profile.sports.join(","),
        goal: profile.global.goal ?? "",
        description: profile.description,
        avatarKey: profile.avatarKey,
        photoUrl: profile.photoUrl,
        onboardingDone: "true",
        cycling_level: profile.cycling.level ?? "",
        cycling_bikeType: profile.cycling.bikeType ?? "",
        cycling_mechanicalSkill: profile.cycling.mechanicalSkill ?? "",
        running_pace: profile.running.pace ?? "",
        running_terrain: profile.running.terrain ?? "",
        running_distance: profile.running.distance ?? "",
        hiking_duration: profile.hiking.duration ?? "",
        hiking_elevationGain: profile.hiking.elevationGain ?? "",
        hiking_groupPref: profile.hiking.groupPref ?? "",
        swimming_level: profile.swimming.level ?? "",
        swimming_distance: profile.swimming.distance ?? "",
      };
      await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }

    setSaving(false);
    router.push("/");
  }

  function goBack() {
    if (stepIndex === 0 || animating) return;
    transition("back", () => setStepIndex((i) => i - 1));
  }

  function skip() {
    localStorage.setItem("userPreferences", JSON.stringify({ skipped: true }));
    router.push("/");
  }

  const slideClass = animating
    ? slideDir === "forward" ? "opacity-0 translate-y-3" : "opacity-0 -translate-y-3"
    : "opacity-100 translate-y-0";

  // ── Écran de bienvenue ─────────────────────────────────────────────────────
  if (welcome) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center flex flex-col items-center gap-6">
          <span className="text-6xl">🏅</span>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-snug mb-3">
              On t&apos;aide à trouver<br />les bonnes sorties
            </h1>
            <p className="text-slate-500 text-base leading-relaxed max-w-sm mx-auto">
              Réponds à quelques questions pour te proposer des partenaires adaptés à ton niveau et tes sports.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => setWelcome(false)}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              Commencer →
            </button>
            <button
              onClick={skip}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors py-2"
            >
              Passer pour l&apos;instant
            </button>
          </div>
          <div className="flex gap-6 text-center text-xs text-slate-400 mt-2">
            <span>⏱️ 2 minutes</span>
            <span>🎯 Résultats personnalisés</span>
            <span>✏️ Modifiable</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-10">
      <div className={`w-full max-w-lg transition-all duration-200 ease-out ${slideClass}`}>

        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-5xl mb-3 block">{currentStep.emoji}</span>
          <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
              {stepIndex + 1} / {totalSteps}
            </span>
            {currentStep.sport && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${SPORT_COLOR[currentStep.sport]}`}>
                {SPORT_LABEL[currentStep.sport]}
              </span>
            )}
            {currentStep.optional && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                Facultatif
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

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {activeSteps.map((s, i) => (
            <div key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === stepIndex ? "w-6 bg-blue-600" : i < stepIndex ? "w-2 bg-blue-300" : "w-2 bg-slate-200"
            }`} />
          ))}
        </div>

        {/* Step content */}
        {currentStep.type === "text" ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex : je cours 3 fois par semaine, je cherche des partenaires de sortie longue le week-end…"
            rows={4}
            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none resize-none text-sm text-slate-700 bg-white transition-colors duration-150"
          />
        ) : currentStep.type === "avatar" ? (
          <AvatarStep
            selectedAvatar={avatarKey} photoUrl={photoUrl}
            onAvatar={setAvatarKey} onPhoto={setPhotoUrl}
            onClear={() => { setAvatarKey(""); setPhotoUrl(""); }}
          />
        ) : (
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
                  {selected && <span className="ml-auto text-blue-500 font-bold flex-shrink-0 text-base">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* CTA buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-5 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97] transition-all duration-200"
              >
                ←
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue() || saving}
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-all duration-200 active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              {saving ? "Enregistrement…" : isLast ? "Commencer 🚀" : "Continuer →"}
            </button>
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Passer l&apos;onboarding
          </button>
        </div>

        {/* Sports preview */}
        {stepIndex > 2 && selectedSports.length > 0 && (
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
