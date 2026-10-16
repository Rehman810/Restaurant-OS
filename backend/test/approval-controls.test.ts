import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { isValidPinFormat } from "../src/lib/approval-pin";
import { discountNeedsManagerApproval, requiresApprovalFor } from "../src/lib/order-approval";

const baseSettings = {
  requireApprovalForVoid: true,
  requireApprovalForRefund: true,
  requireApprovalForPriceOverride: true,
  maxCashierDiscountPercent: 10,
} as const;

describe("[APR-01] approval controls", () => {
  it("validates PIN format", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("12")).toBe(false);
    expect(isValidPinFormat("abcd")).toBe(false);
  });

  it("managers do not need approval for void", () => {
    expect(requiresApprovalFor("VOID", Role.MANAGER, baseSettings as never)).toBe(false);
  });

  it("cashiers need approval for void when enabled", () => {
    expect(requiresApprovalFor("VOID", Role.CASHIER, baseSettings as never)).toBe(true);
  });

  it("cashiers need approval only above max discount percent", () => {
    expect(discountNeedsManagerApproval(Role.CASHIER, 5, baseSettings as never)).toBe(false);
    expect(discountNeedsManagerApproval(Role.CASHIER, 15, baseSettings as never)).toBe(true);
    expect(discountNeedsManagerApproval(Role.MANAGER, 50, baseSettings as never)).toBe(false);
  });
});
