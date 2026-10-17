import { describe, expect, it } from "vitest";
import {
  buildNeedsAttentionCards,
  compactCurrency,
  formatDelta,
  greetingForHour,
  isActiveIncomingStatus,
  pluralize,
  niceOrderTicks,
  sortIncomingOrders,
} from "./helpers";
import { applyNavOptions, ADMIN_NAV_SECTIONS } from "@/modules/admin/navigation";

describe("greetingForHour", () => {
  it("uses afternoon band at 2 PM", () => {
    expect(greetingForHour(14)).toBe("Good afternoon");
  });
  it("uses morning band at 9 AM", () => {
    expect(greetingForHour(9)).toBe("Good morning");
  });
  it("uses evening band at 6 PM", () => {
    expect(greetingForHour(18)).toBe("Good evening");
  });
  it("uses night outside bands", () => {
    expect(greetingForHour(22)).toBe("Good night");
  });
});

describe("pluralize", () => {
  it("singular for 1", () => {
    expect(pluralize(1, "item")).toBe("item");
  });
  it("plural otherwise", () => {
    expect(pluralize(2, "item")).toBe("items");
  });
});

describe("compactCurrency", () => {
  it("formats thousands", () => {
    expect(compactCurrency(1500)).toBe("Rs 1.50k");
  });
});

describe("formatDelta", () => {
  it("shows em dash when prior period was zero", () => {
    expect(formatDelta(null, "new")).toBe("—");
  });
  it("handles zero previous flat", () => {
    expect(formatDelta(null, "flat")).toBe("—");
  });
  it("formats percent deltas", () => {
    expect(formatDelta(12, null)).toBe("+12%");
  });
});

describe("niceOrderTicks", () => {
  it("returns deduped ascending ticks", () => {
    const ticks = niceOrderTicks(7);
    expect(ticks[0]).toBe(0);
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(7);
  });
});

describe("buildNeedsAttentionCards", () => {
  const base = {
    lateOrders: [],
    confirmCount: 0,
    confirmOldestMinutes: null,
    syncConflicts: 2,
    offlinePosEnabled: false,
    shiftsStaleCount: 0,
    shiftsOldestStaleMinutes: null,
    riderCashPendingCount: 0,
    riderCashOldestMinutes: null,
    lowStockCount: 0,
    pendingBookings: 0,
    lowRatingCount: 0,
  };

  it("includes oldest age on late orders", () => {
    const cards = buildNeedsAttentionCards({
      ...base,
      lateOrders: [{ minutesInStatus: 695 }, { minutesInStatus: 120 }],
    });
    expect(cards[0]?.sublabel).toBe("oldest 11h 35m");
  });

  it("hides sync conflicts when offline POS is disabled", () => {
    const cards = buildNeedsAttentionCards({ ...base, syncConflicts: 5, offlinePosEnabled: false });
    expect(cards.find((c) => c.key === "sync")).toBeUndefined();
  });

  it("shows sync conflicts only when offline POS enabled", () => {
    const cards = buildNeedsAttentionCards({ ...base, syncConflicts: 3, offlinePosEnabled: true });
    expect(cards.find((c) => c.key === "sync")?.count).toBe(3);
  });
});

describe("sortIncomingOrders", () => {
  const thresholds = { lateConfirmMinutes: 5, latePrepMinutes: 20, lateDeliveryMinutes: 45 };

  it("drops terminal statuses and sorts late first then oldest", () => {
    const sorted = sortIncomingOrders(
      [
        {
          id: "1",
          status: "DELIVERED",
          minutesInStatus: 1,
          updatedAt: "2026-01-01T10:00:00Z",
        },
        {
          id: "2",
          status: "PREPARING",
          minutesInStatus: 30,
          updatedAt: "2026-01-01T09:00:00Z",
        },
        {
          id: "3",
          status: "CONFIRMED",
          minutesInStatus: 10,
          updatedAt: "2026-01-01T08:00:00Z",
        },
      ],
      thresholds
    );
    expect(sorted.map((o) => o.id)).toEqual(["3", "2"]);
  });
});

describe("isActiveIncomingStatus", () => {
  it("rejects completed states", () => {
    expect(isActiveIncomingStatus("COLLECTED")).toBe(false);
    expect(isActiveIncomingStatus("PREPARING")).toBe(true);
  });
});

describe("applyNavOptions sync conflicts", () => {
  it("removes sync conflicts unless offline POS is enabled", () => {
    const hidden = applyNavOptions(ADMIN_NAV_SECTIONS, { offlinePosEnabled: false });
    const ops = hidden.find((s) => s.title === "Operations")!;
    expect(ops.items.some((i) => i.href === "/admin/sync-conflicts")).toBe(false);

    const shown = applyNavOptions(ADMIN_NAV_SECTIONS, { offlinePosEnabled: true });
    const opsShown = shown.find((s) => s.title === "Operations")!;
    expect(opsShown.items.some((i) => i.href === "/admin/sync-conflicts")).toBe(true);
  });
});
