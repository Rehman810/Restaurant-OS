/** Greeting from store-local hour (05–11 morning, 12–16 afternoon, 17–20 evening, else night). */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour <= 11) return "Good morning";
  if (hour >= 12 && hour <= 16) return "Good afternoon";
  if (hour >= 17 && hour <= 20) return "Good evening";
  return "Good night";
}

export function storeHourInTimezone(timezone: string, ref = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(ref);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

export function greetingForTimezone(timezone: string, ref = new Date()) {
  return greetingForHour(storeHourInTimezone(timezone, ref));
}

/** Store-local date/time for dashboard copy (12-hour). */
export function formatStoreDateTime(timezone: string, ref = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ref);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function pluralizeCount(count: number, singular: string, plural?: string) {
  return `${count} ${pluralize(count, singular, plural)}`;
}

export function compactCurrency(amount: number, symbol = "Rs") {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${symbol} ${(amount / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${symbol} ${(amount / 1_000).toFixed(1)}k`;
  if (abs >= 1_000) return `${symbol} ${(amount / 1_000).toFixed(2)}k`;
  return `${symbol} ${Math.round(amount)}`;
}

/** Compact revenue axis labels without currency prefix (e.g. 5k). */
export function compactAxisAmount(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function formatDelta(
  pct: number | null,
  label: "new" | "flat" | null
): string {
  if (label === "new" || label === "flat") return "—";
  if (pct == null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export function formatPaymentMethodLabel(method: string | null | undefined) {
  if (!method) return "Unspecified";
  if (method === "CASH") return "Cash";
  if (method === "CARD") return "Card";
  return method.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function durationShortLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function oldestAgeLabel(minutes: number | null | undefined) {
  if (minutes == null || minutes < 1) return undefined;
  return `oldest ${durationShortLabel(minutes)}`;
}

export type AttentionCardInput = {
  lateOrders: { minutesInStatus: number }[];
  confirmCount: number;
  confirmOldestMinutes: number | null;
  syncConflicts: number | null;
  offlinePosEnabled: boolean;
  shiftsStaleCount: number;
  shiftsOldestStaleMinutes: number | null;
  riderCashPendingCount: number;
  riderCashOldestMinutes: number | null;
  lowStockCount: number;
  pendingBookings: number;
  lowRatingCount: number;
};

export type AttentionCard = {
  key: string;
  label: string;
  count: number;
  href: string;
  sublabel?: string;
};

export function buildNeedsAttentionCards(input: AttentionCardInput): AttentionCard[] {
  const cards: AttentionCard[] = [];

  if (input.lateOrders.length > 0) {
    const oldest = Math.max(...input.lateOrders.map((o) => o.minutesInStatus));
    cards.push({
      key: "late",
      label: "Late orders",
      count: input.lateOrders.length,
      href: "/admin/tracking",
      sublabel: oldestAgeLabel(oldest),
    });
  }

  if (input.confirmCount > 0) {
    cards.push({
      key: "confirm",
      label: "Awaiting confirmation",
      count: input.confirmCount,
      href: "/admin/orders?status=PENDING_CONFIRMATION",
      sublabel: oldestAgeLabel(input.confirmOldestMinutes),
    });
  }

  if (input.shiftsStaleCount > 0) {
    cards.push({
      key: "shifts",
      label: "Open shifts",
      count: input.shiftsStaleCount,
      href: "/admin/shifts",
      sublabel: oldestAgeLabel(input.shiftsOldestStaleMinutes),
    });
  }

  if (input.riderCashPendingCount > 0) {
    cards.push({
      key: "rider",
      label: "Rider cash pending",
      count: input.riderCashPendingCount,
      href: "/admin/riders/cash",
      sublabel: oldestAgeLabel(input.riderCashOldestMinutes),
    });
  }

  if (input.offlinePosEnabled && (input.syncConflicts ?? 0) > 0) {
    cards.push({
      key: "sync",
      label: "Sync conflicts",
      count: input.syncConflicts!,
      href: "/admin/sync-conflicts",
    });
  }

  if (input.pendingBookings > 0) {
    cards.push({
      key: "bookings",
      label: "Pending bookings",
      count: input.pendingBookings,
      href: "/admin/dine-in",
    });
  }

  if (input.lowStockCount > 0) {
    cards.push({
      key: "stock",
      label: "Low stock",
      count: input.lowStockCount,
      href: "/admin/inventory",
    });
  }

  if (input.lowRatingCount > 0) {
    cards.push({
      key: "feedback",
      label: "Low ratings today",
      count: input.lowRatingCount,
      href: "/admin/orders",
    });
  }

  return cards;
}

const PIPELINE_INCOMING = new Set([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
]);

export function isActiveIncomingStatus(status: string) {
  return PIPELINE_INCOMING.has(status);
}

export function isIncomingOrderLate(
  status: string,
  minutesInStatus: number,
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
) {
  if (status === "PENDING_CONFIRMATION" || status === "CONFIRMED") {
    return minutesInStatus >= thresholds.lateConfirmMinutes;
  }
  if (status === "PREPARING" || status === "READY") {
    return minutesInStatus >= thresholds.latePrepMinutes;
  }
  if (status === "OUT_FOR_DELIVERY") {
    return minutesInStatus >= thresholds.lateDeliveryMinutes;
  }
  return false;
}

export type IncomingSortRow = {
  status: string;
  minutesInStatus: number;
  updatedAt: string;
};

export function sortIncomingOrders<T extends IncomingSortRow>(
  rows: T[],
  thresholds: { lateConfirmMinutes: number; latePrepMinutes: number; lateDeliveryMinutes: number }
): T[] {
  return [...rows]
    .filter((r) => isActiveIncomingStatus(r.status))
    .sort((a, b) => {
      const aLate = isIncomingOrderLate(a.status, a.minutesInStatus, thresholds);
      const bLate = isIncomingOrderLate(b.status, b.minutesInStatus, thresholds);
      if (aLate !== bLate) return aLate ? -1 : 1;
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });
}

export function relativeMinutesLabel(minutes: number) {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

/** Nice integer ticks for order counts (deduped). */
export function niceOrderTicks(max: number, target = 5) {
  if (max <= 0) return [0, 1];
  const rough = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = norm <= 1 ? mag : norm <= 2 ? 2 * mag : norm <= 5 ? 5 * mag : 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return [...new Set(ticks)];
}

/** Nice ticks for currency axis. */
export function niceMoneyTicks(max: number, target = 5) {
  return niceOrderTicks(max, target);
}
