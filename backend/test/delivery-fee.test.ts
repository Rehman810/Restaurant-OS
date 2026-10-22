import { describe, expect, it } from "vitest";
import { computeDeliveryFee } from "../src/lib/delivery/fee";
import type { StoreSettings } from "@prisma/client";

const settings = {
  minimumOrder: 500,
  freeDeliveryAbove: 2000,
  deliveryEstimateMin: 45,
  deliveryEstimateMax: 60,
} as Pick<StoreSettings, "minimumOrder" | "freeDeliveryAbove" | "deliveryEstimateMin" | "deliveryEstimateMax">;

describe("computeDeliveryFee", () => {
  const area = {
    deliveryCharge: 150,
    minOrder: null,
    freeAbove: null,
    etaMinMinutes: 40,
    etaMaxMinutes: 55,
  };

  it("flags below minimum using store default", () => {
    const r = computeDeliveryFee(area, 400, settings);
    expect(r.minOrderMet).toBe(false);
    expect(r.charge).toBe(150);
    expect(r.reasons).toContain("below_minimum");
  });

  it("applies area minimum when set", () => {
    const r = computeDeliveryFee({ ...area, minOrder: 800 }, 700, settings);
    expect(r.effectiveMinOrder).toBe(800);
    expect(r.minOrderMet).toBe(false);
  });

  it("waives charge at global free threshold", () => {
    const r = computeDeliveryFee(area, 2000, settings);
    expect(r.charge).toBe(0);
    expect(r.freeApplied).toBe(true);
  });

  it("uses per-area free threshold when set", () => {
    const r = computeDeliveryFee({ ...area, freeAbove: 1500 }, 1500, settings);
    expect(r.charge).toBe(0);
    expect(r.freeApplied).toBe(true);
  });

  it("allows zero delivery charge", () => {
    const r = computeDeliveryFee({ ...area, deliveryCharge: 0 }, 600, settings);
    expect(r.charge).toBe(0);
    expect(r.minOrderMet).toBe(true);
  });
});
