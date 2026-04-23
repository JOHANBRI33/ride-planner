"use client";

import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { AVATARS } from "@/app/onboarding/page";

export default function Navbar() {
  const { user, profile, logout } = useUser();

  const avatarSrc = profile?.photoUrl
    || (profile?.avatarKey ? AVATARS.find(a => a.key === profile.avatarKey)?.url : null)
    || null;

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 hover:text-blue-600 transition-colors duration-150">
          Ride<span className="text-blue-600">Planner</span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Link href="/create">
            <button className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-150 shadow-sm">
              + Créer
            </button>
          </Link>

          {user ? (
            <>
              {/* Avatar + Mon profil */}
              <Link href="/profile" className="flex items-center gap-2 group">
                <div className="relative">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full object-cover border-2 border-slate-200 group-hover:border-blue-400 transition-colors"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/9.x/bottts/svg?seed=${user.email}`; }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 border-2 border-slate-200 group-hover:border-blue-400 flex items-center justify-center transition-colors">
                      <span className="text-xs font-bold text-white">{user.email[0].toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors hidden md:block">
                  Mon profil
                </span>
              </Link>

              <button
                onClick={logout}
                className="text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3 sm:px-4 py-2 rounded-full transition-all duration-150"
              >
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sm:hidden">✕</span>
              </button>
            </>
          ) : (
            <Link href="/login">
              <button className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3 sm:px-4 py-2 rounded-full font-medium transition-all duration-150">
                <span className="hidden sm:inline">Se connecter</span>
                <span className="sm:hidden">Login</span>
              </button>
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}
