import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./ia";
import {
  SETTINGS_SECTION_FIELD_KEYS,
  countSectionDirtyChanges,
  pickSectionFromSettings,
} from "./section-fields";
import type { StoreSettings } from "@/lib/types";

const base = {
  id: "default",
  storeName: "Test",
  storeTagline: "",
  phone: "",
  whatsapp: "",
  address: "",
  minimumOrder: 500,
  deliveryEstimateMin: 45,
  pickupEstimateMin: 20,
  openHour: 19,
  openMinute: 0,
  closeHour: 2,
  closeMinute: 30,
  closedMessage: "",
  forceClosed: false,
  autoConfirmOrders: false,
  autoAssignRiders: true,
  emailNotifyAdmin: true,
  emailNotifyManager: true,
  emailNotifyChef: true,
  emailNotifyCashier: true,
  emailNotifyWaiter: true,
  emailNotifyRider: true,
  emailNotifyCustomer: true,
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  youtubeUrl: "",
} as StoreSettings;

describe("section field keys", () => {
  it("defines patch keys for every form-backed section", () => {
    for (const section of SETTINGS_SECTIONS) {
      if (!section.usesSettingsForm) {
        expect(SETTINGS_SECTION_FIELD_KEYS[section.id]).toEqual([]);
        continue;
      }
      expect(SETTINGS_SECTION_FIELD_KEYS[section.id].length).toBeGreaterThan(0);
    }
  });

  it("tracks pos-controls fields independently", () => {
    const keys = SETTINGS_SECTION_FIELD_KEYS["pos-controls-approvals"];
    expect(keys).toContain("maxCashierDiscountPercent");
    expect(keys).toContain("voidReasonOptions");
  });
});

describe("section dirty state", () => {
  it("counts changes within a section only", () => {
    const baseline = pickSectionFromSettings("branding-theme", base);
    const edited = { ...base, storeName: "New name" };
    expect(countSectionDirtyChanges("branding-theme", edited, baseline)).toBe(1);
    expect(countSectionDirtyChanges("orders-delivery", edited, pickSectionFromSettings("orders-delivery", base))).toBe(
      0
    );
  });
});
