"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type UserProfile = {
  airtableId?: string;
  sexe?: string;
  ageRange?: string;
  sports?: string;
  goal?: string;
  description?: string;
  avatarKey?: string;
  photoUrl?: string;
  onboardingDone?: string;
  [key: string]: string | undefined;
};

type User = { id: string; email: string };

type UserContextType = {
  user: User | null;
  profile: UserProfile | null;
  login: (email: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  login: () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ride_user");
    if (stored) {
      const u = JSON.parse(stored) as User;
      setUser(u);
      loadProfile(u.email);
    }
  }, []);

  async function loadProfile(email: string) {
    try {
      const res = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // silently fail — profile stays null
    }
  }

  async function refreshProfile() {
    if (user?.email) await loadProfile(user.email);
  }

  function login(email: string) {
    const id = btoa(email).replace(/=/g, "");
    const u: User = { id, email };
    localStorage.setItem("ride_user", JSON.stringify(u));
    setUser(u);
    loadProfile(email);
  }

  function logout() {
    localStorage.removeItem("ride_user");
    localStorage.removeItem("userPreferences");
    setUser(null);
    setProfile(null);
  }

  return (
    <UserContext.Provider value={{ user, profile, login, logout, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
