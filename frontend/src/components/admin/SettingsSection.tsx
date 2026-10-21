import { LucideIcon } from "lucide-react";

type SettingsSectionProps = {
  id?: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  className = "",
}: SettingsSectionProps) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-stone-700 dark:bg-stone-900 dark:shadow-none ${
        id ? "scroll-mt-28" : ""
      } ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-stone-100/90 px-4 py-3.5 dark:border-stone-700 sm:px-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          <Icon size={17} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="font-display text-[15px] font-bold text-stone-900 dark:text-stone-50">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

type SettingsFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsField({ label, hint, error, children, className = "" }: SettingsFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
      {hint && <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
    </div>
  );
}
