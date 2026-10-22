"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ScrollText,
  Settings,
  Stethoscope,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { usePlatformAuth } from "@/lib/auth";
import { canAccessNav, roleLabel } from "@/lib/permissions";

const GROUPS = [
  {
    label: "Operate",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/tenants", label: "Tenants", icon: Building2 },
      { href: "/plans", label: "Plans", icon: Layers },
      { href: "/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/audit", label: "Audit log", icon: ScrollText },
      { href: "/health", label: "Health", icon: Stethoscope },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavLinks({
  path,
  visible,
  onNavigate,
}: {
  path: string;
  visible: { href: string; label: string; icon: typeof LayoutDashboard }[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-5" aria-label="Platform">
      {GROUPS.map((group) => {
        const items = group.items.filter((item) => visible.some((v) => v.href === item.href));
        if (!items.length) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = path === item.href || path.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`group relative flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition duration-150 ${
                      active
                        ? "bg-accent-500/15 text-accent-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-200 dark:text-slate-400"
                    }`}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-400" />
                    ) : null}
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent-300" : "opacity-70"}`} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, logout } = usePlatformAuth();
  const [open, setOpen] = useState(false);
  const visibleNav = GROUPS.flatMap((g) => g.items).filter((item) => canAccessNav(user?.permissions, item.href));
  const initials = (user?.name || "P")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="panel-surface flex min-h-screen text-slate-900 dark:text-slate-100">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/80 px-3 py-5 backdrop-blur-md dark:border-white/[0.06] dark:bg-slate-950/70 md:flex">
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 px-3.5 py-3 text-white shadow-lg shadow-accent-600/25">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Restaurant OS</p>
            <p className="text-[11px] text-sky-100/90">Operator platform</p>
          </div>
        </div>
        <NavLinks path={path} visible={visibleNav} />
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-500/20 text-xs font-semibold text-accent-200">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
            {user?.role ? roleLabel(user.role) : ""}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="btn-secondary mt-3 h-10 min-h-10 w-full py-2 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-72 flex-col bg-slate-950 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Menu</p>
              <button type="button" className="btn-ghost h-10 w-10 min-h-10 p-0" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks path={path} visible={visibleNav} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur md:hidden dark:border-white/[0.06] dark:bg-slate-950/80">
          <button type="button" className="btn-ghost h-10 w-10 min-h-10 p-0" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">Restaurant OS</p>
            <p className="text-[11px] text-slate-500">{user?.name}</p>
          </div>
          <span className="w-10" />
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
