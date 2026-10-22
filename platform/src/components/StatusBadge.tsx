const STYLES: Record<string, string> = {
  TRIAL: "bg-sky-500/15 text-sky-700 ring-sky-500/20 dark:text-sky-200",
  ACTIVE: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/20 dark:text-emerald-200",
  PAST_DUE: "bg-amber-500/15 text-amber-900 ring-amber-500/20 dark:text-amber-100",
  SUSPENDED: "bg-orange-500/15 text-orange-900 ring-orange-500/20 dark:text-orange-100",
  CANCELLED: "bg-rose-500/15 text-rose-800 ring-rose-500/20 dark:text-rose-200",
  ARCHIVED: "bg-slate-500/15 text-slate-700 ring-slate-500/20 dark:text-slate-300",
  LEAD: "bg-violet-500/15 text-violet-800 ring-violet-500/20 dark:text-violet-200",
  OPEN: "bg-amber-500/15 text-amber-900 ring-amber-500/20 dark:text-amber-100",
  PAID: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/20 dark:text-emerald-200",
  VOID: "bg-slate-500/15 text-slate-600 ring-slate-500/20 dark:text-slate-400",
  DRAFT: "bg-slate-500/15 text-slate-600 ring-slate-500/20 dark:text-slate-400",
};

const DOT: Record<string, string> = {
  TRIAL: "bg-sky-400",
  ACTIVE: "bg-emerald-400",
  PAST_DUE: "bg-amber-400",
  SUSPENDED: "bg-orange-400",
  CANCELLED: "bg-rose-400",
  ARCHIVED: "bg-slate-400",
  LEAD: "bg-violet-400",
  OPEN: "bg-amber-400",
  PAID: "bg-emerald-400",
  VOID: "bg-slate-400",
  DRAFT: "bg-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] || "bg-slate-500/15 text-slate-700 ring-slate-500/20 dark:text-slate-300";
  const dot = DOT[status] || "bg-slate-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {status.replace(/_/g, " ")}
    </span>
  );
}
