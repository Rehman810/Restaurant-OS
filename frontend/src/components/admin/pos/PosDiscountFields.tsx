"use client";

const DEFAULT_CHIPS = ["Staff", "Complaint", "Promo", "Other"];

type Props = {
  discountPercent: string;
  maxCashierDiscountPercent: number;
  reasonCode: string;
  reasonNote: string;
  reasonOptions: string[];
  onPercentChange: (v: string) => void;
  onReasonCodeChange: (v: string) => void;
  onReasonNoteChange: (v: string) => void;
};

export function PosDiscountFields({
  discountPercent,
  maxCashierDiscountPercent,
  reasonCode,
  reasonNote,
  reasonOptions,
  onPercentChange,
  onReasonCodeChange,
  onReasonNoteChange,
}: Props) {
  const chips =
    reasonOptions.length > 0
      ? reasonOptions
      : DEFAULT_CHIPS;
  const showOtherNote = reasonCode.toLowerCase() === "other";

  return (
    <div className="space-y-2">
      <div>
        <input
          className="input h-11 w-full text-sm"
          type="number"
          min={0}
          max={100}
          placeholder="Discount %"
          value={discountPercent}
          onChange={(e) => onPercentChange(e.target.value)}
          aria-label="Discount percent"
        />
        <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
          Cashiers: up to {maxCashierDiscountPercent}% without manager PIN.
        </p>
      </div>
      {Number(discountPercent) > 0 && (
        <>
          <p className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Discount reason</p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((r) => {
              const active = reasonCode === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onReasonCodeChange(r)}
                  className={`min-h-11 rounded-full px-3 text-xs font-bold ring-1 ${
                    active
                      ? "bg-stone-900 text-white ring-stone-900 dark:bg-stone-100 dark:text-stone-900"
                      : "bg-white text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
          {showOtherNote && (
            <input
              className="input h-11 w-full text-sm"
              placeholder="Discount note (required)"
              value={reasonNote}
              onChange={(e) => onReasonNoteChange(e.target.value)}
              required
            />
          )}
        </>
      )}
    </div>
  );
}
