"use client";

import { Clock, Plus, X } from "lucide-react";
import {
  WEEKDAYS,
  WeeklySchedule,
  coerceSchedule,
  formatHm,
  parseMinutes,
  type TimeSlot,
  type Weekday,
} from "@/lib/hours";
import { isKitchenScheduleOpen, isStoreOpen, storeStatusLabel } from "@/lib/store-hours";
import { StoreSettings } from "@/lib/types";

const LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type OpeningHoursEditorProps = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
};

function withLegacy(schedule: WeeklySchedule): Partial<StoreSettings> {
  const day = WEEKDAYS.map((key) => schedule[key]).find((row) => !row.closed && row.slots[0]);
  const slot = day?.slots[0] || { open: "09:00", close: "23:00" };
  const [openHour, openMinute] = slot.open.split(":").map(Number);
  const [closeHour, closeMinute] = slot.close.split(":").map(Number);
  return { weeklySchedule: schedule, openHour, openMinute, closeHour, closeMinute };
}

function TimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const total = parseMinutes(value) ?? 19 * 60;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minuteOptions = Array.from({ length: 4 }, (_, i) => i * 15);
  const snappedMinute = minuteOptions.reduce((best, option) =>
    Math.abs(option - minute) < Math.abs(best - minute) ? option : best
  );

  function emit(nextHour12: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    const normalized = nextHour12 % 12;
    const hour = nextPeriod === "PM" ? normalized + 12 : normalized;
    onChange(formatHm(hour * 60 + nextMinute));
  }

  return (
    <div
      className="inline-flex h-9 shrink-0 items-center rounded-lg border border-stone-200 bg-white"
      role="group"
      aria-label={label}
    >
      <select
        aria-label={`${label} hour`}
        className="h-full w-11 appearance-none bg-transparent pl-2 text-center text-sm font-semibold text-stone-900 outline-none"
        value={hour12}
        onChange={(e) => emit(Number(e.target.value), minute, period)}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="text-sm font-bold text-stone-300">:</span>
      <select
        aria-label={`${label} minute`}
        className="h-full w-11 appearance-none bg-transparent pr-1 text-center text-sm font-semibold text-stone-900 outline-none"
        value={snappedMinute}
        onChange={(e) => emit(hour12, Number(e.target.value), period)}
      >
        {minuteOptions.map((option) => (
          <option key={option} value={option}>
            {option.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="mx-0.5 h-4 w-px bg-stone-200" />
      {(["AM", "PM"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => emit(hour12, minute, item)}
          className={`mr-0.5 h-6 rounded-md px-1.5 text-[10px] font-bold last:mr-0.5 ${
            period === item ? "bg-brand-600 text-white" : "text-stone-500 hover:bg-stone-50"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function endsNextDay(open: string, close: string) {
  const openMin = parseMinutes(open);
  const closeMin = parseMinutes(close);
  return openMin != null && closeMin != null && closeMin <= openMin;
}

function slotDurationMinutes(slot: TimeSlot) {
  const open = parseMinutes(slot.open);
  const close = parseMinutes(slot.close);
  if (open == null || close == null) return null;
  if (open === close) return 0;
  if (close > open) return close - open;
  return 24 * 60 - open + close;
}

function scheduleWarnings(schedule: WeeklySchedule): string[] {
  const warnings: string[] = [];
  for (const day of WEEKDAYS) {
    const row = schedule[day];
    if (row.closed) continue;
    for (const slot of row.slots) {
      const open = parseMinutes(slot.open);
      const close = parseMinutes(slot.close);
      if (open == null || close == null) {
        warnings.push(`${LABELS[day]}: use valid times like 19:00.`);
        continue;
      }
      if (open % 15 !== 0 || close % 15 !== 0) {
        warnings.push(`${LABELS[day]}: times snap to 15-minute steps when saved.`);
      }
      const duration = slotDurationMinutes(slot);
      if (duration != null && duration > 0 && duration < 30) {
        warnings.push(`${LABELS[day]}: slot shorter than 30 minutes may be hard to staff.`);
      }
    }
    const active = row.slots
      .map((slot) => {
        const open = parseMinutes(slot.open);
        const close = parseMinutes(slot.close);
        if (open == null || close == null) return null;
        const end = close <= open ? close + 24 * 60 : close;
        return { open, end };
      })
      .filter(Boolean) as { open: number; end: number }[];
    active.sort((a, b) => a.open - b.open);
    for (let i = 1; i < active.length; i += 1) {
      if (active[i].open < active[i - 1].end) {
        warnings.push(`${LABELS[day]}: overlapping slots — customers may see confusing hours.`);
        break;
      }
    }
  }
  return [...new Set(warnings)];
}

export function OpeningHoursEditor({ settings, onChange }: OpeningHoursEditorProps) {
  const schedule = coerceSchedule(settings.weeklySchedule, settings);
  const onlineOpen = isStoreOpen(settings);
  const kitchenOpen = isKitchenScheduleOpen(settings);
  const warnings = scheduleWarnings(schedule);

  function update(next: WeeklySchedule) {
    onChange(withLegacy(next));
  }

  function patchDay(day: Weekday, row: WeeklySchedule[Weekday]) {
    update({ ...schedule, [day]: row });
  }

  function applyMonday() {
    const source = schedule.mon;
    const next = { ...schedule };
    for (const day of WEEKDAYS) {
      next[day] = {
        closed: source.closed,
        slots: source.slots.map((slot) => ({ ...slot })),
      };
    }
    update(next);
  }

  return (
    <div className="inline-flex flex-col items-start overflow-hidden rounded-2xl border border-orange-100 bg-[#fffaf5]">
      <div className="self-stretch border-b border-orange-100 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Clock size={15} className="text-brand-600" />
        <p className="text-sm font-semibold text-stone-800">Weekly schedule</p>
        <span className="text-xs text-stone-400">{settings.timezone || "Restaurant timezone"}</span>
        <button
          type="button"
          onClick={applyMonday}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Copy Mon → all
        </button>
        </div>
      </div>

      <div>
        {WEEKDAYS.map((day) => {
          const row = schedule[day];
          return (
            <div
              key={day}
              className="flex w-max max-w-full flex-wrap items-center gap-x-2 gap-y-2 border-b border-orange-100/80 bg-white px-3 py-2 last:border-b-0"
            >
              <span className="w-10 shrink-0 text-sm font-semibold text-stone-900">{LABELS[day].slice(0, 3)}</span>

              <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-stone-600">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-stone-300 text-brand-600"
                  checked={row.closed}
                  onChange={(e) =>
                    patchDay(day, {
                      closed: e.target.checked,
                      slots: e.target.checked ? [] : row.slots.length ? row.slots : [{ open: "19:00", close: "02:30" }],
                    })
                  }
                />
                Closed
              </label>

              {!row.closed &&
                row.slots.map((slot, index) => (
                  <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-1.5">
                    {index > 0 && <span className="text-[10px] font-bold uppercase tracking-wide text-stone-300">+</span>}
                    <TimePicker
                      label={`${LABELS[day]} opens`}
                      value={slot.open}
                      onChange={(open) => {
                        const slots = row.slots.map((item, i) => (i === index ? { ...item, open } : item));
                        patchDay(day, { ...row, slots });
                      }}
                    />
                    <span className="text-[11px] font-semibold text-stone-400">–</span>
                    <TimePicker
                      label={`${LABELS[day]} closes`}
                      value={slot.close}
                      onChange={(close) => {
                        const slots = row.slots.map((item, i) => (i === index ? { ...item, close } : item));
                        patchDay(day, { ...row, slots });
                      }}
                    />
                    {endsNextDay(slot.open, slot.close) && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        closes next day
                      </span>
                    )}
                    {row.slots.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove ${LABELS[day]} slot ${index + 1}`}
                        className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => patchDay(day, { ...row, slots: row.slots.filter((_, i) => i !== index) })}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}

              {!row.closed && row.slots.length < 3 && (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                  onClick={() => patchDay(day, { ...row, slots: [...row.slots, { open: "12:00", close: "15:00" }] })}
                >
                  <Plus size={12} />
                  Slot
                </button>
              )}
            </div>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <div className="self-stretch border-t border-amber-100 bg-amber-50/60 px-3 py-2">
          <ul className="space-y-0.5 text-[11px] font-medium text-amber-900">
            {warnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`self-stretch border-t px-3 py-2.5 ${
          onlineOpen ? "border-emerald-100 bg-emerald-50/80" : "border-amber-100 bg-amber-50/80"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              onlineOpen ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${onlineOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
            {onlineOpen ? "Online open" : "Online closed"}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              kitchenOpen ? "bg-sky-100 text-sky-900" : "bg-stone-100 text-stone-700"
            }`}
          >
            Kitchen {kitchenOpen ? "on schedule" : "closed"}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-stone-800">{storeStatusLabel(settings)}</p>
      </div>
    </div>
  );
}
