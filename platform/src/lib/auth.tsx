"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ensurePlatformCsrf } from "./api";
import { canAccess, type PlatformPermission } from "./permissions";
import type { PlatformUser } from "./types";

type LoginResult =
  | { completed: true; user: PlatformUser }
  | { completed: false; requiresTwoFactor: true; challengeToken: string };

type AuthState = {
  user: PlatformUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<PlatformUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: PlatformPermission) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function PlatformAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const path = usePathname();

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: PlatformUser }>("/auth/me");
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await ensurePlatformCsrf();
      } catch {
        /* offline */
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    if (!user && path !== "/login") router.replace("/login");
    if (user && path === "/login") router.replace("/overview");
  }, [loading, user, path, router]);

  const login = useCallback(async (email: string, password: string) => {
    await ensurePlatformCsrf();
    const res = await api<{
      user?: PlatformUser;
      requiresTwoFactor?: boolean;
      challengeToken?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.requiresTwoFactor && res.challengeToken) {
      return {
        completed: false as const,
        requiresTwoFactor: true as const,
        challengeToken: res.challengeToken,
      };
    }
    if (!res.user) throw new Error("Sign-in failed.");
    setUser(res.user);
    router.replace("/overview");
    return { completed: true as const, user: res.user };
  }, [router]);

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string) => {
      await ensurePlatformCsrf();
      const res = await api<{ user: PlatformUser }>("/auth/login/2fa", {
        method: "POST",
        body: JSON.stringify({ challengeToken, code }),
      });
      setUser(res.user);
      router.replace("/overview");
      return res.user;
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* session may already be gone */
    }
    setUser(null);
    router.replace("/login");
  }, [router]);

  const can = useCallback(
    (permission: PlatformPermission) => canAccess(user?.permissions, permission),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, verifyTwoFactor, logout, refresh, can }),
    [user, loading, login, verifyTwoFactor, logout, refresh, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function usePlatformAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
