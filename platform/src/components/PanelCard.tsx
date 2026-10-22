export function PanelCard({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${className}`}
    >
      {(title || description) && (
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          {title ? <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
