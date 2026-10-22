import type { LucideIcon } from "lucide-react";

const TONES = {
  default: {
    icon: "bg-accent-500/15 text-accent-300",
    value: "text-slate-900 dark:text-white",
  },
  success: {
    icon: "bg-emerald-500/15 text-emerald-400",
    value: "text-slate-900 dark:text-white",
  },
  warning: {
    icon: "bg-amber-500/15 text-amber-400",
    value: "text-slate-900 dark:text-white",
  },
  danger: {
    icon: "bg-rose-500/15 text-rose-400",
    value: "text-slate-900 dark:text-white",
  },
} as const;

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:border-accent-400/30 dark:border-white/[0.07] dark:bg-slate-900/70 dark:shadow-panel">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
        {Icon ? (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${t.icon}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className={`mt-3 text-[1.7rem] font-semibold leading-none tracking-tight tabular-nums ${t.value}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
