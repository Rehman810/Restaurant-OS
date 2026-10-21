"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  roleMayAccessSettingsSection,
  settingsPath,
} from "@/modules/settings/ia";

export function SettingsMobileSectionList() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <div className="mt-6 space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {SETTINGS_GROUPS.map((group) => {
        const items = SETTINGS_SECTIONS.filter(
          (s) => s.groupId === group.id && roleMayAccessSettingsSection(role, s.id)
        );
        if (items.length === 0) return null;
        return (
          <section key={group.id}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {group.label}
            </h2>
            <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={settingsPath(item.id)}
                      className="flex min-h-[3.25rem] items-center gap-3 px-4 py-3 text-stone-900 dark:text-stone-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
