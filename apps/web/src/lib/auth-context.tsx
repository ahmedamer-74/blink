"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { hydrateAuth } from "@/lib/actions/auth";

interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  updateAccessToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    hydrateAuth().then((result) => {
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
      setIsLoading(false);
    });
  }, []);

  const setAuth = useCallback((u: AuthUser, token: string) => {
    setUser(u);
    setAccessToken(token);
  }, []);

  const updateAccessToken = useCallback((token: string) => {
    setAccessToken(token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        setAuth,
        updateAccessToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
