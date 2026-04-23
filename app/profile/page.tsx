"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useDropzone } from "react-dropzone";
import { AVATARS } from "@/app/onboarding/page";

const ADMIN_EMAIL = "bridey.johan@neuf.fr";

const FIELD_LABELS: Record<string, string> = {
  sexe: "Genre",
  ageRange: "Tranche d'âge",
  sports: "Sports pratiqués",
  goal: "Objectif principal",
  description: "Le sportif que tu es",
  cycling_level: "Niveau vélo",
  cycling_bikeType: "Type de vélo",
  cycling_mechanicalSkill: "Mécanique vélo",
  running_pace: "Allure course",
  running_terrain: "Terrain course",
  running_distance: "Distance course",
  hiking_duration: "Durée rando",
  hiking_elevationGain: "Dénivelé rando",
  hiking_groupPref: "Préférence groupe rando",
  swimming_level: "Niveau natation",
  swimming_distance: "Distance natation",
};

const DISPLAY_VALUES: Record<string, Record<string, string>> = {
  sexe: { homme: "Homme", femme: "Femme", nonbinaire: "Non binaire" },
  ageRange: { moins20: "Moins de 20 ans", "20-30": "20 – 30 ans", "30-40": "30 – 40 ans", "40-50": "40 – 50 ans", "50-60": "50 – 60 ans", plus60: "Plus de 60 ans" },
  goal: { performance: "Progresser & performer", social: "Rencontrer des sportifs", fun: "Bouger pour le plaisir", health: "Garder la forme" },
  cycling_level: { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé", expert: "Expert" },
  cycling_bikeType: { road: "Route", gravel: "Gravel", mtb: "VTT", electric: "Électrique / VAE" },
  cycling_mechanicalSkill: { autonomous: "Autonome", basics: "Basiques", dependent: "Dépend d'un atelier" },
  running_pace: { sub5: "< 5 min/km", "5to6": "5 à 6 min/km", "6to7": "6 à 7 min/km", "7plus": "> 7 min/km" },
  running_terrain: { road: "Route", trail: "Trail", mixed: "Mixte", track: "Piste" },
  running_distance: { short: "< 5 km", medium: "5 à 10 km", long: "10 à 21 km", ultra: "> 21 km" },
  hiking_duration: { short: "< 2h", half: "Demi-journée", day: "Journée", multi: "Multi-jours" },
  hiking_elevationGain: { flat: "< 200 m D+", moderate: "200–500 m D+", steep: "500–1000 m D+", extreme: "> 1000 m D+" },
  hiking_groupPref: { solo: "Solo", duo: "Duo", small: "Petit groupe", large: "Grand groupe" },
  swimming_level: { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé", openwater: "Eau libre" },
  swimming_distance: { short: "< 1 km", medium: "1 à 2 km", long: "2 à 3 km", ultra: "> 3 km" },
};

function displayVal(field: string, val: string): string {
  return DISPLAY_VALUES[field]?.[val] ?? val;
}

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
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
        isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400"
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-sm text-slate-500">
        {isDragActive ? "Dépose ici…" : "📸 Glisse ta photo ou clique"}
      </p>
      <p className="text-xs text-slate-400">max 2 Mo</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useUser();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editAvatar, setEditAvatar] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [avatarTab, setAvatarTab] = useState<"avatar" | "photo">("avatar");

  const isAdmin = user?.email === ADMIN_EMAIL;
  // Tout utilisateur connecté peut éditer son propre profil (même si pas encore en Airtable)
  const canEdit = !!user;

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
  }, [user, router]);

  useEffect(() => {
    // Priorité : données Airtable, sinon localStorage
    const source = profile ?? (() => {
      try {
        const raw = localStorage.getItem("userPreferences");
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (p.skipped || p.synced) return null;
        return {
          sexe: p.sexe ?? "",
          ageRange: p.ageRange ?? "",
          sports: Array.isArray(p.sports) ? p.sports.join(",") : (p.sports ?? ""),
          goal: p.global?.goal ?? "",
          description: p.description ?? "",
          avatarKey: p.avatarKey ?? "",
          photoUrl: p.photoUrl ?? "",
          cycling_level: p.cycling?.level ?? "",
          cycling_bikeType: p.cycling?.bikeType ?? "",
          cycling_mechanicalSkill: p.cycling?.mechanicalSkill ?? "",
          running_pace: p.running?.pace ?? "",
          running_terrain: p.running?.terrain ?? "",
          running_distance: p.running?.distance ?? "",
          hiking_duration: p.hiking?.duration ?? "",
          hiking_elevationGain: p.hiking?.elevationGain ?? "",
          hiking_groupPref: p.hiking?.groupPref ?? "",
          swimming_level: p.swimming?.level ?? "",
          swimming_distance: p.swimming?.distance ?? "",
        };
      } catch { return null; }
    })();

    if (source) {
      setForm({
        sexe: (source.sexe as string) ?? "",
        ageRange: (source.ageRange as string) ?? "",
        sports: (source.sports as string) ?? "",
        goal: (source.goal as string) ?? "",
        description: (source.description as string) ?? "",
        cycling_level: (source.cycling_level as string) ?? "",
        cycling_bikeType: (source.cycling_bikeType as string) ?? "",
        cycling_mechanicalSkill: (source.cycling_mechanicalSkill as string) ?? "",
        running_pace: (source.running_pace as string) ?? "",
        running_terrain: (source.running_terrain as string) ?? "",
        running_distance: (source.running_distance as string) ?? "",
        hiking_duration: (source.hiking_duration as string) ?? "",
        hiking_elevationGain: (source.hiking_elevationGain as string) ?? "",
        hiking_groupPref: (source.hiking_groupPref as string) ?? "",
        swimming_level: (source.swimming_level as string) ?? "",
        swimming_distance: (source.swimming_distance as string) ?? "",
      });
      setEditAvatar((source.avatarKey as string) ?? "");
      setEditPhoto((source.photoUrl as string) ?? "");
    }
  }, [profile]);

  const avatarPreview = editPhoto || (editAvatar ? AVATARS.find(a => a.key === editAvatar)?.url : null);
  const currentPreview = profile?.photoUrl || (profile?.avatarKey ? AVATARS.find(a => a.key === profile.avatarKey)?.url : null);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    // POST fait un upsert par email — fonctionne avec ou sans record existant
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        ...form,
        avatarKey: editAvatar,
        photoUrl: editPhoto,
        onboardingDone: "true",
      }),
    });
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  }

  if (!user) return null;

  // Affiche les champs depuis Airtable OU depuis le formulaire pré-rempli
  const displaySource = profile ?? form;
  const profileFields = [
    "sexe", "ageRange", "sports", "goal", "description",
    "cycling_level", "cycling_bikeType", "cycling_mechanicalSkill",
    "running_pace", "running_terrain", "running_distance",
    "hiking_duration", "hiking_elevationGain", "hiking_groupPref",
    "swimming_level", "swimming_distance",
  ].filter(f => (displaySource as Record<string, unknown>)?.[f]);

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* Back */}
        <button
          onClick={() => router.push("/")}
          className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1 transition-colors"
        >
          ← Retour à l'accueil
        </button>

        {/* Profile card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

          {/* Header gradient */}
          <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600" />

          {/* Avatar + name */}
          <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center">
            <div className="relative mb-4">
              {currentPreview ? (
                <img
                  src={currentPreview}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/bottts/svg?seed=${user.email}`; }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 border-4 border-white shadow-lg flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {user.email[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <p className="font-bold text-slate-900 text-lg">{user.email}</p>
            {isAdmin && (
              <span className="mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                Admin
              </span>
            )}

            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="mt-4 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                ✏️ Modifier mon profil
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 px-6 py-5 space-y-3">

            {!editing ? (
              <>
                {profileFields.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">
                    Clique sur &quot;Modifier mon profil&quot; pour compléter tes informations.
                  </p>
                )}
                {profileFields.map((field) => (
                  <div key={field} className="flex justify-between items-start gap-4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide min-w-[130px]">
                      {FIELD_LABELS[field] ?? field}
                    </span>
                    <span className="text-sm font-medium text-slate-800 text-right">
                      {field === "sports"
                        ? String((displaySource as Record<string, unknown>)?.[field] ?? "").split(",").filter(Boolean).join(", ")
                        : displayVal(field, String((displaySource as Record<string, unknown>)?.[field] ?? ""))}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="space-y-4">

                {/* Avatar / photo editor */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                    Photo / Avatar
                  </label>

                  {avatarPreview && (
                    <div className="flex flex-col items-center mb-3">
                      <img
                        src={avatarPreview} alt="Aperçu"
                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-400"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/bottts/svg?seed=${user.email}`; }}
                      />
                      <button
                        onClick={() => { setEditAvatar(""); setEditPhoto(""); }}
                        className="text-xs text-slate-400 hover:text-red-500 mt-1 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}

                  <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-3">
                    <button type="button" onClick={() => setAvatarTab("avatar")}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${avatarTab === "avatar" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}>
                      🎭 Avatar
                    </button>
                    <button type="button" onClick={() => setAvatarTab("photo")}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${avatarTab === "photo" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}>
                      📷 Photo
                    </button>
                  </div>

                  {avatarTab === "avatar" ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {AVATARS.map((av) => (
                        <button key={av.key} type="button"
                          onClick={() => { setEditAvatar(av.key); setEditPhoto(""); }}
                          className={`flex flex-col items-center gap-1 p-1 rounded-xl border-2 transition-all ${
                            editAvatar === av.key && !editPhoto ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <img src={av.url} alt={av.name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/bottts/svg?seed=${av.key}`; }}
                          />
                          <span className="text-[9px] font-semibold text-slate-600 truncate w-full text-center">{av.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <PhotoDropzone onPhoto={(url) => { setEditPhoto(url); setEditAvatar(""); }} />
                  )}
                </div>

                {/* Text fields */}
                {["description"].map((field) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                      {FIELD_LABELS[field]}
                    </label>
                    <textarea
                      value={form[field] ?? ""}
                      onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 outline-none resize-none text-sm text-slate-700"
                    />
                  </div>
                ))}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>

                {/* Refaire l'onboarding complet */}
                <div className="border-t border-slate-100 pt-4">
                  <button
                    onClick={() => { localStorage.removeItem("userPreferences"); router.push("/onboarding"); }}
                    className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50 transition-colors"
                  >
                    🔄 Refaire le questionnaire complet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
