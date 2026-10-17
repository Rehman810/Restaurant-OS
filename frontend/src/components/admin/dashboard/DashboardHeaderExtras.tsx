"use client";

import { MoreVertical, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { unlockKitchenAudio } from "@/lib/kitchen-chime";
import { readDashboardSoundEnabled, writeDashboardSoundEnabled } from "@/lib/dashboard/sound";
import type { LiveState } from "@/hooks/useDashboardSummary";

export function LiveStatusBadge({ live, variant = "light" }: { live: LiveState; variant?: "light" | "dark" }) {
  const label = live === "live" ? "Live" : live === "reconnecting" ? "Reconnecting" : "Offline";
  const tone =
    variant === "dark"
      ? live === "live"
        ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30"
        : live === "reconnecting"
          ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30"
          : "bg-white/10 text-stone-200 ring-1 ring-white/20"
      : live === "live"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        : live === "reconnecting"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

export function DashboardMobileMenu({
  live,
  onRefresh,
  soundOn,
  onSoundToggle,
}: {
  live: LiveState;
  onRefresh: () => void;
  soundOn: boolean;
  onSoundToggle: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        aria-label="Dashboard menu"
        className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <div className="px-3 py-2 text-xs text-stone-500">
            <LiveStatusBadge live={live} />
          </div>
          <button type="button" className="block w-full px-3 py-2 text-left text-sm font-semibold" onClick={() => { onRefresh(); setOpen(false); }}>
            Refresh
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold"
            onClick={() => {
              void unlockKitchenAudio();
              onSoundToggle(!soundOn);
              setOpen(false);
            }}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            Order sound {soundOn ? "on" : "off"}
          </button>
        </div>
      )}
    </div>
  );
}

export function DashboardSoundToggle({
  soundOn,
  onSoundToggle,
  variant = "light",
}: {
  soundOn: boolean;
  onSoundToggle: (on: boolean) => void;
  variant?: "light" | "dark";
}) {
  const tone =
    variant === "dark"
      ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
      : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900";
  return (
    <button
      type="button"
      aria-label={soundOn ? "Disable order sound" : "Enable order sound"}
      className={`hidden min-h-11 min-w-11 place-items-center rounded-xl border lg:grid ${tone}`}
      onClick={() => {
        void unlockKitchenAudio();
        onSoundToggle(!soundOn);
      }}
    >
      {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}

export function useDashboardSound() {
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    setSoundOn(readDashboardSoundEnabled());
  }, []);
  const toggle = (on: boolean) => {
    writeDashboardSoundEnabled(on);
    setSoundOn(on);
  };
  return { soundOn, toggle };
}
