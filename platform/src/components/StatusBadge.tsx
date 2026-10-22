const STYLES: Record<string, string> = {
  TRIAL: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  PAST_DUE: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  SUSPENDED: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  ARCHIVED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  LEAD: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  OPEN: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  VOID: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
