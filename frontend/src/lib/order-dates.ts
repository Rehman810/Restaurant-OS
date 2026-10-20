export type QuickDatePreset = "today" | "yesterday" | "week" | "month" | "custom";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

export function toInputDate(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function quickPresetRange(preset: QuickDatePreset): { from: string; to: string } {
  const today = new Date();
  const to = toInputDate(today);

  if (preset === "today") {
    return { from: to, to };
  }

  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const d = toInputDate(y);
    return { from: d, to: d };
  }

  if (preset === "week") {
    return { from: toInputDate(startOfWeek(today)), to };
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toInputDate(monthStart), to };
}

export function orderInDateSpan(createdAt: string, from: string, to: string): boolean {
  if (!from && !to) return true;

  const orderDate = new Date(createdAt);
  const start = from ? startOfDay(new Date(`${from}T00:00:00`)) : null;
  const end = to
    ? (() => {
        const e = startOfDay(new Date(`${to}T00:00:00`));
        e.setDate(e.getDate() + 1);
        return e;
      })()
    : null;

  if (start && orderDate < start) return false;
  if (end && orderDate >= end) return false;
  return true;
}

export function formatDateSpanLabel(from: string, to: string) {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  if (!from && !to) return "all time";
  if (from && to && from === to) return fmt(from);
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `from ${fmt(from)}`;
  return `until ${fmt(to)}`;
}
