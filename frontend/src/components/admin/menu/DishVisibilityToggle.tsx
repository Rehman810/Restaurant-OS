"use client";

type Props = {
  visible: boolean;
  disabled?: boolean;
  onChange: (visible: boolean) => void;
};

export function DishVisibilityToggle({ visible, disabled, onChange }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={!visible}
      aria-label={visible ? "Visible on storefront. Hide." : "Hidden on storefront. Show."}
      onClick={() => onChange(!visible)}
      className={`min-h-11 rounded-xl px-3 py-2 text-xs font-semibold ring-1 sm:text-sm ${
        visible
          ? "bg-stone-50 text-stone-800 ring-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-600"
          : "bg-stone-200 text-stone-600 ring-stone-300 dark:bg-stone-700 dark:text-stone-300"
      } disabled:opacity-50`}
    >
      {visible ? "Visible" : "Hidden"}
    </button>
  );
}
