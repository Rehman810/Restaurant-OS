"use client";

import { CalendarDays, Plus, Trash2 } from "lucide-react";
import {
  coerceSpecialHours,
  defaultSpecialId,
  type SpecialHoursEntry,
} from "@/lib/special-hours";
import type { StoreSettings } from "@/lib/types";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
};

export function SpecialHoursEditor({ settings, onChange }: Props) {
  const entries = coerceSpecialHours(settings.specialHours);

  function setEntries(next: SpecialHoursEntry[]) {
    onChange({ specialHours: next });
  }

  function patch(id: string, patch: Partial<SpecialHoursEntry>) {
    setEntries(entries.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function add() {
    const today = new Date().toISOString().slice(0, 10);
    setEntries([
      ...entries,
      {
        id: defaultSpecialId(),
        label: "Special hours",
        startDate: today,
        closed: false,
        slots: [{ open: "12:00", close: "22:00" }],
      },
    ]);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-brand-600" />
          <p className="text-sm font-semibold text-stone-900">Special days</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          <Plus size={14} />
          Add date
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-3 text-xs text-stone-500">Override the weekly schedule on holidays or events.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {entries.map((row) => (
            <li key={row.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-start gap-2">
                <input
                  className="input min-w-0 flex-1 text-sm"
                  placeholder="Label"
                  value={row.label}
                  onChange={(e) => patch(row.id, { label: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Remove special day"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setEntries(entries.filter((e) => e.id !== row.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-stone-600">
                  From
                  <input
                    type="date"
                    className="input mt-1 block w-full min-w-[9rem]"
                    value={row.startDate}
                    onChange={(e) => patch(row.id, { startDate: e.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  To
                  <input
                    type="date"
                    className="input mt-1 block w-full min-w-[9rem]"
                    value={row.endDate ?? ""}
                    onChange={(e) => patch(row.id, { endDate: e.target.value || undefined })}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600"
                    checked={Boolean(row.closed)}
                    onChange={(e) =>
                      patch(row.id, {
                        closed: e.target.checked,
                        slots: e.target.checked ? [] : row.slots?.length ? row.slots : [{ open: "12:00", close: "22:00" }],
                      })
                    }
                  />
                  Closed all day
                </label>
              </div>
              {!row.closed && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-stone-500">Hours</span>
                  <input
                    type="time"
                    step={900}
                    className="input w-auto"
                    value={row.slots?.[0]?.open ?? "12:00"}
                    onChange={(e) =>
                      patch(row.id, {
                        slots: [{ open: e.target.value, close: row.slots?.[0]?.close ?? "22:00" }],
                      })
                    }
                  />
                  <span className="text-stone-400">–</span>
                  <input
                    type="time"
                    step={900}
                    className="input w-auto"
                    value={row.slots?.[0]?.close ?? "22:00"}
                    onChange={(e) =>
                      patch(row.id, {
                        slots: [{ open: row.slots?.[0]?.open ?? "12:00", close: e.target.value }],
                      })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
