"use client";

import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Role, User } from "./types";
import { reconnectLiveSocket } from "@/hooks/useLiveOrders";

type LoginResult =
  | { user: User; requiresTwoFactor?: false }
  | { requiresTwoFactor: true; challengeToken: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  logoutEverywhere: () => Promise<void>;
  refreshUser: () => Promise<User>;
};

const Ctx = createContext<AuthCtx | null>(null);

function persistSession(user: User, setUser: (u: User) => void) {
  setUser(user);
  reconnectLiveSocket();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    void api("/auth/csrf").catch(() => null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("uff_token");
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const res = await api<{ token?: string; user?: User; requiresTwoFactor?: boolean; challengeToken?: string }>(
          "/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) }
        );
        if (res.requiresTwoFactor && res.challengeToken) {
          return { requiresTwoFactor: true, challengeToken: res.challengeToken };
        }
        if (!res.user) throw new Error("Login failed");
        persistSession(res.user, setUser);
        return { user: res.user };
      },
      verifyTwoFactor: async (challengeToken, code) => {
        const res = await api<{ user: User }>("/auth/login/2fa", {
          method: "POST",
          body: JSON.stringify({ challengeToken, code }),
        });
        persistSession(res.user, setUser);
        return res.user;
      },
      register: async (data) => {
        const res = await api<{ user: User }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(data),
        });
        persistSession(res.user, setUser);
        return res.user;
      },
      logout: () => {
        void api("/auth/logout", { method: "POST" }).catch(() => null);
        setUser(null);
        reconnectLiveSocket();
      },
      logoutEverywhere: async () => {
        try {
          await api("/auth/logout-all", { method: "POST" });
        } catch {
          /* clear the local session even if the API is unreachable */
        }
        setUser(null);
        reconnectLiveSocket();
      },
      refreshUser: async () => {
        const me = await api<User>("/auth/me");
        setUser(me);
        reconnectLiveSocket();
        return me;
      },
    }),
    [user, loading]
  );

  return createElement(Ctx.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}

export function homeFor(role?: Role) {
  if (role === "ADMIN" || role === "MANAGER") return "/admin";
  if (role === "WAITER") return "/admin/dine-in";
  if (role === "CHEF") return "/admin/kitchen";
  if (role === "CASHIER") return "/admin/pos";
  if (role === "RIDER") return "/rider";
  return "/menu";
}

export function isStaffRole(role?: Role) {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "WAITER" ||
    role === "CHEF" ||
    role === "CASHIER" ||
    role === "RIDER"
  );
}

export function dashboardLabel(role: Role) {
  if (role === "ADMIN") return "Admin dashboard";
  if (role === "MANAGER") return "Manager dashboard";
  if (role === "WAITER") return "Waiter · floor & POS";
  if (role === "CHEF") return "Kitchen board";
  if (role === "CASHIER") return "POS counter";
  if (role === "RIDER") return "Rider app";
  return "Dashboard";
}

export function resolveLoginRedirect(role: Role, next: string | null) {
  const home = homeFor(role);
  if (!next) return home;
  if ((role === "ADMIN" || role === "MANAGER") && next.startsWith("/admin")) return next;
  if (role === "CHEF" && next.startsWith("/admin/kitchen")) return next;
  if (role === "CASHIER" && next.startsWith("/admin/pos")) return next;
  if (role === "RIDER" && next.startsWith("/rider")) return next;
  if (role === "CUSTOMER" && !next.startsWith("/admin") && !next.startsWith("/rider")) return next;
  return home;
}
