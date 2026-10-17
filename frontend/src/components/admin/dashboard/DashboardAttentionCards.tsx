"use client";

import Link from "next/link";
import { AlertTriangle, Calendar, MessageSquare, Package, Timer, Wallet } from "lucide-react";

const ICONS: Record<string, typeof AlertTriangle> = {
  late: Timer,
  confirm: AlertTriangle,
  sync: AlertTriangle,
  shifts: AlertTriangle,
  rider: Wallet,
  stock: Package,
  bookings: Calendar,
  feedback: MessageSquare,
};

export function DashboardAttentionCards({
  cards,
}: {
  cards: { key: string; label: string; count: number; href: string; sublabel?: string }[];
}) {
  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-white px-4 py-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-stone-900 dark:text-emerald-100">
        All clear — nothing urgent right now.
      </div>
    );
  }

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cards.map((card) => {
        const Icon = ICONS[card.key] ?? AlertTriangle;
        return (
          <Link
            key={card.key}
            href={card.href}
            className="group relative min-w-[min(100%,200px)] flex-1 snap-start overflow-hidden rounded-2xl border border-red-200/90 bg-gradient-to-br from-red-50/95 to-white px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-red-900/60 dark:from-red-950/35 dark:to-stone-900 sm:min-w-[200px]"
            aria-live="polite"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-red-500" />
            <div className="flex items-start justify-between gap-2 pl-1">
              <div>
                <p className="text-xs font-semibold text-red-800/80 dark:text-red-200/90">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-red-950 dark:text-red-50">{card.count}</p>
                {card.sublabel && (
                  <p className="mt-0.5 text-[11px] font-medium text-red-700/70 dark:text-red-300/80">{card.sublabel}</p>
                )}
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-red-700 group-hover:bg-red-200 dark:bg-red-950/60 dark:text-red-200">
                <Icon size={16} aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
