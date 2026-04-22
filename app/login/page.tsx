"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/context/UserContext";

function LoginForm() {
  const { login } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Adresse email invalide.");
      return;
    }
    login(trimmed);
    const redirect = searchParams.get("redirect") ?? "/";
    router.push(redirect);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="toi@example.com"
          required
          autoFocus
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold py-2.5 rounded-xl"
      >
        Se connecter
      </button>

      <p className="text-xs text-center text-gray-400">
        Pas de mot de passe requis — juste ton email.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏃</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Ride Planner</h1>
          <p className="text-gray-500 text-sm mt-1">Connecte-toi pour rejoindre des sorties</p>
        </div>
        <Suspense fallback={<div className="h-48 shimmer rounded-2xl" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
