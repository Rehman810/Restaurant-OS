"use client";

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { LiveStatusBadge } from "./DashboardHeaderExtras";
import type { LiveState } from "@/hooks/useDashboardSummary";

export function DashboardHero({
  greeting,
  subtitle,
  storeChip,
  onlineOpen,
  live,
  lastUpdatedLabel,
  highlightMetric,
  actions,
}: {
  greeting: string;
  subtitle: string;
  storeChip: string;
  onlineOpen: boolean;
  live: LiveState;
  lastUpdatedLabel: string;
  highlightMetric?: { label: string; value: string; title?: string };
  actions: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3a2a1f] via-stone-900 to-[#14100d] px-5 py-6 text-white shadow-xl sm:px-8 sm:py-8"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-0 h-56 w-56 rounded-full bg-brand-600/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.22em] text-brand-300">
            <Flame size={14} className="text-orange-400" aria-hidden />
            Today&apos;s pulse
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{greeting}</h1>
          <p className="max-w-2xl text-sm text-stone-300 sm:text-base">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                onlineOpen
                  ? "bg-white/10 text-emerald-100 ring-1 ring-emerald-400/35"
                  : "bg-white/10 text-stone-200 ring-1 ring-white/15"
              }`}
            >
              {storeChip}
            </span>
            {highlightMetric && (
              <span
                className="rounded-xl bg-black/35 px-3 py-2 text-xs ring-1 ring-white/10"
                title={highlightMetric.title}
              >
                <span className="font-medium text-stone-400">{highlightMetric.label}</span>
                <span className="ml-2 font-bold text-white">{highlightMetric.value}</span>
              </span>
            )}
            <LiveStatusBadge live={live} variant="dark" />
            <span className="text-xs text-stone-500" aria-live="polite">Updated {lastUpdatedLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">{actions}</div>
      </div>
    </div>
  );
}
