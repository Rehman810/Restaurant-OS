"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScrollText,
  Settings,
  Stethoscope,
} from "lucide-react";
import { usePlatformAuth } from "@/lib/auth";
import { canAccessNav, roleLabel } from "@/lib/permissions";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/tenants", label: "Tenants", icon: Building2 },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/health", label: "Health", icon: Stethoscope },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, logout } = usePlatformAuth();
  const visibleNav = NAV.filter((item) => canAccessNav(user?.permissions, item.href));

  return (
    <div className="panel-surface flex min-h-screen text-slate-900 dark:text-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white/90 px-3 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:flex">
        <div className="rounded-2xl bg-gradient-to-br from-accent-600 to-accent-700 px-4 py-3 text-white shadow-lg shadow-accent-600/25">
          <p className="text-sm font-semibold">Restaurant OS</p>
          <p className="text-xs text-accent-100/90">Operator platform</p>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-0.5">
          {visibleNav.map((item) => {
            const active = path === item.href || path.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-accent-50 text-accent-800 shadow-sm dark:bg-accent-500/15 dark:text-accent-100"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
            {user?.role ? roleLabel(user.role) : ""}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 md:hidden">
          <div>
            <p className="text-sm font-semibold">Platform</p>
            <p className="text-xs text-slate-500">{user?.name}</p>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
