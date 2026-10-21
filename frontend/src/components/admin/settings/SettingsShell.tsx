"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_SETTINGS_SECTION,
  LEGACY_SETTINGS_TAB_REDIRECT,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  SettingsSectionId,
  isSettingsSectionId,
  roleMayAccessSettingsSection,
  settingsPath,
} from "@/modules/settings/ia";
import { SettingsSearchField } from "@/components/admin/settings/SettingsSearchField";

function sectionFromPath(path: string): SettingsSectionId | null {
  const match = path.match(/^\/admin\/settings\/([^/]+)/);
  if (!match) return null;
  const id = match[1];
  return isSettingsSectionId(id) ? id : null;
}

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const role = user?.role;
  const activeSection = sectionFromPath(path);
  const onIndex = path === "/admin/settings";

  useEffect(() => {
    const legacyTab = searchParams.get("tab");
    if (!legacyTab) return;
    const target = LEGACY_SETTINGS_TAB_REDIRECT[legacyTab] ?? DEFAULT_SETTINGS_SECTION;
    router.replace(settingsPath(target));
  }, [searchParams, router]);

  useEffect(() => {
    if (!activeSection || !role) return;
    if (!roleMayAccessSettingsSection(role, activeSection)) {
      router.replace("/admin");
    }
  }, [activeSection, role, router]);

  const visibleSections = SETTINGS_SECTIONS.filter((s) => roleMayAccessSettingsSection(role, s.id));

  useEffect(() => {
    if (path !== "/admin/settings") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (mq.matches) router.replace(settingsPath(DEFAULT_SETTINGS_SECTION));
  }, [path, router]);

  return (
    <div className="min-w-0">
      <div className="lg:flex lg:items-start lg:gap-6 xl:gap-8">
        <aside className="hidden w-[13.5rem] shrink-0 lg:block xl:w-[15rem]">
          <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col gap-3 overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
            <div className="shrink-0 border-b border-stone-100 p-3 dark:border-stone-800">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">Settings</p>
              <SettingsSearchField />
            </div>
            <nav
              aria-label="Settings sections"
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-2 pb-3 pt-1"
            >
              {SETTINGS_GROUPS.map((group) => {
                const items = visibleSections.filter((s) => s.groupId === group.id);
                if (items.length === 0) return null;
                return (
                  <div key={group.id}>
                    <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((item) => {
                        const href = settingsPath(item.id);
                        const active = activeSection === item.id;
                        const Icon = item.icon;
                        return (
                          <li key={item.id}>
                            <Link
                              href={href}
                              className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium leading-snug transition ${
                                active
                                  ? "bg-brand-50 text-brand-900 shadow-sm ring-1 ring-brand-200/80 dark:bg-brand-950/40 dark:text-brand-100 dark:ring-brand-800"
                                  : "text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800/60"
                              }`}
                            >
                              <Icon
                                size={16}
                                className={`shrink-0 ${active ? "text-brand-600 dark:text-brand-400" : "text-stone-400"}`}
                                aria-hidden
                              />
                              <span className="min-w-0">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 w-full flex-1">
          {activeSection && (
            <div className="mb-4 space-y-3 lg:hidden">
              <Link
                href="/admin/settings"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300"
              >
                <ChevronLeft size={18} aria-hidden />
                All settings
              </Link>
              <SettingsSearchField />
            </div>
          )}
          {onIndex && (
            <div className="mb-4 lg:hidden">
              <SettingsSearchField />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
