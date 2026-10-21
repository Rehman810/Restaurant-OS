import { describe, expect, it } from "vitest";
import { diffSettingsKeys, settingsSnapshotForAudit } from "../src/lib/audit";
import { checkDangerousSettingsConfirm } from "../src/lib/settings-save-guard";
import { listDangerousChanges } from "../src/lib/settings-dangerous";
import { entryIsRestorable } from "../src/lib/settings-audit";

describe("settings audit", () => {
  it("diffs only changed keys", () => {
    const before = { storeName: "A", city: "Lahore", phone: "+923001234567" };
    const after = { storeName: "B", city: "Lahore", phone: "+923001234567" };
    const { before: b, after: a } = diffSettingsKeys(before, after, ["storeName", "city", "phone"]);
    expect(b).toEqual({ storeName: "A" });
    expect(a).toEqual({ storeName: "B" });
  });

  it("redacts secret-like field names from snapshots", () => {
    const snap = settingsSnapshotForAudit({
      storeName: "Test",
      apiSecret: "hidden",
      settingsVersion: 2,
    });
    expect(snap.storeName).toBe("Test");
    expect(snap.apiSecret).toBe("[redacted]");
    expect(snap.settingsVersion).toBeUndefined();
  });

  it("requires confirm for dangerous changes", () => {
    const current = { taxEnabled: false, taxPercent: 0 };
    const patch = { taxEnabled: true };
    expect(listDangerousChanges(current, patch)).toContain("taxEnabled");
    expect(checkDangerousSettingsConfirm(current, patch, false).ok).toBe(false);
    expect(checkDangerousSettingsConfirm(current, patch, true).ok).toBe(true);
  });

  it("marks dangerous history as not restorable", () => {
    expect(entryIsRestorable({ taxEnabled: false }, { taxEnabled: true })).toBe(false);
    expect(entryIsRestorable({ city: "A" }, { city: "B" })).toBe(true);
  });
});
