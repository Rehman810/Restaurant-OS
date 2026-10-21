import { describe, expect, it } from "vitest";
import { notificationMatrixCell } from "./notification-matrix";
import type { StoreSettings } from "@/lib/types";

describe("notificationMatrixCell", () => {
  it("reflects rider toggle for assignment row", () => {
    const settings = {
      emailNotifyRider: false,
    } as StoreSettings;
    expect(notificationMatrixCell("rider_assigned", "rider", settings)).toBe("off");
  });
});
