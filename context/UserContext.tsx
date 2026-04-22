"use client";

import { createContext, useContext, useEffect, useState } from "react";

type User = { id: string; email: string };

type UserContextType = {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
};

const UserContext = createContext<UserContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ride_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  function login(email: string) {
    // id déterministe basé sur l'email — stable entre sessions
    const id = btoa(email).replace(/=/g, "");
    const u: User = { id, email };
    localStorage.setItem("ride_user", JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("ride_user");
    setUser(null);
  }

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
