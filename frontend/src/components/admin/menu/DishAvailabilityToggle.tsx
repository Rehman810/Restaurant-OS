"use client";

import type { AdminDishAvailability } from "@/lib/admin-menu/types";
import { availabilityLabel } from "@/lib/admin-menu/availability-label";

type Props = {
  availability: AdminDishAvailability;
  disabled?: boolean;
  onToggle: (nextSoldOut: boolean) => void;
};

export function DishAvailabilityToggle({ availability, disabled, onToggle }: Props) {
  const soldOut = availability.state === "soldOut";
  const label = availabilityLabel(availability);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={soldOut}
      aria-label={soldOut ? `Availability: sold out. Activate to mark available.` : `Availability: available. Mark sold out.`}
      onClick={() => onToggle(!soldOut)}
      className={`min-h-11 rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1 transition sm:text-sm ${
        soldOut
          ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800"
          : "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800"
      } disabled:opacity-50`}
    >
      <span className="block">{soldOut ? "Sold out" : "Available"}</span>
      {soldOut && availability.until && (
        <span className="mt-0.5 block text-[11px] font-normal opacity-80">{label}</span>
      )}
    </button>
  );
}
