import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Step = {
  label: string;
  count: number;
  color: string;
  bg: string;
  ring: string;
  href?: string;
  late?: boolean;
};

export function PipelineFlow({
  steps,
  active,
  completedToday,
}: {
  steps: Step[];
  active: number;
  completedToday?: number;
}) {
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <div className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/90 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-stone-900 dark:text-stone-50">Live kitchen pipeline</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">{active} orders in progress right now</p>
        </div>
        <Link
          href="/admin/tracking"
          className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-800"
        >
          Open board <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
        {steps.map((s, i) => {
          const inner = (
            <div
              className={`min-h-[120px] rounded-2xl border border-stone-200/50 p-4 dark:border-stone-600/60 ${s.bg} shadow-sm ring-1 ring-inset ${s.ring} dark:!bg-stone-800/90 dark:ring-stone-600/50 ${s.late ? "ring-red-400/80" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Step {i + 1}
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums text-stone-900 dark:text-stone-50">{s.count}</p>
              <p className="mt-0.5 text-xs font-semibold text-stone-600 dark:text-stone-300">{s.label}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80 dark:bg-stone-950/60">
                <div
                  className={`h-full rounded-full motion-reduce:transition-none transition-all duration-700 ${s.color}`}
                  style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 12 : 0)}%` }}
                />
              </div>
            </div>
          );
          return (
            <div key={s.label} className="relative shrink-0 lg:shrink">
              {i < steps.length - 1 && (
                <span className="absolute -right-1.5 top-1/2 z-10 hidden h-0.5 w-3 bg-stone-200 dark:bg-stone-600 xl:block" aria-hidden />
              )}
              {s.href ? (
                <Link href={s.href} className="block hover:opacity-95">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </div>
          );
        })}
        {completedToday != null && (
          <div className="min-h-[120px] rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm ring-1 ring-inset ring-emerald-200/60 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:ring-emerald-900/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Completed</p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-stone-900 dark:text-stone-50">{completedToday}</p>
            <p className="mt-0.5 text-xs font-semibold text-stone-600 dark:text-stone-300">Today</p>
          </div>
        )}
      </div>
    </div>
  );
}
