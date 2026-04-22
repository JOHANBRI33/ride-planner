"use client";

import Link from "next/link";
import { useUser } from "@/context/UserContext";

export default function Navbar() {
  const { user, logout } = useUser();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 hover:text-blue-600 transition-colors duration-150">
          Ride<span className="text-blue-600">Planner</span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Link href="/request" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors duration-150 hidden sm:block">
            Demandes
          </Link>
          <Link href="/create">
            <button className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-full transition-all duration-150 shadow-sm">
              + Créer
            </button>
          </Link>

          {user ? (
            <>
              <span className="text-sm text-slate-500 hidden md:block max-w-[160px] truncate">
                {user.email}
              </span>
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
