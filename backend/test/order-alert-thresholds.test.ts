import { describe, expect, it } from "vitest";
import type { StoreSettings } from "@prisma/client";
import { legacySlaMirrorFromAlertThresholds, orderAlertThresholds } from "../src/lib/order-alert-thresholds";

function row(partial: Partial<StoreSettings>): StoreSettings {
  return partial as StoreSettings;
}

describe("orderAlertThresholds", () => {
  it("prefers alert-threshold columns over legacy SLA", () => {
    const t = orderAlertThresholds(
      row({
        lateConfirmMinutes: 10,
        confirmSlaMinutes: 99,
        lateDeliveryMinutes: 50,
        deliverySlaMinutes: 99,
        latePrepMinutes: 22,
      })
    );
    expect(t).toEqual({ lateConfirmMinutes: 10, latePrepMinutes: 22, lateDeliveryMinutes: 50 });
  });

  it("falls back to legacy SLA when alert columns are null", () => {
    const t = orderAlertThresholds(
      row({
        lateConfirmMinutes: null as unknown as number,
        confirmSlaMinutes: 12,
        lateDeliveryMinutes: null as unknown as number,
        deliverySlaMinutes: 40,
      })
    );
    expect(t.lateConfirmMinutes).toBe(12);
    expect(t.lateDeliveryMinutes).toBe(40);
    expect(t.latePrepMinutes).toBe(30);
  });

  it("mirrors legacy columns when saving alert thresholds", () => {
    expect(legacySlaMirrorFromAlertThresholds({ lateConfirmMinutes: 8 })).toEqual({
      lateConfirmMinutes: 8,
      confirmSlaMinutes: 8,
    });
    expect(legacySlaMirrorFromAlertThresholds({ lateDeliveryMinutes: 55 })).toEqual({
      lateDeliveryMinutes: 55,
      deliverySlaMinutes: 55,
    });
  });
});
