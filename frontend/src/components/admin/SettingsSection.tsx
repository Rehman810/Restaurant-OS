import { LucideIcon } from "lucide-react";

type SettingsSectionProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  className = "",
}: SettingsSectionProps) {
  return (
    <section
      className={`rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-stone-100 px-5 py-4 dark:border-stone-700 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-50">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{description}</p>}
        </div>
      </div>
      <div className="space-y-4 p-5 sm:p-6">{children}</div>
    </section>
  );
}

type SettingsFieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsField({ label, hint, children, className = "" }: SettingsFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
    </div>
  );
}
