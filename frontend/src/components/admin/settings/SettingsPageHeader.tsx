"use client";

import { ReactNode } from "react";

/** Lighter header for settings — avoids duplicating the large gradient AdminPageHeader. */
export function SettingsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-stone-200/90 pb-5 dark:border-stone-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
