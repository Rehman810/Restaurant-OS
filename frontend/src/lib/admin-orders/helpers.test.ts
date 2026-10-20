import { describe, expect, it } from "vitest";
import {
  csvEscape,
  dispatchStatusLabel,
  formatAgeCompact,
  formatAgeSeconds,
  normalizeAddressDisplay,
  paymentBadgeLabel,
  paymentCellLabel,
} from "./helpers";
import type { AdminOrderRow } from "./types";

describe("admin orders helpers", () => {
  it("formatAgeSeconds", () => {
    expect(formatAgeSeconds(45)).toBe("<1m ago");
    expect(formatAgeSeconds(120)).toBe("2m ago");
    expect(formatAgeSeconds(3700)).toBe("1h 1m ago");
  });

  it("formatAgeCompact omits ago suffix", () => {
    expect(formatAgeCompact(300)).toBe("5m");
  });

  it("paymentBadgeLabel for COD due", () => {
    const row = {
      payment: { status: "cod" as const, label: "", methods: [], amountDue: 1920, codAmount: 1920 },
    } as Pick<AdminOrderRow, "payment"> as AdminOrderRow;
    expect(paymentBadgeLabel(row)).toContain("due");
  });

  it("dispatchStatusLabel uses Completed for terminals", () => {
    expect(dispatchStatusLabel("DELIVERED")).toBe("Completed");
    expect(dispatchStatusLabel("SERVED", "DINE_IN")).toBe("Completed");
  });

  it("normalizeAddressDisplay title-cases segments", () => {
    expect(normalizeAddressDisplay("karachi, block 5")).toBe("Karachi, Block 5");
  });

  it("paymentCellLabel COD", () => {
    const row = {
      payment: { status: "cod" as const, label: "x", methods: [], amountDue: 100, codAmount: 1920 },
    } as Pick<AdminOrderRow, "payment"> as AdminOrderRow;
    expect(paymentCellLabel(row)).toContain("COD");
    expect(paymentCellLabel(row)).toContain("1,920");
  });

  it("csvEscape prevents formula injection", () => {
    expect(csvEscape("=1+1")).toBe(`"'=1+1"`);
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
});
